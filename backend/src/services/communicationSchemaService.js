const { pool } = require("../config/db");

async function ensureCommunicationSchema() {
  await pool.query(`
    ALTER TABLE worker_profiles
      ADD COLUMN IF NOT EXISTS local_call_number VARCHAR(3);
  `);

  await pool.query(`
    WITH numbered_workers AS (
      SELECT
        user_id,
        LPAD(
          ROW_NUMBER() OVER (
            PARTITION BY department_id
            ORDER BY created_at, user_id
          )::text,
          3,
          '0'
        ) AS next_number
      FROM worker_profiles
      WHERE local_call_number IS NULL
    )
    UPDATE worker_profiles wp
    SET local_call_number = numbered_workers.next_number
    FROM numbered_workers
    WHERE wp.user_id = numbered_workers.user_id;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'worker_profiles_local_call_number_format_check'
      ) THEN
        ALTER TABLE worker_profiles
          ADD CONSTRAINT worker_profiles_local_call_number_format_check
          CHECK (local_call_number ~ '^[0-9]{3}$');
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_profiles_department_local_call_number
      ON worker_profiles(department_id, local_call_number);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS communication_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
      assignment_id UUID REFERENCES complaint_assignments(id) ON DELETE CASCADE,
      admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      conversation_type VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT',
      local_call_number VARCHAR(3),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_message_time TIMESTAMPTZ,
      UNIQUE (assignment_id)
    );
  `);

  await pool.query(`
    ALTER TABLE communication_conversations
      ALTER COLUMN complaint_id DROP NOT NULL,
      ALTER COLUMN assignment_id DROP NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE communication_conversations
      ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT',
      ADD COLUMN IF NOT EXISTS local_call_number VARCHAR(3);
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'communication_conversations_type_check'
      ) THEN
        ALTER TABLE communication_conversations
          ADD CONSTRAINT communication_conversations_type_check
          CHECK (conversation_type IN ('ASSIGNMENT', 'DIRECT'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_communication_conversations_admin
      ON communication_conversations(admin_user_id, last_message_time DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_communication_conversations_worker
      ON communication_conversations(worker_user_id, last_message_time DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_communication_conversations_complaint
      ON communication_conversations(complaint_id);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_conversations_direct_pair
      ON communication_conversations(department_id, admin_user_id, worker_user_id)
      WHERE conversation_type = 'DIRECT';
  `);
}

module.exports = {
  ensureCommunicationSchema,
};
