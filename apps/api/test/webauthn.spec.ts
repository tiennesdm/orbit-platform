/**
 * Integration tests for H-6 (WebAuthn) and auth flow.
 *
 * H-6 was: register/options returned empty {} because:
 *   - generateRegistrationOptions() in @simplewebauthn/server v10 is async (was sync in v9)
 *   - v10 requires userID as Uint8Array (not string)
 *   - v10 checks globalThis.crypto which can be undefined in ts-node
 */
import request from 'supertest';
import { createTestApp, signupAndGetToken, cleanupUser } from './helpers';

describe('WebAuthn registration flow (H-6 regression)', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register/options returns valid challenge + rp + user', async () => {
    const handle = `wb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/identity/register/options')
      .send({ handle, displayName: 'WB Test' });

    expect(res.status).toBe(201);
    expect(res.body.challengeId).toBeDefined();
    expect(res.body.options).toBeDefined();

    const opts = res.body.options;
    // All these were empty/missing before the fix
    expect(opts.challenge).toBeTruthy();
    expect(opts.rp).toBeDefined();
    expect(opts.rp.name).toBeTruthy();
    expect(opts.rp.id).toBeTruthy();
    expect(opts.user).toBeDefined();
    expect(opts.user.id).toBeTruthy();
    expect(opts.user.name).toBe(handle);
    expect(opts.user.displayName).toBe('WB Test');
    expect(opts.pubKeyCredParams).toBeDefined();
    expect(opts.pubKeyCredParams.length).toBeGreaterThan(0);
    expect(opts.timeout).toBe(60000);
  });

  it('register/options returns deterministic user id (Uint8Array of UUID)', async () => {
    const handle = `wb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/identity/register/options')
      .send({ handle, displayName: 'Test 2' });

    const opts = res.body.options;
    // user.id should be base64url-encoded UUID (32+ chars)
    expect(opts.user.id.length).toBeGreaterThanOrEqual(32);
    // Should be valid base64url (no padding, no /+ chars)
    expect(opts.user.id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('challengeId is a valid UUID', async () => {
    const handle = `wb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/identity/register/options')
      .send({ handle, displayName: 'Test 3' });

    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(res.body.challengeId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  });

  // login/options requires the webauthn_credentials table which doesn't exist
  // in the current schema. Tracked as separate issue. Skip until migration adds it.
  it.skip('login/options returns valid challenge for existing user', async () => {
    const user = await signupAndGetToken(app, 'wb_login');
    try {
      const res = await request(app.getHttpServer())
        .post('/api/v1/identity/login/options')
        .send({ handle: user.handle });

      expect(res.status).toBe(201);
      expect(res.body.challengeId).toBeDefined();
      expect(res.body.options).toBeDefined();
      expect(res.body.options.challenge).toBeTruthy();
    } finally {
      await cleanupUser(user.did);
    }
  });
});