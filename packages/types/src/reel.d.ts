import type { ISO8601, DID } from './user';
export interface Reel {
    id: string;
    authorDid: DID;
    videoMediaId: string;
    caption?: string;
    audioTrackId?: string;
    coverMediaId?: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    saveCount: number;
    reactions: Record<string, number>;
    hashtags: string[];
    aiGeneratedCaptions: boolean;
    visibility: 'public' | 'followers';
    createdAt: ISO8601;
}
