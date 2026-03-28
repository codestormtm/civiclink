const { pool } = require("../config/db");
const { sendNotification } = require("../utils/notificationService");
const { success, failure } = require("../utils/response");
const { logComplaintStatusChange } = require("../utils/complaintHistory");

exports.assignTask = async (req, res) => {
  const { complaint_id, worker_user_id } = req.body;

  if (!complaint_id || !worker_user_id) {
    return failure(res, "complaint_id and worker_user_id are required", 400);
  }

  const client = await pool.connect();

  try {
    const complaintResult = await client.query(
      `SELECT id, department_id, status
       FROM complaints
       WHERE id = $1`,
      [complaint_id]
    );

    if (complaintResult.rows.length === 0) {
      return failure(res, "Complaint not found", 404);
    }

    const complaint = complaintResult.rows[0];

    if (
      req.user.role === "DEPT_ADMIN" &&
      complaint.department_id !== req.user.department_id
    ) {
      return failure(res, "You can only assign complaints in your department", 403);
    }

    if (["RESOLVED", "CLOSED", "REJECTED_WRONG_DEPARTMENT"].includes(complaint.status)) {
      return failure(res, "Closed complaints cannot be assigned", 400);
    }

    const workerResult = await client.query(
      `SELECT u.id, u.name, u.department_id
       FROM users u
       JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1
         AND u.role = 'WORKER'
         AND u.is_active = TRUE
         AND wp.employment_status = 'ACTIVE'`,
      [worker_user_id]
    );

    if (workerResult.rows.length === 0) {
      return failure(res, "Worker not found", 404);
    }

    const worker = workerResult.rows[0];

    if (worker.department_id !== complaint.department_id) {
      return failure(res, "Worker and complaint must belong to the same department", 400);
    }

    if (
      req.user.role === "DEPT_ADMIN" &&
      worker.department_id !== req.user.department_id
    ) {
      return failure(res, "You can only assign workers in your department", 403);
    }

    await client.query("BEGIN");

    // If there's an existing active assignment, close it before reassigning
    await client.query(
      `UPDATE complaint_assignments
       SET status = 'REASSIGNED', updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $1 AND status IN ('ASSIGNED', 'IN_PROGRESS')`,
      [complaint_id]
    );

    const result = await client.query(
      `INSERT INTO complaint_assignments (
         complaint_id, worker_user_id, department_id, assigned_by_user_id
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [complaint_id, worker_user_id, complaint.department_id, req.user.id]
    );

    await client.query(
      `UPDATE complaints
       SET status = 'ASSIGNED'
       WHERE id = $1`,
      [complaint_id]
    );

    await client.query("COMMIT");

    await logComplaintStatusChange({
      complaintId: complaint_id,
      oldStatus: complaint.status,
      newStatus: "ASSIGNED",
      changedBy: req.user.id,
      note: `Assigned to worker ${worker.name}`,
    });

    const io = req.app.get("io");
    io.emit("task_assigned", { ...result.rows[0], worker_name: worker.name });

    sendNotification("Task assigned to worker");

    return success(res, { ...result.rows[0], worker_name: worker.name }, 201);
  } catch (err) {
    await client.query("ROLLBACK");
    return failure(res, err.message);
  } finally {
    client.release();
  }
};

exports.getMyTasks = async (req, res) => {
  const workerId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT ca.id,
              ca.complaint_id,
              ca.worker_user_id,
              ca.department_id,
              ca.status,
              ca.field_notes,
              ca.assigned_at,
              ca.updated_at,
              c.title,
              c.description,
              c.status AS complaint_status,
              d.name AS department_name,
              dit.name AS issue_type_name
       FROM complaint_assignments ca
       JOIN complaints c ON c.id = ca.complaint_id
       JOIN departments d ON d.id = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       WHERE ca.worker_user_id = $1
         AND ca.department_id = $2
       ORDER BY ca.assigned_at DESC`,
      [workerId, req.user.department_id]
    );

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, field_notes } = req.body;

  if (!["ASSIGNED", "IN_PROGRESS", "COMPLETED", "REJECTED"].includes(status)) {
    return failure(res, "Invalid assignment status", 400);
  }

  const client = await pool.connect();

  try {
    const assignmentCheck = await client.query(
      `SELECT ca.id, ca.complaint_id, c.status AS complaint_status
       FROM complaint_assignments ca
       JOIN complaints c ON c.id = ca.complaint_id
       WHERE ca.id = $1 AND ca.worker_user_id = $2`,
      [id, req.user.id]
    );

    if (assignmentCheck.rows.length === 0) {
      return failure(res, "Assignment not found", 404);
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE complaint_assignments
       SET status = $1, field_notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, field_notes || null, id]
    );

    const complaintStatus =
      status === "COMPLETED"
        ? "RESOLVED"
        : status === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : "ASSIGNED";

    const complaintsQuery = complaintStatus === 'RESOLVED'
      ? `UPDATE complaints SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2`
      : `UPDATE complaints SET status = $1 WHERE id = $2`;
    await client.query(complaintsQuery, [complaintStatus, result.rows[0].complaint_id]);

    await client.query("COMMIT");

    await logComplaintStatusChange({
      complaintId: result.rows[0].complaint_id,
      oldStatus: assignmentCheck.rows[0].complaint_status || null,
      newStatus: complaintStatus,
      changedBy: req.user.id,
      note: field_notes || null,
    });

    const io = req.app.get("io");
    io.emit("status_updated", result.rows[0]);

    sendNotification(`Task status updated to ${status}`);

    return success(res, result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    return failure(res, err.message);
  } finally {
    client.release();
  }
};
