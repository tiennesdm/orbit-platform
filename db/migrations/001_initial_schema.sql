-- ============================================================
-- ORBIT Database Schema — Vedadb SQL
-- ============================================================
-- Production target: Vedadb cluster (distributed, billion-user scale)
-- Local dev: Postgres 16+ with PostGIS + pgvector + pg_trgm
--   (Vedadb speaks PostgreSQL wire protocol + extensions)
--
-- Architecture: shard by user_id (consistent hashing)
-- 1024 logical shards, 3 physical regions (us-east, eu-west, ap-south)
-- Sharding key: hash(user_id) % 1024
-- Replication: synchronous to 1 replica, async to other regions

-- ============================================================
-- EXTENSIONS (Vedadb-compatible)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Full-text + fuzzy search (Vedadb full-text)
CREATE EXTENSION IF NOT EXISTS "vector";      -- Vector embeddings (Vedadb vector mode) [pgvector compat]
CREATE EXTENSION IF NOT EXISTS "postgis";     -- Geo-spatial (Vedadb geo mode) [not in pgvector/pgvector:pg16 — will skip if unavailable]
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- Composite GIN indexes
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE post_mode AS ENUM ('intimate', 'public', 'visual', 'community');
CREATE TYPE visibility AS ENUM ('public', 'followers', 'friends', 'private', 'group');
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document');
CREATE TYPE group_role AS ENUM ('member', 'mod', 'admin', 'owner');
CREATE TYPE group_privacy AS ENUM ('public', 'private', 'hidden');
CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'mention', 'ai', 'event', 'subscribe', 'brand_deal');
CREATE TYPE condition_type AS ENUM ('new', 'like_new', 'good', 'fair');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted', 'verifying');

