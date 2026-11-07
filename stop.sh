#!/usr/bin/env bash
# SSD Klinika — stop API, Vite, and Postgres.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="/usr/lib/postgresql/17/bin:$PATH"
PGDATA="$ROOT/.pgdata"

fuser -k 5000/tcp 3000/tcp 2>/dev/null || true
if [ -s "$PGDATA/postmaster.pid" ]; then
  pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
fi
rm -f "$ROOT/.logs/pids"
echo "✅ Stopped (DB preserved at $PGDATA)"
