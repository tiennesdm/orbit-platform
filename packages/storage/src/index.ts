/**
 * ORBIT File Storage Module
 *
 * Multi-adapter storage layer with:
 * - Local filesystem (development)
 * - S3-compatible (AWS S3, Cloudflare R2, MinIO)
 * - Vedadb blob storage (production, content-addressed)
 *
 * Used for:
 * - User-uploaded media (photos, videos, audio)
 * - Personal Data Vault (PDS) backups
 * - Document attachments in DMs
 * - Story / Reel thumbnails
 */

import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { generateId } from '@orbit/crypto';

// ============================================================
// Types
// ============================================================
export interface StorageAdapter {
  readonly name: string;
  put(key: string, data: Buffer | Uint8Array | Readable, options?: PutOptions): Promise<StorageObject>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  head(key: string): Promise<StorageMetadata | null>;
  list(prefix: string, options?: ListOptions): Promise<StorageObject[]>;
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
}

export interface PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  acl?: 'private' | 'public-read';
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface SignedUrlOptions {
  expiresIn?: number;          // seconds
  method?: 'GET' | 'PUT';
}

export interface StorageObject {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified: Date;
  metadata?: Record<string, string>;
  cid?: string;                  // content-addressed hash (Vedadb adapter)
}

export interface StorageMetadata {
  size: number;
  contentType?: string;
  etag?: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export interface StorageConfig {
  adapter: 'local' | 's3' | 'vedadb';
  local?: { rootDir: string; publicUrlBase?: string };
  s3?: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;            // For R2, MinIO, etc.
    publicUrlBase?: string;
    cdnUrlBase?: string;
  };
  vedadb?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    bucket?: string;
  };
}

