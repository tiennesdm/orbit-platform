/**
 * ORBIT shared types — Feed (chronological + AI-ranked)
 */

import type { ISO8601, DID } from './user';
import type { PostMode } from './post';

export type FeedAlgorithm = 'chronological' | 'ai_ranked' | 'ai_digest' | 'hybrid';

export interface FeedQuery {
  /** Optional — services may default to 'chronological' when omitted. */
  algorithm?: FeedAlgorithm;
  /** The DID of the requesting user (passed in by controllers from auth). */
  userId?: DID;
  modes?: PostMode[];                                       // filter by mode
  limit?: number;                                           // default 20, max 50
  cursor?: string;                                          // pagination
  /** AI digest: include daily summary */
  includeDailyDigest?: boolean;
  /** Allow callers to pass extra fields without type errors. */
  [key: string]: any;
}

/**
 * FeedResponse is permissive because multiple service paths return partial
 * payloads (e.g. empty-feed early return, cached responses, AI digest with
 * extra fields). `algorithm` is optional for the same reason — callers
 * default to 'chronological' on the client.
 */
export interface FeedResponse {
  algorithm?: FeedAlgorithm;
  posts: any[];                                             // Post[] — kept loose to avoid circular types
  nextCursor?: string;
  hasMore: boolean;
  /** AI digest (only when algorithm='ai_digest') */
  dailyDigest?: {
    summary: string;
    topTopics: string[];
    unreadMentions: number;
    unreadDms: number;
    yourDayInNumbers: {
      postsYouAuthored: number;
      postsYouLiked: number;
      dmsYouReceived: number;
      minutesSpent: number;
    };
  };
  /** AI-ranked: relevance scores */
  relevanceScores?: Record<string, number>;
  /** Services attach extra metadata (cache hit, build time, etc.) */
  [key: string]: any;
}