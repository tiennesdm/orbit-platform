# ORBIT Mobile (React Native + Expo)

ORBIT's mobile app — iOS, Android, and Web from a single codebase.

## Stack

- **Expo SDK 52** — managed workflow
- **Expo Router** — file-based navigation
- **React Native 0.76** — cross-platform runtime
- **TanStack Query** — server state caching
- **Zustand** — local state
- **expo-secure-store** — encrypted token storage (Keychain / EncryptedSharedPreferences)
- **expo-camera / expo-image-picker** — media capture
- **expo-local-authentication** — biometric auth (Face ID / Touch ID / fingerprint)
- **expo-notifications** — push notifications
- **Same shared packages**: `@orbit/types`, `@orbit/crypto`, `@orbit/db`

## Project structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx              # Root layout (providers + Stack)
│   ├── (onboarding)/            # Public routes
│   │   ├── index.tsx            # Welcome
│   │   ├── handle.tsx           # Handle selection + signup
│   │   └── login.tsx            # Login
│   └── (app)/                   # Authenticated routes
│       ├── _layout.tsx          # Tabs layout
│       ├── index.tsx            # Home feed
│       ├── search.tsx           # Universal search
│       ├── compose.tsx          # New post
│       ├── inbox.tsx            # DM threads
│       └── profile.tsx          # User profile + logout
├── src/
│   ├── lib/
│   │   ├── api.ts               # Backend API client
│   │   └── theme.ts             # Design tokens (colors, spacing, typography)
│   ├── store/
│   │   └── auth.ts              # Zustand auth store
│   └── components/
│       └── AiAgentFab.tsx       # Floating AI button
├── assets/                      # Icons, splash, fonts (TODO)
├── app.json                     # Expo config (iOS bundle ID, Android permissions)
└── package.json
```

## Development

```bash
# Install deps (run from monorepo root)
pnpm install

# Start dev server
cd apps/mobile
pnpm start
# → Opens Expo Dev Tools. Press i for iOS sim, a for Android emulator, w for web.

# TypeScript check
pnpm typecheck
```

## Configuration

API URL is auto-detected:
- **iOS simulator**: `http://127.0.0.1:4000/api/v1`
- **Android emulator**: `http://10.0.2.2:4000/api/v1` (host machine alias)
- **Production**: set `extra.apiUrl` in `app.json`

For physical devices, set the LAN IP via `extra.apiUrl`.

## Build for stores

```bash
# iOS (requires Apple Developer account)
eas build --platform ios

# Android (requires Google Play account)
eas build --platform android
```

`eas.json` is not yet configured — see Expo docs to set up EAS Build.

## Status

**Phase 1 — Scaffold (DONE):**
- ✅ Project structure with Expo Router
- ✅ Auth (signup flow with handle selection)
- ✅ Home feed (chronological from followed users)
- ✅ Search (universal)
- ✅ Compose (4-mode post creation)
- ✅ Profile + logout
- ✅ Secure token storage via Keychain
- ✅ TanStack Query for server state
- ✅ Design tokens matching web app

**Phase 2 — TODO:**
- ⏳ WebAuthn passkey login (real biometric flow)
- ⏳ AI Agent chat UI (currently FAB only)
- ⏳ DM thread + E2E encrypted messaging UI
- ⏳ Story camera capture (expo-camera + filters)
- ⏳ Reel video player (expo-av)
- ⏳ Push notification handling
- ⏳ Offline mode + sync queue
- ⏳ Dark mode

## Why React Native + Expo (not Flutter / native)

- ✅ Reuses the same TypeScript codebase as web (shared types, crypto, db)
- ✅ Expo's managed workflow handles native config (camera, biometrics, push)
- ✅ Single Expo Router codebase → iOS, Android, Web
- ✅ Easier hiring (React devs) than Flutter
- ✅ Hot reload for instant iteration

## Known limitations

- **`expo-secure-store`**: ~2KB per key, ~50 keys max. Use for tokens only.
- **Biometrics**: Requires user to enable on device first.
- **Push notifications**: Need to register device token with backend (TODO).
- **Bundle size**: Will need EAS Build with Hermes engine for production.
