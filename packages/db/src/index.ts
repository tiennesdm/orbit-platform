/**
 * ORBIT Unified DB Adapter
 *
 * Vedadb is the SINGLE datastore — handles OLTP + Cache + Search + Vector in one engine.
 * This adapter abstracts the connection logic so:
 *   - Production: connects to Vedadb cluster
 *   - Local dev: connects to Postgres (Vedadb speaks PostgreSQL wire protocol)
 *
 * Vedadb features used by ORBIT:
 *   - Distributed SQL (sharded by user_id)
 *   - In-memory hot tier (cache, pub/sub)
 *   - Inverted index + BM25 (full-text search)
 *   - pgvector / Vedadb vector (HNSW ANN)
 *   - PostGIS / Vedadb geo (GEOGRAPHY)
 *   - LISTEN/NOTIFY / Vedadb pub/sub
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// ============================================================
// Connection pool (Vedadb or Postgres-compatible)
// ============================================================
export class VedadbPool {
  private pool: Pool;
  private isVedadb: boolean;

  constructor(config: VedadbConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      // Vedadb-specific options (passed through to backend)
      application_name: 'orbit-app',
      statement_timeout: 30000,
      query_timeout: 30000,
    });

    // Detect Vedadb (vs vanilla Postgres) on first query
    this.isVedadb = config.engine === 'vedadb';
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async withSharding<T>(shardKey: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // Vedadb: route to specific shard via session-level hint
    // Postgres: no-op (sharding handled by app layer in dev)
    if (this.isVedadb) {
      const client = await this.pool.connect();
      try {
        await client.query(`SET orbit.shard_key = '${shardKey.replace(/'/g, "''")}'`);
        return await fn(client);
      } finally {
        client.release();
      }
    }
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  /**
   * Listen for pub/sub notifications (Vedadb hot tier / Postgres LISTEN/NOTIFY)
   */
  async listen(channel: string, handler: (payload: any) => void): Promise<() => Promise<void>> {
    const client = await this.pool.connect();
    client.on('notification', (msg) => {
      if (msg.channel === channel && msg.payload) {
        try {
          handler(JSON.parse(msg.payload));
        } catch (e) {
          handler(msg.payload);
        }
      }
    });
    await client.query(`LISTEN "${channel}"`);

    return async () => {
      try {
        await client.query(`UNLISTEN "${channel}"`);
      } catch {
        // ignore
      } finally {
        client.release();
      }
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  get info() {
    return {
      engine: this.isVedadb ? 'vedadb' : 'postgres',
      host: this.pool.options.host,
      database: this.pool.options.database,
    };
  }
}

export interface VedadbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  engine?: 'vedadb' | 'postgres';
  maxConnections?: number;
  region?: string;
}

// ============================================================
// Factory
// ============================================================
let globalPool: VedadbPool | null = null;

export function createVedadbPool(config: VedadbConfig): VedadbPool {
  if (globalPool) return globalPool;
  globalPool = new VedadbPool(config);
  return globalPool;
}

export function getVedadbPool(): VedadbPool {
  if (!globalPool) throw new Error('Vedadb pool not initialized. Call createVedadbPool first.');
  return globalPool;
}

export async function closeVedadbPool(): Promise<void> {
  if (globalPool) {
    await globalPool.close();
    globalPool = null;
  }
}

// ============================================================
// Cache helpers (Vedadb hot tier / Redis-compatible)
// ============================================================
export interface CacheOptions {
  ttlSeconds?: number;
}

