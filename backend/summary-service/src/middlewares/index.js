import { v4 as uuidv4 } from 'uuid';

export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
}

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      message: 'Not Found',
      path: req.originalUrl,
      requestId: req.id,
    },
  });
}

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong';

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      requestId: req?.id,
    },
  });
}


