import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import { historyEntry } from "./execution.service.js";

// The approval flow above the field work:
//   subsection: Field Executive ends it → Cluster Head and GIS Head each approve or reject.
//               Both approved → APPROVED. A reject sends it back to the Field Executive and
//               keeps the other reviewer's approval, so only the rejector reviews the fix.
//   section:    every subsection APPROVED → ZONAL (with the Zonal Manager) automatically →
//               the Zonal Manager approves → ADMIN → Admin approves → FROZEN. The Zonal Manager
//               or Admin can reject it back to FIELD, reopening the subsections they pick.

// Which review slot a reviewer's role fills
export const REVIEW_SLOTS = { "CLUSTER HEAD": "clusterHead", "GIS HEAD": "gisHead" };
export const SLOT_LABELS = { clusterHead: "Cluster Head", gisHead: "GIS Head" };

export const bothApproved = (review) =>
  review?.clusterHead?.status === "APPROVED" && review?.gisHead?.status === "APPROVED";

// FIELD → ZONAL once the section has execution subsections and every one is APPROVED.
// Atomic on the stage, so two last approvals at once move it only once.
export const syncSectionStage = async (req, sectionId) => {
  const [total, approved] = await Promise.all([
    SubSection.countDocuments({ section: sectionId, typeOfWork: { $exists: true } }),
    SubSection.countDocuments({ section: sectionId, typeOfWork: { $exists: true }, executionStatus: "APPROVED" }),
  ]);
  if (!total || approved < total) return null;
  return Section.findOneAndUpdate(
    { _id: sectionId, blockProfile: { $exists: true }, $or: [{ "review.stage": "FIELD" }, { "review.stage": { $exists: false } }] },
    {
      $set: { "review.stage": "ZONAL" },
      $push: {
        "review.history": historyEntry(req, "forwarded", `All ${total} subsection${total === 1 ? "" : "s"} approved by Cluster Head and GIS Head · sent to Zonal Manager`),
      },
    },
    { new: true }
  );
};
