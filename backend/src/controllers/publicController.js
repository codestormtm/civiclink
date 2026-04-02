const { pool } = require("../config/db");
const { mapAttachmentForResponse } = require("../utils/attachmentStorage");
const { getRequestOrigin } = require("../utils/requestOrigin");
const { failure } = require("../utils/response");
const mediaController = require("./mediaController");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readDepartmentFilter(req, res) {
  const { department_id: departmentId } = req.query;
  if (!departmentId) return null;

  if (!UUID_PATTERN.test(departmentId)) {
    failure(res, "Invalid department_id", 400);
    return undefined;
  }

  return departmentId;
}

function readDepartmentParam(req, res) {
  const { id } = req.params;

  if (!UUID_PATTERN.test(id)) {
    failure(res, "Invalid department id", 400);
    return undefined;
  }

  return id;
}

// GET /api/public/stats
exports.getPublicStats = async (req, res) => {
  try {
    const [totalResult, resolvedResult, inProgressResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM complaints`),
      pool.query(`SELECT COUNT(*)::int AS resolved FROM complaints WHERE status = 'RESOLVED'`),
      pool.query(`SELECT COUNT(*)::int AS in_progress FROM complaints WHERE status IN ('ASSIGNED', 'IN_PROGRESS')`),
    ]);

    res.json({
      success: true,
      data: {
        total_complaints: totalResult.rows[0].total,
        resolved_complaints: resolvedResult.rows[0].resolved,
        in_progress_complaints: inProgressResult.rows[0].in_progress,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/public/recent-resolved
exports.getRecentResolvedComplaints = async (req, res) => {
  try {
    const departmentId = readDepartmentFilter(req, res);
    if (departmentId === undefined) return;

    const params = [];
    let whereClause = `WHERE c.status = 'RESOLVED'`;

    if (departmentId) {
      params.push(departmentId);
      whereClause += ` AND c.department_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.department_id,
         c.title,
         c.status,
         c.submitted_at,
         c.resolved_at,
         d.name AS department_name,
         dit.name AS complaint_type
       FROM complaints c
       JOIN departments d ON d.id = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       ${whereClause}
       ORDER BY c.resolved_at DESC NULLS LAST
       LIMIT 10`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/public/complaints/map
exports.getPublicMapPoints = async (req, res) => {
  try {
    const departmentId = readDepartmentFilter(req, res);
    if (departmentId === undefined) return;

    const params = [];
    let whereClause = `WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`;

    if (departmentId) {
      params.push(departmentId);
      whereClause += ` AND c.department_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.department_id,
         c.title,
         c.status,
         c.latitude,
         c.longitude,
         c.address_text,
         c.submitted_at,
         c.resolved_at,
         d.name AS department_name,
         dit.name AS issue_type_name
       FROM complaints c
       JOIN departments d ON d.id = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       ${whereClause}
       ORDER BY c.submitted_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/public/department-summary
exports.getDepartmentSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         d.id,
         d.name,
         COUNT(c.id)::int AS total_complaints,
         COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END)::int AS resolved_complaints,
         COUNT(CASE WHEN c.status IN ('ASSIGNED', 'IN_PROGRESS') THEN 1 END)::int AS active_complaints,
         CASE
           WHEN COUNT(c.id) = 0 THEN 0
           ELSE ROUND(
             (
               COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END)::numeric
               / COUNT(c.id)::numeric
             ) * 100,
             1
           )::float
         END AS resolution_rate
       FROM departments d
       LEFT JOIN complaints c ON c.department_id = d.id
       WHERE d.is_active = TRUE
       GROUP BY d.id, d.name
       ORDER BY d.name ASC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/public/departments/:id/summary
exports.getPublicDepartmentSummary = async (req, res) => {
  try {
    const departmentId = readDepartmentParam(req, res);
    if (departmentId === undefined) return;

    const result = await pool.query(
      `SELECT
         d.id,
         d.name,
         COUNT(c.id)::int AS total_complaints,
         COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END)::int AS resolved_complaints,
         COUNT(CASE WHEN c.status IN ('ASSIGNED', 'IN_PROGRESS') THEN 1 END)::int AS active_complaints,
         CASE
           WHEN COUNT(c.id) = 0 THEN 0
           ELSE ROUND(
             (
               COUNT(CASE WHEN c.status = 'RESOLVED' THEN 1 END)::numeric
               / COUNT(c.id)::numeric
             ) * 100,
             1
           )::float
         END AS resolution_rate,
         MAX(COALESCE(c.resolved_at, c.updated_at, c.submitted_at)) AS latest_update_at
       FROM departments d
       LEFT JOIN complaints c ON c.department_id = d.id
       WHERE d.is_active = TRUE
         AND d.id = $1
       GROUP BY d.id, d.name`,
      [departmentId]
    );

    if (result.rowCount === 0) {
      return failure(res, "Department not found", 404);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/public/comparisons
exports.getPublicComparisons = async (req, res) => {
  try {
    const departmentId = readDepartmentFilter(req, res);
    if (departmentId === undefined) return;

    const params = [];
    let filterClause = `WHERE c.status = 'RESOLVED'`;

    if (departmentId) {
      params.push(departmentId);
      filterClause += ` AND c.department_id = $${params.length}`;
    }

    const result = await pool.query(
      `WITH comparison_candidates AS (
         SELECT
           c.id,
           c.department_id,
           c.title,
           c.resolved_at,
           d.name AS department_name,
           dit.name AS complaint_type,
           before_attachment.id AS before_attachment_id,
           before_attachment.file_url AS before_file_url,
           before_attachment.file_type AS before_file_type,
           before_attachment.attachment_role AS before_attachment_role,
           before_attachment.created_at AS before_created_at,
           after_attachment.id AS after_attachment_id,
           after_attachment.file_url AS after_file_url,
           after_attachment.file_type AS after_file_type,
           after_attachment.attachment_role AS after_attachment_role,
           after_attachment.created_at AS after_created_at
         FROM complaints c
         JOIN departments d ON d.id = c.department_id
         JOIN department_issue_types dit ON dit.id = c.issue_type_id
         LEFT JOIN LATERAL (
           SELECT a.id, a.file_url, a.file_type, a.attachment_role, a.created_at
           FROM complaint_attachments a
           WHERE a.complaint_id = c.id
             AND a.attachment_role = 'BEFORE'
             AND a.file_type ILIKE 'image/%'
           ORDER BY a.created_at ASC
           LIMIT 1
         ) before_attachment ON TRUE
         LEFT JOIN LATERAL (
           SELECT a.id, a.file_url, a.file_type, a.attachment_role, a.created_at
           FROM complaint_attachments a
           WHERE a.complaint_id = c.id
             AND a.attachment_role = 'AFTER'
             AND a.file_type ILIKE 'image/%'
           ORDER BY a.created_at DESC
           LIMIT 1
         ) after_attachment ON TRUE
         ${filterClause}
       )
       SELECT *
       FROM comparison_candidates
       WHERE before_attachment_id IS NOT NULL
         AND after_attachment_id IS NOT NULL
       ORDER BY RANDOM()
       LIMIT 6`,
      params
    );

    const baseUrl = getRequestOrigin(req);
    const data = result.rows.map((row) => ({
      id: row.id,
      department_id: row.department_id,
      title: row.title,
      resolved_at: row.resolved_at,
      department_name: row.department_name,
      complaint_type: row.complaint_type,
      before_attachment: mapAttachmentForResponse(
        {
          id: row.before_attachment_id,
          file_url: row.before_file_url,
          file_type: row.before_file_type,
          attachment_role: row.before_attachment_role,
          created_at: row.before_created_at,
        },
        { baseUrl, access: "public" }
      ),
      after_attachment: mapAttachmentForResponse(
        {
          id: row.after_attachment_id,
          file_url: row.after_file_url,
          file_type: row.after_file_type,
          attachment_role: row.after_attachment_role,
          created_at: row.after_created_at,
        },
        { baseUrl, access: "public" }
      ),
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.viewPublicAttachment = mediaController.viewPublicAttachment;
