#!/bin/bash
# Reset database (drop + recreate + migrate)
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

echo "⚠️  Resetting database $POSTGRES_DB..."

PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}; CREATE DATABASE ${POSTGRES_DB};"

"$SCRIPT_DIR/migrate.sh"
"$SCRIPT_DIR/seed.sh"

echo "✅ Database reset complete"
