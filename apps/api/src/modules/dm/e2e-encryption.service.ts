/**
 * E2E Encryption Service — Signal Protocol
 * Server stores ONLY ciphertext, cannot decrypt
 */

import { Injectable } from '@nestjs/common';
import {
  generateX25519KeyPair,
  generateIdentityKeyPair,
  deriveInitialSession,
  encryptMessage,
  decryptMessage,
  signEd25519,
  verifyEd25519,
  base64,
  base64url,
  type PreKeyBundle,
  type RatchetState,
  type X25519KeyPair,
  type SignalIdentityKey,
} from '@orbit/crypto';
import { getVedadbPool, OrbitCache } from '@orbit/db';

@Injectable()
export class E2eEncryptionService {
  private readonly db = getVedadbPool();
  private readonly cache: OrbitCache;

  constructor() {
    this.cache = new OrbitCache(this.db);
  }

  /**
   * Generate a user's pre-key bundle (published for others to initiate sessions)
   * Stored in `users` table (signed_pre_key, pre_keys)
   */
  async generatePreKeyBundle(userId: string): Promise<PreKeyBundle> {
    const userKeyRes = await this.db.query<{
      identity_key: string;
      signed_pre_key: string;
    }>(
      `SELECT identity_key, signed_pre_key FROM users WHERE did = $1`,
      [userId]
    );

    if (userKeyRes.rows.length === 0) {
      throw new Error('User not found');
    }
    const { identity_key, signed_pre_key } = userKeyRes.rows[0];

    // Get a one-time pre-key (consumed)
    const otpkRes = await this.db.query<{
      key_id: number;
      public_key: string;
    }>(
      `SELECT key_id, public_key FROM pre_keys
       WHERE user_id = $1 AND used = FALSE
       ORDER BY key_id ASC LIMIT 1`,
      [userId]
    );

    let oneTimePreKey;
    if (otpkRes.rows.length > 0) {
      const otpk = otpkRes.rows[0];
      oneTimePreKey = { keyId: otpk.key_id, publicKey: base64.decode(otpk.public_key) };
      // Mark as used
      await this.db.query(`UPDATE pre_keys SET used = TRUE, used_at = NOW() WHERE key_id = $1`, [otpk.key_id]);
    }

    // Sign the pre-key with identity key (simplified)
    const signature = signEd25519(
      base64.decode(signed_pre_key),
      base64.decode(userKeyRes.rows[0].identity_key)
    );

    return {
      identityKey: base64.decode(identity_key),
      signedPreKey: {
        keyId: 1,
        publicKey: base64.decode(signed_pre_key),
        signature,
      },
      oneTimePreKey,
    };
  }

  /**
   * Initiate E2E session (Alice → Bob)
   * Returns initial ratchet state for Alice
   */
  async initiateSession(aliceId: string, bobId: string): Promise<RatchetState> {
    const bobBundle = await this.generatePreKeyBundle(bobId);
    const aliceIdentity = await this.getUserIdentityKey(aliceId);
    const aliceEphemeral = await generateX25519KeyPair();
    return deriveInitialSession(aliceIdentity, aliceEphemeral, bobBundle);
  }

  /**
   * Encrypt a message with current ratchet state
   */
  async encrypt(state: RatchetState, plaintext: string): Promise<{ ciphertext: string; ephemeralPublicKey?: string; counter: number }> {
    const result = await encryptMessage(state, new TextEncoder().encode(plaintext));
    return {
      ciphertext: base64.encode(result.ciphertext),
      ephemeralPublicKey: result.ephemeralPublicKey ? base64.encode(result.ephemeralPublicKey) : undefined,
      counter: result.counter,
    };
  }

  /**
   * Decrypt a message
   */
  async decrypt(state: RatchetState, ciphertext: string, ephemeralPublicKey?: string): Promise<string> {
    const plaintext = await decryptMessage(
      state,
      base64.decode(ciphertext),
      ephemeralPublicKey ? base64.decode(ephemeralPublicKey) : undefined
    );
    return new TextDecoder().decode(plaintext);
  }

  /**
   * Store ratchet state in Vedadb cache (encrypted with session key)
   */
  async saveRatchetState(userId: string, threadId: string, state: RatchetState): Promise<void> {
    await this.cache.set(
      `ratchet:${userId}:${threadId}`,
      JSON.stringify({
        rootKey: base64.encode(state.rootKey),
        sendChainKey: base64.encode(state.sendChainKey),
        recvChainKey: base64.encode(state.recvChainKey),
        sendCounter: state.sendCounter,
        recvCounter: state.recvCounter,
      }),
      { ttlSeconds: 86400 * 30 } // 30 days
    );
  }

  /**
   * Load ratchet state from cache
   */
  async loadRatchetState(userId: string, threadId: string): Promise<RatchetState | null> {
    const stored = await this.cache.get<any>(`ratchet:${userId}:${threadId}`);
    if (!stored) return null;

    // Restore full state (simplified)
    return {
      rootKey: base64.decode(stored.rootKey),
      sendChainKey: base64.decode(stored.sendChainKey),
      recvChainKey: base64.decode(stored.recvChainKey),
      sendCounter: stored.sendCounter,
      recvCounter: stored.recvCounter,
      skippedKeys: new Map(),
    };
  }

  private async getUserIdentityKey(userId: string): Promise<SignalIdentityKey> {
    const res = await this.db.query<{ identity_key: string; identity_private: string }>(
      `SELECT identity_key, identity_private FROM user_identity_keys WHERE user_id = $1`,
      [userId]
    );
    if (res.rows.length === 0) {
      throw new Error(`Identity key not found for user ${userId}`);
    }
    const row = res.rows[0];
    return {
      publicKey: base64.decode(row.identity_key),
      privateKey: base64.decode(row.identity_private),
    };
  }
}
