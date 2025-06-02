import Survey from '../models/survey.model.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// Create a new survey
export const createSurvey = async (req, res, next) => {
  try {
    const surveyData = {
      ...req.body,
      createdOn: new Date(),
      updatedOn: new Date(),
      createdBy: req.body.createdBy,
      updatedBy: req.body.createdBy
    };
    
    const survey = await Survey.create(surveyData);
    const populatedSurvey = await Survey.findById(survey._id)
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Survey created successfully',
      data: populatedSurvey
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
      limit = 100,
      locationId,
      surveyType,
      status,
      stateName,
      districtName,
      blockName,
      createdBy,
      sortBy = 'createdOn',
      sortOrder = 'desc',
      search,
      ...filters
    } = req.query;

    const query = { status: { $ne: 0 } };
    
    // Primary filters based on new schema
    if (locationId) query.locationId = locationId;
    if (surveyType) query.surveyType = surveyType;
    if (status) query.status = status;
    if (stateName) query.stateName = { $regex: stateName, $options: 'i' };
    if (districtName) query.districtName = { $regex: districtName, $options: 'i' };
    if (blockName) query.blockName = { $regex: blockName, $options: 'i' };
    if (createdBy) query.createdBy = createdBy;

    // Date filters
    if (filters.createdOnFrom) {
      query.createdOn = { ...query.createdOn, $gte: new Date(filters.createdOnFrom) };
    }
    if (filters.createdOnTo) {
      query.createdOn = { ...query.createdOn, $lte: new Date(filters.createdOnTo) };
    }

    // Process additional filters
    Object.keys(filters).forEach(key => {
      if (!['createdOnFrom', 'createdOnTo'].includes(key)) {
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
        } else if (key.includes('_in')) {
          const field = key.split('_in')[0];
          query[field] = { $in: filters[key].split(',') };
        } else {
          query[key] = filters[key];
        }
      }
    });

    // Add text search if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { blockAddress: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const surveys = await Survey.find(query)
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await Survey.countDocuments(query);

    res.status(200).json({
      success: true,
      data: surveys,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page: parseInt(page),
        limit: parseInt(limit)
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
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

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
      updatedOn: new Date(),
      updatedBy: req.body.updatedBy || survey.updatedBy
    };

    const updatedSurvey = await Survey.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Survey updated successfully',
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

    await Survey.findByIdAndUpdate(req.params.id, { 
      status: 0, 
      updatedOn: new Date(),
      updatedBy: req.body.updatedBy || survey.updatedBy
    });

    res.status(200).json({
      success: true,
      message: 'Survey deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get surveys by location
export const getSurveysByLocation = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { surveyType, status, page = 1, limit = 100 } = req.query;

    const query = { locationId, status: { $ne: 0 } };
    if (surveyType) query.surveyType = surveyType;
    if (status) query.status = status;

    const surveys = await Survey.find(query)
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdOn: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await Survey.countDocuments(query);

    res.status(200).json({
      success: true,
      data: surveys,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get surveys by type
export const getSurveysByType = async (req, res, next) => {
  try {
    const { surveyType } = req.params;
    const { locationId, status, page = 1, limit = 100 } = req.query;

    const query = { surveyType, status: { $ne: 0 } };
    if (locationId) query.locationId = locationId;
    if (status) query.status = status;

    const surveys = await Survey.find(query)
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdOn: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await Survey.countDocuments(query);

    res.status(200).json({
      success: true,
      data: surveys,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Add or update media file in survey
export const addMediaFile = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    const { url, fileType, description, latitude, longitude, deviceName, accuracy, place } = req.body;
    
    const mediaFile = {
      url,
      fileType,
      description,
      latitude,
      longitude,
      deviceName,
      accuracy,
      place
    };

    survey.mediaFiles.push(mediaFile);
    survey.updatedOn = new Date();
    
    await survey.save();

    res.status(200).json({
      success: true,
      message: 'Media file added successfully',
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Remove media file from survey
export const removeMediaFile = async (req, res, next) => {
  try {
    const { id, mediaId } = req.params;
    
    const survey = await Survey.findById(id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    survey.mediaFiles.id(mediaId).remove();
    survey.updatedOn = new Date();
    
    await survey.save();

    res.status(200).json({
      success: true,
      message: 'Media file removed successfully',
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Add field to survey
export const addField = async (req, res, next) => {
  try {
    const survey = await Survey.findById(req.params.id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    const { sequence, key, value, fieldType, dropdownOptions, mediaFiles } = req.body;
    
    const field = {
      sequence,
      key,
      value,
      fieldType,
      dropdownOptions,
      mediaFiles: mediaFiles || []
    };

    survey.fields.push(field);
    survey.updatedOn = new Date();
    
    await survey.save();

    res.status(200).json({
      success: true,
      message: 'Field added successfully',
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Update field in survey
export const updateField = async (req, res, next) => {
  try {
    const { id, fieldId } = req.params;
    
    const survey = await Survey.findById(id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    const field = survey.fields.id(fieldId);
    if (!field) {
      throw new NotFoundError('Field not found');
    }

    Object.assign(field, req.body);
    survey.updatedOn = new Date();
    
    await survey.save();

    res.status(200).json({
      success: true,
      message: 'Field updated successfully',
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Remove field from survey
export const removeField = async (req, res, next) => {
  try {
    const { id, fieldId } = req.params;
    
    const survey = await Survey.findById(id);

    if (!survey || survey.status === 0) {
      throw new NotFoundError('Survey not found');
    }

    survey.fields.id(fieldId).remove();
    survey.updatedOn = new Date();
    
    await survey.save();

    res.status(200).json({
      success: true,
      message: 'Field removed successfully',
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Update survey status
export const updateStatus = async (req, res, next) => {
  try {
    const { status, updatedBy } = req.body;
    
    const survey = await Survey.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        updatedOn: new Date(),
        updatedBy: updatedBy
      },
      { new: true, runValidators: true }
    )
      .populate('locationId')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    res.status(200).json({
      success: true,
      message: 'Survey status updated successfully',
      data: survey
    });
  } catch (error) {
    next(error);
  }
};

// Get survey statistics
export const getSurveyStats = async (req, res, next) => {
  try {
    const { locationId, surveyType } = req.query;
    
    const matchStage = { status: { $ne: 0 } };
    if (locationId) matchStage.locationId = locationId;
    if (surveyType) matchStage.surveyType = surveyType;

    const stats = await Survey.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSurveys: { $sum: 1 },
          activeSurveys: { $sum: { $cond: [{ $eq: ['$status', 1] }, 1, 0] } },
          blockSurveys: { $sum: { $cond: [{ $eq: ['$surveyType', 'block'] }, 1, 0] } },
          gpSurveys: { $sum: { $cond: [{ $eq: ['$surveyType', 'gp'] }, 1, 0] } },
          ofcSurveys: { $sum: { $cond: [{ $eq: ['$surveyType', 'ofc'] }, 1, 0] } },
          totalMediaFiles: { $sum: { $size: '$mediaFiles' } },
          totalFields: { $sum: { $size: '$fields' } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalSurveys: 0,
        activeSurveys: 0,
        blockSurveys: 0,
        gpSurveys: 0,
        ofcSurveys: 0,
        totalMediaFiles: 0,
        totalFields: 0
      }
    });
  } catch (error) {
    next(error);
  }
}; 