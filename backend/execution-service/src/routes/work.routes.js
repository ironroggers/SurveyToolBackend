import { Router } from "express";
import { getApprovals, getExecutionConfig, getMyWork, getPermissions } from "../controller/work.controller.js";
import { requireAction } from "../services/access.service.js";

// Mounted at /api. Every route needs a signed-in user (requireAuth in server.js).
const router = Router();

router.get("/execution/config", getExecutionConfig);
router.get("/permissions", getPermissions);
router.get("/my-work", requireAction("viewExecution"), getMyWork);
// Each reviewer's own queue; the controller checks which reviews the role does
router.get("/approvals", getApprovals);

export default router;
