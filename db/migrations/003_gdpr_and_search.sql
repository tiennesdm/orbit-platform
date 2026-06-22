-- Add GDPR soft-delete columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled ON users(deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Drop the old search vector trigger (used posts_search_vector function referenced non-existent content_text)
DROP TRIGGER IF EXISTS posts_search_vector_update ON posts;
DROP FUNCTION IF EXISTS posts_search_vector_update() CASCADE;

-- Replace with a fresh one (use ::text cast for enum mode field)
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.content_text::text, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(NEW.hashtags, ARRAY[]::text[]), ' ')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.mode::text, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_vector_update BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

-- Backfill the search vector
UPDATE posts SET content_text = content_text WHERE search_vector IS NULL;
