import Section from "../models/section.model.js";

export const createSection = async (req, res) => {
  try {
    const payload = req.body;
    const section = await Section.create(payload);
    res.status(201).json(section);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getSections = async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const filter = {};
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
    res.json({ items, total, page: Number(page), limit: Number(limit) });
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
    const updates = req.body;
    const updated = await Section.findByIdAndUpdate(id, updates, { new: true });
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


