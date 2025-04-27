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
    
    // Find today's attendance record
    let attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    // Initialize attendance record for today
    if (!attendance) {
      attendance = new Attendance({
        userId,
        date: today,
        status: 'present',
        location
      });
    }
    // Prevent new check-in if the last session is still open
    const lastSession = attendance.sessions.length
      ? attendance.sessions[attendance.sessions.length - 1]
      : null;
    if (lastSession && !lastSession.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'You must check out before checking in again.'
      });
    }
    // Start a new session
    attendance.sessions.push({ checkInTime: new Date() });
    attendance.location = location || attendance.location;
    await attendance.save();
    return res.status(200).json({
      success: true,
      data: attendance,
      message: 'Checked in successfully'
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
    
    if (!attendance || !attendance.sessions.length) {
      return res.status(400).json({
        success: false,
        message: 'You need to check in first before checking out'
      });
    }
    
    // Determine now and the 11:59 PM boundary of the check-in day
    const now = new Date();
    const endOfDay = new Date(attendance.date);
    endOfDay.setHours(23, 59, 0, 0);
    // Close the last open session
    const sessionToClose = attendance.sessions.length
      ? attendance.sessions[attendance.sessions.length - 1]
      : null;
    if (!sessionToClose || sessionToClose.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'No active session to check out from'
      });
    }
    sessionToClose.checkOutTime = now > endOfDay ? endOfDay : now;
    // Recalculate total work hours
    let totalMs = 0;
    attendance.sessions.forEach(s => {
      if (s.checkInTime && s.checkOutTime) {
        totalMs += new Date(s.checkOutTime) - new Date(s.checkInTime);
      }
    });
    attendance.workHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));
    attendance.location = location || attendance.location;
    await attendance.save();
    return res.status(200).json({
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
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        query.date.$gte = startDateObj;
      }
      
      if (endDate) {
        // Set time to end of day
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.date.$lte = endDateObj;
      }
    }
    
    // Add status filter if provided
    if (status && ['present', 'absent', 'late'].includes(status)) {
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
      if (!attendance.sessions.length) {
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
    const { startDate, endDate, status, userId, page, limit } = req.query;
    
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
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        query.date.$gte = startDateObj;
      }
      
      if (endDate) {
        // Set time to end of day
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.date.$lte = endDateObj;
      }
    }
    
    // Add status filter if provided
    if (status && ['present', 'absent', 'late'].includes(status)) {
      query.status = status;
    }
    
    // Pagination
    const currentPage = parseInt(page, 10) || 1;
    const recordsPerPage = parseInt(limit, 10) || 20;
    const skip = (currentPage - 1) * recordsPerPage;
    
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(recordsPerPage);
    
    const total = await Attendance.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      total,
      pagination: {
        current: currentPage,
        pages: Math.ceil(total / recordsPerPage)
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

// Check if user is currently present
export const isUserPresentNow = async (req, res, next) => {
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
    
    // Check if user has an active session (checked in but not checked out)
    let isPresent = false;
    let currentSession = null;
    
    if (attendance && attendance.sessions.length > 0) {
      const lastSession = attendance.sessions[attendance.sessions.length - 1];
      if (lastSession.checkInTime && !lastSession.checkOutTime) {
        isPresent = true;
        currentSession = {
          checkInTime: lastSession.checkInTime,
          duration: Math.round((new Date() - new Date(lastSession.checkInTime)) / (1000 * 60)) // Duration in minutes
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        isPresent,
        currentSession,
        attendanceId: attendance ? attendance._id : null
      }
    });
  } catch (error) {
    next(error);
  }
}; 