import express from "express";
import {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  addMediaFile,
  removeMediaFile,
  updateStatus,
  findNearbySurveys,
} from "../controllers/survey.controller.js";
import {
  validateSurvey,
  validateMediaFile,
  validateStatusUpdate,
} from "../middleware/validation.middleware.js";

const router = express.Router();

// Authentication middleware for all routes

// Survey routes
router.get("/nearby", findNearbySurveys);
router.get("/", getSurveys);
router.get("/:id", getSurveyById);
router.post("/:id/media", validateMediaFile, addMediaFile);
router.delete("/:id/media/:mediaId", removeMediaFile);
router.post("/", validateSurvey, createSurvey);
router.put("/:id", validateSurvey, updateSurvey);
router.patch("/:id/status", validateStatusUpdate, updateStatus);
router.delete("/:id", deleteSurvey);

export default router;
