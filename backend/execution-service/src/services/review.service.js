import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import StageRecord from "../models/stageRecord.model.js";
import { STAGE_ORDER } from "../config/executionTypes.js";
import { historyEntry } from "./execution.service.js";

// The approval flow above the field work:
//   subsection: Field Executive ends it → Cluster Head and GIS Head each approve or reject.
//               Both approved → APPROVED. A reject sends it back to the Field Executive and
//               keeps the other reviewer's approval, so only the rejector reviews the fix.
//   stage record: the same, from its submit.
//   section:    all 6 stages marked complete, every subsection and every stage record APPROVED →
//               ZONAL (with the Zonal Manager) automatically → the Zonal Manager approves → ADMIN
//               → Admin approves → FROZEN. The Zonal Manager or Admin can reject it back to FIELD,
//               reopening the subsections and stage records they pick; each stage holding a
//               picked item stops being complete.

// Which review slot a reviewer's role fills
export const REVIEW_SLOTS = { "CLUSTER HEAD": "clusterHead", "GIS HEAD": "gisHead" };
export const SLOT_LABELS = { clusterHead: "Cluster Head", gisHead: "GIS Head" };

export const bothApproved = (review) =>
  review?.clusterHead?.status === "APPROVED" && review?.gisHead?.status === "APPROVED";

// FIELD → ZONAL once all 6 stages are complete and every subsection and stage record is
// APPROVED. Call it after whatever could be the last event. Atomic on the stage and on the
// completion marks, so two last events at once move it only once and a stage reopened
// meanwhile holds it back.
export const syncSectionStage = async (req, sectionId) => {
  const [total, approved, records, recordsApproved] = await Promise.all([
    SubSection.countDocuments({ section: sectionId, typeOfWork: { $exists: true } }),
    SubSection.countDocuments({ section: sectionId, typeOfWork: { $exists: true }, executionStatus: "APPROVED" }),
    StageRecord.countDocuments({ section: sectionId }),
    StageRecord.countDocuments({ section: sectionId, status: "APPROVED" }),
  ]);
  if (!total || approved < total || recordsApproved < records) return null;
  const allComplete = Object.fromEntries(STAGE_ORDER.map((stage) => [`stageCompletion.${stage}.at`, { $exists: true }]));
  return Section.findOneAndUpdate(
    { _id: sectionId, blockProfile: { $exists: true }, $or: [{ "review.stage": "FIELD" }, { "review.stage": { $exists: false } }], ...allComplete },
    {
      $set: { "review.stage": "ZONAL" },
      $push: {
        "review.history": historyEntry(req, "forwarded", `All ${STAGE_ORDER.length} stages complete · every subsection and record approved by Cluster Head and GIS Head · sent to Zonal Manager`),
      },
    },
    { new: true }
  );
};
