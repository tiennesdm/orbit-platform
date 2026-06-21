# ORBIT

> **The social network that works for you, not on you.**

A modern social platform that combines the best of Instagram, Twitter, WhatsApp, and Facebook — but built from scratch on a single-engine architecture (no Redis, no Elasticsearch, no separate message broker).

```
┌──────────────────────────────────────────────────────────────┐
│                       ORBIT Platform                          │
├──────────────────────────────────────────────────────────────┤
│   apps/web         │   apps/api         │   apps/mobile (RN)  │
│   Next.js 15       │   NestJS 11        │   React Native      │
│   Tailwind         │   12 modules       │   Expo              │
└────────────────────┴────────────────────┴─────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       Shared Packages                         │
│                                                              │
│   @orbit/types    @orbit/crypto    @orbit/db    @orbit/storage
│   (types)         (Signal Protocol) (Vedadb)   (S3+blob+local)
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                Vedadb Engine (single backend)                │
│                                                              │
│   SQL  +  Cache  +  Vector  +  Search  +  Pub/Sub  +  Blobs │
│   (one engine replaces 4 systems)                            │
└──────────────────────────────────────────────────────────────┘
```

## What's in this repo

```
orbit/
├── apps/
│   ├── web/          # Next.js 15 frontend (Vercel-style)
│   ├── api/          # NestJS 11 backend (12 modules)
│   └── mobile/       # React Native (Phase 2)
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── crypto/       # Signal Protocol (E2E encryption)
│   ├── db/           # Vedadb unified client (cache+vector+geo+streams)
│   └── storage/      # S3 / Vedadb blob / local filesystem
├── drivers/
│   ├── node/         # Vedadb Node SDK (PG-wire + VBP binary)
│   ├── python/       # Vedadb Python SDK (psycopg2 wrapper)
│   └── go/           # Vedadb Go SDK (pgx wrapper)
├── protocol/
│   └── INTEGRATION.md   # How ORBIT uses all 4 Vedadb wires
├── db/
│   └── migrations/   # SQL migrations (PG-wire compatible)
├── scripts/          # migrate.sh, seed.sh, reset.sh
├── docker-compose.yml
├── package.json      # pnpm workspaces
├── turbo.json
└── README.md
```

## 5 differentiators

1. **AI Agent that works for you** — on-device (Llama 3.2 3B) + server-side (Llama 3.1 70B). 8 MCP-style tools (search users, summarize DMs, schedule posts, get usage stats, translate, cross-post, block, mute). Personality autonomy levels: ask / suggest / auto.

2. **Portable identity** — W3C DID, WebAuthn (passkeys), exportable data vault. Move your account between servers. No vendor lock-in.

3. **Anti-addiction by design** — chronological by default (no algorithmic feed), no infinite scroll, no autoplay, no streaks, daily usage stats, cool-down nudges. EU Digital Fairness Act compliant.

4. **Unified medium (4 modes in one app)** — Intimate (close friends), Public (Twitter-like), Visual (Instagram-like), Community (groups + events). No app switching.

5. **Creator economy** — subscriptions, tips, marketplace, events. 80% revenue share to creators (vs 50-70% on incumbents).

## Tech philosophy: single engine

Traditional social platforms need 5 systems:
```
App → Postgres + Redis + Elasticsearch + Kafka + S3
```

ORBIT runs on **one engine** — Vedadb:
```
App → Vedadb (SQL + cache + search + vector + geo + events + blobs)
```

Why: 1 system to operate, 1 connection pool, 1 set of credentials, cross-feature transactions are atomic. See [`protocol/INTEGRATION.md`](./protocol/INTEGRATION.md) for the full integration story.

## Quick start

```bash
# Prerequisites: pnpm 9+, Node 20+, Docker

# 1. Install deps
pnpm install

# 2. Start Vedadb (Postgres+pgvector+PostGIS dev adapter)
docker compose up -d vedadb

# 3. Run migrations
pnpm db:migrate

# 4. Seed sample data
pnpm db:seed

# 5. Start dev (web + api in parallel via turbo)
pnpm dev
# → API on http://localhost:3001
# → Web on http://localhost:3000
```

### Direct signup (dev)

```bash
curl -X POST http://localhost:3001/identity/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice12345"}'
```

## Architecture

### Backend (NestJS 11)

12 modules wired into a single monolith (split into microservices later if needed):

