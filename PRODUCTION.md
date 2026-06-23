# ORBIT — Production Deployment Guide

This is the production runbook for ORBIT — AI-native, anti-addiction, portable-identity social platform.

---

## Architecture

```
                            ┌─────────────────────────┐
                            │   Cloudflare / DNS      │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │   nginx (TLS + proxy)   │  port 80/443
                            │   - rate limiting        │
                            │   - security headers     │
                            │   - gzip                 │
                            └─────┬──────────────┬─────┘
                                  │              │
                  ┌───────────────▼─────┐    ┌───▼──────────────┐
                  │   ORBIT Web (Next.js)│    │   ORBIT API      │
                  │   port 3000 (internal)│   │   port 4000      │
                  └─────────────────────┘    └────────┬─────────┘
                                                       │
                                          ┌────────────▼────────────┐
                                          │   Vedadb / Postgres    │  port 5432
                                          │   (engine: postgres)   │
                                          └────────────────────────┘
```

## Stack

| Component       | Image / Package                | Port  | Notes                          |
|-----------------|--------------------------------|-------|--------------------------------|
| nginx           | nginx:1.25-alpine              | 80/443| TLS termination, rate limiting |
| web             | orbit-web (Next.js standalone) | 3000  | React 19, server components    |
| api             | orbit-api (NestJS 11)          | 4000  | TypeScript, 22 modules         |
| postgres / vedadb | postgres:16-alpine           | 5432  | PG-wire compatible             |

---

## Environment Variables

### Required (production)

```bash
NODE_ENV=production

# JWT — MUST be ≥32 chars, no defaults. Generate with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=<48-byte base64 secret>

# CORS — comma-separated origins, NO wildcards in production
CORS_ORIGINS=https://orbit.example.com,https://app.orbit.example.com

# Database
VEDADB_ENGINE=postgres           # or 'vedadb' for production cluster
VEDADB_HOST=postgres             # service name in compose, hostname elsewhere
VEDADB_PORT=5432
VEDADB_DATABASE=orbit
VEDADB_USER=orbit
VEDADB_PASSWORD=<strong password>
VEDADB_SSL=true                  # TLS to DB
VEDADB_MAX_CONNECTIONS=20

# API
API_PORT=4000
API_DOCS_PUBLIC=false            # disable Swagger in prod
BODY_LIMIT=2mb
LOG_LEVEL=info
TRUST_PROXY=true                 # if behind nginx/cloudflare
AUTO_MIGRATE=true                # run SQL migrations on startup
MIGRATION_FAIL_FAST=true         # fail loudly on migration errors

# Observability (optional but recommended)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# Auth
WEB_AUTHN_RP_NAME=ORBIT
WEB_AUTHN_RP_ID=orbit.example.com
WEB_AUTHN_ORIGIN=https://orbit.example.com

# AI
ANTHROPIC_API_KEY=<sk-ant-...>   # DM to ops, do NOT commit

# Federation
FEDERATION_ENABLED=true
PLC_DIRECTORY_URL=https://plc.directory
```

---

## Deploy

### Local (docker-compose)

```bash
# 1. Set up environment
cp .env.production.example .env.production
$EDITOR .env.production  # fill in JWT_SECRET, POSTGRES_PASSWORD, ANTHROPIC_API_KEY

# 2. Build and start
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Verify
curl https://localhost/health/live     # → {"status":"live",...}
curl https://localhost/health/ready    # → {"status":"ready","dbReachable":true}
curl https://localhost/api/v1/health   # full health check
```

### Cloud (Kubernetes)

```yaml
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=orbit
kubectl describe deploy orbit-api

# Logs
kubectl logs -f -l app=orbit-api --tail=100
```

---

## Operations

### Health Probes (Kubernetes)

| Endpoint          | Probe type   | Notes                                       |
|-------------------|--------------|---------------------------------------------|
| `/health/live`    | liveness     | Process up — restart if fails               |
| `/health/ready`   | readiness    | DB reachable — remove from LB if fails      |
| `/health/startup` | startup      | Booting — used once, then liveness takes over |
| `/health`         | full check   | DB + memory + uptime                        |
| `/metrics`        | Prometheus   | Custom + nestjs-prometheus metrics          |

