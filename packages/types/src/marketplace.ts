/**
 * ORBIT shared types — Marketplace (creator economy)
 */

import type { ISO8601, DID } from './user';

export type ListingStatus = 'draft' | 'active' | 'sold' | 'expired' | 'removed';
export type ListingCategory =
  | 'physical_product'
  | 'digital_product'
  | 'service'
  | 'rental'
  | 'event_ticket'
  | 'subscription';

export interface Listing {
  id: string;
  sellerDid: DID;
  title: string;
  description: string;
  category: ListingCategory;
  /** Pricing */
  priceCents: number;
  currency: string;                                         // ISO 4217
  /** Negotiable? */
  negotiable: boolean;
  /** For subscriptions: billing period */
  billingPeriod?: 'monthly' | 'yearly' | 'one_time';
  /** Media */
  mediaIds: string[];
  /** Condition (for physical) */
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  /** Location (for physical) */
  city?: string;
  region?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  /** Search tags */
  tags: string[];
  /** Status */
  status: ListingStatus;
  viewCount: number;
  favoriteCount: number;
  /** AI-suggested price? */
  aiSuggestedPriceCents?: number;
  createdAt: ISO8601;
  updatedAt: ISO8601;
  expiresAt?: ISO8601;
}
