const { pool } = require("../config/db");
const { sendNotification } = require("../utils/notificationService");
const { success, failure } = require("../utils/response");
const { logComplaintStatusChange } = require("../utils/complaintHistory");
const { ROOM_ADMINS } = require("../utils/socketRooms");

const COMPLAINT_STATUSES = new Set([
  "SUBMITTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED_WRONG_DEPARTMENT",
  "CLOSED",
]);

const SLA_HOURS = { CRITICAL: 12, HIGH: 24, MEDIUM: 72, LOW: 168 };

const complaintSelect = `
  SELECT c.id,
         c.department_id,
         c.issue_type_id,
         c.reporter_user_id,
         c.title,
         c.description,
         c.latitude,
         c.longitude,
         c.address_text,
         c.location_source,
         c.status,
         c.priority_level,
         c.sla_due_at,
         CASE
           WHEN c.sla_due_at < NOW()
             AND c.status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')
           THEN true ELSE false
         END AS sla_breached,
         c.rejection_reason,
         c.submitted_at,
         c.resolved_at,
         c.created_at,
         c.updated_at,
         d.name AS department_name,
         d.code AS department_code,
         dit.name AS issue_type_name,
         reporter.name AS reporter_name,
         latest_assignment.worker_user_id AS assigned_worker_id,
         assignee.name AS assigned_worker_name,
         latest_assignment.status AS assignment_status
  FROM complaints c
  JOIN departments d ON d.id = c.department_id
  JOIN department_issue_types dit ON dit.id = c.issue_type_id
  JOIN users reporter ON reporter.id = c.reporter_user_id
  LEFT JOIN LATERAL (
    SELECT ca.worker_user_id, ca.status, ca.assigned_at
    FROM complaint_assignments ca
    WHERE ca.complaint_id = c.id
    ORDER BY ca.assigned_at DESC
    LIMIT 1
  ) latest_assignment ON TRUE
  LEFT JOIN users assignee ON assignee.id = latest_assignment.worker_user_id
`;

