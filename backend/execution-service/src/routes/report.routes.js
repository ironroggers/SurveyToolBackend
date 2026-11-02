import { Router } from "express";
import { createReport, deleteReport, downloadReport, getReportCatalog, listReports } from "../controller/report.controller.js";
import { requireAction } from "../services/access.service.js";

// Every route needs a signed-in user (requireAuth in server.js) whose role may manage reports: Admin only
const router = Router();
router.use(requireAction("manageReports"));

router.get("/catalog", getReportCatalog);
router.get("/", listReports);
router.post("/", createReport);
router.get("/:id/download", downloadReport);
router.delete("/:id", deleteReport);

export default router;
