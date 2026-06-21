import type { ISO8601, DID } from './user';
export type ListingStatus = 'draft' | 'active' | 'sold' | 'expired' | 'removed';
export type ListingCategory = 'physical_product' | 'digital_product' | 'service' | 'rental' | 'event_ticket' | 'subscription';
export interface Listing {
    id: string;
    sellerDid: DID;
    title: string;
    description: string;
    category: ListingCategory;
    priceCents: number;
    currency: string;
    negotiable: boolean;
    billingPeriod?: 'monthly' | 'yearly' | 'one_time';
    mediaIds: string[];
    condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
    city?: string;
    region?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
    tags: string[];
    status: ListingStatus;
    viewCount: number;
    favoriteCount: number;
    aiSuggestedPriceCents?: number;
    createdAt: ISO8601;
    updatedAt: ISO8601;
    expiresAt?: ISO8601;
}