-- ============================================================
-- TABLE: users (Identity)
-- Sharded by did (decentralized identifier)
-- Portable identity: user owns their data, can move between apps
-- ============================================================
CREATE TABLE users (
  did              TEXT PRIMARY KEY,                       -- W3C DID: did:orbit:abc123
  handle           TEXT UNIQUE NOT NULL,                   -- @shubham.ind.in
  domain           TEXT,                                    -- shubham.ind.in (optional verified)
  display_name     TEXT NOT NULL,
  bio              TEXT,
  avatar_cid       TEXT,                                    -- Content-addressed media ref
  cover_cid        TEXT,
  public_key       BYTEA NOT NULL,                          -- Ed25519 pubkey for E2E verification
  identity_key      BYTEA NOT NULL,                          -- Long-term identity key for Signal
  signed_pre_key    BYTEA NOT NULL,                          -- Signed prekey (rotated weekly)
  pre_keys         BYTEA[] NOT NULL DEFAULT '{}',           -- One-time prekeys
  pds_endpoint     TEXT NOT NULL,                           -- Personal Data Server endpoint
  pds_public_key   BYTEA,                                   -- PDS verification key
  reputation_score NUMERIC DEFAULT 100,                    -- DID reputation system
  status           user_status DEFAULT 'active',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_handle ON users USING btree (handle);
CREATE INDEX idx_users_domain ON users USING btree (domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_users_status ON users USING btree (status, created_at DESC);
CREATE INDEX idx_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX idx_users_metadata_gin ON users USING gin (metadata);
CREATE INDEX idx_users_updated_at ON users USING btree (updated_at DESC);

-- ============================================================
-- TABLE: follows (Asymmetric social graph)
-- Sharded by follower_id, replicated for followee_id queries
-- ============================================================
CREATE TABLE follows (
  follower_id     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  followee_id     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  notify_level    SMALLINT DEFAULT 0,                       -- 0=normal, 1=important, 2=muted
  is_close_friend BOOLEAN DEFAULT FALSE,
  is_blocked      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_follows_followee ON follows USING btree (followee_id, created_at DESC);
CREATE INDEX idx_follows_close_friends ON follows USING btree (followee_id) WHERE is_close_friend = TRUE;

-- ============================================================
-- TABLE: posts (4 modes: intimate, public, visual, community)
-- Sharded by author_id, replicated for feed queries
-- ============================================================
CREATE TABLE posts (
  post_id          BIGSERIAL,
  author_id        TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  mode             post_mode NOT NULL,
  visibility       visibility NOT NULL DEFAULT 'followers',
  group_id         BIGINT,                                  -- if posted in a group
  parent_id        BIGINT,                                  -- reply/quote parent
  root_id          BIGINT,                                  -- root of thread (for replies)
  content_text     TEXT,
  media_ids        BIGINT[] DEFAULT '{}',
  media_count      SMALLINT DEFAULT 0,
  hashtags         TEXT[] DEFAULT '{}',
  mentions         TEXT[] DEFAULT '{}',                     -- user DIDs
  language         TEXT DEFAULT 'en',
  like_count       BIGINT DEFAULT 0,
  comment_count    BIGINT DEFAULT 0,
  share_count      BIGINT DEFAULT 0,
  view_count       BIGINT DEFAULT 0,
  quote_count      BIGINT DEFAULT 0,
  is_pinned        BOOLEAN DEFAULT FALSE,
  is_nsfw          BOOLEAN DEFAULT FALSE,
  is_sponsored     BOOLEAN DEFAULT FALSE,
  ai_moderation    JSONB DEFAULT '{}',                      -- toxicity, topics, nsfw_score
  search_vector    TSVECTOR,                                -- full-text index (Vedadb inverted)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  PRIMARY KEY (author_id, post_id)
);

-- Indexes for common queries
CREATE INDEX idx_posts_author_created ON posts USING btree (author_id, created_at DESC);
CREATE INDEX idx_posts_group_created ON posts USING btree (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_root ON posts USING btree (root_id, created_at) WHERE root_id IS NOT NULL;
CREATE INDEX idx_posts_hashtags ON posts USING gin (hashtags);
CREATE INDEX idx_posts_mentions ON posts USING gin (mentions);
CREATE INDEX idx_posts_search ON posts USING gin (search_vector);
CREATE INDEX idx_posts_created_at ON posts USING btree (created_at DESC);
CREATE INDEX idx_posts_pinned ON posts USING btree (group_id, created_at DESC) WHERE is_pinned = TRUE;

-- Trigger to maintain search_vector
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.content_text, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(NEW.hashtags, ' ')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF content_text, hashtags ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

-- ============================================================
-- TABLE: media (Content-addressed media metadata)
-- Blobs stored in S3/CDN, only metadata + CID in Vedadb
-- ============================================================
CREATE TABLE media (
  media_id        BIGSERIAL,
  owner_id        TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  cid             TEXT UNIQUE NOT NULL,                     -- Content ID (IPFS-style hash)
  media_type      media_type NOT NULL,
  storage_url     TEXT NOT NULL,                            -- s3://orbit-prod/media/{cid}
  cdn_url         TEXT NOT NULL,                            -- https://cdn.orbit.com/{cid}
  thumbnail_url   TEXT,
  width           INT,
  height          INT,
  duration_ms     INT,                                      -- video/audio
  size_bytes      BIGINT,
  mime_type       TEXT,
  blurhash        TEXT,                                     -- for placeholder rendering
  hls_manifest    TEXT,                                     -- HLS playlist URL for video
  ai_tags         JSONB DEFAULT '{}',                       -- CLIP embeddings, NSFW, OCR
  is_nsfw         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, media_id)
);
CREATE INDEX idx_media_cid ON media USING btree (cid);
CREATE INDEX idx_media_type ON media USING btree (media_type, created_at DESC);

-- ============================================================
-- TABLE: messages (E2E encrypted DMs)
-- Server stores ONLY ciphertext, cannot decrypt
-- Sharded by thread_id for chat thread queries
-- ============================================================
CREATE TABLE threads (
  thread_id            BIGSERIAL PRIMARY KEY,
  thread_type          SMALLINT NOT NULL,                    -- 0=1:1, 1=group
  participant_ids      TEXT[] NOT NULL,                      -- user DIDs
  created_by           TEXT NOT NULL REFERENCES users(did),
  name                 TEXT,                                 -- group thread name
  icon_cid             TEXT,
  encrypted_key        BYTEA,                                -- sender key for group DMs (encrypted)
  last_message_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_preview TEXT,                                 -- encrypted preview
  unread_counts        JSONB DEFAULT '{}',                   -- {user_did: count}
  muted_by             JSONB DEFAULT '{}',                   -- {user_did: until_timestamp}
  archived_by          TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_threads_participants ON threads USING gin (participant_ids);
CREATE INDEX idx_threads_last_message ON threads USING btree (last_message_at DESC);
-- For 1:1 thread lookup: composite index
CREATE INDEX idx_threads_1to1 ON threads USING btree (participant_ids) WHERE thread_type = 0;

CREATE TABLE messages (
  message_id         BIGSERIAL,
  thread_id          BIGINT NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
  sender_id          TEXT NOT NULL REFERENCES users(did),
  recipient_ids      TEXT[] NOT NULL,
  encrypted_payload  BYTEA NOT NULL,                         -- E2E ciphertext (server cannot read)
  content_type       SMALLINT NOT NULL,                      -- 0=text, 1=image, 2=video, 3=audio, 4=file
  reply_to_id        BIGINT,
  forwarded_from     BIGINT,
  reactions          JSONB DEFAULT '{}',                     -- {emoji: [user_did]}
  read_by            JSONB DEFAULT '{}',                     -- {user_did: timestamp}
  deleted_for        TEXT[] DEFAULT '{}',
  edited_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, message_id)
);
CREATE INDEX idx_messages_sender ON messages USING btree (sender_id, created_at DESC);
CREATE INDEX idx_messages_created ON messages USING btree (created_at DESC);
CREATE INDEX idx_messages_thread_created ON messages USING btree (thread_id, created_at DESC);

-- ============================================================
-- TABLE: stories (ephemeral, 24h default, opt-in persistent)
-- ============================================================
CREATE TABLE stories (
  story_id            BIGSERIAL,
  author_id           TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  media_id            BIGINT NOT NULL,
  text_overlay        TEXT,
  background_color    TEXT,                                   -- hex or gradient
  visibility          SMALLINT NOT NULL DEFAULT 0,            -- 0=public, 1=close_friends, 2=custom
  view_list           TEXT[] DEFAULT '{}',
  close_friends_only  BOOLEAN DEFAULT FALSE,
  ttl_seconds         INT DEFAULT 86400,                     -- 24h default
  is_persistent       BOOLEAN DEFAULT FALSE,
  expires_at          TIMESTAMPTZ NOT NULL,
  view_count          INT DEFAULT 0,
  reply_count         INT DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (author_id, story_id)
);
CREATE INDEX idx_stories_expires ON stories USING btree (expires_at);
CREATE INDEX idx_stories_created ON stories USING btree (created_at DESC);

-- ============================================================
-- TABLE: reels (short-form video metadata)
-- ============================================================
CREATE TABLE reels (
  reel_id            BIGSERIAL,
  author_id          TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  media_id           BIGINT NOT NULL,
  caption            TEXT,
  audio_track_id     BIGINT,
  audio_start_ms     INT,
  hashtags           TEXT[] DEFAULT '{}',
  duration_ms        INT NOT NULL,
  thumbnail_cid      TEXT,
  view_count         BIGINT DEFAULT 0,
  like_count         BIGINT DEFAULT 0,
  comment_count      BIGINT DEFAULT 0,
  share_count        BIGINT DEFAULT 0,
  save_count         BIGINT DEFAULT 0,
  ai_topics          JSONB DEFAULT '{}',
  search_vector      TSVECTOR,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (author_id, reel_id)
);
CREATE INDEX idx_reels_created ON reels USING btree (created_at DESC);
CREATE INDEX idx_reels_hashtags ON reels USING gin (hashtags);
CREATE INDEX idx_reels_search ON reels USING gin (search_vector);
CREATE INDEX idx_reels_views ON reels USING btree (view_count DESC) WHERE view_count > 1000;

CREATE TRIGGER reels_search_vector_update BEFORE INSERT OR UPDATE OF caption, hashtags ON reels
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

-- ============================================================
-- TABLE: groups (communities)
-- ============================================================
CREATE TABLE groups (
  group_id        BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  cover_cid       TEXT,
  icon_cid        TEXT,
  privacy         group_privacy NOT NULL DEFAULT 'public',
  member_count    INT DEFAULT 1,
  post_count      INT DEFAULT 0,
  rules           TEXT,
  topics          TEXT[] DEFAULT '{}',
  created_by      TEXT NOT NULL REFERENCES users(did),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector   TSVECTOR
);
CREATE INDEX idx_groups_topics ON groups USING gin (topics);
CREATE INDEX idx_groups_search ON groups USING gin (search_vector);
CREATE INDEX idx_groups_member_count ON groups USING btree (member_count DESC);

CREATE TABLE group_members (
  group_id        BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  role            group_role NOT NULL DEFAULT 'member',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted_until     TIMESTAMPTZ,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON group_members USING btree (user_id);
CREATE INDEX idx_group_members_role ON group_members USING btree (group_id, role);

-- ============================================================
-- TABLE: events (community events)
-- ============================================================
CREATE TABLE events (
  event_id           BIGSERIAL PRIMARY KEY,
  group_id           BIGINT REFERENCES groups(group_id) ON DELETE CASCADE,
  creator_id         TEXT NOT NULL REFERENCES users(did),
  title              TEXT NOT NULL,
  description        TEXT,
  cover_cid          TEXT,
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ,
  location_type      SMALLINT,                               -- 0=online, 1=physical, 2=hybrid
  location           TEXT,
  location_geo       GEOGRAPHY(POINT, 4326),                 -- PostGIS
  rsvp_going         INT DEFAULT 0,
  rsvp_interested    INT DEFAULT 0,
  is_ticketed        BOOLEAN DEFAULT FALSE,
  ticket_price_cents BIGINT,
  currency           TEXT DEFAULT 'INR',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_starts ON events USING btree (starts_at);
CREATE INDEX idx_events_group ON events USING btree (group_id, starts_at);
CREATE INDEX idx_events_geo ON events USING gist (location_geo);

-- ============================================================
-- TABLE: marketplace_listings (items for sale)
-- ============================================================
CREATE TABLE marketplace_listings (
  listing_id        BIGSERIAL PRIMARY KEY,
  seller_id         TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  price_cents       BIGINT NOT NULL,
  currency          TEXT DEFAULT 'INR',
  media_ids         BIGINT[] DEFAULT '{}',
  category          TEXT,
  item_condition    condition_type,
  location_label    TEXT,
  location_geo      GEOGRAPHY(POINT, 4326),
  status           SMALLINT DEFAULT 0,                       -- 0=active, 1=sold, 2=removed
  view_count        INT DEFAULT 0,
  search_vector     TSVECTOR,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_marketplace_seller ON marketplace_listings USING btree (seller_id, created_at DESC);
CREATE INDEX idx_marketplace_category ON marketplace_listings USING btree (category, created_at DESC);
CREATE INDEX idx_marketplace_geo ON marketplace_listings USING gist (location_geo);
CREATE INDEX idx_marketplace_search ON marketplace_listings USING gin (search_vector);
CREATE INDEX idx_marketplace_status ON marketplace_listings USING btree (status, created_at DESC) WHERE status = 0;

-- ============================================================
-- TABLE: notifications (per-user feed)
-- AI-organized, with dedup + smart batching
-- ============================================================
CREATE TABLE notifications (
  notification_id   BIGSERIAL,
  user_id           TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  actor_id          TEXT REFERENCES users(did),
  type              notification_type NOT NULL,
  target_type       SMALLINT,                                -- 0=post, 1=reel, 2=story, 3=event, 4=listing
  target_id         BIGINT,
  payload           JSONB DEFAULT '{}',
  is_read           BOOLEAN DEFAULT FALSE,
  is_muted          BOOLEAN DEFAULT FALSE,
  ai_priority       SMALLINT DEFAULT 50,                     -- 0=critical, 100=low
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_id)
);
CREATE INDEX idx_notif_unread ON notifications USING btree (user_id, is_read, ai_priority, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notif_actor ON notifications USING btree (actor_id);
CREATE INDEX idx_notif_target ON notifications USING btree (target_type, target_id);

-- ============================================================
-- TABLE: ai_agent_state (per-user AI agent memory)
-- ============================================================
CREATE TABLE ai_agent_state (
  user_id            TEXT PRIMARY KEY REFERENCES users(did) ON DELETE CASCADE,
  personality        TEXT DEFAULT 'helpful',
  autonomy_level     SMALLINT DEFAULT 1,                     -- 0=ask, 1=suggest, 2=auto
  enabled_features   JSONB DEFAULT '{}',                    -- {feature: bool}
  long_term_memory   JSONB DEFAULT '{}',                    -- facts, preferences, relationships
  episodic_memory    JSONB DEFAULT '{}',                    -- selective event memories
  context_window_size INT DEFAULT 4096,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: embeddings (vector mode — semantic search, recommendations)
-- Vector dim: 1536 (OpenAI ada-002) or 1024 (Llama)
-- Using pgvector in dev; Vedadb has native vector type in prod
-- ============================================================
CREATE TABLE embeddings (
  entity_type        SMALLINT NOT NULL,                     -- 0=user, 1=post, 2=reel, 3=story
  entity_id          BIGINT NOT NULL,
  embedding          VECTOR(1536) NOT NULL,
  model_version      TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id)
);
-- ANN index using HNSW (production uses Vedadb native HNSW)
CREATE INDEX idx_embeddings_ann ON embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- TABLE: orbit_cache (Vedadb in-memory tier — Redis-compatible)
-- Used for: rate limiting, session cache, hot counters, ephemeral state
-- ============================================================
CREATE TABLE orbit_cache (
  cache_key        TEXT PRIMARY KEY,
  cache_value      JSONB NOT NULL,
  expires_at       TIMESTAMPTZ,
  ttl_seconds      INT,
  hit_count        BIGINT DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cache_expires ON orbit_cache USING btree (expires_at) WHERE expires_at IS NOT NULL;
-- Auto-cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS void AS $$
BEGIN
  DELETE FROM orbit_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: orbit_streams (Vedadb pub/sub — Redis Streams-compatible)
-- Used for: notification fanout, DM delivery, agent activity log, live broadcast
-- ============================================================
CREATE TABLE orbit_streams (
  stream_id         BIGSERIAL PRIMARY KEY,
  channel           TEXT NOT NULL,                            -- e.g., "dm:user:12345", "notif:user:12345"
  stream_key        TEXT,                                    -- optional grouping
  payload           JSONB NOT NULL,
  priority          SMALLINT DEFAULT 50,
  processed         BOOLEAN DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,                     -- TTL
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_streams_channel ON orbit_streams USING btree (channel, created_at DESC) WHERE processed = FALSE;
CREATE INDEX idx_streams_expires ON orbit_streams USING btree (expires_at);

-- ============================================================
-- TABLE: subscriptions (creator monetization)
-- ============================================================
CREATE TABLE subscriptions (
  subscriber_id     TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  creator_id        TEXT NOT NULL REFERENCES users(did) ON DELETE CASCADE,
  tier              SMALLINT NOT NULL DEFAULT 1,             -- 1, 2, 3
  price_cents       BIGINT NOT NULL,
  currency          TEXT DEFAULT 'INR',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renews_at         TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  is_active         BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (subscriber_id, creator_id)
);
CREATE INDEX idx_subs_creator ON subscriptions USING btree (creator_id, is_active, started_at DESC);

-- ============================================================
-- TABLE: reports (content moderation)
-- ============================================================
CREATE TABLE reports (
  report_id         BIGSERIAL PRIMARY KEY,
  reporter_id       TEXT NOT NULL REFERENCES users(did),
  target_type       SMALLINT NOT NULL,                       -- 0=post, 1=user, 2=reel, 3=story, 4=message
  target_id         BIGINT NOT NULL,
  reason            TEXT NOT NULL,
  description       TEXT,
  status            SMALLINT DEFAULT 0,                      -- 0=open, 1=reviewed, 2=action_taken, 3=dismissed
  ai_classification JSONB DEFAULT '{}',                     -- auto-categorized
  reviewed_by       TEXT REFERENCES users(did),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_status ON reports USING btree (status, created_at DESC);
CREATE INDEX idx_reports_target ON reports USING btree (target_type, target_id);

-- ============================================================
-- SEED DATA (optional — for local dev)
-- ============================================================
-- Insert demo user, follows, posts for testing
-- Real seed data lives in scripts/seed.ts

-- ============================================================
-- GRANTS (production)
-- ============================================================
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO orbit_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO orbit_app;

-- ============================================================
-- SHARDING NOTES (Vedadb specific)
-- ============================================================
-- In production with Vedadb, tables are sharded by:
--   users, follows, posts, media, stories, reels, subscriptions, ai_agent_state
--     → SHARD BY did (or hash(did) % 1024)
--   messages, threads
--     → SHARD BY thread_id
--   groups, group_members, events, marketplace_listings, notifications, reports
--     → SHARD BY respective ID
--   orbit_cache, orbit_streams
--     → DISTRIBUTED (any shard, Vedadb handles pub/sub routing)
--
-- Vedadb queries should use sharding hints:
--   SELECT /*+ SHARD(did='did:orbit:abc123') */ * FROM users WHERE did = 'did:orbit:abc123';
--
-- For more details, see Vedadb docs: https://vedadb.io/docs/sharding
