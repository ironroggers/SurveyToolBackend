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

const router = Router();

router.get("/", getSections);
router.post("/", createSection);
router.get("/:id", getSectionById);
router.put("/:id", updateSection);
router.delete("/:id", deleteSection);

// Section restoration. Auth is off for now; the comment is the action each route should check once it lands.
router.get("/:id/restoration", getRestoration); // viewExecution
router.put("/:id/restoration/items/:subSectionId", saveRestorationItem); // executeRestoration
router.post("/:id/restoration/submit", submitRestoration); // executeRestoration
router.post("/:id/restoration/approve", approveRestoration); // approveExecution
router.post("/:id/restoration/reject", rejectRestoration); // approveExecution

export default router;


