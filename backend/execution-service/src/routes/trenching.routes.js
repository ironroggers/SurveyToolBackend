import { Router } from "express";
import {
  createTrenching,
  getTrenchings,
  getTrenchingById,
  updateTrenching,
  deleteTrenching,
} from "../controller/trenching.controller.js";

const router = Router();

router.get("/", getTrenchings);
router.post("/", createTrenching);
router.get("/:id", getTrenchingById);
router.put("/:id", updateTrenching);
router.delete("/:id", deleteTrenching);

export default router;


