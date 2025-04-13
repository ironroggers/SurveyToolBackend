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
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  validateSurvey,
  validateComment,
  validateStatusUpdate,
} from "../middleware/validation.middleware.js";

const router = express.Router();

// Protect all routes
router.use(protect);

// Public routes (for authenticated users)
router.get("/nearby", findNearbySurveys);

// Routes for all authenticated users
router.get("/", getSurveys);
router.get("/:id", getSurveyById);

// Routes for SURVEYOR and above
router.post(
  "/:id/comments",
  authorize("SURVEYOR", "SUPERVISOR", "ADMIN"),
  validateComment,
  addComment
);

// Routes for SUPERVISOR and ADMIN
router.post(
  "/",
  authorize("SUPERVISOR", "ADMIN"),
  validateSurvey,
  createSurvey
);
router.put(
  "/:id",
  authorize("SUPERVISOR", "ADMIN"),
  validateSurvey,
  updateSurvey
);
router.patch(
  "/:id/status",
  authorize("SUPERVISOR", "ADMIN"),
  validateStatusUpdate,
  updateStatus
);

// Routes for ADMIN only
router.delete("/:id", authorize("ADMIN"), deleteSurvey);

export default router;
