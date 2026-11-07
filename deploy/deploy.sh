#!/usr/bin/env bash
# SSD Klinika — deploy (bitta buyruq, idempotent).
# Birinchi marta: sudo bash deploy/install.sh (bir marta, root ostida)
# Har yangilashda: sudo -u ssd bash deploy/deploy.sh
#
# Bu skript: deps → drizzle push → API build → web build → seed (bo'sh bo'lsa) → restart.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "❌ .env fayli topilmadi. Birinchi marta: sudo bash deploy/install.sh"
  exit 1
fi

set -a; . ./.env; set +a

: "${DATABASE_URL:?DATABASE_URL .env ichida bo'lishi kerak}"
: "${PORT:?PORT .env ichida bo'lishi kerak}"
if [ "${NODE_ENV:-}" = "production" ]; then
  : "${JWT_SECRET:?JWT_SECRET production muhitida majburiy}"
  if [ "$JWT_SECRET" = "ssd-klinika-dev-secret-change-me" ] || [ "$JWT_SECRET" = "CHANGE_ME_WITH_RANDOM_48_BYTE_SECRET" ]; then
    echo "❌ JWT_SECRET standart/dev qiymatda. .env ichida kuchli qiymatga o'zgartiring:"
    echo "   openssl rand -base64 48"
    exit 1
  fi
fi

echo "==> 1/6 Dependencies"
if ! command -v pnpm >/dev/null; then
  echo "❌ pnpm topilmadi. 'npm i -g pnpm@10' bilan o'rnating yoki install.sh ni qayta ishga tushiring."
  exit 1
fi
pnpm install --frozen-lockfile || pnpm install

echo "==> 2/6 DB schema (drizzle push)"
pnpm --filter @workspace/db run push --force

echo "==> 3/6 API build (esbuild)"
pnpm --filter @workspace/api-server run build >/dev/null

echo "==> 4/6 Frontend build (Vite)"
( cd artifacts/anaverse-health \
  && PORT=3000 BASE_PATH=/ API_URL="http://127.0.0.1:${PORT}" NODE_ENV=production pnpm run build )

echo "==> 5/6 Seed (bo'sh bo'lsa)"
USERS_COUNT="$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM employees WHERE username IS NOT NULL" 2>/dev/null || echo 0)"
if [ "${USERS_COUNT:-0}" = "0" ]; then
  echo "    foydalanuvchilar yo'q → seed-users.mjs ishga tushiramiz"
  DATABASE_URL="$DATABASE_URL" node scripts/seed-users.mjs || \
    echo "    ⚠ seed xato — qo'lda: node scripts/seed-users.mjs"
else
  echo "    ${USERS_COUNT} ta foydalanuvchi mavjud, seed o'tkazib yuborildi."
fi

echo "==> 6/6 Servisni qayta ishga tushirish"
if systemctl is-enabled ssd-klinika-api >/dev/null 2>&1; then
  sudo systemctl restart ssd-klinika-api
  sleep 2
  sudo systemctl status ssd-klinika-api --no-pager | head -10 || true
else
  echo "    ⚠ systemd service hali o'rnatilmagan. Root ostida: sudo bash deploy/install.sh"
fi

if command -v nginx >/dev/null && systemctl is-active nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx || true
fi

# Health check (lokal)
sleep 1
API_URL_LOCAL="http://127.0.0.1:${PORT}/api/healthz"
if curl -fsS --max-time 5 "$API_URL_LOCAL" >/dev/null 2>&1; then
  echo ""
  echo "✅ Deploy tugadi."
  echo "   API healthz:  $API_URL_LOCAL  → OK"
  echo "   API docs:     http://127.0.0.1:${PORT}/api/docs"
  echo "   Statik:       ${ROOT}/artifacts/anaverse-health/dist/public"
  echo "   Logs:         sudo journalctl -u ssd-klinika-api -f"
else
  echo ""
  echo "⚠ API healthz javob bermayapti. Loglarni tekshiring:"
  echo "   sudo journalctl -u ssd-klinika-api -n 50 --no-pager"
  exit 1
fi
