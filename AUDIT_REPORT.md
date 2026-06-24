# ORBIT — Code Audit Report

**Date**: 2026-06-24
**Scope**: API (NestJS) + Web (Next.js) + Mobile (Expo) + DB + production hardening
**Method**: Static analysis + live API testing + DB inspection

## Summary

| Severity | Count | Description                                |
|----------|-------|--------------------------------------------|
| CRITICAL | 5     | SQL injection, double-init, dead routes    |
| HIGH     | 9     | Stubs masquerading as features, type bugs  |
| MEDIUM   | 8     | Auth gaps, UX issues, missing tests        |
| LOW      | 6     | Dead code, unused imports, polish          |
| **Total**| **28**|                                            |

---

## CRITICAL (must fix before prod)

### C-1: SQL injection via `OrbitCache.set()` (`packages/db/src/index.ts:187`)

```ts
await this.pool.query(
  `INSERT INTO orbit_cache ... NOW() + INTERVAL '${ttl} seconds', $3`,
  [key, JSON.stringify(value), ttl]
);
```

`ttl` is interpolated into SQL string. If `ttlSeconds` ever comes from user input (currently passed as integer from callers, but no validation) → SQL injection.

**Reproducer**: any path where `cache.set(key, value, { ttlSeconds: <user_input> })` → `'5; DROP TABLE users; --'` runs.

**Fix**: use `make_interval(secs => $3)` (Postgres function, parameterised).

---

### C-2: SQL injection via `OrbitCache.incr()` (`packages/db/src/index.ts:205`)

Same pattern, `INTERVAL '${ttlSeconds} seconds'`. Same fix.

---

### C-3: SQL injection via custom-feeds rule (`apps/api/src/modules/custom-feeds/custom-feeds.service.ts:137`)

```ts
case 'time':
  // value = 'hour' | 'day' | 'week'
  conds.push(`p.created_at > NOW() - INTERVAL '1 ${rule.value}'`);
```

The Zod schema is `value: z.any()` (no validation). Attacker submits:

```json
{ "rules": [{ "type": "time", "value": "day'; DROP TABLE users; --" }] }
```

This becomes SQL: `p.created_at > NOW() - INTERVAL '1 day'; DROP TABLE users; --'`

**Impact**: Full DB compromise via authenticated endpoint.

**Fix**: validate `rule.value` against enum `'hour' | 'day' | 'week'`.

---

### C-4: SQL injection via ai-agent muteUser (`apps/api/src/modules/ai-agent/ai-agent-tools.service.ts:193`)

```ts
private async muteUser(userId: string, targetId: string, durationHours = 24) {
  await this.db.query(
    `INSERT INTO orbit_cache ... NOW() + INTERVAL '${durationHours} hours', $3)`,
    [`mute:${userId}:${targetId}`, JSON.stringify({ muted: true }), durationHours * 3600]
  );
}
```

`durationHours` is user-controllable via AI agent tool call. AI agent can be invoked by anyone authenticated.

**Fix**: cast `durationHours::int` and validate `>0 && <8760` (max 1 year).

---

### C-5: Double Sentry initialization

Two Sentry init paths exist and BOTH run:

