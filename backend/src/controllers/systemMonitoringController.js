const { pool } = require("../config/db");
const { success, failure } = require("../utils/response");
const { ensureMonitoringSchema } = require("../services/monitoringService");

function buildMonitoringFilters(query) {
  const params = [];
  const clauses = [];

  if (query.target_key) {
    params.push(query.target_key);
    clauses.push(`mt.target_key = $${params.length}`);
  }

  if (query.status) {
    params.push(query.status);
    clauses.push(`mcl.status = $${params.length}`);
  }

  if (query.date_from) {
    params.push(`${query.date_from}T00:00:00.000Z`);
    clauses.push(`mcl.checked_at >= $${params.length}`);
  }

  if (query.date_to) {
    params.push(`${query.date_to}T23:59:59.999Z`);
    clauses.push(`mcl.checked_at <= $${params.length}`);
  }

  return {
    params,
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

function toCsvValue(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

exports.getMonitoringSummary = async (_req, res) => {
  try {
    await ensureMonitoringSchema();

    const result = await pool.query(`
      WITH latest_logs AS (
        SELECT DISTINCT ON (mcl.target_id)
          mcl.target_id,
          mcl.status,
          mcl.checked_at,
          mcl.error_message
        FROM monitor_check_logs mcl
        ORDER BY mcl.target_id, mcl.checked_at DESC
      ),
      uptime_stats AS (
        SELECT
          target_id,
          ROUND(
            COALESCE(
              100.0 * COUNT(*) FILTER (WHERE status = 'UP') / NULLIF(COUNT(*), 0),
              0
            ),
            2
          ) AS uptime_percent_24h
        FROM monitor_check_logs
        WHERE checked_at >= NOW() - INTERVAL '24 hours'
        GROUP BY target_id
      ),
      incident_stats AS (
        SELECT
          target_id,
          COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_incident_count,
          MAX(started_at) AS last_incident_at
        FROM monitor_incidents
        GROUP BY target_id
      )
      SELECT
        mt.target_key,
        mt.label,
        COALESCE(ll.status, 'UNKNOWN') AS current_status,
        ll.checked_at AS last_checked_at,
        COALESCE(us.uptime_percent_24h, 0) AS uptime_percent_24h,
        COALESCE(isx.open_incident_count, 0) AS open_incident_count,
        ll.error_message AS last_error_message,
        isx.last_incident_at
      FROM monitor_targets mt
      LEFT JOIN latest_logs ll ON ll.target_id = mt.id
      LEFT JOIN uptime_stats us ON us.target_id = mt.id
      LEFT JOIN incident_stats isx ON isx.target_id = mt.id
      WHERE mt.is_active = TRUE
      ORDER BY mt.label
    `);

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getMonitoringIncidents = async (_req, res) => {
  try {
    await ensureMonitoringSchema();

    const result = await pool.query(`
      SELECT
        mi.id,
        mt.target_key,
        mt.label,
        mi.started_at,
        mi.ended_at,
        mi.status,
        mi.summary
      FROM monitor_incidents mi
      JOIN monitor_targets mt ON mt.id = mi.target_id
      ORDER BY mi.started_at DESC
      LIMIT 100
    `);

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getMonitoringLogs = async (req, res) => {
  try {
    await ensureMonitoringSchema();

    const { params, whereClause } = buildMonitoringFilters(req.query);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    params.push(limit);

    const result = await pool.query(
      `
        SELECT
          mcl.id,
          mt.target_key,
          mt.label,
          mcl.status,
          mcl.response_time_ms,
          mcl.http_status_code,
          mcl.error_message,
          mcl.checked_at
        FROM monitor_check_logs mcl
        JOIN monitor_targets mt ON mt.id = mcl.target_id
        ${whereClause}
        ORDER BY mcl.checked_at DESC
        LIMIT $${params.length}
      `,
      params
    );

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.downloadMonitoringLogs = async (req, res) => {
  try {
    await ensureMonitoringSchema();

    const { params, whereClause } = buildMonitoringFilters(req.query);
    const result = await pool.query(
      `
        SELECT
          mt.target_key,
          mt.label,
          mcl.status,
          mcl.response_time_ms,
          mcl.http_status_code,
          mcl.error_message,
          mcl.checked_at
        FROM monitor_check_logs mcl
        JOIN monitor_targets mt ON mt.id = mcl.target_id
        ${whereClause}
        ORDER BY mcl.checked_at DESC
      `,
      params
    );

    const rows = [
      ["target_key", "label", "status", "response_time_ms", "http_status_code", "error_message", "checked_at"],
      ...result.rows.map((row) => [
        row.target_key,
        row.label,
        row.status,
        row.response_time_ms,
        row.http_status_code,
        row.error_message,
        row.checked_at,
      ]),
    ];

    const csv = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=monitoring-logs.csv");
    return res.status(200).send(csv);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getDepartmentActivity = async (_req, res) => {
  try {
    await ensureMonitoringSchema();

    const result = await pool.query(`
      WITH complaint_stats AS (
        SELECT
          d.id AS department_id,
          COUNT(c.id)::int AS total_complaints,
          COUNT(*) FILTER (WHERE c.status = 'SUBMITTED')::int AS submitted,
          COUNT(*) FILTER (WHERE c.status = 'ASSIGNED')::int AS assigned,
          COUNT(*) FILTER (WHERE c.status = 'IN_PROGRESS')::int AS in_progress,
          COUNT(*) FILTER (WHERE c.status = 'RESOLVED')::int AS resolved,
          COUNT(*) FILTER (
            WHERE c.sla_due_at < NOW()
              AND c.status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED_WRONG_DEPARTMENT')
          )::int AS sla_breached,
          MAX(c.updated_at) AS last_activity_at
        FROM departments d
        LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.id
      ),
      worker_stats AS (
        SELECT
          d.id AS department_id,
          COUNT(u.id) FILTER (WHERE u.role = 'WORKER')::int AS worker_count,
          COUNT(u.id) FILTER (
            WHERE u.role = 'WORKER'
              AND (u.is_active = FALSE OR COALESCE(wp.employment_status, 'INACTIVE') <> 'ACTIVE')
          )::int AS inactive_worker_count
        FROM departments d
        LEFT JOIN users u ON u.department_id = d.id
        LEFT JOIN worker_profiles wp ON wp.user_id = u.id
        GROUP BY d.id
      )
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        COALESCE(cs.total_complaints, 0) AS total_complaints,
        COALESCE(cs.submitted, 0) AS submitted,
        COALESCE(cs.assigned, 0) AS assigned,
        COALESCE(cs.in_progress, 0) AS in_progress,
        COALESCE(cs.resolved, 0) AS resolved,
        COALESCE(cs.sla_breached, 0) AS sla_breached,
        COALESCE(ws.worker_count, 0) AS worker_count,
        COALESCE(ws.inactive_worker_count, 0) AS inactive_worker_count,
        cs.last_activity_at
      FROM departments d
      LEFT JOIN complaint_stats cs ON cs.department_id = d.id
      LEFT JOIN worker_stats ws ON ws.department_id = d.id
      WHERE d.is_active = TRUE
      ORDER BY d.name
    `);

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getWorkerActivity = async (_req, res) => {
  try {
    await ensureMonitoringSchema();

    const result = await pool.query(`
      SELECT
        u.id AS worker_id,
        COALESCE(wp.full_name, u.name) AS worker_name,
        d.name AS department_name,
        wp.employment_status,
        COALESCE(assignments.active_assignment_count, 0) AS active_assignment_count,
        GREATEST(
          COALESCE(u.updated_at, u.created_at, NOW() - INTERVAL '100 years'),
          COALESCE(wp.updated_at, wp.created_at, NOW() - INTERVAL '100 years'),
          COALESCE(assignments.last_assignment_at, NOW() - INTERVAL '100 years')
        ) AS last_activity_at,
        u.is_active
      FROM users u
      JOIN worker_profiles wp ON wp.user_id = u.id
      JOIN departments d ON d.id = u.department_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE ca.status IN ('ASSIGNED', 'IN_PROGRESS'))::int AS active_assignment_count,
          MAX(ca.updated_at) AS last_assignment_at
        FROM complaint_assignments ca
        WHERE ca.worker_user_id = u.id
          AND ca.department_id = u.department_id
      ) assignments ON TRUE
      WHERE u.role = 'WORKER'
      ORDER BY d.name, worker_name
    `);

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getMonitoringAlerts = async (_req, res) => {
  try {
    await ensureMonitoringSchema();

    const result = await pool.query(`
      SELECT
        ma.id,
        mt.target_key,
        mt.label,
        ma.severity,
        ma.message,
        ma.created_at,
        ma.incident_id
      FROM monitor_alerts ma
      JOIN monitor_targets mt ON mt.id = ma.target_id
      ORDER BY ma.created_at DESC
      LIMIT 25
    `);

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};
