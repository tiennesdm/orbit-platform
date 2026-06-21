/**
 * ORBIT shared types — Story (ephemeral 24h)
 */

import type { ISO8601, DID } from './user';

export interface Story {
  id: string;
  authorDid: DID;
  /** Media (image/video) */
  mediaId: string;
  /** Optional caption overlay */
  caption?: string;
  /** Sticker / drawing data */
  overlays?: Array<{
    type: 'text' | 'sticker' | 'drawing';
    data: any;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  }>;
  /** Close friends only? */
  closeFriendsOnly: boolean;
  /** Engagement */
  viewCount: number;
  /** Auto-expire after 24h */
  expiresAt: ISO8601;
  createdAt: ISO8601;
}
