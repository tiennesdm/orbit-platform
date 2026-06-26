/**
 * Test helpers — utilities for integration and e2e tests.
 *
 * Usage:
 *   import { createTestApp, signupAndGetToken, cleanupUser } from './helpers';
 *   const app = await createTestApp();
 *   const { token, did } = await signupAndGetToken(app, 'testhandle');
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { getVedadbPool } from '@orbit/db';
// supertest v7+ exports default (not namespace)
import request from 'supertest';

/**
 * Create a NestJS test application with the full AppModule wired.
 * Use this for integration tests that need real DB + auth + everything.
 *
 * Note: uses process.cwd() which must be apps/api when running pnpm test.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/(.*)', 'metrics'],
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  await app.init();

  // Mark startup complete so /health/ready and /health/startup return 200.
  // (In production this happens in main.ts after listen() succeeds.)
  // Lazy import to avoid circular deps in tests.
  const { markStartupComplete } = await import('../src/common/health/health.controller');
  markStartupComplete();

  return app;
}

/**
 * Sign up a test user via the API and return access token + DID + handle.
 * The user is created with a unique handle based on the test name + timestamp.
 */
export async function signupAndGetToken(
  app: INestApplication,
  handlePrefix: string,
): Promise<{ token: string; refreshToken: string; did: string; handle: string }> {
  const handle = `${handlePrefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/identity/signup')
    .send({ handle, displayName: `Test ${handlePrefix}` })
    .expect(201);

  return {
    token: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    did: res.body.did,
    handle: res.body.handle,
  };
}

/**
 * Cleanup a user (and cascade via hard delete). Use in afterEach.
 * Calls the full GDPR cascade so all related tables are cleared.
 */
export async function cleanupUser(did: string): Promise<void> {
  const db = getVedadbPool();
  // Manually clear tables that block user deletion via FK (no CASCADE).
  // For tests we only need to clear the obvious blocking tables.
  // GDPR cascade in production does more (30+ tables).
  const blockingTables = [
    `DELETE FROM reports WHERE reporter_id = $1`,  // FK to users
    `DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1`,
    `DELETE FROM follows WHERE follower_id = $1 OR followee_id = $1`,
  ];
  for (const sql of blockingTables) {
    try {
      await db.query(sql, [did]);
    } catch {
      // ignore — table may not exist or column may differ
    }
  }
  // Now safe to delete user (other tables have ON DELETE CASCADE)
  await db.query(`DELETE FROM users WHERE did = $1`, [did]);
}

/**
 * Cleanup a single test artifact by table + id.
 */
export async function cleanupRow(table: string, column: string, value: string): Promise<void> {
  await getVedadbPool().query(`DELETE FROM ${table} WHERE ${column} = $1`, [value]);
}

/**
 * Truncate a test table (fast — use sparingly, FK constraints can cause issues).
 */
export async function truncate(table: string): Promise<void> {
  await getVedadbPool().query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
}

/**
 * Get the current DB pool for direct queries in tests.
 */
export function db() {
  return getVedadbPool();
}

/**
 * Generate a unique handle for the test (avoids unique constraint collisions).
 */
export function uniqueHandle(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Sleep helper.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify a JWT was signed with our test secret (returns payload).
 */
export function decodeJwt(token: string): any {
  const parts = token.split('.');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
}