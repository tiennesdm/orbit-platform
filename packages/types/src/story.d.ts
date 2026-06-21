import type { ISO8601, DID } from './user';
export interface Story {
    id: string;
    authorDid: DID;
    mediaId: string;
    caption?: string;
    overlays?: Array<{
        type: 'text' | 'sticker' | 'drawing';
        data: any;
        x: number;
        y: number;
        scale: number;
        rotation: number;
    }>;
    closeFriendsOnly: boolean;
    viewCount: number;
    expiresAt: ISO8601;
    createdAt: ISO8601;
}
