import express from "express";
import {
  markAttendance,
  checkOut,
  getMyAttendanceHistory,
  getTodayAttendance,
  submitJustification,
  getAllAttendance,
  processJustification,
  isUserPresentNow,
} from "../controllers/attendance.controller.js";
import {
  checkInValidation,
  justificationValidation,
  processJustificationValidation,
  historyQueryValidation,
  adminQueryValidation,
  todayAttendanceValidation,
  isUserPresentValidation,
} from "../utils/validation.js";

const router = express.Router();

// User routes
router.post("/check-in", checkInValidation, markAttendance);
router.post("/check-out", checkInValidation, checkOut);
router.get("/history", historyQueryValidation, getMyAttendanceHistory);
router.get("/today", todayAttendanceValidation, getTodayAttendance);
router.post("/justify", justificationValidation, submitJustification);
router.get("/is-present", isUserPresentValidation, isUserPresentNow);

// Admin routes
router.get("/all", adminQueryValidation, getAllAttendance);
router.patch(
  "/justification/:attendanceId",
  processJustificationValidation,
  processJustification
);

export default router;
