const { pool } = require("../config/db");

let passwordResetSchemaReadyPromise = null;

function ensurePasswordResetSchema() {
  if (!passwordResetSchemaReadyPromise) {
    passwordResetSchemaReadyPromise = pool.query(`
      ALTER TABLE departments
        ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);

      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        target_email VARCHAR(255) NOT NULL,
        target_name VARCHAR(150) NOT NULL,
        target_role VARCHAR(20) NOT NULL,
        nic_number VARCHAR(50) NOT NULL,
        mobile_number VARCHAR(50) NOT NULL,
        request_letter_url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        viewed_at TIMESTAMPTZ,
        viewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        completed_at TIMESTAMPTZ,
        completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT password_reset_requests_target_role_check CHECK (
          target_role = 'DEPT_ADMIN'
        ),
        CONSTRAINT password_reset_requests_status_check CHECK (
          status IN ('PENDING', 'COMPLETED')
        )
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created_at
        ON password_reset_requests(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_password_reset_requests_department_id
        ON password_reset_requests(department_id);

      CREATE INDEX IF NOT EXISTS idx_password_reset_requests_target_user_id
        ON password_reset_requests(target_user_id);

      CREATE INDEX IF NOT EXISTS idx_password_reset_requests_unread
        ON password_reset_requests(viewed_at)
        WHERE viewed_at IS NULL;
    `).catch((err) => {
      passwordResetSchemaReadyPromise = null;
      throw err;
    });
  }

  return passwordResetSchemaReadyPromise;
}

module.exports = {
  ensurePasswordResetSchema,
};
