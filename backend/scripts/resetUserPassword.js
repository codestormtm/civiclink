const path = require("path");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { pool } = require("../src/config/db");

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage: npm run reset:password -- "user@example.com" "NewPassword123"');
    process.exit(1);
  }

  try {
    const existing = await pool.query(
      "SELECT id, email, role FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length === 0) {
      console.error(`No user found with email ${email}.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1, is_active = TRUE
       WHERE email = $2
       RETURNING id, email, role, is_active`,
      [passwordHash, email]
    );

    console.log("Password reset successfully:");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Failed to reset password:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
