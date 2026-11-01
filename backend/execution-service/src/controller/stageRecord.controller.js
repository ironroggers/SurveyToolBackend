import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import StageRecord from "../models/stageRecord.model.js";
import { isValidPoint } from "../utils/geo.js";
import { EXECUTION_TYPES, STAGES, STAGE_ORDER, stageRecordName } from "../config/executionTypes.js";
import { badRequest, conflict, notFound, sendError } from "../utils/httpError.js";
import { actorOf, checkVersion, historyEntry, nearestPit, roleLabel } from "../services/execution.service.js";
import { actorRole, can, forbidden, sectionStage } from "../services/access.service.js";
import { REVIEW_SLOTS, SLOT_LABELS, bothApproved, syncSectionStage } from "../services/review.service.js";
import { assertRecordComplete, assertRecordStage, buildRecordValues, codeFor, nextSeq, recordLinkedBy } from "../services/stage.service.js";
import { queueStageStamps, recordsView, recordView, stagesView } from "../services/stageViews.service.js";

// Chamber, Ducting, Coupling, Route Marker and Blowing records. Rules are in
// services/stage.service.js; the review works as it does for subsections.

const assertRecordStatus = (record, allowed, message) => {
  if (!allowed.includes(record.status)) throw conflict(message, "WRONG_STATE");
};

const assertFieldStage = (section, message) => {
  if (sectionStage(section) !== "FIELD") throw conflict(message, "WRONG_STATE");
};

const notInField = "This section has been sent for Zonal Manager / Admin review, so nothing can be changed here";

const DUPLICATE_RUN = "This subsection already has a duct run";
const saveRecord = async (record) => {
  try {
    await record.save();
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.["links.subSection"]) throw badRequest(DUPLICATE_RUN, { subSection: DUPLICATE_RUN });
    throw error;
  }
};

const respond = async (res, record, status = 200) => res.status(status).json(await recordView(record));

const FIELD_FILTER = { $or: [{ "review.stage": "FIELD" }, { "review.stage": { $exists: false } }] };

const assertAnyStage = (stage) => {
  if (!STAGE_ORDER.includes(stage)) throw notFound("Stage not found");
};

