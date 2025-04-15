import express from "express";
import {
  createSublocation,
  getSublocations,
  getSublocationById,
  updateSublocation,
  deleteSublocation,
  findNearbySublocations,
  getSublocationsByLocation,
} from "../controllers/sublocation.controller.js";
import { validateSublocation } from "../middleware/sublocation.validation.js";

const router = express.Router();

router.get("/nearby", findNearbySublocations);
router.get("/location/:locationId", getSublocationsByLocation);
router.get("/:id", getSublocationById);
router.get("/", getSublocations);
router.post("/", validateSublocation, createSublocation);
router.put("/:id", validateSublocation, updateSublocation);
router.delete("/:id", deleteSublocation);

export default router; 