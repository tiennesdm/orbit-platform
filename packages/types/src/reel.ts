/**
 * ORBIT shared types — Reel (short-form video)
 */

import type { ISO8601, DID } from './user';

export interface Reel {
  id: string;
  authorDid: DID;
  /** Video media (HLS-encoded) */
  videoMediaId: string;
  /** Caption / description */
  caption?: string;
  /** Music track */
  audioTrackId?: string;
  /** Cover thumbnail */
  coverMediaId?: string;
  /** Engagement */
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  /** Sidebar reactions (TikTok-style) */
  reactions: Record<string, number>;
  /** Hashtags */
  hashtags: string[];
  /** AI-generated captions? */
  aiGeneratedCaptions: boolean;
  /** Visibility */
  visibility: 'public' | 'followers';
  createdAt: ISO8601;
}
