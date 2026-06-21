import type { ISO8601, DID } from './user';
export type SearchScope = 'all' | 'people' | 'posts' | 'groups' | 'marketplace' | 'tags';
export interface SearchQuery {
    q: string;
    scope?: SearchScope;
    filters?: {
        mode?: string[];
        hasMedia?: boolean;
        fromDid?: DID;
        afterDate?: ISO8601;
        beforeDate?: ISO8601;
        nearLat?: number;
        nearLng?: number;
        radiusKm?: number;
    };
    sort?: 'relevance' | 'recent' | 'top';
    limit?: number;
    cursor?: string;
}
export interface SearchResult {
    id: string;
    type: 'user' | 'post' | 'group' | 'listing' | 'tag';
    title: string;
    snippet?: string;
    imageUrl?: string;
    score: number;
    bm25Score?: number;
    vectorScore?: number;
    metadata?: Record<string, any>;
}
export interface SearchResponse {
    query: SearchQuery;
    results: SearchResult[];
    totalCount: number;
    correctedQuery?: string;
    suggestions?: string[];
    nextCursor?: string;
}