1. **Existing**: `apps/api/src/common/observability/sentry.service.ts` — initialized via `ObservabilityModule.onModuleInit()` (runs on app boot)
2. **New (mine, in PR #8)**: `apps/api/src/common/observability/sentry.ts` — initialized via `initSentry()` called from `main.ts` (also runs on app boot)

Either:
- Sentry.init called twice with conflicting options → warning/error
- Or one is silently no-op and we don't get the integrations from the other

Plus my new `GlobalExceptionFilter` tries to capture via `(globalThis as any).Sentry` — **but `globalThis.Sentry` was never set**. So the filter NEVER captures exceptions to Sentry.

**Fix**:
- Pick ONE init path (the existing service in module is better — DI)
- Delete my new `sentry.ts`
- Update `GlobalExceptionFilter` to inject `SentryService` instead of checking global

---

## HIGH (fix before public launch)

### H-1: `post.like()` and `reel.like()` don't track who liked — no unlike

`apps/api/src/modules/post/post.service.ts:174-184`:

```ts
async like(authorId, postId, likerDid) {
  // Insert into likes table (would need schema for this, simplified)
  await this.db.query(`UPDATE posts SET like_count = like_count + 1 ...`);
}
```

- **No `likes` table exists** in DB (verified via `\dt` — 40 tables, no `likes`)
- **No `unlike()` method** exists
- Calling `POST /posts/:authorId/:postId/like` repeatedly → counter goes +1, +1, +1 forever
- UI cannot show "liked by you" or "X people liked this" — only the count

This is **fake success**: API returns `{success: true}` but doesn't actually track likes.

**Fix**: add `likes(post_id, liker_did, created_at)` table + migration, implement proper toggle.

Per Shubham's preference: "honest not implemented > fake numbers" — the current code is the WORST of both: fake numbers AND claim success.

---

### H-2: AI agent stubs return fake success

`apps/api/src/modules/ai-agent/ai-agent-tools.service.ts`:

| Tool                        | Status                                                  |
|-----------------------------|---------------------------------------------------------|
| `schedule_post`             | Returns `{success: true, message: 'Post scheduled (implementation pending)'}` — **no actual scheduling** |
| `get_usage_stats`           | Returns placeholder — **no aggregation**              |
| `cross_post_instagram`      | Returns `{success: true, message: 'Cross-posted to Instagram (requires linked account)'}` — **fake** |
| `mute_user`                 | Does work (sets cache) — see C-4 for SQL injection     |

AI agent tools that claim success without implementation = **fake numbers pattern**.

**Fix**: Either implement or return `{success: false, reason: 'not_implemented'}`.

---

### H-3: `post.delete` doesn't validate ownership

`apps/api/src/modules/post/post.controller.ts`:

```ts
@Delete(':authorId/:postId')
async delete(@CurrentUser('did') did, @Param('authorId') authorId, @Param('postId') postId) {
  await this.posts.delete(authorId, postId);
}
```

Need to check `post.service.delete` — does it verify `did === authorId`? If not, any authenticated user can delete any post by knowing the author's DID + post ID.

---

### H-4: `apps/web/src/lib/api.ts` uses `localhost:4000` — `::1` ECONNREFUSED trap

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
```

- `localhost` → resolves to `::1` (IPv6) first on macOS
- API binds `0.0.0.0` (IPv4 only)
- → Silent ECONNREFUSED with no fallback
- Also wrong port (should be `4001`, not `4000`)

This is the SAME bug pattern fixed for mobile in PR #6, but **not fixed for web**.

**Fix**: `http://127.0.0.1:4001/api/v1`.

---

### H-5: `feat/production-hardening` branch reverted the mobile port fix

When I rebased onto `origin/main`, I inherited the OLD mobile/api.ts (port 4000) because PR #6 (port 4001 fix) hasn't been merged yet.

So when PR #8 merges, it'll REVERT the port fix that PR #6 introduced.

**Fix**: include the mobile port fix in PR #8 OR rebase onto PR #6's branch OR merge PR #6 first.

---

### H-6: WebAuthn returns empty options

```bash
curl -X POST /api/v1/identity/register/options -d '{"handle":"x","displayName":"y"}'
→ {"challengeId":"...","options":{}}
```

The `options: {}` is empty — no challenge, no rpId, no user info. WebAuthn flow will fail in browser because the client expects real options.

**Fix**: trace `generateRegistrationOptions` return value — it should populate `challenge`, `rp`, `user`, etc.

---

### H-7: `GlobalExceptionFilter` reads request ID but it's null sometimes

In NestJS, `req.id` is set by our `requestIdMiddleware` — but middleware runs after Nest parses the route. If an exception happens BEFORE middleware (e.g., in route resolver), `req.id` is undefined → `requestId: 'unknown'`.

Filter gracefully handles this (returns 'unknown') — but it's a UX miss for early errors.

---

### H-8: External `fetch()` calls have no timeout

| File | Line | Issue |
|------|------|-------|
| `federation/federation.service.ts:52` | `fetch(plc.directory)` | No timeout — can hang forever |
| `search/embeddings.service.ts:63` | `fetch(openai.com/v1/embeddings)` | No timeout — can hang forever |
| `ai-agent/ai-agent.service.ts:68, 285` | HTTP via `http.post` | Has 30s timeout ✓ |

**Impact**: one slow external API = hung request thread. Under load, exhausts request slots.

**Fix**: wrap in `AbortController` with 5-10s timeout.

---

### H-9: Production hardening code conflicts with existing observability module

My new `sentry.ts`, `request-id.middleware.ts`, `global-exception.filter.ts` are dropped alongside the existing `sentry.service.ts` (already a Nest provider). The existing observability module has:

- `MetricsService` — wraps `prom-client`
- `TracingService` — exists
- `SentryService` — has `init()`, `captureException()`, `setUser()`
- `MetricsController` — exposes `/metrics` (already wired)

My new files duplicate this functionality.

**Fix**: migrate my logic INTO the existing observability module's classes. Don't create parallel implementations.

---

## MEDIUM

### M-1: 9 controllers lack explicit `@UseGuards` — relies on global guard

Controllers without `@UseGuards`:
- `dm`, `feed`, `group`, `marketplace`, `moderation`, `notification`, `post`, `reel`, `story`

These work because `APP_GUARD: JwtAuthGuard` is global. BUT — this means:
- `/feed/home`, `/feed/digest` require auth (probably should be public for anonymous browsing)
- `/marketplace` search requires auth (should be public)
- `/posts` GET requires auth (should be public for reading)

**Risk**: even if guard is global, it makes the API unfriendly for crawlers/anonymous users.

---

### M-2: Throttler may not be effective in current setup

The ThrottlerGuard IS wired globally in my new code (verified), but:
- Limit is 10 req/sec — easy to hit for legitimate clients (mobile refreshes)
- Auth routes don't have stricter per-route `@Throttle()` decorators
- No per-IP throttling in multi-tenant scenarios

**Fix**: add `@SkipThrottle()` to health endpoints, `@Throttle({ short: { limit: 3, ttl: 1000 } })` to login/signup.

---

### M-3: Federation external lookup has no caching TTL

`federation.service.ts:52`: every `resolveHandle()` call hits `plc.directory` if not cached. No explicit TTL on cache.set call. Need to check if it caches with reasonable TTL.

---

### M-4: GDPR delete doesn't cascade

`gdpr.service.ts` — when user requests delete, it deletes from `users`, `posts`, etc. but what about:
- `notifications` (other users' notifications mentioning them)
- `media` (uploaded content)
- `follows` (as follower or followee)
- `subscriptions`, `tips`, `messages` (history)

Need to verify cascade or surface data leakage.

---

### M-5: Migration runner has silent fallback

`main.ts:83-86`:

```ts
const migrationsDir = candidates.find((p) => existsSync(p));
if (!migrationsDir) {
  logger.warn({ tried: candidates }, 'migrations dir not found, skipping auto-migration');
  return;
}
```

If `db/migrations` is missing in production, the API starts with NO migrations applied. Silent skip → schema drift across instances.

**Fix**: in production, `process.exit(1)` if migrations dir missing.

---

### M-6: Notifications.target_type has weird enum coercion

API endpoint `POST /moderation/report` with `targetType: 'post'` → DB stores `target_type=1`. Manual SQL with `'post'::smallint` → ERROR.

There's hidden coercion somewhere (pg-driver? vedadb middleware?). Result:
- DB values are unpredictable (depends on some string-to-int mapping)
- Reports querying by `target_type=2` ("user") works for what the API inserts, but if anyone runs raw SQL with strings, it fails
- Schema documentation says `smallint` but data semantics depend on undocumented map

---

### M-7: Image upload via `local-upload` saves to filesystem

`media.controller.ts:@Post('local-upload')` — saves to local disk path. In Kubernetes (multi-replica), file uploads go to one pod, requests to another pod fail. No shared volume mentioned in `docker-compose.prod.yml`.

---

### M-8: Reel/story like uses wrong target_type

`reel/reel.service.ts:like()` inserts notification with `target_type=1` ("post"). Should be 3 or similar ("reel"). This breaks the notifications JOIN with posts.

---

## LOW

### L-1: Unused imports in main.ts

```ts
import { HttpException, HttpStatus } from '@nestjs/common';  // unused
import { randomUUID } from 'node:crypto';                     // unused
import { statSync } from 'node:fs';                           // unused
```

---

### L-2: Dynamic import in runMigrations

`main.ts:92`:

```ts
const { readdirSync } = await import('node:fs');
```

`readFileSync, existsSync` are already imported at top. Inconsistent — either all top-level or all dynamic.

---

### L-3: console.log/error in 30+ places

Production code should use the logger. Current code leaks request/response bodies to console in dev (fine) but can leak to stdout in prod.

---

### L-4: Next.js middleware doesn't include auth routes that aren't under /login

`apps/web/src/middleware.ts:95-99`: rate limiting checks `/login`, `/signup`, `/forgot`, but NOT `/auth/recovery/...` (used by web forgot page). Auth recovery endpoints unprotected.

---

### L-5: Next.js middleware security.txt has hardcoded email

```ts
`Contact: mailto:security@orbit.example`
```

`orbit.example` is a placeholder domain, not a real address. Responsible disclosure will fail.

---

### L-6: `pin()` default position undefined → NULL pin_order

`custom-feeds.service.ts:pin()` — already fixed in prior commit per memory, but worth re-verifying post-rebase.

---

## Functional Issues Summary

### Routes that claim success but don't do anything

| Endpoint                              | Actual behavior                          |
|---------------------------------------|------------------------------------------|
| `POST /posts/:a/:p/like`              | Counter +1, no who-liked tracking        |
| `POST /reels/:a/:r/like`              | Same + wrong notification target_type    |
| `POST /posts/:a/:p/view`              | Counter +1, no view tracking             |
| `POST /ai-agent/tools schedule_post`  | Returns success, doesn't schedule        |
| `POST /ai-agent/tools cross_post`     | Returns success, doesn't cross-post      |
| `GET /ai-agent/tools get_usage_stats` | Returns placeholder                      |

### Routes missing implementation

| Route                                  | Status                                    |
|----------------------------------------|-------------------------------------------|
| `POST /posts/:a/:p/unlike`             | **Missing entirely** — no unlike endpoint |
| `POST /reels/:a/:r/unlike`             | **Missing entirely**                      |
| `GET /posts/liked-by-me`               | **Missing** — can't show "posts I liked"  |
| `GET /users/:handle/liked`             | **Missing**                               |
| `POST /notifications/read-all`         | Probably exists, untested                 |

### Routes that look public but require auth

- `GET /feed/home`, `GET /feed/digest` — should probably be public for SEO/crawlers
- `GET /marketplace` (search) — should be public
- `GET /posts` (list) — should be public
- `GET /reels/foryou` — should be public for shareable links
- `GET /story/feed` — should be public
- `GET /groups`, `GET /groups/:id` — public groups should be browseable

---

## Hardcoded secrets/placeholders

| File                                          | Value                              |
|-----------------------------------------------|------------------------------------|
| `apps/web/src/middleware.ts:132`             | `security@orbit.example`           |
| `apps/web/next.config.js`                    | `cdn.orbit.com`                    |
| `apps/api/src/main.ts` (defaults)            | `localhost:4000`, `localhost:3000` |
| `apps/api/src/modules/identity/webauthn.service.ts` | `localhost` defaults       |
| `apps/api/src/modules/ai-agent/ai-agent.service.ts` | `localhost:8000` defaults |

No real secrets found. All defaults are env-overridable. ✓

---

## What was missed by prior audits

1. **SQL injection in custom-feeds rule values** — prior audits focused on schema mismatches but missed SQL injection in `rule.value`
2. **SQL injection in OrbitCache** — `INTERVAL '${ttl}'` pattern (twice)
3. **Double Sentry init** — new sentry.ts coexists with sentry.service.ts
4. **Web API base localhost:4000** — IPv4 trap never fixed for web (only mobile)
5. **AI agent tools returning fake success** — `schedulePost`, `getUsageStats`, `crossPostInstagram`
6. **No tracking of who liked** — `post.like()` is increment-only, no likes table
7. **External fetch without timeout** — federation + embeddings
8. **PR #8 reverts PR #6's port fix** — rebase trap

---

## Recommended fix priority

1. **C-1, C-2, C-3, C-4**: SQL injections — fix today, add regression test
2. **C-5**: Pick one Sentry init path, delete duplicate
3. **H-4, H-5**: Web api base port + production-hardening branch revert
4. **H-1, H-2**: Real like tracking + honest AI agent stubs
5. **H-6, H-8, H-9**: WebAuthn options + fetch timeouts + observability consolidation
6. **M-1, M-2**: Public route audit + throttler tuning
7. **M-5, M-6, M-8**: Migration runner fail-fast + enum coercion investigation + reel notification target_type

---

Last updated: 2026-06-24
Audited by: Mavis (static analysis + live API testing + DB inspection)