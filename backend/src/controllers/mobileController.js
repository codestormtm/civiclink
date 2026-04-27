const { pool } = require("../config/db");
const { success, failure } = require("../utils/response");

const VALID_APPS = new Set(["citizen", "worker"]);
const VALID_PLATFORMS = new Set(["android"]);

function normalizeText(value) {
  return String(value || "").trim();
}

exports.registerDeviceToken = async (req, res) => {
  const fcmToken = normalizeText(req.body?.fcm_token || req.body?.token);
  const app = normalizeText(req.body?.app).toLowerCase();
  const platform = normalizeText(req.body?.platform || "android").toLowerCase();
  const deviceLabel = normalizeText(req.body?.device_label);

  if (!fcmToken) {
    return failure(res, "fcm_token is required", 400);
  }

  if (!VALID_APPS.has(app)) {
    return failure(res, "app must be citizen or worker", 400);
  }

  if (!VALID_PLATFORMS.has(platform)) {
    return failure(res, "platform must be android", 400);
  }

  if (app === "citizen" && req.user.role !== "CITIZEN") {
    return failure(res, "Citizen app tokens require a citizen session", 403);
  }

  if (app === "worker" && req.user.role !== "WORKER") {
    return failure(res, "Worker app tokens require a worker session", 403);
  }

  try {
    const result = await pool.query(
      `INSERT INTO mobile_device_tokens (
         user_id,
         role,
         app,
         platform,
         fcm_token,
         device_label,
         last_seen_at,
         revoked_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, NULL)
       ON CONFLICT (fcm_token)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         role = EXCLUDED.role,
         app = EXCLUDED.app,
         platform = EXCLUDED.platform,
         device_label = EXCLUDED.device_label,
         last_seen_at = CURRENT_TIMESTAMP,
         revoked_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, user_id, role, app, platform, device_label, last_seen_at`,
      [
        req.user.id,
        req.user.role,
        app,
        platform,
        fcmToken,
        deviceLabel || null,
      ]
    );

    return success(res, result.rows[0], 200, "Device token registered");
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.revokeDeviceToken = async (req, res) => {
  const fcmToken = normalizeText(req.body?.fcm_token || req.body?.token);

  if (!fcmToken) {
    return failure(res, "fcm_token is required", 400);
  }

  try {
    await pool.query(
      `UPDATE mobile_device_tokens
       SET revoked_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND fcm_token = $2
         AND revoked_at IS NULL`,
      [req.user.id, fcmToken]
    );

    return success(res, { revoked: true }, 200, "Device token revoked");
  } catch (err) {
    return failure(res, err.message);
  }
};
