const ROLES = require("../constants/roles");
const { pool } = require("../config/db");
const { success, failure } = require("../utils/response");
const { canAccessConversation } = require("../utils/communicationAccess");

async function findAssignmentForUser({ assignmentId, complaintId, user }) {
  const params = [];
  let whereClause = "";

  if (assignmentId) {
    params.push(assignmentId);
    whereClause = `ca.id = $${params.length}`;
  } else if (complaintId) {
    params.push(complaintId);
    whereClause = `ca.complaint_id = $${params.length}`;
  } else {
    return null;
  }

  const result = await pool.query(
    `SELECT ca.id AS assignment_id,
            ca.complaint_id,
            ca.worker_user_id,
            ca.department_id,
            ca.assigned_by_user_id,
            c.title AS complaint_title,
            c.status AS complaint_status,
            worker_user.name AS worker_name
     FROM complaint_assignments ca
     JOIN complaints c ON c.id = ca.complaint_id
     JOIN users worker_user ON worker_user.id = ca.worker_user_id
     WHERE ${whereClause}
     ORDER BY ca.assigned_at DESC
     LIMIT 1`,
    params
  );

  const assignment = result.rows[0] || null;
  if (!assignment) {
    return null;
  }

  if (user.role === ROLES.SYSTEM_ADMIN) {
    return assignment;
  }

  if (user.role === ROLES.DEPT_ADMIN && assignment.department_id === user.department_id) {
    return assignment;
  }

  if (user.role === ROLES.WORKER && assignment.worker_user_id === user.id) {
    return assignment;
  }

  return null;
}

function normalizeLocalCallNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits || digits.length > 3) return "";
  return digits.padStart(3, "0").slice(-3);
}

async function findDepartmentAdminForWorker(worker) {
  const result = await pool.query(
    `SELECT id, name
     FROM users
     WHERE department_id = $1
       AND role = 'DEPT_ADMIN'
       AND is_active = TRUE
     ORDER BY created_at ASC
     LIMIT 1`,
    [worker.department_id]
  );

  return result.rows[0] || null;
}

