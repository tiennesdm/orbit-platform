/**
 * WebAuthn Service — passwordless authentication
 * Uses SimpleWebAuthn library for browser/passkey flows
 */

import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
} from '@simplewebauthn/server';
import { ConfigService } from '@nestjs/config';
import { randomUUID, webcrypto } from 'node:crypto';
import { getVedadbPool, OrbitCache } from '@orbit/db';
import { IdentityService } from './identity.service';
import { MetricsService } from '../../common/observability/metrics.service';
import type { WebAuthnRegistrationOptions, WebAuthnRegistrationCredential } from '@orbit/types';

// Polyfill: @simplewebauthn/server v10 uses `globalThis.crypto` but ts-node
// transpile-only can sometimes fail to expose it. Force-expose Node's webcrypto.
// See: https://github.com/MasterKale/SimpleWebAuthn/issues/561
if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}

@Injectable()
export class WebAuthnService {
  private readonly db = getVedadbPool();
  private readonly cache: OrbitCache;

  constructor(
    private readonly config: ConfigService,
    private readonly identityService: IdentityService,
    private readonly metrics: MetricsService,
  ) {
    this.cache = new OrbitCache(this.db);
  }

  private get rpName() { return this.config.get('WEBAUTHN_RP_NAME', 'Orbit'); }
  private get rpID() { return this.config.get('WEBAUTHN_RP_ID', 'localhost'); }
  private get origin() { return this.config.get('WEBAUTHN_ORIGIN', 'http://localhost:3000'); }

  /**
   * Step 1: Generate registration options for a new user
   * Stores challenge in cache for verification
   */
  async generateRegistrationOptions(input: {
    handle?: string;
    displayName: string;
  }): Promise<{ challengeId: string; options: WebAuthnRegistrationOptions }> {
    const challengeId = randomUUID();
    // @simplewebauthn/server v10: userID must be Uint8Array (not string),
    // AND generateRegistrationOptions is async — must be awaited.
    const userIDBytes = new TextEncoder().encode(challengeId);
    const challenge = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: userIDBytes,
      userName: input.handle || `user_${Date.now()}`,
      userDisplayName: input.displayName,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    } as GenerateRegistrationOptionsOpts);

    // Store challenge + temp user data (TTL 10 min)
    await this.cache.set(
      `webauthn:register:${challengeId}`,
      { challenge: challenge.challenge, input },
      { ttlSeconds: 600 }
    );

    // Serialize the Uint8Array fields to base64url so JSON.stringify works
    // (challenge.challenge and challenge.user.id are Uint8Array, not strings)
    const serializedOptions = {
      ...challenge,
      challenge: this.uint8ToBase64Url(challenge.challenge),
      user: {
        ...challenge.user,
        id: this.uint8ToBase64Url(challenge.user.id),
      },
    };

    return { challengeId, options: serializedOptions as any };
  }

  /** Convert Uint8Array → base64url string (JSON-safe) */
  private uint8ToBase64Url(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64url');
  }

  /**
   * Step 2: Verify registration response, create user account
   */
  async verifyRegistration(input: {
    challengeId: string;
    credential: WebAuthnRegistrationCredential;
  }): Promise<any> {
    const cached = await this.cache.get<{ challenge: string; input: any }>(
      `webauthn:register:${input.challengeId}`
    );
    if (!cached) {
      throw new BadRequestException('Registration challenge expired or not found');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: input.credential as any,
        expectedChallenge: cached.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });
    } catch (err: any) {
      throw new BadRequestException(`WebAuthn verification failed: ${err.message}`);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration not verified');
    }
    this.metrics.webauthnRegistrations.inc();

    // Create user account
    const session = await this.identityService.register({
      handle: cached.input.handle,
      displayName: cached.input.displayName,
    });

    // Store credential for future logins
    await this.db.query(
      `INSERT INTO webauthn_credentials (credential_id, did, public_key, counter, transports, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (credential_id) DO NOTHING`,
      [
        verification.registrationInfo.credential.id,
        session.did,
        Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
        verification.registrationInfo.credential.counter,
        verification.registrationInfo.credential.transports || [],
      ]
    );

    // Cleanup challenge
    await this.cache.del(`webauthn:register:${input.challengeId}`);

    return { session, verified: true };
  }

  /**
   * Step 1 (Login): Generate authentication options
   */
  async generateAuthenticationOptions(handle: string): Promise<{ challengeId: string; options: any }> {
    const user = await this.identityService.findByHandle(handle);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const credRes = await this.db.query<{ credential_id: string; transports: string[] }>(
      `SELECT credential_id, transports FROM webauthn_credentials WHERE did = $1`,
      [user.did]
    );

    if (credRes.rows.length === 0) {
      throw new UnauthorizedException('No credentials registered for this user');
    }

    const options = generateAuthenticationOptions({
      rpID: this.rpID,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: credRes.rows.map((c) => ({
        id: c.credential_id,
        transports: c.transports as any,
      })),
    } as GenerateAuthenticationOptionsOpts);

    const challengeId = crypto.randomUUID();
    await this.cache.set(
      `webauthn:auth:${challengeId}`,
      { challenge: options.challenge, did: user.did },
      { ttlSeconds: 600 }
    );

    return { challengeId, options };
  }

  /**
   * Step 2 (Login): Verify authentication response, issue session
   */
  async verifyAuthentication(input: {
    challengeId: string;
    credential: any;
  }): Promise<any> {
    const cached = await this.cache.get<{ challenge: string; did: string }>(
      `webauthn:auth:${input.challengeId}`
    );
    if (!cached) {
      throw new UnauthorizedException('Authentication challenge expired');
    }

    const credRes = await this.db.query<any>(
      `SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE credential_id = $1`,
      [input.credential.id]
    );
    if (credRes.rows.length === 0) {
      throw new UnauthorizedException('Credential not found');
    }
    const stored = credRes.rows[0];

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: input.credential,
        expectedChallenge: cached.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        authenticator: {
          credentialID: stored.credential_id,
          credentialPublicKey: Buffer.from(stored.public_key, 'base64'),
          counter: stored.counter,
        },
      });
    } catch (err: any) {
      throw new UnauthorizedException(`Authentication failed: ${err.message}`);
    }

    if (!verification.verified) {
      this.metrics.webauthnLogins.inc({ result: 'fail' });
      throw new UnauthorizedException('Authentication not verified');
    }
    this.metrics.webauthnLogins.inc({ result: 'success' });

    // Update counter (replay protection)
    await this.db.query(
      `UPDATE webauthn_credentials SET counter = $1 WHERE credential_id = $2`,
      [verification.authenticationInfo.newCounter, stored.credential_id]
    );

    // Issue session
    const user = await this.identityService.findByDid(cached.did);
    if (!user) throw new UnauthorizedException('User not found');

    const session = await this.identityService['issueSession'](
      user.did,
      user.handle,
      user.displayName,
      user.pdsEndpoint
    );

    await this.cache.del(`webauthn:auth:${input.challengeId}`);
    return { session, verified: true };
  }
}
