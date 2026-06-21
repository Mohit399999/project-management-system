import { ApiError } from "../utils/api-error.js";

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    statusCode,
    data: null,
    success: false,
    message: err.message || "Internal server error",
    errors: err.errors || [],
  });
};
