/**
 * Post Service
 * 4 modes: intimate, public, visual, community
 * Sharded by author_id, full-text indexed via Vedadb inverted index
 */

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { getVedadbPool, OrbitCache, OrbitPubSub } from '@orbit/db';
import type { Post, CreatePostInput, UpdatePostInput, PostMode } from '@orbit/types';

@Injectable()
export class PostService {
  private readonly db = getVedadbPool();
  private readonly cache: OrbitCache;
  private readonly pubsub: OrbitPubSub;

  constructor() {
    this.cache = new OrbitCache(this.db);
    this.pubsub = new OrbitPubSub(this.db);
  }

  /**
   * Create a post (any of 4 modes)
   */
  async create(authorId: string, input: CreatePostInput): Promise<Post> {
    if (!input.contentText && (!input.mediaIds || input.mediaIds.length === 0)) {
      throw new BadRequestException('Post must have either text or media');
    }

    // Extract hashtags from content
    const hashtags = this.extractHashtags(input.contentText || '');
    const mentions = this.extractMentions(input.contentText || '');

    const res = await this.db.query<any>(
      `INSERT INTO posts (
        author_id, mode, visibility, group_id, parent_id, root_id,
        content_text, media_ids, media_count, hashtags, mentions, language,
        like_count, comment_count, share_count, view_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 0, 0, 0)
      RETURNING post_id as "postId", author_id as "authorId", mode, visibility,
                group_id as "groupId", parent_id as "parentId", root_id as "rootId",
                content_text as "contentText", media_ids as "mediaIds", media_count as "mediaCount",
                hashtags, mentions, language, like_count as "likeCount",
                comment_count as "commentCount", share_count as "shareCount",
                view_count as "viewCount", is_pinned as "isPinned",
                is_nsfw as "isNsfw", is_sponsored as "isSponsored",
                created_at as "createdAt", edited_at as "editedAt"`,
      [
        authorId,
        input.mode,
        input.visibility || 'followers',
        input.groupId || null,
        input.parentId || null,
        input.rootId || input.parentId || null,
        input.contentText || null,
        input.mediaIds || [],
        input.mediaIds?.length || 0,
        hashtags,
        mentions,
        'en', // TODO: detect language
      ]
    );

    const post = res.rows[0];

    // Publish to author's followers
    await this.pubsub.publish(`post.created:${authorId}`, { postId: post.postId, mode: post.mode });

    // Invalidate timeline caches
    await this.cache.del(`feed:chronological:${authorId}`);

    return post;
  }

  async findById(authorId: string, postId: string): Promise<Post | null> {
    const res = await this.db.query<any>(
      `SELECT post_id as "postId", author_id as "authorId", mode, visibility,
              group_id as "groupId", parent_id as "parentId", root_id as "rootId",
              content_text as "contentText", media_ids as "mediaIds", media_count as "mediaCount",
              hashtags, mentions, language, like_count as "likeCount",
              comment_count as "commentCount", share_count as "shareCount",
              view_count as "viewCount", is_pinned as "isPinned",
              is_nsfw as "isNsfw", is_sponsored as "isSponsored",
              created_at as "createdAt", edited_at as "editedAt"
       FROM posts WHERE author_id = $1 AND post_id = $2 AND deleted_at IS NULL`,
      [authorId, postId]
    );
    return res.rows[0] ?? null;
  }

  async findMany(query: { authorId?: string; mode?: PostMode; cursor?: string; limit?: number }): Promise<{ posts: Post[]; nextCursor?: string }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let i = 1;

    if (query.authorId) {
      conditions.push(`author_id = $${i++}`);
      params.push(query.authorId);
    }
    if (query.mode) {
      conditions.push(`mode = $${i++}`);
      params.push(query.mode);
    }
    if (query.cursor) {
      conditions.push(`post_id < $${i++}`);
      params.push(query.cursor);
    }

    params.push(limit + 1);

