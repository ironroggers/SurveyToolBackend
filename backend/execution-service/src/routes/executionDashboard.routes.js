import { Router } from "express";
import { getExecutionDashboard } from "../controller/executionDashboard.controller.js";
import { requireAction } from "../services/access.service.js";

const router = Router();

// Read only; the blocks the user may see
router.get("/", requireAction("viewExecution"), getExecutionDashboard);

export default router;
