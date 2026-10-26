import mongoose from "mongoose";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import { badRequest, conflict, sendError } from "../utils/httpError.js";
import { actorOf, historyEntry, roleLabel } from "../services/execution.service.js";
import { actorRole, forbidden, sectionStage } from "../services/access.service.js";
import { sectionExecutionSummaries } from "../services/progress.service.js";

// A block section's review above the subsections (services/review.service.js has the flow).
// The Zonal Manager acts on a section at ZONAL, Admin on one at ADMIN.
const LEVELS = {
  "ZONAL MANAGER": { stage: "ZONAL", key: "zonal", next: "ADMIN", approved: "Approved by Zonal Manager · sent to Admin" },
  ADMIN: { stage: "ADMIN", key: "admin", next: "FROZEN", approved: "Approved by Admin · section frozen" },
};

const STAGE_TEXT = {
  FIELD: "Its subsections are still being executed or reviewed",
  ZONAL: "It's with the Zonal Manager",
  ADMIN: "It's with Admin",
  FROZEN: "It's frozen",
};

const levelFor = (req, section) => {
  const level = LEVELS[actorRole(req)];
  if (!level) throw forbidden("Sections are reviewed by the Zonal Manager and Admin");
  const stage = sectionStage(section);
  if (stage !== level.stage) throw conflict(`This section can't be reviewed by you now. ${STAGE_TEXT[stage]}.`, "WRONG_STATE");
  return level;
};

// What the section review screen shows
export const reviewView = async (section) => {
  const subs = await SubSection.find({ section: section._id, typeOfWork: { $exists: true } })
    .select("name typeOfWork executionStatus seq review approval roadName subSectionLength")
    .sort({ seq: 1 })
    .lean();
  const summary = (await sectionExecutionSummaries([section._id])).get(String(section._id));
  return {
    section: { _id: section._id, name: section.name, blockProfile: section.blockProfile, fromNode: section.fromNode, toNode: section.toNode },
    stage: sectionStage(section),
    zonal: section.review?.zonal,
    admin: section.review?.admin,
    history: section.review?.history || [],
    counts: summary?.counts,
    restoration: summary?.restoration,
    subsections: subs.map((s) => ({
      _id: s._id,
      name: s.name,
      typeOfWork: s.typeOfWork,
      executionStatus: s.executionStatus,
      roadName: s.roadName,
      subSectionLength: s.subSectionLength,
      review: s.review || {},
      remark: s.executionStatus === "REJECTED" ? s.approval?.remark : undefined,
    })),
  };
};

// GET /api/sections/:id/review   (viewExecution)
export const getSectionReview = async (req, res) => {
  try {
    res.json(await reviewView(req.access.section));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/review/approve   (reviewSection)
// Zonal Manager: ZONAL → ADMIN. Admin: ADMIN → FROZEN.
export const approveSection = async (req, res) => {
  try {
    const { section } = req.access;
    const level = levelFor(req, section);
    const by = actorOf(req);
    const decision = { status: "APPROVED", by, at: new Date(), client: req.client };
    // Atomic on the stage: a second click or another reviewer can't move it twice
    const updated = await Section.findOneAndUpdate(
      { _id: section._id, "review.stage": level.stage },
      {
        $set: { "review.stage": level.next, [`review.${level.key}`]: decision },
        $push: { "review.history": historyEntry(req, "approved", level.approved) },
      },
      { new: true }
    );
    if (!updated) throw conflict("This section was reviewed by someone else. Refresh and try again", "STALE");
    res.json(await reviewView(updated));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/sections/:id/review/reject   { remark, subSections: [ids] }   (reviewSection)
// The picked subsections reopen for the Field Executive (and Zonal Manager) and go
// through Cluster Head + GIS Head again; the section goes back to FIELD.
export const rejectSection = async (req, res) => {
  try {
    const { section } = req.access;
    const level = levelFor(req, section);
    const remark = String(req.body?.remark || "").trim();
    const picked = [...new Set((Array.isArray(req.body?.subSections) ? req.body.subSections : []).map(String))];
    const errors = {};
    if (!remark) errors.remark = "Write a reason before rejecting.";
    if (!picked.length) errors.subSections = "Pick the subsections that need fixing.";
    if (Object.keys(errors).length) throw badRequest(Object.values(errors).join(" "), errors);
    if (picked.some((id) => !mongoose.isValidObjectId(id))) throw badRequest("Pick subsections of this section", { subSections: "Unknown subsection" });

    const subs = await SubSection.find({ _id: { $in: picked }, section: section._id, typeOfWork: { $exists: true } });
    if (subs.length !== picked.length) throw badRequest("Pick subsections of this section", { subSections: "Unknown subsection" });

    const by = actorOf(req);
    const who = roleLabel(by.role);
    const decision = { status: "REJECTED", by, at: new Date(), remark, client: req.client };
    const updated = await Section.findOneAndUpdate(
      { _id: section._id, "review.stage": level.stage },
      {
        $set: { "review.stage": "FIELD", [`review.${level.key}`]: decision },
        $push: {
          "review.history": historyEntry(req, "rejected", `Sent back by ${who} · ${subs.length} subsection${subs.length === 1 ? "" : "s"} to fix: ${remark}`, remark),
        },
      },
      { new: true }
    );
    if (!updated) throw conflict("This section was reviewed by someone else. Refresh and try again", "STALE");

    // Both reviewers look at the fix again. One write, bumping the version so open job cards refresh.
    await SubSection.updateMany(
      { _id: { $in: subs.map((s) => s._id) } },
      {
        $set: { executionStatus: "REJECTED", approval: decision, updatedBy: by },
        $unset: { review: 1 },
        $push: { history: historyEntry(req, "rejected", `Needs fix (${who}, section review): ${remark}`, remark) },
        $inc: { __v: 1 },
      }
    );
    res.json(await reviewView(updated));
  } catch (error) {
    sendError(res, error);
  }
};
