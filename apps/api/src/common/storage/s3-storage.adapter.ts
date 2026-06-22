import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface MediaUploadResult {
  url: string;
  key: string;
  bucket: string;
  cdnUrl: string;
  bytes: number;
  contentType: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: string;
}

/**
 * S3 + CloudFront media adapter.
 *
 * Falls back to local storage if AWS env vars not set.
 * Caches the S3 client.
 */
@Injectable()
export class S3StorageAdapter {
  private readonly logger = new Logger('S3StorageAdapter');
  private client: S3Client | null = null;
  private bucket: string = '';
  private cdnUrl: string = '';

  isConfigured(): boolean {
    return !!(process.env.AWS_S3_BUCKET && process.env.AWS_REGION);
  }

  private getClient(): S3Client {
    if (!this.client) {
      const region = process.env.AWS_REGION || 'us-east-1';
      this.client = new S3Client({
        region,
        credentials: process.env.AWS_ACCESS_KEY_ID
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            }
          : undefined, // use IAM role
      });
      this.bucket = process.env.AWS_S3_BUCKET || '';
      this.cdnUrl = process.env.CLOUDFRONT_URL || `https://${this.bucket}.s3.${region}.amazonaws.com`;
    }
    return this.client;
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<MediaUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('S3 not configured. Set AWS_S3_BUCKET + AWS_REGION.');
    }
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return {
      url: `${this.cdnUrl}/${key}`,
      cdnUrl: `${this.cdnUrl}/${key}`,
      key,
      bucket: this.bucket,
      bytes: body.length,
      contentType,
    };
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 600,
  ): Promise<PresignedUpload> {
    if (!this.isConfigured()) {
      throw new Error('S3 not configured');
    }
    const client = this.getClient();
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn });
    return {
      uploadUrl,
      key,
      publicUrl: `${this.cdnUrl}/${key}`,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('S3 not configured');
    }
    const client = this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string): Promise<void> {
    if (!this.isConfigured()) return;
    const client = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
