import { Router } from "express";
import { getMasterMapBlock, getMasterMapBlocks } from "../controller/masterMap.controller.js";

const router = Router();

// Read only. Auth is off for now, as on every execution-service route.
router.get("/blocks", getMasterMapBlocks); // viewExecution
router.get("/blocks/:id", getMasterMapBlock); // viewExecution

export default router;
