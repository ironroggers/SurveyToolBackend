import mongoose from "mongoose";
import BlockProfile from "../models/blockProfile.model.js";
import Report, { REPORT_LEVELS } from "../models/report.model.js";
import { notFound, sendError } from "../utils/httpError.js";
import { deleteS3Object, getObjectStream } from "../utils/s3.js";
import { generateReport, resolveTarget, XLSX_TYPE } from "../services/report.service.js";
import { reportCatalog } from "../services/reportSheets.js";

// Excel reports, Admin only (manageReports in config/permissions.js; checked by the routes)

const loadProfile = async (id) => {
  const profile = await BlockProfile.findById(id).lean();
  if (!profile) throw notFound("Block profile not found");
  return profile;
};

const loadReport = async (id) => {
  const report = mongoose.isValidObjectId(id) ? await Report.findById(id) : null;
  if (!report) throw notFound("Report not found");
  return report;
};

// GET /api/reports/catalog — the sheets and columns offered per level
export const getReportCatalog = (req, res) => res.json({ levels: reportCatalog() });

// GET /api/reports?level=&blockProfile=&page=&limit= — newest first
export const listReports = async (req, res) => {
  try {
    const { level, blockProfile } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (REPORT_LEVELS.includes(level)) filter.level = level;
    if (mongoose.isValidObjectId(blockProfile)) filter.blockProfile = blockProfile;
    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Report.countDocuments(filter),
    ]);
    res.json({ reports, total, page, limit });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/reports  { level, blockProfile, section?, subSection?, sheets: [{ key, columns: [key] }] }
export const createReport = async (req, res) => {
  try {
    const target = await resolveTarget(req.body || {}, loadProfile);
    const report = await generateReport(target, req.body?.sheets, req.actor);
    res.status(201).json(report);
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/reports/:id/download — the stored workbook as an attachment
export const downloadReport = async (req, res) => {
  try {
    const report = await loadReport(req.params.id);
    let object;
    try {
      object = await getObjectStream(report.s3Key);
    } catch (error) {
      if (error.name === "NoSuchKey") throw notFound("The stored file is missing. Generate the report again");
      throw error;
    }
    res.setHeader("Content-Type", XLSX_TYPE);
    if (object.ContentLength) res.setHeader("Content-Length", String(object.ContentLength));
    res.setHeader("Content-Disposition", `attachment; filename="${report.fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    object.Body.on("error", () => res.destroy());
    object.Body.pipe(res);
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/reports/:id — the record and its file
export const deleteReport = async (req, res) => {
  try {
    const report = await loadReport(req.params.id);
    await deleteS3Object(report.s3Key);
    await report.deleteOne();
    res.json({ deleted: true });
  } catch (error) {
    sendError(res, error);
  }
};
