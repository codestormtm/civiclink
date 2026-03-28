const { pool } = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { success, failure } = require("../utils/response");
const ROLES = require("../constants/roles");

const env = require("../config/env");
const JWT_SECRET = env.jwt.secret;

// REGISTER
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return failure(res, "name, email, and password are required", 400);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, ROLES.CITIZEN]
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    return failure(res, err.message);
  }
};

// LOGIN
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id, u.is_active,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return failure(res, "User not found", 400);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return failure(res, "User account is inactive", 403);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return failure(res, "Invalid password", 400);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, department_id: user.department_id },
      JWT_SECRET,
      { expiresIn: env.jwt.expiresIn }
    );

    res.json({
      token,
      role: user.role,
      name: user.name,
      department_id: user.department_id,
      department_name: user.department_name,
    });
  } catch (err) {
    return failure(res, err.message);
  }
};
