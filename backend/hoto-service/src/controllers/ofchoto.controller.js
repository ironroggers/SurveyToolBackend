import OFCHoto from "../models/ofchoto.model.js";

// Get all OFC HOTOs
export const getAllOFCHotos = async (req, res) => {
  try {
    console.log("getAllOFCHotos");
    
    // If no location is provided, return empty array with pagination
    if (!req.query.location) {
      return res.status(200).json({
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          pageSize: parseInt(req.query.limit) || 10,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query based on filters
    const query = {
      location: req.query.location
    };

    const totalCount = await OFCHoto.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const ofcHotos = await OFCHoto.find(query)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor")
      .populate("blockHoto");

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
    const ofcHoto = await OFCHoto.findById(req.params.id)
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor")
      .populate("blockHoto");
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
    const populatedHoto = await OFCHoto.findById(savedOFCHoto._id)
      .populate([
        { path: "createdBy", select: "username email role" },
        { path: "location", select: "district block status surveyor supervisor" },
        { path: "blockHoto" }
      ]);
    res.status(201).json(populatedHoto);
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
    )
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor")
      .populate("blockHoto");
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