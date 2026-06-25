/**
 * Smoke test — verifies Jest + ts-jest + setup work before we write real tests.
 * If this fails, check jest.config.js and test/setup.ts.
 */
describe('Test infrastructure', () => {
  it('runs jest', () => {
    expect(1 + 1).toBe(2);
  });

  it('loads setup env vars', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toContain('test-jwt-secret');
    expect(process.env.VEDADB_DATABASE).toBe('orbit_test');
  });
});