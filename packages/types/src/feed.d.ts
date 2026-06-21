import type { PostMode } from './post';
export type FeedAlgorithm = 'chronological' | 'ai_ranked' | 'ai_digest';
export interface FeedQuery {
    algorithm: FeedAlgorithm;
    modes?: PostMode[];
    limit?: number;
    cursor?: string;
    includeDailyDigest?: boolean;
}
export interface FeedResponse {
    algorithm: FeedAlgorithm;
    posts: any[];
    nextCursor?: string;
    hasMore: boolean;
    dailyDigest?: {
        summary: string;
        topTopics: string[];
        unreadMentions: number;
        unreadDms: number;
        yourDayInNumbers: {
            postsYouAuthored: number;
            postsYouLiked: number;
            dmsYouReceived: number;
            minutesSpent: number;
        };
    };
    relevanceScores?: Record<string, number>;
}