// GET /api/sections/:id/stages   (viewExecution)
export const getStages = async (req, res) => {
  try {
    res.json(await stagesView(req.access.section, req.access.profile));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/stages/:stage/complete   (executeSubsection)
// Refused while the stage has unfinished work. Warnings never stop it.
export const completeStage = async (req, res) => {
  try {
    const { section, profile } = req.access;
    const { stage } = req.params;
    assertAnyStage(stage);
    assertFieldStage(section, notInField);
    const view = await stagesView(section, profile);
    const { blockers } = view.stages.find((s) => s.key === stage);
    if (blockers.length) throw conflict(blockers.join(" "), "STAGE_BLOCKED");
    const updated = await Section.findOneAndUpdate(
      { _id: section._id, ...FIELD_FILTER, [`stageCompletion.${stage}.at`]: { $exists: false } },
      {
        $set: { [`stageCompletion.${stage}`]: { at: new Date(), by: actorOf(req) } },
        $push: { "review.history": historyEntry(req, "stage_complete", `${STAGES[stage].label} marked complete`) },
      },
      { new: true }
    );
    if (!updated) throw conflict("This was updated on another device", "STALE");
    res.json(await stagesView((await syncSectionStage(req, section._id)) || updated, profile));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/stages/:stage/reopen   (executeSubsection)
export const reopenStage = async (req, res) => {
  try {
    const { section, profile } = req.access;
    const { stage } = req.params;
    assertAnyStage(stage);
    assertFieldStage(section, notInField);
    const updated = await Section.findOneAndUpdate(
      { _id: section._id, ...FIELD_FILTER, [`stageCompletion.${stage}.at`]: { $exists: true } },
      {
        $unset: { [`stageCompletion.${stage}`]: 1 },
        $push: { "review.history": historyEntry(req, "stage_reopened", `${STAGES[stage].label} reopened`) },
      },
      { new: true }
    );
    if (!updated) throw conflict("This was updated on another device", "STALE");
    res.json(await stagesView(updated, profile));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/sections/:id/stages/:stage/records?status=   (viewExecution)
export const listRecords = async (req, res) => {
  try {
    assertRecordStage(req.params.stage);
    res.json(await recordsView(req.access.section, req.access.profile, req.params.stage, req.query.status));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/stages/:stage/records   (executeSubsection)
// Always a draft; the client submits it next. Adding to a completed stage needs a reopen.
export const createRecord = async (req, res) => {
  try {
    const { section } = req.access;
    const { stage } = req.params;
    assertRecordStage(stage);
    assertFieldStage(section, "This section has been sent for Zonal Manager / Admin review, so nothing can be added");
    if (section.stageCompletion?.[stage]?.at) throw conflict("Marked complete. Reopen the stage to add more.", "WRONG_STATE");

    const values = await buildRecordValues(req, stage, section);
    const code = codeFor(stage, values.data);
    const seq = await nextSeq(section.blockProfile, code);
    const by = actorOf(req);
    const record = new StageRecord({
      ...values,
      section: section._id,
      blockProfile: section.blockProfile,
      stage,
      code,
      seq,
      name: stageRecordName(stage, values.data, seq),
      history: [historyEntry(req, "created", "Created")],
      createdBy: by,
      updatedBy: by,
    });
    await saveRecord(record);
    queueStageStamps(record);
    await respond(res, record, 201);
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/stage-records/:id   (viewExecution)
export const getRecord = async (req, res) => {
  try {
    await respond(res, req.access.record);
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/stage-records/:id   (executeSubsection)
// A draft is editable until submitted. Zonal Managers and Admin edit as they do elsewhere: any
// status, and after the section has left the field, without touching status or approvals.
export const updateRecord = async (req, res) => {
  try {
    const { record, section } = req.access;
    const manager = can(req, "deleteSubsection");
    if (!manager) {
      assertFieldStage(section, notInField);
      assertRecordStatus(record, ["IN_PROGRESS"], "Submitted, so it can't be edited. It opens again only if a reviewer sends it back.");
    }
    checkVersion(record, req.body?.version);
    const values = await buildRecordValues(req, record.stage, section, { recordId: record._id, full: record.status !== "IN_PROGRESS" });

    // A type with another code takes a new number; the links are ids, so nothing else changes
    const code = codeFor(record.stage, values.data);
    if (code !== record.code) {
      record.code = code;
      record.seq = await nextSeq(record.blockProfile, code);
    }
    record.name = stageRecordName(record.stage, values.data, record.seq);
    record.set({ ...values, links: values.links });
    record.history.push(historyEntry(req, "edited", "Edited"));
    record.updatedBy = actorOf(req);
    await saveRecord(record);
    queueStageStamps(record);
    await respond(res, record);
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/stage-records/:id   (executeSubsection; deleteSubsection for anything but an unreviewed draft)
export const deleteRecord = async (req, res) => {
  try {
    const { record, section } = req.access;
    const unreviewedDraft = record.status === "IN_PROGRESS" && !record.approval?.status && !record.review?.clusterHead?.status && !record.review?.gisHead?.status;
    if (!can(req, "deleteSubsection")) {
      assertFieldStage(section, notInField);
      if (!unreviewedDraft) throw conflict("Only a draft that hasn't been reviewed can be deleted", "WRONG_STATE");
    }
    const linked = await recordLinkedBy(record._id);
    if (linked) throw conflict(`${linked.name} is linked to ${record.name}. Change that first.`, "LINKED");
    await record.deleteOne();
    // The rest of the section may now all be approved
    await syncSectionStage(req, section._id);
    res.json({ message: `${record.name} deleted` });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/stage-records/:id/submit   (executeSubsection)
export const submitRecord = async (req, res) => {
  try {
    const { record, section } = req.access;
    assertFieldStage(section, notInField);
    checkVersion(record, req.body?.version);
    assertRecordStatus(record, ["IN_PROGRESS"], "Only a draft can be submitted");
    assertRecordComplete(record);
    const fixed = record.approval?.status === "REJECTED";
    record.status = "PENDING_APPROVAL";
    record.approval = undefined;
    // A reviewer who rejected reviews the fix; an approval given before stays
    for (const slot of Object.values(REVIEW_SLOTS)) {
      if (record.review?.[slot]?.status !== "APPROVED") record.set(`review.${slot}`, undefined);
    }
    record.submittedAt = new Date();
    record.submittedBy = actorOf(req);
    record.history.push(historyEntry(req, "submitted", fixed ? "Fixed and resubmitted" : "Submitted for review"));
    record.updatedBy = actorOf(req);
    await record.save();
    await respond(res, record);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/stage-records/:id/reopen   (executeSubsection)
// A sent-back record becomes editable again. The remark stays until it's resubmitted.
export const reopenRecord = async (req, res) => {
  try {
    const { record, section } = req.access;
    assertFieldStage(section, notInField);
    checkVersion(record, req.body?.version);
    assertRecordStatus(record, ["REJECTED"], "Only a record that needs a fix can be reopened");
    record.status = "IN_PROGRESS";
    record.history.push(historyEntry(req, "reopened", "Reopened to fix the rejection"));
    record.updatedBy = actorOf(req);
    await record.save();
    await respond(res, record);
  } catch (error) {
    sendError(res, error);
  }
};

// Cluster Head and GIS Head each fill their own review slot. APPROVED once both have approved;
// either one's reject sends it back to the Field Executive.
const decide = (status) => async (req, res) => {
  try {
    const { record } = req.access;
    const slot = REVIEW_SLOTS[actorRole(req)];
    if (!slot) throw forbidden("Records are reviewed by the Cluster Head and the GIS Head");
    checkVersion(record, req.body?.version);
    assertRecordStatus(record, ["PENDING_APPROVAL"], "Only a record waiting approval can be approved or rejected");
    if (record.review?.[slot]?.status === "APPROVED") {
      throw conflict(`The ${SLOT_LABELS[slot]} has already approved this record`, "WRONG_STATE");
    }
    const remark = String(req.body?.remark || "").trim();
    if (status === "REJECTED" && !remark) {
      throw badRequest("Write a reason before rejecting.", { remark: "Write a reason before rejecting." });
    }
    const by = actorOf(req);
    const decision = { status, by, at: new Date(), remark: remark || undefined, client: req.client };
    record.set(`review.${slot}`, decision);
    const who = roleLabel(by.role);
    if (status === "REJECTED") {
      record.status = "REJECTED";
      record.approval = decision;
      record.history.push(historyEntry(req, "rejected", `Needs fix (${who}): ${remark}`, remark));
    } else if (bothApproved(record.review)) {
      record.status = "APPROVED";
      record.approval = decision;
      record.history.push(historyEntry(req, "approved", `Approved by ${who} · approved by Cluster Head and GIS Head`));
    } else {
      const other = slot === "clusterHead" ? "gisHead" : "clusterHead";
      record.history.push(historyEntry(req, "approved", `Approved by ${who} · waiting for the ${SLOT_LABELS[other]}`));
    }
    record.updatedBy = by;
    await record.save();
    if (record.status === "APPROVED") await syncSectionStage(req, record.section);
    await respond(res, record);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/stage-records/:id/approve, /reject   (reviewSubsection)
export const approveRecord = decide("APPROVED");
export const rejectRecord = decide("REJECTED");

// GET /api/sections/:id/stages/CHAMBER/pit-suggestion?lat=&lng=   (viewExecution)
// An existing pit within the suggestion limit that a chamber here can sit on
export const getChamberPitSuggestion = async (req, res) => {
  try {
    const here = { lat: parseFloat(req.query.lat), lng: parseFloat(req.query.lng) };
    if (!isValidPoint(here.lat, here.lng)) return res.json({ suggestion: null });
    const sections = await Section.find({ blockProfile: req.access.section.blockProfile }).distinct("_id");
    const subs = await SubSection.find({
      section: { $in: sections },
      $or: [{ "start.pit.latitude": { $exists: true } }, { "end.pit.latitude": { $exists: true } }],
    }).select("name typeOfWork start.pit end.pit");
    const nearest = nearestPit(subs, here);
    if (!nearest) return res.json({ suggestion: null });
    const { other, side, distance } = nearest;
    const pit = other[side].pit;
    res.json({
      suggestion: {
        subSection: other._id,
        name: other.name,
        pitLabel: EXECUTION_TYPES[other.typeOfWork]?.[side === "start" ? "pitA" : "pitB"],
        distanceM: Math.round(distance * 10) / 10,
        latitude: pit.latitude,
        longitude: pit.longitude,
        accuracy: pit.accuracy,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
};
