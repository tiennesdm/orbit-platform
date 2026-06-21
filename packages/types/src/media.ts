/**
 * ORBIT shared types — Media (images, videos, audio)
 */

import type { ISO8601, DID } from './user';

export type MediaType = 'image' | 'video' | 'audio';

export interface Media {
  id: string;
  ownerDid: DID;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  /** Original filename */
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  /** For video/audio */
  durationSec?: number;
  /** Encoding (e.g. 'h264', 'aac') */
  encoding?: string;
  /** Alt text for accessibility */
  altText?: string;
  /** Hash for content-addressed storage */
  cid?: string;
  /** EXIF/metadata (privacy-filtered) */
  metadata?: Record<string, unknown>;
  /** Visibility */
  visibility: 'public' | 'private';
  createdAt: ISO8601;
}
