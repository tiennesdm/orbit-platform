/**
 * Reel Service — Short-form vertical video
 * - Full-screen HLS streaming
 * - Sidebar engagement (like, comment, share, follow)
 * - Music attribution
 */

import { Injectable } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import type { Reel } from '@orbit/types';

@Injectable()
export class ReelService {
  private readonly db = getVedadbPool();

  async create(authorId: string, input: {
    mediaId: string;
    caption?: string;
    audioTrackId?: string;
    hashtags?: string[];
    durationMs: number;
  }): Promise<Reel> {
    const res = await this.db.query<any>(
      `INSERT INTO reels (author_id, media_id, caption, audio_track_id, hashtags, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING reel_id as "reelId", author_id as "authorId", media_id as "mediaId",
                 caption, audio_track_id as "audioTrackId", hashtags,
                 duration_ms as "durationMs", view_count as "viewCount",
                 like_count as "likeCount", comment_count as "commentCount",
                 share_count as "shareCount", save_count as "saveCount",
                 created_at as "createdAt"`,
      [authorId, input.mediaId, input.caption, input.audioTrackId, input.hashtags || [], input.durationMs]
    );
    return res.rows[0];
  }

  async getForYouFeed(userId: string, cursor?: string, limit = 20): Promise<Reel[]> {
    // Simplified: chronological with engagement boost
    const params: any[] = [];
    let cursorClause = '';
    if (cursor) {
      cursorClause = `AND r.created_at < $1`;
      params.push(new Date(cursor));
    }
    params.push(limit);

    const res = await this.db.query<any>(
      `SELECT r.reel_id as "reelId", r.author_id as "authorId", r.media_id as "mediaId",
              r.caption, r.hashtags, r.duration_ms as "durationMs",
              r.view_count as "viewCount", r.like_count as "likeCount",
              r.comment_count as "commentCount", r.share_count as "shareCount",
              r.created_at as "createdAt",
              u.display_name as "authorDisplayName", u.handle as "authorHandle"
       FROM reels r
       JOIN users u ON u.did = r.author_id
       WHERE 1=1 ${cursorClause}
       ORDER BY r.view_count DESC, r.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return res.rows;
  }

  async incrementView(reelId: string, authorId: string): Promise<void> {
    await this.db.query(
      `UPDATE reels SET view_count = view_count + 1 WHERE reel_id = $1 AND author_id = $2`,
      [reelId, authorId]
    );
  }

  async like(reelId: string, authorId: string, userId: string): Promise<{ liked: boolean }> {
    // Idempotent toggle via reel_likes table. Trigger keeps reels.like_count in sync.
    // Fixes: fake-success increment, wrong target_type=1 (was 'post' instead of 'reel').
    const existing = await this.db.query<{ liker_did: string }>(
      `SELECT liker_did FROM reel_likes WHERE reel_id = $1 AND author_id = $2 AND liker_did = $3 LIMIT 1`,
      [reelId, authorId, userId]
    );
    if (existing.rows.length > 0) {
      await this.db.query(
        `DELETE FROM reel_likes WHERE reel_id = $1 AND author_id = $2 AND liker_did = $3`,
        [reelId, authorId, userId]
      );
      return { liked: false };
    }
    await this.db.query(
      `INSERT INTO reel_likes (reel_id, author_id, liker_did) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [reelId, authorId, userId]
    );
    await this.db.query(
      `INSERT INTO notifications (user_id, actor_id, type, target_type, target_id, payload)
       VALUES ($1, $2, 'like', 3, $3, '{}')  -- 3 = reel (was 1 = post, was a bug)
       ON CONFLICT DO NOTHING`,
      [authorId, userId, reelId]
    );
    return { liked: true };
  }
}
