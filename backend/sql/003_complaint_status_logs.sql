-- Migration: Add complaint_status_logs table
-- Run this against your civiclink database to fix the missing table error.

CREATE TABLE IF NOT EXISTS complaint_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaint_status_logs_complaint_id
  ON complaint_status_logs(complaint_id);

CREATE INDEX IF NOT EXISTS idx_complaint_status_logs_created_at
  ON complaint_status_logs(created_at);
