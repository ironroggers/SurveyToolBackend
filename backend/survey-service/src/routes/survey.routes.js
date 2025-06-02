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

const router = express.Router();

// Authentication middleware for all routes

// Survey routes
router.get("/stats", getSurveyStats);
router.get("/", getSurveys);
router.get("/:id", getSurveyById);
router.post("/", validateSurvey, createSurvey);
router.put("/:id", validateSurveyUpdate, updateSurvey);
router.delete("/:id", deleteSurvey);

// Filter routes
router.get("/location/:locationId", getSurveysByLocation);
router.get("/type/:surveyType", getSurveysByType);

// Media file routes
router.post("/:id/media", addMediaFile);
router.delete("/:id/media/:mediaId", removeMediaFile);

// Field routes
router.post("/:id/fields", addField);
router.put("/:id/fields/:fieldId", updateField);
router.delete("/:id/fields/:fieldId", removeField);

// Status update route
router.patch("/:id/status", updateStatus);

export default router;
