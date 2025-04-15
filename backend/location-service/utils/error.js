export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Helper function to create specific error types
export const createNotFoundError = (message = 'Resource not found') => {
  return new AppError(message, 404);
};

export const createBadRequestError = (message = 'Bad request') => {
  return new AppError(message, 400);
};

export const createUnauthorizedError = (message = 'Unauthorized') => {
  return new AppError(message, 401);
};

export const createForbiddenError = (message = 'Forbidden') => {
  return new AppError(message, 403);
}; 