export class OrbitCache {
  constructor(private pool: VedadbPool) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const res = await this.pool.query<{ cache_value: any }>(
      `SELECT cache_value FROM orbit_cache WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [key]
    );
    return res.rows[0]?.cache_value ?? null;
  }

  async set(key: string, value: unknown, options: CacheOptions = {}): Promise<void> {
    // SECURITY: validate + bound TTL to prevent SQL injection and absurd values
    const ttl = this.sanitizeTtl(options.ttlSeconds);
    await this.pool.query(
      `INSERT INTO orbit_cache (cache_key, cache_value, expires_at, ttl_seconds)
       VALUES ($1, $2, NOW() + make_interval(secs => $3), $3)
       ON CONFLICT (cache_key) DO UPDATE
       SET cache_value = EXCLUDED.cache_value,
           expires_at = EXCLUDED.expires_at,
           ttl_seconds = EXCLUDED.ttl_seconds,
           updated_at = NOW(),
           hit_count = orbit_cache.hit_count + 1`,
      [key, JSON.stringify(value), ttl]
    );
  }

  async del(key: string): Promise<void> {
    await this.pool.query(`DELETE FROM orbit_cache WHERE cache_key = $1`, [key]);
  }

  async incr(key: string, ttlSeconds = 3600): Promise<number> {
    // SECURITY: validate + bound TTL to prevent SQL injection
    const ttl = this.sanitizeTtl(ttlSeconds);
    const res = await this.pool.query<{ value: number }>(
      `INSERT INTO orbit_cache (cache_key, cache_value, expires_at, ttl_seconds)
       VALUES ($1, '{"value": 0}'::jsonb, NOW() + make_interval(secs => $2), $2)
       ON CONFLICT (cache_key) DO UPDATE
       SET cache_value = jsonb_set(orbit_cache.cache_value, '{value}', ((orbit_cache.cache_value->>'value')::int + 1)::text::jsonb),
           updated_at = NOW()
       RETURNING (cache_value->>'value')::int AS value`,
      [key, ttl]
    );
    return res.rows[0]?.value ?? 0;
  }

  /**
   * SECURITY: TTL values must be finite integers within a sane range.
   * Prevents SQL injection via string interpolation (CVE pattern: `INTERVAL '${x}'`).
   * Bounds: 0 < ttl <= 30 days (2,592,000s). NULL/NaN/negative → default 3600s.
   */
  private sanitizeTtl(ttl: unknown): number {
    const DEFAULT_TTL = 3600;
    const MAX_TTL = 30 * 24 * 60 * 60; // 30 days
    const n = Number(ttl);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > MAX_TTL) {
      return DEFAULT_TTL;
    }
    return n;
  }
}

// ============================================================
// Pub/Sub helpers (Vedadb streams / Postgres LISTEN/NOTIFY)
// ============================================================
export interface PublishOptions {
  ttlSeconds?: number;
  priority?: number;
}

export class OrbitPubSub {
  constructor(private pool: VedadbPool) {}

  async publish(channel: string, payload: unknown, options: PublishOptions = {}): Promise<string> {
    const ttl = options.ttlSeconds ?? 3600;
    const priority = options.priority ?? 50;
    const res = await this.pool.query<{ stream_id: string }>(
      `INSERT INTO orbit_streams (channel, payload, priority, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${ttl} seconds')
       RETURNING stream_id`,
      [channel, JSON.stringify(payload), priority]
    );
    return res.rows[0]?.stream_id;
  }

  async subscribe(
    channel: string,
    handler: (event: { streamId: string; payload: unknown; createdAt: string }) => void
  ): Promise<() => Promise<void>> {
    // Hybrid: use LISTEN/NOTIFY for low-latency + table polling for guaranteed delivery
    let isRunning = true;
    let lastSeenId = 0n;

    const poll = async () => {
      while (isRunning) {
        try {
          const res = await this.pool.query<{ stream_id: string; payload: any; created_at: Date }>(
            `SELECT stream_id, payload, created_at
             FROM orbit_streams
             WHERE channel LIKE $1 AND stream_id > $2 AND processed = FALSE
             ORDER BY stream_id ASC
             LIMIT 100`,
            [`${channel}%`, lastSeenId.toString()]
          );

          for (const row of res.rows) {
            lastSeenId = BigInt(row.stream_id);
            handler({
              streamId: row.stream_id,
              payload: row.payload,
              createdAt: row.created_at.toISOString(),
            });
          }

          if (res.rows.length > 0) {
            await this.pool.query(
              `UPDATE orbit_streams SET processed = TRUE, processed_at = NOW()
               WHERE channel LIKE $1 AND stream_id <= $2`,
              [`${channel}%`, lastSeenId.toString()]
            );
          }
        } catch (err) {
          console.error('pubsub poll error', err);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    };

    poll();

    // Also use LISTEN/NOTIFY for low-latency wakeups
    let cleanupNotify: (() => Promise<void>) | null = null;
    try {
      cleanupNotify = await this.pool.listen(`${channel}.notify`, () => {
        // Notification received, poll will pick it up
      });
    } catch {
      // ignore
    }

    return async () => {
      isRunning = false;
      if (cleanupNotify) await cleanupNotify();
    };
  }
}

// ============================================================
// Vector search helpers (Vedadb vector / pgvector)
// ============================================================
export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  entityType?: number;
}

export class OrbitVector {
  constructor(private pool: VedadbPool) {}

  async upsert(entityType: number, entityId: string | bigint, embedding: number[], modelVersion: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO embeddings (entity_type, entity_id, embedding, model_version, updated_at)
       VALUES ($1, $2, $3::vector, $4, NOW())
       ON CONFLICT (entity_type, entity_id) DO UPDATE
       SET embedding = EXCLUDED.embedding,
           model_version = EXCLUDED.model_version,
           updated_at = NOW()`,
      [entityType, entityId.toString(), `[${embedding.join(',')}]`, modelVersion]
    );
  }

