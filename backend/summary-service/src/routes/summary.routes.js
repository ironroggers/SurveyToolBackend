import { Router } from "express";
import {
  getSummaryController,
  listSheetNames,
  getSheetDataController,
  listSummaryDocs,
  createSummaryDoc,
  getSummaryDocById,
  updateSummaryDocById,
  deleteSummaryDocById,
  deleteSummarySheet,
  createSummaryBulk,
} from "../controllers/summary.controller.js";

export const summaryRouter = Router();

// Aggregated summary (computed, not the collection)
summaryRouter.get("/", getSummaryController);

// Summary collection CRUD
summaryRouter.get("/sheets", listSheetNames);
summaryRouter.get("/sheets/:sheetName", getSheetDataController);

summaryRouter.get("/records", listSummaryDocs);
summaryRouter.post("/records", createSummaryDoc);
summaryRouter.post("/records/bulk", createSummaryBulk);
summaryRouter.get("/records/:id", getSummaryDocById);
summaryRouter.put("/records/:id", updateSummaryDocById);
summaryRouter.delete("/records/:id", deleteSummaryDocById);
summaryRouter.delete("/sheets/:sheetName", deleteSummarySheet);
