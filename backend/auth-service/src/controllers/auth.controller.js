import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import bcrypt from "bcryptjs";

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export const register = async (req, res, next) => {
  try {
    const { username, email, password, role, reportingTo, designation, project } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      throw new BadRequestError("User already exists");
    }

    // Validate reportingTo if provided and role is not ADMIN
    if (role !== 'ADMIN') {
      if (!reportingTo) {
        throw new BadRequestError("Reporting manager is required for non-admin users");
      }
      const reportingManager = await User.findById(reportingTo);
      if (!reportingManager) {
        throw new BadRequestError("Invalid reporting manager");
      }
    }

    const user = await User.create({
      username,
      email,
      password,
      role,
      designation,
      reportingTo: role === 'ADMIN' ? null : reportingTo,
      project,
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          designation: user.designation,
          reportingTo: user.reportingTo,
          project: user.project,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      throw new BadRequestError("Invalid credentials");
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      data: {
        user: user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { username, email, phone, designation, project } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username, email, phone, designation, project },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Add a new endpoint to get all potential reporting managers
export const getPotentialManagers = async (req, res, next) => {
  try {
    const managers = await User.find({
      role: { $in: ['SUPERVISOR', 'ADMIN'] },
      status: 1
    }).select('_id username email role');

    res.status(200).json({
      success: true,
      data: managers,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { reportingTo, role } = req.query;
    const filter = { status: 1 };
    
    if (reportingTo) {
      filter.reportingTo = reportingTo;
    }
    
    if (role) {
      filter.role = role;
    }
    
    const users = await User.find(filter)
      .select('-password')
      .populate('reportingTo', 'username email role');

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {

    const userId = req.params.id;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if trying to delete an admin
    if (user?.role === 'ADMIN') {
      throw new BadRequestError('Cannot delete administrator accounts');
    }

    // Find users reporting to this user
    const subordinates = await User.find({ reportingTo: userId });
    if (subordinates.length > 0) {
      throw new BadRequestError('Cannot delete user with subordinates. Please reassign subordinates first.');
    }

    // Soft delete by setting status to 0
    await User.findByIdAndUpdate(userId, { status: 0 });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Normalize incoming values: treat empty strings as undefined
    const normalize = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

    const username = normalize(req.body.username);
    const email = normalize(req.body.email);
    const role = normalize(req.body.role);
    const reportingTo = normalize(req.body.reportingTo);
    const designation = normalize(req.body.designation);
    const password = normalize(req.body.password);
    const project = normalize(req.body.project);

    // Load existing user document
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Apply simple fields if provided
    if (typeof username !== 'undefined') user.username = username;
    if (typeof email !== 'undefined') user.email = email;
    if (typeof designation !== 'undefined') user.designation = designation;
    if (typeof project !== 'undefined') user.project = project;

    // Handle role + reportingTo logic
    if (typeof role !== 'undefined') {
      user.role = role;
      if (role === 'ADMIN') {
        user.reportingTo = null;
      } else if (typeof reportingTo !== 'undefined') {
        // Validate provided reportingTo for non-admin roles
        const manager = await User.findById(reportingTo);
        if (!manager) {
          throw new BadRequestError('Invalid reporting manager');
        }
        user.reportingTo = reportingTo;
      }
      // If non-admin and reportingTo not provided, leave as is
    } else if (typeof reportingTo !== 'undefined') {
      // Role not changed; respect current role
      if (user.role !== 'ADMIN') {
        const manager = await User.findById(reportingTo);
        if (!manager) {
          throw new BadRequestError('Invalid reporting manager');
        }
        user.reportingTo = reportingTo;
      } else {
        user.reportingTo = null;
      }
    }

    // Password update
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
    }

    // Save document to trigger validators with correct context
    const saved = await user.save();
    const sanitized = saved.toObject();
    delete sanitized.password;

    res.status(200).json({ success: true, data: sanitized });
  } catch (error) {
    if (error && (error.code === 11000 || error.code === '11000')) {
      return next(new BadRequestError('Email already in use'));
    }
    next(error);
  }
};
