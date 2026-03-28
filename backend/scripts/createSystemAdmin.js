const path = require("path");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { pool } = require("../src/config/db");

async function main() {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error('Usage: npm run create:system-admin -- "System Admin" "sysadmin@example.com" "YourPassword"');
    process.exit(1);
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      console.error(`A user with email ${email} already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, 'SYSTEM_ADMIN', NULL)
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );

    console.log("System admin created successfully:");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Failed to create system admin:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
