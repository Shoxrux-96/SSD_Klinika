#!/usr/bin/env bash
# SSD Klinika — Postgres avtomatik zaxira.
# Har kuni 03:00 da ishga tushadi (cron orqali), 14 kungacha saqlab turadi.
set -euo pipefail

# Loyiha ildiz va .env
ROOT="/opt/ssd-klinika"
BACKUP_DIR="/var/backups/ssd-klinika"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# .env dan DATABASE_URL ni yuklash
if [ ! -f "$ROOT/.env" ]; then
  echo "[backup] .env topilmadi: $ROOT/.env" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. "$ROOT/.env"
set +a

: "${DATABASE_URL:?DATABASE_URL .env ichida bolishi kerak}"

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/ssd-klinika_$STAMP.sql.gz"

echo "[backup] boshlandi: $STAMP → $OUT"
# pg_dump + gzip (plain SQL formati, psql orqali tez tiklash mumkin)
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$OUT"

# Hajm va tekshiruv
SIZE=$(du -h "$OUT" | awk '{print $1}')
echo "[backup] tayyor: $OUT ($SIZE)"

# Eski zaxiralarni tozalash
echo "[backup] $RETENTION_DAYS kundan eski fayllar tozalanmoqda..."
find "$BACKUP_DIR" -type f -name "ssd-klinika_*.sql.gz" -mtime "+$RETENTION_DAYS" -print -delete || true

# Yakuniy hisobot
TOTAL_FILES=$(find "$BACKUP_DIR" -type f -name "ssd-klinika_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
echo "[backup] JAMI: $TOTAL_FILES fayl, $TOTAL_SIZE"
