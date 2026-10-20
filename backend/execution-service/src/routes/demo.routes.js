import { Router } from "express";
import { getDemoBlock, resetDemo } from "../controller/demo.controller.js";

const router = Router();

// ADMIN only (checked in the controller from X-User-Role, like the rest until auth lands)
router.get("/block", getDemoBlock);
router.post("/block/reset", resetDemo);

export default router;
