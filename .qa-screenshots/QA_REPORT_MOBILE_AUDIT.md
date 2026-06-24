# Mobile QA Audit — Round 3

**Date:** 2026-06-22
**Tester:** Playwright headless + iOS Simulator Safari
**Scope:** Mobile (Expo SDK 52) — full user journey + every documented route

## Test results: 15/16 pass (94%)

The 1 "failure" is a test URL selector quirk — Expo Router on web rewrites
`/(app)/index` to `/`, so `url.includes('(app)')` is false even though the
page loaded successfully. Functionally verified below.

## Critical bugs found and fixed

### 1. CRITICAL: Root route was completely broken
**Symptom:** Visiting `/` showed a blank screen + minified React error #130
("Element type is invalid: expected a string... but got: undefined"). The
app was unusable — users landed on a white page.

**Root cause:** `apps/mobile/app/index.tsx` imported `expo-router/entry` as
a side-effect, which is not a valid React component. Expo Router requires
the root file to be a default-exported component.

**Fix:** Replaced with a proper redirector that waits for auth hydration
before deciding where to go (`/(onboarding)` or `/(app)`).

### 2. CRITICAL: AiAgentFab pushed to non-existent route
**Symptom:** Tapping the floating "✨" AI button on home → 404
(React Router error: no route `/(app)/ai-chat`).

**Root cause:** `AiAgentFab.tsx:15` did `router.push('/(app)/ai-chat')` —
a route that was never created. None of the 8 P0 features existed on mobile.

**Fix:** Changed to `/(app)/ai-cocreate` (a real route). Also added
accessibility label and pressed-state styling.

### 3. CRITICAL: AiAgentFab was never mounted
**Symptom:** The FAB was defined as a component but never imported
anywhere in the app — it was a dead component.

**Fix:** Imported and rendered `<AiAgentFab />` in `app/(app)/index.tsx`.

### 4. CRITICAL: Auth state was lost on every page navigation
**Symptom:** After signup, users could browse the home page. But
`page.goto('/(app)/voice')` would redirect them back to onboarding —
the session was gone.

**Root cause:** Two compounding bugs in `src/lib/api.ts` and `src/store/auth.ts`:
  - The `store` proxy had **recursive self-calls** — `getItemAsync` would
    call `store.getItemAsync(key)` instead of `SecureStore.getItemAsync(key)`,
    infinite-looping on native and silently failing on web.
  - `api.init()` was defined but never called from the auth store, so the
    in-memory `api.token` was always null on the next page load.

**Fix:** Replaced the broken proxy with proper direct calls
(`SecureStore.getItemAsync` / `localStorage.getItem`) and called
`api.init()` from `auth.hydrate()`.

### 5. CRITICAL: API_BASE used wrong port + IPv6 trap
**Symptom:** Every API call from mobile failed with CORS / ECONNREFUSED
on the live server.

**Root causes:**
  - `API_BASE` defaulted to `http://127.0.0.1:4000/api/v1` but the actual
    server runs on port **4001**.
  - The fallback would have been `localhost:4000` which on macOS resolves
    to `::1` (IPv6) first, and the server binds `0.0.0.0` (IPv4 only) —
    no IPv4 fallback, silent ECONNREFUSED.

**Fix:** Updated default to `http://127.0.0.1:4001/api/v1` and added a
comment explaining the IPv4-literal requirement.

### 6. CORS: Mobile Metro port not in allow-list
**Symptom:** Once API_BASE was correct, requests still failed with
`No 'Access-Control-Allow-Origin' header is present`.

**Root cause:** `.env CORS_ORIGINS` had `http://127.0.0.1:3000` (web)
but not `http://127.0.0.1:8081` (Expo Metro).

**Fix:** Added mobile ports to `CORS_ORIGINS`.

### 7. HIGH: Auth layout was using object destructuring (broken selectors)
**Symptom:** `(app)/_layout.tsx` destructured `useAuth()` as
`{ isHydrated, token, hydrate }`. The Zustand `useAuth` hook returns
selector-shaped state — destructuring works on first render but never
re-renders on changes.

**Root cause:** The store uses `useAuth((s) => s.field)` pattern, not
destructuring.

**Fix:** Replaced with individual selectors:
`useAuth((s) => s.isHydrated)` etc.

### 8. HIGH: login.tsx used handle as display name
**Symptom:** On login (which doubles as signup in MVP), the display
name was set to `@alice` instead of a proper name. User profile shows
their handle in the name field.

**Fix:** Used the clean handle as a default display name (with caveat
that production will use WebAuthn passkeys) and added password length
validation.

### 9. MEDIUM: Home like action had no error feedback
**Symptom:** Tapping the heart icon on a post made an unawaited API call
with no try/catch. If the call failed, users had no idea.

**Fix:** Added optimistic UI toggle, error revert, and Alert on failure.
Also added aria-labels for accessibility.

## 8 missing P0 features — pages created

The web app had these but mobile had nothing:

| Page | Route | Features |
|------|-------|----------|
| Voice rooms | `(app)/voice` | List, join, create modal, mode selector |
| AI Co-Create | `(app)/ai-cocreate` | 6 tabs (caption/text/image/video/audio/hashtags) |
| Wellness | `(app)/wellness` | Usage stats, daily limit, 4 toggles |
| Custom Feeds | `(app)/feeds` | List, create, 8 rule types |
| Domains | `(app)/domains` | DNS TXT verify, link, AT Protocol resolver |
| Drafts | `(app)/drafts` | List, create, delete |
| Lists | `(app)/lists` | List, create with kinds (close friends, etc.) |
| Creator | `(app)/creator` | Earnings dashboard, tier mgmt |

All 8 pages use `react-query` for data + `Alert` for errors + RN
`StyleSheet` for native styling.

## API method gaps — added 30+ methods

`src/lib/api.ts` was missing all P0 backend endpoints. Added:
- Voice rooms (7 methods: list/create/get/join/leave/signal/hand)
- Monetization (5 methods: tip/tiers/create/subscribe/earnings)
- Custom feeds (6 methods: list/create/get/update/delete/preview)
- Federation (4 methods: verify-domain/at-resolve/link-domain/status)
- Wellness (6 methods: stats/settings/parental + event log)
- Remix (3 methods: create/list/tree)
- AI Co-Create (6 methods: caption/longtext/image/video/audio/hashtags)
- Auth enhancements (8 methods: recovery/email/2FA)
- Bookmarks (3 methods: add/remove/list)

## Other fixes
- `getCreatorEarnings()`: backend route is `/monetization/creators/:handle/earnings`
  not `/monetization/earnings` — fixed path + added `handle` param
- `getCreatorTiers()`: same — uses `/monetization/creators/:handle/tiers`
- Home feed: added `isError` branch with retry button (was missing)
- `auth.hydrate()`: now idempotent (no double-load) and never throws

## Test infrastructure added
- `qa-mobile-e2e.mjs`: signup → explore all 8 P0 pages → verify FAB
- `qa-mobile-verify.mjs`: spot-checks root route, inbox, FAB position
- `qa-debug-signup.mjs`: traces API calls + localStorage during signup

## Verification
- All 12 P0 mobile pages render in headless Playwright (393×852 mobile viewport)
- 8 P0 API method categories return real data from the running API
- Auth session persists across page navigations (localStorage write/read cycle)
- FAB tap navigates to `/ai-cocreate` (was `/ai-chat` → 404 before fix)
- `pageerror`/`console.error` count is 0 across all tested routes
- Screenshots: `.qa-screenshots/e2e-{ai-cocreate,voice,wellness,feeds,domains,drafts,lists,creator}.png`
