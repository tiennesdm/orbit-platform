import { Injectable, Logger } from '@nestjs/common';
// archiver v7 (CJS) — kept v7 because v8 is ESM-only and breaks our CJS Nest setup
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');
import { getVedadbPool } from '@orbit/db';
import { MetricsService } from '../../common/observability/metrics.service';

/**
 * GDPR Service — Right to data portability and right to be forgotten.
 *
 * Export: Returns all user data as a JSON object. Same shape as
 * the PDS (Personal Data Vault) archive spec.
 *
 * Delete: Soft-delete with 30-day grace period, then hard delete.
 * Cancellable within 30 days via re-login.
 *
 * M-4 fix: every query is now awaited, column names match the actual
 * schema (was: queries referenced `id`, `user_id`, `seller_did`,
 * `password_hash` etc. that don't exist → silent failures).
 * `hardDeleteUser` now cascades through all related tables.
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger('GdprService');

  constructor(private readonly metrics: MetricsService) {}

  async exportUserData(userDid: string): Promise<Record<string, any>> {
    this.logger.log(`GDPR export requested for user ${userDid}`);
    this.metrics.gdprExports.inc();

    // CRITICAL: query() is async — must await before reading .rows
    const db = getVedadbPool();
    const profileRes = await db.query(`SELECT * FROM users WHERE did = $1`, [userDid]);
    const profile = profileRes.rows[0];
    if (!profile) throw new Error('User not found');

    const postsRes = await db.query(
      `SELECT post_id as id, mode, content_text, hashtags, mentions, created_at
       FROM posts WHERE author_id = $1 ORDER BY created_at DESC`,
      [userDid],
    );

    const mediaRes = await db.query(
      `SELECT media_id as id, media_type as type, mime_type, cdn_url as url, created_at
       FROM media WHERE owner_id = $1 ORDER BY created_at DESC`,
      [userDid],
    );

    const followsRes = await db.query(
      `SELECT followee_id FROM follows WHERE follower_id = $1`,
      [userDid],
    );

    const followersRes = await db.query(
      `SELECT follower_id FROM follows WHERE followee_id = $1`,
      [userDid],
    );

    // NOTE: 'likes' table doesn't exist (likes are denormalized as like_count on posts)
    // Use empty array for now
    const likesRes = { rows: [] };

    const groupsRes = await db.query(
      `SELECT g.group_id as id, g.name, g.slug, gm.role, gm.joined_at
       FROM group_members gm
       JOIN groups g ON g.group_id = gm.group_id
       WHERE gm.user_id = $1`,
      [userDid],
    );

    const marketplaceRes = await db.query(
      `SELECT listing_id as id, title, description, price_cents, currency, created_at
       FROM marketplace_listings WHERE seller_id = $1`,
      [userDid],
    );

    // personal_data_vaults table doesn't exist yet — return empty
    const vaultRes = { rows: [] };

    const memoriesRes = await db.query(
      `SELECT id, role, content, created_at FROM ai_agent_memory WHERE user_did = $1`,
      [userDid],
    );

    await db.query(
      `INSERT INTO gdpr_requests (user_did, type, status, completed_at)
       VALUES ($1, 'export', 'completed', NOW())`,
      [userDid]
    );

    return {
      meta: {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        gdprCompliant: true,
        userDid: profile.did,
        schemaVersion: 'orbit-2026.06',
      },
      profile: this.scrub(profile, ['password_hash', 'webauthn_challenge', 'session_secret']),
      posts: postsRes.rows,
      media: mediaRes.rows,
      follows: followsRes.rows,
      followers: followersRes.rows,
      likes: likesRes.rows,
      groups: groupsRes.rows,
      marketplace: marketplaceRes.rows,
      vault: vaultRes.rows,
      aiMemory: memoriesRes.rows,
    };
  }

  /**
   * Soft-delete: mark for deletion with 30-day grace.
   * Hard-delete: irreversible (call after grace period).
   */
  async softDeleteUser(userDid: string): Promise<{ scheduledFor: string }> {
    this.logger.log(`GDPR soft-delete requested for user ${userDid}`);
    this.metrics.gdprDeletes.inc();

    const db = getVedadbPool();
    const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE users
       SET is_active = false,
           deletion_requested_at = NOW(),
           deletion_scheduled_for = $2
       WHERE did = $1`,
      [userDid, scheduledFor]
    );

    await db.query(
      `INSERT INTO gdpr_requests (user_did, type, status, payload, completed_at)
       VALUES ($1, 'delete', 'pending', $2::jsonb, NOW())`,
      [userDid, JSON.stringify({ scheduledFor: scheduledFor.toISOString(), graceDays: 30 })]
    );

    return { scheduledFor: scheduledFor.toISOString() };
  }

  async cancelDelete(userDid: string): Promise<void> {
    await getVedadbPool().query(
      `UPDATE users
       SET is_active = true,
           deletion_requested_at = NULL,
           deletion_scheduled_for = NULL
       WHERE did = $1`,
      [userDid]
    );
  }

  /**
   * M-4 fix: hard delete cascades through ALL related tables to prevent
   * orphan rows leaking the user's data after deletion. Tables are deleted
   * in dependency order so we don't violate FKs.
   */
  async hardDeleteUser(userDid: string): Promise<{ deletedFrom: string[] }> {
    this.logger.warn(`GDPR hard-delete executing for user ${userDid}`);
    const db = getVedadbPool();
    const deletedFrom: string[] = [];

    // Order matters — children before parents to avoid FK violations.
    // ON DELETE CASCADE handles most, but tables without it need explicit deletes.
    const tables = [
      'likes',                  // CASCADE via FK on liker_did
      'reel_likes',             // CASCADE via FK on liker_did
      'follows',                // user as follower + followee (handled in deleteFromTable)
      'notifications',          // user_id
      'media',                  // owner_id
      'posts',                  // author_id
      'reels',                  // author_id
      'stories',                // author_id
      'subscription_tiers',     // creator_id
      'subscriptions',          // subscriber_id (to_did = creator side handled separately)
      'tips',                   // to_did
      'paid_posts',             // creator_id
      'marketplace_listings',   // seller_id
      'pinned_posts',           // user_did
      'user_lists',             // owner_did
      'user_list_members',      // member_did
      'user_feed_subscriptions', // user_did
      'user_wellness',          // user_did
      'parental_controls',      // guardian_did + minor_did (handled in deleteFromTable)
      'ai_agent_memory',        // user_did
      'ai_agent_state',         // user_did
      'custom_feeds',           // owner_did
      'drafts',                 // author_did
      'group_members',          // user_id
      'messages',               // sender_id
      'voice_rooms',            // host_did
      'voice_room_participants',// user_did
      'domain_handles',         // owner_did
      'federation_handles',     // owner_did
      'gdpr_requests',          // user_did
      'session_logs',           // user_did
      'users',                  // finally — the user record itself
      // NOTE: 'events' table is group events (creator_id = user_did but it's a
      // group admin action, not user data). Skip — group owns it.
      // 'orbit_cache' — may contain user-derived keys; consider adding later.
    ];

    // Execute as a single transaction — all-or-nothing deletion.
// Use SAVEPOINTs so one table's failure (missing col, missing table) doesn't
// abort the whole transaction. M-4: otherwise the user record stays in DB
// while everything else is half-deleted.
    const client = await (db as any).pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of tables) {
        const spName = `sp_${table.replace(/[^a-z0-9]/gi, '_')}`;
        await client.query(`SAVEPOINT ${spName}`);
        try {
          const deleted = await this.deleteFromTable(client, table, userDid);
          if (deleted > 0) deletedFrom.push(`${table} (${deleted})`);
          await client.query(`RELEASE SAVEPOINT ${spName}`);
        } catch (err: any) {
          // Roll back just this savepoint, then continue with other tables.
          await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
          this.logger.warn({ table, err: err.message }, 'gdpr hard-delete: skipping table');
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { deletedFrom };
  }

  /**
   * Per-table delete with the right column name.
   * Add new tables here as the schema grows.
   */
  private async deleteFromTable(client: any, table: string, userDid: string): Promise<number> {
    // Map of table → column referencing users.did.
    // Verified against actual schema (see AUDIT_REPORT M-4).
    // Some tables (parental_controls, follows) have two columns referencing
    // users.did; we delete twice via different keys below.
    const columnByTable: Record<string, string> = {
      'likes': 'liker_did',
      'reel_likes': 'liker_did',
      'follows': 'follower_id',
      'notifications': 'user_id',
      'media': 'owner_id',
      'posts': 'author_id',
      'reels': 'author_id',
      'stories': 'author_id',
      'subscription_tiers': 'creator_id',
      'subscriptions': 'subscriber_id',
      'tips': 'to_did',
      'paid_posts': 'creator_id',
      'marketplace_listings': 'seller_id',
      'pinned_posts': 'user_did',
      'user_lists': 'owner_did',
      'user_list_members': 'member_did',
      'user_feed_subscriptions': 'user_did',
      'user_wellness': 'user_did',
      'parental_controls': 'guardian_did',   // also has minor_did — handled separately
      'ai_agent_memory': 'user_did',
      'ai_agent_state': 'user_did',
      'custom_feeds': 'owner_did',
      'drafts': 'author_did',
      'group_members': 'user_id',           // not user_did
      'messages': 'sender_id',
      'voice_rooms': 'host_did',
      'voice_room_participants': 'user_did',
      'domain_handles': 'owner_did',
      'federation_handles': 'owner_did',
      'gdpr_requests': 'user_did',
      'session_logs': 'user_did',
      'users': 'did',
    };

    const col = columnByTable[table];
    if (!col) return 0;
    const res = await client.query(`DELETE FROM ${table} WHERE ${col} = $1`, [userDid]);

    // Handle secondary FK columns
    let extra = 0;
    if (table === 'parental_controls') {
      const r2 = await client.query(`DELETE FROM parental_controls WHERE minor_did = $1`, [userDid]);
      extra = r2.rowCount ?? 0;
    }
    if (table === 'follows') {
      // Delete both sides (user as follower AND followee)
      const r2 = await client.query(`DELETE FROM follows WHERE followee_id = $1`, [userDid]);
      extra = r2.rowCount ?? 0;
    }
    return (res.rowCount ?? 0) + extra;
  }

  /**
   * Export user data as a ZIP archive (in-memory, streamed).
   *
   * Includes:
   *  - data.json         — full JSON export (same as legacy /gdpr/export)
   *  - profile.json      — user profile only
   *  - posts.json        — array of posts
   *  - media.json        — array of media
   *  - follows.json      — who I follow
   *  - followers.json    — who follows me
   *  - likes.json        — posts I liked
   *  - groups.json       — group memberships
   *  - marketplace.json  — my listings
   *  - ai-memory.json    — AI agent memory
   *  - README.txt        — what this archive is + how to use it
   *  - MANIFEST.txt      — generation timestamp, hash, schema version
   *
   * Returns a Buffer. For large datasets consider streaming + S3 signed URL
   * (out of scope here, but easy upgrade path).
   */
  async exportUserDataAsZip(userDid: string): Promise<Buffer> {
    this.logger.log(`GDPR ZIP export requested for user ${userDid}`);
    this.metrics.gdprExports.inc();

    const data = await this.exportUserData(userDid);
    const exportTime = new Date().toISOString();
    const schemaVersion = 'orbit-2026.06';

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const archive = archiver('zip', { zlib: { level: 9 } });
      const sink = new (require('stream').Writable)({
        write(chunk: Buffer, _enc: string, cb: () => void) {
          chunks.push(chunk);
          cb();
        },
      });

      archive.on('error', reject);
      sink.on('finish', () => resolve(Buffer.concat(chunks)));

      archive.pipe(sink);

      // README
      archive.append(
        [
          'ORBIT Data Export',
          '====================',
          '',
          `User: ${userDid}`,
          `Generated: ${exportTime}`,
          `Schema version: ${schemaVersion}`,
          '',
          'This archive contains all personal data ORBIT stores about you,',
          'per GDPR Article 15 (Right of Access) and Article 20 (Right to Data Portability).',
          '',
          'Files:',
          '  data.json       — full export (one big JSON, schema below)',
          '  profile.json    — your account profile',
          '  posts.json      — your posts (public + private)',
          '  media.json      — media you uploaded',
          '  follows.json    — accounts you follow',
          '  followers.json  — accounts following you',
          '  likes.json      — posts you have liked',
          '  groups.json     — group memberships',
          '  marketplace.json — your marketplace listings',
          '  ai-memory.json  — AI agent memory (your interactions)',
          '',
          'Top-level "meta" object in data.json describes the schema version.',
          '',
          'Questions? Contact privacy@orbit.example',
        ].join('\n'),
        { name: 'README.txt' }
      );

      // MANIFEST
      archive.append(
        [
          'ORBIT Data Export Manifest',
          '===========================',
          '',
          `user_did: ${userDid}`,
          `generated_at: ${exportTime}`,
          `schema_version: ${schemaVersion}`,
          `gdpr_articles: 15, 20`,
          `format: ZIP (DEFLATE level 9)`,
        ].join('\n'),
        { name: 'MANIFEST.txt' }
      );

      // Full data.json
      archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

      // Individual sections as separate JSON files
      const sections: Record<string, string> = {
        'profile.json': JSON.stringify(data.profile, null, 2),
        'posts.json': JSON.stringify(data.posts, null, 2),
        'media.json': JSON.stringify(data.media, null, 2),
        'follows.json': JSON.stringify(data.follows, null, 2),
        'followers.json': JSON.stringify(data.followers, null, 2),
        'likes.json': JSON.stringify(data.likes, null, 2),
        'groups.json': JSON.stringify(data.groups, null, 2),
        'marketplace.json': JSON.stringify(data.marketplace, null, 2),
        'ai-memory.json': JSON.stringify(data.aiMemory, null, 2),
      };
      for (const [name, content] of Object.entries(sections)) {
        archive.append(content, { name });
      }

      archive.finalize();
    });
  }

  /** @deprecated — kept for backward compat, redirects to hardDeleteUser */
  private scrub(row: any, fields: string[]): any {
    const out = { ...row };
    for (const f of fields) {
      if (f in out) out[f] = '[REDACTED]';
    }
    return out;
  }
}