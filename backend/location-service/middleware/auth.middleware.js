import jwt from 'jsonwebtoken';
import { AppError } from '../utils/error.js';

export const protect = async (req, res, next) => {
  try {
    // Log all headers for debugging
    console.log('All Headers:', req.headers);
    console.log('Request Origin:', req.get('origin'));
    
    // 1) Get token from header
    const authHeader = req.headers.authorization;
    console.log('Auth Header:', authHeader);
    
    let token;
    
    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
      console.log('Extracted Token:', token);
    }

    if (!token) {
      console.log('No token found in request');
      throw new AppError('Please login to access this resource', 401);
    }

    // 2) Verify token
    try {
      console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Exists' : 'Missing');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded Token:', decoded);
      
      // 3) Add user info to request
      req.user = {
        id: decoded.id,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      console.log('Token Verification Error:', error.message);
      throw new AppError('Invalid or expired token', 401);
    }
  } catch (error) {
    next(error);
  }
};

// Middleware for role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
}; 