# ORBIT Mobile (Expo React Native)

The mobile companion to ORBIT — runs on iOS, Android, and Web (via react-native-web).

## What's included (Phase 1)

| Screen | Description |
|---|---|
| `index` (Home) | Chronological feed, refresh |
| `discover` | Universal search w/ tabs + trending + suggestions |
| `compose` | 4-mode post (intimate/public/visual/community) + image upload |
| `inbox` | E2E-encrypted DM threads |
| `inbox/[threadId]` | DM thread with bubble UI + read receipts |
| `reels` | TikTok-style vertical video feed |
| `profile` | Avatar, settings, marketplace, groups, stories shortcuts |
| `settings` | 6 sub-sections (profile, AI agent, privacy, safety, notifications, GDPR) |
| `marketplace` | 2-col grid + categories + new listing composer |
| `groups` | Public/private/invite + create flow |
| `stories` | 24h ephemeral + composer |

## Run

```bash
# API on 4001, web on 8081
cd ../../apps/api && pnpm dev:prod   # or pnpm dev
cd apps/mobile
pnpm web                              # web preview
pnpm ios                              # iOS simulator (requires Xcode)
pnpm android                          # Android emulator
```

## API endpoint

Default `http://127.0.0.1:4001/api/v1` (configurable via `app.json` `extra.apiUrl`).

Use `127.0.0.1` not `localhost` — on some macOS setups `localhost` resolves to IPv6 `::1` first and IPv4 fails.

## Web fallback

`expo-secure-store` doesn't work on web. `src/store/auth.ts` and `src/lib/api.ts` use `localStorage` when `Platform.OS === 'web'`. The `expo-av` Video component also gracefully degrades to a poster emoji on web (real <video> needs a wrap div with `width:100%; height:100%`).

## Auth

Web: `localStorage` (`orbit.auth.token`, `orbit.auth.refresh`, `orbit.auth.user`).
iOS/Android: `expo-secure-store` (Keychain / EncryptedSharedPreferences).

## E2E

```bash
node /tmp/shot-mobile.mjs   # 10 mobile screenshots via Playwright (iPhone 13 viewport)
```
