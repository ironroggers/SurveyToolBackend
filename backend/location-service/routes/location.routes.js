import express from "express";
import {
  createLocation,
  getLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
  findNearbyLocations,
} from "../controllers/location.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { validateLocation } from "../middleware/validation.middleware.js";

const router = express.Router();

// Protect all routes
router.use(protect);

// Routes that all authenticated users can access
router.get("/nearby", findNearbyLocations);
router.get("/:id", getLocationById);
router.get("/", getLocations);

// Routes that only SUPERVISOR and ADMIN can access
router.post("/", authorize('SUPERVISOR', 'ADMIN'), validateLocation, createLocation);
router.put("/:id", authorize('SUPERVISOR', 'ADMIN'), validateLocation, updateLocation);
router.delete("/:id", authorize('ADMIN'), deleteLocation);

export default router;
