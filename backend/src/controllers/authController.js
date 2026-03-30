const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { pool } = require("../config/db");
const env = require("../config/env");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const ROLES = require("../constants/roles");
const { ensurePasswordResetSchema } = require("../services/passwordResetService");
const { success, failure } = require("../utils/response");

const JWT_SECRET = env.jwt.secret;
const MINIO_URL = process.env.MINIO_URL || "http://localhost:9000";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildUnsupportedForgotPasswordResponse() {
  return {
    flow: "UNSUPPORTED",
    eligible: false,
    message: "Forgot password is not available for this account.",
  };
}

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

exports.lookupForgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !String(email).trim()) {
    return failure(res, "email is required", 400);
  }

  try {
    await ensurePasswordResetSchema();

    const result = await pool.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.role,
              u.department_id,
              u.is_active,
              d.name AS department_name,
              d.contact_phone
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [String(email).trim()]
    );

    if (result.rows.length === 0) {
      return success(res, buildUnsupportedForgotPasswordResponse());
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return success(res, buildUnsupportedForgotPasswordResponse());
    }

    if (user.role === "WORKER") {
      return success(res, {
        flow: "WORKER_CONTACT",
        eligible: true,
        department_name: user.department_name,
        contact_phone: user.contact_phone || "",
        message: user.contact_phone
          ? `Please contact ${user.department_name} using ${user.contact_phone} to reset your password.`
          : `Please contact ${user.department_name} to reset your password.`,
      });
    }

    if (user.role === "DEPT_ADMIN") {
      return success(res, {
        flow: "DEPT_ADMIN_REQUEST",
        eligible: true,
        department_id: user.department_id,
        department_name: user.department_name,
        target_role: user.role,
        message: "Submit the password reset request form for system admin review.",
      });
    }

    return success(res, buildUnsupportedForgotPasswordResponse());
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.createDeptAdminPasswordResetRequest = async (req, res) => {
  const { email, target_name, nic_number, mobile_number, target_role } = req.body;
  const requestLetter = req.file;

  if (!email || !target_name || !nic_number || !mobile_number || !target_role) {
    return failure(
      res,
      "email, target_name, nic_number, mobile_number, and target_role are required",
      400
    );
  }

  if (!requestLetter) {
    return failure(res, "request_letter is required", 400);
  }

  if (target_role !== "DEPT_ADMIN") {
    return failure(res, "Only department admin password reset requests are supported", 400);
  }

  const client = await pool.connect();

  try {
    await ensurePasswordResetSchema();

    const targetResult = await client.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.role,
              u.department_id,
              u.is_active,
              d.name AS department_name
       FROM users u
       JOIN departments d ON d.id = u.department_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [String(email).trim()]
    );

    if (targetResult.rows.length === 0) {
      return failure(res, "No active department admin account matches this email address.", 404);
    }

    const targetUser = targetResult.rows[0];

    if (!targetUser.is_active || targetUser.role !== "DEPT_ADMIN") {
      return failure(res, "No active department admin account matches this email address.", 400);
    }

    if (normalizeName(target_name) !== normalizeName(targetUser.name)) {
      return failure(res, "The submitted name must match the department admin account.", 400);
    }

    const fileName = `password-reset-${Date.now()}-${requestLetter.originalname}`;

    await minioClient.putObject(
      BUCKET,
      fileName,
      requestLetter.buffer,
      requestLetter.size,
      {
        "Content-Type": requestLetter.mimetype,
      }
    );

    const requestLetterUrl = `${MINIO_URL}/${BUCKET}/${fileName}`;

    const insertResult = await client.query(
      `INSERT INTO password_reset_requests (
         department_id,
         target_user_id,
         target_email,
         target_name,
         target_role,
         nic_number,
         mobile_number,
         request_letter_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, department_id, target_email, target_name, target_role, status, created_at`,
      [
        targetUser.department_id,
        targetUser.id,
        targetUser.email,
        targetUser.name,
        targetUser.role,
        String(nic_number).trim(),
        String(mobile_number).trim(),
        requestLetterUrl,
      ]
    );

    const createdRequest = insertResult.rows[0];
    const io = req.app.get("io");

    if (io) {
      io.emit("password_reset_request_created", createdRequest);
    }

    return success(
      res,
      {
        ...createdRequest,
        department_name: targetUser.department_name,
      },
      201,
      "Password reset request submitted successfully"
    );
  } catch (err) {
    return failure(res, err.message);
  } finally {
    client.release();
  }
};
