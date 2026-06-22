import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Local filesystem storage adapter — fallback when S3 not configured.
 * Stores under $ORBIT_MEDIA_DIR (default: ./media).
 */
@Injectable()
export class LocalStorageAdapter {
  private readonly logger = new Logger('LocalStorageAdapter');
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.ORBIT_MEDIA_DIR || path.join(process.cwd(), 'media');
  }

  async save(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const full = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return full;
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const full = path.join(this.baseDir, key);
      const buffer = await fs.readFile(full);
      const contentType = this.guessContentType(key);
      return { buffer, contentType };
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const full = path.join(this.baseDir, key);
      await fs.unlink(full);
    } catch (err: any) {
      if (err.code === 'ENOENT') return; // already gone
      throw err;
    }
  }

  private guessContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
      heic: 'image/heic',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      pdf: 'application/pdf',
      zip: 'application/zip',
    };
    return map[ext] || 'application/octet-stream';
  }
}
