import { Router } from "express";
import {
  createSection,
  getSections,
  getSectionById,
  updateSection,
  deleteSection,
} from "../controller/section.controller.js";

const router = Router();

router.get("/", getSections);
router.post("/", createSection);
router.get("/:id", getSectionById);
router.put("/:id", updateSection);
router.delete("/:id", deleteSection);

export default router;


