const { createClient } = require("redis");
const env = require("./env");
const logger = require("../utils/logger");

let client = null;
let connecting = null;

function getRedisClient() {
  if (!client) {
    client = createClient({ url: env.redis.url });
    client.on("error", (err) => {
      logger.error("Redis client error", err);
    });
  }

  return client;
}

async function connectRedis() {
  const redisClient = getRedisClient();

  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!connecting) {
    connecting = redisClient.connect().finally(() => {
      connecting = null;
    });
  }

  await connecting;
  return redisClient;
}

async function disconnectRedis() {
  if (client?.isOpen) {
    await client.quit();
  }
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
};
