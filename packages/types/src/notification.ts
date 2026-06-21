/**
 * ORBIT shared types — Notifications
 */

import type { ISO8601, DID } from './user';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'dm'
  | 'group_invite'
  | 'event_reminder'
  | 'marketplace_offer'
  | 'ai_suggestion'
  | 'system';

export interface Notification {
  id: string;
  recipientDid: DID;
  type: NotificationType;
  /** Actor (the user who triggered the notification) */
  actorDid?: DID;
  actorHandle?: string;
  /** Subject (the entity being acted upon) */
  subjectType?: 'post' | 'reel' | 'story' | 'thread' | 'listing' | 'event';
  subjectId?: string;
  /** Human-readable text */
  text: string;
  /** AI priority score (0-1) — high = more important */
  priorityScore: number;
  /** Read state */
  read: boolean;
  readAt?: ISO8601;
  /** Push notification sent? */
  pushedAt?: ISO8601;
  createdAt: ISO8601;
}
