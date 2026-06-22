-- Migration 004: profile enhancements + auth fields
-- Adds: email (recovery + verification), theme_color, link fields,
--        2FA backup codes, email_verified, premium status

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#4338CA';
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_twitter TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_github TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_linkedin TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_custom_label TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_custom_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_tier TEXT DEFAULT 'free'; -- free, pro, creator
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_badge TEXT; -- 'verified', 'founder', 'creator', etc.

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users (email_verified) WHERE email_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_premium ON users (premium_tier) WHERE premium_tier != 'free';

-- ============================================================
-- Drafts table — post drafts (per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS drafts (
  id           TEXT PRIMARY KEY,
  author_did   TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  mode         TEXT NOT NULL DEFAULT 'public',
  content_text TEXT NOT NULL DEFAULT '',
  media_ids    TEXT[] DEFAULT '{}',
  hashtags     TEXT[] DEFAULT '{}',
  mentions     TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_author ON drafts (author_did, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON drafts (scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ============================================================
-- Pinned posts (per user, ordered)
-- ============================================================
CREATE TABLE IF NOT EXISTS pinned_posts (
  user_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  post_id  TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_did, post_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_user ON pinned_posts (user_did, position);

-- ============================================================
-- Lists (mute, block, custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_lists (
  id          TEXT PRIMARY KEY,
  owner_did   TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'custom', -- 'mute', 'block', 'close_friends', 'custom'
  emoji       TEXT,
  member_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_owner ON user_lists (owner_did, kind);

CREATE TABLE IF NOT EXISTS user_list_members (
  list_id    TEXT NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  user_did   TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_did)
);

CREATE INDEX IF NOT EXISTS idx_list_members_user ON user_list_members (user_did);

-- ============================================================
-- Add email column to existing tables if needed
-- ============================================================
COMMENT ON COLUMN users.email IS 'Optional email for recovery + verification (unique when set)';
COMMENT ON COLUMN users.theme_color IS 'User-chosen theme accent color (hex)';
COMMENT ON COLUMN users.premium_tier IS 'free, pro, or creator subscription tier';
