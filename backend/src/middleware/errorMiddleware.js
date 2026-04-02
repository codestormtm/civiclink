const AppError = require("../utils/appError");
const logger = require("../utils/logger");

const OPERATIONAL_CODES = new Set([400, 401, 403, 404, 409, 413, 415, 422, 429]);

const errorHandler = (err, req, res, next) => {
  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "Uploaded file is too large" });
    }

    return res.status(400).json({ success: false, message: err.message });
  }

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
