const express = require("express");
const cors = require("cors");
const env = require("./config/env");

const authRoutes = require("./routes/authRoutes");
const issueRoutes = require("./routes/issueRoutes");
const citizenComplaintRoutes = require("./routes/citizenComplaintRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const workerRoutes = require("./routes/workerRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const systemAdminRoutes = require("./routes/systemAdminRoutes");
const publicRoutes = require("./routes/publicRoutes");
const workerAssignmentRoutes = require("./routes/workerAssignmentRoutes");
const intakeRoutes = require("./routes/intakeRoutes");
const deptAdminRoutes = require("./routes/deptAdminRoutes");

const requestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFoundMiddleware");
const errorHandler = require("./middleware/errorMiddleware");
const authMiddleware = require("./middleware/authMiddleware");

const { pool } = require("./config/db");
const { success, failure } = require("./utils/response");
const { checkStorageHealth } = require("./services/monitoringService");

const app = express();

app.use(cors({
  origin: [env.clientUrl, "http://localhost:5174"],
}));
app.use(express.json());
app.use(requestLogger);

app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/citizen-complaints", citizenComplaintRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/system-admin", systemAdminRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/worker", workerAssignmentRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/dept-admin", deptAdminRoutes);

app.get("/", (_req, res) => res.send("CivicLink API Running"));

app.get("/api/health/app", (_req, res) => {
  return success(res, {
    ok: true,
    service: "backend_api",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  }, 200, "Application healthy");
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return success(res, { ok: true }, 200, "Database healthy");
  } catch (err) {
    return failure(res, "Database unreachable", 503);
  }
});

app.get("/api/health/storage", async (_req, res) => {
  try {
    const result = await checkStorageHealth();
    return success(res, result, 200, "Storage healthy");
  } catch (_err) {
    return failure(res, "Storage unreachable", 503);
  }
});

app.get("/api/users", authMiddleware, async (req, res, next) => {
  const { role } = req.query;

  if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(req.user.role)) {
    return failure(res, "Access denied", 403);
  }

  try {
    const params = [];
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE 1 = 1
    `;

    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }

    if (req.user.role === "DEPT_ADMIN") {
      params.push(req.user.department_id);
      query += ` AND u.department_id = $${params.length}`;
    }

    query += ` ORDER BY u.name`;

    const result = await pool.query(query, params);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
