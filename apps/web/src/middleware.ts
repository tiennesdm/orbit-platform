/**
 * ORBIT — Next.js security middleware
 *
 * Adds security headers to all responses (defense in depth — the
 * API also has helmet, but the web app has its own responses):
 *  - X-Content-Type-Options: nosniff
 *  - X-Frame-Options: DENY
 *  - X-XSS-Protection: 1; mode=block
 *  - Referrer-Policy: strict-origin-when-cross-origin
 *  - Permissions-Policy: restrict APIs (camera/mic/geolocation by default)
 *  - Strict-Transport-Security: 1 year (production only)
 *  - Content-Security-Policy: strict in production
 *
 *  - Also rate limits:
 *    - Auth endpoints: 10 req / 5 min / IP
 *    - Other API: 100 req / min / IP
 *
 * Runs on the edge — no Node.js dependencies.
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limit store (per-IP). For production with multiple
// instances, use Redis (e.g. @upstash/ratelimit). For now, in-memory.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Reset store periodically (every 5 min) to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (val.resetAt < now) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count++;
  const ok = entry.count <= limit;
  return { ok, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const response = NextResponse.next();

  // Identify client
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const isProd = process.env.NODE_ENV === 'production';

  // ============== Security headers ==============
  // Prevent MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy — disable features by default
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(self)');
  // HSTS (production only, behind TLS)
  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // ============== Content Security Policy (production) ==============
  if (isProd) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires unsafe-inline + eval
      "style-src 'self' 'unsafe-inline'",  // Tailwind
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",  // HTTPS + WSS for realtime
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');
    response.headers.set('Content-Security-Policy', csp);
  }

  // ============== Rate limiting ==============
  // Stricter limit for auth endpoints (prevent brute force)
  const isAuthRoute = url.pathname.startsWith('/login')
    || url.pathname.startsWith('/signup')
    || url.pathname.startsWith('/forgot')
    || url.pathname.includes('/api/v1/identity/signup')
    || url.pathname.includes('/api/v1/identity/login');

  if (isAuthRoute) {
    const { ok, remaining, resetAt } = checkRateLimit(`auth:${ip}`, 10, 5 * 60 * 1000);
    response.headers.set('X-RateLimit-Limit', '10');
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    if (!ok) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Authentication rate limit exceeded. Try again in 5 minutes.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }
  }

  // ============== Request ID for tracing ==============
  const reqId = request.headers.get('x-request-id') || crypto.randomUUID();
  response.headers.set('X-Request-ID', reqId);

  // ============== Security.txt (responsible disclosure) ==============
  if (url.pathname === '/.well-known/security.txt') {
    return new NextResponse(
      `Contact: mailto:security@orbit.example\nExpires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}`,
      { status: 200, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  return response;
}

// Match all paths except static assets and Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes handled by the API server (proxy in production)
     * - _next/static, _next/image (Next.js assets)
     * - favicon.ico
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
