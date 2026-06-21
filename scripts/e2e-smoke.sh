#!/bin/bash
# ORBIT E2E smoke test — runs against running API
# Usage: ./scripts/e2e-smoke.sh [API_URL]
# Default: http://127.0.0.1:4000/api/v1

set -e

API="${1:-http://127.0.0.1:4000/api/v1}"
SUFFIX=$(date +%s)
HANDLE_USER="e2e_user_${SUFFIX}"
HANDLE_TARGET="e2e_target_${SUFFIX}"

PASS=0
FAIL=0

check() {
  local desc="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $desc: $actual"
    PASS=$((PASS+1))
  else
    echo "  ❌ $desc: got $actual, expected $expected"
    FAIL=$((FAIL+1))
  fi
}

echo "🧪 ORBIT E2E Smoke Test"
echo "   Target: $API"
echo ""

# ---- 1. Public endpoints ----
echo "1. Public endpoints"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/health/live")
check "GET /health/live" "$HEALTH" "200"

# ---- 2. Signup + Auth ----
echo ""
echo "2. Signup + Auth"
SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/identity/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"handle\":\"$HANDLE_USER\",\"displayName\":\"E2E User\",\"password\":\"e2e12345\"}")
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | /usr/bin/tail -1)
SIGNUP_BODY=$(echo "$SIGNUP_RESP" | /usr/bin/sed '$d')
check "POST /identity/signup" "$SIGNUP_CODE" "201"

TOKEN=$(echo "$SIGNUP_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('accessToken', ''))")
USER_DID=$(echo "$SIGNUP_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('did', ''))")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "" ]; then
  echo "  ❌ No token returned, aborting"
  exit 1
fi

ME=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/identity/me")
check "GET /identity/me (with token)" "$ME" "200"

ME_NA=$(curl -s -o /dev/null -w "%{http_code}" "$API/identity/me")
check "GET /identity/me (no auth)" "$ME_NA" "401"

# ---- 3. Posts ----
echo ""
echo "3. Posts"
POST=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"mode":"public","contentText":"E2E smoke test post","visibility":"public"}')
check "POST /posts" "$POST" "201"

LIKE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/posts/$USER_DID/1/like" \
  -H "Authorization: Bearer $TOKEN")
check "POST /posts/.../like" "$LIKE" "201"

# ---- 4. Social graph (follow) ----
echo ""
echo "4. Social graph"
# Create target user
TARGET_RESP=$(curl -s -X POST "$API/identity/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"handle\":\"$HANDLE_TARGET\",\"displayName\":\"E2E Target\",\"password\":\"e2e12345\"}")
TARGET_DID=$(echo "$TARGET_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('did', ''))")

FOLLOW=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/identity/$HANDLE_TARGET/follow" \
  -H "Authorization: Bearer $TOKEN")
check "POST /identity/.../follow" "$FOLLOW" "200"

# ---- 5. Feed ----
echo ""
echo "5. Feed"
FEED=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/feed/home")
check "GET /feed/home" "$FEED" "200"

DIGEST=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/feed/digest")
check "GET /feed/digest" "$DIGEST" "200"

# ---- 6. Search ----
echo ""
echo "6. Search"
SEARCH=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/search?q=smoke")
check "GET /search" "$SEARCH" "200"

# ---- 7. DMs ----
echo ""
echo "7. Direct Messages"
DM=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/dms/threads" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"participantIds\":[\"$TARGET_DID\"]}")
check "POST /dms/threads" "$DM" "201"

# ---- 8. Marketplace ----
echo ""
echo "8. Marketplace"
LISTING=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/marketplace" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"E2E test item","description":"Test","priceCents":1000,"currency":"INR","category":"physical_product"}')
check "POST /marketplace" "$LISTING" "201"

# ---- 9. Groups ----
echo ""
echo "9. Groups"
GROUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"E2E Group $SUFFIX\",\"slug\":\"e2e-grp-$SUFFIX\",\"privacy\":\"public\"}")
check "POST /groups" "$GROUP" "201"

# ---- 10. AI agent ----
echo ""
echo "10. AI agent"
AGENT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/ai-agent/state")
check "GET /ai-agent/state" "$AGENT" "200"

# ---- Summary ----
echo ""
echo "────────────────────────────"
TOTAL=$((PASS+FAIL))
echo "  Total: $TOTAL, Passed: $PASS, Failed: $FAIL"
echo "────────────────────────────"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "✅ All checks passed"
