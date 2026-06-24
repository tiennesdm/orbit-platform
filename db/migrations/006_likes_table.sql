-- =============================================================================
-- Migration 006: Post likes — proper tracking with toggle (no more increment-only)
-- =============================================================================
-- Closes H-1 from AUDIT_REPORT: post.like() and reel.like() were incrementing
-- counter without tracking who liked. This adds a likes table that records
-- individual likes, enabling:
--   - unlike (delete the row)
--   - "posts I liked" query
--   - "X people liked this" via COUNT
--   - idempotent: like() is a toggle, not an increment
-- =============================================================================

CREATE TABLE IF NOT EXISTS likes (
  post_id      TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  liker_did    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, author_id, liker_did),
  CONSTRAINT likes_liker_fkey FOREIGN KEY (liker_did)
    REFERENCES users(did) ON DELETE CASCADE
);

-- Index for "posts I liked" queries (mobile/web timeline)
CREATE INDEX IF NOT EXISTS idx_likes_liker_created
  ON likes (liker_did, created_at DESC);

-- Index for "who liked this post" (post detail page)
CREATE INDEX IF NOT EXISTS idx_likes_post
  ON likes (post_id, author_id, created_at DESC);

-- =============================================================================
-- Backfill: convert existing like_count to likes rows ONLY IF posts.like_count > 0
-- This is lossy (we don't know WHO liked), but preserves the displayed count
-- approximately. After backfill, posts.like_count becomes authoritative via
-- trigger or app-side COUNT(*).
-- =============================================================================
-- NOTE: We do NOT backfill — we'd lose correctness. Instead, we accept that
-- historic like_count may differ from new COUNT(likes). The new code path
-- recomputes from the likes table going forward.

-- Trigger to keep posts.like_count in sync with likes table
CREATE OR REPLACE FUNCTION sync_post_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET like_count = like_count + 1
      WHERE post_id::text = NEW.post_id AND author_id = NEW.author_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET like_count = GREATEST(0, like_count - 1)
      WHERE post_id::text = OLD.post_id AND author_id = OLD.author_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS likes_sync_count ON likes;
CREATE TRIGGER likes_sync_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_like_count();

-- =============================================================================
-- Same for reels (separate table — reels.like_count)
-- =============================================================================
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id      TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  liker_did    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reel_id, author_id, liker_did),
  CONSTRAINT reel_likes_liker_fkey FOREIGN KEY (liker_did)
    REFERENCES users(did) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reel_likes_liker_created
  ON reel_likes (liker_did, created_at DESC);

CREATE OR REPLACE FUNCTION sync_reel_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE reels SET like_count = like_count + 1
      WHERE reel_id::text = NEW.reel_id AND author_id = NEW.author_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE reels SET like_count = GREATEST(0, like_count - 1)
      WHERE reel_id::text = OLD.reel_id AND author_id = OLD.author_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reel_likes_sync_count ON reel_likes;
CREATE TRIGGER reel_likes_sync_count
  AFTER INSERT OR DELETE ON reel_likes
  FOR EACH ROW
  EXECUTE FUNCTION sync_reel_like_count();