const { pool } = require("../config/db");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const { sendNotification } = require("../utils/notificationService");
const { success, failure } = require("../utils/response");
const {
  buildStoredObjectReference,
  extractObjectName,
  isImageMimeType,
  mapAttachmentForResponse,
  resolveAttachmentRole,
} = require("../utils/attachmentStorage");
const { getRequestOrigin } = require("../utils/requestOrigin");

async function loadAttachmentRecord(attachmentId, workerUserId = null) {
  const result = await pool.query(
    `SELECT
       a.id,
       a.complaint_id,
       a.file_url,
       a.file_type,
       a.attachment_role,
       a.created_at,
       a.uploaded_by_user_id,
       c.department_id,
       c.reporter_user_id,
       c.status AS complaint_status,
       EXISTS (
         SELECT 1
         FROM complaint_assignments ca
         WHERE ca.complaint_id = c.id
           AND ca.worker_user_id = $2
           AND ca.status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')
       ) AS worker_has_access
     FROM complaint_attachments a
     JOIN complaints c ON c.id = a.complaint_id
     WHERE a.id = $1`,
    [attachmentId, workerUserId]
  );

  return result.rows[0] || null;
}

function canViewProtectedAttachment(user, attachment) {
  if (!user || !attachment) {
    return false;
  }

  if (user.role === "SYSTEM_ADMIN") {
    return true;
  }

  if (user.role === "CITIZEN") {
    return attachment.reporter_user_id === user.id;
  }

  if (user.role === "DEPT_ADMIN") {
    return attachment.department_id === user.department_id;
  }

  if (user.role === "WORKER") {
    return Boolean(attachment.worker_has_access);
  }

  return false;
}

async function streamAttachmentObject(res, attachment, cacheControl = "private, no-store") {
  const objectName = extractObjectName(attachment.file_url);

  if (!objectName) {
    return failure(res, "Attachment object key is missing", 404);
  }

  try {
    const objectStream = await minioClient.getObject(BUCKET, objectName);

    res.setHeader("Content-Type", attachment.file_type || "application/octet-stream");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", cacheControl);

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
    return failure(res, err.message || "Failed to load attachment", 404);
  }
}

exports.uploadMedia = async (req, res) => {
  const { complaint_id } = req.body;
  const file = req.file;

  if (!file) {
    return failure(res, "No file uploaded", 400);
  }

  if (!complaint_id) {
    return failure(res, "complaint_id is required", 400);
  }

  const fileName = `${Date.now()}-${file.originalname}`;

  try {
    const complaintResult = await pool.query(
      `SELECT id, department_id, reporter_user_id
       FROM complaints
       WHERE id = $1`,
      [complaint_id]
    );

    if (complaintResult.rows.length === 0) {
      return failure(res, "Complaint not found", 404);
    }

    const complaint = complaintResult.rows[0];

    if (
      req.user.role === "CITIZEN" &&
      complaint.reporter_user_id !== req.user.id
    ) {
      return failure(res, "You can only upload files to your own complaints", 403);
    }

    if (
      ["DEPT_ADMIN", "WORKER"].includes(req.user.role) &&
      complaint.department_id !== req.user.department_id
    ) {
      return failure(res, "You can only upload files inside your department", 403);
    }

    await minioClient.putObject(
      BUCKET,
      fileName,
      file.buffer,
      file.size,
      {
        "Content-Type": file.mimetype,
      }
    );

    const fileUrl = buildStoredObjectReference(fileName);
    const attachmentRole = resolveAttachmentRole({
      requestedRole: req.body?.attachment_role,
      fileType: file.mimetype,
      defaultImageRole: req.user.role === "CITIZEN" ? "BEFORE" : "GENERAL",
    });

    const result = await pool.query(
      `INSERT INTO complaint_attachments (
         complaint_id,
         file_url,
         file_type,
         uploaded_by_user_id,
         attachment_role
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [complaint_id, fileUrl, file.mimetype, req.user.id, attachmentRole]
    );

    sendNotification("Media uploaded for issue");

    const attachment = mapAttachmentForResponse(result.rows[0], {
      baseUrl: getRequestOrigin(req),
      access: "protected",
    });

    return success(res, attachment, 201);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.viewAttachment = async (req, res) => {
  try {
    const attachment = await loadAttachmentRecord(req.params.attachmentId, req.user?.id);

    if (!attachment) {
      return failure(res, "Attachment not found", 404);
    }

    if (!canViewProtectedAttachment(req.user, attachment)) {
      return failure(res, "Access denied", 403);
    }

    return streamAttachmentObject(res, attachment);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.viewPublicAttachment = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.file_url,
         a.file_type,
         a.attachment_role,
         c.status AS complaint_status,
         EXISTS (
           SELECT 1
           FROM complaint_attachments a_before
           WHERE a_before.complaint_id = c.id
             AND a_before.attachment_role = 'BEFORE'
             AND a_before.file_type ILIKE 'image/%'
         ) AS has_before_image,
         EXISTS (
           SELECT 1
           FROM complaint_attachments a_after
           WHERE a_after.complaint_id = c.id
             AND a_after.attachment_role = 'AFTER'
             AND a_after.file_type ILIKE 'image/%'
         ) AS has_after_image
       FROM complaint_attachments a
       JOIN complaints c ON c.id = a.complaint_id
       WHERE a.id = $1`,
      [req.params.attachmentId]
    );

    const attachment = result.rows[0];

    if (!attachment) {
      return failure(res, "Attachment not found", 404);
    }

    if (
      attachment.complaint_status !== "RESOLVED"
      || !attachment.has_before_image
      || !attachment.has_after_image
      || !isImageMimeType(attachment.file_type)
      || !["BEFORE", "AFTER"].includes(attachment.attachment_role)
    ) {
      return failure(res, "Attachment is not publicly available", 403);
    }

    return streamAttachmentObject(res, attachment, "public, max-age=300");
  } catch (err) {
    return failure(res, err.message);
  }
};
