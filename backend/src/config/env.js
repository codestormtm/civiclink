const { existsSync } = require("fs");

require("dotenv").config();

const runningInDocker = existsSync("/.dockerenv");
const defaultMonitoringHost = process.env.MONITORING_HOST || (runningInDocker ? "host.docker.internal" : "localhost");
const defaultCitizenPortalUrl = `http://${defaultMonitoringHost}:5173`;
const defaultAdminPortalUrl = `http://${defaultMonitoringHost}:5174`;
const defaultBackendApiUrl = `http://${runningInDocker ? "127.0.0.1" : "localhost"}:${process.env.PORT || 5001}/api/health/app`;
const resolvedCitizenPortalUrl = process.env.CITIZEN_PORTAL_URL
  || (runningInDocker ? defaultCitizenPortalUrl : (process.env.CLIENT_URL || defaultCitizenPortalUrl));
const resolvedTransparencyPortalUrl = process.env.TRANSPARENCY_PORTAL_URL
  || `${resolvedCitizenPortalUrl.replace(/\/$/, "")}/public`;

const required = [
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "CLIENT_URL",
  "MINIO_ENDPOINT",
  "MINIO_PORT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
];

const missing = required.filter((key) => !process.env[key]);

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  return String(value).trim().toLowerCase() === "true";
}

if (missing.length > 0) {
  console.error(`App startup failed: missing required env variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
  console.error("App startup failed: JWT_SECRET must not be empty");
  process.exit(1);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT),

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },

  clientUrl: process.env.CLIENT_URL,

  monitoring: {
    enabled: parseBoolean(process.env.MONITORING_ENABLED, false),
    adminPortalUrl: process.env.ADMIN_PORTAL_URL || defaultAdminPortalUrl,
    citizenPortalUrl: resolvedCitizenPortalUrl,
    transparencyPortalUrl: resolvedTransparencyPortalUrl,
    backendApiUrl: process.env.BACKEND_API_URL || defaultBackendApiUrl,
  },

  minio: {
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
  },
};

if (isNaN(env.port)) {
  console.error("App startup failed: PORT must be a number");
  process.exit(1);
}

if (isNaN(env.db.port)) {
  console.error("App startup failed: DB_PORT must be a number");
  process.exit(1);
}

if (isNaN(env.minio.port)) {
  console.error("App startup failed: MINIO_PORT must be a number");
  process.exit(1);
}

module.exports = env;
