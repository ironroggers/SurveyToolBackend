import HOTO from '../models/hoto.model.js';

// Get all HOTOs
export const getAllHOTOs = async (req, res) => {
  try {
    const hotos = await HOTO.find();
    res.status(200).json(hotos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get HOTO by ID
export const getHOTOById = async (req, res) => {
  try {
    const hoto = await HOTO.findById(req.params.id);
    if (!hoto) {
      return res.status(404).json({ message: 'HOTO record not found' });
    }
    res.status(200).json(hoto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new HOTO
export const createHOTO = async (req, res) => {
  try {
    const newHOTO = new HOTO(req.body);
    const savedHOTO = await newHOTO.save();
    res.status(201).json(savedHOTO);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update HOTO
export const updateHOTO = async (req, res) => {
  try {
    const updatedHOTO = await HOTO.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedHOTO) {
      return res.status(404).json({ message: 'HOTO record not found' });
    }
    res.status(200).json(updatedHOTO);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete HOTO
export const deleteHOTO = async (req, res) => {
  try {
    const deletedHOTO = await HOTO.findByIdAndDelete(req.params.id);
    if (!deletedHOTO) {
      return res.status(404).json({ message: 'HOTO record not found' });
    }
    res.status(200).json({ message: 'HOTO record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 