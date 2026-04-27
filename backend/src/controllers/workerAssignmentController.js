// workerAssignmentController.js
// Handles worker-facing task views, status updates, and evidence uploads.
//
// Fixes applied:
//  - Correct destructured import of pool from config/db
//  - Correct destructured import of bucketName (not BUCKET) from config/minio
//  - Complaint location fields are included from the complaints table
//  - Fixed column: dit.type_name → dit.name
//  - Fixed join column: c.complaint_type_id → c.issue_type_id
//  - Fixed column: ca.note → ca.field_notes
//  - Fixed status: "RESOLVED" is invalid for complaint_assignments (constraint allows
//    ASSIGNED/IN_PROGRESS/COMPLETED/REJECTED). "RESOLVED" from frontend now maps to
//    assignment="COMPLETED", complaint="RESOLVED".
//  - Added missing uploaded_by_user_id (NOT NULL) to complaint_attachments insert
//  - Wrapped status update in a transaction for consistency

const { pool } = require("../config/db");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const { logComplaintStatusChange } = require("../utils/complaintHistory");
const {
  buildStoredObjectReference,
  mapAttachmentForResponse,
  mapAttachmentsForResponse,
  resolveAttachmentRole,
} = require("../utils/attachmentStorage");
const { getRequestOrigin } = require("../utils/requestOrigin");
const { notifyCitizenComplaintStatus } = require("../utils/notificationService");
const { ROOM_ADMINS, userRoom } = require("../utils/socketRooms");

