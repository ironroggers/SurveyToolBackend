import Survey from '../models/survey.model.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';

// Create a new survey
export const createSurvey = async (req, res, next) => {
  try {
    const survey = await Survey.create({
      ...req.body,
      assignedBy: req.user.id
    });

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
      assignedTo,
      assignedBy,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Build query based on filters
    if (status) query.status = status;
    if (terrainType) query['terrainData.terrainType'] = terrainType;
    if (assignedTo) query.assignedTo = assignedTo;
    if (assignedBy) query.assignedBy = assignedBy;

    // Handle role-based access
    if (req.user.role === 'SURVEYOR') {
      query.assignedTo = req.user.id;
    } else if (req.user.role === 'SUPERVISOR') {
      query.assignedBy = req.user.id;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const surveys = await Survey.find(query)
      .populate('assignedTo', 'username email')
      .populate('assignedBy', 'username email')
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
    const survey = await Survey.findById(req.params.id)
      .populate('assignedTo', 'username email')
      .populate('assignedBy', 'username email')
      .populate('comments.user', 'username email');

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

    // Check if survey is editable
    if (!survey.isEditable()) {
      throw new ForbiddenError('Survey cannot be edited in its current status');
    }

    // Check permission based on role
    if (req.user.role === 'SURVEYOR' && survey.assignedTo.toString() !== req.user.id) {
      throw new ForbiddenError('You can only update surveys assigned to you');
    }

    if (req.user.role === 'SUPERVISOR' && survey.assignedBy.toString() !== req.user.id) {
      throw new ForbiddenError('You can only update surveys you assigned');
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

    // Only ADMIN can delete surveys
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can delete surveys');
    }

    await survey.remove();

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
      user: req.user.id,
      text: req.body.text
    };

    survey.comments.push(comment);
    await survey.save();

    const updatedSurvey = await Survey.findById(req.params.id)
      .populate('comments.user', 'username email');

    res.status(200).json({
      success: true,
      data: updatedSurvey
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

    // Check permissions
    if (req.user.role === 'SURVEYOR') {
      if (!['IN_PROGRESS', 'SUBMITTED'].includes(status)) {
        throw new ForbiddenError('Surveyors can only update status to IN_PROGRESS or SUBMITTED');
      }
    }

    if (req.user.role === 'SUPERVISOR') {
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new ForbiddenError('Supervisors can only approve or reject surveys');
      }
    }

    survey.status = status;
    if (status === 'REJECTED') {
      if (!rejectionReason) {
        throw new BadRequestError('Rejection reason is required');
      }
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