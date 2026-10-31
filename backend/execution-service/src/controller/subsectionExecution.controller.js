import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Trenching from "../models/trenching.model.js";
import { EXECUTION_TYPES } from "../config/executionTypes.js";
import { HttpError, badRequest, conflict, notFound, sendError } from "../utils/httpError.js";
import { formatLatLong, isValidPoint } from "../utils/geo.js";
import { subsectionName } from "../utils/subsectionName.js";
import {
  actorOf,
  assertStatus,
  buildEntry,
  buildExecutionPoint,
  buildNewSubsection,
  checkVersion,
  endedText,
  historyEntry,
  roleLabel,
  pitSuggestion,
  startPitSuggestion,
  startedText,
} from "../services/execution.service.js";
import { sectionExecutionSummaries } from "../services/progress.service.js";
import { jobCard } from "../services/views.service.js";
import { queueStampsFor } from "../services/stampQueue.service.js";
import { actorRole, checkSection, forbidden, sectionStage } from "../services/access.service.js";
import { REVIEW_SLOTS, SLOT_LABELS, bothApproved, syncSectionStage } from "../services/review.service.js";

// The OFC execution flow for one subsection. Rules are in services/execution.service.js.

const loadExecutionSub = async (id) => {
  const sub = await SubSection.findById(id);
  if (!sub) throw notFound("Subsection not found");
  if (!sub.typeOfWork) throw conflict("This subsection was created before execution tracking", "WRONG_STATE");
  return sub;
};

const loadBlockSection = async (id) => {
  const section = id ? await Section.findById(id) : null;
  if (!section) throw badRequest("Section not found", { section: "Section not found" });
  if (!section.blockProfile) {
    throw badRequest("Execution subsections can only be added to a block profile's sections", { section: "Not a block section" });
  }
  return section;
};

const respond = async (res, sub, status = 200, extra = {}) => res.status(status).json({ ...(await jobCard(sub)), ...extra });

