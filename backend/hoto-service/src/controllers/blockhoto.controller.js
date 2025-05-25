import BlockHOTO from "../models/blockhoto.model.js";

// Get all BlockHOTOs
export const getAllBlockHOTOs = async (req, res) => {
  try {
    console.log("getAllBlockHOTOs");
    
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

    const totalCount = await BlockHOTO.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const blockHOTOs = await BlockHOTO.find(query)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor");

    res.status(200).json({
      data: blockHOTOs,
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

export const getBlockHOTOById = async (req, res) => {
  try {
    const blockHOTO = await BlockHOTO.findById(req.params.id)
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor");
    if (!blockHOTO) {
      return res.status(404).json({ message: "BlockHOTO record not found" });
    }
    res.status(200).json(blockHOTO);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createBlockHOTO = async (req, res) => {
  try {
    const newBlockHOTO = new BlockHOTO(req.body);
    const savedBlockHOTO = await newBlockHOTO.save();
    const populatedHOTO = await BlockHOTO.findById(savedBlockHOTO._id)
      .populate([
        { path: "createdBy", select: "username email role" },
        { path: "location", select: "district block status surveyor supervisor" }
      ]);
    res.status(201).json(populatedHOTO);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBlockHOTO = async (req, res) => {
  try {
    const updatedBlockHOTO = await BlockHOTO.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor");
    if (!updatedBlockHOTO) {
      return res.status(404).json({ message: "BlockHOTO record not found" });
    }
    res.status(200).json(updatedBlockHOTO);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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
