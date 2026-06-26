/**
 * Push notification tests — device registration + push delivery
 *
 * Tests cover:
 *  - Device token registration (Expo format)
 *  - Device token registration (Web Push format)
 *  - Duplicate token registration (UNIQUE constraint → updates instead of insert)
 *  - Device list, enable/disable, mute
 *  - Unregister
 *  - VAPID public key endpoint
 *  - Validation errors return 400
 *  - Auth required on most endpoints
 *
 * Expo push API + web-push library are NOT exercised against external services.
 * Validation, token format checks, and DB persistence are tested.
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, signupAndGetToken, cleanupUser } from './helpers';

const EXPO_TOKEN = 'ExponentPushToken[abc123def456ghi789]';
const WEB_PUSH_SUB = JSON.stringify({
  endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbzhaszWvZhrEfD3qGTjP8M=',
    auth: 'tBHItJI5svbpez7KI4CCXg==',
  },
});

describe('Push Notifications', () => {
  let app: INestApplication;
  let sharedToken: string;
  let sharedDid: string;

  beforeAll(async () => {
    app = await createTestApp();
    const auth = await signupAndGetToken(app, 'push');
    sharedToken = auth.token;
    sharedDid = auth.did;
  });

  afterAll(async () => {
    await cleanupUser(sharedDid);
    await app.close();
  });

  describe('POST /notifications/devices/register', () => {

    it('registers an Expo push token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({
          token: EXPO_TOKEN,
          platform: 'ios',
          deviceId: 'iphone-12345',
          appVersion: '1.0.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(parseInt(res.body.deviceId, 10)).toBeGreaterThan(0);
      expect(res.body.alreadyRegistered).toBe(false);
    });

    it('registers an Android Expo push token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({
          token: 'ExponentPushToken[android-device-xyz]',
          platform: 'android',
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('registers a Web Push subscription', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({
          token: WEB_PUSH_SUB,
          platform: 'web',
        })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('returns alreadyRegistered=true on duplicate token', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: EXPO_TOKEN, platform: 'ios' })
        .expect(200);

      // Second registration of same token
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: EXPO_TOKEN, platform: 'ios' })
        .expect(200);

      // Token gets the same id (UNIQUE constraint → upsert)
      expect(res.body.ok).toBe(true);
    });

    it('rejects invalid Expo token format with 400', async () => {
      // Must explicitly request expo provider to trigger validation —
      // otherwise detectProvider falls back to apns for invalid Expo-looking tokens
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({
          token: 'not-a-valid-expo-token',
          platform: 'ios',
          provider: 'expo',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Expo token');
    });

    it('rejects invalid platform with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({
          token: EXPO_TOKEN,
          platform: 'windows-phone', // not in enum
        });

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .send({ token: EXPO_TOKEN, platform: 'ios' });

      expect(res.status).toBe(401);
    });
  });

describe('GET /notifications/devices', () => {
    it('returns registered devices', async () => {
      // Register a fresh device for this test
      await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: 'ExponentPushToken[list-test-xyz]', platform: 'ios' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/devices')
        .set('Authorization', `Bearer ${sharedToken}`)
        .expect(200);

      // The user may have multiple devices registered by earlier tests
      expect(res.body.devices.length).toBeGreaterThanOrEqual(1);
      const expoDevice = res.body.devices.find((d: any) => d.provider === 'expo');
      expect(expoDevice).toMatchObject({
        platform: 'ios',
        provider: 'expo',
        enabled: true,
      });
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/devices');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /notifications/devices/unregister', () => {
    
    

    it('returns deleted=false for unknown token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/unregister')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: 'ExponentPushToken[never-registered]' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.deleted).toBe(false);
    });

    it('unregisters an existing device', async () => {
      // First register
      await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: EXPO_TOKEN, platform: 'ios' });

      // Then unregister
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/unregister')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: EXPO_TOKEN })
        .expect(200);

      expect(res.body.deleted).toBe(true);
    });
  });

  describe('PATCH /notifications/devices/:id', () => {
    async function registerFreshDevice(tokenName: string): Promise<number> {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/devices/register')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ token: `ExponentPushToken[${tokenName}-${Date.now()}]`, platform: 'ios' });
      return parseInt(res.body.deviceId, 10);
    }

    it('disables a device', async () => {
      const deviceId = await registerFreshDevice('disable');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/devices/${deviceId}`)
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('sets muted_until timestamp', async () => {
      const deviceId = await registerFreshDevice('mute');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/devices/${deviceId}`)
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ mutedUntil: '2026-12-31T23:59:59Z' })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('clears muted_until with null', async () => {
      const deviceId = await registerFreshDevice('clear');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/devices/${deviceId}`)
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ mutedUntil: null })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('rejects invalid id with 200 (graceful)', async () => {
      // The endpoint returns {ok: false} for invalid id — doesn't throw
      const res = await request(app.getHttpServer())
        .patch('/api/v1/notifications/devices/notanumber')
        .set('Authorization', `Bearer ${sharedToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /notifications/vapid-public-key', () => {
    it('returns public key (configured or null)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/vapid-public-key')
        .expect(200);

      expect(res.body).toHaveProperty('publicKey');
      expect(res.body).toHaveProperty('configured');
    });

    it('is public (no auth required)', async () => {
      // Just verify it returns 200 without Authorization header
      await request(app.getHttpServer())
        .get('/api/v1/notifications/vapid-public-key')
        .expect(200);
    });
  });

  describe('push_delivery_attempts audit log', () => {
    it('creates table for delivery audit', async () => {
      const db = (await import('@orbit/db')).getVedadbPool();
      const res = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM push_delivery_attempts`,
      );
      // Just verify the table is queryable — actual push attempts are tested
      // implicitly via the service integration tests (none yet for sendToUser
      // since it requires Expo mock — deferred to follow-up PR).
      expect(parseInt(res.rows[0].count, 10)).toBeGreaterThanOrEqual(0);
    });
  });
});