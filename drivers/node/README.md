# Vedadb Node.js Driver (ORBIT)

ORBIT-flavored wrapper around **Vedadb's PostgreSQL wire** (port 5432) with optional **VBP v1 binary wire** (6381/6382) for advanced features.

## Why this exists alongside `tiiennesdm/veyardb-driver`

The canonical VBP v1 SDK monorepo at [`tiiennesdm/veyardb-driver`](https://github.com/tiennesdm/veyardb-driver) ships 7-language VBP SDK POCs (Python, Node.js, Java, Rust, .NET, Ruby, PHP). ORBIT uses the PG-wire path for SQL and adds ORBIT-specific helpers:

- **DID-aware shard inference** (`shardHintForDID`) — route queries to the right physical shard
- **Hot-tier markers** (`hotQuery`) — keep post-feed / AI embeddings in memory tier
- **Region hints** — route users to nearest of 3 regions (us-east / eu-west / ap-south)
- **VBP multiplexer streaming** — accumulator pattern (DATA_CHUNK) avoiding the cross-SDK bug

## Architecture

```
┌─────────────────────────────────────────────────┐
│            VedadbClient (ORBIT wrapper)        │
├──────────────────────────┬──────────────────────┤
│   VedadbPool (pg)        │   VBPClient (binary) │
│   - SELECT / INSERT      │   - binary frames    │
│   - transactions         │   - chunked streams  │
│   - shard hints          │   - SCRAM (todo)     │
│   - hot-tier markers     │   - multiplexing     │
└──────────────────────────┴──────────────────────┘
                │                     │
        ┌───────▼────────┐    ┌───────▼────────┐
        │ PG wire 5432   │    │ VBP 6381/6382  │
        │ (always used)  │    │ (advanced)     │
        └────────────────┘    └────────────────┘
                │                     │
        ┌───────▼────────────────────▼───────┐
        │           Vedadb Engine            │
        │  (PostgreSQL-compatible hybrid DB)  │
        └────────────────────────────────────┘
```

## Usage

```typescript
import { createVedadbClient } from '@orbit/vedadb-driver';

const db = createVedadbClient({
  pg: {
    host: process.env.VEDADB_HOST!,
    port: 5432,
    database: 'orbit',
    user: process.env.VEDADB_USER!,
    password: process.env.VEDADB_PASSWORD!,
    poolMax: 20,
  },
  vbp: {                                    // optional
    host: process.env.VEDADB_HOST!,
    port: 6381,
    user: process.env.VEDADB_USER!,
  },
});

await db.init();

// 1. Standard query (PG-wire)
const { rows } = await db.pg.query(
  'SELECT * FROM posts WHERE author_did = $1 LIMIT 20',
  ['did:orbit:abc123']
);

// 2. Query with auto-inferred shard hint (DID-based)
const { rows: feed } = await db.pg.queryWithHint(
  'SELECT * FROM posts WHERE author_did = ANY($1) ORDER BY created_at DESC LIMIT 50',
  [followDIDs],
  { did: currentUserDID }
);

// 3. Hot-tier query (post feed, AI embeddings)
const { rows: trending } = await db.pg.hotQuery(
  'SELECT * FROM posts WHERE mode = $1 AND created_at > $2',
  ['public', new Date(Date.now() - 86400000)]
);

// 4. Transaction
const newPost = await db.pg.withTransaction(async (client) => {
  const post = await client.query(
    'INSERT INTO posts (id, author_did, content) VALUES ($1, $2, $3) RETURNING *',
    [crypto.randomUUID(), currentUserDID, content]
  );
  await client.query(
    'INSERT INTO orbit_streams (channel, payload) VALUES ($1, $2)',
    ['feed:followers', JSON.stringify({ post_id: post.rows[0].id })]
  );
  return post.rows[0];
});

await db.close();
```

## VBP binary client (advanced)

```typescript
const vbp = db.vbp!;  // if vbp config provided
await vbp.connect();

// Binary query with chunked streaming
const result = await vbp.query('SELECT * FROM large_table LIMIT 1000000');
console.log(`Got ${result.rows.length} rows in ${result.durationMs}ms via ${result.chunkedFrames} chunks`);

await vbp.close();
```

## Shard hint inference

Vedadb shards by `did` (DID → logical shard 0-1023 via FNV-1a hash, 64-bit):

```typescript
import { shardHintForDID } from '@orbit/vedadb-driver';

const hint = shardHintForDID('did:orbit:abc123');
// { logicalShard: 547, region: 'us-east' }
```

This routes one user's data (posts, follows, DMs) to the same physical shard, which:
- Cuts cross-shard transactions for cross-table updates
- Enables per-user hot/cold tier migration based on activity
- Allows regional compliance (EU users → eu-west shard)

## Integration with `@orbit/db`

The `@orbit/db` package (in `packages/db/`) uses this driver. It exposes:
- `OrbitCache` — Redis-like KV cache backed by Vedadb (orbit_cache table)
- `OrbitPubSub` — Redis Streams-like pub/sub backed by Vedadb (orbit_streams table + LISTEN/NOTIFY)
- `OrbitVector` — Vector search backed by Vedadb's HNSW index (vector(1536))
- `OrbitGeo` — Geographic queries backed by PostGIS extension

All of these go through the PG-wire path. VBP is reserved for binary-streaming use cases.

## Reference: Vedadb Engine Wire Protocols

| Wire          | Port       | Use                                  |
|---------------|------------|--------------------------------------|
| PostgreSQL    | 5432       | SQL queries (primary path)           |
| VBP v1        | 6381/6382  | Binary, chunked streams, push events |
| REST          | 9123       | Health checks, admin ops             |
| Text-JSON     | 6380       | Legacy (use VBP for new code)        |

VBP wire spec: see `VBP_SPEC.md` in `tiiennesdm/verdadb-engine` repo (canonical).

## Known issues addressed in this driver

- **Multiplexer DATA_CHUNK accumulation**: VBP spec requires accumulating streaming frames until terminal opcode (COMMAND_COMPLETE / ERROR). See `handleFrame()` — DATA_CHUNK is appended, not resolved, then terminal frame triggers the resolve. This is the bug that affected all 7 SDKs in `veyardb-driver`.
- **SCRAM auth (TODO)**: VBP spec §6.2 expects full SCRAM-SHA-256 handshake (c=biws binding, CSPRNG nonce). Currently relies on dev-mode `Auth.Required=false`. For production SCRAM, see `vbp-sdk.md` gotcha notes — ~4h of work to wire up.

## License

UNLICENSED — proprietary ORBIT code.
