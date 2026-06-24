# ORBIT — Security

ORBIT's security model and threat-mitigation checklist.

## Principles

1. **Defense in depth** — multiple layers (helmet, CORS, auth, validation, filter, rate limit, body size).
2. **Fail closed** — production preflight checks refuse to start with weak config.
3. **Least privilege** — JWT scoped, DB user has only needed perms.
4. **Audit everything** — request ID propagation, structured logs, Sentry capture.
5. **No secrets in code** — env vars only, never committed.

---

## Implemented

### Network / Transport

- ✅ **TLS termination** at nginx (TLS 1.2/1.3 only)
- ✅ **HSTS** with `preload` (1-year max-age, includeSubDomains)
- ✅ **Strong ciphers** — ECDHE only, AES-GCM + CHACHA20-POLY1305
- ✅ **TRUST_PROXY** for accurate IP behind nginx/cloudflare

### Application security headers

- ✅ **Helmet** with strict CSP in production
  - `default-src 'self'`
  - `script-src 'self'` (no inline except Tailwind style)
  - `object-src 'none'`
  - `frame-ancestors 'none'`
- ✅ **X-Content-Type-Options: nosniff**
- ✅ **X-Frame-Options: DENY**
- ✅ **Referrer-Policy: strict-origin-when-cross-origin**
- ✅ **Permissions-Policy** (camera/mic/geolocation only for self)

### Authentication & Authorization

- ✅ **JWT** with strong secret (preflight check refuses <32 chars or default values)
- ✅ **WebAuthn / passkeys** as primary auth
- ✅ **JWT issuer/audience** validation
- ✅ **@Public() decorator** for explicit allowlist of public routes
- ✅ **JWT expiry** — default 24h, configurable

### Input validation

- ✅ **Global ValidationPipe** with `whitelist`, `transform`, `forbidNonWhitelisted`
- ✅ **class-validator** DTOs on all POST/PUT/PATCH routes
- ✅ **Type coercion** via `enableImplicitConversion`

### Rate limiting

- ✅ **Layered**:
  - Nginx: 30 req/sec general, 5 req/sec auth, 100 req/sec global
  - Throttler (in-app): 10/sec, 100/10sec, 1000/hour
  - Per-route via `@Throttle()` decorator
- ✅ **429 with Retry-After**

### Body size limits

- ✅ **JSON**: 2MB default (configurable via `BODY_LIMIT`)
- ✅ **URL-encoded**: 2MB default
- ✅ **Raw media**: 100MB (for image/video uploads)
- ✅ **Connection timeouts**: 60s for read/send

### Error handling

- ✅ **Global exception filter** sanitizes 5xx in production
- ✅ **Stack traces hidden** in production responses
- ✅ **Request ID** in every error response (for support)
- ✅ **Sentry capture** for unhandled errors (PII-scrubbed)

### CORS

- ✅ **Allowlist only** (no wildcards in production — preflight check refuses `*`)
- ✅ **Credentials** opt-in
- ✅ **Exposed `X-Request-ID`** header

### Database

- ✅ **Connection pool** with max 20 connections
- ✅ **SSL to DB** in production
- ✅ **Migration fail-fast** on errors
- ✅ **SQL injection prevention** — parameterized queries via `pg` driver

### Logging / Observability

- ✅ **pino** structured JSON logs
- ✅ **PII redaction** (authorization, cookie, password, token)
- ✅ **Request ID** in every log line
- ✅ **Sentry error tracking** with PII scrub
- ✅ **Prometheus metrics** for monitoring

### Operational

- ✅ **Graceful shutdown** (SIGTERM/SIGINT)
- ✅ **Crash handlers** (`uncaughtException` exits, `unhandledRejection` logs)
- ✅ **Health probes** (K8s: live/ready/startup)
- ✅ **Memory leak detection** (degrades >1GB RSS, fails >1.5GB)
- ✅ **Non-root user** in Docker images

---

## Pending / TODO

### To add

- [ ] **CSP nonce** for inline scripts (currently using unsafe-inline for Tailwind)
- [ ] **Subresource Integrity** for static assets
- [ ] **CSRF tokens** for state-changing requests (currently relying on CORS)
- [ ] **Rate limit persistence** to Redis (currently in-memory, lost on restart)
- [ ] **DDoS protection** at edge (Cloudflare, AWS Shield)
- [ ] **Web Application Firewall** (ModSecurity, AWS WAF)
- [ ] **Audit log** for sensitive operations (login, password change, data export)
- [ ] **Penetration test** before launch
- [ ] **Bug bounty program** (recommended: HackerOne)
- [ ] **Security.txt** at `/.well-known/security.txt` (Next.js middleware provides this)

### GDPR / Privacy

- ✅ **GDPR export** endpoint (`/api/v1/gdpr/export`)
- ✅ **GDPR delete** endpoint (`/api/v1/gdpr/delete`)
- ⏳ Cookie consent banner (web)
- ⏳ Privacy policy page
- ⏳ Data Processing Agreement (DPA) template

---

## Threat Model

| Threat              | Mitigation                                               |
|---------------------|----------------------------------------------------------|
| DDoS                | nginx rate limiting + ThrottlerModule + edge WAF         |
| Brute force login   | 5 req/sec auth rate limit + WebAuthn (no password)       |
| XSS                 | CSP + helmet + input sanitization + React auto-escape    |
| CSRF                | SameSite cookies + custom header check + CORS           |
| SQL injection       | Parameterized queries + ORM-style helpers                |
| Path traversal      | Whitelisted routes + class-validator                      |
| Clickjacking        | X-Frame-Options: DENY + CSP frame-ancestors 'none'        |
| MIME sniffing       | X-Content-Type-Options: nosniff                          |
| Session hijacking   | HTTPS-only + HSTS + Secure cookies + short JWT expiry    |
| Token leakage       | JWT in `Authorization` header (not cookies) + PII redaction in logs |
| Mass assignment     | class-validator `whitelist` + `forbidNonWhitelisted`     |
| Memory DoS          | Body size limits + JSON parse limits + Throttler          |
| Slowloris           | nginx timeouts + body-parser limits                       |
| Information disclosure | Sanitized errors + no stack traces in prod + Sentry gating |
| Supply chain        | pnpm-lock + minimal deps + regular `npm audit` / `snyk`  |

---

## Security Contacts

- **Vulnerabilities**: `security@orbit.example`
- **PGP key**: (TODO — add public key fingerprint)
- **Response SLA**: 24h acknowledgement, 72h triage

---

## Audit Log

| Date       | What changed                                    |
|------------|--------------------------------------------------|
| 2026-06-23 | Initial hardening pass: helmet + throttler + sentry + global filter + request ID + K8s probes + Dockerfiles + nginx + docs |

---

Last updated: 2026-06-23