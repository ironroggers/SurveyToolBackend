import express from "express";
import {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  addComment,
  updateStatus,
  findNearbySurveys,
} from "../controllers/survey.controller.js";
import {
  validateSurvey,
  validateComment,
  validateStatusUpdate,
} from "../middleware/validation.middleware.js";

const router = express.Router();

// Survey routes
router.get("/nearby", findNearbySurveys);
router.get("/", getSurveys);
router.get("/:id", getSurveyById);
router.post("/:id/comments", validateComment, addComment);
router.post("/", validateSurvey, createSurvey);
router.put("/:id", validateSurvey, updateSurvey);
router.patch("/:id/status", validateStatusUpdate, updateStatus);
router.delete("/:id", deleteSurvey);

export default router;
