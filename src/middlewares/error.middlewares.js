import mongoose from "mongoose";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal server error";
  let errors = Array.isArray(err.errors) ? err.errors : [];

  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({ [e.path]: e.message }));
  } else if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue || {}).join(", ")}`;
  } else if (err instanceof multer.MulterError) {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  }

  if (statusCode >= 500) {
    console.error(err);
    message = "Internal server error"; // don't leak internals
    errors = [];
  }

  return res.status(statusCode).json({
    statusCode,
    data: null,
    success: false,
    message,
    errors,
  });
};
