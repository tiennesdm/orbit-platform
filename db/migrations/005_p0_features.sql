-- Migration 005: P0 feature tables
-- Adds: voice rooms, monetization, custom feeds, federation,
--        anti-addiction, remix, AI co-creation

-- ============================================================
-- Voice rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_rooms (
  id           TEXT PRIMARY KEY,
  host_did     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, live, ended
  visibility   TEXT NOT NULL DEFAULT 'public',    -- public, intimate, close_friends
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  recording_cid TEXT,        -- if recorded + user consented
  peak_speakers INT DEFAULT 0,
  peak_listeners INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_rooms_host ON voice_rooms (host_did, started_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_voice_rooms_status ON voice_rooms (status, started_at DESC NULLS LAST) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_voice_rooms_scheduled ON voice_rooms (scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS voice_room_participants (
  room_id    TEXT NOT NULL REFERENCES voice_rooms(id) ON DELETE CASCADE,
  user_did   TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'listener', -- host, speaker, listener
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at    TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_did, joined_at)
);

CREATE INDEX IF NOT EXISTS idx_voice_room_participants_user ON voice_room_participants (user_did, joined_at DESC);

-- ============================================================
-- Creator monetization
-- ============================================================
CREATE TABLE IF NOT EXISTS tips (
  id            TEXT PRIMARY KEY,
  from_did      TEXT NOT NULL REFERENCES users(did),
  to_did        TEXT NOT NULL REFERENCES users(did),
  amount_paise  BIGINT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'INR',
  message       TEXT,
  post_id       TEXT, -- optional, tip on a specific post
  status        TEXT NOT NULL DEFAULT 'pending', -- pending, completed, refunded, failed
  payment_ref   TEXT, -- gateway ref
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_to ON tips (to_did, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_from ON tips (from_did, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,
  subscriber_did TEXT NOT NULL REFERENCES users(did),
  creator_did   TEXT NOT NULL REFERENCES users(did),
  tier_id       TEXT NOT NULL,        -- 'basic', 'pro', 'vip'
  amount_paise  BIGINT NOT NULL,      -- per billing cycle
  currency      TEXT NOT NULL DEFAULT 'INR',
  status        TEXT NOT NULL DEFAULT 'active', -- active, paused, cancelled, expired
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renews_at     TIMESTAMPTZ NOT NULL,
  cancelled_at  TIMESTAMPTZ,
  UNIQUE (subscriber_did, creator_did)
);

CREATE INDEX IF NOT EXISTS idx_subs_creator ON subscriptions (creator_did, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subs_renews ON subscriptions (renews_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id            TEXT NOT NULL,
  creator_did   TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  amount_paise  BIGINT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'INR',
  color         TEXT,
  benefits      TEXT[] DEFAULT '{}',
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (creator_did, id)
);

CREATE INDEX IF NOT EXISTS idx_sub_tiers_creator ON subscription_tiers (creator_did, position);

CREATE TABLE IF NOT EXISTS paid_posts (
  post_id       TEXT PRIMARY KEY,
  author_did    TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  min_tier_id   TEXT NOT NULL,
  preview_text  TEXT,
  full_content  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paid_posts_author ON paid_posts (author_did);

-- ============================================================
-- Custom feeds (user-defined algorithms)
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_feeds (
  id            TEXT PRIMARY KEY,
  owner_did     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  rules         JSONB NOT NULL,        -- array of rule objects
  pin_order     INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_feeds_owner ON custom_feeds (owner_did, pin_order);
CREATE INDEX IF NOT EXISTS idx_custom_feeds_public ON custom_feeds (is_public) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS user_feed_subscriptions (
  user_did      TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  feed_id       TEXT NOT NULL REFERENCES custom_feeds(id) ON DELETE CASCADE,
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_did, feed_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_subs_user ON user_feed_subscriptions (user_did, pinned DESC, subscribed_at DESC);

-- ============================================================
-- Federation (AT Protocol compatible)
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_handles (
  handle        TEXT PRIMARY KEY,         -- e.g., alice.bsky.social or alice.com
  did           TEXT NOT NULL UNIQUE,     -- did:plc:xxx or did:orbit:xxx
  pds_endpoint  TEXT NOT NULL,            -- e.g., https://bsky.social
  public_key    TEXT,                     -- for verification
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_federation_did ON federation_handles (did);

CREATE TABLE IF NOT EXISTS domain_handles (
  domain        TEXT PRIMARY KEY,         -- e.g., alice.com
  owner_did     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  txt_token     TEXT NOT NULL,            -- DNS TXT record verification token
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at   TIMESTAMPTZ,
  ssl_status    TEXT,                     -- ok, missing, expired
  ssl_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_handles_owner ON domain_handles (owner_did);

-- ============================================================
-- Anti-addiction
-- ============================================================
CREATE TABLE IF NOT EXISTS user_wellness (
  user_did             TEXT PRIMARY KEY REFERENCES users(did) ON DELETE CASCADE,
  daily_minutes_limit  INT NOT NULL DEFAULT 0,        -- 0 = no limit
  weekly_minutes_limit INT NOT NULL DEFAULT 0,
  slow_mode            BOOLEAN NOT NULL DEFAULT FALSE, -- show one post at a time
  hide_likes_count     BOOLEAN NOT NULL DEFAULT FALSE,
  hide_reposts_count   BOOLEAN NOT NULL DEFAULT FALSE,
  hide_followers_count BOOLEAN NOT NULL DEFAULT FALSE,
  no_infinitescroll    BOOLEAN NOT NULL DEFAULT TRUE,
  show_timer           BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start    TEXT,                          -- 'HH:MM' 24h, e.g., '22:00'
  quiet_hours_end      TEXT,                          -- e.g., '08:00'
  reminder_interval_min INT NOT NULL DEFAULT 30,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_did     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  day          DATE NOT NULL,
  seconds      INT NOT NULL DEFAULT 0,
  sessions     INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_did, day)
);

CREATE INDEX IF NOT EXISTS idx_session_logs_user_day ON session_logs (user_did, day DESC);

CREATE TABLE IF NOT EXISTS parental_controls (
  guardian_did TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  minor_did    TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  daily_minutes_limit INT NOT NULL DEFAULT 40,         -- China-style cap
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (guardian_did, minor_did)
);

-- ============================================================
-- Remix (Duet / Stitch / Quote)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_remixes (
  remix_post_id   TEXT PRIMARY KEY,                   -- the new post
  source_post_id  TEXT NOT NULL,                       -- the post being remixed
  kind            TEXT NOT NULL,                       -- duet, stitch, quote
  layout          JSONB,                               -- position/style metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_remixes_source ON post_remixes (source_post_id);
CREATE INDEX IF NOT EXISTS idx_post_remixes_remix ON post_remixes (remix_post_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_paywalled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS min_tier_id TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tip_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS remix_of TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS root_post_id TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_tool TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_prompt TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_remix_of ON posts (remix_of) WHERE remix_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_root ON posts (root_post_id) WHERE root_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_paywalled ON posts (is_paywalled) WHERE is_paywalled = TRUE;

-- ============================================================
-- AI co-creation: prompt templates + usage
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_assets (
  id          TEXT PRIMARY KEY,
  owner_did   TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  kind        TEXT NOT NULL, -- image, video, caption, audio
  prompt      TEXT NOT NULL,
  url         TEXT,           -- storage URL (IPFS/local/etc.)
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_assets_owner ON ai_assets (owner_did, created_at DESC);
