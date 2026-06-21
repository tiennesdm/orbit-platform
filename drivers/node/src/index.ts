/**
 * VedaDB Driver for Node.js (ORBIT-flavored)
 *
 * Wraps:
 * - PostgreSQL wire (port 5432) — full SQL via `pg` (same as engine's PG compat)
 * - VBP v1 binary wire (port 6381 plaintext / 6382 TLS) — for advanced features
 *   (shard hint routing, hot-tier access, multi-statement batching)
 *
 * Reference: tiiennesdm/veyardb-driver has 7-language canonical SDK POCs.
 * This is an ORBIT-specific thin wrapper that adds:
 * - DID-aware shard hint inference
 * - Hot-tier cache markers (post feed, AI embeddings)
 * - Server-side prepared statement reuse
 */

import { Client, Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { EventEmitter } from 'node:events';
import { connect as tlsConnect, ConnectionOptions as TLSOptions } from 'node:tls';
import { createConnection as netConnect, Socket } from 'node:net';

// ============================================================
// Public types
// ============================================================

export interface VedadbConfig {
  /** PG-wire connection (always required) */
  pg: {
    host: string;
    port?: number;            // default 5432
    database: string;
    user: string;
    password: string;
    ssl?: boolean | { rejectUnauthorized: boolean; ca?: string };
    poolMax?: number;         // default 20
  };
  /** Optional VBP v1 binary connection (advanced features) */
  vbp?: {
    host: string;
    port?: number;            // 6381 plaintext, 6382 TLS
    user: string;
    password?: string;        // SCRAM in production; dev mode skips auth
    tls?: boolean;
  };
  /** ORBIT-specific shard hint: route by DID (Decentralized Identifier) */
  shardByDID?: boolean;
}

export interface ShardHint {
  /** Logical shard number (0-1023) */
  logicalShard: number;
  /** Region preference */
  region?: 'us-east' | 'eu-west' | 'ap-south';
}

export interface VBPQueryResult {
  rows: any[];
  rowsAffected: number;
  durationMs: number;
  chunkedFrames: number;      // for streaming queries
}

// ============================================================
// Shard hint inference (DID → 1024 logical shards)
// ============================================================

/**
 * ORBIT shards by DID (Decentralized Identifier) — the user owns their data,
 * so we shard by `did` (string) to keep one user's data colocated.
 *
 * Mod 1024 over a SHA-256 of the DID gives stable, balanced shard distribution.
 */
export function shardHintForDID(did: string, totalShards = 1024): ShardHint {
  // FNV-1a 64-bit hash — fast, stable, no crypto dependency
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < did.length; i++) {
    h = BigInt.asUintN(64, (h ^ BigInt(did.charCodeAt(i))) * prime);
  }
  const logicalShard = Number(h % BigInt(totalShards));

  // Region preference (latency-based heuristic — ORBIT routes user to nearest region)
  // In production, replace with actual geolocation lookup
  const region = inferRegionFromDID(did);

  return { logicalShard, region };
}

function inferRegionFromDID(did: string): ShardHint['region'] {
  // Cheap heuristic — placeholder for real geo lookup
  if (did.startsWith('did:orbit:eu:')) return 'eu-west';
  if (did.startsWith('did:orbit:ap:')) return 'ap-south';
  return 'us-east';
}

// ============================================================
// PostgreSQL wire (always available — primary path)
// ============================================================

export class VedadbPool extends EventEmitter {
  private pool: Pool;
  private config: VedadbConfig;

