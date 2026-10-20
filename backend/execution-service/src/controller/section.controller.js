import mongoose from "mongoose";
import Section from "../models/section.model.js";
import BlockProfile, { GEOGRAPHY_FIELDS } from "../models/blockProfile.model.js";
import { findBlockNode, formatLatLong } from "../utils/blockNodes.js";
import { sectionExecutionSummaries } from "../services/progress.service.js";

const toNodeRef = ({ type, code, name }) => ({ type, code, name });

// Sections under a block profile take its names and LGD codes, as location sections
// take them from the Location. They run from one of the block's nodes (BHQ or GP) to
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
    if (!from) throw new Error("From must be this block's BHQ or one of its GPs");
    if (!to) throw new Error("To must be this block's BHQ or one of its GPs");
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

export const createSection = async (req, res) => {
  try {
    const payload = await withBlockProfile(req.body, { isCreate: true });
    const section = await Section.create(payload);
    res.status(201).json(section);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getSections = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, blockProfile, location } = req.query;
    const filter = {};
    for (const [key, value] of Object.entries({ blockProfile, location })) {
      if (!value) continue;
      if (!mongoose.isValidObjectId(value)) {
        return res.status(400).json({ message: `Invalid ${key} id` });
      }
      filter[key] = value;
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { district: { $regex: q, $options: "i" } },
      ];
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
    res.status(500).json({ message: error.message });
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
    const updates = await withBlockProfile(req.body, { isCreate: false });
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