exports.createIssue = async (req, res) => {
  if (!req.body) {
    return failure(res, "Request body is missing. Set Content-Type: application/json", 400);
  }

  const {
    department_id,
    issue_type_id,
    title,
    description,
    latitude,
    longitude,
    address_text,
    location_source,
    priority_level = "MEDIUM",
  } = req.body;
  const userId = req.user.id;

  if (!department_id || !issue_type_id || !title || !description) {
    return failure(res, "department_id, issue_type_id, title, and description are required", 400);
  }

  const slaHours = SLA_HOURS[priority_level] || SLA_HOURS.MEDIUM;

  try {
    const issueTypeResult = await pool.query(
      `SELECT id
       FROM department_issue_types
       WHERE id = $1 AND department_id = $2 AND is_active = TRUE`,
      [issue_type_id, department_id]
    );

    if (issueTypeResult.rows.length === 0) {
      return failure(res, "Selected complaint type does not belong to the selected department", 400);
    }

    const insertResult = await pool.query(
      `INSERT INTO complaints (
         department_id,
         issue_type_id,
         reporter_user_id,
         title,
         description,
         latitude,
         longitude,
         address_text,
         location_source,
         priority_level,
         sla_due_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + ($11 || ' hours')::INTERVAL)
       RETURNING id`,
      [
        department_id,
        issue_type_id,
        userId,
        title,
        description,
        latitude,
        longitude,
        address_text,
        location_source,
        priority_level,
        slaHours,
      ]
    );

    const result = await pool.query(
      `${complaintSelect}
       WHERE c.id = $1`,
      [insertResult.rows[0].id]
    );

    const io = req.app.get("io");
    io.to(ROOM_ADMINS).emit("new_issue", result.rows[0]);

    sendNotification("New issue created");

    return success(res, result.rows[0], 201);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getIssues = async (req, res) => {
  const user = req.user;

  try {
    let query = complaintSelect;
    let params = [];

    if (user.role === "SYSTEM_ADMIN") {
      query += ` ORDER BY c.created_at DESC`;
    } else if (user.role === "DEPT_ADMIN") {
      query += ` WHERE c.department_id = $1 ORDER BY c.created_at DESC`;
      params.push(user.department_id);
    } else if (user.role === "WORKER" && req.query.scope === "assigned") {
      query += `
        JOIN complaint_assignments scoped_assignment
          ON scoped_assignment.complaint_id = c.id
         AND scoped_assignment.worker_user_id = $1
        WHERE c.department_id = $2
        ORDER BY c.created_at DESC`;
      params.push(user.id, user.department_id);
    } else if (user.role === "WORKER") {
      query += ` WHERE c.department_id = $1 ORDER BY c.created_at DESC`;
      params.push(user.department_id);
    } else {
      query += ` WHERE c.reporter_user_id = $1 ORDER BY c.created_at DESC`;
      params.push(user.id);
    }

    const result = await pool.query(query, params);

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getMapPoints = async (req, res) => {
  const user = req.user;

  try {
    let query = `
      SELECT c.id, c.title, c.status, c.latitude, c.longitude, c.address_text, c.created_at,
             d.name AS department_name, dit.name AS issue_type_name
      FROM complaints c
      JOIN departments d ON d.id = c.department_id
      JOIN department_issue_types dit ON dit.id = c.issue_type_id
      WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    `;
    const params = [];

    if (user.role === "DEPT_ADMIN") {
      params.push(user.department_id);
      query += ` AND c.department_id = $${params.length}`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  if (!COMPLAINT_STATUSES.has(status)) {
    return failure(res, "Invalid complaint status", 400);
  }

  if (status === "REJECTED_WRONG_DEPARTMENT" && !rejection_reason) {
    return failure(res, "rejection_reason is required when rejecting a wrong department complaint", 400);
  }

  try {
    const accessResult = await pool.query(
      `SELECT id, department_id, status AS current_status
       FROM complaints
       WHERE id = $1`,
      [id]
    );

    if (accessResult.rows.length === 0) {
      return failure(res, "Complaint not found", 404);
    }

    const complaint = accessResult.rows[0];

    if (
      req.user.role === "DEPT_ADMIN" &&
      complaint.department_id !== req.user.department_id
    ) {
      return failure(res, "You can only update complaints in your department", 403);
    }

    const setRejectionReason = status === 'REJECTED_WRONG_DEPARTMENT' ? rejection_reason || null : null;
    const setResolvedAt = ['RESOLVED', 'CLOSED'].includes(status);
    const updateQuery = setResolvedAt
      ? `UPDATE complaints SET status = $1, rejection_reason = COALESCE($2, rejection_reason), resolved_at = CURRENT_TIMESTAMP WHERE id = $3`
      : `UPDATE complaints SET status = $1, rejection_reason = COALESCE($2, rejection_reason) WHERE id = $3`;
    await pool.query(updateQuery, [status, setRejectionReason, id]);

    await logComplaintStatusChange({
      complaintId: id,
      oldStatus: complaint.current_status,
      newStatus: status,
      changedBy: req.user.id,
      note: rejection_reason || null,
    });

    const enrichedResult = await pool.query(
      `${complaintSelect}
       WHERE c.id = $1`,
      [id]
    );

    const io = req.app.get("io");
    io.to(ROOM_ADMINS).emit("status_updated", enrichedResult.rows[0]);

    sendNotification(`Issue status updated to ${status}`);

    return success(res, enrichedResult.rows[0]);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.updatePriority = async (req, res) => {
  const { id } = req.params;
  const { priority_level } = req.body;

  if (!SLA_HOURS[priority_level]) {
    return failure(res, "Invalid priority_level. Must be CRITICAL, HIGH, MEDIUM, or LOW", 400);
  }

  try {
    const result = await pool.query(
      `SELECT id, department_id FROM complaints WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return failure(res, "Complaint not found", 404);
    }

    if (
      req.user.role === "DEPT_ADMIN" &&
      result.rows[0].department_id !== req.user.department_id
    ) {
      return failure(res, "Access denied", 403);
    }

    await pool.query(
      `UPDATE complaints
       SET priority_level = $1,
           sla_due_at     = submitted_at + ($2 || ' hours')::INTERVAL
       WHERE id = $3`,
      [priority_level, SLA_HOURS[priority_level], id]
    );

    return success(res, { priority_level });
  } catch (err) {
    return failure(res, err.message);
  }
};
