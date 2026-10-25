import mongoose from "mongoose";
import Section from "../models/section.model.js";
import BlockProfile from "../models/blockProfile.model.js";
import Trenching from "../models/trenching.model.js";
import { executionLimits, isDucting } from "../config/executionTypes.js";
import { entryView } from "./execution.service.js";
import { sectionExecutionSummaries } from "./progress.service.js";

// Read models shared by the job card, approvals and My work

const toIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

// Per subsection: { doneM, entryCount }
export const entryStats = async (subIds) => {
  const stats = new Map();
  if (!subIds.length) return stats;
  const rows = await Trenching.aggregate([
    { $match: { subSection: { $in: toIds(subIds) } } },
    { $group: { _id: "$subSection", doneM: { $sum: "$trenchLength" }, entryCount: { $sum: 1 } } },
  ]);
  for (const row of rows) stats.set(String(row._id), { doneM: row.doneM || 0, entryCount: row.entryCount });
  return stats;
};

// Per section: { section: { _id, name, fromNode, toNode }, block: { _id, name, district, blockCode } }
export const sectionContexts = async (sectionIds) => {
  const contexts = new Map();
  if (!sectionIds.length) return contexts;
  const sections = await Section.find({ _id: { $in: toIds(sectionIds) } })
    .select("name blockProfile block district fromNode toNode")
    .lean();
  const profiles = await BlockProfile.find({ _id: { $in: sections.map((s) => s.blockProfile).filter(Boolean) } })
    .select("block district blockCode")
    .lean();
  const byId = new Map(profiles.map((p) => [String(p._id), p]));
  for (const s of sections) {
    const profile = byId.get(String(s.blockProfile));
    contexts.set(String(s._id), {
      section: { _id: s._id, name: s.name, fromNode: s.fromNode, toNode: s.toNode },
      block: profile
        ? { _id: profile._id, name: profile.block, district: profile.district, blockCode: profile.blockCode }
        : { name: s.block, district: s.district },
    });
  }
  return contexts;
};

const mediaOf = (holder) => (holder ? [...(holder.photos || []), holder.video].filter(Boolean) : []);

// What the approver should look at twice
export const subsectionFlags = (sub, entries = [], doneM = 0) => {
  const { tapeMismatch, planDeviationPct } = executionLimits();
  const media = [
    ...mediaOf(sub.initialCondition),
    ...mediaOf(sub.start),
    ...mediaOf(sub.end),
    ...entries.map((e) => e.mediaFiles?.[0] || e.photo).filter(Boolean),
  ];
  const fixes = [sub.start, sub.end, sub.start?.pit, sub.end?.pit, ...entries].filter(Boolean);
  const refs = [...(sub.start?.pit?.refs || []), ...(sub.end?.pit?.refs || [])];
  return {
    mediaAboveLimit: media.filter((m) => m.accuracyAboveLimit).length,
    gpsAboveLimit: fixes.filter((f) => f.accuracyAboveLimit).length,
    uploaded: media.filter((m) => m.source === "UPLOAD").length,
    locationTyped: media.filter((m) => m.locationSource === "MANUAL").length,
    tapeMismatch: refs.filter(
      (r) =>
        r.gpsDistanceM != null &&
        r.tapeDistanceM != null &&
        Math.abs(r.tapeDistanceM - r.gpsDistanceM) > Math.max(tapeMismatch.minM, r.gpsDistanceM * tapeMismatch.pct)
    ).length,
    // Only meaningful once the work has ended
    planDeviation:
      Boolean(sub.end) &&
      isDucting(sub.typeOfWork) &&
      sub.subSectionLength > 0 &&
      Math.abs(doneM - sub.subSectionLength) > (sub.subSectionLength * planDeviationPct) / 100,
  };
};

// Card summary used by lists, approvals and My work
export const subsectionSummary = (sub, stats, context) => ({
  _id: sub._id,
  name: sub.name,
  typeOfWork: sub.typeOfWork,
  executionStatus: sub.executionStatus,
  roadName: sub.roadName,
  subSectionLength: sub.subSectionLength,
  calculatedLength: sub.calculatedLength ?? null,
  section: context?.section || { _id: sub.section },
  block: context?.block,
  doneM: stats?.doneM || 0,
  entryCount: stats?.entryCount || 0,
  remark: sub.executionStatus === "REJECTED" ? sub.approval?.remark : undefined,
  submittedAt: sub.executionStatus === "PENDING_APPROVAL" ? sub.end?.at : undefined,
  updatedAt: sub.updatedAt,
});

// Full job card: the subsection, its entries, totals and where it sits
export const jobCard = async (sub) => {
  const entries = await Trenching.find({ subSection: sub._id }).sort({ capturedAt: 1, _id: 1 });
  const views = entries.map(entryView);
  const doneM = views.reduce((sum, e) => sum + (Number(e.length) || 0), 0);
  const [contexts, summaries] = await Promise.all([sectionContexts([sub.section]), sectionExecutionSummaries([sub.section])]);
  return {
    ...sub.toJSON(),
    entries: views,
    doneM,
    entryCount: views.length,
    flags: subsectionFlags(sub, entries, doneM),
    // `section` keeps the plain id older screens expect; this has the details
    sectionInfo: contexts.get(String(sub.section)),
    restoration: summaries.get(String(sub.section))?.restoration,
  };
};
