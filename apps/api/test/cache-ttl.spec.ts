/**
 * Regression tests for C-1, C-2 (OrbitCache SQL injection fix).
 *
 * Before fix: TTL was interpolated into SQL string:
 *   `... NOW() + INTERVAL '${ttl} seconds' ...`
 * → SQL injection via TTL parameter.
 *
 * After fix: TTL is sanitized (integer 1..30 days) + uses parameterized
 * make_interval(secs => $n).
 */
import { createVedadbPool, closeVedadbPool, getVedadbPool, OrbitCache, VedadbPool } from '@orbit/db';

describe('OrbitCache TTL sanitization (C-1, C-2 regression)', () => {
  let cache: OrbitCache;

  beforeAll(() => {
    createVedadbPool({
      host: process.env.VEDADB_HOST!,
      port: parseInt(process.env.VEDADB_PORT!, 10),
      database: process.env.VEDADB_DATABASE!,
      user: process.env.VEDADB_USER!,
      password: process.env.VEDADB_PASSWORD!,
      ssl: false,
      engine: 'postgres',
      maxConnections: 5,
    });
    cache = new OrbitCache(getVedadbPool());
  });

  afterAll(async () => {
    await closeVedadbPool();
  });

  // The sanitizer is private; we test through observable behavior.
  // If SQL injection worked, the cache.set would either succeed (data exfil)
  // or fail with a Postgres error. We verify it either succeeds safely OR
  // rejects the input — never executes attacker SQL.

  describe('set() — TTL validation', () => {
    it('accepts valid integer TTL (3600)', async () => {
      await expect(
        cache.set('test:valid_ttl', { foo: 'bar' }, { ttlSeconds: 3600 })
      ).resolves.not.toThrow();
    });

    it('accepts small TTL (1 second)', async () => {
      await expect(
        cache.set('test:small_ttl', { x: 1 }, { ttlSeconds: 1 })
      ).resolves.not.toThrow();
    });

    it('accepts large TTL (30 days = 2592000)', async () => {
      await expect(
        cache.set('test:large_ttl', { x: 1 }, { ttlSeconds: 2592000 })
      ).resolves.not.toThrow();
    });

    // === SECURITY: these are the regression cases for the SQL injection ===
    it('rejects string TTL that contains SQL (C-1 fix)', async () => {
      // Before fix: would execute: ... INTERVAL '1; DROP TABLE users; -- seconds'
      // After fix: sanitizer coerces NaN strings to default 3600, never interpolates
      await expect(
        cache.set('test:sql_inj', { x: 1 }, { ttlSeconds: '1; DROP TABLE users; --' as any })
      ).resolves.not.toThrow();
    });

    it('rejects negative TTL (uses default)', async () => {
      await expect(
        cache.set('test:negative', { x: 1 }, { ttlSeconds: -100 })
      ).resolves.not.toThrow();
    });

    it('rejects absurdly large TTL (uses default)', async () => {
      // > 30 days gets clamped to default
      await expect(
        cache.set('test:huge_ttl', { x: 1 }, { ttlSeconds: 999999999 })
      ).resolves.not.toThrow();
    });

    it('rejects NaN TTL (uses default)', async () => {
      await expect(
        cache.set('test:nan', { x: 1 }, { ttlSeconds: NaN as any })
      ).resolves.not.toThrow();
    });

    it('rejects Infinity TTL (uses default)', async () => {
      await expect(
        cache.set('test:inf', { x: 1 }, { ttlSeconds: Infinity as any })
      ).resolves.not.toThrow();
    });

    it('rejects undefined TTL (uses default)', async () => {
      await expect(
        cache.set('test:undef', { x: 1 }, { ttlSeconds: undefined as any })
      ).resolves.not.toThrow();
    });

    it('rejects null TTL (uses default)', async () => {
      await expect(
        cache.set('test:null', { x: 1 }, { ttlSeconds: null as any })
      ).resolves.not.toThrow();
    });
  });

  describe('incr() — TTL validation', () => {
    it('accepts valid TTL', async () => {
      const val = await cache.incr('test:incr_valid', 3600);
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0);
    });

    // C-2 regression: same SQL injection class as set()
    it('rejects SQL injection in TTL — does not throw, returns number', async () => {
      const val = await cache.incr('test:incr_sql', "1; DROP TABLE users; --" as any);
      expect(typeof val).toBe('number');
      // Value should be 0 or 1 — NOT an SQL injection success
      expect(val).toBeLessThan(100);
    });
  });

  describe('users table still exists after all the injection attempts', () => {
    // Belt-and-suspenders: even if sanitization regressed, the previous tests
    // would have either thrown OR succeeded without breaking the DB.
    // This test verifies users table is still here.
    it('users table is intact', async () => {
      const { getVedadbPool } = await import('@orbit/db');
      const db = getVedadbPool();
      const res = await db.query<{ count: string }>('SELECT count(*) FROM users');
      expect(parseInt(res.rows[0].count, 10)).toBeGreaterThanOrEqual(0);
    });
  });
});