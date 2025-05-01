import Survey from '../models/survey.model.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// Create a new survey
export const createSurvey = async (req, res, next) => {
  try {
    const surveyData = {
      ...req.body,
      created_on: new Date(),
      updated_on: new Date()
    };
    
    const survey = await Survey.create(surveyData);

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
      rowAuthority,
      sortBy = 'created_on',
      sortOrder = 'desc',
      search,
      ...filters
    } = req.query;

    const query = { status: { $ne: 0 } };
    
    // Build query based on filters
    if (status) query.status = status;
    if (terrainType) query['terrainData.type'] = terrainType;
    if (rowAuthority) query.rowAuthority = rowAuthority;

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
      .populate('location')
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
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
      .populate('location')
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email');

    if (!survey || survey.status === 0) {
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

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    const updateData = {
      ...req.body,
      updated_on: new Date()
    };

    const updatedSurvey = await Survey.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('location')
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email');

    res.status(200).json({
      success: true,
      data: updatedSurvey
    });
  } catch (error) {
    next(error);
  }
};

// Soft delete survey (update status to 0)
export const deleteSurvey = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    await Survey.findByIdAndUpdate(req.params.id, { status: 0, updated_on: new Date() });

    res.status(200).json({
      success: true,
      message: 'Survey deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add or update media file
export const addMediaFile = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    const mediaFile = {
      url: req.body.url,
      fileType: req.body.fileType,
      description: req.body.description || '',
      uploaded_at: new Date()
    };

    survey.mediaFiles.push(mediaFile);
    survey.updated_on = new Date();
    await survey.save();

    res.status(200).json({
      success: true,
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Remove media file
export const removeMediaFile = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    const mediaFileId = req.params.mediaId;
    
    survey.mediaFiles = survey.mediaFiles.filter(
      file => file._id.toString() !== mediaFileId
    );
    
    survey.updated_on = new Date();
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
    const { status } = req.body;
    const survey = await Survey.findById(req.params.id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    survey.status = status;
    survey.updated_on = new Date();
    survey.updated_by = req.user.id;

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
    )
      .populate('location')
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email');

    res.status(200).json({
      success: true,
      data: surveys
    });
  } catch (error) {
    next(error);
  }
}; 