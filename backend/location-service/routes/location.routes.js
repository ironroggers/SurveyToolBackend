import express from "express";
import {
  createLocation,
  getLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
  assignLocation,
  changeLocationStatus,
  getLocationsByStatus,
  addRouteToLocation
} from "../controllers/location.controller.js";
import { validateLocation } from "../middleware/validation.middleware.js";

const router = express.Router();

// Get locations by status
router.get("/status/:status", getLocationsByStatus);

// Get location by ID
router.get("/:id", getLocationById);

// Get all locations with filtering
router.get("/", getLocations);

// Create new location
router.post("/", validateLocation, createLocation);

// Update location
router.put("/:id", validateLocation, updateLocation);

// Delete location
router.delete("/:id", deleteLocation);

// Assign location to a user
router.post("/:id/assign", assignLocation);

// Change location status
router.post("/:id/status", changeLocationStatus);

// Add route to location
router.post("/:id/route", addRouteToLocation);

export default router;
