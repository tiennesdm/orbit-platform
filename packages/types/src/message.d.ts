import type { ISO8601, DID } from './user';
export type ThreadType = 'dm' | 'group';
export interface Thread {
    id: string;
    type: ThreadType;
    participantDids: DID[];
    lastMessageAt?: ISO8601;
    lastMessagePreview?: string;
    name?: string;
    avatarUrl?: string;
    createdBy?: DID;
    createdAt: ISO8601;
    settings: Record<DID, {
        muted: boolean;
        mutedUntil?: ISO8601;
        archived: boolean;
        pinned: boolean;
        unreadCount: number;
    }>;
}
export interface Message {
    id: string;
    threadId: string;
    senderDid: DID;
    ciphertext: string;
    encryption: {
        counter: number;
        prevCounter: number;
        ephemeralKey?: string;
    };
    replyToMessageId?: string;
    attachmentIds: string[];
    edited: boolean;
    deleted: boolean;
    reactions: Record<string, DID[]>;
    readBy: Record<DID, ISO8601>;
    sentAt: ISO8601;
    deliveredAt?: ISO8601;
}
