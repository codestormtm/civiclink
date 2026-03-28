CREATE TABLE IF NOT EXISTS complaint_intake_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  citizen_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_language VARCHAR(10) DEFAULT 'en',
  chat_history   JSONB NOT NULL DEFAULT '[]',
  structured_draft JSONB NOT NULL DEFAULT '{}',
  status         VARCHAR(20) DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
