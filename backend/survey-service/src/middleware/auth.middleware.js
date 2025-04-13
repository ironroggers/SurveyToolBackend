import jwt from "jsonwebtoken";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import Survey from "../models/survey.model.js";

export const protect = async (req, res, next) => {
  try {
    // 1) Get token from header
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      throw new UnauthorizedError("Please login to access this resource");
    }

    // 2) Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3) Add user info to request
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired token");
    }
  } catch (error) {
    next(error);
  }
};

// Middleware for role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("User not found"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role ${req.user.role} is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

// Helper middleware to check if user can access survey
export const checkSurveyAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Admin has full access
    if (role === "ADMIN") {
      return next();
    }

    const survey = await Survey.findById(id);
    if (!survey) {
      throw new NotFoundError("Survey not found");
    }

    // Surveyor can only access assigned surveys
    if (role === "SURVEYOR" && survey.assignedTo.toString() !== userId) {
      throw new ForbiddenError("You can only access surveys assigned to you");
    }

    // Supervisor can only access surveys they created
    if (role === "SUPERVISOR" && survey.assignedBy.toString() !== userId) {
      throw new ForbiddenError("You can only access surveys you created");
    }

    req.survey = survey;
    next();
  } catch (error) {
    next(error);
  }
};
