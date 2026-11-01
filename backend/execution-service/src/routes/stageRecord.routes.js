import { Router } from "express";
import {
  approveRecord,
  deleteRecord,
  getRecord,
  rejectRecord,
  reopenRecord,
  submitRecord,
  updateRecord,
} from "../controller/stageRecord.controller.js";
import { guardStageRecord } from "../services/access.service.js";

const router = Router();

// Mounted at /api/stage-records. Field work and review use the subsection actions: the roles
// are the same. `write` also refuses frozen data.
const view = guardStageRecord("viewExecution");
const write = (action) => guardStageRecord(action, { write: true });

router.get("/:id", view, getRecord);
router.put("/:id", write("executeSubsection"), updateRecord);
// Managers delete any record; the controller lets a Field Executive delete an unreviewed draft
router.delete("/:id", write("executeSubsection"), deleteRecord);
router.post("/:id/submit", write("executeSubsection"), submitRecord);
router.post("/:id/reopen", write("executeSubsection"), reopenRecord);
// Cluster Head and GIS Head
router.post("/:id/approve", write("reviewSubsection"), approveRecord);
router.post("/:id/reject", write("reviewSubsection"), rejectRecord);

export default router;
