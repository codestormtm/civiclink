const { Pool } = require("pg");
const env = require("./env");
const logger = require("../utils/logger");

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function checkDatabaseConnection() {
  const client = await pool.connect();
  await client.query("SELECT 1");
  client.release();
}

module.exports = { pool, checkDatabaseConnection };