// GET /api/worker/assignments
exports.getMyAssignments = async (req, res) => {
  const workerUserId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT
         ca.id,
         ca.complaint_id,
         ca.worker_user_id,
         ca.assigned_at,
         ca.status         AS assignment_status,
         c.title,
         c.description,
         c.latitude,
         c.longitude,
         c.address_text,
         c.location_source,
         c.status          AS complaint_status,
         c.created_at,
         d.name            AS department_name,
         dit.name          AS complaint_type
       FROM complaint_assignments ca
       JOIN complaints c            ON c.id   = ca.complaint_id
       JOIN departments d           ON d.id   = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       WHERE ca.worker_user_id = $1
       ORDER BY ca.assigned_at DESC`,
      [workerUserId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/worker/assignments/:id
exports.getMyAssignmentById = async (req, res) => {
  const workerUserId = req.user.id;
  const { id } = req.params;

  try {
    const assignmentResult = await pool.query(
      `SELECT
         ca.id,
         ca.complaint_id,
         ca.worker_user_id,
         ca.assigned_at,
         ca.status           AS assignment_status,
         ca.field_notes      AS assignment_note,
         c.title,
         c.description,
         c.latitude,
         c.longitude,
         c.address_text,
         c.location_source,
         c.status            AS complaint_status,
         c.created_at,
         d.name              AS department_name,
         dit.name            AS complaint_type
       FROM complaint_assignments ca
       JOIN complaints c            ON c.id   = ca.complaint_id
       JOIN departments d           ON d.id   = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       WHERE ca.id = $1 AND ca.worker_user_id = $2`,
      [id, workerUserId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const complaintId = assignmentResult.rows[0].complaint_id;

    const attachmentsResult = await pool.query(
      `SELECT id, file_url, file_type, attachment_role, created_at
       FROM complaint_attachments
       WHERE complaint_id = $1
       ORDER BY created_at DESC`,
      [complaintId]
    );

    const historyResult = await pool.query(
      `SELECT
         l.id,
         l.old_status,
         l.new_status,
         l.note,
         l.created_at,
         u.name AS changed_by_name
       FROM complaint_status_logs l
       LEFT JOIN users u ON u.id = l.changed_by
       WHERE l.complaint_id = $1
       ORDER BY l.created_at ASC`,
      [complaintId]
    );

    const attachments = mapAttachmentsForResponse(attachmentsResult.rows, {
      baseUrl: getRequestOrigin(req),
      access: "protected",
    });

    return res.json({
      success: true,
      data: {
        assignment: assignmentResult.rows[0],
        attachments,
        history: historyResult.rows,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/worker/assignments/:id/status
// Frontend sends status: "IN_PROGRESS" | "RESOLVED"
// "IN_PROGRESS" → assignment.status = "IN_PROGRESS", complaint.status = "IN_PROGRESS"
// "RESOLVED"    → assignment.status = "COMPLETED",   complaint.status = "RESOLVED"
exports.updateMyAssignmentStatus = async (req, res) => {
  const workerUserId = req.user.id;
  const { id } = req.params;
  const { status, note } = req.body;

  const allowedFromFrontend = ["IN_PROGRESS", "RESOLVED"];
  if (!allowedFromFrontend.includes(status)) {
    return res.status(400).json({ error: "Invalid status. Allowed: IN_PROGRESS, RESOLVED" });
  }

  // Map to DB-valid values
  const assignmentStatus = status === "RESOLVED" ? "COMPLETED" : "IN_PROGRESS";
  const complaintStatus  = status; // "IN_PROGRESS" or "RESOLVED" — both valid for complaints

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const assignmentResult = await client.query(
      `SELECT ca.id,
              ca.complaint_id,
              ca.status AS assignment_status,
              c.status AS complaint_status,
              c.reporter_user_id,
              c.title
       FROM complaint_assignments ca
       JOIN complaints c ON c.id = ca.complaint_id
       WHERE ca.id = $1 AND ca.worker_user_id = $2`,
      [id, workerUserId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const assignment = assignmentResult.rows[0];
    const oldComplaintStatus = assignment.complaint_status;

    if (status === "IN_PROGRESS" && oldComplaintStatus !== "ASSIGNED") {
      return res.status(400).json({ error: "Only ASSIGNED complaints can move to IN_PROGRESS" });
    }
    if (status === "RESOLVED" && oldComplaintStatus !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Only IN_PROGRESS complaints can be resolved" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    await client.query(
      `UPDATE complaint_assignments
       SET status = $1, field_notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [assignmentStatus, note || null, id]
    );

    const complaintsQuery = complaintStatus === 'RESOLVED'
      ? `UPDATE complaints SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2`
      : `UPDATE complaints SET status = $1 WHERE id = $2`;
    await client.query(complaintsQuery, [complaintStatus, assignment.complaint_id]);

    await client.query("COMMIT");
    transactionStarted = false;

    await logComplaintStatusChange({
      complaintId: assignment.complaint_id,
      oldStatus: oldComplaintStatus,
      newStatus: complaintStatus,
      changedBy: workerUserId,
      note: note || `Worker updated status to ${complaintStatus}`,
    });

    const io = req.app.get("io");
    if (io) {
      const eventPayload = {
        assignment_id: assignment.id,
        complaint_id: assignment.complaint_id,
        worker_user_id: workerUserId,
        assignment_status: assignmentStatus,
        complaint_status: complaintStatus,
      };
      io.to(ROOM_ADMINS).emit("status_updated", eventPayload);
      io.to(userRoom(workerUserId)).emit("status_updated", eventPayload);
    }

    await notifyCitizenComplaintStatus({
      citizenUserId: assignment.reporter_user_id,
      complaintId: assignment.complaint_id,
      status: complaintStatus,
      title: assignment.title,
    });

    return res.json({
      success: true,
      data: { assignment_status: assignmentStatus, complaint_status: complaintStatus },
    });
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// POST /api/worker/assignments/:id/attachments
exports.uploadAssignmentAttachment = async (req, res) => {
  const workerUserId = req.user.id;
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const assignmentResult = await pool.query(
      `SELECT ca.id, ca.complaint_id
       FROM complaint_assignments ca
       WHERE ca.id = $1 AND ca.worker_user_id = $2`,
      [id, workerUserId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const complaintId = assignmentResult.rows[0].complaint_id;
    const fileName = `worker-evidence-${complaintId}-${Date.now()}-${file.originalname}`;

    await minioClient.putObject(BUCKET, fileName, file.buffer, file.size, {
      "Content-Type": file.mimetype,
    });

    const fileUrl = buildStoredObjectReference(fileName);
    const attachmentRole = resolveAttachmentRole({
      requestedRole: req.body?.attachment_role,
      fileType: file.mimetype,
      defaultImageRole: "AFTER",
    });

    const insertResult = await pool.query(
      `INSERT INTO complaint_attachments (
         complaint_id,
         file_url,
         file_type,
         uploaded_by_user_id,
         attachment_role
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [complaintId, fileUrl, file.mimetype, workerUserId, attachmentRole]
    );

    const attachment = mapAttachmentForResponse(insertResult.rows[0], {
      baseUrl: getRequestOrigin(req),
      access: "protected",
    });

    return res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
