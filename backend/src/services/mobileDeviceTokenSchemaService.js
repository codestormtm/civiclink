let mobileDeviceTokenSchemaReadyPromise = null;

const { pool } = require("../config/db");

function ensureMobileDeviceTokenSchema() {
  if (!mobileDeviceTokenSchemaReadyPromise) {
    mobileDeviceTokenSchemaReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        app VARCHAR(30) NOT NULL,
        platform VARCHAR(30) NOT NULL,
        fcm_token TEXT NOT NULL UNIQUE,
        device_label TEXT,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT mobile_device_tokens_role_check CHECK (
          role IN ('SYSTEM_ADMIN', 'DEPT_ADMIN', 'WORKER', 'CITIZEN')
        ),
        CONSTRAINT mobile_device_tokens_app_check CHECK (
          app IN ('citizen', 'worker')
        ),
        CONSTRAINT mobile_device_tokens_platform_check CHECK (
          platform IN ('android')
        )
      );

      CREATE INDEX IF NOT EXISTS idx_mobile_device_tokens_user_id
        ON mobile_device_tokens(user_id);

      CREATE INDEX IF NOT EXISTS idx_mobile_device_tokens_active_user
        ON mobile_device_tokens(user_id)
        WHERE revoked_at IS NULL;
    `).catch((err) => {
      mobileDeviceTokenSchemaReadyPromise = null;
      throw err;
    });
  }

  return mobileDeviceTokenSchemaReadyPromise;
}

module.exports = {
  ensureMobileDeviceTokenSchema,
};
