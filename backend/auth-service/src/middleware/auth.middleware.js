import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { UnauthorizedError } from "../utils/errors.js";

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    // 4) Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid token"));
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new UnauthorizedError("Not authorized to access this resource")
      );
    }
    next();
  };
};
