import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Restoration from "../models/restoration.model.js";
import { ENDED_STATUSES, MEDIA_RULES } from "../config/executionTypes.js";
import { badRequest, conflict, notFound, sendError } from "../utils/httpError.js";
import { actorOf, checkVersion, cleanMediaSet, historyEntry, roleLabel } from "../services/execution.service.js";
import { deriveRestorationStatus } from "../services/progress.service.js";

// One restoration per section: an after photo + video for every subsection once the
// area is restored. LOCKED / READY are derived from the subsections.

const itemDone = (item) => Boolean(item && item.photos?.length && item.video);

const loadState = async (sectionId) => {
  const section = await Section.findById(sectionId).select("name blockProfile");
  if (!section) throw notFound("Section not found");
  const [subs, stored] = await Promise.all([
    SubSection.find({ section: section._id, typeOfWork: { $exists: true } })
      .select("name typeOfWork executionStatus seq initialCondition.photos")
      .sort({ seq: 1 }),
    Restoration.findOne({ section: section._id }),
  ]);
  const total = subs.length;
  const ended = subs.filter((s) => ENDED_STATUSES.includes(s.executionStatus)).length;
  const approved = subs.filter((s) => s.executionStatus === "APPROVED").length;
  const status = deriveRestorationStatus({ total, ended }, stored);
  return { section, subs, stored, total, ended, approved, status };
};

const view = (state) => {
  const { section, subs, stored, total, ended, approved, status } = state;
  const items = new Map((stored?.items || []).map((item) => [String(item.subSection), item]));
  return {
    section: { _id: section._id, name: section.name, blockProfile: section.blockProfile },
    status,
    total,
    ended,
    approved,
    // Waiting approval but some subsection was sent back since: the approver can't approve yet
    approveBlocked: status === "PENDING_APPROVAL" && approved < total,
    submittedAt: stored?.submittedAt,
    submittedBy: stored?.submittedBy,
    approval: stored?.approval,
    history: stored?.history || [],
    version: stored ? stored.__v : null,
    items: subs.map((sub) => {
      const item = items.get(String(sub._id));
      return {
        subSection: { _id: sub._id, name: sub.name, typeOfWork: sub.typeOfWork, executionStatus: sub.executionStatus },
        // The first site-condition photo, shown next to the after photo
        before: sub.initialCondition?.photos?.[0] || null,
        item: item || null,
        done: itemDone(item),
      };
    }),
  };
};

const assertEditable = (state) => {
  if (state.status === "LOCKED") {
    throw conflict(`Restoration opens when all ${state.total} subsections have ended · ${state.ended}/${state.total} ended`, "WRONG_STATE");
  }
  if (!["READY", "REJECTED"].includes(state.status)) throw conflict("Restoration has been sent for approval", "WRONG_STATE");
};

// GET /api/sections/:id/restoration   (viewExecution)
export const getRestoration = async (req, res) => {
  try {
    res.json(view(await loadState(req.params.id)));
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/sections/:id/restoration/items/:subSectionId   (executeRestoration)
// Saved one by one, so it isn't version-checked; submit is
export const saveRestorationItem = async (req, res) => {
  try {
    const state = await loadState(req.params.id);
    assertEditable(state);
    const sub = state.subs.find((s) => String(s._id) === req.params.subSectionId);
    if (!sub) throw notFound("Subsection not found in this section");

    const errors = {};
    const media = cleanMediaSet(req.body, MEDIA_RULES.restorationItem, "", errors, {
      photos: "Take the after photo",
      video: "Record a video",
    });
    if (Object.keys(errors).length) throw badRequest("Fill the highlighted fields", errors);

    const item = {
      subSection: sub._id,
      ...media,
      remarks: String(req.body?.remarks || "").trim() || undefined,
      savedAt: new Date(),
      savedBy: actorOf(req),
    };
    // Atomic, so items saved from two phones at once don't collide; still only while editable
    const editable = { $or: [{ status: { $exists: false } }, { status: null }, { status: "REJECTED" }] };
    const replaced = await Restoration.updateOne(
      { section: state.section._id, "items.subSection": sub._id, ...editable },
      { $set: { "items.$": item, updatedBy: actorOf(req) }, $inc: { __v: 1 } }
    );
    if (!replaced.matchedCount) {
      try {
        await Restoration.updateOne(
          { section: state.section._id, ...editable },
          { $push: { items: item }, $set: { updatedBy: actorOf(req) }, $inc: { __v: 1 } },
          { upsert: true }
        );
      } catch (error) {
        // The restoration exists but was submitted in the meantime
        if (error.code === 11000) throw conflict("Restoration has been sent for approval", "WRONG_STATE");
        throw error;
      }
    }
    res.json(view(await loadState(req.params.id)));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/restoration/submit   (executeRestoration)
export const submitRestoration = async (req, res) => {
  try {
    const state = await loadState(req.params.id);
    assertEditable(state);
    if (state.ended < state.total) {
      throw conflict(`Every subsection must end execution first · ${state.ended}/${state.total} ended`, "WRONG_STATE");
    }
    const restoration = state.stored;
    if (!restoration) throw badRequest("Capture the restoration of every subsection first");
    checkVersion(restoration, req.body?.version);
    const missing = view(state).items.filter((row) => !row.done);
    if (missing.length) {
      throw badRequest(
        `${missing.length} subsection${missing.length === 1 ? " still needs" : "s still need"} an after photo and video`,
        Object.fromEntries(missing.map((row) => [`items.${row.subSection._id}`, "Missing"]))
      );
    }
    restoration.status = "PENDING_APPROVAL";
    restoration.submittedAt = new Date();
    restoration.submittedBy = actorOf(req);
    restoration.approval = undefined;
    restoration.history.push(historyEntry(req, "submitted", "Restoration sent for approval"));
    restoration.updatedBy = actorOf(req);
    await restoration.save();
    res.json(view(await loadState(req.params.id)));
  } catch (error) {
    sendError(res, error);
  }
};

const decide = (status) => async (req, res) => {
  try {
    const state = await loadState(req.params.id);
    const restoration = state.stored;
    if (state.status !== "PENDING_APPROVAL" || !restoration) {
      throw conflict("Only a restoration waiting approval can be approved or rejected", "WRONG_STATE");
    }
    checkVersion(restoration, req.body?.version);
    const remark = String(req.body?.remark || "").trim();
    if (status === "REJECTED" && !remark) {
      throw badRequest("Write a reason before rejecting.", { remark: "Write a reason before rejecting." });
    }
    // TODO(confirm): a subsection rejected after submission blocks approving the restoration
    if (status === "APPROVED" && state.approved < state.total) {
      throw conflict(`Approve every subsection first · ${state.approved} of ${state.total} approved`, "RESTORATION_BLOCKED");
    }
    const by = actorOf(req);
    const who = roleLabel(by.role);
    restoration.status = status;
    restoration.approval = { status, by, at: new Date(), remark: remark || undefined, client: req.client };
    restoration.history.push(
      status === "APPROVED"
        ? historyEntry(req, "approved", `Approved by ${who} · section restored and closed`)
        : historyEntry(req, "rejected", `Needs fix (${who}): ${remark}`, remark)
    );
    restoration.updatedBy = by;
    await restoration.save();
    res.json(view(await loadState(req.params.id)));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/restoration/approve, /reject   (approveExecution)
export const approveRestoration = decide("APPROVED");
export const rejectRestoration = decide("REJECTED");
