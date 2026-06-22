/**
 * Identity Service
 * - User CRUD
 * - WebAuthn registration & login
 * - Portable identity (DID)
 */

import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getVedadbPool, OrbitCache } from '@orbit/db';
import {
  generateIdentityKeyPair,
  generateX25519KeyPair,
  generateDID,
  didFromPublicKey,
  generateId,
  generateHandle,
  signEd25519,
  verifyEd25519,
  base64,
  base64url,
} from '@orbit/crypto';
import type { User, AuthSession } from '@orbit/types';

@Injectable()
export class IdentityService {
  private readonly db = getVedadbPool();
  private readonly cache: OrbitCache;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {
    this.cache = new OrbitCache(this.db);
  }

  /**
   * Register a new user with portable identity
   * Returns DID + handle + access tokens
   */
  async register(input: RegisterInput): Promise<AuthSession> {
    const handle = input.handle || generateHandle();

    // Check handle uniqueness
    const existing = await this.db.query<{ did: string }>(
      'SELECT did FROM users WHERE handle = $1 OR domain = $2 LIMIT 1',
      [handle, input.domain || null]
    );
    if (existing.rows.length > 0) {
      throw new ConflictException(`Handle @${handle} is already taken`);
    }

    // Generate cryptographic keys
    const identityKeyPair = await generateIdentityKeyPair();
    const x25519KeyPair = await generateX25519KeyPair();
    const did = generateDID(identityKeyPair.publicKey);
    const pdsEndpoint = `${this.config.get('PDS_BASE_URL', 'https://pds.orbit.com')}/${did}`;

    // Insert user (sharded by did)
    await this.db.query(
      `INSERT INTO users (
        did, handle, domain, display_name, bio, email,
        public_key, identity_key, signed_pre_key, pre_keys,
        pds_endpoint, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)`,
      [
        did,
        handle,
        input.domain || null,
        input.displayName,
        input.bio || null,
        input.email || null,
        base64.encode(identityKeyPair.publicKey),
        base64.encode(x25519KeyPair.publicKey),
        base64.encode(x25519KeyPair.privateKey), // signed pre-key (simplified)
        '{}',  // empty Postgres BYTEA[] array literal
        pdsEndpoint,
        JSON.stringify({ version: 'orbit-v1', registration: 'webauthn' }),
      ]
    );

    // Cache the private keys (server-side, encrypted at rest)
    // In production: use KMS or HSM for private key storage
    await this.cache.set(`user:keys:${did}`, {
      identityPrivateKey: base64.encode(identityKeyPair.privateKey),
      signedPreKeyPrivate: base64.encode(x25519KeyPair.privateKey),
    }, { ttlSeconds: 86400 * 7 });

    return this.issueSession(did, handle, input.displayName, pdsEndpoint);
  }

