# Vedadb Integration Guide

How ORBIT uses the **Vedadb engine** as its single data backend — covering all four wire protocols, schema design, and operational patterns.

> **TL;DR** — ORBIT runs on a single Vedadb instance (or cluster). No Redis. No Elasticsearch. No separate message broker. Vedadb is PG-wire compatible, has vector + full-text + geo + pub/sub + cache + blob storage built-in. This is the unified engine architecture.

---

## Vedadb engine overview

Vedadb is a PostgreSQL-compatible hybrid database engine with:

| Wire Protocol       | Port          | Purpose                                              |
|---------------------|---------------|------------------------------------------------------|
| **PostgreSQL wire** | `5432`        | SQL queries, transactions, prepared statements       |
| **VBP v1 binary**   | `6381/6382`   | Streaming results, push events, binary batching      |
| **REST API**        | `9123`        | Health checks, admin ops, metrics                     |
| **Text-JSON**       | `6380`        | Legacy; new code should use VBP                      |

- Engine code: [`tiiennesdm/verdadb-engine`](https://github.com/tiennesdm/verdadb-engine) (private; ~1624 Go files)
- Canonical VBP SDK: [`tiiennesdm/veyardb-driver`](https://github.com/tiennesdm/veyardb-driver) (public; 7-language VBP SDK POCs)
- Wire spec: `VBP_SPEC.md` in the engine repo (canonical, ~600 lines)

ORBIT-specific drivers in this repo (`drivers/node`, `drivers/python`, `drivers/go`) are thin wrappers — see "Driver philosophy" below.

---

## Why a single engine (not Redis + Elasticsearch + Postgres)

A typical social-platform architecture looks like:

```
App → Postgres (data) + Redis (cache) + Elasticsearch (search)
       + Kafka (events) + S3 (blobs)  → 5 systems to operate
```

ORBIT replaces 4 of those with **Vedadb alone**:

```
App → Vedadb (data + cache + search + events + blobs) → 1 system to operate
```

**Concrete savings**:

| Layer       | Vedadb feature                | Replaces                    |
|-------------|-------------------------------|-----------------------------|
| Data        | PostgreSQL compat (B+Tree, MVCC, WAL) | Postgres              |
| Cache       | `orbit_cache` table + TTL    | Redis                       |
| Search      | `tsvector` + `pg_trgm`        | Elasticsearch               |
| Vector      | `vector(1536)` + HNSW index   | Pinecone / Weaviate         |
| Geo         | `PostGIS` extension           | Mongo geo / PostGIS         |
| Pub/sub     | `LISTEN/NOTIFY` + `orbit_streams` table | Kafka / Redis Streams |
| Blob        | `BYTEA` in `vedadb_blobs` table       | S3 / MinIO         |
| At-rest     | Page-level TDE (AES-256-CTR)  | LUKS / cloud KMS            |
| Audit       | Per-statement log             | Datadog / Splunk            |

**Operational impact**:
- 1 system to patch, monitor, back up, scale, version
- 1 set of credentials, 1 connection pool, 1 query planner to tune
- Cross-feature transactions (e.g. "post INSERT + cache invalidation + search index update + event publish") become single atomic writes

---

## Driver philosophy

ORBIT ships **thin wrappers** in `drivers/{node,python,go}/` that add ORBIT-flavored helpers on top of Vedadb's standard protocols. They do **not** reimplement the wire spec.

For the canonical, battle-tested VBP SDK (with SCRAM auth, multiplexer streaming fix, etc.), use [`tiiennesdm/veyardb-driver`](https://github.com/tiennesdm/veyardb-driver).

ORBIT wrappers add:
- **DID-aware shard hint inference** (`shard_hint_for_did`) — FNV-1a mod 1024
- **Region hints** — `us-east` / `eu-west` / `ap-south`
- **Hot-tier markers** — `SET LOCAL vedadb.tier = 'hot'`
- **Pool ergonomics** — connection pooling, transaction helpers
- **Multiplexer streaming** — DATA_CHUNK accumulation (avoiding cross-SDK bug)

---

## Schema (high level)

ORBIT's full schema lives in `db/migrations/001_initial_schema.sql`. Highlights of Vedadb-specific design:

```sql
-- 1. Sharding: hash by DID (Decentralized Identifier)
--    Every table with user-scoped rows includes `did` as a leading column
--    so Vedadb's router can co-locate one user's data.

CREATE TABLE posts (
  id          UUID PRIMARY KEY,
  author_did  TEXT NOT NULL,        -- shard key
  mode        TEXT NOT NULL,        -- 'intimate' | 'public' | 'visual' | 'community'
  content     TEXT,
  media_ids   UUID[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ...
);
CREATE INDEX idx_posts_author ON posts (author_did, created_at DESC);

-- 2. Hybrid search: BM25 + vector in one query
ALTER TABLE posts ADD COLUMN search_tsv TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(content,'')), 'A')
  ) STORED;
ALTER TABLE posts ADD COLUMN embedding VECTOR(1536);  -- pgvector compat

CREATE INDEX idx_posts_tsv ON posts USING gin (search_tsv);
CREATE INDEX idx_posts_hnsw ON posts USING hnsw (embedding vector_cosine_ops);

-- 3. Cache: Redis-compatible KV with TTL
CREATE TABLE orbit_cache (
  key         TEXT PRIMARY KEY,
  value       JSONB,
  ttl_seconds INT,
  expires_at  TIMESTAMPTZ GENERATED ALWAYS AS (NOW() + (ttl_seconds || ' seconds')::interval) STORED,
  tags        TEXT[]
);
CREATE INDEX idx_orbit_cache_expires ON orbit_cache (expires_at);

-- 4. Pub/sub: Streams-style log with notification
CREATE TABLE orbit_streams (
  id          BIGSERIAL PRIMARY KEY,
  channel     TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_streams_channel ON orbit_streams (channel, id DESC);

-- 5. Blob storage: content-addressed
CREATE TABLE vedadb_blobs (
  cid           TEXT PRIMARY KEY,
  bucket        TEXT NOT NULL,
  content       BYTEA NOT NULL,
  size_bytes    BIGINT NOT NULL,
  content_type  TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cid, bucket)
);
```

---

## Connection patterns

### 1. Read path (post feed, search, profile)

```typescript
// Standard PG-wire query with shard hint
const { rows } = await db.pg.queryWithHint(
  `SELECT * FROM posts
   WHERE mode = 'public'
   ORDER BY created_at DESC LIMIT 50`,
  [],
  { did: currentUserDID }    // shard hint = hash(did) mod 1024
);
```

### 2. Hot path (timeline, trending, AI embeddings)

```typescript
// Mark result as hot-tier — Vedadb keeps it in memory
const { rows } = await db.pg.hotQuery(
  `SELECT * FROM ai_embeddings WHERE model = $1 LIMIT 1000`,
  ['llama-3.1-70b']
);
```

### 3. Atomic write (post + cache invalidation + event publish)

```typescript
// Single transaction, single engine, single consistency guarantee
await db.pg.withTransaction(async (tx) => {
  const post = await tx.query(
    `INSERT INTO posts (id, author_did, mode, content)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [crypto.randomUUID(), did, 'public', content]
  );
  await tx.query(
    `INSERT INTO orbit_streams (channel, payload)
     VALUES ('feed:followers', $1)`,
    [JSON.stringify({ post_id: post.rows[0].id, author_did: did })]
  );
  await tx.query(
    `DELETE FROM orbit_cache
     WHERE key = $1 AND $2 = ANY(tags)`,
    [`feed:${did}`, did]
  );
});
```

### 4. Pub/sub (real-time DM, notification fanout)

```sql
-- Server-side
LISTEN orbit_dm_${thread_id};
NOTIFY orbit_dm_${thread_id}, '{"message_id": "..."}';
```

```typescript
// Client-side (Node.js)
const client = new pg.Client({ ... });
await client.connect();
await client.query(`LISTEN orbit_dm_${threadId}`);
client.on('notification', (msg) => {
  // payload contains message_id, sender, etc.
});
```

### 5. Hybrid search (BM25 + vector RRF)

```typescript
// Single query, single engine — uses tsvector + hnsw indexes
const { rows } = await db.pg.query(
  `WITH bm25 AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(search_tsv, query) DESC) AS rk
    FROM posts, plainto_tsquery('english', $1) query
    WHERE search_tsv @@ query
  ),
  vec AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $2) AS rk
    FROM posts
    ORDER BY embedding <=> $2
    LIMIT 100
  )
  SELECT posts.*, COALESCE(1.0/(60+bm25.rk), 0) + COALESCE(1.0/(60+vec.rk), 0) AS rrf
  FROM posts
  LEFT JOIN bm25 ON posts.id = bm25.id
  LEFT JOIN vec  ON posts.id = vec.id
  WHERE COALESCE(1.0/(60+bm25.rk), 0) + COALESCE(1.0/(60+vec.rk), 0) > 0
  ORDER BY rrf DESC LIMIT 20`,
  ['breaking news today', embeddingVector]
);
```

---

## Performance hints

| Hint                     | Effect                                                       |
|--------------------------|--------------------------------------------------------------|
| `SET LOCAL vedadb.shard_hint = N`     | Pin query to logical shard 0-1023              |
| `SET LOCAL vedadb.region_hint = 'X'`  | Pin query to physical region (`us-east` / `eu-west` / `ap-south`) |
| `SET LOCAL vedadb.tier = 'hot'`      | Keep result set in memory tier                 |
| `SET LOCAL vedadb.tier = 'cold'`     | Allow result set to spill to disk              |
| `EXPLAIN (FORMAT JSON)`              | Show Vedadb plan (similar to PG EXPLAIN)       |

---

## Deployment

### Local development

```yaml
# docker-compose.yml (this repo)
services:
  vedadb:
    image: vedadb/edadb:latest
    ports: ["5432:5432", "6381:6381", "6382:6382", "9123:9123"]
    volumes: ["./db/data:/var/lib/edadb/data"]