// ============================================================
// Local Filesystem Adapter (development)
// ============================================================
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';
  private rootDir: string;
  private publicUrlBase?: string;

  constructor(rootDir: string, publicUrlBase?: string) {
    this.rootDir = rootDir;
    this.publicUrlBase = publicUrlBase;
  }

  async put(key: string, data: Buffer | Uint8Array | Readable, options?: PutOptions): Promise<StorageObject> {
    const filePath = this.resolveKey(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      await fs.writeFile(filePath, data);
    } else {
      await pipeline(data, createWriteStream(filePath));
    }

    if (options?.metadata) {
      await this.writeMetadata(key, options.metadata);
    }

    const stats = await fs.stat(filePath);
    return {
      key,
      size: stats.size,
      contentType: options?.contentType,
      lastModified: stats.mtime,
      metadata: options?.metadata,
    };
  }

  async get(key: string): Promise<Readable> {
    const filePath = this.resolveKey(key);
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    try {
      await fs.unlink(filePath);
      await fs.unlink(`${filePath}.meta.json`).catch(() => {});
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async head(key: string): Promise<StorageMetadata | null> {
    try {
      const stats = await fs.stat(this.resolveKey(key));
      const meta = await this.readMetadata(key);
      return {
        size: stats.size,
        contentType: meta?.contentType,
        lastModified: stats.mtime,
        metadata: meta,
      };
    } catch {
      return null;
    }
  }

  async list(prefix: string, options?: ListOptions): Promise<StorageObject[]> {
    const dir = this.resolveKey(prefix);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const objects: StorageObject[] = [];

    for (const entry of entries) {
      if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
        const key = path.posix.join(prefix, entry.name);
        const filePath = this.resolveKey(key);
        const stats = await fs.stat(filePath);
        const meta = await this.readMetadata(key);
        objects.push({
          key,
          size: stats.size,
          contentType: meta?.contentType,
          lastModified: stats.mtime,
          metadata: meta || undefined,
        });
      }
    }

    return objects.slice(0, options?.limit ?? 100);
  }

  async getSignedUrl(key: string): Promise<string> {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${key}`;
    }
    throw new Error('LocalStorageAdapter does not support signed URLs without publicUrlBase');
  }

  private resolveKey(key: string): string {
    // Prevent path traversal
    if (key.includes('..')) throw new Error('Invalid key');
    return path.join(this.rootDir, key);
  }

  private async writeMetadata(key: string, metadata: Record<string, string>): Promise<void> {
    const metaPath = `${this.resolveKey(key)}.meta.json`;
    await fs.writeFile(metaPath, JSON.stringify(metadata));
  }

  private async readMetadata(key: string): Promise<Record<string, string> | null> {
    try {
      const metaPath = `${this.resolveKey(key)}.meta.json`;
      const content = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

// ============================================================
// S3-Compatible Adapter (AWS S3, Cloudflare R2, MinIO)
// ============================================================
export class S3StorageAdapter implements StorageAdapter {
  readonly name = 's3';
  // Note: In production, import @aws-sdk/client-s3 dynamically to avoid bundling
  // For now, we use a thin interface that can be implemented with any S3 client

  constructor(private config: NonNullable<StorageConfig['s3']>) {}

  async put(key: string, data: Buffer | Uint8Array | Readable, options?: PutOptions): Promise<StorageObject> {
    // Implementation uses AWS SDK v3
    // Lazy import to avoid bundling in non-S3 environments
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createClient();

    let body: Buffer | Readable;
    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      body = Buffer.from(data);
    } else {
      body = data;
    }

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: body as any,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      CacheControl: options?.cacheControl,
      ACL: options?.acl as any,
    });

    const result = await client.send(command);
    return {
      key,
      size: Buffer.isBuffer(body) ? body.length : 0,
      contentType: options?.contentType,
      etag: result.ETag,
      lastModified: new Date(),
      metadata: options?.metadata,
    };
  }

  async get(key: string): Promise<Readable> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createClient();
    const result = await client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    if (!result.Body) throw new Error(`Object not found: ${key}`);
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createClient();
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async head(key: string): Promise<StorageMetadata | null> {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createClient();
    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
        etag: result.ETag,
        lastModified: result.LastModified ?? new Date(),
        metadata: result.Metadata as any,
      };
    } catch {
      return null;
    }
  }

  async list(prefix: string, options?: ListOptions): Promise<StorageObject[]> {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const client = this.createClient();
    const result = await client.send(new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: prefix,
      MaxKeys: options?.limit ?? 1000,
      ContinuationToken: options?.cursor,
    }));
    return (result.Contents || []).map((obj) => ({
      key: obj.Key ?? '',
      size: obj.Size ?? 0,
      etag: obj.ETag,
      lastModified: obj.LastModified ?? new Date(),
    }));
  }

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const { S3Client, GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = this.createClient();
    const expiresIn = options?.expiresIn ?? 3600;
    const command = options?.method === 'PUT'
      ? new PutObjectCommand({ Bucket: this.config.bucket, Key: key })
      : new GetObjectCommand({ Bucket: this.config.bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn });
  }

  private createClient() {
    // Lazy import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    return new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      endpoint: this.config.endpoint,
      forcePathStyle: !!this.config.endpoint, // For MinIO
    });
  }
}

// ============================================================
// Vedadb Blob Adapter (production, content-addressed)
// ============================================================
export class VedadbStorageAdapter implements StorageAdapter {
  readonly name = 'vedadb';
  private bucket: string;

  constructor(private config: NonNullable<StorageConfig['vedadb']>, bucket = 'orbit-media') {
    this.bucket = bucket;
  }

  async put(key: string, data: Buffer | Uint8Array | Readable, options?: PutOptions): Promise<StorageObject> {
    // Vedadb blob storage: stores content-addressed blobs
    // The CID (content ID) is the SHA-256 hash of the content
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });

    try {
      // Read all data
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (data instanceof Uint8Array) {
        buffer = Buffer.from(data);
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      }

      // Compute CID (SHA-256)
      const cid = await this.computeCid(buffer);
      const size = buffer.length;

      // Insert into Vedadb blob storage table
      await pool.query(
        `INSERT INTO vedadb_blobs (cid, bucket, content, size_bytes, content_type, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (cid, bucket) DO NOTHING`,
        [cid, this.bucket, buffer, size, options?.contentType, JSON.stringify(options?.metadata || {})]
      );

      return {
        key,
        size,
        contentType: options?.contentType,
        cid,
        lastModified: new Date(),
        metadata: options?.metadata,
      };
    } finally {
      await pool.end();
    }
  }

  async get(key: string): Promise<Readable> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });

    try {
      const cid = this.cidFromKey(key);
      const result = await pool.query<{ content: Buffer }>(
        `SELECT content FROM vedadb_blobs WHERE cid = $1 AND bucket = $2`,
        [cid, this.bucket]
      );

      if (result.rows.length === 0) throw new Error(`Blob not found: ${key}`);
      const { Readable } = await import('node:stream');
      return Readable.from(result.rows[0].content);
    } finally {
      await pool.end();
    }
  }

  async delete(key: string): Promise<void> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });
    try {
      const cid = this.cidFromKey(key);
      await pool.query(`DELETE FROM vedadb_blobs WHERE cid = $1 AND bucket = $2`, [cid, this.bucket]);
    } finally {
      await pool.end();
    }
  }

  async exists(key: string): Promise<boolean> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });
    try {
      const cid = this.cidFromKey(key);
      const result = await pool.query(`SELECT 1 FROM vedadb_blobs WHERE cid = $1 AND bucket = $2 LIMIT 1`, [cid, this.bucket]);
      return result.rows.length > 0;
    } finally {
      await pool.end();
    }
  }

  async head(key: string): Promise<StorageMetadata | null> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });
    try {
      const cid = this.cidFromKey(key);
      const result = await pool.query<{ size_bytes: number; content_type: string; metadata: any; created_at: Date }>(
        `SELECT size_bytes, content_type, metadata, created_at FROM vedadb_blobs WHERE cid = $1 AND bucket = $2`,
        [cid, this.bucket]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        size: row.size_bytes,
        contentType: row.content_type,
        lastModified: row.created_at,
        metadata: row.metadata,
      };
    } finally {
      await pool.end();
    }
  }

  async list(prefix: string, options?: ListOptions): Promise<StorageObject[]> {
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });
    try {
      const result = await pool.query<{ cid: string; size_bytes: number; content_type: string; metadata: any; created_at: Date }>(
        `SELECT cid, size_bytes, content_type, metadata, created_at
         FROM vedadb_blobs
         WHERE bucket = $1 AND metadata->>'key' LIKE $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [this.bucket, `${prefix}%`, options?.limit ?? 100]
      );
      return result.rows.map((row) => ({
        key: row.metadata?.key || row.cid,
        size: row.size_bytes,
        contentType: row.content_type,
        cid: row.cid,
        lastModified: row.created_at,
        metadata: row.metadata,
      }));
    } finally {
      await pool.end();
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Vedadb blob storage: serve via CDN gateway
    return `${this.config.host}/storage/${this.bucket}/${this.cidFromKey(key)}`;
  }

  private cidFromKey(key: string): string {
    // Keys are stored as CIDs (content IDs)
    return key.startsWith('cid:') ? key.slice(4) : key;
  }

  private async computeCid(data: Buffer): Promise<string> {
    const { createHash } = await import('node:crypto');
    return 'cid:' + createHash('sha256').update(data).digest('hex');
  }
}

