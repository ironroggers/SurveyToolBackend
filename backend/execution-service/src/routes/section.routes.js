import { Router } from "express";
import {
  createSection,
  getSections,
  getSectionById,
  updateSection,
  deleteSection,
} from "../controller/section.controller.js";
import {
  getRestoration,
  saveRestorationItem,
  submitRestoration,
  approveRestoration,
  rejectRestoration,
} from "../controller/restoration.controller.js";
import { approveSection, getSectionReview, rejectSection } from "../controller/sectionReview.controller.js";
import { guardSection } from "../services/access.service.js";
import { guardNewSection } from "../controller/section.controller.js";

const router = Router();

// Every route needs a signed-in user (requireAuth in server.js). Block sections check the
// action from src/config/permissions.js on the block's team; `write` also refuses frozen data.
const view = guardSection("viewExecution");
const write = (action) => guardSection(action, { write: true });

router.get("/", getSections);
router.post("/", guardNewSection, createSection);
router.get("/:id", view, getSectionById);
router.put("/:id", write("createSection"), updateSection);
router.delete("/:id", write("createSection"), deleteSection);

// Zonal Manager / Admin review of the section
router.get("/:id/review", view, getSectionReview);
router.post("/:id/review/approve", write("reviewSection"), approveSection);
router.post("/:id/review/reject", write("reviewSection"), rejectSection);

// Section restoration: its own submit / approve flow, outside the section review
router.get("/:id/restoration", view, getRestoration);
router.put("/:id/restoration/items/:subSectionId", write("executeRestoration"), saveRestorationItem);
router.post("/:id/restoration/submit", write("executeRestoration"), submitRestoration);
router.post("/:id/restoration/approve", write("approveRestoration"), approveRestoration);
router.post("/:id/restoration/reject", write("approveRestoration"), rejectRestoration);

export default router;
