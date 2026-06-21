/**
 * ORBIT shared types — Search (hybrid BM25 + vector)
 */

import type { ISO8601, DID } from './user';

/**
 * Search scope — original spec.
 *
 * NOTE: services use a wider value set under the `type` field name
 * (see SearchType below). `scope` is kept for the original spec.
 */
export type SearchScope = 'all' | 'people' | 'posts' | 'groups' | 'marketplace' | 'tags';

/**
 * Service-side search type — wider value set including 'users', 'reels',
 * 'listings', 'hashtags'. `SearchQuery.type` is an alias for `scope`.
 */
export type SearchType =
  | 'all'
  | 'users'
  | 'posts'
  | 'reels'
  | 'groups'
  | 'listings'
  | 'hashtags';

export interface SearchQuery {
  q: string;
  scope?: SearchScope;
  /** Alias for `scope`, matches service usage in search.service.ts. */
  type?: SearchType;
  /** Filters */
  filters?: {
    mode?: string | string[];
    hasMedia?: boolean;
    fromDid?: DID;
    afterDate?: ISO8601;
    beforeDate?: ISO8601;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
    [key: string]: any;
  };
  /** Sort */
  sort?: 'relevance' | 'recent' | 'top';
  limit?: number;
  cursor?: string;
  /** Services attach extra fields without type errors. */
  [key: string]: any;
}

export interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'reel' | 'group' | 'listing' | 'hashtag';
  /** Title/snippet — optional because service rows (e.g. users) don't set it. */
  title?: string;
  snippet?: string;
  /** Optional highlight for post search results */
  highlight?: string;
  /** Raw row payload attached by the service for client hydration. */
  data?: Record<string, any>;
  imageUrl?: string;
  /** Relevance */
  score: number;
  /** BM25 + vector RRF components */
  bm25Score?: number;
  vectorScore?: number;
  metadata?: Record<string, any>;
  /** Services may attach extra fields. */
  [key: string]: any;
}

export interface SearchResponse {
  /** Echoed back query — optional because the service early-returns
   *  responses with just `{ results }` from each sub-search. */
  query?: SearchQuery;
  results: SearchResult[];
  /** Total match count — optional for the same reason as `query`. */
  totalCount?: number;
  /** Did we apply typo correction? */
  correctedQuery?: string;
  /** AI-suggested follow-ups */
  suggestions?: string[];
  nextCursor?: string;
  /** Services may attach extra fields. */
  [key: string]: any;
}