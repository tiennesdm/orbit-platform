#!/usr/bin/env bash
# =============================================================================
# ORBIT Database Backup
# Usage:   ./scripts/backup.sh                  # manual backup
#          ./scripts/backup.sh --restore <file> # restore from backup
#          ./scripts/backup.sh --list           # list existing backups
#
# Add to crontab for daily backups:
#   0 2 * * * /path/to/orbit/scripts/backup.sh >> /var/log/orbit-backup.log 2>&1
# =============================================================================
set -euo pipefail

ORBIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ORBIT_ROOT"

# Load .env
if [ -f "$ORBIT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ORBIT_ROOT/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ORBIT_ROOT/backups}"
mkdir -p "$BACKUP_DIR"

# Retention: keep last N days
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Compression
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/orbit_${VEDADB_DATABASE:-orbit}_${TIMESTAMP}.sql.gz"

# Engine note
echo "[$(date +'%Y-%m-%d %H:%M:%S')] ORBIT backup starting"
echo "  Engine: ${VEDADB_ENGINE:-postgres}"
echo "  Database: ${VEDADB_DATABASE:-orbit}"
echo "  Host: ${VEDADB_HOST:-127.0.0.1}:${VEDADB_PORT:-5432}"
echo "  File: $BACKUP_FILE"

case "${1:-}" in
  --restore)
    BACKUP_TO_RESTORE="${2:?Usage: --restore <file>}"
    if [ ! -f "$BACKUP_TO_RESTORE" ]; then
      echo "ERROR: File not found: $BACKUP_TO_RESTORE"
      exit 1
    fi
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Restoring from $BACKUP_TO_RESTORE"
    echo "  WARNING: This will OVERWRITE the current database!"
    read -rp "Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Aborted."
      exit 1
    fi
    if [[ "$BACKUP_TO_RESTORE" == *.gz ]]; then
      gunzip -c "$BACKUP_TO_RESTORE" | PGPASSWORD="$VEDADB_PASSWORD" psql \
        -h "${VEDADB_HOST:-127.0.0.1}" -p "${VEDADB_PORT:-5432}" \
        -U "${VEDADB_USER:-orbit}" -d "${VEDADB_DATABASE:-orbit}" \
        -v ON_ERROR_STOP=0
    else
      PGPASSWORD="$VEDADB_PASSWORD" psql \
        -h "${VEDADB_HOST:-127.0.0.1}" -p "${VEDADB_PORT:-5432}" \
        -U "${VEDADB_USER:-orbit}" -d "${VEDADB_DATABASE:-orbit}" \
        -v ON_ERROR_STOP=0 \
        -f "$BACKUP_TO_RESTORE"
    fi
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Restore complete ✓"
    exit 0
    ;;

  --list)
    echo "Existing backups in $BACKUP_DIR:"
    ls -lh "$BACKUP_DIR"/orbit_*.sql.gz 2>/dev/null || echo "  (none)"
    exit 0
    ;;
esac

# For Vedadb native (VBP wire), use its native backup mechanism
if [ "${VEDADB_ENGINE:-postgres}" = "vedadb" ]; then
  echo "  Vedadb engine detected — using Vedadb's native backup (VBP /admin/backup)"
  # In production, Vedadb's native tool would be used:
  # vedadb-admin backup --db $VEDADB_DATABASE --output $BACKUP_FILE
  echo "  (Configure vedadb-admin backup separately)"
  exit 0
fi

# Postgres backup via pg_dump
# Vedadb-compatible since both speak PG wire + standard SQL
PGPASSWORD="$VEDADB_PASSWORD" pg_dump \
  -h "${VEDADB_HOST:-127.0.0.1}" \
  -p "${VEDADB_PORT:-5432}" \
  -U "${VEDADB_USER:-orbit}" \
  -d "${VEDADB_DATABASE:-orbit}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  --quote-all-identifiers \
  2>/dev/null | gzip > "$BACKUP_FILE"

# Verify backup
BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
if [ "$BACKUP_SIZE" -lt 100 ]; then
  echo "ERROR: Backup file is too small ($BACKUP_SIZE bytes), probably failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup complete ✓"

# Cleanup old backups
DELETED=$(find "$BACKUP_DIR" -name "orbit_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null | wc -l | tr -d ' ')
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Cleaned up $DELETED backup(s) older than $RETENTION_DAYS days"
fi
