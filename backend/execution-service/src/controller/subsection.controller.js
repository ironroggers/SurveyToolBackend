import SubSection from "../models/subSection.model.js";

export const createSubSection = async (req, res) => {
  try {
    const doc = await SubSection.create(req.body);
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getSubSections = async (req, res) => {
  try {
    const { page = 1, limit = 20, section, q } = req.query;
    const filter = {};
    if (section) filter.section = section;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { roadName: { $regex: q, $options: "i" } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      SubSection.find(filter).skip(skip).limit(Number(limit)),
      SubSection.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubSectionById = async (req, res) => {
  try {
    const doc = await SubSection.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "SubSection not found" });
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSubSection = async (req, res) => {
  try {
    const updated = await SubSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "SubSection not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSubSection = async (req, res) => {
  try {
    const deleted = await SubSection.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "SubSection not found" });
    res.json({ message: "SubSection deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


