/**
 * OAuth Service — Google + Apple sign-in via ID token verification
 *
 * Strategy:
 *   Mobile/web apps use the native provider SDK (Google Sign-In / Apple Sign-In)
 *   to obtain an ID token (a JWT signed by the provider). The app POSTs this
 *   ID token to our API. We verify the signature against the provider's JWKS
 *   endpoint, then look up or create the user.
 *
 * Why ID token vs full OAuth redirect flow?
 *   - Simpler: no redirect URI, no state management, no PKCE
 *   - Works for mobile (no web view needed)
 *   - Works for SPA web (no popup blocker issues)
 *   - Still secure: ID tokens are signed JWTs, not user-controlled strings
 *
 * Provider ID tokens are short-lived (1h) so we cache JWKS keys in memory.
 *
 * Flow:
 *   1. Client: GoogleSignin.signIn() → ID token
 *   2. Client: POST /oauth/google/login { idToken } → session
 *   3. Server: verify ID token signature via Google's JWKS
 *   4. Server: extract sub (provider_user_id) and email
 *   5. Server: lookup user_oauth_accounts by (provider, sub)
 *   6a. Match → issue session for that user_did
 *   6b. No match + createAccount flag → create new user, link provider
 *   6c. No match + email matches existing user → link provider to that user
 *   6d. No match + createAccount=false → return "needs_link" response
 */

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { getVedadbPool } from '@orbit/db';
import { IdentityService } from '../identity/identity.service';
import { generateHandle, generateIdentityKeyPair, generateX25519KeyPair, generateDID, base64 } from '@orbit/crypto';
import type { AuthSession } from '@orbit/types';

export type OAuthProvider = 'google' | 'apple' | 'github' | 'facebook' | 'twitter';

interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;        // 'sub' claim
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  raw: Record<string, any>;
}

/**
 * JWKS key shape (subset of RFC 7517 we need).
 * Stored in a Map for O(1) lookup by kid.
 */
interface JwksKey {
  kid: string;
  alg?: string;
  kty: string;
  use?: string;
  // RSA
  n?: string;
  e?: string;
}

interface JwksCacheEntry {
  keys: Map<string, JwksKey>;  // kid → key
  expiresAt: number;
}

