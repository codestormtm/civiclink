const { pool } = require("../config/db");

async function logComplaintStatusChange({
  complaintId,
  oldStatus,
  newStatus,
  changedBy,
  note = null
}) {
  await pool.query(
    `INSERT INTO complaint_status_logs (
      complaint_id,
      old_status,
      new_status,
      changed_by,
      note,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [complaintId, oldStatus, newStatus, changedBy || null, note]
  );
}

module.exports = {
  logComplaintStatusChange
};