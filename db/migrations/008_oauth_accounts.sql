-- Migration 008: OAuth providers (Google + Apple)
-- Stores linked OAuth identities per user. Multiple providers per user allowed
-- (a user can link Google AND Apple to the same account).
--
-- Flow:
--   1. Mobile/web app uses Google Sign-In / Apple Sign-In SDK to get ID token
--   2. App POSTs ID token to /api/v1/oauth/google/login or /apple/login
--   3. Server verifies ID token signature with provider's JWKS
--   4. If user (matched by provider_user_id) exists → issue session
--   5. If user doesn't exist:
--      - If `createAccount: true` flag → create new user + link provider
--      - Otherwise → return "new user, link to existing?" prompt
--   6. If email matches existing user → link provider to existing account (link flow)

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'github', 'facebook', 'twitter')),
  provider_user_id TEXT NOT NULL,           -- 'sub' claim for Google/Apple
  provider_email TEXT,                       -- may change (rare) — kept for audit
  provider_email_verified BOOLEAN DEFAULT FALSE,
  provider_display_name TEXT,                -- display name from provider profile
  provider_avatar_url TEXT,
  raw_profile JSONB,                         -- full raw profile for audit/debug
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)         -- one provider_id maps to one user_did
);

CREATE INDEX IF NOT EXISTS idx_oauth_user_did ON user_oauth_accounts (user_did);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_email ON user_oauth_accounts (provider, provider_email)
  WHERE provider_email IS NOT NULL;

COMMENT ON TABLE user_oauth_accounts IS 'OAuth identity links — one row per (provider, provider_user_id)';
COMMENT ON COLUMN user_oauth_accounts.provider_user_id IS 'Stable user ID from provider (sub claim for OIDC)';
COMMENT ON COLUMN user_oauth_accounts.raw_profile IS 'Full raw OAuth profile JSON for audit/debug';

-- Track OAuth login attempts for security monitoring
-- (separate from auth audit log — this is provider-specific for detecting
--  unusual patterns like multiple failed attempts from same IP)
CREATE TABLE IF NOT EXISTS oauth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_attempts_provider_time
  ON oauth_login_attempts (provider, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_oauth_attempts_ip_time
  ON oauth_login_attempts (ip_address, attempted_at DESC)
  WHERE ip_address IS NOT NULL;

COMMENT ON TABLE oauth_login_attempts IS 'OAuth login attempt audit log for security monitoring';

-- Auto-update last_used_at on user_oauth_accounts row when that provider is used to log in
CREATE OR REPLACE FUNCTION touch_oauth_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_oauth_accounts
  SET last_used_at = NOW()
  WHERE user_did = NEW.user_did AND provider = NEW.provider;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (We don't actually fire this — last_used_at is updated explicitly in the service
-- so we can also track per-attempt success/failure.)
DROP FUNCTION IF EXISTS touch_oauth_last_used();