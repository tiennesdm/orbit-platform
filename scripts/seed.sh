#!/bin/bash
# Seed database with demo data
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-orbit}"
POSTGRES_USER="${POSTGRES_USER:-orbit}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-orbit_dev_password}"

echo "🌱 Seeding database with demo data..."

# Use psql to insert demo users + posts
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 <<'EOF'

-- Demo users
INSERT INTO users (did, handle, display_name, bio, public_key, identity_key, signed_pre_key, pre_keys, pds_endpoint)
VALUES
  ('did:orbit:demo_alice', 'alice', 'Alice Chen', 'Designer @ Aura CRM', '\x00', '\x00', '\x00', '{}', 'https://pds.orbit.com/did:orbit:demo_alice'),
  ('did:orbit:demo_bob', 'bob', 'Bob Singh', 'Backend eng @ Vedadb', '\x00', '\x00', '\x00', '{}', 'https://pds.orbit.com/did:orbit:demo_bob'),
  ('did:orbit:demo_carol', 'carol', 'Carol Mehta', 'PM + AI enthusiast', '\x00', '\x00', '\x00', '{}', 'https://pds.orbit.com/did:orbit:demo_carol')
ON CONFLICT (did) DO NOTHING;

-- Demo follows
INSERT INTO follows (follower_id, followee_id, created_at)
VALUES
  ('did:orbit:demo_alice', 'did:orbit:demo_bob', NOW()),
  ('did:orbit:demo_alice', 'did:orbit:demo_carol', NOW()),
  ('did:orbit:demo_bob', 'did:orbit:demo_alice', NOW())
ON CONFLICT DO NOTHING;

-- Demo posts
INSERT INTO posts (author_id, mode, visibility, content_text, hashtags, mentions, created_at)
VALUES
  ('did:orbit:demo_bob', 'public', 'public', 'Just shipped a new feature on Vedadb — billion-row benchmarks are now passing! The future of distributed SQL is here. 🚀', ARRAY['#distributed','#database','#vidadb'], ARRAY['@alice'], NOW() - INTERVAL '2 hours'),
  ('did:orbit:demo_carol', 'visual', 'public', 'Working on a new UI mockup for ORBIT — the floating capsule nav is going to be 🔥', ARRAY['#design','#ui'], '{}', NOW() - INTERVAL '4 hours'),
  ('did:orbit:demo_alice', 'intimate', 'friends', 'Thanks for the birthday wishes everyone! 🎂', '{}', '{}', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

SELECT '✅ Seed complete';
EOF

echo "✅ Demo data seeded"
