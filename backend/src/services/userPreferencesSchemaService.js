const { pool } = require("../config/db");

let userPreferencesSchemaReadyPromise = null;

function ensureUserPreferencesSchema() {
  if (!userPreferencesSchemaReadyPromise) {
    userPreferencesSchemaReadyPromise = pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10);

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_preferred_language_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_preferred_language_check;
        END IF;
      END $$;

      ALTER TABLE users
        ADD CONSTRAINT users_preferred_language_check CHECK (
          preferred_language IS NULL OR preferred_language IN ('en', 'si', 'ta')
        );
    `).catch((err) => {
      userPreferencesSchemaReadyPromise = null;
      throw err;
    });
  }

  return userPreferencesSchemaReadyPromise;
}

module.exports = {
  ensureUserPreferencesSchema,
};
