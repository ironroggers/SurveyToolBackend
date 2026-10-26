import { Router } from "express";
import { getMasterMapBlock, getMasterMapBlocks } from "../controller/masterMap.controller.js";
import { guardBlock, requireAction } from "../services/access.service.js";

const router = Router();

// Read only; the blocks the user may see
router.get("/blocks", requireAction("viewExecution"), getMasterMapBlocks);
router.get("/blocks/:id", guardBlock("viewExecution"), getMasterMapBlock);

export default router;
