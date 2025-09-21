import { Router } from "express";
import {
  createSubSection,
  getSubSections,
  getSubSectionById,
  updateSubSection,
  deleteSubSection,
} from "../controller/subsection.controller.js";

const router = Router();

router.get("/", getSubSections);
router.post("/", createSubSection);
router.get("/:id", getSubSectionById);
router.put("/:id", updateSubSection);
router.delete("/:id", deleteSubSection);

export default router;


