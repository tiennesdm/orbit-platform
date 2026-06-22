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

    const profile = (getVedadbPool().query(`SELECT * FROM users WHERE did = $1`, [userDid])).rows[0];
    if (!profile) throw new Error('User not found');

    const posts = (getVedadbPool().query(
      `SELECT id, mode, content_text, hashtags, mentions, created_at
       FROM posts WHERE author_id = $1 ORDER BY created_at DESC`,
      [userDid],
    )).rows;

    const media = (getVedadbPool().query(
      `SELECT id, type, mime_type, url, alt_text, created_at
       FROM media WHERE owner_id = $1 ORDER BY created_at DESC`,
      [userDid],
    )).rows;

    const follows = (getVedadbPool().query(
      `SELECT followee_id, created_at FROM follows WHERE follower_id = $1`,
      [userDid],
    )).rows;

    const followers = (getVedadbPool().query(
      `SELECT follower_id, created_at FROM follows WHERE followee_id = $1`,
      [userDid],
    )).rows;

    const likes = (getVedadbPool().query(
      `SELECT post_id, created_at FROM likes WHERE user_id = $1`,
      [userDid],
    )).rows;

    const groups = (getVedadbPool().query(
      `SELECT g.id, g.name, g.slug, gm.role, gm.joined_at
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [userDid],
    )).rows;

    const marketplace = (getVedadbPool().query(
      `SELECT id, title, description, price_cents, currency, status, created_at
       FROM marketplace_listings WHERE seller_did = $1`,
      [userDid],
    )).rows;

    const vault = (getVedadbPool().query(
      `SELECT did, did_document, encryption_pubkey, created_at, last_export_at
       FROM personal_data_vaults WHERE did = $1`,
      [userDid],
    )).rows;

    const memories = (getVedadbPool().query(
      `SELECT id, role, content, created_at FROM ai_agent_memory WHERE user_id = $1`,
      [userDid],
    )).rows;

    getVedadbPool().query(
      `INSERT INTO gdpr_requests (user_id, type, status, completed_at)
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
      posts,
      media,
      follows,
      followers,
      likes,
      groups,
      marketplace,
      vault,
      aiMemory: memories,
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
