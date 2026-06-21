/**
 * ORBIT shared types — Post domain (4 modes)
 */

import type { ISO8601, Handle, DID } from './user';
import type { Media } from './media';

export type PostMode = 'intimate' | 'public' | 'visual' | 'community';

export interface Hashtag {
  tag: string;                                              // without #
  postCount: number;
}

export interface Mention {
  did: DID;
  handle: Handle;
  displayName?: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Post as stored and returned by the API.
 *
 * Service-side field names (canonical):
 *   postId        — was `id` in the original draft
 *   authorId      — was `authorDid` (services use authorId everywhere)
 *   contentText   — was `content`
 *   parentId      — was `parentPostId`
 *   rootId        — was `threadRootId`
 *   commentCount  — was `replyCount`
 *   mediaCount    — new (count for fast list rendering)
 *   isPinned, isNsfw, isSponsored — new
 */
export interface Post {
  postId: string;
  authorId: DID;
  authorHandle?: Handle;
  authorDisplayName?: string;
  authorAvatarCid?: string;
  mode: PostMode;
  contentText?: string;
  mediaIds: string[];
  mediaCount?: number;
  hashtags: string[];
  mentions: Mention[];
  /** Threading (community mode) */
  parentId?: string;
  rootId?: string;
  commentCount: number;
  /** Engagement */
  likeCount: number;
  shareCount: number;
  viewCount: number;
  /** Privacy */
  visibility: 'public' | 'followers' | 'close_friends' | 'group';
  groupId?: string;
  /** Flags */
  isPinned?: boolean;
  isNsfw?: boolean;
  isSponsored?: boolean;
  /** AI flags */
  aiGenerated: boolean;
  nsfwScore?: number;
  toxicityScore?: number;
  /** Embedding for vector search */
  embeddingId?: string;
  language?: string;
  createdAt: ISO8601;
  editedAt?: ISO8601;
}

export interface CreatePostInput {
  mode: PostMode;
  contentText?: string;
  mediaIds?: string[];
  parentId?: string;
  rootId?: string;
  visibility?: Post['visibility'];
  groupId?: string;
  scheduledAt?: ISO8601;
}

export interface UpdatePostInput {
  contentText?: string;
  mediaIds?: string[];
  visibility?: Post['visibility'];
}