# ORBIT — File Storage

Multi-adapter file storage for ORBIT. Used for user-uploaded media (photos, videos, audio), Personal Data Vault (PDS) backups, document attachments in DMs, and story/reel thumbnails.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Storage Adapter Interface                    │
│                                                                  │
│  put() · get() · delete() · exists() · head() · list()      │
│  getSignedUrl()                                                │
└──────────────┬───────────────┬───────────────┬───────────────┘
               │               │               │
       ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────────┐
       │    Local     │ │     S3      │ │    Vedadb       │
       │  Filesystem  │ │ Compatible   │ │  Blob Store    │
       │  (dev only)  │ │ (prod/CF R2)│ │ (truly native) │
       └──────────────┘ └──────────────┘ └────────────────┘
```

## Adapters

### LocalStorageAdapter (development)
- Stores files on local filesystem under configurable root dir
- Supports metadata sidecar files (`.meta.json`)
- Optional `publicUrlBase` for direct file serving (dev convenience)
- Path-traversal protection

### S3StorageAdapter (production)
- Works with AWS S3, Cloudflare R2, MinIO (via S3-compatible API)
- Lazy imports `@aws-sdk/client-s3` (only loaded when needed)
- Supports presigned URLs for direct browser uploads
- Custom endpoint support for non-AWS providers

### VedadbStorageAdapter (production, content-addressed)
- Stores content-addressed blobs directly in Vedadb
- CID (Content ID) is SHA-256 hash of file content (deduplication automatic)
- Stored in `vedadb_blobs` table (PostgreSQL-compatible for dev)
- Eliminates need for separate S3 in fully-native deployments
- Reduces storage costs (dedup) + simplifies ops (one engine)

## Schema

```sql
-- Vedadb blob storage table (used by VedadbStorageAdapter)
CREATE TABLE vedadb_blobs (
  cid           TEXT PRIMARY KEY,              -- sha256 hash of content
  bucket        TEXT NOT NULL,                 -- logical namespace
  content       BYTEA NOT NULL,                -- binary content
  size_bytes    BIGINT NOT NULL,
  content_type  TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cid, bucket)
);
CREATE INDEX idx_vedadb_blobs_bucket_created ON vedadb_blobs (bucket, created_at DESC);
CREATE INDEX idx_vedadb_blobs_metadata ON vedadb_blobs USING gin (metadata);
```

## Usage

```typescript
import { createStorage, uploadFromUrl, buildStorageKey } from '@orbit/storage';

// Choose adapter
const storage = createStorage({
  adapter: 's3',
  s3: {
    region: 'us-east-1',
    bucket: 'orbit-media-prod',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Upload
const obj = await storage.put(
  buildStorageKey('photos/2026/06'),
  buffer,
  { contentType: 'image/jpeg', metadata: { userId: 'did:orbit:abc' } }
);

// Get presigned URL for direct browser upload
const url = await storage.getSignedUrl(obj.key, { expiresIn: 600 });

// List user's files
const files = await storage.list('photos/2026/06/user/abc');

// Get file as stream
const stream = await storage.get(obj.key);
stream.pipe(response);
```

## Why this matters for ORBIT

- **Cost**: Vedadb blob storage with content-addressed deduplication saves money on repeated media (same image posted by multiple users)
- **Portability**: Users can move their media vault when they switch PDS endpoints
- **Performance**: Stream-friendly APIs avoid loading large files into memory
- **Flexibility**: Multiple adapters support dev (local), cloud (S3), or fully-native (Vedadb) deployments
- **Security**: Presigned URLs for direct browser uploads avoid backhaul through app servers

## Configuration

```bash
# Local (default for development)
STORAGE_ADAPTER=local
STORAGE_LOCAL_ROOT_DIR=./uploads
STORAGE_LOCAL_PUBLIC_URL=http://localhost:3000/uploads

# S3 / R2 (production)
STORAGE_ADAPTER=s3
S3_REGION=us-east-1
S3_BUCKET=orbit-media-prod
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
S3_CDN_URL_BASE=https://cdn.orbit.com

# Vedadb native (alternative production)
STORAGE_ADAPTER=vedadb
VEDADB_HOST=cluster.vedadb.io
VEDADB_DATABASE=orbit
```

See `@orbit/storage/src/index.ts` for full API.
