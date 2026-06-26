/**
 * Regression tests for M-6 (moderation report enum coercion fix).
 *
 * Before fix: 'targetType' was passed as string to reports.target_type
 * (smallint column) → Postgres error 'invalid input syntax for type smallint'.
 *
 * After fix: explicit enum-to-smallint map (post=1, user=2, reel=3, etc.)
 */
import request from 'supertest';
import { createTestApp, signupAndGetToken, cleanupUser } from './helpers';

describe('Moderation report — enum mapping (M-6 regression)', () => {
  let app: any;
  let token: string;
  let did: string;

  beforeAll(async () => {
    app = await createTestApp();
    const user = await signupAndGetToken(app, 'modtest');
    token = user.token;
    did = user.did;
  });

  afterAll(async () => {
    await cleanupUser(did);
    await app.close();
  });

  // All 5 valid types must persist with correct smallint values
  const validTypes = [
    { name: 'post', targetType: 'post', expectedInt: 1 },
    { name: 'user', targetType: 'user', expectedInt: 2 },
    { name: 'reel', targetType: 'reel', expectedInt: 3 },
    { name: 'story', targetType: 'story', expectedInt: 4 },
    { name: 'message', targetType: 'message', expectedInt: 5 },
  ];

  test.each(validTypes)('$name target → stored as $expectedInt', async ({ targetType, expectedInt }) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/moderation/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType, targetId: '99', reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify in DB
    const { getVedadbPool } = await import('@orbit/db');
    const db = getVedadbPool();
    const dbRes = await db.query<{ target_type: number; reason: string }>(
      `SELECT target_type, reason FROM reports WHERE reporter_id = $1 AND target_id = '99' ORDER BY created_at DESC LIMIT 1`,
      [did]
    );
    expect(dbRes.rows[0].target_type).toBe(expectedInt);
  });

  it('rejects invalid targetType', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/moderation/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'evil_type', targetId: '99', reason: 'spam' });

    expect(res.status).toBe(400);
  });
});