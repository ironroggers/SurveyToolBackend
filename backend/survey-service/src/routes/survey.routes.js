import express from "express";
import {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  getSurveysByLocation,
  getSurveysByType,
  addMediaFile,
  removeMediaFile,
  addField,
  updateField,
  removeField,
  updateStatus,
  getSurveyStats,
} from "../controllers/survey.controller.js";
import {
  validateSurvey,
  validateSurveyUpdate,
} from "../middleware/validation.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Authentication middleware for all routes

// Survey routes
router.get("/stats", getSurveyStats);
router.get("/", getSurveys);
router.get("/:id", getSurveyById);
router.post("/", authenticateToken, validateSurvey, createSurvey);
router.put("/:id", authenticateToken, validateSurveyUpdate, updateSurvey);
router.delete("/:id", authenticateToken, deleteSurvey);

// Filter routes
router.get("/location/:locationId", getSurveysByLocation);
router.get("/type/:surveyType", getSurveysByType);

// Media file routes
router.post("/:id/media", authenticateToken, addMediaFile);
router.delete("/:id/media/:mediaId", authenticateToken, removeMediaFile);

// Field routes
router.post("/:id/fields", authenticateToken, addField);
router.put("/:id/fields/:fieldId", authenticateToken, updateField);
router.delete("/:id/fields/:fieldId", authenticateToken, removeField);

// Status update route
router.patch("/:id/status", authenticateToken, updateStatus);

export default router;
