import OFCHoto from "../models/ofchoto.model.js";

// Get all OFC HOTOs
export const getAllOFCHotos = async (req, res) => {
  try {
    console.log("getAllOFCHotos");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalCount = await OFCHoto.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);

    const ofcHotos = await OFCHoto.find()
      .skip(skip)
      .limit(limit)
      // .populate("createdBy", "username email")
      // .populate("location", "name");

    res.status(200).json({
      data: ofcHotos,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        pageSize: limit,
        totalCount: totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getOFCHotoById = async (req, res) => {
  try {
    const ofcHoto = await OFCHoto.findById(req.params.id);
    if (!ofcHoto) {
      return res.status(404).json({ message: "OFC HOTO record not found" });
    }
    res.status(200).json(ofcHoto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createOFCHoto = async (req, res) => {
  try {
    const newOFCHoto = new OFCHoto(req.body);
    const savedOFCHoto = await newOFCHoto.save();
    res.status(201).json(savedOFCHoto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateOFCHoto = async (req, res) => {
  try {
    const updatedOFCHoto = await OFCHoto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedOFCHoto) {
      return res.status(404).json({ message: "OFC HOTO record not found" });
    }
    res.status(200).json(updatedOFCHoto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteOFCHoto = async (req, res) => {
  try {
    const deletedOFCHoto = await OFCHoto.findByIdAndDelete(req.params.id);
    if (!deletedOFCHoto) {
      return res.status(404).json({ message: "OFC HOTO record not found" });
    }
    res.status(200).json({ message: "OFC HOTO record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 