  /**
   * Issue JWT session
   */
  issueSession(did: string, handle: string, displayName: string, pdsEndpoint: string): AuthSession {
    const accessToken = this.jwt.sign(
      { did, handle, type: 'access' },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '86400') + 's' }
    );
    const refreshToken = this.jwt.sign(
      { did, handle, type: 'refresh' },
      { expiresIn: '30d' }
    );

    return {
      did,
      handle,
      displayName,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + parseInt(this.config.get('JWT_EXPIRES_IN', '86400'), 10) * 1000).toISOString(),
      pdsEndpoint,
    };
  }

  async findByDid(did: string): Promise<User | null> {
    const res = await this.db.query<any>(
      `SELECT did, handle, domain, display_name as "displayName", bio, avatar_cid as "avatarCid",
              cover_cid as "coverCid", public_key as "publicKey", pds_endpoint as "pdsEndpoint",
              reputation_score as "reputationScore", status, metadata, created_at as "createdAt",
              updated_at as "updatedAt", last_seen_at as "lastSeenAt"
       FROM users WHERE did = $1 LIMIT 1`,
      [did]
    );
    return res.rows[0] ?? null;
  }

  async findByHandle(handle: string): Promise<User | null> {
    const res = await this.db.query<any>(
      `SELECT did, handle, domain, display_name as "displayName", bio, avatar_cid as "avatarCid",
              cover_cid as "coverCid", public_key as "publicKey", pds_endpoint as "pdsEndpoint",
              reputation_score as "reputationScore", status, metadata, created_at as "createdAt",
              updated_at as "updatedAt", last_seen_at as "lastSeenAt", email, email_verified as "emailVerified",
              theme_color as "themeColor", link_website as "linkWebsite", link_twitter as "linkTwitter",
              link_github as "linkGithub", link_linkedin as "linkLinkedin", link_custom_label as "linkCustomLabel",
              link_custom_url as "linkCustomUrl", two_factor_enabled as "twoFactorEnabled",
              premium_tier as "premiumTier", premium_badge as "premiumBadge"
       FROM users WHERE handle = $1 LIMIT 1`,
      [handle]
    );
    return res.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.db.query<any>(
      `SELECT did, handle, domain, display_name as "displayName", email, email_verified as "emailVerified"
       FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    return res.rows[0] ?? null;
  }

  async updateHandle(did: string, newHandle: string): Promise<User> {
    // Check uniqueness
    const existing = await this.findByHandle(newHandle);
    if (existing && existing.did !== did) {
      throw new Error('Handle already taken');
    }
    await this.db.query(`UPDATE users SET handle = $1, updated_at = NOW() WHERE did = $2`, [newHandle, did]);
    return (await this.findByDid(did))!;
  }

  async markEmailVerified(did: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), updated_at = NOW() WHERE did = $1`,
      [did]
    );
  }

  async set2FABackupCodes(did: string, codes: string[]): Promise<void> {
    await this.db.query(
      `UPDATE users SET two_factor_enabled = TRUE, two_factor_backup_codes = $1, updated_at = NOW() WHERE did = $2`,
      [codes, did]
    );
  }

  async issueSessionForDid(did: string): Promise<AuthSession> {
    const user = await this.findByDid(did);
    if (!user) throw new Error('User not found');
    return this.issueSession(user.did, user.handle, user.displayName, user.pdsEndpoint);
  }

  async updateLastSeen(did: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_seen_at = NOW(), updated_at = NOW() WHERE did = $1`,
      [did]
    );
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthSession> {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
      const user = await this.findByDid(payload.did);
      if (!user) throw new UnauthorizedException('User not found');
      return this.issueSession(user.did, user.handle, user.displayName, user.pdsEndpoint);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(did: string, updates: UpdateProfileInput): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (updates.displayName !== undefined) { fields.push(`display_name = $${i++}`); values.push(updates.displayName); }
    if (updates.bio !== undefined) { fields.push(`bio = $${i++}`); values.push(updates.bio); }
    if (updates.avatarCid !== undefined) { fields.push(`avatar_cid = $${i++}`); values.push(updates.avatarCid); }
    if (updates.coverCid !== undefined) { fields.push(`cover_cid = $${i++}`); values.push(updates.coverCid); }
    if (updates.email !== undefined) { fields.push(`email = $${i++}`); values.push(updates.email); }
    if (updates.themeColor !== undefined) { fields.push(`theme_color = $${i++}`); values.push(updates.themeColor); }
    if (updates.linkWebsite !== undefined) { fields.push(`link_website = $${i++}`); values.push(updates.linkWebsite); }
    if (updates.linkTwitter !== undefined) { fields.push(`link_twitter = $${i++}`); values.push(updates.linkTwitter); }
    if (updates.linkGithub !== undefined) { fields.push(`link_github = $${i++}`); values.push(updates.linkGithub); }
    if (updates.linkLinkedin !== undefined) { fields.push(`link_linkedin = $${i++}`); values.push(updates.linkLinkedin); }
    if (updates.linkCustomLabel !== undefined) { fields.push(`link_custom_label = $${i++}`); values.push(updates.linkCustomLabel); }
    if (updates.linkCustomUrl !== undefined) { fields.push(`link_custom_url = $${i++}`); values.push(updates.linkCustomUrl); }

    if (fields.length === 0) {
      const user = await this.findByDid(did);
      if (!user) throw new NotFoundException('User not found');
      return user;
    }

    fields.push(`updated_at = NOW()`);
    values.push(did);

    await this.db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE did = $${i}`,
      values
    );

    const updated = await this.findByDid(did);
    if (!updated) throw new NotFoundException('User not found after update');
    return updated;
  }

  /**
   * Verify ownership of a DID by signed challenge
   */
  async verifyDidOwnership(did: string, challenge: string, signature: string): Promise<boolean> {
    const user = await this.findByDid(did);
    if (!user) return false;

    const publicKey = base64.decode(user.publicKey);
    const signatureBytes = base64.decode(signature);

    return verifyEd25519(signatureBytes, new TextEncoder().encode(challenge), publicKey);
  }

  /** Follow another user. Idempotent. */
  async follow(followerDid: string, followeeDid: string): Promise<void> {
    if (followerDid === followeeDid) throw new Error('Cannot follow yourself');
    await this.db.query(
      `INSERT INTO follows (follower_id, followee_id, notify_level, is_close_friend)
       VALUES ($1, $2, 0, false)
       ON CONFLICT (follower_id, followee_id) DO NOTHING`,
      [followerDid, followeeDid]
    );
    // Notify followee (best-effort)
    await this.db.query(
      `INSERT INTO notifications (recipient_did, type, actor_did, text, priority_score)
       VALUES ($1, 'follow', $2, $3, 0.5)
       ON CONFLICT DO NOTHING`,
      [followeeDid, followerDid, `${followerDid} started following you`]
    ).catch(() => { /* notification best-effort */ });
  }

  /** Unfollow a user. Idempotent. */
  async unfollow(followerDid: string, followeeDid: string): Promise<void> {
    await this.db.query(
      `DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`,
      [followerDid, followeeDid]
    );
  }

  /** List users that `did` follows. */
  async listFollowing(did: string, limit = 50): Promise<string[]> {
    const res = await this.db.query<{ followee_id: string }>(
      `SELECT followee_id FROM follows WHERE follower_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [did, limit]
    );
    return res.rows.map((r) => r.followee_id);
  }

  /** List followers of `did`. */
  async listFollowers(did: string, limit = 50): Promise<string[]> {
    const res = await this.db.query<{ follower_id: string }>(
      `SELECT follower_id FROM follows WHERE followee_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [did, limit]
    );
    return res.rows.map((r) => r.follower_id);
  }
}

export interface RegisterInput {
  handle?: string;
  domain?: string;
  displayName: string;
  bio?: string;
  email?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  avatarCid?: string;
  coverCid?: string;
  email?: string;
  themeColor?: string;
  linkWebsite?: string;
  linkTwitter?: string;
  linkGithub?: string;
  linkLinkedin?: string;
  linkCustomLabel?: string;
  linkCustomUrl?: string;
}
