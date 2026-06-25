/**
 * Regression tests for C-3 (custom-feeds SQL injection fix).
 *
 * Before fix: rule.value was `z.any()` and `INTERVAL '1 ${rule.value}'`
 * was concatenated into SQL → authenticated user could `DROP TABLE users`.
 *
 * After fix: Zod discriminatedUnion per rule type with strict enum for 'time'.
 */
import request from 'supertest';
import { createTestApp, signupAndGetToken, cleanupUser, uniqueHandle } from './helpers';

describe('Custom feeds — SQL injection prevention (C-3 regression)', () => {
  let app: any;
  let token: string;
  let did: string;

  beforeAll(async () => {
    app = await createTestApp();
    const user = await signupAndGetToken(app, 'sqlic');
    token = user.token;
    did = user.did;
  });

  afterAll(async () => {
    await cleanupUser(did);
    await app.close();
  });

  // === SQL injection attempts — all should be rejected with 400 ===
  const injectionPayloads = [
    {
      name: 'SQL injection in time rule',
      body: {
        name: 'malicious1',
        rules: [{ type: 'time', value: 'day; DROP TABLE users; --' }],
      },
    },
    {
      name: 'SQL injection in hashtag rule',
      body: {
        name: 'malicious2',
        rules: [{ type: 'hashtag', value: 'x; DROP TABLE users; --' }],
      },
    },
    {
      name: 'oversized author handle',
      body: {
        name: 'malicious3',
        rules: [{ type: 'author', value: 'a'.repeat(5000) }],
      },
    },
    {
      name: 'min_likes with negative value',
      body: {
        name: 'malicious4',
        rules: [{ type: 'min_likes', value: -1 }],
      },
    },
    {
      name: 'min_likes with huge value',
      body: {
        name: 'malicious5',
        rules: [{ type: 'min_likes', value: 99999999999 }],
      },
    },
    {
      name: 'unknown rule type',
      body: {
        name: 'malicious6',
        rules: [{ type: 'evil_type', value: 'whatever' }],
      },
    },
    {
      name: 'missing rules',
      body: { name: 'malicious7', rules: [] },
    },
    {
      name: 'time rule with bogus enum value',
      body: {
        name: 'malicious8',
        rules: [{ type: 'time', value: 'century' }],
      },
    },
  ];

  test.each(injectionPayloads)('$name → rejected with 400', async ({ body }) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/feeds')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid feed payload/);
  });

  // === Valid feeds should still be created ===
  const validPayloads = [
    {
      name: 'time=hour feed',
      body: {
        name: uniqueHandle('hour'),
        rules: [{ type: 'time', value: 'hour' }],
      },
    },
    {
      name: 'time=day feed',
      body: {
        name: uniqueHandle('day'),
        rules: [{ type: 'time', value: 'day' }],
      },
    },
    {
      name: 'time=week feed',
      body: {
        name: uniqueHandle('week'),
        rules: [{ type: 'time', value: 'week' }],
      },
    },
    {
      name: 'multi-rule feed',
      body: {
        name: uniqueHandle('multi'),
        rules: [
          { type: 'hashtag', value: 'photography' },
          { type: 'time', value: 'day' },
          { type: 'min_likes', value: 5 },
          { type: 'media', value: 'media' },
        ],
      },
    },
    {
      name: 'no_replies boolean rule',
      body: {
        name: uniqueHandle('noreplies'),
        rules: [{ type: 'no_replies', value: true }],
      },
    },
  ];

  test.each(validPayloads)('$name → 201', async ({ body }) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/feeds')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.ownerDid).toBe(did);
  });

  // === DB integrity: users table still exists after all injection attempts ===
  it('users table is intact after all injection attempts', async () => {
    const { getVedadbPool } = await import('@orbit/db');
    const db = getVedadbPool();
    const res = await db.query<{ count: string }>('SELECT count(*) FROM users');
    expect(parseInt(res.rows[0].count, 10)).toBeGreaterThanOrEqual(1);
  });
});