  async search(embedding: number[], options: VectorSearchOptions = {}): Promise<Array<{ entityType: number; entityId: string; score: number }>> {
    const limit = options.limit ?? 20;
    const threshold = options.threshold ?? 0.7;
    const entityType = options.entityType;

    let query = `
      SELECT entity_type, entity_id, 1 - (embedding <=> $1::vector) AS score
      FROM embeddings
      WHERE 1 - (embedding <=> $1::vector) >= $2
    `;
    const params: any[] = [`[${embedding.join(',')}]`, threshold];

    if (entityType !== undefined) {
      query += ` AND entity_type = $3`;
      params.push(entityType);
    }

    query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await this.pool.query<{ entity_type: number; entity_id: string; score: number }>(query, params);
    return res.rows.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      score: Number(r.score),
    }));
  }

  async hybridSearch(
    textQuery: string,
    embedding: number[],
    options: { limit?: number; textWeight?: number; vectorWeight?: number } = {}
  ): Promise<Array<{ entityType: number; entityId: string; score: number; source: 'text' | 'vector' | 'hybrid' }>> {
    // Reciprocal Rank Fusion (RRF) combining BM25 + vector
    const limit = options.limit ?? 20;
    const textWeight = options.textWeight ?? 0.5;
    const vectorWeight = options.vectorWeight ?? 0.5;

    const textRes = await this.pool.query<{ entity_id: string; rank: number }>(
      `SELECT entity_id, ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC) AS rank
       FROM posts
       WHERE search_vector @@ plainto_tsquery('simple', $1)
       ORDER BY rank LIMIT $2`,
      [textQuery, limit * 2]
    );

    const vectorRes = await this.pool.query<{ entity_id: string; rank: number }>(
      `SELECT entity_id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
       FROM embeddings
       WHERE entity_type = 1
       ORDER BY rank LIMIT $2`,
      [`[${embedding.join(',')}]`, limit * 2]
    );

    const scores = new Map<string, { score: number; source: 'text' | 'vector' | 'hybrid' }>();
    const k = 60; // RRF constant

    for (const r of textRes.rows) {
      const score = textWeight / (k + r.rank);
      scores.set(r.entity_id, { score, source: 'text' });
    }
    for (const r of vectorRes.rows) {
      const score = vectorWeight / (k + r.rank);
      const existing = scores.get(r.entity_id);
      if (existing) {
        scores.set(r.entity_id, { score: existing.score + score, source: 'hybrid' });
      } else {
        scores.set(r.entity_id, { score, source: 'vector' });
      }
    }

    return Array.from(scores.entries())
      .map(([entityId, { score, source }]) => ({ entityType: 1, entityId, score, source }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

// ============================================================
// Geo helpers (Vedadb geo / PostGIS)
// ============================================================
export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  limit?: number;
}

export class OrbitGeo {
  constructor(private pool: VedadbPool) {}

  async nearbyListings(query: NearbyQuery): Promise<Array<{ listingId: string; distanceMeters: number }>> {
    const res = await this.pool.query<{ listing_id: string; distance: number }>(
      `SELECT listing_id, ST_Distance(location_geo, ST_MakePoint($1, $2)::geography) AS distance
       FROM marketplace_listings
       WHERE ST_DWithin(location_geo, ST_MakePoint($1, $2)::geography, $3)
         AND status = 0
       ORDER BY distance ASC
       LIMIT $4`,
      [query.longitude, query.latitude, query.radiusMeters, query.limit ?? 50]
    );
    return res.rows.map((r) => ({ listingId: r.listing_id, distanceMeters: r.distance }));
  }
}

// ============================================================
// Unified facade
// ============================================================
export class OrbitDB {
  pool: VedadbPool;
  cache: OrbitCache;
  pubsub: OrbitPubSub;
  vector: OrbitVector;
  geo: OrbitGeo;

  constructor(pool: VedadbPool) {
    this.pool = pool;
    this.cache = new OrbitCache(pool);
    this.pubsub = new OrbitPubSub(pool);
    this.vector = new OrbitVector(pool);
    this.geo = new OrbitGeo(pool);
  }

  static create(config: VedadbConfig): OrbitDB {
    const pool = createVedadbPool(config);
    return new OrbitDB(pool);
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.pool.withTransaction(fn);
  }
}
