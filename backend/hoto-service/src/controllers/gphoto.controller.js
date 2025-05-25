import GPhoto from "../models/gphoto.model.js";

// Get all GPhotos
export const getAllGPhotos = async (req, res) => {
  try {
    console.log("getAllGPhotos");
    
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

    const totalCount = await GPhoto.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const gPhotos = await GPhoto.find(query)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor")
      .populate("blockHoto");

    res.status(200).json({
      data: gPhotos,
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

export const getGPhotoById = async (req, res) => {
  try {
    const gPhoto = await GPhoto.findById(req.params.id)
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor")
      .populate("blockHoto");
    if (!gPhoto) {
      return res.status(404).json({ message: "GPhoto record not found" });
    }
    res.status(200).json(gPhoto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createGPhoto = async (req, res) => {
  try {
    const newGPhoto = new GPhoto(req.body);
    const savedGPhoto = await newGPhoto.save();
    const populatedGPhoto = await GPhoto.findById(savedGPhoto._id)
      .populate([
        { path: "createdBy", select: "username email role" },
        { path: "location", select: "district block status surveyor supervisor" },
        { path: "blockHoto" }
      ]);
    res.status(201).json(populatedGPhoto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateGPhoto = async (req, res) => {
  try {
    const updatedGPhoto = await GPhoto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("createdBy", "username email role")
      .populate("location", "district block status surveyor supervisor")
      .populate("blockHoto");
    if (!updatedGPhoto) {
      return res.status(404).json({ message: "GPhoto record not found" });
    }
    res.status(200).json(updatedGPhoto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteGPhoto = async (req, res) => {
  try {
    const deletedGPhoto = await GPhoto.findByIdAndDelete(req.params.id);
    if (!deletedGPhoto) {
      return res.status(404).json({ message: "GPhoto record not found" });
    }
    res.status(200).json({ message: "GPhoto record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 