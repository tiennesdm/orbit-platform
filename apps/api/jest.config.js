/**
 * Jest config for ORBIT API tests
 *
 * Test pyramid:
 *  - Unit tests (services, guards, helpers) — fast, no I/O
 *  - Integration tests (controllers with real DB) — uses orbit_test DB
 *  - E2E tests (full HTTP flow with supertest) — slower
 *
 * Run: pnpm test          (unit + integration)
 *      pnpm test:e2e      (e2e only)
 *      pnpm test:watch    (watch mode)
 *      pnpm test:cov      (with coverage)
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: {
    '^@orbit/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  // Some OAuth dependencies (jose, used by jwks-rsa) are ESM-only.
  // Allow ts-jest to transform them.
  transformIgnorePatterns: [
    '/node_modules/(?!(jose|@panva|uuid|pkcs11js)/)',
  ],
  setupFiles: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  // Coverage thresholds — regression suite for security-critical paths.
// Goal is "no PR silently breaks a critical invariant", not 100% coverage.
// Many service files have edge cases (errors, retries) that are out of
// scope for this initial suite. Raise these as we add more tests.
coverageThreshold: {
    global: {
      // Below current coverage — tests target critical paths only.
      // Will be raised incrementally as we add more test files.
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
    // Per-file thresholds for modules with dedicated tests. These should
    // be high because regressions here are security-critical.
    './src/modules/gdpr/': { lines: 60 },
  },
  testTimeout: 30000,
  maxWorkers: 1, // Serialize DB-touching tests to avoid FK race conditions
};