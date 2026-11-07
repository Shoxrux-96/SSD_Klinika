#!/usr/bin/env bash
# CRUD smoke-test — barcha asosiy API uchun.
# Kerak: API ishga tushgan va API_KEY mavjud.
#
#   API_BASE=http://localhost:3000 API_KEY=YOUR_KEY bash scripts/test-api.sh
#
# AUTH_DISABLED=true bilan ishlatilsa API_KEY bermaslik mumkin.

set -eu
API_BASE="${API_BASE:-http://localhost:3000}"
API_KEY="${API_KEY:-}"

HDR=(-H 'content-type: application/json')
if [ -n "$API_KEY" ]; then HDR+=(-H "x-api-key: $API_KEY"); fi

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

check() {
  local name="$1" status="$2"
  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    green "  ✓ $name ($status)"
  else
    red   "  ✗ $name ($status)"; FAILED=1
  fi
}

FAILED=0

step "0) Health"
code=$(curl -s -o /tmp/apihealth -w '%{http_code}' "$API_BASE/api/healthz")
check "GET /api/healthz" "$code"

step "1) READ — list endpoints"
for ep in employees patients appointments queue services service-categories assignments prescriptions treatments transactions tech-products call-tasks lab-results; do
  code=$(curl -s -o "/tmp/api_$ep" -w '%{http_code}' "${HDR[@]}" "$API_BASE/api/$ep")
  check "GET /api/$ep" "$code"
done

step "2) CRUD — patients (create → read → update → delete)"
pid=$(curl -s "${HDR[@]}" -X POST "$API_BASE/api/patients" \
  -d '{"fullName":"API Test Bemor","phone":"+998901112233","address":"Test","addedAt":'$(date +%s000)'}' \
  | tr -d '\r' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
if [ -n "$pid" ]; then
  green "  ✓ POST created id=$pid"
  code=$(curl -s -o /dev/null -w '%{http_code}' "${HDR[@]}" "$API_BASE/api/patients/$pid"); check "GET by id" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' "${HDR[@]}" -X PATCH "$API_BASE/api/patients/$pid" -d '{"phone":"+998901112244"}'); check "PATCH" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' "${HDR[@]}" -X DELETE "$API_BASE/api/patients/$pid"); check "DELETE" "$code"
else
  red "  ✗ POST patients failed — cannot continue CRUD"; FAILED=1
fi

step "3) KV settings (localStorage o'rniga DB)"
for key in ssd-debts ssd-medical-visits ssd-tech-orders ssd-contact-settings ssd-promo-settings ssd-promo-codes; do
  code=$(curl -s -o "/tmp/kv_$key" -w '%{http_code}' "${HDR[@]}" -X PUT "$API_BASE/api/settings/$key" -d '{"value":[]}')
  check "PUT /api/settings/$key" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' "${HDR[@]}" "$API_BASE/api/settings/$key")
  check "GET /api/settings/$key" "$code"
done

step "4) Auth"
code=$(curl -s -o /tmp/login -w '%{http_code}' -H 'content-type: application/json' \
  -X POST "$API_BASE/api/auth/login" -d '{"username":"admin@ssdklinika.uz","password":"Admin@2026"}')
check "POST /api/auth/login (admin)" "$code"

echo ""
if [ "$FAILED" -eq 0 ]; then green "✅ Hammasi o'tdi"; else red "❌ Ba'zi testlar yiqildi"; exit 1; fi
