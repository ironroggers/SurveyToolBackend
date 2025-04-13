import Location from "../models/location.model.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

// Create a new location
export const createLocation = async (req, res, next) => {
  try {
    const location = await Location.create(req.body);
    res.status(201).json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

// Get all locations with filtering and pagination
export const getLocations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, surveyId, assignedTo, status } = req.query;
    const query = {};

    if (surveyId) query.surveyId = surveyId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;

    const locations = await Location.find(query)
      .populate("assignedTo", "username email")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Location.countDocuments(query);

    res.status(200).json({
      success: true,
      data: locations,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    next(error);
  }
};

// Get location by ID
export const getLocationById = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id).populate(
      "assignedTo",
      "username email"
    );

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

// Update location
export const updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

// Delete location
export const deleteLocation = async (req, res, next) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    res.status(200).json({
      success: true,
      message: "Location deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Find locations within radius
export const findNearbyLocations = async (req, res, next) => {
  try {
    const { longitude, latitude, radiusInMeters = 1000 } = req.query;

    if (!longitude || !latitude) {
      throw new BadRequestError("Please provide longitude and latitude");
    }

    const locations = await Location.find({
      centerPoint: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(radiusInMeters),
        },
      },
    });

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    next(error);
  }
};