### Restart gracefully

The API handles SIGTERM/SIGINT:
1. Stop accepting new connections (`app.close()`)
2. Drain DB pool (`closeVedadbPool()`)
3. Exit

In Kubernetes: terminationGracePeriodSeconds=60 (above 30s default).

### Backup

```bash
# Database
docker exec orbit-postgres pg_dump -U orbit orbit | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20260623.sql.gz | docker exec -i orbit-postgres psql -U orbit -d orbit
```

Schedule daily backups via cron + S3 archival (recommended).

### Logs

Structured JSON via pino. Ship to your log aggregator (Loki/Cloudwatch/Datadog) via:
- Filebeat sidecar
- Promtail
- Fluentd

Every log line includes `service: orbit-api`, `env: production`, and `requestId` (per request).

---

## Monitoring

### Metrics (Prometheus)

Scrape `/metrics`. Key metrics:

- `http_requests_total{method,route,status}` — request count
- `http_request_duration_seconds` — latency histogram
- `orbit_db_pool_connections{state}` — DB pool gauge
- `nodejs_heap_used_bytes` — memory gauge
- `process_resident_memory_bytes` — RSS gauge

### Alerts (suggested)

- `orbit_db_pool_connections{state="idle"} > 0` always (means pool dead)
- `process_resident_memory_bytes > 1.5e9` for 5min → memory leak
- `http_request_duration_seconds{quantile="0.99"} > 1` for 5min → slow API
- `up == 0` for 1min → service down

---

## Rollback

If a deploy breaks things:

```bash
# Roll back to previous image
kubectl rollout undo deployment/orbit-api

# Or, docker-compose
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml pull orbit-api:previous-tag
docker compose -f docker-compose.prod.yml up -d
```

Migrations are forward-only. To revert schema, run the corresponding `db/migrations/00X_*.down.sql` manually.

---

## Security Checklist

See [SECURITY.md](./SECURITY.md) for the full checklist.

---

## Troubleshooting

### API won't start

1. Check logs: `docker logs orbit-api`
2. Common causes:
   - JWT_SECRET too weak → preflight check exits
   - CORS_ORIGINS contains `*` → preflight check exits
   - DB unreachable → preflight check exits
   - Migration failed → preflight check exits (MIGRATION_FAIL_FAST=true)

### High memory

- Check `/health` for `memory.status`
- RSS > 1.5GB = likely memory leak → restart pod
- Heap > 1GB = degraded, monitor

### Slow queries

- Check logs for `query.tookMs > 100`
- Add index (see `db/migrations/`)
- Check `EXPLAIN ANALYZE` output

### 429 Too Many Requests

- Throttler limits: 10/sec, 100/10sec, 1000/hour
- Check IP behind NAT — multiple users share IP
- Auth endpoints: 5/sec via nginx
- Adjust in `apps/api/src/app.module.ts` (ThrottlerModule config)

---

## Quick Reference

| Task                          | Command                                                       |
|-------------------------------|---------------------------------------------------------------|
| Build images                  | `docker compose -f docker-compose.prod.yml build`              |
| Deploy                        | `docker compose -f docker-compose.prod.yml up -d`              |
| Tail logs                     | `docker compose -f docker-compose.prod.yml logs -f api`       |
| Restart API                   | `docker compose -f docker-compose.prod.yml restart api`        |
| Backup DB                     | `docker exec orbit-postgres pg_dump -U orbit orbit`            |
| Health check                  | `curl https://localhost/health/ready`                          |
| Shell into API                | `docker exec -it orbit-api sh`                                 |
| Apply migration manually      | `docker exec orbit-postgres psql -U orbit -d orbit -f file.sql` |
| Check image size              | `docker images orbit-*`                                        |

---

Last updated: 2026-06-23