const { pool } = require("../config/db");

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
    const result = await pool.query(
      `SELECT
         c.id,
         c.title,
         c.status,
         c.submitted_at,
         c.resolved_at,
         d.name AS department_name,
         dit.name AS complaint_type
       FROM complaints c
       JOIN departments d ON d.id = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       WHERE c.status = 'RESOLVED'
       ORDER BY c.resolved_at DESC NULLS LAST
       LIMIT 10`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/public/complaints/map
exports.getPublicMapPoints = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.title, c.status, c.latitude, c.longitude, c.address_text, c.created_at,
             d.name AS department_name, dit.name AS issue_type_name
      FROM complaints c
      JOIN departments d ON d.id = c.department_id
      JOIN department_issue_types dit ON dit.id = c.issue_type_id
      WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      ORDER BY c.created_at DESC
    `);
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
         COUNT(CASE WHEN c.status IN ('ASSIGNED', 'IN_PROGRESS') THEN 1 END)::int AS active_complaints
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
