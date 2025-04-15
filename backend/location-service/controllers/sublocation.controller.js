import Sublocation from "../models/sublocation.model.js";
import { AppError } from "../utils/error.js";

// Create a new sublocation
export const createSublocation = async (req, res, next) => {
  try {
    const { title, surveyId, centerPoint, location, createdBy, status } = req.body;
    console.log("req body:", req.body);
    
    const sublocation = await Sublocation.create({
      title,
      surveyId,
      centerPoint,
      location,
      createdBy,
      status
    });

    res.status(201).json({
      status: "success",
      data: sublocation,
    });
  } catch (error) {
    next(error);
  }
};

// Get all sublocations with filtering and pagination
export const getSublocations = async (req, res, next) => {
  try {
    const { status, location } = req.query;
    const query = {};

    if (status) query.status = status;
    if (location) query.location = location;

    const sublocations = await Sublocation.find(query);

    res.status(200).json({
      status: "success",
      results: sublocations.length,
      data: sublocations,
    });
  } catch (error) {
    next(error);
  }
};

// Get sublocation by ID
export const getSublocationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sublocation = await Sublocation.findById(id);
    if (!sublocation) {
      return next(new AppError("Sublocation not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: sublocation,
    });
  } catch (error) {
    next(error);
  }
};

// Update sublocation
export const updateSublocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const sublocation = await Sublocation.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!sublocation) {
      return next(new AppError("Sublocation not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: sublocation,
    });
  } catch (error) {
    next(error);
  }
};

// Delete sublocation
export const deleteSublocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sublocation = await Sublocation.findByIdAndDelete(id);
    if (!sublocation) {
      return next(new AppError("Sublocation not found", 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Find sublocations within radius
export const findNearbySublocations = async (req, res, next) => {
  try {
    const { longitude, latitude, radiusInMeters = 1000 } = req.query;

    if (!longitude || !latitude) {
      return next(new AppError("Please provide longitude and latitude", 400));
    }

    const sublocations = await Sublocation.find({
      centerPoint: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(radiusInMeters),
        },
      },
    }).populate("location", "title");

    res.status(200).json({
      status: "success",
      data: sublocations,
    });
  } catch (error) {
    next(error);
  }
};

// Get sublocations by location ID
export const getSublocationsByLocation = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const sublocations = await Sublocation.find({ location: locationId })
      .populate("surveyId", "title status")
      .populate("createdBy", "username email");

    res.status(200).json({
      status: "success",
      data: sublocations,
    });
  } catch (error) {
    next(error);
  }
}; 