import BlockHOTO from "../models/blockhoto.model.js";

// Get all BlockHOTOs
export const getAllBlockHOTOs = async (req, res) => {
  try {
    const blockHOTOs = await BlockHOTO.find();
    res.status(200).json(blockHOTOs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get BlockHOTO by ID
export const getBlockHOTOById = async (req, res) => {
  try {
    const blockHOTO = await BlockHOTO.findById(req.params.id);
    if (!blockHOTO) {
      return res.status(404).json({ message: "BlockHOTO record not found" });
    }
    res.status(200).json(blockHOTO);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new BlockHOTO
export const createBlockHOTO = async (req, res) => {
  try {
    const newBlockHOTO = new BlockHOTO(req.body);
    const savedBlockHOTO = await newBlockHOTO.save();
    res.status(201).json(savedBlockHOTO);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update BlockHOTO
export const updateBlockHOTO = async (req, res) => {
  try {
    const updatedBlockHOTO = await BlockHOTO.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedHOTO) {
      return res.status(404).json({ message: "BlockHOTO record not found" });
    }
    res.status(200).json(updatedBlockHOTO);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete BlockHOTO
export const deleteBlockHOTO = async (req, res) => {
  try {
    const deletedBlockHOTO = await BlockHOTO.findByIdAndDelete(req.params.id);
    if (!deletedBlockHOTO) {
      return res.status(404).json({ message: "BlockHOTO record not found" });
    }
    res.status(200).json({ message: "BlockHOTO record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
