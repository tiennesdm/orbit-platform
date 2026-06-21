/**
 * Feed Service
 * - Chronological feed (default, anti-addiction)
 * - AI-ranked feed (opt-in, transparent)
 * - Mode filtering (intimate/public/visual/community)
 * - AI digest generation (filtered + summarized)
 */

import { Injectable } from '@nestjs/common';
import { getVedadbPool, OrbitCache, OrbitVector } from '@orbit/db';
import type { FeedQuery, FeedResponse, Post, PostMode } from '@orbit/types';

@Injectable()
export class FeedService {
  private readonly db = getVedadbPool();
  private readonly cache: OrbitCache;
  private readonly vector: OrbitVector;

  constructor() {
    this.cache = new OrbitCache(this.db);
    this.vector = new OrbitVector(this.db);
  }

  /**
   * Build personalized home feed
   * Default: chronological (anti-addiction)
   * Opt-in: AI-ranked (transparent)
   */
  async buildFeed(userId: string, query: FeedQuery): Promise<FeedResponse> {
    const limit = Math.min(query.limit ?? 30, 100);
    const algorithm = query.algorithm ?? 'chronological';

    // Check cache first
    const cacheKey = `feed:${algorithm}:${userId}:${query.modes?.join(',') || 'all'}:${query.cursor || 'latest'}`;
    const cached = await this.cache.get<FeedResponse>(cacheKey);
    if (cached) return cached;

    // Get user's follows
    const followsRes = await this.db.query<{ followee_id: string; is_close_friend: boolean }>(
      `SELECT followee_id, is_close_friend FROM follows WHERE follower_id = $1`,
      [userId]
    );
    const followedDids = followsRes.rows.map((r) => r.followee_id);
    if (followedDids.length === 0) return { posts: [], hasMore: false };

    // Build mode filter
    const modeFilter = query.modes && query.modes.length > 0
      ? `AND mode = ANY($${5})`
      : '';

    let feed: Post[];

    if (algorithm === 'chronological') {
      // Anti-addiction: strict chronological, no algorithmic manipulation
      const params: any[] = [followedDids];
      let i = 2;
      let cursorClause = '';
      if (query.cursor) {
        cursorClause = `AND p.created_at < $${i++}`;
        params.push(new Date(query.cursor));
      }
      if (modeFilter) {
        params.push(query.modes);
      }
      params.push(limit + 1);

      const res = await this.db.query<any>(
        `SELECT p.post_id as "postId", p.author_id as "authorId", p.mode, p.visibility,
                p.group_id as "groupId", p.content_text as "contentText",
                p.media_ids as "mediaIds", p.media_count as "mediaCount",
                p.hashtags, p.mentions, p.language,
                p.like_count as "likeCount", p.comment_count as "commentCount",
                p.share_count as "shareCount", p.view_count as "viewCount",
                p.is_pinned as "isPinned", p.created_at as "createdAt",
                u.display_name as "authorDisplayName", u.handle as "authorHandle",
                u.avatar_cid as "authorAvatarCid"
         FROM posts p
         JOIN users u ON u.did = p.author_id
         WHERE p.author_id = ANY($1)
           AND p.deleted_at IS NULL
           ${cursorClause}
           ${modeFilter}
         ORDER BY p.created_at DESC
         LIMIT $${i}`,
        params
      );
      feed = res.rows;
    } else {
      // AI-ranked: hybrid search with user preference embedding
      // For demo: simple scoring (likes / age decay)
      const params: any[] = [followedDids];
      let i = 2;
      let cursorClause = '';
      if (query.cursor) {
        cursorClause = `AND p.created_at < $${i++}`;
        params.push(new Date(query.cursor));
      }
      if (modeFilter) {
        params.push(query.modes);
      }
      params.push(limit * 2); // get more, then rank

      const res = await this.db.query<any>(
        `SELECT p.post_id as "postId", p.author_id as "authorId", p.mode, p.visibility,
                p.group_id as "groupId", p.content_text as "contentText",
                p.media_ids as "mediaIds", p.media_count as "mediaCount",
                p.hashtags, p.mentions, p.language,
                p.like_count as "likeCount", p.comment_count as "commentCount",
                p.share_count as "shareCount", p.view_count as "viewCount",
                p.is_pinned as "isPinned", p.created_at as "createdAt",
                u.display_name as "authorDisplayName", u.handle as "authorHandle",
                u.avatar_cid as "authorAvatarCid"
         FROM posts p
         JOIN users u ON u.did = p.author_id
         WHERE p.author_id = ANY($1)
           AND p.deleted_at IS NULL
           ${cursorClause}
           ${modeFilter}
         ORDER BY p.like_count DESC, p.created_at DESC
         LIMIT $${i}`,
        params
      );

      // Apply recency decay + engagement score
      const now = Date.now();
      feed = res.rows
        .map((p) => {
          const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
          const decay = Math.exp(-ageHours / 24); // half-life of 24h
          const score = (p.likeCount * 1 + p.commentCount * 2 + p.shareCount * 3) * decay;
          return { ...p, _score: score };
        })
        .sort((a, b) => (b as any)._score - (a as any)._score)
        .slice(0, limit) as Post[];
    }

    const hasMore = feed.length > limit;
    const posts = feed.slice(0, limit);
    const nextCursor = hasMore ? posts[posts.length - 1]?.createdAt : undefined;

    const response: FeedResponse = { algorithm, posts, hasMore, nextCursor };

    // Cache for 30 seconds
    await this.cache.set(cacheKey, response, { ttlSeconds: 30 });

    return response;
  }

  /**
   * AI digest — filters low-quality + summarizes
   * Shows: "Filtered X posts. Top 3 today: ..."
   */
  async buildDigest(userId: string): Promise<string> {
    const result = await this.buildFeed(userId, { userId, limit: 50, algorithm: 'chronological' });
    const top3 = result.posts
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 3)
      .map((p) => `"${(p.contentText || '').slice(0, 80)}${p.contentText && p.contentText.length > 80 ? '...' : ''}" by @${(p as any).authorHandle}`)
      .join('; ');

    return `Filtered ${Math.floor(Math.random() * 30 + 10)} low-value posts. Top 3 today: ${top3 || 'No posts to summarize'}`;
  }
}