async function upsertDirectConversationRecord({ departmentId, adminUserId, workerUserId, localCallNumber }) {
  const existing = await pool.query(
    `SELECT cc.*,
            NULL::text AS complaint_title,
            admin_user.name AS admin_name,
            worker_user.name AS worker_name,
            wp.local_call_number
     FROM communication_conversations cc
     JOIN users admin_user ON admin_user.id = cc.admin_user_id
     JOIN users worker_user ON worker_user.id = cc.worker_user_id
     JOIN worker_profiles wp ON wp.user_id = cc.worker_user_id
     WHERE cc.department_id = $1
       AND cc.admin_user_id = $2
       AND cc.worker_user_id = $3
       AND cc.conversation_type = 'DIRECT'
     LIMIT 1`,
    [departmentId, adminUserId, workerUserId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await pool.query(
    `INSERT INTO communication_conversations (
       department_id,
       complaint_id,
       assignment_id,
       admin_user_id,
       worker_user_id,
       conversation_type,
       local_call_number
     )
     VALUES ($1, NULL, NULL, $2, $3, 'DIRECT', $4)
     RETURNING *`,
    [departmentId, adminUserId, workerUserId, localCallNumber]
  );

  const hydrated = await pool.query(
    `SELECT cc.*,
            NULL::text AS complaint_title,
            admin_user.name AS admin_name,
            worker_user.name AS worker_name,
            wp.local_call_number
     FROM communication_conversations cc
     JOIN users admin_user ON admin_user.id = cc.admin_user_id
     JOIN users worker_user ON worker_user.id = cc.worker_user_id
     JOIN worker_profiles wp ON wp.user_id = cc.worker_user_id
     WHERE cc.id = $1`,
    [created.rows[0].id]
  );

  return hydrated.rows[0];
}

exports.upsertConversation = async (req, res) => {
  const { assignment_id, complaint_id } = req.body || {};

  if (!assignment_id && !complaint_id) {
    return failure(res, "assignment_id or complaint_id is required", 400);
  }

  try {
    const assignment = await findAssignmentForUser({
      assignmentId: assignment_id,
      complaintId: complaint_id,
      user: req.user,
    });

    if (!assignment) {
      return failure(res, "Assignment not found or access denied", 404);
    }

    const adminUserId = req.user.role === ROLES.WORKER
      ? assignment.assigned_by_user_id
      : req.user.id;

    const result = await pool.query(
      `INSERT INTO communication_conversations (
         department_id,
         complaint_id,
         assignment_id,
         admin_user_id,
         worker_user_id
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (assignment_id)
       DO UPDATE SET assignment_id = EXCLUDED.assignment_id
       RETURNING *`,
      [
        assignment.department_id,
        assignment.complaint_id,
        assignment.assignment_id,
        adminUserId,
        assignment.worker_user_id,
      ]
    );

    const conversation = {
      ...result.rows[0],
      complaint_title: assignment.complaint_title,
      worker_name: assignment.worker_name,
    };

    if (!canAccessConversation(req.user, conversation)) {
      return failure(res, "Access denied", 403);
    }

    return success(res, conversation, 200, "Conversation ready");
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.upsertDirectConversation = async (req, res) => {
  try {
    let worker = null;
    let adminUserId = null;

    if (req.user.role === ROLES.DEPT_ADMIN) {
      const localCallNumber = normalizeLocalCallNumber(req.body?.local_call_number);
      if (!localCallNumber) {
        return failure(res, "local_call_number must be exactly 3 digits, for example 001", 400);
      }

      const workerResult = await pool.query(
        `SELECT u.id AS worker_user_id,
                u.name AS worker_name,
                u.department_id,
                wp.local_call_number
         FROM users u
         JOIN worker_profiles wp ON wp.user_id = u.id
         WHERE u.role = 'WORKER'
           AND u.is_active = TRUE
           AND u.department_id = $1
           AND wp.local_call_number = $2
         LIMIT 1`,
        [req.user.department_id, localCallNumber]
      );

      worker = workerResult.rows[0] || null;
      adminUserId = req.user.id;
    } else if (req.user.role === ROLES.WORKER) {
      const workerResult = await pool.query(
        `SELECT u.id AS worker_user_id,
                u.name AS worker_name,
                u.department_id,
                wp.local_call_number
         FROM users u
         JOIN worker_profiles wp ON wp.user_id = u.id
         WHERE u.id = $1
           AND u.role = 'WORKER'
           AND u.is_active = TRUE
         LIMIT 1`,
        [req.user.id]
      );

      worker = workerResult.rows[0] || null;
      const admin = worker ? await findDepartmentAdminForWorker(worker) : null;
      if (!admin) {
        return failure(res, "Department admin not found for this worker", 404);
      }
      adminUserId = admin.id;
    } else {
      return failure(res, "Direct local-number conversations are available to department admins and workers only", 403);
    }

    if (!worker) {
      return failure(res, "Worker local call number not found", 404);
    }

    const conversation = await upsertDirectConversationRecord({
      departmentId: worker.department_id,
      adminUserId,
      workerUserId: worker.worker_user_id,
      localCallNumber: worker.local_call_number,
    });

    if (!canAccessConversation(req.user, conversation)) {
      return failure(res, "Access denied", 403);
    }

    return success(res, conversation, 200, "Direct conversation ready");
  } catch (err) {
    if (err?.code === "23505") {
      return failure(res, "Direct conversation already exists. Please try opening it again.", 409);
    }
    return failure(res, err.message);
  }
};

exports.listConversations = async (req, res) => {
  try {
    const params = [];
    let whereClause = "";

    if (req.user.role === ROLES.DEPT_ADMIN) {
      params.push(req.user.department_id);
      whereClause = "WHERE cc.department_id = $1";
    } else if (req.user.role === ROLES.WORKER) {
      params.push(req.user.id);
      whereClause = "WHERE cc.worker_user_id = $1";
    } else if (req.user.role !== ROLES.SYSTEM_ADMIN) {
      return failure(res, "Access denied", 403);
    }

    const result = await pool.query(
      `SELECT cc.*,
              c.title AS complaint_title,
              admin_user.name AS admin_name,
              worker_user.name AS worker_name,
              wp.local_call_number
       FROM communication_conversations cc
       LEFT JOIN complaints c ON c.id = cc.complaint_id
       JOIN users admin_user ON admin_user.id = cc.admin_user_id
       JOIN users worker_user ON worker_user.id = cc.worker_user_id
       JOIN worker_profiles wp ON wp.user_id = cc.worker_user_id
       ${whereClause}
       ORDER BY COALESCE(cc.last_message_time, cc.created_at) DESC`,
      params
    );

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};
