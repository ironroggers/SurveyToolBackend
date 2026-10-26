import { Router } from "express";
import { downloadMedia } from "../controller/media.controller.js";
import { requireAction } from "../services/access.service.js";

const router = Router();

// The file with its location stamp burned in, as a download
router.get("/download", requireAction("viewExecution"), downloadMedia);

export default router;
