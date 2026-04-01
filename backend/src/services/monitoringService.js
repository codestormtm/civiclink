const http = require("http");
const https = require("https");
const { URL } = require("url");

const env = require("../config/env");
const { pool } = require("../config/db");
const { minioClient, bucketName } = require("../config/minio");
const logger = require("../utils/logger");

const MONITOR_INTERVAL_MS = 60_000;
const HTTP_TIMEOUT_MS = 5_000;

let monitoringSchemaReadyPromise = null;
let monitoringInterval = null;
let monitoringRunInProgress = false;

function getTargetDefinitions() {
  const citizenPortalBase = env.monitoring.citizenPortalUrl;

  return [
    {
      target_key: "admin_portal",
      label: "Admin Portal",
      target_type: "HTTP",
      healthcheck_url: env.monitoring.adminPortalUrl,
    },
    {
      target_key: "worker_portal",
      label: "Worker Portal",
      target_type: "HTTP",
      healthcheck_url: env.monitoring.workerPortalUrl,
    },
    {
      target_key: "citizen_portal",
      label: "Citizen Portal",
      target_type: "HTTP",
      healthcheck_url: citizenPortalBase,
    },
    {
      target_key: "transparency_portal",
      label: "Transparency Portal",
      target_type: "HTTP",
      healthcheck_url: env.monitoring.transparencyPortalUrl || `${citizenPortalBase.replace(/\/$/, "")}/public`,
    },
    {
      target_key: "backend_api",
      label: "Backend API",
      target_type: "HTTP",
      healthcheck_url: env.monitoring.backendApiUrl,
    },
    {
      target_key: "database",
      label: "Database",
      target_type: "INTERNAL",
      healthcheck_url: null,
    },
    {
      target_key: "storage",
      label: "Storage",
      target_type: "INTERNAL",
      healthcheck_url: null,
    },
  ];
}

async function seedMonitoringTargets(client) {
  const query = `
    INSERT INTO monitor_targets (target_key, label, target_type, healthcheck_url, is_active)
    VALUES ($1, $2, $3, $4, TRUE)
    ON CONFLICT (target_key)
    DO UPDATE SET
      label = EXCLUDED.label,
      target_type = EXCLUDED.target_type,
      healthcheck_url = EXCLUDED.healthcheck_url,
      is_active = TRUE,
      updated_at = CURRENT_TIMESTAMP
  `;

  for (const target of getTargetDefinitions()) {
    await client.query(query, [
      target.target_key,
      target.label,
      target.target_type,
      target.healthcheck_url,
    ]);
  }
}

