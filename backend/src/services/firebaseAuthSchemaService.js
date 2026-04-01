const { pool } = require("../config/db");

let firebaseAuthSchemaReadyPromise = null;

function ensureFirebaseAuthSchema() {
  if (!firebaseAuthSchemaReadyPromise) {
    firebaseAuthSchemaReadyPromise = pool.query(`
      ALTER TABLE users
        ALTER COLUMN password_hash DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255),
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20),
        ADD COLUMN IF NOT EXISTS auth_source VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

      UPDATE users
      SET auth_source = 'LOCAL'
      WHERE auth_source IS NULL;

      ALTER TABLE users
        ALTER COLUMN auth_source SET DEFAULT 'LOCAL',
        ALTER COLUMN auth_source SET NOT NULL;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_auth_source_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_auth_source_check;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_auth_provider_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_auth_provider_check;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_credential_source_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_credential_source_check;
        END IF;
      END $$;

      ALTER TABLE users
        ADD CONSTRAINT users_auth_source_check CHECK (
          auth_source IN ('LOCAL', 'FIREBASE')
        );

      ALTER TABLE users
        ADD CONSTRAINT users_auth_provider_check CHECK (
          auth_provider IS NULL OR auth_provider IN ('password', 'google')
        );

      ALTER TABLE users
        ADD CONSTRAINT users_credential_source_check CHECK (
          (
            auth_source = 'LOCAL'
            AND firebase_uid IS NULL
            AND auth_provider IS NULL
            AND password_hash IS NOT NULL
          )
          OR
          (
            auth_source = 'FIREBASE'
            AND role = 'CITIZEN'
            AND firebase_uid IS NOT NULL
            AND auth_provider IN ('password', 'google')
            AND password_hash IS NULL
          )
        );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid
        ON users(firebase_uid)
        WHERE firebase_uid IS NOT NULL;
    `).catch((err) => {
      firebaseAuthSchemaReadyPromise = null;
      throw err;
    });
  }

  return firebaseAuthSchemaReadyPromise;
}

module.exports = {
  ensureFirebaseAuthSchema,
};
