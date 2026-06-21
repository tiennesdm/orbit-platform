#!/bin/bash
# Run database migrations
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env vars
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# Default to docker-compose
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-orbit}"
POSTGRES_USER="${POSTGRES_USER:-orbit}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-orbit_dev_password}"

MIGRATIONS_DIR="$ROOT_DIR/db/migrations"

echo "🗄️  Running migrations against $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration" ]; then
    echo "  → $(basename "$migration")"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -v ON_ERROR_STOP=1 \
      -f "$migration"
  fi
done

echo "✅ Migrations complete"
