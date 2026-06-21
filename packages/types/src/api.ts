/**
 * ORBIT shared types — API envelopes
 */

import type { ISO8601 } from './user';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  /** Server-side timestamp */
  serverTime: ISO8601;
  /** Pagination cursor (if applicable) */
  nextCursor?: string;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    /** Request ID for support */
    requestId: string;
  };
  serverTime: ISO8601;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Pagination */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string;
}

/** Realtime events */
export type RealtimeEventType =
  | 'message_new'
  | 'message_edited'
  | 'message_deleted'
  | 'post_new'
  | 'post_liked'
  | 'notification_new'
  | 'user_typing'
  | 'user_online'
  | 'user_offline'
  | 'stream_update';

export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  channel: string;                                          // e.g. "dm:thread-uuid"
  payload: T;
  serverTime: ISO8601;
}
