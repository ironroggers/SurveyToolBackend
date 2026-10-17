import { Router } from "express";
import { getApprovals, getExecutionConfig, getMyWork, getPermissions } from "../controller/work.controller.js";

// Mounted at /api. Auth is off for now; the comment is the action each route should check once it lands.
const router = Router();

router.get("/execution/config", getExecutionConfig); // any signed-in user
router.get("/permissions", getPermissions); // any signed-in user
router.get("/my-work", getMyWork); // viewExecution
router.get("/approvals", getApprovals); // approveExecution

export default router;