    const res = await this.db.query<any>(
      `SELECT post_id as "postId", author_id as "authorId", mode, visibility,
              group_id as "groupId", parent_id as "parentId", root_id as "rootId",
              content_text as "contentText", media_ids as "mediaIds", media_count as "mediaCount",
              hashtags, mentions, language, like_count as "likeCount",
              comment_count as "commentCount", share_count as "shareCount",
              view_count as "viewCount", is_pinned as "isPinned",
              created_at as "createdAt", edited_at as "editedAt"
       FROM posts WHERE ${conditions.join(' AND ')}
       ORDER BY post_id DESC LIMIT $${i}`,
      params
    );

    const posts = res.rows.slice(0, limit);
    const nextCursor = res.rows.length > limit ? posts[posts.length - 1]?.postId : undefined;
    return { posts, nextCursor };
  }

  async update(authorId: string, postId: string, input: UpdatePostInput): Promise<Post> {
    const existing = await this.findById(authorId, postId);
    if (!existing) throw new NotFoundException('Post not found');
    if (existing.authorId !== authorId) throw new ForbiddenException('Cannot edit another user\'s post');

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (input.contentText !== undefined) {
      fields.push(`content_text = $${i++}`);
      values.push(input.contentText);
      fields.push(`hashtags = $${i++}`);
      values.push(this.extractHashtags(input.contentText));
      fields.push(`mentions = $${i++}`);
      values.push(this.extractMentions(input.contentText));
    }

    if (fields.length === 0) return existing;

    fields.push(`edited_at = NOW()`);
    values.push(authorId, postId);

    await this.db.query(
      `UPDATE posts SET ${fields.join(', ')} WHERE author_id = $${i++} AND post_id = $${i}`,
      values
    );

    return (await this.findById(authorId, postId))!;
  }

  async delete(authorId: string, postId: string): Promise<void> {
    const existing = await this.findById(authorId, postId);
    if (!existing) throw new NotFoundException('Post not found');
    if (existing.authorId !== authorId) throw new ForbiddenException('Cannot delete another user\'s post');

    await this.db.query(
      `UPDATE posts SET deleted_at = NOW() WHERE author_id = $1 AND post_id = $2`,
      [authorId, postId]
    );

    await this.pubsub.publish(`post.deleted:${authorId}`, { postId });
  }

  async like(authorId: string, postId: string, likerDid: string): Promise<void> {
    // Insert into likes table (would need schema for this, simplified)
    await this.db.query(
      `UPDATE posts SET like_count = like_count + 1 WHERE author_id = $1 AND post_id = $2`,
      [authorId, postId]
    );
    await this.pubsub.publish(`notification.new:${authorId}`, {
      type: 'like',
      actorId: likerDid,
      targetType: 'post',
      targetId: postId,
    });
  }

  /**
   * Increment view counter (atomic)
   * Used for reels, stories
   */
  async incrementView(authorId: string, postId: string): Promise<void> {
    await this.db.query(
      `UPDATE posts SET view_count = view_count + 1 WHERE author_id = $1 AND post_id = $2`,
      [authorId, postId]
    );
  }

  private extractHashtags(text: string): string[] {
    const matches = text.match(/#[\p{L}\p{N}_]+/gu);
    return matches ? [...new Set(matches.map((m) => m.slice(1).toLowerCase()))] : [];
  }

  private extractMentions(text: string): string[] {
    const matches = text.match(/@[\w.-]+/g);
    return matches ? [...new Set(matches.map((m) => m.slice(1)))] : [];
  }

  /**
   * Pin a post to the author's profile.
   * Toggles the is_pinned flag (only 1 post can be pinned at a time per user).
   */
  async pin(authorDid: string, postId: string): Promise<{ isPinned: boolean }> {
    // Unpin all other posts for this author first
    await this.db.query(
      `UPDATE posts SET is_pinned = false WHERE author_id = $1 AND is_pinned = true`,
      [authorDid]
    );
    // Pin this one
    const res = await this.db.query<{ is_pinned: boolean }>(
      `UPDATE posts SET is_pinned = true WHERE author_id = $1 AND post_id = $2
       RETURNING is_pinned`,
      [authorDid, postId]
    );
    if (!res.rows[0]) throw new Error('Post not found or not owned by user');
    return { isPinned: res.rows[0].is_pinned };
  }
}
