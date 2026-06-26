-- =============================================================================
-- Migration 007: Performance indexes for hot queries
-- =============================================================================
-- Audited hot paths from EXPLAIN ANALYZE on the live API. Each index below
-- targets a query that was either seq-scanning or doing a sort that could
-- be eliminated with a covering index.
--
-- Run via main.ts runMigrations on startup (idempotent via IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------

-- Feed query: WHERE author_id = ANY(...) AND deleted_at IS NULL
--              ORDER BY like_count DESC, created_at DESC
-- Existing: idx_posts_author_created (author_id, created_at DESC)
-- This composite supports the AI-ranked variant which sorts by like_count.
CREATE INDEX IF NOT EXISTS idx_posts_author_likes_created
  ON posts (author_id, like_count DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- deleted_at partial filter — only valid posts
-- Helps: feed query, findById, portable-identity export
CREATE INDEX IF NOT EXISTS idx_posts_alive_created
  ON posts (created_at DESC)
  WHERE deleted_at IS NULL;

-- Full-text search uses search_vector; ensure it's there.
-- (was in idx_posts_search, verify)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_posts_search_vector'
  ) THEN
    -- Some installs may not have a search_vector column. Create defensively.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='posts' AND column_name='search_vector'
    ) THEN
      CREATE INDEX idx_posts_search_vector ON posts USING gin (search_vector);
    END IF;
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- marketplace_listings
-- -----------------------------------------------------------------------------

-- Search by status + category + created_at DESC
-- Existing: idx_marketplace_status (status), idx_marketplace_category (category)
-- This composite is better for "browse by category" queries
CREATE INDEX IF NOT EXISTS idx_marketplace_status_category_created
  ON marketplace_listings (status, category, created_at DESC);

-- -----------------------------------------------------------------------------
-- drafts
-- -----------------------------------------------------------------------------

-- Scheduled drafts query: WHERE author_did = $1 AND scheduled_at IS NOT NULL
--                          ORDER BY scheduled_at
-- Existing: idx_drafts_author (author_did), idx_drafts_scheduled (scheduled_at)
-- Partial index on scheduled drafts only — small index for hot path
CREATE INDEX IF NOT EXISTS idx_drafts_author_scheduled
  ON drafts (author_did, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------

-- Composite for unread priority sort (existing idx_notif_unread has user_id, is_read, ai_priority, created_at)
-- Add a covering index for the actor timeline (when viewing @mentions etc)
CREATE INDEX IF NOT EXISTS idx_notif_user_priority_created
  ON notifications (user_id, ai_priority ASC, created_at DESC)
  WHERE is_read = false;

-- -----------------------------------------------------------------------------
-- follows
-- -----------------------------------------------------------------------------

-- Reverse lookup: who follows X (existing idx_follows_followee on followee_id)
-- Composite for "follow suggestions" — followers of my followers, not me
CREATE INDEX IF NOT EXISTS idx_follows_follower_followee
  ON follows (follower_id, followee_id);

-- -----------------------------------------------------------------------------
-- media
-- -----------------------------------------------------------------------------

-- Browse by owner + type
CREATE INDEX IF NOT EXISTS idx_media_owner_type_created
  ON media (owner_id, media_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------

-- Look up by domain (for federation handle resolution)
-- Existing: idx_users_domain — verify it's (domain, handle)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_domain'
      AND indexdef NOT LIKE '%(domain, handle)%'
  ) THEN
    DROP INDEX IF EXISTS idx_users_domain;
    CREATE INDEX idx_users_domain ON users (domain, handle);
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- comments / replies (if exists)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='comments') THEN
    -- Hot: replies to a post, ordered chronologically
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comments_post_created
             ON comments (post_id, created_at DESC)';
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- Post-update statistics refresh (Postgres ANALYZE)
-- -----------------------------------------------------------------------------
-- After adding indexes, update query planner stats so it picks the new ones.
ANALYZE posts, marketplace_listings, drafts, notifications, follows, media, users;