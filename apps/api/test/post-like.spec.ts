/**
 * Integration tests for H-1 (post like toggle) and the audit fixes.
 *
 * H-1 was: post.like() was increment-only, no unlike, no "liked by you" tracking.
 * After fix: idempotent toggle via likes table with sync trigger.
 */
import request from 'supertest';
import { createTestApp, signupAndGetToken, cleanupUser, db } from './helpers';

describe('Post like toggle (H-1 regression)', () => {
  let app: any;
  let authorToken: string;
  let authorDid: string;
  let likerToken: string;
  let likerDid: string;
  let postId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const author = await signupAndGetToken(app, 'author');
    authorToken = author.token;
    authorDid = author.did;
    const liker = await signupAndGetToken(app, 'liker');
    likerToken = liker.token;
    likerDid = liker.did;

    // Author creates a post
    const post = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ mode: 'public', contentText: 'Like toggle test' })
      .expect(201);
    postId = post.body.postId;
  });

  afterAll(async () => {
    await cleanupUser(authorDid);
    await cleanupUser(likerDid);
    await app.close();
  });

  it('first like → liked=true, like_count=1', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/posts/${authorDid}/${postId}/like`)
      .set('Authorization', `Bearer ${likerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.liked).toBe(true);

    // Verify like_count via DB
    const dbRes = await db().query<{ like_count: number }>(
      `SELECT like_count FROM posts WHERE post_id = $1`,
      [postId]
    );
    expect(Number(dbRes.rows[0].like_count)).toBe(1);
  });

  it('second like (toggle) → liked=false, like_count=0', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/posts/${authorDid}/${postId}/like`)
      .set('Authorization', `Bearer ${likerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.liked).toBe(false);

    const dbRes = await db().query<{ like_count: number }>(
      `SELECT like_count FROM posts WHERE post_id = $1`,
      [postId]
    );
    expect(Number(dbRes.rows[0].like_count)).toBe(0);
  });

  it('third like (toggle back on) → liked=true, like_count=1', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/posts/${authorDid}/${postId}/like`)
      .set('Authorization', `Bearer ${likerToken}`);

    expect(res.body.liked).toBe(true);

    const dbRes = await db().query<{ like_count: number }>(
      `SELECT like_count FROM posts WHERE post_id = $1`,
      [postId]
    );
    expect(Number(dbRes.rows[0].like_count)).toBe(1);
  });

  it('GET /posts/liked-by-me returns the liked post', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/posts/liked-by-me')
      .set('Authorization', `Bearer ${likerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].postId).toBe(postId);
  });

  it('multiple users can like independently', async () => {
    // Create another liker
    const user2 = await signupAndGetToken(app, 'liker2');
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${authorDid}/${postId}/like`)
        .set('Authorization', `Bearer ${user2.token}`)
        .expect(201);

      // Both user1 and user2 have liked → count = 2
      const dbRes = await db().query<{ like_count: number }>(
        `SELECT like_count FROM posts WHERE post_id = $1`,
        [postId]
      );
      expect(Number(dbRes.rows[0].like_count)).toBe(2);

      // Verify 2 likes in likes table
      const likesRes = await db().query<{ count: string }>(
        `SELECT count(*) FROM likes WHERE post_id = $1`,
        [postId]
      );
      expect(parseInt(likesRes.rows[0].count, 10)).toBe(2);
    } finally {
      await cleanupUser(user2.did);
    }
  });

  it('rejects like without auth', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/posts/${authorDid}/${postId}/like`)
      .send();

    expect(res.status).toBe(401);
  });
});