const env = require("../config/env");

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info(message) {
    console.log(`[${timestamp()}] INFO  ${message}`);
  },
  warn(message) {
    console.warn(`[${timestamp()}] WARN  ${message}`);
  },
  error(message, err) {
    console.error(`[${timestamp()}] ERROR ${message}`);
    if (err && env.nodeEnv !== "production") {
      console.error(err);
    }
  },
};

module.exports = logger;
