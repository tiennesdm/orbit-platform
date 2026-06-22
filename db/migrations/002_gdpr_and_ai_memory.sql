-- GDPR request log + AI agent memory
-- Note: users PK is `did` (TEXT), not `id` (BIGINT)
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id BIGSERIAL PRIMARY KEY,
  user_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('export', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_did, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_agent_memory (
  id BIGSERIAL PRIMARY KEY,
  user_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memory_user_time ON ai_agent_memory(user_did, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_agent_state (
  user_did TEXT PRIMARY KEY REFERENCES users(did) ON DELETE CASCADE,
  autonomy_level TEXT NOT NULL DEFAULT 'suggest' CHECK (autonomy_level IN ('ask', 'suggest', 'auto')),
  personality TEXT NOT NULL DEFAULT 'supportive' CHECK (personality IN ('supportive', 'witty', 'professional', 'playful')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
