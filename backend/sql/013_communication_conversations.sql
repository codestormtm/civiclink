CREATE TABLE IF NOT EXISTS communication_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES complaint_assignments(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_time TIMESTAMPTZ,
  UNIQUE (assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_communication_conversations_admin
  ON communication_conversations(admin_user_id, last_message_time DESC);

CREATE INDEX IF NOT EXISTS idx_communication_conversations_worker
  ON communication_conversations(worker_user_id, last_message_time DESC);

CREATE INDEX IF NOT EXISTS idx_communication_conversations_complaint
  ON communication_conversations(complaint_id);
