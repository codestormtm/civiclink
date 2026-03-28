require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const sql = `
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

UPDATE complaints
SET sla_due_at = submitted_at + INTERVAL '72 hours'
WHERE sla_due_at IS NULL;
`;

pool.query(sql)
  .then(() => {
    console.log("✓ Added priority_level and sla_due_at to complaints table");
  })
  .catch((err) => {
    console.error("✗ Migration failed:", err.message);
  })
  .finally(() => pool.end());
