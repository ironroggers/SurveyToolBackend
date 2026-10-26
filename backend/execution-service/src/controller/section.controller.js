import mongoose from "mongoose";
import Section from "../models/section.model.js";
import BlockProfile, { GEOGRAPHY_FIELDS } from "../models/blockProfile.model.js";
import { findBlockNode, formatLatLong } from "../utils/blockNodes.js";
import { sectionExecutionSummaries } from "../services/progress.service.js";
import { assertBlockAccess, assertWritable, sectionFilter } from "../services/access.service.js";
import { sendError } from "../utils/httpError.js";

// POST /api/sections: a block section needs createSection on its block (older location
// sections only a signed-in user)
export const guardNewSection = async (req, res, next) => {
  try {
    const id = req.body?.blockProfile;
    if (id) {
      const profile = mongoose.isValidObjectId(id) ? await BlockProfile.findById(id) : null;
      if (!profile) return res.status(404).json({ message: "Block profile not found" });
      assertBlockAccess(req, "createSection", profile);
      assertWritable(req, profile);
    }
    next();
  } catch (error) {
    sendError(res, error);
  }
};

// Set by the review flow only (sectionReview.controller.js)
const withoutReview = (payload) => {
  const { review: _review, ...rest } = payload || {};
  return rest;
};

const toNodeRef = ({ type, code, name }) => ({ type, code, name });

// Sections under a block profile take its names and LGD codes, as location sections
// take them from the Location. They run from one of the block's nodes (block router or GP) to
// another, and their end coordinates come from those nodes. The ends are required on
// create; an update without them leaves them as they are.
const withBlockProfile = async (payload, { isCreate }) => {
  if (!payload?.blockProfile) return payload;
  const profile = await BlockProfile.findById(payload.blockProfile);
  if (!profile) throw new Error("Block profile not found");
  const geography = Object.fromEntries(GEOGRAPHY_FIELDS.map((field) => [field, profile[field] ?? ""]));
  const result = { ...payload, ...geography };

  if (isCreate || payload.fromNode || payload.toNode) {
    const from = findBlockNode(profile, payload.fromNode);
    const to = findBlockNode(profile, payload.toNode);
    if (!from) throw new Error("From must be this block's router or one of its GPs");
    if (!to) throw new Error("To must be this block's router or one of its GPs");
    if (from.type === to.type && from.code === to.code) throw new Error("From and To must be different");
    Object.assign(result, {
      fromNode: toNodeRef(from),
      toNode: toNodeRef(to),
      fromLatLong: formatLatLong(from),
      toLatLong: formatLatLong(to),
    });
  }
  return result;
};

// The three parts of a section's length; the total is their sum
const PATH_LENGTHS = ["mainPathLength", "sharingPathLength", "existingIncrementalPathLength"];
const PATH_LABELS = { mainPathLength: "Main path length", sharingPathLength: "Sharing path length", existingIncrementalPathLength: "Existing incremental path length" };

// When a payload sends any of the path lengths, the section length becomes their sum (parts
// not sent keep their saved value). Without them, sectionLength is taken as sent.
const withLengths = (payload, saved = {}) => {
  if (!PATH_LENGTHS.some((key) => key in (payload || {}))) return payload;
  const result = { ...payload };
  let total = 0;
  for (const key of PATH_LENGTHS) {
    const raw = key in result ? result[key] : saved[key];
    if (raw === "" || raw === null || raw === undefined) {
      if (key in result) result[key] = null;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${PATH_LABELS[key]} must be a length in metres, 0 or more`);
    if (key in result) result[key] = value;
    total += value;
  }
  result.sectionLength = Math.round(total * 100) / 100;
  return result;
};

export const createSection = async (req, res) => {
  try {
    const payload = withLengths(await withBlockProfile(withoutReview(req.body), { isCreate: true }));
    if (payload.blockProfile) payload.review = { stage: "FIELD", history: [] };
    const section = await Section.create(payload);
    res.status(201).json(section);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getSections = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, blockProfile, location } = req.query;
    // Only sections of blocks the user may see
    const filter = { ...(await sectionFilter(req)) };
    for (const [key, value] of Object.entries({ blockProfile, location })) {
      if (!value) continue;
      if (!mongoose.isValidObjectId(value)) {
        return res.status(400).json({ message: `Invalid ${key} id` });
      }
      filter[key] = value;
    }
    if (q) {
      const search = {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
          { district: { $regex: q, $options: "i" } },
        ],
      };
      // Both the visibility $or and the search $or apply
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, search];
        delete filter.$or;
      } else Object.assign(filter, search);
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Section.find(filter).skip(skip).limit(Number(limit)),
      Section.countDocuments(filter),
    ]);
    // Block sections also carry subsection counts by execution status and the restoration state
    const blockSections = items.filter((s) => s.blockProfile);
    const summaries = await sectionExecutionSummaries(blockSections.map((s) => s._id));
    res.json({
      items: items.map((s) => {
        const summary = summaries.get(String(s._id));
        return summary ? { ...s.toJSON(), counts: summary.counts, restoration: summary.restoration } : s;
      }),
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await Section.findById(id);
    if (!section) return res.status(404).json({ message: "Section not found" });
    res.json(section);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const needsSaved = PATH_LENGTHS.some((key) => key in (req.body || {}));
    const saved = needsSaved ? await Section.findById(id).select(PATH_LENGTHS.join(" ")).lean() : {};
    // A section stays under the block it was created in (its access was checked on that block)
    const body = withoutReview(req.body);
    if (req.access.section.blockProfile) body.blockProfile = req.access.section.blockProfile;
    else delete body.blockProfile;
    const updates = withLengths(await withBlockProfile(body, { isCreate: false }), saved || {});
    const updated = await Section.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Section not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Section.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Section not found" });
    res.json({ message: "Section deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


