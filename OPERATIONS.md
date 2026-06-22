# =============================================================================
# ORBIT — Operations Runbook
# =============================================================================

For SREs / on-call engineers.

## Health Check

```bash
# Liveness (is process alive?)
curl https://api.orbit.example.com/health/live
# {"status":"live","timestamp":"..."}

# Readiness (DB + auth working?)
curl https://api.orbit.example.com/health/ready
# {"status":"ready","timestamp":"..."}

# Deep health (full DB check, etc.)
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.orbit.example.com/health
```

If `/health/live` returns 200 but `/health/ready` returns 503 → DB connection issue.

## Common Operations

### View logs

```bash
./start-prod.sh --logs       # PM2 logs (live)
pm2 logs orbit-api --lines 200
# OR direct:
tail -f /opt/orbit/logs/api-err.log
```

### Restart service

```bash
./start-prod.sh --restart     # graceful PM2 reload (zero-downtime)
# OR
pm2 restart orbit-api         # force restart
```

### Stop service

```bash
./start-prod.sh --stop
# OR
pm2 stop orbit-api
```

### Process status

```bash
./start-prod.sh --status
# OR
pm2 status
pm2 monit                    # live CPU/memory
```

### Database operations

```bash
# Connect to DB
PGPASSWORD=$VEDADB_PASSWORD psql -h $VEDADB_HOST -U $VEDADB_USER -d $VEDADB_DATABASE

# Run migration manually
./start-prod.sh --migrate

# Backup
./scripts/backup.sh

# List backups
./scripts/backup.sh --list

# Restore (DESTRUCTIVE)
./scripts/backup.sh --restore backups/orbit_orbit_20260622_020000.sql.gz
```

### Scale up (more instances)

```bash
# 4 API instances via PM2 cluster mode
pm2 start ecosystem.config.cjs --instances 4 --exec-mode cluster
pm2 save

# Then update nginx upstream to include all 4 ports (or use unix socket)
```

### Update / Deploy new code

```bash
cd /opt/orbit
git pull
pnpm install --frozen-lockfile
./start-prod.sh --restart     # PM2 zero-downtime reload
./start-prod.sh --logs        # watch for errors
```

### Rotate JWT secret (every 90 days)

```bash
# Generate new secret
NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")

# Update .env
sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_SECRET|" .env

# Restart
./start-prod.sh --restart

# Note: All existing JWTs will be invalidated. Users will need to re-login.
```

## Incidents

### 🔴 API down, returning 500

```bash
# 1. Check if process is running
./start-prod.sh --status

# 2. Check logs
./start-prod.sh --logs | tail -100

# 3. Common causes:
#    - DB connection lost → check VEDADB_* env vars, DB server
#    - OOM → pm2 monit shows memory, restart with --max-memory-restart
#    - Unhandled exception → log will have stack trace, fix code
```

### 🟡 DB connection pool exhausted

Symptoms: API hangs, `/health/ready` returns 503, errors mention "timeout"

```bash
# 1. Check connection count
PGPASSWORD=$VEDADB_PASSWORD psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='$VEDADB_DATABASE';"

# 2. Kill idle connections
PGPASSWORD=$VEDADB_PASSWORD psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$VEDADB_DATABASE' AND state='idle' AND query_start < now() - interval '5 minutes';"

# 3. Tune pool size
# In .env: VEDADB_MAX_CONNECTIONS=50 (up from 20)
./start-prod.sh --restart
```

### 🟡 Disk full

```bash
# 1. Check disk
df -h /opt/orbit

# 2. Find large files
du -sh /opt/orbit/{logs,backups,node_modules,.next}/* | sort -h

# 3. Clean logs (PM2 rotates automatically, but old logs accumulate)
find /opt/orbit/logs -name "*.log" -mtime +7 -delete

# 4. Clean old backups
find /opt/orbit/backups -name "*.sql.gz" -mtime +30 -delete
```

### 🟡 Memory leak (RAM growing over time)

```bash
# 1. Check current usage
pm2 monit
# OR
ps aux | grep "ts-node.*main" | grep -v grep

# 2. Restart with memory limit
# In ecosystem.config.cjs: max_memory_restart: '1G'

# 3. Profile if persistent
node --inspect apps/api/src/main.ts
# Then connect Chrome DevTools to chrome://inspect
```

### 🟡 Slow queries

```bash
# 1. Find slow queries
PGPASSWORD=$VEDADB_PASSWORD psql -c "
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE datname='orbit' AND state='active' AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;"

# 2. Add index if needed
PGPASSWORD=$VEDADB_PASSWORD psql -c "CREATE INDEX CONCURRENTLY idx_name ON table(column);"

# 3. Check for missing indexes
PGPASSWORD=$VEDADB_PASSWORD psql -c "SELECT * FROM pg_stat_user_tables WHERE seq_scan > idx_scan ORDER BY seq_scan DESC LIMIT 10;"
```

### 🔴 Database corruption

```bash
# 1. Stop API to prevent further writes
./start-prod.sh --stop

# 2. Restore from latest backup
./scripts/backup.sh --list
./scripts/backup.sh --restore backups/orbit_orbit_LATEST.sql.gz

# 3. Verify
PGPASSWORD=$VEDADB_PASSWORD psql -c "SELECT count(*) FROM users;"

# 4. Restart
./start-prod.sh
```

### 🔴 Security incident (compromised API key, etc.)

```bash
# 1. Rotate ALL secrets immediately
# - JWT_SECRET (see above)
# - DB password
# - S3 keys
# - ANTHROPIC_API_KEY
# - Sentry DSN

# 2. Review logs for suspicious activity
./start-prod.sh --logs | grep -i "auth\|error\|unauth"

# 3. If user data was accessed, follow GDPR/CCPA disclosure process

# 4. Post-mortem: add detection to prevent recurrence
```

## Performance Targets (SLOs)

| Metric | Target | Action if violated |
|---|---|---|
| API availability | 99.9% (43min downtime/month) | Check infra, fix root cause |
| API p50 latency | < 100ms | DB indexing, caching |
| API p95 latency | < 500ms | Slow query log, profile |
| API p99 latency | < 2s | Heavy queries, pagination |
| DB connection pool | < 80% used | Increase pool size or add replicas |
| Disk usage | < 80% | Cleanup old logs/backups |
| Memory usage | < 80% per instance | Increase RAM or add instances |

## Capacity Planning

**Per 10K active users (rough estimates):**

- API instances: 2-4 (CPU-bound, ~100 req/s per instance)
- DB connections: 20-40 total
- Storage: ~50GB (10K users × ~5MB media each)
- Bandwidth: ~10TB/month (heavy media)
- Backups: ~10GB per backup (compressed)

**When to scale:**

- > 80% CPU on any instance → add instance
- > 100 DB connections → increase pool + add DB replica
- > 70% disk → expand storage
- > 80% memory → upgrade instance type

## Disaster Recovery

**RTO (Recovery Time Objective)**: 1 hour
**RPO (Recovery Point Objective)**: 24 hours (daily backups)

For tighter RPO/RTO:
- Continuous WAL archiving (point-in-time recovery)
- Cross-region read replicas
- Multi-region active-active

## Contacts

- On-call: PagerDuty escalation
- Slack: #orbit-incidents
- Email: ops@orbit.example.com

## Related Docs

- `DEPLOYMENT.md` — How to deploy
- `QA_GAP_REPORT.md` — Feature gaps vs mock design
- `GAP_ANALYSIS.md` — Earlier dev-time gap analysis
- `QA_REPORT.md` — End-to-end test results