  constructor(config: VedadbConfig) {
    super();
    this.config = config;
    const poolConfig: PoolConfig = {
      host: config.pg.host,
      port: config.pg.port ?? 5432,
      database: config.pg.database,
      user: config.pg.user,
      password: config.pg.password,
      ssl: config.pg.ssl as any,
      max: config.pg.poolMax ?? 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * Execute a parameterized SQL query.
   * Use $1, $2 placeholders — Vedadb supports full PG prepared statements.
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(text, params);
    this.emit('query', { text, durationMs: Date.now() - start, rowCount: result.rowCount });
    return result;
  }

  /**
   * Execute a query with shard hint — Vedadb router uses hint to pick physical shard.
   * Pass `hint.did` for auto-inferred shard, or `hint.logicalShard` for explicit.
   */
  async queryWithHint<T extends QueryResultRow = any>(
    text: string,
    params: any[],
    hint: { did?: string; logicalShard?: number; region?: ShardHint['region'] }
  ): Promise<QueryResult<T>> {
    let logicalShard = hint.logicalShard;
    let region = hint.region;
    if (hint.did) {
      const inferred = shardHintForDID(hint.did);
      logicalShard = inferred.logicalShard;
      region = region ?? inferred.region;
    }
    // Vedadb accepts a session-level hint via SET LOCAL
    const client = await this.pool.connect();
    try {
      if (logicalShard !== undefined) {
        await client.query(`SET LOCAL vedadb.shard_hint = $1`, [String(logicalShard)]);
      }
      if (region) {
        await client.query(`SET LOCAL vedadb.region_hint = $1`, [region]);
      }
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Begin a transaction.
   */
  async withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
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

  /**
   * Mark a query as hot-tier (post feed, AI embeddings — accessed frequently).
   * Vedadb keeps hot data in memory; cold data spills to disk.
   */
  async hotQuery<T extends QueryResultRow = any>(
    text: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET LOCAL vedadb.tier = 'hot'`);
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections — call on graceful shutdown.
   */
  async end(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Underlying pg.Pool for advanced usage (cursors, copy, listeners).
   */
  get pgPool(): Pool {
    return this.pool;
  }
}

// ============================================================
// VBP v1 binary wire (optional, advanced)
// ============================================================

/**
 * VBP v1 binary client — only needed for ORBIT features that benefit from
 * binary framing (multi-statement batching, streaming result sets, push
 * notifications). For most queries, the PG-wire path above is sufficient.
 *
 * Wire spec: see VBP_SPEC.md in vedadb-engine repo (canonical source).
 *
 * OpCodes (subset, per VBP_SPEC.md §5):
 * - 0x01 CLIENT_HELLO      : handshake init
 * - 0x02 SERVER_READY      : handshake ack
 * - 0x03 AUTH_RESPONSE     : SCRAM client-final-with-proof
 * - 0x04 AUTH_OK           : auth success
 * - 0x05 QUERY             : execute SQL
 * - 0x06 EXECUTE           : execute prepared statement
 * - 0x0A ROWS_STARTED      : response begin
 * - 0x0B DATA_CHUNK        : streaming row batch
 * - 0x0C COMMAND_COMPLETE  : final ack
 * - 0x0D ERROR             : error response
 * - 0x10 PING              : keepalive
 */

const VBP_OP = {
  CLIENT_HELLO: 0x01,
  SERVER_READY: 0x02,
  AUTH_RESPONSE: 0x03,
  AUTH_OK: 0x04,
  QUERY: 0x05,
  EXECUTE: 0x06,
  ROWS_STARTED: 0x0a,
  DATA_CHUNK: 0x0b,
  COMMAND_COMPLETE: 0x0c,
  ERROR: 0x0d,
  PING: 0x10,
};

interface VBPFrame {
  seq: number;
  opcode: number;
  flags: number;
  body: Buffer;
}

export class VBPClient extends EventEmitter {
  private socket: Socket | null = null;
  private connected = false;
  private nextSeq = 1;
  private inflight = new Map<number, { resolve: (r: VBPQueryResult) => void; reject: (e: Error) => void; frames: VBPFrame[]; isTerminal: boolean }>();

  constructor(private config: NonNullable<VedadbConfig['vbp']>) {
    super();
  }

  async connect(): Promise<void> {
    const port = this.config.port ?? (this.config.tls ? 6382 : 6381);
    return new Promise((resolve, reject) => {
      if (this.config.tls) {
        const tlsOpts: TLSOptions = { host: this.config.host, port };
        this.socket = tlsConnect(tlsOpts, () => this.onConnect(resolve, reject));
      } else {
        this.socket = netConnect(port, this.config.host, () => this.onConnect(resolve, reject));
      }
      this.socket!.on('error', reject);
      this.socket!.on('data', (chunk) => this.onData(chunk));
      this.socket!.on('close', () => {
        this.connected = false;
        this.emit('close');
      });
    });
  }

  private onConnect(resolve: () => void, reject: (e: Error) => void) {
    // Send CLIENT_HELLO with version=1 (LE u16)
    const helloBody = Buffer.alloc(2);
    helloBody.writeUInt16LE(1, 0); // version 1
    this.sendFrame(VBP_OP.CLIENT_HELLO, 0, helloBody, (err) => {
      if (err) return reject(err);
      this.connected = true;
      resolve();
    });
  }

  async query(sql: string, params: any[] = []): Promise<VBPQueryResult> {
    if (!this.connected || !this.socket) throw new Error('VBP not connected');
    const seq = this.nextSeq++;
    const start = Date.now();

    return new Promise<VBPQueryResult>((resolve, reject) => {
      const body = Buffer.concat([
        Buffer.from(sql, 'utf-8'),
        Buffer.from([0]),
        this.encodeParams(params),
      ]);
      this.inflight.set(seq, { resolve, reject, frames: [], isTerminal: false });

      this.sendFrame(VBP_OP.QUERY, seq, body, (err) => {
        if (err) {
          this.inflight.delete(seq);
          reject(err);
        }
      });
    }).then((result) => {
      result.durationMs = Date.now() - start;
      return result;
    });
  }

  /**
   * Encode params in VBP binary format.
   * Format per VBP_SPEC.md §4.2: count (u32 LE) + for each: type (u8) + len (u32 LE) + value
   */
  private encodeParams(params: any[]): Buffer {
    const chunks: Buffer[] = [];
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32LE(params.length, 0);
    chunks.push(countBuf);

    for (const p of params) {
      let type = 0x00; // NULL
      let val: Buffer = Buffer.alloc(0);
      if (p === null || p === undefined) {
        type = 0x00;
      } else if (typeof p === 'number') {
        type = Number.isInteger(p) ? 0x01 : 0x02; // INT or FLOAT
        val = Buffer.alloc(8);
        if (Number.isInteger(p)) val.writeBigInt64LE(BigInt(p), 0);
        else val.writeDoubleLE(p, 0);
      } else if (typeof p === 'boolean') {
        type = 0x03;
        val = Buffer.from([p ? 1 : 0]);
      } else if (typeof p === 'string') {
        type = 0x04;
        val = Buffer.from(p, 'utf-8');
      } else if (Buffer.isBuffer(p)) {
        type = 0x05;
        val = p;
      } else if (p instanceof Date) {
        type = 0x06;
        val = Buffer.alloc(8);
        val.writeBigInt64LE(BigInt(p.getTime()), 0);
      } else {
        type = 0x04;
        val = Buffer.from(JSON.stringify(p), 'utf-8');
      }
      const typeBuf = Buffer.from([type]);
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(val.length, 0);
      chunks.push(typeBuf, lenBuf, val);
    }
    return Buffer.concat(chunks);
  }

  private sendFrame(opcode: number, seq: number, body: Buffer, cb?: (err?: Error) => void) {
    if (!this.socket) return cb?.(new Error('Socket closed'));
    // Frame: 4 len + 1 opcode + 1 flags + 4 seq + body
    const len = 1 + 1 + 4 + body.length;
    const frame = Buffer.alloc(4 + len);
    frame.writeUInt32LE(len, 0);
    frame.writeUInt8(opcode, 4);
    frame.writeUInt8(0, 5); // flags
    frame.writeUInt32LE(seq, 6);
    body.copy(frame, 10);
    this.socket.write(frame, (err) => cb?.(err));
  }

  private onData(chunk: Buffer) {
    // Parse frames from buffer
    let offset = 0;
    while (offset + 10 <= chunk.length) {
      const len = chunk.readUInt32LE(offset);
      const totalLen = 4 + len;
      if (offset + totalLen > chunk.length) break; // need more data
      const opcode = chunk.readUInt8(offset + 4);
      const flags = chunk.readUInt8(offset + 5);
      const seq = chunk.readUInt32LE(offset + 6);
      const body = chunk.subarray(offset + 10, offset + totalLen);

      this.handleFrame({ seq, opcode, flags, body });
      offset += totalLen;
    }
  }

  private handleFrame(frame: VBPFrame) {
    // Multiplexer streaming: accumulate DATA_CHUNK frames until terminal opcode.
    // (This is the bug fixed in vedadb-driver's 7 SDKs — ensure streaming works.)
    const terminal = frame.opcode === VBP_OP.COMMAND_COMPLETE
                  || frame.opcode === VBP_OP.ERROR;

    if (terminal) {
      const entry = this.inflight.get(frame.seq);
      if (!entry) return;
      entry.frames.push(frame);
      this.inflight.delete(frame.seq);
      if (frame.opcode === VBP_OP.ERROR) {
        entry.reject(new Error(`VBP error: ${frame.body.toString('utf-8')}`));
      } else {
        entry.resolve(this.parseRowsResult(entry.frames));
      }
    } else if (frame.opcode === VBP_OP.DATA_CHUNK) {
      // ACCUMULATE — do NOT remove from inflight
      const entry = this.inflight.get(frame.seq);
      if (entry) entry.frames.push(frame);
    } else if (frame.opcode === VBP_OP.AUTH_OK) {
      this.emit('authenticated');
    } else if (frame.opcode === VBP_OP.SERVER_READY) {
      this.emit('ready');
    }
  }

  private parseRowsResult(frames: VBPFrame[]): VBPQueryResult {
    // Concatenate all DATA_CHUNK bodies
    const dataChunks = frames.filter(f => f.opcode === VBP_OP.DATA_CHUNK);
    const terminal = frames.find(f => f.opcode === VBP_OP.COMMAND_COMPLETE);

    const allRows: any[] = [];
    for (const chunk of dataChunks) {
      // Format per VBP_SPEC.md §6.1: row count (u32 LE) + rows
      let offset = 0;
      const body = chunk.body;
      while (offset + 4 <= body.length) {
        const rowCount = body.readUInt32LE(offset);
        offset += 4;
        // Row format simplified: assume JSON-encoded rows for ORBIT
        // Real impl would parse column metadata from ROWS_STARTED
        const jsonLen = body.readUInt32LE(offset);
        offset += 4;
        const jsonStr = body.subarray(offset, offset + jsonLen).toString('utf-8');
        offset += jsonLen;
        const rows = JSON.parse(jsonStr);
        allRows.push(...rows);
      }
    }

    const rowsAffected = terminal ? terminal.body.readUInt32LE(0) : 0;
    return { rows: allRows, rowsAffected, durationMs: 0, chunkedFrames: dataChunks.length };
  }

  async ping(): Promise<boolean> {
    if (!this.connected) return false;
    return new Promise((resolve) => {
      const seq = this.nextSeq++;
      this.inflight.set(seq, {
        resolve: () => resolve(true),
        reject: () => resolve(false),
        frames: [],
        isTerminal: true,
      });
      this.sendFrame(VBP_OP.PING, seq, Buffer.alloc(0));
      setTimeout(() => resolve(false), 5000);
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    // Reject any pending inflight
    for (const [, entry] of this.inflight) {
      entry.reject(new Error('VBP client closed'));
    }
    this.inflight.clear();
  }
}

// ============================================================
// Combined client — PG + optional VBP
// ============================================================

export class VedadbClient extends EventEmitter {
  public pg: VedadbPool;
  public vbp: VBPClient | null = null;

  constructor(private config: VedadbConfig) {
    super();
    this.pg = new VedadbPool(config);
    this.pg.on('error', (e) => this.emit('error', e));
    if (config.vbp) {
      this.vbp = new VBPClient(config.vbp);
    }
  }

  async init(): Promise<void> {
    // Verify PG connection with SELECT 1
    await this.pg.query('SELECT 1 as ok');
    if (this.vbp) {
      await this.vbp.connect();
    }
  }

  async close(): Promise<void> {
    await this.pg.end();
    if (this.vbp) await this.vbp.close();
  }
}

// ============================================================
// Factory
// ============================================================

export function createVedadbClient(config: VedadbConfig): VedadbClient {
  return new VedadbClient(config);
}

// Re-export pg types for convenience
export { Client, Pool } from 'pg';
export type { QueryResult, QueryResultRow };
