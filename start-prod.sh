#!/usr/bin/env bash
# =============================================================================
# ORBIT production startup script
# Usage:   ./start-prod.sh                  # one-time start
#          ./start-prod.sh --migrate        # run migrations only
#          ./start-prod.sh --logs           # tail logs
#          ./start-prod.sh --stop           # graceful stop
#          ./start-prod.sh --restart        # restart
#          ./start-prod.sh --status         # process status
#          ./start-prod.sh --doctor         # diagnose issues
# =============================================================================
set -euo pipefail

ORBIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ORBIT_ROOT"

LOG_DIR="$ORBIT_ROOT/logs"
mkdir -p "$LOG_DIR"
mkdir -p "$ORBIT_ROOT/backups"

# Load .env if it exists
if [ -f "$ORBIT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ORBIT_ROOT/.env"
  set +a
else
  echo "ERROR: .env file not found at $ORBIT_ROOT/.env"
  echo "Copy .env.example to .env and fill in real values."
  exit 1
fi

# Validate required vars
REQUIRED_VARS=(JWT_SECRET VEDADB_HOST VEDADB_PORT VEDADB_USER VEDADB_PASSWORD VEDADB_DATABASE)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING+=("$var")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: Missing required env vars: ${MISSING[*]}"
  exit 1
fi

# Check JWT secret strength in production
if [ "${NODE_ENV:-development}" = "production" ]; then
  if [ "${#JWT_SECRET}" -lt 32 ]; then
    echo "ERROR: JWT_SECRET must be at least 32 chars in production (current: ${#JWT_SECRET})"
    exit 1
  fi
  if [[ "$JWT_SECRET" == *"change_me"* ]] || [[ "$JWT_SECRET" == *"dev_secret"* ]]; then
    echo "ERROR: JWT_SECRET looks like a default value. Generate a real one:"
    echo "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\""
    exit 1
  fi
fi

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

cmd="${1:-start}"

case "$cmd" in
  --migrate)
    log "Running database migrations..."
    PGPASSWORD="$VEDADB_PASSWORD" psql \
      -h "$VEDADB_HOST" -p "$VEDADB_PORT" -U "$VEDADB_USER" -d "$VEDADB_DATABASE" \
      -v ON_ERROR_STOP=1 \
      -f db/migrations/001_initial_schema.sql
    log "Migrations complete ✓"
    exit 0
    ;;

  --logs)
    if command -v pm2 >/dev/null 2>&1; then
      pm2 logs orbit-api
    else
      tail -f "$LOG_DIR"/api-*.log
    fi
    ;;

  --stop)
    log "Stopping ORBIT API..."
    if command -v pm2 >/dev/null 2>&1; then
      pm2 stop orbit-api || true
      pm2 delete orbit-api || true
    else
      # Find and kill node process running main.ts
      pkill -f "ts-node.*main.ts" || true
    fi
    log "Stopped ✓"
    exit 0
    ;;

  --restart)
    log "Restarting ORBIT API..."
    if command -v pm2 >/dev/null 2>&1; then
      pm2 restart orbit-api
    else
      pkill -f "ts-node.*main.ts" || true
      sleep 2
    fi
    # fallthrough to start
    ;;

  --status)
    if command -v pm2 >/dev/null 2>&1; then
      pm2 status orbit-api
    else
      if pgrep -f "ts-node.*main.ts" >/dev/null; then
        log "ORBIT API is RUNNING (no PM2)"
        pgrep -fl "ts-node.*main.ts"
      else
        log "ORBIT API is NOT running"
      fi
    fi
    exit 0
    ;;

  --doctor)
    log "Running diagnostics..."
    echo "---"
    echo "1. .env file:"
    [ -f "$ORBIT_ROOT/.env" ] && echo "  ✓ exists" || echo "  ✗ MISSING"
    echo ""
    echo "2. JWT_SECRET length: ${#JWT_SECRET}"
    if [ "${#JWT_SECRET}" -ge 32 ]; then echo "  ✓ OK"; else echo "  ✗ TOO SHORT"; fi
    echo ""
    echo "3. Database connectivity:"
    PGPASSWORD="$VEDADB_PASSWORD" psql \
      -h "$VEDADB_HOST" -p "$VEDADB_PORT" -U "$VEDADB_USER" -d "$VEDADB_DATABASE" \
      -c "SELECT '✓ connected' AS status, version();" 2>&1 | head -5
    echo ""
    echo "4. Port ${API_PORT:-4000} availability:"
    if lsof -i ":${API_PORT:-4000}" -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
      lsof -i ":${API_PORT:-4000}" -sTCP:LISTEN 2>/dev/null
    else
      echo "  ✓ free"
    fi
    echo ""
    echo "5. Disk space:"
    df -h "$ORBIT_ROOT" | head -2
    echo ""
    echo "6. Node version:"
    node --version
    echo ""
    echo "7. PM2:"
    if command -v pm2 >/dev/null 2>&1; then
      pm2 --version
    else
      echo "  not installed (using direct node)"
    fi
    exit 0
    ;;

  start|*)
    log "Starting ORBIT API..."
    log "  Node ENV: ${NODE_ENV:-development}"
    log "  API port: ${API_PORT:-4000}"
    log "  DB: ${VEDADB_ENGINE} @ ${VEDADB_HOST}:${VEDADB_PORT}/${VEDADB_DATABASE}"

    if command -v pm2 >/dev/null 2>&1; then
      log "Using PM2 (zero-downtime reload, log rotation)"
      pm2 start ecosystem.config.cjs
      pm2 save
      log "Started ✓ (pm2 status: pm2 list)"
    else
      log "PM2 not installed, running directly with nohup"
      log "(Install PM2 for production: npm i -g pm2)"
      # Export .env vars (compatible with both BSD and GNU env)
      set -a
      # shellcheck disable=SC1090
      . "$ORBIT_ROOT/.env"
      set +a
      nohup env TS_NODE_TRANSPILE_ONLY=true \
        ./apps/api/node_modules/.bin/ts-node \
        --project apps/api/tsconfig.json \
        --transpile-only \
        -r tsconfig-paths/register \
        apps/api/src/main.ts \
        > "$LOG_DIR/api-out.log" 2> "$LOG_DIR/api-err.log" &
      sleep 5
      if curl -sf "http://127.0.0.1:${API_PORT:-4000}/api/v1/health/live" >/dev/null; then
        log "Started ✓ (PID $!)"
      else
        log "FAILED to start, see $LOG_DIR/api-err.log"
        tail -20 "$LOG_DIR/api-err.log"
        exit 1
      fi
    fi
    log "API:   http://127.0.0.1:${API_PORT:-4000}/api/v1"
    log "Docs:  http://127.0.0.1:${API_PORT:-4000}/api/docs  (dev only)"
    log "Logs:  ./start-prod.sh --logs"
    ;;
esac
