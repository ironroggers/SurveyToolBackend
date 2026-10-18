import { Router } from "express";
import { downloadMedia } from "../controller/media.controller.js";

const router = Router();

// The file with its location stamp burned in, as a download
router.get("/download", downloadMedia); // viewExecution

export default router;