```

### Production (cluster)

Vedadb's native cluster mode distributes 1024 logical shards across 3 regions:
- `us-east` (primary, 4 nodes)
- `eu-west` (primary, 2 nodes, GDPR)
- `ap-south` (primary, 2 nodes)

Each region's primary has a synchronous replica. Cross-region replication is asynchronous.

ORBIT's app servers connect via regional proxies (one proxy per region). The proxy:
1. Authenticates the user via SCRAM
2. Looks up user's `did → region` mapping (per-user GDPR / data-residency)
3. Routes the query to the regional Vedadb primary
4. For cross-region reads (e.g. EU user reading US public posts), uses async-replicated secondary

---

## Operations playbook

### Cache invalidation

```sql
-- Delete by tag (Redis-style)
DELETE FROM orbit_cache WHERE $1 = ANY(tags);

-- Or via app code:
await db.pg.query(
  `DELETE FROM orbit_cache WHERE $1 = ANY(tags)`,
  [`user:${did}`]
);
```

### Connection pool sizing

Rule of thumb: `(app_concurrency * 1.5) ÷ num_app_instances`. With 20 connections per instance and 8 instances, you can sustain ~106 concurrent queries. Use pgBouncer in front if you need more.

### Monitoring

- `/healthz` (port 9123) — liveness
- `/readyz` (port 9123) — readiness (replication lag, WAL position)
- `/metrics` (port 9123) — Prometheus-format metrics (QPS, p95, cache hit rate, shard distribution)

### Backups

Vedadb supports both physical (`pg_basebackup`) and logical (`pg_dump`) backups. ORBIT runs:
- Continuous WAL archiving (Point-in-Time Recovery, 30-day retention)
- Daily logical backups (kept 90 days in cold storage)

---

## Known Vedadb gotchas (from production experience)

These are real bugs/limits we've hit. Document them so future devs don't waste time.

1. **Per-query memory budget: 16,384 MB hard cap** — silent reject if exceeded. Workaround: keep batches ≤ 1000 rows for INSERTs.

2. **Engine RSS hard kill at ~48 GB** — kernel OOM-kills the process. Engine auto-restarts and WAL-replays. Always size `GOMEMLIMIT` ≤ 50% of machine RAM.

3. **INSERT on duplicate key does in-place UPDATE, not skip** — `BPlusTree.Insert` silently overwrites. Use `INSERT ... ON CONFLICT DO NOTHING` if you want skip semantics.

4. **Parser token limit: 100,000** — multi-VALUES INSERTs cap at ~12K rows. Batch to 10K rows.

5. **VBP multiplexer streaming**: DATA_CHUNK frames must be ACCUMULATED until terminal opcode (COMMAND_COMPLETE / ERROR). Don't resolve on first chunk — see `drivers/node/src/index.ts` `handleFrame()` for the correct pattern.

6. **macOS path normalization trap**: `/Users/.../vedadb-engine` and `/Users/.../verdadb-engine` are DIFFERENT paths on case-insensitive HFS+ (v-e-d-a-d-b vs v-e-r-d-a-d-b). Always verify with `find` or `python3 os.walk`, never trust `ls`.

7. **HFS+ displays `/etc/vedab/...` as `/etc/v*db/...`** — use `find / -name '*.crt'` or glob patterns to bypass Unicode normalization.

---

## Migration plan (for moving from PG+Redis+ES → Vedadb)

If you're starting fresh on ORBIT, skip this. If you're porting an existing app:

| Source system     | Target (Vedadb)                  | Migration                                                |
|-------------------|---------------------------------|----------------------------------------------------------|
| Postgres table    | Vedadb table                    | `pg_dump` → `psql` (PG-wire compat)                      |
| Redis KV          | `orbit_cache` table             | Write a small wrapper that maps `GET`/`SET`/`DEL`        |
| Redis Streams     | `orbit_streams` table           | Append-only log + LISTEN/NOTIFY for subscribers          |
| Elasticsearch idx | `tsvector` + GIN index          | Bulk-load docs, trigger generated column population      |
| Pinecone / vec DB | `vector(N)` + HNSW              | `INSERT INTO t (embedding) VALUES ($1::vector)`          |
| S3 / blob store   | `vedadb_blobs` table (BYTEA)    | Read all, INSERT into vedadb_blobs (note: large blobs can hit memory budget) |
| Kafka topics      | `orbit_streams` (channels)      | Producer-side: INSERT; consumer-side: LISTEN/NOTIFY      |

Single-engine deployment means **one schema migration tool** (`db/migrations/001_initial_schema.sql` + `db/migrations/002_*.sql` ...), one connection pool, one set of credentials.

---

## Reference

- **Vedadb engine**: `github.com/tiennesdm/verdadb-engine` (private)
- **Canonical VBP SDK**: `github.com/tiennesdm/veyardb-driver` (public, 7 languages)
- **VBP wire spec**: `VBP_SPEC.md` (in engine repo)
- **ORBIT drivers**: `drivers/{node,python,go}/` in this repo
- **Schema**: `db/migrations/001_initial_schema.sql`
- **Storage**: `packages/storage/`
- **AI Agent**: `apps/api/src/modules/ai-agent/`
