/**
 * ORBIT shared types — User domain
 */

export type DID = string;                                    // W3C Decentralized Identifier
export type Handle = string;                                // @username
export type ISO8601 = string;

export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface UserPublicKeys {
  /** Identity key (Ed25519, base64) — used for signing */
  identityKey: string;
  /** Pre-key bundle for X3DH initial key exchange */
  signedPreKey: string;
  signedPreKeySignature: string;
  /** One-time pre-keys (consumed once per session) */
  oneTimePreKeys: string[];
}

export interface User {
  id: string;                                              // UUID
  did: DID;                                                // did:orbit:<username-or-hash>
  /** Optional domain (e.g. @alice.bsky.social style portable handle) */
  domain?: string;
  username: string;
  handle: Handle;                                          // unique, indexed
  displayName: string;
  bio?: string;
  /** IPFS CIDs for avatar / cover images (services store CIDs, not URLs) */
  avatarCid?: string;
  coverCid?: string;
  /** Convenience URL aliases — derived from avatarCid/coverCid at the edge */
  avatarUrl?: string;
  coverUrl?: string;
  email?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  /**
   * Ed25519 public key (base64) — used for verifying DID ownership
   * (see identity.service.ts:200 verifyDidOwnership).
   */
  publicKey?: string;
  /** Portable Data Server endpoint URL for this user */
  pdsEndpoint?: string;
  /** Reputation score (0–100). Used for attestations + search ranking. */
  reputationScore?: number;
  /** Last time the user was seen (heartbeat from client) */
  lastSeenAt?: ISO8601;
  /** Free-form metadata blob (e.g. { version, registration }) */
  metadata?: Record<string, unknown>;
  /** Portable identity — exported data vault */
  portableIdentity?: {
    publicKeys: UserPublicKeys;
    encryptedPrivateKey: string;
    recoveryPhraseHash: string;
  };
  /**
   * Alias for `portableIdentity.publicKeys` — services read/write this
   * directly when building portable identity exports.
   */
  publicKeys?: UserPublicKeys;
  /** AI agent settings */
  aiAgent: {
    enabled: boolean;
    autonomyLevel: 'ask' | 'suggest' | 'auto';
    memoryEnabled: boolean;
    dailyDigestEnabled: boolean;
  };
  /** Privacy settings */
  privacy: {
    profileVisibility: 'public' | 'followers' | 'private';
    showActivityStatus: boolean;
    showReadReceipts: boolean;
    allowDms: 'everyone' | 'followers' | 'nobody';
  };
  /** Usage tracking (anti-addiction) */
  usageStats: {
    lastActiveAt: ISO8601;
    dailyMinutesUsed: number;
    weeklyMinutesUsed: number;
    monthlyMinutesUsed: number;
    streakDays: number;
  };
  status: UserStatus;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

/**
 * Issued after register/login/refresh. Returned by `identity.service.issueSession`.
 *
 * NOTE: AuthSession lives in this file (not auth.ts) because it's the runtime
 * user-auth payload, whereas auth.ts holds the WebAuthn ceremony shapes.
 * Services pass `handle`, `displayName`, and `pdsEndpoint` as extra fields —
 * all three are optional here.
 */
export interface AuthSession {
  userId?: string;
  did: DID;
  handle?: Handle;
  displayName?: string;
  accessToken: string;                                      // JWT
  refreshToken: string;
  expiresAt: ISO8601;
  /** PDS endpoint for the user (forwarded from issueSession) */
  pdsEndpoint?: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: ISO8601;
}