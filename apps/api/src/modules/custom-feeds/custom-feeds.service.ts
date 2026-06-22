/**
 * Custom Feeds — user-defined feed algorithms
 * Inspired by Bluesky's custom feeds feature
 */

import { Injectable, Logger } from '@nestjs/common';
import { getVedadbPool } from '@orbit/db';
import { v4 as uuid } from 'uuid';

export interface FeedRule {
  type: 'mode' | 'hashtag' | 'author' | 'engagement' | 'time' | 'media' | 'lang' | 'no_replies' | 'min_likes';
  value: any;
}

export interface CustomFeed {
  id: string;
  ownerDid: string;
  name: string;
  description?: string;
  emoji?: string;
  isPublic: boolean;
  rules: FeedRule[];
  pinOrder: number;
}

@Injectable()
export class CustomFeedService {
  private readonly db; private readonly logger = new Logger(CustomFeedService.name);

  constructor() { this.db = getVedadbPool(); }

  async createFeed(opts: { ownerDid: string; name: string; description?: string; emoji?: string; isPublic?: boolean; rules: FeedRule[] }): Promise<CustomFeed> {
    const id = uuid();
    await this.db.query(
      `INSERT INTO custom_feeds (id, owner_did, name, description, emoji, is_public, rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, opts.ownerDid, opts.name, opts.description || null, opts.emoji || null, opts.isPublic || false, JSON.stringify(opts.rules)]
    );
    return { id, ownerDid: opts.ownerDid, ...opts, rules: opts.rules, pinOrder: 0 };
  }

  async updateFeed(id: string, ownerDid: string, updates: Partial<CustomFeed>): Promise<CustomFeed> {
    const fields: string[] = []; const values: any[] = []; let i = 1;
    if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${i++}`); values.push(updates.description); }
    if (updates.emoji !== undefined) { fields.push(`emoji = $${i++}`); values.push(updates.emoji); }
    if (updates.isPublic !== undefined) { fields.push(`is_public = $${i++}`); values.push(updates.isPublic); }
    if (updates.rules !== undefined) { fields.push(`rules = $${i++}`); values.push(JSON.stringify(updates.rules)); }
    if (fields.length === 0) return (await this.getFeed(id, ownerDid))!;
    fields.push(`updated_at = NOW()`);
    values.push(id, ownerDid);
    await this.db.query(`UPDATE custom_feeds SET ${fields.join(', ')} WHERE id = $${i++} AND owner_did = $${i}`, values);
    return (await this.getFeed(id, ownerDid))!;
  }

  async deleteFeed(id: string, ownerDid: string): Promise<void> {
    await this.db.query(`DELETE FROM custom_feeds WHERE id = $1 AND owner_did = $2`, [id, ownerDid]);
  }

  async getFeed(id: string, ownerDid: string): Promise<CustomFeed | null> {
    const res = await this.db.query<any>(
      `SELECT id, owner_did as "ownerDid", name, description, emoji, is_public as "isPublic",
              rules, pin_order as "pinOrder"
       FROM custom_feeds WHERE id = $1 AND owner_did = $2`,
      [id, ownerDid]
    );
    if (!res.rows[0]) return null;
    return { ...res.rows[0], rules: typeof res.rows[0].rules === 'string' ? JSON.parse(res.rows[0].rules) : res.rows[0].rules };
  }

  async listMyFeeds(ownerDid: string): Promise<CustomFeed[]> {
    const res = await this.db.query<any>(
      `SELECT id, owner_did as "ownerDid", name, description, emoji, is_public as "isPublic",
              rules, pin_order as "pinOrder"
       FROM custom_feeds WHERE owner_did = $1 ORDER BY pin_order ASC, created_at DESC`,
      [ownerDid]
    );
    return res.rows.map((r) => ({ ...r, rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules }));
  }

  async listPublicFeeds(limit = 30): Promise<CustomFeed[]> {
    const res = await this.db.query<any>(
      `SELECT f.id, f.owner_did as "ownerDid", f.name, f.description, f.emoji, f.is_public as "isPublic",
              f.rules, f.pin_order as "pinOrder", u.handle as "ownerHandle", u.display_name as "ownerDisplayName"
       FROM custom_feeds f JOIN users u ON u.did = f.owner_did
       WHERE f.is_public = TRUE
       ORDER BY f.pin_order ASC, f.created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map((r) => ({ ...r, rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules }));
  }

  async pin(id: string, ownerDid: string, position: number): Promise<void> {
    await this.db.query(`UPDATE custom_feeds SET pin_order = $1 WHERE id = $2 AND owner_did = $3`, [position, id, ownerDid]);
  }

  async subscribe(userDid: string, feedId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO user_feed_subscriptions (user_did, feed_id) VALUES ($1, $2)
       ON CONFLICT (user_did, feed_id) DO NOTHING`,
      [userDid, feedId]
    );
  }

  async unsubscribe(userDid: string, feedId: string): Promise<void> {
    await this.db.query(`DELETE FROM user_feed_subscriptions WHERE user_did = $1 AND feed_id = $2`, [userDid, feedId]);
  }

  // Apply rules to build a query (server-side filtering for performance)
  buildFeedQuery(rules: FeedRule[]): { sql: string; params: any[] } {
    const conds: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const rule of rules) {
      switch (rule.type) {
        case 'mode':
          if (Array.isArray(rule.value)) {
            conds.push(`p.mode = ANY($${i++})`); params.push(rule.value);
          } else {
            conds.push(`p.mode = $${i++}`); params.push(rule.value);
          }
          break;
        case 'hashtag':
          conds.push(`p.hashtags @> ARRAY[$${i++}]`); params.push(String(rule.value).toLowerCase());
          break;
        case 'author':
          conds.push(`p.author_did = $${i++}`); params.push(rule.value);
          break;
        case 'engagement':
          conds.push(`p.like_count >= $${i++}`); params.push(parseInt(rule.value, 10) || 0);
          break;
        case 'min_likes':
          conds.push(`p.like_count >= $${i++}`); params.push(parseInt(rule.value, 10) || 0);
          break;
        case 'time':
          // value = 'hour' | 'day' | 'week'
          conds.push(`p.created_at > NOW() - INTERVAL '1 ${rule.value}'`);
          break;
        case 'media':
          if (rule.value === 'media') conds.push(`p.media_count > 0`);
          else if (rule.value === 'text') conds.push(`p.media_count = 0`);
          break;
        case 'no_replies':
          if (rule.value) conds.push(`p.parent_post_id IS NULL`);
          break;
        case 'lang':
          conds.push(`p.lang = $${i++}`); params.push(rule.value);
          break;
      }
    }
    const sql = conds.length ? ` AND ${conds.join(' AND ')}` : '';
    return { sql, params };
  }
}
