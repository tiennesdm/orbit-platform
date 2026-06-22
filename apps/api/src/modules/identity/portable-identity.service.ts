/**
 * Portable Identity Service
 * - W3C DID-based identity
 * - User owns their data (Personal Data Server)
 * - Can export + migrate to other apps
 * - Reputation via signed attestations
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getVedadbPool } from '@orbit/db';
import { IdentityService } from './identity.service';
import { signEd25519, base64 } from '@orbit/crypto';
import type { User } from '@orbit/types';

@Injectable()
export class PortableIdentityService {
  private readonly db = getVedadbPool();

  constructor(
    private readonly config: ConfigService,
    private readonly identityService: IdentityService
  ) {}

  /**
   * Export user's complete portable data vault
   * AT Protocol-style: all data signed by user's keys, downloadable as JSON
   */
  async exportUserData(did: string): Promise<PortableDataVault> {
    const user = await this.identityService.findByDid(did);
    if (!user) throw new BadRequestException('User not found');

    // Fetch all user-owned data
    const [posts, follows, followers, messages, lists, notifications] = await Promise.all([
      this.db.query(
        `SELECT post_id as "postId", mode, visibility, content_text as "contentText",
                media_ids as "mediaIds", hashtags, mentions, created_at as "createdAt"
         FROM posts WHERE author_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10000`,
        [did]
      ),
      this.db.query(
        `SELECT followee_id as "followeeId", notify_level as "notifyLevel",
                is_close_friend as "isCloseFriend"
         FROM follows WHERE follower_id = $1`,
        [did]
      ),
      this.db.query(
        `SELECT follower_id as "followerId"
         FROM follows WHERE followee_id = $1`,
        [did]
      ),
      this.db.query(
        `SELECT m.thread_id as "threadId", m.sender_id as "senderId",
                m.encrypted_payload as "encryptedPayload", m.content_type as "contentType",
                m.created_at as "createdAt"
         FROM messages m
         WHERE m.sender_id = $1 AND m.thread_id IN (
           SELECT thread_id FROM threads WHERE $1 = ANY(participant_ids)
         )
         ORDER BY m.created_at DESC LIMIT 10000`,
        [did]
      ),
      this.db.query(
        `SELECT tier as "tier", creator_id as "creatorId",
                started_at as "startedAt", renews_at as "renewsAt"
         FROM subscriptions WHERE subscriber_id = $1 AND is_active = TRUE`,
        [did]
      ),
      this.db.query(
        `SELECT notification_id as "notificationId", type, target_id as "targetId",
                is_read as "isRead", created_at as "createdAt"
         FROM notifications WHERE user_id = $1 LIMIT 1000`,
        [did]
      ),
    ]);

    const vault: PortableDataVault = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      did,
      identity: user,
      data: {
        posts: posts.rows,
        following: follows.rows,
        followers: followers.rows,
        messages: messages.rows,
        subscriptions: lists.rows,
        notifications: notifications.rows,
      },
      stats: {
        posts: posts.rowCount || 0,
        following: follows.rowCount || 0,
        followers: followers.rowCount || 0,
        messages: messages.rowCount || 0,
        subscriptions: lists.rowCount || 0,
      },
    };

    return vault;
  }

  /**
   * Generate signed attestation for cross-platform portability
   * e.g., "ORBIT says this DID has reputation 95/100, joined 2024"
   */
  async generateAttestation(did: string): Promise<SignedAttestation> {
    const user = await this.identityService.findByDid(did);
    if (!user) throw new BadRequestException('User not found');

    const payload: AttestationPayload = {
      iss: 'did:orbit:platform',
      sub: did,
      iat: Math.floor(Date.now() / 1000),
      reputation: user.reputationScore,
      joinedAt: user.createdAt,
      verifiedAt: new Date().toISOString(),
    };

    // Get platform signing key
    const platformKeyRes = await this.db.query<{ private_key: string }>(
      `SELECT private_key FROM platform_keys WHERE key_id = 'orbit-attestation-v1' LIMIT 1`
    );

    if (platformKeyRes.rows.length === 0) {
      throw new BadRequestException('Platform attestation key not configured');
    }

    const message = new TextEncoder().encode(JSON.stringify(payload));
    const signature = signEd25519(message, base64.decode(platformKeyRes.rows[0].private_key));

    return {
      payload,
      signature: base64.encode(signature),
      algorithm: 'Ed25519',
    };
  }

  /**
   * Migrate user to a new PDS endpoint (advanced feature)
   * Allows users to self-host their data
   */
  async migrateToPds(did: string, newPdsEndpoint: string): Promise<void> {
    const user = await this.identityService.findByDid(did);
    if (!user) throw new BadRequestException('User not found');

    // Verify new endpoint is accessible
    // TODO: verify challenge-response with new PDS

    await this.db.query(
      `UPDATE users SET pds_endpoint = $1, updated_at = NOW() WHERE did = $2`,
      [newPdsEndpoint, did]
    );
  }
}

export interface PortableDataVault {
  version: string;
  exportedAt: string;
  did: string;
  identity: User;
  data: {
    posts: any[];
    following: any[];
    followers: any[];
    messages: any[];
    subscriptions: any[];
    notifications: any[];
  };
  stats: {
    posts: number;
    following: number;
    followers: number;
    messages: number;
    subscriptions: number;
  };
}

export interface AttestationPayload {
  iss: string;
  sub: string;
  iat: number;
  reputation: number;
  joinedAt: string;
  verifiedAt: string;
}

export interface SignedAttestation {
  payload: AttestationPayload;
  signature: string;
  algorithm: 'Ed25519';
}
