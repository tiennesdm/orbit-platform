/**
 * Global test setup — runs before each test file
 *
 * - Sets NODE_ENV=test so pino logs at debug but doesn't pollute output
 * - Sets up minimal env vars so ConfigService doesn't blow up
 * - Configures test DB (orbit_test) — tests must NOT touch orbit
 * - Initializes the VedadbPool early so services can `getVedadbPool()`
 *   at module construction time (some services capture it eagerly).
 */

// Suppress noisy logs in tests
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'test';

// Test DB — separate from dev DB to avoid wiping real data
process.env.VEDADB_HOST = process.env.VEDADB_HOST_TEST || 'localhost';
process.env.VEDADB_PORT = process.env.VEDADB_PORT_TEST || '5434';
process.env.VEDADB_DATABASE = process.env.VEDADB_DATABASE_TEST || 'orbit_test';
process.env.VEDADB_USER = process.env.VEDADB_USER_TEST || 'orbit';
process.env.VEDADB_PASSWORD = process.env.VEDADB_PASSWORD_TEST || 'orbit_dev_password';
process.env.VEDADB_SSL = 'false';

// JWT for tests (≥32 chars, deterministic so we can verify)
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.JWT_EXPIRES_IN = '86400';

// CORS — single origin to satisfy preflight check
process.env.CORS_ORIGINS = 'http://localhost:3000';

// API
process.env.API_PORT = '4001';
process.env.AUTO_MIGRATE = 'true';
process.env.MIGRATION_FAIL_FAST = 'false'; // don't fail tests if migrations dir moves
process.env.BODY_LIMIT = '5mb';
process.env.TRUST_PROXY = 'true';

// Disable Sentry in tests
delete process.env.SENTRY_DSN;

// AI — no key, will fall back to echo
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

// Federation
process.env.PLC_DIRECTORY_URL = 'https://plc.directory';
process.env.FEDERATION_ENABLED = 'false'; // don't hit external services in tests

// Throttler — raise limits for tests so rapid requests don't 429.
// With maxWorkers=1, all tests share one process, so the throttler
// counter is shared. Use very high limits to avoid spurious 429s.
process.env.THROTTLE_SHORT_LIMIT = '10000';
process.env.THROTTLE_MEDIUM_LIMIT = '100000';
process.env.THROTTLE_LONG_LIMIT = '1000000';

// Per-route throttles that override the global — also bump them
process.env.PUSH_REGISTER_SHORT_LIMIT = '10000';
process.env.PUSH_REGISTER_MEDIUM_LIMIT = '100000';

// Initialize DB pool early. Some services call `getVedadbPool()` in their
// field initializers (e.g. `private readonly db = getVedadbPool()`) which
// runs at module instantiation. Without this, those services throw during
// Test.createTestingModule().compile().
import { createVedadbPool, closeVedadbPool } from '@orbit/db';

let poolInitialized = false;
export async function ensurePool() {
  if (poolInitialized) return;
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
  poolInitialized = true;
}

// Run pool init synchronously so it's ready before module imports happen.
// (Jest's setupFiles run before tests, but module imports happen during
// describe() evaluation in the test files themselves.)
ensurePool();

// Cleanup on Jest teardown
process.on('beforeExit', async () => {
  if (poolInitialized) {
    await closeVedadbPool();
    poolInitialized = false;
  }
});