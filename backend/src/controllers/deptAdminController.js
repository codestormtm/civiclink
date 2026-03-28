const { pool } = require("../config/db");
const { success, failure } = require("../utils/response");

// GET /api/dept-admin/summary
exports.getSummary = async (req, res) => {
  const deptId = req.user.department_id;
  try {
    const stats = await pool.query(
      `SELECT
         COUNT(*)::int                                                                                               AS total,
         COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int                                                          AS submitted,
         COUNT(*) FILTER (WHERE status = 'ASSIGNED')::int                                                           AS assigned,
         COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int                                                        AS in_progress,
         COUNT(*) FILTER (WHERE status = 'RESOLVED')::int                                                           AS resolved,
         COUNT(*) FILTER (WHERE status = 'CLOSED')::int                                                             AS closed,
         COUNT(*) FILTER (WHERE status = 'REJECTED_WRONG_DEPARTMENT')::int                                          AS rejected,
         COUNT(*) FILTER (
           WHERE sla_due_at < NOW()
             AND status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')
         )::int                                                                                                      AS sla_breached,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (resolved_at - submitted_at)) / 3600)
             FILTER (WHERE resolved_at IS NOT NULL),
           1
         )                                                                                                           AS avg_resolution_hours,
         COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '30 days')::int                                    AS last_30_days
       FROM complaints
       WHERE department_id = $1`,
      [deptId]
    );

    const typeBreakdown = await pool.query(
      `SELECT dit.name AS issue_type, COUNT(*)::int AS count
       FROM complaints c
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       WHERE c.department_id = $1
       GROUP BY dit.name
       ORDER BY count DESC
       LIMIT 8`,
      [deptId]
    );

    return success(res, {
      ...stats.rows[0],
      issue_type_breakdown: typeBreakdown.rows,
    });
  } catch (err) {
    return failure(res, err.message);
  }
};

// GET /api/dept-admin/complaints
exports.getFilteredComplaints = async (req, res) => {
  const deptId = req.user.department_id;
  const { status, priority, sla_breached, unassigned, issue_type_id, date_from, date_to, search } = req.query;

  try {
    const params = [deptId];
    let extraWhere = "";

    if (status) {
      params.push(status);
      extraWhere += ` AND c.status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      extraWhere += ` AND c.priority_level = $${params.length}`;
    }

    if (sla_breached === "true") {
      extraWhere += ` AND c.sla_due_at < NOW() AND c.status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')`;
    }

    if (issue_type_id) {
      params.push(issue_type_id);
      extraWhere += ` AND c.issue_type_id = $${params.length}`;
    }

    if (date_from) {
      params.push(date_from);
      extraWhere += ` AND c.submitted_at >= $${params.length}`;
    }

    if (date_to) {
      params.push(date_to + " 23:59:59");
      extraWhere += ` AND c.submitted_at <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      extraWhere += ` AND (c.title ILIKE $${idx} OR c.description ILIKE $${idx})`;
    }

    const query = `
      SELECT
        c.id,
        c.title,
        c.description,
        c.status,
        c.priority_level,
        c.sla_due_at,
        c.submitted_at,
        c.resolved_at,
        c.address_text,
        c.latitude,
        c.longitude,
        c.rejection_reason,
        CASE
          WHEN c.sla_due_at < NOW()
            AND c.status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')
          THEN true
          ELSE false
        END AS sla_breached,
        dit.id AS issue_type_id,
        dit.name AS issue_type_name,
        reporter.name AS reporter_name,
        latest_assignment.worker_user_id AS assigned_worker_id,
        assignee.name AS assigned_worker_name,
        latest_assignment.status AS assignment_status
      FROM complaints c
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
      WHERE c.department_id = $1
        ${extraWhere}
      ORDER BY
        CASE
          WHEN c.sla_due_at < NOW()
            AND c.status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')
          THEN 0 ELSE 1
        END,
        CASE c.priority_level
          WHEN 'CRITICAL' THEN 0
          WHEN 'HIGH'     THEN 1
          WHEN 'MEDIUM'   THEN 2
          WHEN 'LOW'      THEN 3
          ELSE 4
        END,
        c.submitted_at DESC
    `;

    const result = await pool.query(query, params);

    let rows = result.rows;
    if (unassigned === "true") {
      rows = rows.filter((r) => !r.assigned_worker_id);
    }

    return success(res, rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

// GET /api/dept-admin/workload
exports.getWorkerWorkload = async (req, res) => {
  const deptId = req.user.department_id;
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         COUNT(ca.id) FILTER (WHERE ca.status IN ('ASSIGNED','IN_PROGRESS'))::int AS active_assignments,
         COUNT(ca.id) FILTER (WHERE ca.status = 'ASSIGNED')::int                  AS assigned_count,
         COUNT(ca.id) FILTER (WHERE ca.status = 'IN_PROGRESS')::int               AS in_progress_count,
         COUNT(ca.id) FILTER (
           WHERE ca.status = 'COMPLETED'
             AND ca.updated_at >= NOW() - INTERVAL '30 days'
         )::int                                                                    AS completed_last_30_days,
         COUNT(ca.id)::int                                                         AS total_ever
       FROM users u
       LEFT JOIN complaint_assignments ca
         ON ca.worker_user_id = u.id AND ca.department_id = $1
       WHERE u.role = 'WORKER' AND u.department_id = $1 AND u.is_active = TRUE
       GROUP BY u.id, u.name
       ORDER BY active_assignments DESC, u.name`,
      [deptId]
    );
    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

// GET /api/dept-admin/performance
exports.getPerformanceReport = async (req, res) => {
  const deptId = req.user.department_id;
  try {
    const monthly = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', submitted_at), 'Mon YYYY')           AS month,
         DATE_TRUNC('month', submitted_at)                                 AS month_date,
         COUNT(*)::int                                                     AS total_received,
         COUNT(*) FILTER (WHERE status IN ('RESOLVED','CLOSED'))::int     AS total_resolved,
         COUNT(*) FILTER (
           WHERE sla_due_at < COALESCE(resolved_at, NOW())
             AND status NOT IN ('REJECTED_WRONG_DEPARTMENT')
         )::int                                                            AS sla_breached,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (resolved_at - submitted_at)) / 3600)
             FILTER (WHERE resolved_at IS NOT NULL),
           1
         )                                                                 AS avg_resolution_hours
       FROM complaints
       WHERE department_id = $1
         AND submitted_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', submitted_at)
       ORDER BY month_date DESC`,
      [deptId]
    );

    const byPriority = await pool.query(
      `SELECT
         priority_level,
         COUNT(*)::int                                                       AS total,
         COUNT(*) FILTER (WHERE status IN ('RESOLVED','CLOSED'))::int       AS resolved,
         COUNT(*) FILTER (
           WHERE sla_due_at < NOW()
             AND status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')
         )::int                                                              AS sla_breached
       FROM complaints
       WHERE department_id = $1
       GROUP BY priority_level
       ORDER BY
         CASE priority_level
           WHEN 'CRITICAL' THEN 0
           WHEN 'HIGH'     THEN 1
           WHEN 'MEDIUM'   THEN 2
           WHEN 'LOW'      THEN 3
           ELSE 4
         END`,
      [deptId]
    );

    return success(res, {
      monthly: monthly.rows,
      by_priority: byPriority.rows,
    });
  } catch (err) {
    return failure(res, err.message);
  }
};
