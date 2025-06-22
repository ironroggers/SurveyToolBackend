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
import { validateLocation, validateLocationUpdate } from "../middleware/validation.middleware.js";
import { body } from "express-validator";
import { validateRequest } from "../utils/validator.js";

const router = express.Router();

// Validation middleware for location status updates
const validateLocationStatusUpdate = [
  body("status")
    .isInt({ min: 1, max: 6 })
    .withMessage("Status must be a number between 1-6 (1: Released, 2: Assigned, 3: Active, 4: Completed, 5: Accepted ,6: Reverted)"),
  
  validateRequest,
];

// Get locations by status
router.get("/status/:status", getLocationsByStatus);

// Get location by ID
router.get("/:id", getLocationById);

// Get all locations with filtering
router.get("/", getLocations);

// Create new location
router.post("/", validateLocation, createLocation);

// Update location
router.put("/:id", validateLocationUpdate, updateLocation);

// Delete location
router.delete("/:id", deleteLocation);

// Assign location to a user
router.post("/:id/assign", assignLocation);

// Change location status
router.post("/:id/status", changeLocationStatus);

// Add route to location
router.post("/:id/route", addRouteToLocation);

export default router;
