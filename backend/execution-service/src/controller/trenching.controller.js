import Trenching from "../models/trenching.model.js";
import { assertTrenchingAllowed } from "./subsectionExecution.controller.js";
import { queueStampsFor } from "../services/stampQueue.service.js";

// Entries of execution subsections can only change while they're in progress
const guardFails = async (req, res, subSectionId) => {
  try {
    await assertTrenchingAllowed(req, subSectionId);
    return false;
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message, code: error.code });
    return true;
  }
};

export const createTrenching = async (req, res) => {
  try {
    if (await guardFails(req, res, req.body?.subSection)) return;
    const doc = await Trenching.create(req.body);
    queueStampsFor(doc);
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTrenchings = async (req, res) => {
  try {
    const { page = 1, limit = 20, subSection } = req.query;
    const filter = {};
    if (subSection) filter.subSection = subSection;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Trenching.find(filter).skip(skip).limit(Number(limit)),
      Trenching.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTrenchingById = async (req, res) => {
  try {
    const doc = await Trenching.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Trenching not found" });
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTrenching = async (req, res) => {
  try {
    const current = await Trenching.findById(req.params.id).select("subSection");
    if (current && (await guardFails(req, res, current.subSection))) return;
    const updated = await Trenching.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Trenching not found" });
    queueStampsFor(updated);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteTrenching = async (req, res) => {
  try {
    const current = await Trenching.findById(req.params.id).select("subSection");
    if (current && (await guardFails(req, res, current.subSection))) return;
    const deleted = await Trenching.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Trenching not found" });
    res.json({ message: "Trenching deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


