CREATE TABLE IF NOT EXISTS department_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_department_change_logs_department_changed_at
  ON department_change_logs(department_id, changed_at DESC);

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
