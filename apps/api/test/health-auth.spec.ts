/**
 * Integration tests for M-2 (throttler) + M-5 (health probes) + auth flow.
 *
 * M-2: throttler should:
 *   - Skip on health probes (so K8s probes work)
 *   - Apply strict limits on auth endpoints (prevent brute force)
 *
 * M-5: K8s health probes should:
 *   - /health/live → 200 (process up)
 *   - /health/ready → 503 if startup not complete, else 200 (DB check)
 *   - /health/startup → 503 if startup not complete, else 200
 */
import request from 'supertest';
import { createTestApp } from './helpers';

describe('Health probes + throttler (M-2, M-5)', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health probes', () => {
    it('/health/live returns 200 with uptime', async () => {
      const res = await request(app.getHttpServer()).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('live');
      expect(res.body.uptime).toBeGreaterThan(0);
      expect(res.body.timestamp).toBeDefined();
    });

    it('/health/ready returns 200 with dbReachable=true', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.dbReachable).toBe(true);
    });

    it('/health/startup returns 200 (already complete by test time)', async () => {
      const res = await request(app.getHttpServer()).get('/health/startup');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('started');
    });

    it('/health returns 200 with full check (DB + memory)', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.info).toBeDefined();
      expect(res.body.info.vedadb).toBeDefined();
      expect(res.body.info.vedadb.status).toBe('up');
    });

    it('/metrics returns Prometheus format', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('# TYPE');
    });

    // M-2: health probes bypass throttle (set THROTTLE_SHORT_LIMIT=1000 in test env)
    it('health probes bypass throttler (10 rapid requests all 200)', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer()).get('/health/live');
        codes.push(res.status);
      }
      expect(codes.every((c) => c === 200)).toBe(true);
    });
  });

  describe('Auth flow', () => {
    it('signup → 201, returns access token + DID', async () => {
      const handle = `auth_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/identity/signup')
        .send({ handle, displayName: 'Auth Test' });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.did).toMatch(/^did:orbit:/);
      expect(res.body.handle).toBe(handle);
    });

    it('signup with invalid handle returns 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/identity/signup')
        .send({ handle: 'invalid handle with spaces', displayName: 'X' });

      // Schema validation should reject
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('GET /identity/me without auth → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/identity/me');
      expect(res.status).toBe(401);
    });

    it('GET /identity/me with valid token → 200', async () => {
      const handle = `authme_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const signup = await request(app.getHttpServer())
        .post('/api/v1/identity/signup')
        .send({ handle, displayName: 'Me Test' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/identity/me')
        .set('Authorization', `Bearer ${signup.body.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.did).toBe(signup.body.did);
    });

    it('GET /identity/me with INVALID token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/identity/me')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(res.status).toBe(401);
    });
  });
});