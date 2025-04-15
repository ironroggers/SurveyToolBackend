import Location from "../models/location.model.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

// Create a new location
export const createLocation = async (req, res, next) => {
  try {
    // Add createdBy field from authenticated user
    const locationData = {
      ...req.body
    };
    
    const location = await Location.create(locationData);
    res.status(201).json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error("Create Location Error:", error);
    next(error);
  }
};

// Get all locations with filtering and pagination
export const getLocations = async (req, res, next) => {
  try {
    console.log("Query params:", req.query);
    const { page = 1, limit = 10, assignedTo, status, search, createdBy } = req.query;
    const query = {};

    // Basic filters
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;
    
    // Handle comma-separated status values
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } }, // Case-insensitive search in title
      ];
    }

    console.log("MongoDB query:", query);

    const locations = await Location.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const count = await Location.countDocuments(query);

    console.log("Found locations:", locations.length);
    console.log("Total count:", count);

    res.status(200).json({
      success: true,
      data: locations,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error("Get Locations Error:", error);
    next(error);
  }
};

// Get location by ID
export const getLocationById = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error("Get Location By ID Error:", error);
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
    console.error("Update Location Error:", error);
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
    console.error("Delete Location Error:", error);
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
    console.error("Find Nearby Locations Error:", error);
    next(error);
  }
};
