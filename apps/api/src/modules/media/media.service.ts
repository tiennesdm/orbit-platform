import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { MetricsService } from '../../common/observability/metrics.service';
import { S3StorageAdapter, PresignedUpload, MediaUploadResult } from '../../common/storage/s3-storage.adapter';
import { LocalStorageAdapter } from '../../common/storage/local-storage.adapter';
import { v4 as uuidv4 } from 'uuid';

export interface MediaMetadata {
  id: string;
  ownerId: string;
  type: 'image' | 'video' | 'audio' | 'file';
  mimeType: string;
  bytes: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  blurhash?: string;
  altText?: string;
  createdAt: string;
}

const ALLOWED_MIME = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac'],
  file: ['application/pdf', 'application/zip'],
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger('MediaService');

  constructor(
    private readonly s3: S3StorageAdapter,
    private readonly local: LocalStorageAdapter,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Get a presigned upload URL (S3) — for client-direct upload.
   * Falls back to local upload endpoint if S3 not configured.
   */
  async getPresignedUpload(
    ownerId: string,
    contentType: string,
    bytes: number,
  ): Promise<PresignedUpload | { localUploadEndpoint: string; key: string }> {
    const type = this.detectType(contentType);
    if (!type) {
      throw new BadRequestException(`Unsupported content type: ${contentType}`);
    }

    const ext = contentType.split('/')[1] || 'bin';
    const key = `media/${ownerId}/${type}/${uuidv4()}.${ext}`;

    if (this.s3.isConfigured()) {
      this.logger.log(`S3 presigned upload for ${key} (${bytes}B)`);
      return this.s3.getPresignedUploadUrl(key, contentType);
    }

    // Local fallback
    return {
      localUploadEndpoint: `/api/v1/media/local-upload?key=${encodeURIComponent(key)}&type=${encodeURIComponent(contentType)}`,
      key,
    };
  }

  /**
   * Persist media metadata after upload completes (or after local upload finishes).
   */
  async saveMetadata(
    ownerId: string,
    data: {
      key: string;
      type: 'image' | 'video' | 'audio' | 'file';
      mimeType: string;
      bytes: number;
      width?: number;
      height?: number;
      durationSec?: number;
      blurhash?: string;
      altText?: string;
    },
  ): Promise<MediaMetadata> {
    const id = uuidv4();
    const url = this.s3.isConfigured()
      ? `${process.env.CLOUDFRONT_URL || `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`}/${data.key}`
      : `/api/v1/media/local/${encodeURIComponent(data.key)}`;

    getVedadbPool().query(
      `INSERT INTO media (
        id, owner_id, type, mime_type, bytes, url, key,
        width, height, duration_sec, blurhash, alt_text, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        id, ownerId, data.type, data.mimeType, data.bytes, url, data.key,
        data.width || null, data.height || null, data.durationSec || null,
        data.blurhash || null, data.altText || null,
      ],
    );

    this.metrics.mediaUploads.inc({ type: data.type });
    this.metrics.mediaUploadBytes.inc({ type: data.type }, data.bytes);

    return {
      id,
      ownerId,
      type: data.type,
      mimeType: data.mimeType,
      bytes: data.bytes,
      url,
      width: data.width,
      height: data.height,
      durationSec: data.durationSec,
      blurhash: data.blurhash,
      altText: data.altText,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Local upload fallback — saves to /tmp/orbit-media/{key}
   */
  async saveLocal(key: string, buffer: Buffer, contentType: string): Promise<MediaUploadResult> {
    const url = await this.local.save(key, buffer, contentType);
    return {
      url: `/api/v1/media/local/${encodeURIComponent(key)}`,
      cdnUrl: url,
      key,
      bucket: 'local',
      bytes: buffer.length,
      contentType,
    };
  }

  async getLocal(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    return this.local.get(key);
  }

  async deleteMedia(mediaId: string, ownerId: string): Promise<void> {
    const r = getVedadbPool().query(
      `SELECT key FROM media WHERE id = $1 AND owner_id = $2`,
      [mediaId, ownerId],
    );
    if (r.rowCount === 0) {
      throw new BadRequestException('Media not found or not owned by user');
    }
    const key = r.rows[0].key;
    if (this.s3.isConfigured()) {
      await this.s3.delete(key);
    } else {
      await this.local.delete(key);
    }
    getVedadbPool().query(`DELETE FROM media WHERE id = $1`, [mediaId]);
  }

  private detectType(mime: string): 'image' | 'video' | 'audio' | 'file' | null {
    for (const [type, mimes] of Object.entries(ALLOWED_MIME)) {
      if (mimes.includes(mime)) return type as any;
    }
    return null;
  }
}
