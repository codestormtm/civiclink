require("./config/env");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = require("./app");
const env = require("./config/env");
const { isAllowedOrigin } = require("./utils/originSecurity");
const { attachSocketRooms } = require("./utils/socketRooms");
const { pool, checkDatabaseConnection } = require("./config/db");
const { ensureBucketExists } = require("./config/minio");
const { ensureFirebaseAuthSchema } = require("./services/firebaseAuthSchemaService");
const { ensureMonitoringSchema, startMonitoringLoop } = require("./services/monitoringService");
const { ensurePasswordResetSchema } = require("./services/passwordResetService");
const { ensureUserPreferencesSchema } = require("./services/userPreferencesSchemaService");
const { ensureMobileDeviceTokenSchema } = require("./services/mobileDeviceTokenSchemaService");
const logger = require("./utils/logger");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true);
        return;
      }

      callback(new Error(`Socket blocked for origin: ${origin}`));
    },
  },
});

app.set("io", io);

io.use((socket, next) => {
  const authHeader = String(socket.handshake.headers.authorization || "");
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = String(socket.handshake.auth?.token || bearerToken).trim();

  if (!token) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const user = jwt.verify(token, env.jwt.secret);
    socket.data.user = user;
    attachSocketRooms(socket, user);
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id} (${socket.data.user?.role || "UNKNOWN"})`);
  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

function listen(port) {
  return new Promise((resolve, reject) => {
    const handleError = (err) => {
      server.off("listening", handleListening);
      reject(err);
    };

    const handleListening = () => {
      server.off("error", handleError);
      logger.info(`Server running on port ${port} [${env.nodeEnv}]`);
      resolve();
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port);
  });
}

async function start() {
  try {
    logger.info("Connecting to database...");
    await checkDatabaseConnection();
    logger.info("Database connected");

    await ensureBucketExists();
    logger.info(`MinIO bucket ready: ${env.minio.bucket}`);
  } catch (err) {
    logger.error("Server startup failed", err);
    try {
      await pool.end();
    } catch {
      // ignore shutdown errors during failed startup
    }
    process.exit(1);
    return;
  }

  try {
    await ensureFirebaseAuthSchema();
    await ensureMonitoringSchema();
    await ensurePasswordResetSchema();
    await ensureUserPreferencesSchema();
    await ensureMobileDeviceTokenSchema();
    await listen(env.port);

    if (env.monitoring.enabled) {
      startMonitoringLoop(io);
      logger.info("Monitoring services initialized");
    } else {
      logger.info("Monitoring services disabled for this backend instance");
    }
  } catch (err) {
    logger.error("Server startup failed", err);
    try {
      await pool.end();
    } catch {
      // ignore shutdown errors during failed startup
    }
    process.exit(1);
  }
}

function shutdown() {
  logger.info("Shutting down...");
  server.close(async () => {
    await pool.end();
    logger.info("Server and DB pool closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
