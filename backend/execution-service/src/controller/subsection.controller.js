import mongoose from "mongoose";
import SubSection from "../models/subSection.model.js";
import { createExecutionSubsection } from "./subsectionExecution.controller.js";
import { entryStats, jobCard } from "../services/views.service.js";
import Section from "../models/section.model.js";
import { visibleBlockIds } from "../services/access.service.js";
import { syncSectionStage } from "../services/review.service.js";
import { syncPitMerge } from "../services/pitMerge.service.js";

// Fields the execution flow owns; the plain update below can't change them
const EXECUTION_FIELDS = [
  "typeOfWork",
  "seq",
  "name",
  "section",
  "executionStatus",
  "initialCondition",
  "start",
  "end",
  "approval",
  "review",
  "history",
  "createdBy",
  "updatedBy",
  "__v",
];

export const createSubSection = async (req, res) => {
  // Execution subsections (with a type of work) go through the wizard's rules
  if (req.body?.typeOfWork) return createExecutionSubsection(req, res);
  try {
    const doc = await SubSection.create(req.body);
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getSubSections = async (req, res) => {
  try {
    const { page = 1, limit = 20, section, q, typeOfWork, executionStatus } = req.query;
    const filter = {};
    // Only subsections of blocks the user may see (older ones outside block sections stay visible)
    const visible = await visibleBlockIds(req);
    if (visible) {
      const hidden = await Section.find({ blockProfile: { $exists: true, $ne: null, $nin: visible } }).distinct("_id");
      if (hidden.length) filter.section = { $nin: hidden };
    }
    if (section) filter.section = { ...(filter.section || {}), $eq: section };
    if (typeOfWork) filter.typeOfWork = typeOfWork;
    if (executionStatus) filter.executionStatus = executionStatus;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { roadName: { $regex: q, $options: "i" } },
      ];
    }
    if (section && !mongoose.isValidObjectId(section)) {
      return res.status(400).json({ message: "Invalid section id" });
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      SubSection.find(filter).sort({ seq: 1, _id: 1 }).skip(skip).limit(Number(limit)),
      SubSection.countDocuments(filter),
    ]);
    // Done metres and entry count for execution subsections' list rows
    const stats = await entryStats(items.filter((s) => s.typeOfWork).map((s) => s._id));
    res.json({
      items: items.map((s) => (s.typeOfWork ? { ...s.toJSON(), ...(stats.get(String(s._id)) || { doneM: 0, entryCount: 0 }) } : s)),
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubSectionById = async (req, res) => {
  try {
    const doc = await SubSection.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "SubSection not found" });
    // Execution subsections come back as the full job card (entries, history, version)
    res.json(doc.typeOfWork ? await jobCard(doc) : doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSubSection = async (req, res) => {
  try {
    const existing = await SubSection.findById(req.params.id).select("typeOfWork");
    if (!existing) return res.status(404).json({ message: "SubSection not found" });
    const updates = { ...req.body };
    if (existing.typeOfWork) EXECUTION_FIELDS.forEach((key) => delete updates[key]);
    const updated = await SubSection.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSubSection = async (req, res) => {
  try {
    const deleted = await SubSection.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "SubSection not found" });
    // The rest of the section may now all be approved
    if (deleted.typeOfWork) await syncSectionStage(req, deleted.section);
    // Pits merged with this one stay at the merged location
    for (const point of [deleted.start, deleted.end]) {
      if (point?.pit?.merge?.id) await syncPitMerge(req, point.pit.merge.id);
    }
    res.json({ message: "SubSection deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
