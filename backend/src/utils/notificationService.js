const { pool } = require("../config/db");
const { getFirebaseMessaging, isFirebaseAuthEnabled } = require("../config/firebaseAdmin");
const logger = require("./logger");

function stringifyData(data = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function isInvalidTokenError(error) {
  const code = error?.errorInfo?.code || error?.code || "";
  return [
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument",
  ].includes(code);
}

async function revokeInvalidTokens(tokens) {
  if (!tokens.length) {
    return;
  }

  await pool.query(
    `UPDATE mobile_device_tokens
     SET revoked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE fcm_token = ANY($1::text[])`,
    [tokens]
  );
}

async function findActiveTokens({ userIds = [], roles = [], apps = [] }) {
  const params = [];
  const filters = ["revoked_at IS NULL"];

  if (userIds.length) {
    params.push(userIds);
    filters.push(`user_id = ANY($${params.length}::uuid[])`);
  }

  if (roles.length) {
    params.push(roles);
    filters.push(`role = ANY($${params.length}::text[])`);
  }

  if (apps.length) {
    params.push(apps);
    filters.push(`app = ANY($${params.length}::text[])`);
  }

  if (!userIds.length && !roles.length && !apps.length) {
    return [];
  }

  const result = await pool.query(
    `SELECT DISTINCT fcm_token
     FROM mobile_device_tokens
     WHERE ${filters.join(" AND ")}`,
    params
  );

  return result.rows.map((row) => row.fcm_token).filter(Boolean);
}

async function sendMobileNotification({ userIds = [], roles = [], apps = [], title, body, data = {} }) {
  try {
    if (!isFirebaseAuthEnabled()) {
      logger.info(`Mobile push skipped; Firebase Admin is not configured: ${title}`);
      return { sent: 0, skipped: true };
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      logger.info(`Mobile push skipped; Firebase Messaging is unavailable: ${title}`);
      return { sent: 0, skipped: true };
    }

    const tokens = await findActiveTokens({ userIds, roles, apps });
    if (!tokens.length) {
      logger.info(`Mobile push skipped; no active device tokens: ${title}`);
      return { sent: 0, skipped: true };
    }

    const payload = {
      notification: {
        title: title || "CivicLink",
        body: body || "You have a CivicLink update.",
      },
      data: stringifyData(data),
      android: {
        priority: "high",
        notification: {
          channelId: "civiclink_updates",
        },
      },
      tokens,
    };

    const response = await messaging.sendEachForMulticast(payload);
    const invalidTokens = [];

    response.responses.forEach((result, index) => {
      if (!result.success && isInvalidTokenError(result.error)) {
        invalidTokens.push(tokens[index]);
      }
    });

    await revokeInvalidTokens(invalidTokens);

    logger.info(`Mobile push sent: ${response.successCount}/${tokens.length} (${title})`);
    return {
      sent: response.successCount,
      failed: response.failureCount,
      revoked: invalidTokens.length,
    };
  } catch (err) {
    logger.error("Mobile push failed", err);
    return { sent: 0, failed: true };
  }
}

async function notifyWorkerAssignment({ workerUserId, assignmentId, complaintId, title }) {
  return sendMobileNotification({
    userIds: [workerUserId],
    apps: ["worker"],
    title: "New CivicLink task",
    body: title ? `Assigned: ${title}` : "A new task has been assigned to you.",
    data: {
      type: "worker_assignment",
      assignment_id: assignmentId,
      complaint_id: complaintId,
      url_path: assignmentId ? `/task/${assignmentId}` : "/",
    },
  });
}

async function notifyCitizenComplaintStatus({ citizenUserId, complaintId, status, title }) {
  return sendMobileNotification({
    userIds: [citizenUserId],
    apps: ["citizen"],
    title: "Complaint status updated",
    body: title ? `${title}: ${status}` : `Your complaint is now ${status}.`,
    data: {
      type: "citizen_complaint_status",
      complaint_id: complaintId,
      status,
      url_path: complaintId ? `/track/${complaintId}` : "/",
    },
  });
}

exports.sendNotification = (message) => {
  logger.info(`NOTIFICATION: ${message}`);
};

exports.notifyWorkerAssignment = notifyWorkerAssignment;
exports.notifyCitizenComplaintStatus = notifyCitizenComplaintStatus;
exports.sendMobileNotification = sendMobileNotification;
