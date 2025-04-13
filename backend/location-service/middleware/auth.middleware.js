import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';

export const protect = async (req, res, next) => {
  try {
    // 1) Get token from header
    const authHeader = req.headers.authorization;
    let token;
    
    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Please login to access this resource');
    }

    // 2) Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 3) Add user info to request
      req.user = {
        id: decoded.id,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  } catch (error) {
    next(error);
  }
};

// Middleware for role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new UnauthorizedError('You do not have permission to perform this action'));
    }
    next();
  };
}; 