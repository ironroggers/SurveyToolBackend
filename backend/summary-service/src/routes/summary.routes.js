import { Router } from "express";
import { getSummaryController } from "../controllers/summary.controller.js";

export const summaryRouter = Router();

summaryRouter.get("/", getSummaryController);
