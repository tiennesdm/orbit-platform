import type { ISO8601, DID } from './user';
export type GroupVisibility = 'public' | 'private' | 'invite_only';
export type GroupMemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export interface Group {
    id: string;
    name: string;
    slug: string;
    description?: string;
    avatarUrl?: string;
    coverUrl?: string;
    visibility: GroupVisibility;
    memberCount: number;
    rules?: string;
    pinnedPostIds: string[];
    topic?: string;
    city?: string;
    countryCode?: string;
    upcomingEventIds: string[];
    createdAt: ISO8601;
}
export interface GroupMember {
    groupId: string;
    userDid: DID;
    role: GroupMemberRole;
    joinedAt: ISO8601;
    notifications: {
        newPosts: boolean;
        events: boolean;
        mentions: boolean;
    };
}
export interface Event {
    id: string;
    groupId: string;
    title: string;
    description?: string;
    startAt: ISO8601;
    endAt?: ISO8601;
    timezone: string;
    isOnline: boolean;
    meetingUrl?: string;
    venueName?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    capacity?: number;
    attendingCount: number;
    maybeCount: number;
    declinedCount: number;
    coverMediaId?: string;
    createdAt: ISO8601;
}
