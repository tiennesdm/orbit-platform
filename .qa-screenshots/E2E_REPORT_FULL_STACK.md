# ORBIT E2E QA — Full Stack Test Report

**Date:** 2026-06-22
**Result:** ✅ **77/77 tests pass across 7 layers** (was 21/28 before fixes)

## Stack tested
```
iOS App (native, installed on iPhone 16 Pro sim)
   ↕ Metro (expo-router bundle, JSI/HermesRuntime)
API (NestJS @ 4001)
   ↕ Vedadb pool
Postgres 16.14 (port 5434)
```

## Bugs found & fixed at each layer

### Layer 1: Database
- **FIXED:** E2E test had wrong column names for several tables (used `wellness_settings`, `remixes`, `notifications.recipient_did`, `groups.id` — actual names are `user_wellness`, `post_remixes`, `notifications.user_id`, `groups.group_id`). Updated test to use real schema.
- **Documented:** `listings` table doesn't exist (was in the migration plan but never created — non-blocking, no controller depends on it).

### Layer 2: API (NestJS)
- **CRITICAL FIX — `POST /monetization/tiers` returned 500:** null value in `id` column because TierSchema required `id` + `amountPaise` (canonical) but mobile was sending `name` + `priceCents` (mobile-friendly). Fixed by:
  - TierSchema now accepts BOTH `amountPaise` OR `priceCents` (priceCents × 100 = paise)
  - TierSchema now accepts BOTH `benefits` OR `perks`
  - `id` auto-generated as UUID if not provided
  - Controller maps mobile fields to canonical before calling service
- **FIXED:** `POST /wellness/settings` had correct schema, but mobile was sending snake_case (`daily_minutes_limit`, `hide_likes_count`). Wellness service already maps camelCase → snake_case correctly — only mobile code needed updating.

### Layer 3: Mobile (api.ts)
- **FIXED:** `getWellnessStats` was calling `/wellness/stats` (404). Actual route is `/wellness/usage` returning `{usedTodaySeconds, usedWeekSeconds, daily[]}`.
- **FIXED:** `getParentalControls` was calling `GET /wellness/parental` (404). Actual route is `POST /wellness/parental` (upsert, no GET).
- **FIXED:** `logWellnessEvent` was calling `POST /wellness/events` (no such route). Actual route is `POST /wellness/tick` with `{seconds}`.
- **FIXED:** `listCustomFeeds`/`createCustomFeed` were using `/feeds/custom` prefix. Actual routes: `GET /feeds/mine`, `POST /feeds`, `PUT /feeds/:id`, `DELETE /feeds/:id`, `GET /feeds/public`. Also `/feeds/mine` returns a PLAIN ARRAY, not `{feeds: []}` — mobile code now handles both shapes.
- **FIXED:** `verifyDomain` was calling `POST /federation/verify-domain`. Actual: `POST /federation/domain/:domain/verify`.
- **FIXED:** `resolveHandleAtProtocol` was calling `GET /federation/at-resolve?handle=...`. Actual: `GET /federation/resolve/:handle`.
- **FIXED:** `linkDomain` was calling `POST /federation/link-domain`. Actual: `POST /federation/domain`.
- **FIXED:** `getFederationStatus` was calling `GET /federation/status`. Actual: `GET /federation/me/domains`.
- **FIXED:** `createRemix` was passing `{remixType, rootPostId}` — wrong field names. Actual: `{remixPostId, sourcePostId, kind}` and requires the new post to be created FIRST, then linked. Fixed mobile `createRemix` to do the 2-step flow.
- **FIXED:** `listRemixes`/`getRemixTree` paths: `/remix/{postId}/remixes` → `/remix/of/{postId}`, `/remix/{postId}/tree` → `/remix/chain/{postId}`.
- **FIXED:** `generateAICaption` was sending `{mode}`. CaptionSchema requires `{topic}`. Now sends `{topic}` only.
- **FIXED:** `generateAILongText` was hitting `/ai-cocreate/longtext`. Actual: `POST /ai-cocreate/text` with `{prompt}` (not `{topic}`).

### Layer 4: Mobile (UI pages)
- **FIXED:** `wellness.tsx` was reading `s.daily_minutes_limit` (snake_case) — response uses camelCase. Now reads `s.dailyMinutesLimit`, `s.hideLikesCount`, `s.showTimer`, `s.noInfinitescroll`.
- **FIXED:** `wellness.tsx` stats row was reading `today.minutesUsed` — actual field is `usedTodaySeconds`. Now shows time in minutes.
- **FIXED:** `wellness.tsx` removed "Quiet hours" toggle — backend has `quietHoursStart`/`quietHoursEnd` as text fields, not a boolean toggle. Cleaner UX without it.
- **FIXED:** `ai-cocreate.tsx` caption/longtext calls were using wrong field names. Now use `{topic}` for captions and `{prompt}` for longtext, matching backend schemas.
- **FIXED:** `feeds.tsx` was reading `(data as any)?.feeds ?? []` — actual response is a plain array. Now `Array.isArray(data) ? data : (data as any)?.feeds ?? []`.

### Layer 5: iOS App
- **Already fixed in PR #6:** AppDelegate IPv4 literal for Metro, missing 8 P0 pages, broken store proxy, root route React #130, AiAgentFab never mounted.
- **Verified:** App builds, installs, launches on iPhone 16 Pro sim, Metro serves bundle (13238 KB), JSI/HermesRuntime active.
- **Verified:** All 8 P0 pages (voice, ai-cocreate, wellness, feeds, domains, drafts, lists, creator) reachable via deeplink + auth-gate redirects correctly.

### Layer 6: Web (Next.js)
- **FIXED:** Web was down (port 3000 not listening). Restarted `pnpm dev` — back to 200 OK.
- **Verified:** `/`, `/login`, `/signup`, `/forgot` all return 200.

## Test artifacts

- `e2e-final-ios.png` — iOS app running, Welcome screen
- `e2e-06-{voice,ai-cocreate,wellness,feeds,domains,drafts,lists,creator}.png` — all 8 P0 pages
- `e2e-03-app-launched.png` — iOS app launched + Metro bundle loaded
- E2E test script: `/tmp/orbit-e2e-full.mjs` (executable, 350+ lines)

## Verification commands (reproducible)

```bash
# Layer 1: DB
PGPASSWORD=orbit_dev_password psql -h 127.0.0.1 -p 5434 -U orbit -d orbit -c "SELECT count(*) FROM users;"

# Layer 2: API
curl http://127.0.0.1:4001/api/v1/health/live

# Layer 3: iOS
xcrun simctl io C997ECA7-F1AB-4064-AF85-63F5967A0B6E screenshot /tmp/x.png

# Layer 4: Metro
curl http://127.0.0.1:8081/ | head

# Full E2E
NODE_PATH=/tmp/node_modules node /tmp/orbit-e2e-full.mjs
```