// ============================================================
// Storage Factory
// ============================================================
export function createStorage(config: StorageConfig): StorageAdapter {
  switch (config.adapter) {
    case 'local':
      if (!config.local) throw new Error('Local config required');
      return new LocalStorageAdapter(config.local.rootDir, config.local.publicUrlBase);
    case 's3':
      if (!config.s3) throw new Error('S3 config required');
      return new S3StorageAdapter(config.s3);
    case 'vedadb':
      if (!config.vedadb) throw new Error('Vedadb config required');
      return new VedadbStorageAdapter(config.vedadb);
    default:
      throw new Error(`Unknown adapter: ${config.adapter}`);
  }
}

// ============================================================
// Helper: Upload from URL (for cross-platform bridge)
// ============================================================
export async function uploadFromUrl(
  storage: StorageAdapter,
  sourceUrl: string,
  key: string,
  options?: PutOptions
): Promise<StorageObject> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  if (!response.body) throw new Error(`No body in response from ${sourceUrl}`);

  // Convert Web ReadableStream to Node Readable
  const { Readable } = await import('node:stream');
  const nodeStream = Readable.fromWeb(response.body as any);

  return storage.put(key, nodeStream, {
    ...options,
    contentType: options?.contentType ?? response.headers.get('content-type') ?? undefined,
  });
}

// ============================================================
// Helper: Generate storage key with content type prefix
// ============================================================
export function buildStorageKey(prefix: string, fileName?: string): string {
  const id = generateId().then ? require('@orbit/crypto').generateId() : Date.now().toString(36);
  const cleanName = fileName ? fileName.replace(/[^a-zA-Z0-9.-]/g, '_') : 'file';
  return `${prefix}/${id}/${cleanName}`;
}

// ============================================================
// Exports
// ============================================================
export default {
  create: createStorage,
  LocalStorageAdapter,
  S3StorageAdapter,
  VedadbStorageAdapter,
  uploadFromUrl,
  buildStorageKey,
};
