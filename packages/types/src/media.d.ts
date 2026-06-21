import type { ISO8601, DID } from './user';
export type MediaType = 'image' | 'video' | 'audio';
export interface Media {
    id: string;
    ownerDid: DID;
    type: MediaType;
    url: string;
    thumbnailUrl?: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationSec?: number;
    encoding?: string;
    altText?: string;
    cid?: string;
    metadata?: Record<string, unknown>;
    visibility: 'public' | 'private';
    createdAt: ISO8601;
}
