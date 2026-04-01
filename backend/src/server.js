require("./config/env");
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const env = require("./config/env");
const { pool, checkDatabaseConnection } = require("./config/db");
const { ensureBucketExists } = require("./config/minio");
const { ensureFirebaseAuthSchema } = require("./services/firebaseAuthSchemaService");
const { ensureMonitoringSchema, startMonitoringLoop } = require("./services/monitoringService");
const { ensurePasswordResetSchema } = require("./services/passwordResetService");
const logger = require("./utils/logger");

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.set("io", io);

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

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
    if (env.monitoring.enabled) {
      startMonitoringLoop(io);
      logger.info("Monitoring services initialized");
    } else {
      logger.info("Monitoring services disabled for this backend instance");
    }
    server.listen(env.port, () => {
      logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
    });
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
