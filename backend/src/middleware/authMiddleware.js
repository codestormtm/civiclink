const jwt = require("jsonwebtoken");
const env = require("../config/env");
const AppError = require("../utils/appError");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("No token provided", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, env.jwt.secret);
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
};

module.exports = authMiddleware;
