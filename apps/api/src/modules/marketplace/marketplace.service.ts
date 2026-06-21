/**
 * Marketplace Service
 * - Local listings with geo-spatial search
 * - Full-text search (Vedadb inverted index)
 * - Categories, conditions, prices
 */

import { Injectable } from '@nestjs/common';
import { getVedadbPool, OrbitGeo } from '@orbit/db';
import type { Listing } from '@orbit/types';

@Injectable()
export class MarketplaceService {
  private readonly db = getVedadbPool();
  private readonly geo: OrbitGeo;

  constructor() {
    this.geo = new OrbitGeo(this.db);
  }

  async create(sellerId: string, input: {
    title: string;
    description?: string;
    priceCents: number;
    currency?: string;
    mediaIds?: string[];
    category?: string;
    itemCondition?: 'new' | 'like_new' | 'good' | 'fair';
    locationLabel?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<Listing> {
    const locationGeo = input.latitude && input.longitude
      ? `ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`
      : null;

    const res = await this.db.query<any>(
      `INSERT INTO marketplace_listings (
        seller_id, title, description, price_cents, currency,
        media_ids, category, item_condition, location_label, location_geo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${locationGeo ? locationGeo : 'NULL'}::geography)
      RETURNING listing_id as "listingId", seller_id as "sellerId", title,
                description, price_cents as "priceCents", currency,
                media_ids as "mediaIds", category, item_condition as "itemCondition",
                location_label as "locationLabel",
                status, view_count as "viewCount", created_at as "createdAt"`,
      [
        sellerId, input.title, input.description, input.priceCents, input.currency || 'INR',
        input.mediaIds || [], input.category, input.itemCondition, input.locationLabel,
      ]
    );

    return res.rows[0];
  }

  async search(query: {
    q?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    cursor?: string;
    limit?: number;
  }): Promise<{ listings: Listing[]; nextCursor?: string }> {
    const limit = Math.min(query.limit ?? 30, 100);

    if (query.latitude && query.longitude) {
      // Geo-spatial search
      const nearby = await this.geo.nearbyListings({
        latitude: query.latitude,
        longitude: query.longitude,
        radiusMeters: (query.radiusKm ?? 10) * 1000,
        limit,
      });
      if (nearby.length === 0) return { listings: [] };
      const ids = nearby.map((n) => n.listingId);
      const res = await this.db.query<any>(
        `SELECT listing_id as "listingId", seller_id as "sellerId", title,
                description, price_cents as "priceCents", currency,
                media_ids as "mediaIds", category, item_condition as "itemCondition",
                location_label as "locationLabel", status,
                view_count as "viewCount", created_at as "createdAt"
         FROM marketplace_listings
         WHERE listing_id = ANY($1) AND status = 0
         ORDER BY created_at DESC LIMIT $2`,
        [ids, limit]
      );
      return { listings: res.rows };
    }

    // Full-text + category search
    const conditions: string[] = ['status = 0'];
    const params: any[] = [];
    let i = 1;

    if (query.q) {
      conditions.push(`search_vector @@ plainto_tsquery('simple', $${i++})`);
      params.push(query.q);
    }
    if (query.category) {
      conditions.push(`category = $${i++}`);
      params.push(query.category);
    }
    if (query.cursor) {
      conditions.push(`listing_id < $${i++}`);
      params.push(query.cursor);
    }
    params.push(limit + 1);

    const res = await this.db.query<any>(
      `SELECT listing_id as "listingId", seller_id as "sellerId", title,
              description, price_cents as "priceCents", currency,
              media_ids as "mediaIds", category, item_condition as "itemCondition",
              location_label as "locationLabel", status,
              view_count as "viewCount", created_at as "createdAt"
       FROM marketplace_listings
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${i}`,
      params
    );

    const listings = res.rows.slice(0, limit);
    const nextCursor = res.rows.length > limit ? listings[listings.length - 1]?.listingId : undefined;
    return { listings, nextCursor };
  }
}
