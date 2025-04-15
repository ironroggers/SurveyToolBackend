import express from "express";
import {
  createLocation,
  getLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
  findNearbyLocations,
} from "../controllers/location.controller.js";
import { validateLocation } from "../middleware/validation.middleware.js";

const router = express.Router();

router.get("/nearby", findNearbyLocations);
router.get("/:id", getLocationById);
router.get("/", getLocations);
router.post("/", validateLocation, createLocation);
router.put("/:id", validateLocation, updateLocation);
router.delete("/:id", deleteLocation);

export default router;
