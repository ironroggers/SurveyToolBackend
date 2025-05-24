export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || "Something went wrong!";

  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date(),
    },
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      status: 404,
      path: req.originalUrl,
      method: req.method,
    },
  });
};
