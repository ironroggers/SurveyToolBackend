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
  getPitSuggestion,
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
import { guardSection, guardSubsection } from "../services/access.service.js";

const router = Router();

// Every route needs a signed-in user (requireAuth in server.js). Execution routes check the
// action from src/config/permissions.js on the block's team; `write` also refuses frozen data.
const view = guardSubsection("viewExecution");
const write = (action) => guardSubsection(action, { write: true });
// Execution subsections are created in a block section; older ones need only a signed-in user
const guardCreate = (req, res, next) =>
  req.body?.typeOfWork ? guardSection("executeSubsection", { write: true, from: "body", key: "section" })(req, res, next) : next();

router.get("/", getSubSections);
router.post("/", guardCreate, createSubSection);
router.get("/next-name", guardSection("viewExecution", { from: "query", key: "section" }), previewName);
router.get("/:id", view, getSubSectionById);
router.put("/:id", write("executeSubsection"), updateSubSection);
router.delete("/:id", write("deleteSubsection"), deleteSubSection);

router.get("/:id/pit-suggestion", view, getPitSuggestion);
router.get("/:id/start-pit-suggestion", view, getStartPitSuggestion); // older apps
router.post("/:id/start", write("executeSubsection"), startSubsection);
router.post("/:id/entries", write("executeSubsection"), addEntry);
router.put("/:id/entries/:entryId", write("executeSubsection"), updateEntry);
router.delete("/:id/entries/:entryId", write("executeSubsection"), deleteEntry);
router.post("/:id/end", write("executeSubsection"), endSubsection);
router.post("/:id/reopen", write("executeSubsection"), reopenSubsection);
// Cluster Head and GIS Head
router.post("/:id/approve", write("reviewSubsection"), approveSubsection);
router.post("/:id/reject", write("reviewSubsection"), rejectSubsection);

export default router;
