/**
 * ORBIT shared types — Groups (community mode)
 */

import type { ISO8601, DID } from './user';

/**
 * Group visibility — original spec uses `visibility`.
 *
 * NOTE: services read `group.privacy` (see group.service.ts:48 — `if (group.privacy === 'private')`),
 * so we expose BOTH names as the same value-set. `privacy` is the canonical
 * service-side field; `visibility` is kept as an alias for the original spec.
 *
 * The values list also includes 'hidden' because the service supports it
 * (group.controller.ts declares `privacy?: 'public' | 'private' | 'hidden'`).
 */
export type GroupVisibility = 'public' | 'private' | 'invite_only' | 'hidden';
export type GroupPrivacy = GroupVisibility;

export type GroupMemberRole = 'owner' | 'admin' | 'moderator' | 'member';

/**
 * Group as stored in the `groups` table. Field names mirror the SQL aliases
 * used by `group.service.ts` (groupId, privacy, coverCid, iconCid,
 * memberCount, postCount, createdBy).
 */
export interface Group {
  groupId: string;
  name: string;
  slug: string;
  description?: string;
  coverCid?: string;
  iconCid?: string;
  /** Service-side canonical field. */
  privacy: GroupPrivacy;
  /** Alias — the original spec used `visibility`. Same value set. */
  visibility?: GroupVisibility;
  /** Members */
  memberCount: number;
  postCount?: number;
  /** Rules / pinned posts */
  rules?: string;
  topics?: string[];
  pinnedPostIds?: string[];
  /** Linked community (geographic or topic-based) */
  topic?: string;
  city?: string;
  countryCode?: string;
  /** Events */
  upcomingEventIds?: string[];
  createdBy?: DID;
  createdAt: ISO8601;
}

export interface GroupMember {
  groupId: string;
  userId: DID;
  userDid?: DID;
  role: GroupMemberRole;
  joinedAt: ISO8601;
  mutedUntil?: ISO8601;
  /** Notification preferences */
  notifications?: {
    newPosts: boolean;
    events: boolean;
    mentions: boolean;
  };
}

/**
 * Event as stored in the `events` table. Field names mirror the SQL
 * aliases used by `group.service.ts` (eventId, creatorId, startsAt,
 * endsAt, locationType, location, rsvpGoing, rsvpInterested, isTicketed,
 * ticketPriceCents, currency).
 */
export interface Event {
  eventId: string;
  groupId: string;
  creatorId: DID;
  title: string;
  description?: string;
  startsAt: ISO8601;
  endsAt?: ISO8601;
  /** IANA timezone — kept for forward-compat */
  timezone?: string;
  /** 'online' | 'physical' | 'hybrid' */
  locationType?: 'online' | 'physical' | 'hybrid';
  /** Free-form location string (URL for online, address for physical) */
  location?: string;
  /** Capacity / RSVP tracking */
  isTicketed?: boolean;
  ticketPriceCents?: number;
  currency?: string;
  rsvpGoing?: number;
  rsvpInterested?: number;
  rsvpMaybe?: number;
  rsvpDeclined?: number;
  /** Legacy aliases from the original spec. */
  isOnline?: boolean;
  meetingUrl?: string;
  venueName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  attendingCount?: number;
  maybeCount?: number;
  declinedCount?: number;
  coverMediaId?: string;
  createdAt: ISO8601;
}