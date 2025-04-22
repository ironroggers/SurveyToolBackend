import Attendance from '../models/attendance.model.js';

// Mark attendance (check-in)
export const markAttendance = async (req, res, next) => {
  try {
    const { location, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    // Create a date object for today with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if attendance already exists for the user today
    let attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (attendance) {
      // If already checked in but not checked out
      if (attendance.checkInTime && !attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in. Please check out first.'
        });
      }
      
      // If already checked out, don't allow another check-in on same day
      if (attendance.checkInTime && attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message: 'You have already completed attendance for today.'
        });
      }
    }
    
    // Create new attendance record if it doesn't exist
    if (!attendance) {
      attendance = new Attendance({
        userId,
        date: today,
        status: 'present',
        checkInTime: new Date(),
        location
      });
    } else {
      // Update existing record if it exists (e.g., if marked absent by default)
      attendance.status = 'present';
      attendance.checkInTime = new Date();
      attendance.location = location;
      
      // Reset justification if previously absent
      if (attendance.justificationStatus !== 'not_required') {
        attendance.justificationStatus = 'not_required';
        attendance.justification = '';
      }
    }
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      data: attendance,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Check out (end of day)
export const checkOut = async (req, res, next) => {
  try {
    const { location, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    // Create a date object for today with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find today's attendance record
    const attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (!attendance || !attendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'You need to check in first before checking out'
      });
    }
    
    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today'
      });
    }
    
    // Set checkout time
    attendance.checkOutTime = new Date();
    
    // Calculate work hours
    const checkInTime = new Date(attendance.checkInTime);
    const checkOutTime = new Date(attendance.checkOutTime);
    const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert ms to hours
    
    attendance.workHours = parseFloat(workHours.toFixed(2));
    attendance.location = location || attendance.location;
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      data: attendance,
      message: 'Checked out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get attendance history for the logged-in user
export const getMyAttendanceHistory = async (req, res, next) => {
  try {
    const { startDate, endDate, status, userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    const query = { userId };
    
    // Add date filters if provided
    if (startDate || endDate) {
      query.date = {};
      
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      
      if (endDate) {
        // Set time to end of day
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.date.$lte = endDateObj;
      }
    }
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }
    
    const attendanceRecords = await Attendance.find(query).sort({ date: -1 });
    
    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords
    });
  } catch (error) {
    next(error);
  }
};

// Get today's attendance status
export const getTodayAttendance = async (req, res, next) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }
    
    // Create a date object for today with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find today's attendance record
    const attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (!attendance) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No attendance record for today'
      });
    }
    
    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

// Submit justification for absence
export const submitJustification = async (req, res, next) => {
  try {
    const { date, justification, userId } = req.body;
    
    if (!date || !justification || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide date, justification, and userId'
      });
    }
    
    // Find the attendance record
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    let attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: targetDate,
        $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    // If no record exists, create one with absent status
    if (!attendance) {
      attendance = new Attendance({
        userId,
        date: targetDate,
        status: 'absent',
        justification,
        justificationStatus: 'pending'
      });
    } else {
      // Update existing record
      attendance.justification = justification;
      attendance.justificationStatus = 'pending';
      
      // If checking in was missed, mark as absent
      if (!attendance.checkInTime) {
        attendance.status = 'absent';
      }
    }
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      data: attendance,
      message: 'Justification submitted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get attendance records of all users
export const getAllAttendance = async (req, res, next) => {
  try {
    const { startDate, endDate, status, userId } = req.query;
    
    // Admin check removed temporarily
    
    const query = {};
    
    // Add userId filter if provided
    if (userId) {
      query.userId = userId;
    }
    
    // Add date filters if provided
    if (startDate || endDate) {
      query.date = {};
      
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      
      if (endDate) {
        // Set time to end of day
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.date.$lte = endDateObj;
      }
    }
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Attendance.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit)
      },
      data: attendanceRecords
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Approve or reject justification
export const processJustification = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { status, adminId } = req.body;
    
    // Verify admin role check removed temporarily
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"'
      });
    }
    
    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }
    
    if (attendance.justificationStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This justification has already been ${attendance.justificationStatus}`
      });
    }
    
    attendance.justificationStatus = status;
    attendance.approvedBy = adminId || 'system';
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      data: attendance,
      message: `Justification ${status} successfully`
    });
  } catch (error) {
    next(error);
  }
}; 