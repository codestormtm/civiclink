const { pool } = require("../config/db");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const { sendNotification } = require("../utils/notificationService");
const { success, failure } = require("../utils/response");
const {
  buildStoredObjectReference,
  mapAttachmentForResponse,
} = require("../utils/attachmentStorage");

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

    const result = await pool.query(
      `INSERT INTO complaint_attachments (complaint_id, file_url, file_type, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [complaint_id, fileUrl, file.mimetype, req.user.id]
    );

    sendNotification("Media uploaded for issue");

    const attachment = await mapAttachmentForResponse(result.rows[0]);

    return success(res, attachment, 201);
  } catch (err) {
    return failure(res, err.message);
  }
};