| Module          | Purpose                                                  |
|-----------------|----------------------------------------------------------|
| `identity`      | WebAuthn + DID + portable identity export                |
| `post`          | 4-mode posts (intimate/public/visual/community)          |
| `feed`          | Chronological + AI-ranked + AI daily digest              |
| `dm`            | Signal Protocol E2E encrypted threads                    |
| `story`         | Ephemeral 24h posts + close friends                      |
| `reel`          | HLS video + sidebar engagement                          |
| `group`         | Members, events, privacy tiers                           |
| `marketplace`   | Geo-spatial + full-text search listings                  |
| `notification`  | Real-time pub/sub + AI priority                          |
| `search`        | Hybrid BM25 + vector RRF fusion                          |
| `ai-agent`      | LLM chat + 8 MCP tools + memory + digest                 |
| `moderation`    | Toxicity/NSFW/spam scoring + reports                     |

### Frontend (Next.js 15)

- `/onboarding` — 3-step sign-up (username → passkey → handle)
- `/home` — mode tabs + stories + AI digest + usage stats
- `/profile/[handle]` — cover photo + highlights + post grid + identity export
- `/inbox` — E2E encrypted DM threads
- `/compose` — 4-mode post composer with AI suggestions
- `/settings` — privacy, identity export, AI autonomy levels

Floating capsule bottom nav (Linear-style), glassmorphism, hairline borders, warm cream palette (#FAF8F4) + deep indigo (#4338CA) + AI purple (#7C3AED) + amber accent (#F59E0B).

### Database (Vedadb)

15+ tables, sharded by `did` (1024 logical shards, 3 regions). See `db/migrations/001_initial_schema.sql` for full schema. Highlights:

- **Hybrid search**: `tsvector` (BM25) + `vector(1536)` (HNSW) in one query
- **Cache**: `orbit_cache` table with TTL (replaces Redis)
- **Pub/sub**: `orbit_streams` table + LISTEN/NOTIFY (replaces Kafka)
- **Blobs**: `vedadb_blobs` table with content-addressed CIDs (replaces S3)
- **Geo**: PostGIS extension (USPS-style zip→lat/lng)

### Drivers

`drivers/{node,python,go}/` ship ORBIT-flavored wrappers. The canonical VBP SDK with full SCRAM auth lives in [`tiiennesdm/veyardb-driver`](https://github.com/tiennesdm/veyardb-driver) (7-language POCs).

ORBIT drivers add:
- `shardHintForDID()` / `shard_hint_for_did()` / `ShardHintForDID()` — FNV-1a mod 1024
- Region hints (`us-east` / `eu-west` / `ap-south`)
- Hot-tier markers (memory-resident data)
- Pool ergonomics + transaction helpers
- Multiplexer streaming (avoiding the cross-SDK DATA_CHUNK bug)

## Roadmap

| Phase | Timeframe | Milestone                                                |
|-------|-----------|----------------------------------------------------------|
| 1     | M1-3      | Local dev, 1k users, single Vedadb instance              |
| 2     | M4-6      | Mobile app (RN), 100k users, basic sharding              |
| 3     | M7-12     | Public beta, 1M users, 3-region cluster                  |
| 4     | M13-18    | Cross-region replication, 10M users                      |
| 5     | M19-24    | Federation, PDS hosting, 100M+ users                     |

## Status

**Phase 1** — scaffolding complete. All 12 backend modules + 6 frontend pages + schema + drivers + storage implemented. See `apps/api/test/` for unit tests.

Tested with:
- Node.js 20.x
- pnpm 9.x
- Vedadb engine (Postgres-compatible dev adapter)
- Docker Compose for local dev

## Contributing

See `CONTRIBUTING.md` (TODO). Code style:
- TypeScript strict mode
- ESLint + Prettier
- Tests: Jest (api), Vitest (web, drivers)
- Conventional commits

## License

UNLICENSED — proprietary ORBIT code. All rights reserved.

## References

- Vedadb engine: `github.com/tiennesdm/verdadb-engine` (private)
- Canonical VBP SDK: `github.com/tiennesdm/veyardb-driver` (public)
- Wire spec: `VBP_SPEC.md` (in engine repo)
- Strategy doc: `../orbit-social-platform-strategy.md`
- Implementation plan: `../orbit-implementation-plan.md`
- UI mockup: `../orbit-app-mockup.html`
