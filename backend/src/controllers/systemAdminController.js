const bcrypt = require("bcrypt");
const path = require("path");

const { pool } = require("../config/db");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const { ensurePasswordResetSchema } = require("../services/passwordResetService");
const { extractObjectName } = require("../utils/attachmentStorage");
const { getRequestOrigin } = require("../utils/requestOrigin");
const { success, failure } = require("../utils/response");

const PASSWORD_RESET_SELECT = `
  SELECT prr.id,
         prr.department_id,
         d.name AS department_name,
         prr.target_user_id,
         prr.target_email,
         prr.target_name,
         prr.target_role,
         prr.nic_number,
         prr.mobile_number,
         prr.request_letter_url,
         prr.status,
         prr.viewed_at,
         prr.viewed_by_user_id,
         viewed_by.name AS viewed_by_name,
         prr.completed_at,
         prr.completed_by_user_id,
         completed_by.name AS completed_by_name,
         prr.created_at,
         prr.updated_at
  FROM password_reset_requests prr
  JOIN departments d ON d.id = prr.department_id
  LEFT JOIN users viewed_by ON viewed_by.id = prr.viewed_by_user_id
  LEFT JOIN users completed_by ON completed_by.id = prr.completed_by_user_id
`;

async function getPasswordResetRequestById(client, requestId) {
  const result = await client.query(
    `${PASSWORD_RESET_SELECT}
     WHERE prr.id = $1`,
    [requestId]
  );

  return result.rows[0] || null;
}

function buildPasswordResetRequestLetterUrl(requestId, req) {
  const baseUrl = String(getRequestOrigin(req) || "").replace(/\/+$/, "");
  const relativeUrl = `/api/system-admin/password-reset-requests/${requestId}/request-letter`;

  if (!baseUrl) {
    return relativeUrl;
  }

  return `${baseUrl}${relativeUrl}`;
}

function mapPasswordResetRequestForResponse(requestRow, req) {
  if (!requestRow) {
    return requestRow;
  }

  return {
    ...requestRow,
    request_letter_url: buildPasswordResetRequestLetterUrl(requestRow.id, req),
    request_letter_object_key: extractObjectName(requestRow.request_letter_url) || null,
  };
}

function inferContentTypeFromObjectName(objectName) {
  const extension = path.extname(String(objectName || "")).toLowerCase();

  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

exports.createDeptAdmin = async (req, res) => {
  const { name, email, password, department_id } = req.body;

  if (!name || !email || !password || !department_id) {
    return failure(res, "name, email, password, and department_id are required", 400);
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name,email,password_hash,role,department_id)
       VALUES ($1,$2,$3,'DEPT_ADMIN',$4)
       RETURNING id,name,email,department_id`,
      [name, email, hash, department_id]
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    console.error("[createDeptAdmin error]", err.message, err.detail || "");
    return failure(res, err.message);
  }
};

exports.listPasswordResetRequests = async (_req, res) => {
  try {
    await ensurePasswordResetSchema();

    const result = await pool.query(
      `${PASSWORD_RESET_SELECT}
       ORDER BY prr.created_at DESC`
    );

    return success(res, result.rows.map((row) => mapPasswordResetRequestForResponse(row, _req)));
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getPasswordResetUnreadCount = async (_req, res) => {
  try {
    await ensurePasswordResetSchema();

    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM password_reset_requests
       WHERE viewed_at IS NULL`
    );

    return success(res, result.rows[0]);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getPasswordResetRequest = async (req, res) => {
  const { id } = req.params;

  try {
    await ensurePasswordResetSchema();

    const requestRow = await getPasswordResetRequestById(pool, id);

    if (!requestRow) {
      return failure(res, "Password reset request not found", 404);
    }

    return success(res, mapPasswordResetRequestForResponse(requestRow, req));
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.markPasswordResetRequestViewed = async (req, res) => {
  const { id } = req.params;

  try {
    await ensurePasswordResetSchema();

    const result = await pool.query(
      `UPDATE password_reset_requests
       SET viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP),
           viewed_by_user_id = COALESCE(viewed_by_user_id, $2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return failure(res, "Password reset request not found", 404);
    }

    const requestRow = await getPasswordResetRequestById(pool, id);
    return success(res, mapPasswordResetRequestForResponse(requestRow, req));
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.resetPasswordFromRequest = async (req, res) => {
  const { id } = req.params;
  const { new_password, confirm_password } = req.body;

  if (!new_password || !confirm_password) {
    return failure(res, "new_password and confirm_password are required", 400);
  }

  if (new_password !== confirm_password) {
    return failure(res, "New password and confirmation do not match", 400);
  }

  if (String(new_password).length < 8) {
    return failure(res, "New password must be at least 8 characters long", 400);
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await ensurePasswordResetSchema();
    await client.query("BEGIN");
    transactionStarted = true;

    const requestResult = await client.query(
      `SELECT id, target_user_id, status, viewed_at, viewed_by_user_id
       FROM password_reset_requests
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return failure(res, "Password reset request not found", 404);
    }

    const requestRow = requestResult.rows[0];

    if (requestRow.status === "COMPLETED") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return failure(res, "This password reset request has already been completed", 400);
    }

    const targetUserResult = await client.query(
      `SELECT id
       FROM users
       WHERE id = $1 AND role = 'DEPT_ADMIN'`,
      [requestRow.target_user_id]
    );

    if (targetUserResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return failure(res, "Target department admin account was not found", 404);
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           is_active = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, requestRow.target_user_id]
    );

    await client.query(
      `UPDATE password_reset_requests
       SET status = 'COMPLETED',
           viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP),
           viewed_by_user_id = COALESCE(viewed_by_user_id, $2),
           completed_at = CURRENT_TIMESTAMP,
           completed_by_user_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, req.user.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const updatedRequest = await getPasswordResetRequestById(pool, id);
    return success(
      res,
      mapPasswordResetRequestForResponse(updatedRequest, req),
      200,
      "Password reset completed successfully"
    );
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    return failure(res, err.message);
  } finally {
    client.release();
  }
};

exports.viewPasswordResetRequestLetter = async (req, res) => {
  try {
    await ensurePasswordResetSchema();

    const requestRow = await getPasswordResetRequestById(pool, req.params.id);

    if (!requestRow) {
      return failure(res, "Password reset request not found", 404);
    }

    const objectName = extractObjectName(requestRow.request_letter_url);

    if (!objectName) {
      return failure(res, "Request letter file is missing", 404);
    }

    const objectStream = await minioClient.getObject(BUCKET, objectName);

    res.setHeader("Content-Type", inferContentTypeFromObjectName(objectName));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");

    objectStream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy();
      }
    });

    objectStream.pipe(res);
    return null;
  } catch (err) {
    return failure(res, err.message || "Failed to load request letter", 404);
  }
};
