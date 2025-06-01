import Hoto from '../models/Hoto.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Get all hotos with filtering
// @route   GET /api/hotos
// @access  Public
export const getHotos = asyncHandler(async (req, res) => {
  let query = {};

  // Build query based on filters
  if (req.query._id) {
    query._id = req.query._id;
  }

  if (req.query.locationId) {
    query.locationId = req.query.locationId;
  }

  if (req.query.hotoType) {
    query.hotoType = req.query.hotoType;
  }

  if (req.query.districtCode) {
    query.districtCode = req.query.districtCode;
  }

  if (req.query.blockCode) {
    query.blockCode = req.query.blockCode;
  }

  if (req.query.gpCode) {
    query.gpCode = req.query.gpCode;
  }

  if (req.query.ofcCode) {
    query.ofcCode = req.query.ofcCode;
  }

  if (req.query.state) {
    query.state = req.query.state;
  }

  if (req.query.status) {
    query.status = parseInt(req.query.status, 10);
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  // Execute query
  const total = await Hoto.countDocuments(query);
  const hotos = await Hoto.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: hotos.length,
    total,
    pagination,
    data: hotos
  });
});

// @desc    Get single hoto
// @route   GET /api/hotos/:id
// @access  Public
export const getHoto = asyncHandler(async (req, res) => {
  const hoto = await Hoto.findById(req.params.id);

  if (!hoto) {
    return res.status(404).json({
      success: false,
      error: 'Hoto not found'
    });
  }

  res.status(200).json({
    success: true,
    data: hoto
  });
});

// @desc    Create new hoto
// @route   POST /api/hotos
// @access  Public
export const createHoto = asyncHandler(async (req, res) => {
  const hoto = await Hoto.create(req.body);

  res.status(201).json({
    success: true,
    data: hoto
  });
});

// @desc    Update hoto
// @route   PUT /api/hotos/:id
// @access  Public
export const updateHoto = asyncHandler(async (req, res) => {
  let hoto = await Hoto.findById(req.params.id);

  if (!hoto) {
    return res.status(404).json({
      success: false,
      error: 'Hoto not found'
    });
  }

  hoto = await Hoto.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: hoto
  });
});

// @desc    Delete hoto
// @route   DELETE /api/hotos/:id
// @access  Public
export const deleteHoto = asyncHandler(async (req, res) => {
  const hoto = await Hoto.findById(req.params.id);

  if (!hoto) {
    return res.status(404).json({
      success: false,
      error: 'Hoto not found'
    });
  }

  await hoto.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get hotos by location
// @route   GET /api/hotos/location/:locationId
// @access  Public
export const getHotosByLocation = asyncHandler(async (req, res) => {
  const hotos = await Hoto.find({ locationId: req.params.locationId })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: hotos.length,
    data: hotos
  });
});

// @desc    Get hotos by type
// @route   GET /api/hotos/type/:hotoType
// @access  Public
export const getHotosByType = asyncHandler(async (req, res) => {
  const hotos = await Hoto.find({ hotoType: req.params.hotoType })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: hotos.length,
    data: hotos
  });
});

// @desc    Get hoto statistics
// @route   GET /api/hotos/stats
// @access  Public
export const getHotoStats = asyncHandler(async (req, res) => {
  const stats = await Hoto.aggregate([
    {
      $group: {
        _id: '$hotoType',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalHotos = await Hoto.countDocuments();

  res.status(200).json({
    success: true,
    data: {
      total: totalHotos,
      byType: stats
    }
  });
}); 