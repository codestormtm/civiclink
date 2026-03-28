const AppError = require("../utils/appError");
const logger = require("../utils/logger");

const OPERATIONAL_CODES = new Set([400, 401, 403, 404, 409, 422]);

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const body = { success: false, message: err.message };
    if (err.details) body.errors = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err.statusCode && OPERATIONAL_CODES.has(err.statusCode)) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  logger.error(`Unhandled error: ${req.method} ${req.originalUrl}`, err);

  return res.status(500).json({ success: false, message: "Internal server error" });
};

module.exports = errorHandler;
