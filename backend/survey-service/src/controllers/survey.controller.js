import Survey from '../models/survey.model.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// Create a new survey
export const createSurvey = async (req, res, next) => {
  try {
    const survey = await Survey.create(req.body);

    res.status(201).json({
      success: true,
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Get all surveys with filtering, sorting, and pagination
export const getSurveys = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      terrainType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      ...filters
    } = req.query;

    const query = {};
    
    // Build query based on filters
    if (status) query.status = status;
    if (terrainType) query['terrainData.terrainType'] = terrainType;

    // Process advanced filters
    Object.keys(filters).forEach(key => {
      if (key.includes('_gt')) {
        const field = key.split('_gt')[0];
        query[field] = { ...query[field], $gt: filters[key] };
      } else if (key.includes('_gte')) {
        const field = key.split('_gte')[0];
        query[field] = { ...query[field], $gte: filters[key] };
      } else if (key.includes('_lt')) {
        const field = key.split('_lt')[0];
        query[field] = { ...query[field], $lt: filters[key] };
      } else if (key.includes('_lte')) {
        const field = key.split('_lte')[0];
        query[field] = { ...query[field], $lte: filters[key] };
      } else if (key.includes('_ne')) {
        const field = key.split('_ne')[0];
        query[field] = { ...query[field], $ne: filters[key] };
      } else if (key.includes('_in')) {
        const field = key.split('_in')[0];
        query[field] = { $in: filters[key].split(',') };
      } else {
        query[key] = filters[key];
      }
    });

    // Add text search if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const surveys = await Survey.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Survey.countDocuments(query);

    res.status(200).json({
      success: true,
      data: surveys,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page: page,
        limit: limit
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get survey by ID
export const getSurveyById = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    res.status(200).json({
      success: true,
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Update survey
export const updateSurvey = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const updatedSurvey = await Survey.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedSurvey
    });
  } catch (error) {
    next(error);
  }
};

// Delete survey
export const deleteSurvey = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    await survey.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Survey deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add comment to survey
export const addComment = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const comment = {
      text: req.body.text,
      timestamp: new Date()
    };

    survey.comments.push(comment);
    await survey.save();

    res.status(200).json({
      success: true,
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Update survey status
export const updateStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const survey = await Survey.findById(req.params.id);

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    // Validate status transition
    const validTransitions = {
      PENDING: ['IN_PROGRESS'],
      IN_PROGRESS: ['SUBMITTED'],
      SUBMITTED: ['APPROVED', 'REJECTED'],
      REJECTED: ['IN_PROGRESS'],
      APPROVED: []
    };

    if (!validTransitions[survey.status].includes(status)) {
      throw new BadRequestError(`Invalid status transition from ${survey.status} to ${status}`);
    }

    survey.status = status;
    if (status === 'REJECTED' && rejectionReason) {
      survey.rejectionReason = rejectionReason;
    }

    await survey.save();

    res.status(200).json({
      success: true,
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Find nearby surveys
export const findNearbySurveys = async (req, res, next) => {
  try {
    const { longitude, latitude, distance = 5000 } = req.query; // distance in meters

    if (!longitude || !latitude) {
      throw new BadRequestError('Please provide longitude and latitude');
    }

    const surveys = await Survey.findNearby(
      [parseFloat(longitude), parseFloat(latitude)],
      parseFloat(distance)
    );

    res.status(200).json({
      success: true,
      data: surveys
    });
  } catch (error) {
    next(error);
  }
}; 