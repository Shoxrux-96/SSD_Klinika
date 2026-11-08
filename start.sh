#!/usr/bin/env bash
# SSD Klinika — bitta buyruq bilan loyiha ishga tushadi (lokal dev).
# Postgres + Drizzle migratsiya + seed + API (:5000) + Vite (:3000).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="/usr/lib/postgresql/17/bin:$PATH"
PGDATA="$ROOT/.pgdata"
PGPORT=55434
export DATABASE_URL="postgres://postgres@127.0.0.1:${PGPORT}/ssd_klinika"
export PORT=5000
export AUTH_DISABLED=${AUTH_DISABLED:-true}
export NODE_ENV=${NODE_ENV:-development}
export JWT_SECRET="${JWT_SECRET:-dev-local-jwt-secret-$(hostname)}"

mkdir -p "$ROOT/.logs"

# 1) Postgres — initdb if missing, start if not running
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[pg] initdb -> $PGDATA"
  initdb -D "$PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null
fi
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "[pg] starting on port $PGPORT"
  pg_ctl -D "$PGDATA" -l "$PGDATA/pg.log" \
    -o "-p ${PGPORT} -k /tmp -h 127.0.0.1" start >/dev/null
  sleep 1
fi
psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='ssd_klinika'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U postgres -c "CREATE DATABASE ssd_klinika" >/dev/null

# 2) Deps
if [ ! -d node_modules ] || [ ! -d artifacts/api-server/node_modules ]; then
  echo "[deps] pnpm install"
  pnpm install
fi

# 3) Schema (idempotent)
echo "[db] drizzle push"
pnpm --filter @workspace/db run push --force >/dev/null

# 3b) Legacy KV-blob (debts, tech-orders) → jadvalga ko'chirish (idempotent)
node scripts/migrate-blob-stores.mjs >/dev/null 2>&1 || true

# 4) Seed users — faqat jadval bo'sh bo'lsa
USERS_COUNT=$(psql -h 127.0.0.1 -p "$PGPORT" -U postgres -d ssd_klinika -tAc \
  "SELECT count(*) FROM employees WHERE username IS NOT NULL" 2>/dev/null || echo 0)
if [ "${USERS_COUNT:-0}" = "0" ]; then
  echo "[seed] test foydalanuvchilarni yaratish (admin/.../hodim — parol: 1234)"
  node scripts/seed-users.mjs || echo "[seed] ⚠ seed xato bergan bo'lsa, qo'lda bash scripts/seed-users.sh"
fi

# 5) Build API if dist missing
if [ ! -f artifacts/api-server/dist/index.mjs ]; then
  echo "[api] build"
  pnpm --filter @workspace/api-server run build >/dev/null
fi

# Kill any previous local api/vite on same ports
fuser -k 5000/tcp 3000/tcp 2>/dev/null || true
sleep 1

echo "[api] starting on :$PORT"
( cd artifacts/api-server && node --enable-source-maps ./dist/index.mjs ) \
  >"$ROOT/.logs/api.log" 2>&1 &
API_PID=$!

echo "[web] starting on :3000"
( cd artifacts/anaverse-health && PORT=3000 BASE_PATH=/ API_URL=http://localhost:5000 pnpm run dev ) \
  >"$ROOT/.logs/web.log" 2>&1 &
WEB_PID=$!

echo "$API_PID $WEB_PID" > "$ROOT/.logs/pids"

sleep 3
echo ""
echo "✅ Running:"
echo "   Postgres: 127.0.0.1:${PGPORT}  (data: $PGDATA)"
echo "   API:      http://localhost:${PORT}/api   (docs: /api/docs)"
echo "   Web:      http://localhost:3000"
echo "   Login:    admin / shifokor / laborant / reg / kassir / bux / hodim  (parol: parol1234)"
echo "   Logs:     $ROOT/.logs/{api,web}.log"
echo ""
echo "To stop: ./stop.sh"
