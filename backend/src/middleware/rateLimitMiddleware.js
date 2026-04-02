const AppError = require("../utils/appError");

const buckets = new Map();

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || req.ip || "unknown";
}

function createRateLimit({
  windowMs = 15 * 60 * 1000,
  max = 10,
  keyPrefix = "global",
} = {}) {
  return (req, _res, next) => {
    const now = Date.now();
    const bucketKey = `${keyPrefix}:${getClientIp(req)}`;
    const bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      next(new AppError("Too many requests. Please try again later.", 429));
      return;
    }

    bucket.count += 1;
    next();
  };
}

module.exports = createRateLimit;
