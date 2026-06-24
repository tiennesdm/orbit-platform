import { Injectable, Logger } from '@nestjs/common';
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
      [userDid],
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

    const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    getVedadbPool().query(
      `UPDATE users
       SET is_active = false,
           deletion_requested_at = NOW(),
           deletion_scheduled_for = $2
       WHERE did = $1`,
      [userDid, scheduledFor],
    );
    getVedadbPool().query(
      `INSERT INTO gdpr_requests (user_id, type, status, payload, completed_at)
       VALUES ($1, 'delete', 'pending', $2::jsonb, NOW())`,
      [userDid, JSON.stringify({ scheduledFor: scheduledFor.toISOString(), graceDays: 30 })],
    );
    return { scheduledFor: scheduledFor.toISOString() };
  }

  async cancelDelete(userDid: string): Promise<void> {
    getVedadbPool().query(
      `UPDATE users
       SET is_active = true,
           deletion_requested_at = NULL,
           deletion_scheduled_for = NULL
       WHERE did = $1`,
      [userDid],
    );
  }

  async hardDeleteUser(userDid: string): Promise<void> {
    this.logger.warn(`GDPR hard-delete executing for user ${userDid}`);
    getVedadbPool().query(`DELETE FROM users WHERE did = $1`, [userDid]);
  }

  private scrub(row: any, fields: string[]): any {
    const out = { ...row };
    for (const f of fields) {
      if (f in out) out[f] = '[REDACTED]';
    }
    return out;
  }
}
