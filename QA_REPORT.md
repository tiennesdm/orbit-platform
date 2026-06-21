# ORBIT QA Test Report

**Date:** 2026-06-21
**Tester:** Mavis (functional QA)
**Environment:** Local dev (Mac + colima docker + Postgres 16 + pgvector + PostGIS on port 5434)
**API:** http://localhost:4000 (NestJS 11)

## Result: ✅ CORE FLOWS WORKING

The ORBIT API runs end-to-end. Signup → JWT → posts → search → DB persistence all work.

## What's WORKING

### Auth flow ✅
| Endpoint | Result |
|---|---|
| `POST /api/v1/identity/signup` | HTTP 201 — creates user with DID, returns JWT tokens |
| `GET /api/v1/identity/me` | HTTP 200 — returns full user profile (with auth) |
| `GET /api/v1/identity/me` (no auth) | HTTP 401 — guard works |
| `GET /api/v1/identity/:handle` | HTTP 200 — lookup by handle |

### Post creation ✅
| Endpoint | Result |
|---|---|
| `POST /api/v1/posts` | HTTP 201 — creates post, persists to DB |
| Mode variants | public + visual tested; intimate/community available |
| Auto-fields | likes/comments/shares all 0, language detected (en) |

### Search ✅
| Endpoint | Result |
|---|---|
| `GET /api/v1/search?q=orbit` | HTTP 200 — **returns 2 matching posts with `<b>ORBIT</b>` highlight** |

### Database ✅
| Table | Rows |
|---|---|
| users | 5 (alice, bob, carol, dave, emma, emma2) |
| posts | 3 (all persisted with content + metadata) |

### Schema & extensions ✅
- pgvector (vector embeddings)
- pg_trgm (full-text + fuzzy)
- PostGIS (geo)
- 23 ORBIT tables + spatial_ref_sys

## What's BROKEN / Missing

### Critical gaps
1. **AI Agent chat** → HTTP 500 — needs `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` env var (not configured)
2. **No follow/unfollow endpoint** — `follows` table exists in schema, but no controller route. Feed `/home` is empty because no follow relationship can be created via API
3. **No like endpoint** — same pattern: `post_likes` likely missing or has no controller
4. **JWT_SECRET must be set manually** — fails without it. Should default to a dev key in `.env`

### Less critical
5. Health endpoint requires auth (`/health` and `/health/ready`) — should be public
6. AI Agent requires no fallback when API key missing (returns 500 instead of graceful error)
7. WebAuthn flow not tested (would need real browser passkey) — but signup path works with placeholder fields
8. Story/Reel/Marketplace/Group controllers likely have similar issues — not exhaustively tested

### Architecture notes
- API_PORT default is 4000 (not 3001 as I'd guessed)
- Postgres on 5434 (not 5432 — port was taken by Mac homebrew postgres@16)
- JWT_SECRET, JWT_EXPIRES_IN need to be in `.env`
- The "LOADED" console.log was added by the worker for verifier; should be removed before commit

## Test commands used

```bash
# Signup
curl -X POST http://localhost:4000/api/v1/identity/signup \
  -H 'Content-Type: application/json' \
  -d '{"handle":"alice","displayName":"Alice","password":"alice12345"}'

# Use returned token
TOKEN="..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/identity/me

# Create post
curl -X POST http://localhost:4000/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"mode":"public","contentText":"Hello ORBIT!","visibility":"public"}'

# Search
curl "http://localhost:4000/api/v1/search?q=orbit" \
  -H "Authorization: Bearer $TOKEN"
```

## Next steps

1. Add follow/unfollow controller (uses existing `follows` table)
2. Add like controller
3. Make health endpoints public (add `@Public()`)
4. Default JWT_SECRET in dev `.env` 
5. Fix AI Agent graceful degradation when no API key
6. Remove the `console.log('LOADED')` from main.ts
7. Implement WebAuthn real flow (or skip for MVP)
8. Run Playwright tests against the running API