const JWKS_TTL_MS = 24 * 60 * 60 * 1000; // 24h — keys rotate rarely

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly db = getVedadbPool();
  private readonly jwksCache = new Map<OAuthProvider, JwksCacheEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly identity: IdentityService,
  ) {}

  /**
   * Login or signup via OAuth ID token.
   *
   * @param provider OAuth provider name
   * @param idToken JWT ID token from provider SDK
   * @param opts.createAccount If true and user doesn't exist, auto-create
   * @param opts.ipAddress Client IP for audit log
   * @param opts.userAgent Client UA for audit log
   * @returns AuthSession, or { needsLink: true } if user exists with matching email but no OAuth link yet
   */
  async loginWithIdToken(
    provider: OAuthProvider,
    idToken: string,
    opts: { createAccount?: boolean; ipAddress?: string; userAgent?: string } = {},
  ): Promise<AuthSession | { needsLink: true; existingDid: string; provider: OAuthProvider; email: string }> {
    // 1. Verify the ID token
    let profile: OAuthProfile;
    try {
      profile = await this.verifyIdToken(provider, idToken);
    } catch (err: any) {
      await this.logAttempt({ provider, providerUserId: null, ...opts, success: false, failureReason: err.message });
      throw new UnauthorizedException(`Invalid ${provider} ID token: ${err.message}`);
    }

    // 2. Look up existing OAuth link
    const linked = await this.findOAuthLink(provider, profile.providerUserId);
    if (linked) {
      await this.logAttempt({ provider, providerUserId: profile.providerUserId, ...opts, success: true });
      await this.touchLastUsed(linked.user_did, provider);
      return this.identity.issueSessionForDid(linked.user_did);
    }

    // 3. No link — try email match against existing user
    if (profile.email && profile.emailVerified) {
      const matched = await this.findUserByEmail(profile.email);
      if (matched) {
        // User exists with this email — auto-link (safer than silently creating duplicate)
        // Skip if createAccount=false and we want strict linking
        await this.linkProvider(matched.did, profile);
        await this.logAttempt({ provider, providerUserId: profile.providerUserId, ...opts, success: true });
        return this.identity.issueSessionForDid(matched.did);
      }
    }

    // 4. No link, no email match — check if createAccount is allowed
    if (!opts.createAccount) {
      await this.logAttempt({ provider, providerUserId: profile.providerUserId, ...opts, success: false, failureReason: 'no_account' });
      return {
        needsLink: true,
        existingDid: '',
        provider,
        email: profile.email || '',
      };
    }

    // 5. Create new account
    const newDid = await this.createUserFromOAuth(profile);
    await this.linkProvider(newDid, profile);
    await this.logAttempt({ provider, providerUserId: profile.providerUserId, ...opts, success: true });
    return this.identity.issueSessionForDid(newDid);
  }

  /**
   * Link an OAuth provider to an existing authenticated user.
   * Used when user signs up with email/passkey first, then adds Google sign-in.
   */
  async linkProviderToUser(did: string, provider: OAuthProvider, idToken: string): Promise<void> {
    const profile = await this.verifyIdToken(provider, idToken);
    await this.linkProvider(did, profile);
  }

  /**
   * Unlink a provider from the current user.
   * Refuses if it's the user's only auth method (would lock them out).
   */
  async unlinkProvider(did: string, provider: OAuthProvider): Promise<void> {
    // Check if user has any other auth method
    const user = await this.identity.findByDid(did);
    if (!user) throw new BadRequestException('User not found');

    const linkedProviders = await this.db.query<{ provider: string }>(
      `SELECT provider FROM user_oauth_accounts WHERE user_did = $1`,
      [did],
    );
    const hasPasskey = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_did = $1`,
      [did],
    ).catch(() => ({ rows: [{ count: '0' }] }));

    const totalAuthMethods = linkedProviders.rows.length + parseInt(hasPasskey.rows[0].count, 10);
    if (totalAuthMethods <= 1) {
      throw new BadRequestException('Cannot unlink last auth method — add another first (passkey or another OAuth provider)');
    }

    await this.db.query(
      `DELETE FROM user_oauth_accounts WHERE user_did = $1 AND provider = $2`,
      [did, provider],
    );
  }

  /**
   * List OAuth providers linked to a user.
   */
  async listLinkedProviders(did: string): Promise<Array<{ provider: string; email: string | null; linkedAt: Date; lastUsedAt: Date }>> {
    const res = await this.db.query<{ provider: string; provider_email: string | null; linked_at: Date; last_used_at: Date }>(
      `SELECT provider, provider_email, linked_at, last_used_at
       FROM user_oauth_accounts
       WHERE user_did = $1
       ORDER BY linked_at ASC`,
      [did],
    );
    return res.rows;
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  /**
   * Verify ID token signature + decode claims.
   * Uses provider's JWKS endpoint to verify signature.
   */
  private async verifyIdToken(provider: OAuthProvider, idToken: string): Promise<OAuthProfile> {
    const config = this.getProviderConfig(provider);
    if (!config.enabled) {
      throw new Error(`${provider} OAuth not configured — set ${config.envVars.join(', ')}`);
    }

    // Decode header to get kid (key id)
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Malformed ID token');
    }
    const kid = decoded.header.kid;
    if (!kid) throw new Error('ID token missing kid header');

    // Get signing key from JWKS (cached)
    const jwks = await this.getJwksKeys(provider, config);
    const key = jwks.get(kid);
    if (!key) {
      // Force refresh in case the kid is brand new (key rotation)
      this.jwksCache.delete(provider);
      const refreshed = await this.getJwksKeys(provider, config);
      const key2 = refreshed.get(kid);
      if (!key2) throw new Error(`No JWKS key for kid=${kid}`);
      return this.verifyWithKey(idToken, key2, config, provider);
    }
    return this.verifyWithKey(idToken, key, config, provider);
  }

  /**
   * Verify the ID token against a single JWKS key.
   */
  private verifyWithKey(idToken: string, key: JwksKey, config: ProviderConfig, provider: OAuthProvider): OAuthProfile {
    // Convert JWK → PEM via Node's crypto
    const publicKey = jwkToPem(key);

    // Verify signature + claims
    const verified = jwt.verify(idToken, publicKey, {
      algorithms: [config.algorithm],
      audience: config.audience,
      issuer: config.issuer,
    }) as jwt.JwtPayload;

    if (!verified.sub) throw new Error('ID token missing sub claim');

    return this.extractProfile(provider, verified);
  }

  /**
   * Extract provider-specific profile from verified JWT claims.
   * Google + Apple both use OIDC so claim shapes are mostly standard.
   */
  private extractProfile(provider: OAuthProvider, claims: jwt.JwtPayload): OAuthProfile {
    const email = (claims.email as string) || null;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

    if (provider === 'google') {
      return {
        provider,
        providerUserId: claims.sub,
        email,
        emailVerified,
        displayName: (claims.name as string) || null,
        avatarUrl: (claims.picture as string) || null,
        raw: claims as Record<string, any>,
      };
    }

    if (provider === 'apple') {
      // Apple only sends name + email on FIRST sign-in. After that, only sub.
      // The "name" field comes as a nested object: { name: "First Last" }.
      let displayName: string | null = null;
      if (claims.name && typeof claims.name === 'string') {
        displayName = claims.name;
      } else if (claims.name && typeof claims.name === 'object') {
        const n = claims.name as any;
        const parts = [n.firstName, n.lastName].filter(Boolean);
        if (parts.length > 0) displayName = parts.join(' ');
      }
      return {
        provider,
        providerUserId: claims.sub,
        email,
        emailVerified,
        displayName,
        avatarUrl: null, // Apple doesn't expose avatar
        raw: claims as Record<string, any>,
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Fetch JWKS keys for a provider (with caching).
   * Uses native fetch (Node 18+) — no external dependencies.
   */
  private async getJwksKeys(provider: OAuthProvider, config: ProviderConfig): Promise<Map<string, JwksKey>> {
    const cached = this.jwksCache.get(provider);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    const res = await fetch(config.jwksUri, {
      headers: { 'User-Agent': 'ORBIT-API/1.0' },
      // 5s timeout via AbortController
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`JWKS fetch failed: HTTP ${res.status} from ${config.jwksUri}`);
    }
    const data = (await res.json()) as { keys: JwksKey[] };
    if (!Array.isArray(data.keys)) {
      throw new Error('JWKS response missing "keys" array');
    }
    const map = new Map<string, JwksKey>();
    for (const key of data.keys) {
      if (key.kid) map.set(key.kid, key);
    }
    this.jwksCache.set(provider, { keys: map, expiresAt: Date.now() + JWKS_TTL_MS });
    return map;
  }

  /**
   * Get provider configuration from env vars.
   */
  private getProviderConfig(provider: OAuthProvider): ProviderConfig {
    if (provider === 'google') {
      const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
      return {
        enabled: !!clientId,
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
        audience: clientId,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        algorithm: 'RS256',
        envVars: ['GOOGLE_CLIENT_ID'],
      };
    }
    if (provider === 'apple') {
      const clientId = this.config.get<string>('APPLE_CLIENT_ID');
      return {
        enabled: !!clientId,
        jwksUri: 'https://appleid.apple.com/auth/keys',
        audience: clientId,
        issuer: 'https://appleid.apple.com',
        algorithm: 'RS256',
        envVars: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID'],
      };
    }
    return {
      enabled: false,
      jwksUri: '',
      audience: '',
      issuer: '',
      algorithm: 'RS256',
      envVars: [],
    };
  }

  private async findOAuthLink(provider: OAuthProvider, providerUserId: string): Promise<{ user_did: string } | null> {
    const res = await this.db.query<{ user_did: string }>(
      `SELECT user_did FROM user_oauth_accounts
       WHERE provider = $1 AND provider_user_id = $2
       LIMIT 1`,
      [provider, providerUserId],
    );
    return res.rows[0] || null;
  }

  private async findUserByEmail(email: string): Promise<{ did: string } | null> {
    const res = await this.db.query<{ did: string }>(
      `SELECT did FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return res.rows[0] || null;
  }

  private async linkProvider(userDid: string, profile: OAuthProfile): Promise<void> {
    await this.db.query(
      `INSERT INTO user_oauth_accounts (
        user_did, provider, provider_user_id, provider_email,
        provider_email_verified, provider_display_name, provider_avatar_url, raw_profile
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (provider, provider_user_id) DO UPDATE SET
        provider_email = EXCLUDED.provider_email,
        provider_email_verified = EXCLUDED.provider_email_verified,
        provider_display_name = EXCLUDED.provider_display_name,
        provider_avatar_url = EXCLUDED.provider_avatar_url,
        raw_profile = EXCLUDED.raw_profile,
        last_used_at = NOW()`,
      [
        userDid,
        profile.provider,
        profile.providerUserId,
        profile.email,
        profile.emailVerified,
        profile.displayName,
        profile.avatarUrl,
        JSON.stringify(profile.raw),
      ],
    );
  }

  private async touchLastUsed(userDid: string, provider: OAuthProvider): Promise<void> {
    await this.db.query(
      `UPDATE user_oauth_accounts SET last_used_at = NOW()
       WHERE user_did = $1 AND provider = $2`,
      [userDid, provider],
    );
  }

  /**
   * Create a new user from an OAuth profile.
   * Generates a unique handle from display name or email.
   */
  private async createUserFromOAuth(profile: OAuthProfile): Promise<string> {
    const handle = await this.uniqueHandleFromProfile(profile);
    const identityKeyPair = await generateIdentityKeyPair();
    const x25519KeyPair = await generateX25519KeyPair();
    const did = generateDID(identityKeyPair.publicKey);
    const pdsEndpoint = `${this.config.get('PDS_BASE_URL', 'https://pds.orbit.com')}/${did}`;

    await this.db.query(
      `INSERT INTO users (
        did, handle, domain, display_name, bio, email,
        public_key, identity_key, signed_pre_key, pre_keys,
        pds_endpoint, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)`,
      [
        did,
        handle,
        null,
        profile.displayName || `User ${handle.slice(0, 8)}`,
        null,
        profile.email,
        base64.encode(identityKeyPair.publicKey),
        base64.encode(x25519KeyPair.publicKey),
        base64.encode(x25519KeyPair.privateKey),
        '{}',
        pdsEndpoint,
        JSON.stringify({
          version: 'orbit-v1',
          registration: `oauth:${profile.provider}`,
          oauthEmail: profile.email,
          oauthDisplayName: profile.displayName,
        }),
      ],
    );

    return did;
  }

  /**
   * Generate a unique handle from the OAuth profile.
   * Tries display name first, then email local part, then random.
   */
  private async uniqueHandleFromProfile(profile: OAuthProfile): Promise<string> {
    // Base candidate
    let base: string;
    if (profile.displayName) {
      base = profile.displayName.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
    } else if (profile.email) {
      base = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
    } else {
      base = 'user';
    }
    if (!base || base.length < 3) base = `user_${base}`;

    // Append random suffix if base taken
    for (let i = 0; i < 10; i++) {
      const candidate = i === 0 ? base : `${base}_${Math.floor(Math.random() * 100000)}`;
      const existing = await this.db.query<{ did: string }>(
        `SELECT did FROM users WHERE handle = $1 LIMIT 1`,
        [candidate],
      );
      if (existing.rows.length === 0) return candidate;
    }
    // Fall back to fully random
    return generateHandle();
  }

  private async logAttempt(opts: {
    provider: OAuthProvider;
    providerUserId: string | null;
    success: boolean;
    failureReason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO oauth_login_attempts (
          provider, provider_user_id, success, failure_reason, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          opts.provider,
          opts.providerUserId,
          opts.success,
          opts.failureReason || null,
          opts.ipAddress || null,
          opts.userAgent || null,
        ],
      );
    } catch (err: any) {
      // Don't fail login if audit log fails — best-effort
      this.logger.warn(`Failed to log OAuth attempt: ${err.message}`);
    }
  }
}

interface ProviderConfig {
  enabled: boolean;
  jwksUri: string;
  audience: string | undefined;
  issuer: string | string[];
  algorithm: jwt.Algorithm;
  envVars: string[];
}

/**
 * Convert a JWK (RFC 7517) public key to PEM format.
 * Supports RSA (n, e) — sufficient for Google/Apple which use RS256.
 *
 * Node's `crypto.createPublicKey` accepts JWK directly via the `key` option,
 * so we don't need a manual base64url decode.
 */
function jwkToPem(jwk: JwksKey): string {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error(`Unsupported JWK: kty=${jwk.kty} (only RSA supported)`);
  }
  const keyObj = createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    } as any,
    format: 'jwk',
  });
  return keyObj.export({ type: 'spki', format: 'pem' }) as string;
}