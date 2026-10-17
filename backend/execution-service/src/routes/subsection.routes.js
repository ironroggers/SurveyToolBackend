import { Router } from "express";
import {
  createSubSection,
  getSubSections,
  getSubSectionById,
  updateSubSection,
  deleteSubSection,
} from "../controller/subsection.controller.js";
import {
  previewName,
  getStartPitSuggestion,
  startSubsection,
  addEntry,
  updateEntry,
  deleteEntry,
  endSubsection,
  reopenSubsection,
  approveSubsection,
  rejectSubsection,
} from "../controller/subsectionExecution.controller.js";

const router = Router();

// Auth is off for now, as on every execution-service route. The comment on each
// execution route is the action from src/config/permissions.js it should check once auth lands.
router.get("/", getSubSections);
router.post("/", createSubSection); // with typeOfWork: executeSubsection
router.get("/next-name", previewName); // viewExecution
router.get("/:id", getSubSectionById);
router.put("/:id", updateSubSection);
router.delete("/:id", deleteSubSection);

router.get("/:id/start-pit-suggestion", getStartPitSuggestion); // viewExecution
router.post("/:id/start", startSubsection); // executeSubsection
router.post("/:id/entries", addEntry); // executeSubsection
router.put("/:id/entries/:entryId", updateEntry); // executeSubsection
router.delete("/:id/entries/:entryId", deleteEntry); // executeSubsection
router.post("/:id/end", endSubsection); // executeSubsection
router.post("/:id/reopen", reopenSubsection); // executeSubsection
router.post("/:id/approve", approveSubsection); // approveExecution
router.post("/:id/reject", rejectSubsection); // approveExecution

export default router;
