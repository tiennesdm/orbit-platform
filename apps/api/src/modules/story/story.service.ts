/**
 * Story Service — Ephemeral stories (24h default)
 * - Stories auto-expire after TTL
 * - View tracking, reply tracking
 * - Close friends only option
 */

import { Injectable } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import type { Story } from '@orbit/types';

@Injectable()
export class StoryService {
  private readonly db = getVedadbPool();

  async create(authorId: string, input: {
    mediaId: string;
    textOverlay?: string;
    backgroundColor?: string;
    visibility?: 'public' | 'close_friends' | 'custom';
    ttlSeconds?: number;
    isPersistent?: boolean;
  }): Promise<Story> {
    const ttl = input.ttlSeconds ?? 86400;
    const expiresAt = input.isPersistent ? new Date(Date.now() + 365 * 86400 * 1000) : new Date(Date.now() + ttl * 1000);

    const res = await this.db.query<any>(
      `INSERT INTO stories (author_id, media_id, text_overlay, background_color, visibility, ttl_seconds, is_persistent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING story_id as "storyId", author_id as "authorId", media_id as "mediaId",
                 text_overlay as "textOverlay", background_color as "backgroundColor",
                 visibility, ttl_seconds as "ttlSeconds", is_persistent as "isPersistent",
                 expires_at as "expiresAt", view_count as "viewCount",
                 reply_count as "replyCount", created_at as "createdAt"`,
      [authorId, input.mediaId, input.textOverlay, input.backgroundColor, input.visibility ?? 0, ttl, input.isPersistent ?? false, expiresAt]
    );

    return res.rows[0];
  }

  async getStoriesForUser(userId: string): Promise<Story[]> {
    const res = await this.db.query<any>(
      `SELECT s.story_id as "storyId", s.author_id as "authorId", s.media_id as "mediaId",
              s.text_overlay as "textOverlay", s.visibility,
              s.ttl_seconds as "ttlSeconds", s.expires_at as "expiresAt",
              s.view_count as "viewCount", s.reply_count as "replyCount",
              s.created_at as "createdAt",
              u.display_name as "authorDisplayName", u.handle as "authorHandle",
              u.avatar_cid as "authorAvatarCid"
       FROM stories s
       JOIN users u ON u.did = s.author_id
       WHERE (
         s.visibility = 0  -- public
         OR s.author_id = $1  -- own stories
         OR (s.visibility = 1 AND $1 = ANY(
           SELECT followee_id FROM follows WHERE follower_id = s.author_id AND is_close_friend = TRUE
         ))
       )
       AND s.expires_at > NOW()
       AND s.author_id IN (
         SELECT followee_id FROM follows WHERE follower_id = $1
         UNION SELECT $1
       )
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.rows;
  }

  async markViewed(storyId: string, authorId: string, viewerId: string): Promise<void> {
    await this.db.query(
      `UPDATE stories SET view_count = view_count + 1 WHERE story_id = $1 AND author_id = $2`,
      [storyId, authorId]
    );

    // Record view (would need story_views table in production)
    await this.db.query(
      `INSERT INTO orbit_streams (channel, payload, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING`,
      [`story.view:${authorId}`, JSON.stringify({ storyId, viewerId, viewedAt: new Date().toISOString() })]
    );
  }
}