function ensureMonitoringSchema() {
  if (!monitoringSchemaReadyPromise) {
    monitoringSchemaReadyPromise = (async () => {
      const client = await pool.connect();

      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS monitor_targets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            target_key VARCHAR(80) NOT NULL UNIQUE,
            label VARCHAR(120) NOT NULL,
            target_type VARCHAR(20) NOT NULL,
            healthcheck_url TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT monitor_targets_type_check CHECK (
              target_type IN ('HTTP', 'INTERNAL')
            )
          );

          CREATE TABLE IF NOT EXISTS monitor_check_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            target_id UUID NOT NULL REFERENCES monitor_targets(id) ON DELETE CASCADE,
            status VARCHAR(10) NOT NULL,
            response_time_ms INTEGER,
            http_status_code INTEGER,
            error_message TEXT,
            checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT monitor_check_logs_status_check CHECK (
              status IN ('UP', 'DOWN')
            )
          );

          CREATE TABLE IF NOT EXISTS monitor_incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            target_id UUID NOT NULL REFERENCES monitor_targets(id) ON DELETE CASCADE,
            summary TEXT NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
            started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT monitor_incidents_status_check CHECK (
              status IN ('OPEN', 'RESOLVED')
            )
          );

          CREATE TABLE IF NOT EXISTS monitor_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            target_id UUID NOT NULL REFERENCES monitor_targets(id) ON DELETE CASCADE,
            incident_id UUID REFERENCES monitor_incidents(id) ON DELETE SET NULL,
            severity VARCHAR(10) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT monitor_alerts_severity_check CHECK (
              severity IN ('INFO', 'HIGH')
            )
          );

          CREATE INDEX IF NOT EXISTS idx_monitor_check_logs_target_checked_at
            ON monitor_check_logs(target_id, checked_at DESC);

          CREATE INDEX IF NOT EXISTS idx_monitor_incidents_target_status
            ON monitor_incidents(target_id, status);

          CREATE INDEX IF NOT EXISTS idx_monitor_alerts_target_created_at
            ON monitor_alerts(target_id, created_at DESC);
        `);

        await seedMonitoringTargets(client);
      } finally {
        client.release();
      }
    })().catch((err) => {
      monitoringSchemaReadyPromise = null;
      throw err;
    });
  }

  return monitoringSchemaReadyPromise;
}

function requestUrl(urlString) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      parsed,
      {
        method: "HEAD",
        timeout: HTTP_TIMEOUT_MS,
      },
      (res) => {
        resolve({ statusCode: res.statusCode || 0 });
        res.destroy();
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });

    req.on("error", reject);
    req.end();
  });
}

async function checkStorageHealth() {
  await minioClient.bucketExists(bucketName);
  return { ok: true, bucket: bucketName };
}

async function performTargetCheck(target) {
  const startedAt = Date.now();

  try {
    if (target.target_key === "database") {
      await pool.query("SELECT 1");
      return {
        status: "UP",
        response_time_ms: Date.now() - startedAt,
        http_status_code: null,
        error_message: null,
      };
    }

    if (target.target_key === "storage") {
      await checkStorageHealth();
      return {
        status: "UP",
        response_time_ms: Date.now() - startedAt,
        http_status_code: null,
        error_message: null,
      };
    }

    const response = await requestUrl(target.healthcheck_url);
    const isHealthy = response.statusCode >= 200 && response.statusCode < 400;

    return {
      status: isHealthy ? "UP" : "DOWN",
      response_time_ms: Date.now() - startedAt,
      http_status_code: response.statusCode,
      error_message: isHealthy ? null : `HTTP ${response.statusCode}`,
    };
  } catch (err) {
    return {
      status: "DOWN",
      response_time_ms: Date.now() - startedAt,
      http_status_code: null,
      error_message: err.message,
    };
  }
}

async function recordTargetCheck(target, check, io) {
  const client = await pool.connect();
  let alertToEmit = null;

  try {
    await client.query("BEGIN");

    const previousLogResult = await client.query(
      `SELECT status
       FROM monitor_check_logs
       WHERE target_id = $1
       ORDER BY checked_at DESC
       LIMIT 1`,
      [target.id]
    );

    const openIncidentResult = await client.query(
      `SELECT id
       FROM monitor_incidents
       WHERE target_id = $1 AND status = 'OPEN'
       ORDER BY started_at DESC
       LIMIT 1`,
      [target.id]
    );

    const previousStatus = previousLogResult.rows[0]?.status || null;
    const openIncidentId = openIncidentResult.rows[0]?.id || null;

    const logInsert = await client.query(
      `INSERT INTO monitor_check_logs (
         target_id, status, response_time_ms, http_status_code, error_message
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, checked_at`,
      [
        target.id,
        check.status,
        check.response_time_ms,
        check.http_status_code,
        check.error_message,
      ]
    );

    let incidentId = openIncidentId;

    if (check.status === "DOWN" && !incidentId) {
      const incidentInsert = await client.query(
        `INSERT INTO monitor_incidents (target_id, summary, status, started_at, updated_at)
         VALUES ($1, $2, 'OPEN', $3, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          target.id,
          `${target.label} is unavailable${check.error_message ? `: ${check.error_message}` : ""}`,
          logInsert.rows[0].checked_at,
        ]
      );

      incidentId = incidentInsert.rows[0].id;
    }

    if (previousStatus === "UP" && check.status === "DOWN") {
      const alertInsert = await client.query(
        `INSERT INTO monitor_alerts (target_id, incident_id, severity, message)
         VALUES ($1, $2, 'HIGH', $3)
         RETURNING id, severity, message, created_at`,
        [
          target.id,
          incidentId,
          `${target.label} went down${check.error_message ? `: ${check.error_message}` : ""}`,
        ]
      );

      alertToEmit = {
        ...alertInsert.rows[0],
        incident_id: incidentId,
        target_key: target.target_key,
        label: target.label,
      };
    }

    if (check.status === "UP" && incidentId) {
      await client.query(
        `UPDATE monitor_incidents
         SET status = 'RESOLVED',
             ended_at = $2,
             updated_at = CURRENT_TIMESTAMP,
             summary = $3
         WHERE id = $1`,
        [
          incidentId,
          logInsert.rows[0].checked_at,
          `${target.label} recovered`,
        ]
      );

      if (previousStatus === "DOWN") {
        const alertInsert = await client.query(
          `INSERT INTO monitor_alerts (target_id, incident_id, severity, message)
           VALUES ($1, $2, 'INFO', $3)
           RETURNING id, severity, message, created_at`,
          [
            target.id,
            incidentId,
            `${target.label} recovered`,
          ]
        );

        alertToEmit = {
          ...alertInsert.rows[0],
          incident_id: incidentId,
          target_key: target.target_key,
          label: target.label,
        };
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (alertToEmit && io) {
    io.emit("system_alert", alertToEmit);
  }
}

async function runMonitoringCycle(io) {
  await ensureMonitoringSchema();

  const result = await pool.query(
    `SELECT id, target_key, label, target_type, healthcheck_url
     FROM monitor_targets
     WHERE is_active = TRUE
     ORDER BY label`
  );

  for (const target of result.rows) {
    try {
      const check = await performTargetCheck(target);
      await recordTargetCheck(target, check, io);
    } catch (err) {
      logger.error(`Monitoring check failed for ${target.target_key}`, err);
    }
  }
}

function startMonitoringLoop(io, intervalMs = MONITOR_INTERVAL_MS) {
  if (monitoringInterval) {
    return;
  }

  const execute = async () => {
    if (monitoringRunInProgress) {
      return;
    }

    monitoringRunInProgress = true;
    try {
      await runMonitoringCycle(io);
    } catch (err) {
      logger.error("Monitoring cycle failed", err);
    } finally {
      monitoringRunInProgress = false;
    }
  };

  execute();
  monitoringInterval = setInterval(execute, intervalMs);
}

module.exports = {
  checkStorageHealth,
  ensureMonitoringSchema,
  startMonitoringLoop,
};
