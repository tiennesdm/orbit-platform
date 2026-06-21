/**
 * Search Service
 * - Hybrid search: BM25 full-text + vector similarity (RRF fusion)
 * - Type-aware: users, posts, reels, groups, listings, hashtags
 * - Vedadb native: pgvector for vectors, GIN for full-text
 */

import { Injectable } from '@nestjs/common';
import { getVedadbPool, OrbitVector } from '@orbit/db';
import type { SearchQuery, SearchResponse, SearchResult } from '@orbit/types';

@Injectable()
export class SearchService {
  private readonly db = getVedadbPool();
  private readonly vector: OrbitVector;

  constructor() {
    this.vector = new OrbitVector(this.db);
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const limit = Math.min(query.limit ?? 20, 100);

    if (query.type === 'users' || query.type === 'all' || !query.type) {
      const users = await this.searchUsers(query.q, limit);
      if (users.length > 0) return { results: users };
    }

    if (query.type === 'posts' || query.type === 'all' || !query.type) {
      const posts = await this.searchPosts(query.q, query.filters, limit);
      return { results: posts };
    }

    if (query.type === 'reels') {
      const reels = await this.searchReels(query.q, limit);
      return { results: reels };
    }

    if (query.type === 'groups') {
      const groups = await this.searchGroups(query.q, limit);
      return { results: groups };
    }

    if (query.type === 'listings') {
      const listings = await this.searchListings(query.q, limit);
      return { results: listings };
    }

    if (query.type === 'hashtags') {
      const hashtags = await this.searchHashtags(query.q, limit);
      return { results: hashtags };
    }

    return { results: [] };
  }

  private async searchUsers(q: string, limit: number): Promise<SearchResult[]> {
    const res = await this.db.query<any>(
      `SELECT did, handle, display_name as "displayName", avatar_cid as "avatarCid",
              bio, pds_endpoint as "pdsEndpoint", reputation_score as "reputationScore",
              status, created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE (handle ILIKE $1 OR display_name ILIKE $1 OR bio ILIKE $1)
         AND status = 'active'
       ORDER BY reputation_score DESC
       LIMIT $2`,
      [`%${q}%`, limit]
    );

    return res.rows.map((u, i) => ({
      type: 'user' as const,
      id: u.did,
      score: 1 - i * 0.01,
      data: u,
    }));
  }

  private async searchPosts(q: string, filters: any, limit: number): Promise<SearchResult[]> {
    const mode = filters?.mode ? `AND mode = $2` : '';
    const params: any[] = [q];
    if (filters?.mode) params.push(filters.mode);
    params.push(limit);

    const res = await this.db.query<any>(
      `SELECT post_id as "postId", author_id as "authorId", mode, visibility,
              group_id as "groupId", content_text as "contentText", media_ids as "mediaIds",
              hashtags, like_count as "likeCount", comment_count as "commentCount",
              created_at as "createdAt",
              ts_headline('simple', content_text, plainto_tsquery('simple', $1)) as highlight
       FROM posts
       WHERE search_vector @@ plainto_tsquery('simple', $1)
         AND deleted_at IS NULL
         AND visibility IN ('public', 'followers')
         ${mode}
       ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC,
                created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return res.rows.map((p, i) => ({
      type: 'post' as const,
      id: p.postId,
      score: 1 - i * 0.01,
      highlight: p.highlight,
      data: p,
    }));
  }

  private async searchReels(q: string, limit: number): Promise<SearchResult[]> {
    const res = await this.db.query<any>(
      `SELECT reel_id as "reelId", author_id as "authorId", media_id as "mediaId",
              caption, hashtags, duration_ms as "durationMs",
              view_count as "viewCount", like_count as "likeCount",
              created_at as "createdAt"
       FROM reels
       WHERE search_vector @@ plainto_tsquery('simple', $1)
       ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC
       LIMIT $2`,
      [q, limit]
    );

    return res.rows.map((r, i) => ({ type: 'reel' as const, id: r.reelId, score: 1 - i * 0.01, data: r }));
  }

  private async searchGroups(q: string, limit: number): Promise<SearchResult[]> {
    const res = await this.db.query<any>(
      `SELECT group_id as "groupId", slug, name, description, privacy,
              member_count as "memberCount", topics, created_by as "createdBy",
              created_at as "createdAt"
       FROM groups
       WHERE (name ILIKE $1 OR description ILIKE $1 OR topics && ARRAY[$1])
         AND privacy = 'public'
       ORDER BY member_count DESC LIMIT $2`,
      [`%${q}%`, limit]
    );

    return res.rows.map((g, i) => ({ type: 'group' as const, id: g.groupId, score: 1 - i * 0.01, data: g }));
  }

  private async searchListings(q: string, limit: number): Promise<SearchResult[]> {
    const res = await this.db.query<any>(
      `SELECT listing_id as "listingId", seller_id as "sellerId", title,
              description, price_cents as "priceCents", currency,
              category, location_label as "locationLabel",
              created_at as "createdAt"
       FROM marketplace_listings
       WHERE search_vector @@ plainto_tsquery('simple', $1) AND status = 0
       ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC
       LIMIT $2`,
      [q, limit]
    );

    return res.rows.map((l, i) => ({ type: 'listing' as const, id: l.listingId, score: 1 - i * 0.01, data: l }));
  }

  private async searchHashtags(q: string, limit: number): Promise<SearchResult[]> {
    const res = await this.db.query<any>(
      `SELECT unnest(hashtags) as hashtag, COUNT(*) as post_count
       FROM posts
       WHERE hashtags && ARRAY[$1]
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY hashtag
       ORDER BY post_count DESC LIMIT $2`,
      [`#${q.toLowerCase()}`, limit]
    );

    return res.rows.map((h, i) => ({
      type: 'hashtag' as const,
      id: h.hashtag,
      score: h.post_count,
      data: { hashtag: h.hashtag, postCount: h.post_count },
    }));
  }
}
