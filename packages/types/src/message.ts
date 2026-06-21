/**
 * ORBIT shared types — Messaging (DMs + Threads, E2E encrypted)
 */

import type { ISO8601, DID } from './user';

export type ThreadType = 'dm' | 'group';

/**
 * Thread as stored in the `threads` table. Field names mirror the SQL
 * aliases used by `dm.service.ts` (threadId, threadType, participantIds,
 * iconCid, unreadCounts, mutedBy) so service rows can be returned as-is.
 *
 * NOTE: the legacy `id`/`type`/`participantDids`/`avatarUrl`/`settings`
 * names from the original draft have been replaced — see git history if
 * you need to cross-reference older UI code.
 */
export interface Thread {
  threadId: string;
  threadType: ThreadType;
  /** DM: 2 DIDs; Group: list of DIDs. */
  participantIds: DID[];
  /** Last activity for sorting */
  lastMessageAt?: ISO8601;
  lastMessagePreview?: string;
  /** For group threads */
  name?: string;
  iconCid?: string;
  createdBy?: DID;
  createdAt: ISO8601;
  /** Map of DID -> unread count (per-user state, lives on the row) */
  unreadCounts?: Record<DID, number>;
  /** Map of DID -> muted flag */
  mutedBy?: Record<DID, boolean>;
  /** Per-user settings (DID -> settings) */
  settings?: Record<DID, {
    muted: boolean;
    mutedUntil?: ISO8601;
    archived: boolean;
    pinned: boolean;
    unreadCount: number;
  }>;
}

/**
 * Message as stored in the `messages` table. Server sees ONLY the
 * ciphertext blob (cannot decrypt). Field names mirror the SQL aliases
 * used by `dm.service.ts` (messageId, senderId, encryptedPayload,
 * contentType, recipientIds, readBy).
 */
export interface Message {
  messageId: string;
  threadId: string;
  senderId: DID;
  /** E2E encrypted ciphertext payload (Signal Protocol) — base64 in JSON. */
  encryptedPayload: string;
  /** Plaintext content type hint (server cannot see content). */
  contentType: 'text' | 'image' | 'video' | 'audio' | 'file';
  /** Recipient DIDs (for group threads). */
  recipientIds?: DID[];
  /** Optional metadata (NOT encrypted — for client UI only) */
  replyToMessageId?: string;
  attachmentIds?: string[];
  /** Edit/delete tracking */
  edited?: boolean;
  deleted?: boolean;
  /** Reactions: emoji -> list of DIDs */
  reactions?: Record<string, DID[]>;
  /** Read receipts (DID -> timestamp) */
  readBy?: Record<DID, ISO8601>;
  sentAt?: ISO8601;
  createdAt: ISO8601;
  deliveredAt?: ISO8601;
}