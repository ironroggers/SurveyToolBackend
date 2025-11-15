import { getSummary } from "../services/summary.service.js";
import Summary, { SummaryLower } from "../models/summaryModel.js";
import mongoose from "mongoose";

const UNCATEGORIZED = "Uncategorized";
const missingSheetQuery = {
  $or: [{ sheetName: { $exists: false } }, { sheetName: null }, { sheetName: "" }],
};

export async function getSummaryController(req, res, next) {
  try {
    const data = await getSummary();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// Summary collection CRUD + helpers
export async function listSheetNames(req, res, next) {
  try {
    const [upper, lower, upperMissing, lowerMissing] = await Promise.all([
      Summary.getSheetNames().catch(() => []),
      SummaryLower.distinct("sheetName").catch(() => []),
      Summary.findOne(missingSheetQuery).select("_id").lean().catch(() => null),
      SummaryLower.findOne(missingSheetQuery).select("_id").lean().catch(() => null),
    ]);
    const namesSet = new Set([...(upper || []), ...(lower || [])].filter(Boolean));
    if (upperMissing || lowerMissing) {
      namesSet.add(UNCATEGORIZED);
    }
    const names = Array.from(namesSet);
    res.json({ success: true, data: names.sort() });
  } catch (err) {
    next(err);
  }
}

export async function getSheetDataController(req, res, next) {
  try {
    const { sheetName } = req.params;
    if (!sheetName) {
      return res.status(400).json({
        success: false,
        error: { message: "sheetName is required" },
      });
    }
    const query =
      sheetName === UNCATEGORIZED ? missingSheetQuery : { sheetName };
    const sort = { rowNumber: 1 };
    const [upperRows, lowerRows] = await Promise.all([
      Summary.find(query).sort(sort).catch(() => []),
      SummaryLower.find(query).sort(sort).catch(() => []),
    ]);
    const rows = [...(upperRows || []), ...(lowerRows || [])];
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function listSummaryDocs(req, res, next) {
  try {
    const { sheetName, limit = 50, page = 1 } = req.query;
    const query =
      sheetName === UNCATEGORIZED
        ? missingSheetQuery
        : sheetName
        ? { sheetName }
        : {};
    const numericLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const numericPage = Math.max(1, Number(page) || 1);

    const [upperItems, lowerItems] = await Promise.all([
      Summary.find(query).sort({ createdAt: -1 }).catch(() => []),
      SummaryLower.find(query).sort({ createdAt: -1 }).catch(() => []),
    ]);
    const combined = [...upperItems, ...lowerItems].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const total = combined.length;
    const start = (numericPage - 1) * numericLimit;
    const items = combined.slice(start, start + numericLimit);

    res.json({
      success: true,
      data: items,
      meta: {
        total,
        page: numericPage,
        limit: numericLimit,
        pages: Math.ceil(total / numericLimit),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createSummaryDoc(req, res, next) {
  try {
    const { sheetName, rowData, rowNumber, others } = req.body || {};
    if (!sheetName || typeof rowData === "undefined") {
      return res.status(400).json({
        success: false,
        error: { message: "sheetName and rowData are required" },
      });
    }
    const doc = await Summary.create({
      sheetName,
      rowData,
      rowNumber,
      others,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function getSummaryDocById(req, res, next) {
  try {
    const { id } = req.params;
    let doc = null;
    if (mongoose.isValidObjectId(id)) {
      doc = await Summary.findById(id);
      if (!doc) {
        doc = await SummaryLower.findById(id);
      }
    }
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { message: "Summary document not found" },
      });
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function updateSummaryDocById(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    let doc = null;
    if (mongoose.isValidObjectId(id)) {
      doc = await Summary.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });
      if (!doc) {
        doc = await SummaryLower.findByIdAndUpdate(id, updates, {
          new: true,
          runValidators: true,
        });
      }
    }
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { message: "Summary document not found" },
      });
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

export async function deleteSummaryDocById(req, res, next) {
  try {
    const { id } = req.params;
    let doc = null;
    if (mongoose.isValidObjectId(id)) {
      doc = await Summary.findByIdAndDelete(id);
      if (!doc) {
        doc = await SummaryLower.findByIdAndDelete(id);
      }
    }
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { message: "Summary document not found" },
      });
    }
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
}
