import type { ISO8601, Handle, DID } from './user';
export type PostMode = 'intimate' | 'public' | 'visual' | 'community';
export interface Hashtag {
    tag: string;
    postCount: number;
}
export interface Mention {
    did: DID;
    handle: Handle;
    displayName?: string;
    startOffset: number;
    endOffset: number;
}
export interface Post {
    id: string;
    authorDid: DID;
    authorHandle?: Handle;
    authorDisplayName?: string;
    mode: PostMode;
    content: string;
    mediaIds: string[];
    hashtags: string[];
    mentions: Mention[];
    parentPostId?: string;
    threadRootId?: string;
    replyCount: number;
    likeCount: number;
    shareCount: number;
    viewCount: number;
    visibility: 'public' | 'followers' | 'close_friends' | 'group';
    groupId?: string;
    aiGenerated: boolean;
    nsfwScore?: number;
    toxicityScore?: number;
    embeddingId?: string;
    createdAt: ISO8601;
    editedAt?: ISO8601;
}
export interface CreatePostInput {
    mode: PostMode;
    content: string;
    mediaIds?: string[];
    parentPostId?: string;
    threadRootId?: string;
    visibility?: Post['visibility'];
    groupId?: string;
    scheduledAt?: ISO8601;
}
export interface UpdatePostInput {
    content?: string;
    mediaIds?: string[];
    visibility?: Post['visibility'];
}
