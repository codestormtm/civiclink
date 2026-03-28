CREATE TABLE IF NOT EXISTS worker_termination_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  terminated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  worker_name_snapshot VARCHAR(150) NOT NULL,
  worker_email_snapshot VARCHAR(255) NOT NULL,
  admin_name_snapshot VARCHAR(150) NOT NULL,
  decision_statement TEXT NOT NULL,
  termination_reason TEXT NOT NULL,
  final_compensation_details TEXT NOT NULL,
  property_return_checklist TEXT NOT NULL,
  letter_body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worker_termination_records_worker_user_id
  ON worker_termination_records(worker_user_id);

CREATE INDEX IF NOT EXISTS idx_worker_termination_records_department_id
  ON worker_termination_records(department_id);

CREATE INDEX IF NOT EXISTS idx_worker_termination_records_created_at
  ON worker_termination_records(created_at);
