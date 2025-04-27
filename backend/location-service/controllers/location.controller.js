import Location from "../models/location.model.js";
import User from "../models/user.model.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

// Create a new location
export const createLocation = async (req, res, next) => {
  try {
    const locationData = {
      ...req.body,
      status: req.body.status || 1, // Default to "Released" if not provided
      updated_on: new Date()
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
    const { 
      page = 1, 
      limit = 10, 
      district, 
      block, 
      status, 
      assigned_to, 
      surveyor, 
      supervisor,
      search 
    } = req.query;
    
    const query = {};

    // Basic filters
    if (district) query.district = { $regex: district, $options: 'i' };
    if (block) query.block = { $regex: block, $options: 'i' };
    if (assigned_to) query.assigned_to = assigned_to;
    if (surveyor) query.surveyor = surveyor;
    if (supervisor) query.supervisor = supervisor;
    
    // Handle status filter
    if (status) {
      if (status.includes(',')) {
        const statusArray = status.split(',').map(s => parseInt(s.trim()));
        query.status = { $in: statusArray };
      } else {
        query.status = parseInt(status);
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { district: { $regex: search, $options: 'i' } },
        { block: { $regex: search, $options: 'i' } },
        { 'route.gram_panchayat': { $regex: search, $options: 'i' } },
        { 'route.from_place': { $regex: search, $options: 'i' } },
        { 'route.to_place': { $regex: search, $options: 'i' } },
        { comments: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'assigned_to', select: 'name email' },
        { path: 'surveyor', select: 'name email' },
        { path: 'supervisor', select: 'name email' }
      ]
    };

    const locations = await Location.find(query)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('assigned_to', 'name email')
      .populate('surveyor', 'name email')
      .populate('supervisor', 'name email');

    const count = await Location.countDocuments(query);

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
    const location = await Location.findById(req.params.id)
      .populate('assigned_to', 'name email')
      .populate('surveyor', 'name email')
      .populate('supervisor', 'name email');

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
    const { status, surveyor, assigned_to, supervisor, due_date } = req.body;
    
    if (status === undefined) {
      throw new BadRequestError("Status is required");
    }
    
    const updateData = {
      status: parseInt(status),
      updated_on: new Date()
    };

    // Add additional fields if provided
    if (surveyor) updateData.surveyor = surveyor;
    if (assigned_to) updateData.assigned_to = assigned_to;
    if (supervisor) updateData.supervisor = supervisor;
    if (due_date) updateData.due_date = new Date(due_date);
    
    const location = await Location.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('assigned_to', 'name email')
      .populate('surveyor', 'name email')
      .populate('supervisor', 'name email');

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

// Assign location to a user
export const assignLocation = async (req, res, next) => {
  try {
    const { userId, due_date } = req.body;
    
    if (!userId) {
      throw new BadRequestError("User ID is required");
    }

    if (!due_date) {
      throw new BadRequestError("Due date is required");
    }
    
    const location = await Location.findByIdAndUpdate(
      req.params.id, 
      {
        assigned_to: userId,
        status: 2, // Assigned status
        due_date: new Date(due_date),
        updated_on: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    ).populate('assigned_to', 'name email')
     .populate('surveyor', 'name email')
     .populate('supervisor', 'name email');

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error("Assign Location Error:", error);
    next(error);
  }
};

// Change location status
export const changeLocationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (status === undefined || ![1, 2, 3, 4, 5, 6].includes(parseInt(status))) {
      throw new BadRequestError("Valid status is required (1-6)");
    }
    
    const updateData = {
      status: parseInt(status),
      updated_on: new Date()
    };
    
    // Add additional fields based on status change
    if (parseInt(status) === 3) { // If changing to Active
      updateData.start_date = new Date();
    } else if (parseInt(status) === 4) { // If changing to Accepted
      updateData.end_date = new Date();
      // Calculate time_taken if start_date exists
      const location = await Location.findById(req.params.id);
      if (location && location.start_date) {
        const startTime = new Date(location.start_date).getTime();
        const endTime = new Date().getTime();
        const minutesTaken = Math.ceil((endTime - startTime) / (1000 * 60));
        updateData.time_taken = minutesTaken;
      }
    }
    
    const updatedLocation = await Location.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('assigned_to', 'name email')
     .populate('surveyor', 'name email')
     .populate('supervisor', 'name email');

    if (!updatedLocation) {
      throw new NotFoundError("Location not found");
    }

    res.status(200).json({
      success: true,
      data: updatedLocation,
    });
  } catch (error) {
    console.error("Change Location Status Error:", error);
    next(error);
  }
};

// Get locations by status
export const getLocationsByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    
    if (!status || ![1, 2, 3, 4, 5, 6].includes(parseInt(status))) {
      throw new BadRequestError("Valid status is required (1-6)");
    }
    
    const locations = await Location.find({ status: parseInt(status) })
      .populate('assigned_to', 'name email')
      .populate('surveyor', 'name email')
      .populate('supervisor', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    console.error("Get Locations By Status Error:", error);
    next(error);
  }
};

// Add a route to a location
export const addRouteToLocation = async (req, res, next) => {
  try {
    const { routeData } = req.body;
    
    if (!routeData || !routeData.to_place) {
      throw new BadRequestError("Route data with to_place is required");
    }
    
    const location = await Location.findById(req.params.id);
    
    if (!location) {
      throw new NotFoundError("Location not found");
    }
    
    location.route.push(routeData);
    location.updated_on = new Date();
    
    await location.save();
    
    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error("Add Route To Location Error:", error);
    next(error);
  }
};
