import { Router } from "express";
import { getExecutionDashboard } from "../controller/executionDashboard.controller.js";

const router = Router();

// Read only. Auth is off for now, as on every execution-service route.
router.get("/", getExecutionDashboard); // viewExecution

export default router;
