/**
 * Remix — Duet / Stitch / Quote
 * Inspired by TikTok duets, X quote-posts, Threads reblogs
 */

import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';

export type RemixKind = 'duet' | 'stitch' | 'quote';

@Injectable()
export class RemixService {
  private readonly db; private readonly logger = new Logger(RemixService.name);

  constructor() { this.db = getVedadbPool(); }

  async createRemix(opts: { remixPostId: string; sourcePostId: string; kind: RemixKind; layout?: any }) {
    if (opts.remixPostId === opts.sourcePostId) throw new Error('Cannot remix your own post');
    // Verify both posts exist
    const src = await this.db.query<any>(`SELECT post_id FROM posts WHERE post_id::text = $1`, [opts.sourcePostId]);
    if (!src.rows[0]) throw new Error('Source post not found');
    const rem = await this.db.query<any>(`SELECT post_id FROM posts WHERE post_id::text = $1`, [opts.remixPostId]);
    if (!rem.rows[0]) throw new Error('Remix post not found');

    await this.db.query(
      `INSERT INTO post_remixes (remix_post_id, source_post_id, kind, layout)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (remix_post_id) DO UPDATE SET
         source_post_id = EXCLUDED.source_post_id,
         kind = EXCLUDED.kind, layout = EXCLUDED.layout`,
      [opts.remixPostId, opts.sourcePostId, opts.kind, opts.layout ? JSON.stringify(opts.layout) : null]
    );
    // Set on the post itself
    await this.db.query(
      `UPDATE posts SET remix_of = $1, root_post_id = COALESCE(root_post_id::text, $1) WHERE post_id::text = $2`,
      [opts.sourcePostId, opts.remixPostId]
    );
    return { ok: true };
  }

  async listRemixesOf(postId: string, kind?: RemixKind) {
    const res = await this.db.query<any>(
      `SELECT r.kind, r.created_at as "createdAt",
              p.post_id::text as "postId", p.author_id as "authorDid", p.content_text as "contentText",
              p.media_count as "mediaCount", p.like_count as "likeCount",
              p.share_count as "repostCount", p.comment_count as "commentCount",
              p.created_at as "postCreatedAt", p.mode,
              u.handle, u.display_name as "displayName", u.avatar_cid as "avatarCid"
       FROM post_remixes r
       JOIN posts p ON p.post_id::text = r.remix_post_id
       JOIN users u ON u.did = p.author_id
       WHERE r.source_post_id = $1 ${kind ? 'AND r.kind = $2' : ''}
       ORDER BY r.created_at DESC`,
      kind ? [postId, kind] : [postId]
    );
    return res.rows;
  }

  async getRemixChain(postId: string) {
    // Walk back to the root post via remix_of
    const res = await this.db.query<any>(
      `WITH RECURSIVE chain AS (
         SELECT post_id::text as id, remix_of, 0 as depth FROM posts WHERE post_id::text = $1
         UNION ALL
         SELECT p.post_id::text, p.remix_of, c.depth + 1
         FROM posts p JOIN chain c ON p.post_id::text = c.remix_of
         WHERE c.depth < 20
       )
       SELECT id, remix_of as "remixOf", depth FROM chain ORDER BY depth ASC`,
      [postId]
    );
    return res.rows;
  }
}
