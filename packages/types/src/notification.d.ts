import type { ISO8601, DID } from './user';
export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'dm' | 'group_invite' | 'event_reminder' | 'marketplace_offer' | 'ai_suggestion' | 'system';
export interface Notification {
    id: string;
    recipientDid: DID;
    type: NotificationType;
    actorDid?: DID;
    actorHandle?: string;
    subjectType?: 'post' | 'reel' | 'story' | 'thread' | 'listing' | 'event';
    subjectId?: string;
    text: string;
    priorityScore: number;
    read: boolean;
    readAt?: ISO8601;
    pushedAt?: ISO8601;
    createdAt: ISO8601;
}
