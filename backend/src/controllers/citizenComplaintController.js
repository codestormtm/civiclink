const { pool } = require("../config/db");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const { logComplaintStatusChange } = require("../utils/complaintHistory");
const {
  buildStoredObjectReference,
  mapAttachmentForResponse,
  mapAttachmentsForResponse,
} = require("../utils/attachmentStorage");

// GET /citizen-complaints/departments
exports.getDepartments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, contact_email
       FROM departments
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /citizen-complaints/departments/:departmentId/types
exports.getDepartmentComplaintTypes = async (req, res) => {
  const { departmentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, description
       FROM department_issue_types
       WHERE department_id = $1 AND is_active = TRUE
       ORDER BY name ASC`,
      [departmentId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /citizen-complaints
exports.createComplaint = async (req, res) => {
  const reporterUserId = req.user.id;
  const {
    department_id,
    issue_type_id,
    title,
    description,
    latitude,
    longitude,
    address_text,
    location_source,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO complaints (
         department_id,
         issue_type_id,
         reporter_user_id,
         title,
         description,
         latitude,
         longitude,
         address_text,
         location_source
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        department_id,
        issue_type_id,
        reporterUserId,
        title,
        description,
        latitude,
        longitude,
        address_text,
        location_source,
      ]
    );

    await logComplaintStatusChange({
      complaintId: result.rows[0].id,
      oldStatus: null,
      newStatus: "SUBMITTED",
      changedBy: reporterUserId,
      note: "Complaint submitted by citizen",
    });

    res.status(201).json({
      success: true,
      message: "Complaint created successfully",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /citizen-complaints/:complaintId/attachments
exports.uploadComplaintAttachment = async (req, res) => {
  const { complaintId } = req.params;
  const file = req.file;
  const userId = req.user.id;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const complaintCheck = await pool.query(
      `SELECT id FROM complaints WHERE id = $1 AND reporter_user_id = $2`,
      [complaintId, userId]
    );

    if (complaintCheck.rows.length === 0) {
      return res.status(403).json({ error: "You cannot upload files to this complaint" });
    }

    const fileName = `complaint-${complaintId}-${Date.now()}-${file.originalname}`;

    await minioClient.putObject(BUCKET, fileName, file.buffer, file.size, {
      "Content-Type": file.mimetype,
    });

    const fileUrl = buildStoredObjectReference(fileName);

    const result = await pool.query(
      `INSERT INTO complaint_attachments (complaint_id, file_url, file_type, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [complaintId, fileUrl, file.mimetype, userId]
    );

    const attachment = await mapAttachmentForResponse(result.rows[0]);

    res.status(201).json({
      success: true,
      message: "Attachment uploaded successfully",
      data: attachment,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /citizen-complaints/track/:complaintId
exports.trackComplaintByReference = async (req, res) => {
  const { complaintId: referenceNo } = req.params;
  const citizenId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.title,
         c.description,
         c.latitude,
         c.longitude,
         c.address_text,
         c.location_source,
         c.status,
         c.rejection_reason,
         c.submitted_at,
         c.resolved_at,
         c.updated_at,
         d.name AS department_name,
         dit.name AS complaint_type
       FROM complaints c
       JOIN departments d ON d.id = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       WHERE c.id = $1 AND c.reporter_user_id = $2`,
      [referenceNo, citizenId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const complaint = result.rows[0];

    const attachments = await pool.query(
      `SELECT id, file_url, file_type, created_at
       FROM complaint_attachments
       WHERE complaint_id = $1
       ORDER BY created_at DESC`,
      [complaint.id]
    );

    const assignments = await pool.query(
      `SELECT ca.status, ca.assigned_at, ca.updated_at, u.name AS worker_name
       FROM complaint_assignments ca
       JOIN users u ON u.id = ca.worker_user_id
       WHERE ca.complaint_id = $1
       ORDER BY ca.assigned_at ASC`,
      [complaint.id]
    );

    // Build timeline from available timestamps
    const timeline = [];

    timeline.push({
      event: "Complaint Submitted",
      description: "Your complaint has been received and is awaiting review.",
      timestamp: complaint.submitted_at,
    });

    for (const a of assignments.rows) {
      timeline.push({
        event: "Assigned to Worker",
        description: `Your complaint was assigned to a field worker.`,
        timestamp: a.assigned_at,
      });

      if (["IN_PROGRESS", "COMPLETED"].includes(a.status)) {
        timeline.push({
          event: "Work In Progress",
          description: "A worker has started working on your complaint.",
          timestamp: a.updated_at,
        });
      }
    }

    if (complaint.resolved_at) {
      timeline.push({
        event: "Resolved",
        description: "Your complaint has been resolved.",
        timestamp: complaint.resolved_at,
      });
    }

    if (complaint.status === "REJECTED_WRONG_DEPARTMENT") {
      timeline.push({
        event: "Rejected — Wrong Department",
        description: complaint.rejection_reason || "Complaint was redirected.",
        timestamp: complaint.updated_at,
      });
    }

    const signedAttachments = await mapAttachmentsForResponse(attachments.rows);

    res.json({
      success: true,
      data: {
        complaint,
        attachments: signedAttachments,
        timeline,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