// GET /api/subsections/next-name?section=&roadName=&typeOfWork=   (viewExecution)
// A preview only: the real name is given on create, so it can move on if someone creates first
export const previewName = async (req, res) => {
  try {
    const { section: sectionId, roadName, typeOfWork } = req.query;
    const section = await loadBlockSection(sectionId);
    const seq = (section.subSectionSeq || 0) + 1;
    res.json({ name: subsectionName(roadName, EXECUTION_TYPES[typeOfWork] ? typeOfWork : undefined, seq), seq });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/subsections with typeOfWork   (executeSubsection)
export const createExecutionSubsection = async (req, res) => {
  try {
    const section = await loadBlockSection(req.body.section);
    // Once every subsection is approved the section moves up for review; a Zonal Manager's or
    // Admin's rejection brings it back
    if (sectionStage(section) !== "FIELD") {
      throw conflict("This section has been sent for Zonal Manager / Admin review, so no subsections can be added", "WRONG_STATE");
    }
    const built = buildNewSubsection(req.body);
    const summary = (await sectionExecutionSummaries([section._id])).get(String(section._id));
    if (["PENDING_APPROVAL", "APPROVED"].includes(summary?.restoration.status)) {
      throw conflict("This section's restoration is waiting approval or approved, so no subsections can be added", "WRONG_STATE");
    }

    // Atomic counter: concurrent creates never get the same number, and numbers are never reused
    const counted = await Section.findOneAndUpdate({ _id: section._id }, { $inc: { subSectionSeq: 1 } }, { new: true });
    const seq = counted.subSectionSeq;
    const type = EXECUTION_TYPES[built.typeOfWork];
    const sub = await SubSection.create({
      section: section._id,
      typeOfWork: built.typeOfWork,
      seq,
      name: subsectionName(built.roadName, built.typeOfWork, seq),
      roadName: built.roadName,
      fromLatLong: formatLatLong(built.from),
      toLatLong: formatLatLong(built.to),
      subSectionLength: built.length,
      // Legacy field the old screens show
      methodOfConstruction: type.methodOfConstruction,
      executionStatus: "NOT_STARTED",
      initialCondition: built.initialCondition,
      history: [historyEntry(req, "created", "Created with site condition photos and video")],
      createdBy: actorOf(req),
      updatedBy: actorOf(req),
    });
    queueStampsFor(sub);
    await respond(res, sub, 201);
  } catch (error) {
    sendError(res, error);
  }
};

// Subsections of the same block with a recorded pit: adjoining sections can share one
const subsWithPits = async (sub) => {
  const { blockProfile } = (await Section.findById(sub.section).select("blockProfile")) || {};
  const sections = blockProfile ? await Section.find({ blockProfile }).distinct("_id") : [sub.section];
  return SubSection.find({
    section: { $in: sections },
    $or: [{ "start.pit.latitude": { $exists: true } }, { "end.pit.latitude": { $exists: true } }],
  }).select("name typeOfWork start.pit end.pit");
};

// GET /api/subsections/:id/pit-suggestion?which=start|end&lat=&lng=   (viewExecution)
// A pit this start / end can reuse (see pitSuggestion); lat and lng say where the user is
export const getPitSuggestion = async (req, res) => {
  try {
    const which = req.query.which === "end" ? "end" : "start";
    const sub = await loadExecutionSub(req.params.id);
    const at = { lat: parseFloat(req.query.lat), lng: parseFloat(req.query.lng) };
    res.json({ suggestion: pitSuggestion(sub, await subsWithPits(sub), which, isValidPoint(at.lat, at.lng) ? at : null) });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/subsections/:id/start-pit-suggestion   (viewExecution; older apps)
export const getStartPitSuggestion = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    res.json({ suggestion: startPitSuggestion(sub, await subsWithPits(sub)) });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/subsections/:id/start   (executeSubsection)
export const startSubsection = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    checkVersion(sub, req.body?.version);
    assertStatus(sub, ["NOT_STARTED"], "Execution has already started");
    sub.start = buildExecutionPoint(req, sub, "start");
    sub.executionStatus = "IN_PROGRESS";
    sub.history.push(historyEntry(req, "started", startedText(sub.typeOfWork)));
    sub.updatedBy = actorOf(req);
    await sub.save();
    queueStampsFor(sub);
    await respond(res, sub);
  } catch (error) {
    sendError(res, error);
  }
};

const assertEntriesOpen = (sub) =>
  assertStatus(sub, ["IN_PROGRESS"], "Entries can only change while the subsection is in progress");

// Entries are checked against the status, not the version, so a team can add them
// from two phones; each change still bumps the version (atomically) so a stale End is refused.
// TODO(confirm): entries not version-checked
const touch = async (req, sub) => {
  await SubSection.updateOne({ _id: sub._id }, { $inc: { __v: 1 }, $set: { updatedBy: actorOf(req) } });
  return SubSection.findById(sub._id);
};

// POST /api/subsections/:id/entries   (executeSubsection)
export const addEntry = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    assertEntriesOpen(sub);
    const entry = await Trenching.create(buildEntry(req, sub));
    queueStampsFor(entry);
    await respond(res, await touch(req, sub), 201, { entryId: entry._id });
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/subsections/:id/entries/:entryId   (executeSubsection)
export const updateEntry = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    assertEntriesOpen(sub);
    const entry = await Trenching.findOne({ _id: req.params.entryId, subSection: sub._id });
    if (!entry) throw notFound("Entry not found");
    // Keep when and by whom the entry was first captured
    const { capturedAt: _capturedAt, createdBy: _createdBy, ...changes } = buildEntry(req, sub);
    entry.set(changes);
    await entry.save();
    queueStampsFor(entry);
    await respond(res, await touch(req, sub));
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/subsections/:id/entries/:entryId   (executeSubsection)
export const deleteEntry = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    assertEntriesOpen(sub);
    const entry = await Trenching.findOneAndDelete({ _id: req.params.entryId, subSection: sub._id });
    if (!entry) throw notFound("Entry not found");
    await respond(res, await touch(req, sub));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/subsections/:id/end   (executeSubsection)
export const endSubsection = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    checkVersion(sub, req.body?.version);
    assertStatus(sub, ["IN_PROGRESS"], "Only a subsection in progress can be ended");
    if (!(await Trenching.exists({ subSection: sub._id }))) {
      throw badRequest("Add at least one entry before ending", { entries: "Add at least one entry before ending" });
    }
    sub.end = buildExecutionPoint(req, sub, "end");
    sub.executionStatus = "PENDING_APPROVAL";
    sub.approval = undefined;
    // A reviewer who rejected reviews the fix; an approval given before stays
    for (const slot of Object.values(REVIEW_SLOTS)) {
      if (sub.review?.[slot]?.status !== "APPROVED") sub.set(`review.${slot}`, undefined);
    }
    sub.history.push(historyEntry(req, "ended", endedText(sub.typeOfWork)));
    sub.updatedBy = actorOf(req);
    await sub.save();
    queueStampsFor(sub);
    await respond(res, sub);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/subsections/:id/reopen   (executeSubsection)
// The previous end stays on the record and is returned so clients pre-fill the End wizard
export const reopenSubsection = async (req, res) => {
  try {
    const sub = await loadExecutionSub(req.params.id);
    checkVersion(sub, req.body?.version);
    assertStatus(sub, ["REJECTED"], "Only a subsection that needs a fix can be reopened");
    sub.executionStatus = "IN_PROGRESS";
    sub.history.push(historyEntry(req, "reopened", "Reopened to fix the rejection"));
    sub.updatedBy = actorOf(req);
    await sub.save();
    await respond(res, sub, 200, { previousEnd: sub.end });
  } catch (error) {
    sendError(res, error);
  }
};

// Cluster Head and GIS Head each fill their own review slot. The subsection is APPROVED once
// both have approved; either one's reject sends it back to the Field Executive.
const decide = (status) => async (req, res) => {
  try {
    const slot = REVIEW_SLOTS[actorRole(req)];
    if (!slot) throw forbidden("Subsections are reviewed by the Cluster Head and the GIS Head");
    const sub = await loadExecutionSub(req.params.id);
    checkVersion(sub, req.body?.version);
    assertStatus(sub, ["PENDING_APPROVAL"], "Only a subsection waiting approval can be approved or rejected");
    if (sub.review?.[slot]?.status === "APPROVED") {
      throw conflict(`The ${SLOT_LABELS[slot]} has already approved this subsection`, "WRONG_STATE");
    }
    const remark = String(req.body?.remark || "").trim();
    if (status === "REJECTED" && !remark) {
      throw badRequest("Write a reason before rejecting.", { remark: "Write a reason before rejecting." });
    }
    const by = actorOf(req);
    const decision = { status, by, at: new Date(), remark: remark || undefined, client: req.client };
    sub.set(`review.${slot}`, decision);
    const who = roleLabel(by.role);
    if (status === "REJECTED") {
      sub.executionStatus = "REJECTED";
      sub.approval = decision;
      sub.history.push(historyEntry(req, "rejected", `Needs fix (${who}): ${remark}`, remark));
    } else if (bothApproved(sub.review)) {
      sub.executionStatus = "APPROVED";
      sub.approval = decision;
      sub.history.push(historyEntry(req, "approved", `Approved by ${who} · approved by Cluster Head and GIS Head`));
    } else {
      const other = slot === "clusterHead" ? "gisHead" : "clusterHead";
      sub.history.push(historyEntry(req, "approved", `Approved by ${who} · waiting for the ${SLOT_LABELS[other]}`));
    }
    sub.updatedBy = by;
    await sub.save();
    if (sub.executionStatus === "APPROVED") await syncSectionStage(req, sub.section);
    await respond(res, sub);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/subsections/:id/approve, /reject   (approveExecution)
export const approveSubsection = decide("APPROVED");
export const rejectSubsection = decide("REJECTED");

// Used by the trenching routes so the old screens can't change an execution subsection's
// entries outside In progress, or outside the user's blocks
export const assertTrenchingAllowed = async (req, subSectionId) => {
  const sub = subSectionId ? await SubSection.findById(subSectionId).select("typeOfWork executionStatus section") : null;
  if (!sub?.typeOfWork) return;
  const section = await Section.findById(sub.section);
  if (section) await checkSection(req, "executeSubsection", section, { write: true });
  if (sub.executionStatus !== "IN_PROGRESS") {
    throw new HttpError(409, "Entries can only change while the subsection is in progress", { code: "WRONG_STATE" });
  }
};
