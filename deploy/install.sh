#!/usr/bin/env bash
# SSD Klinika — VPS'da birinchi marta to'liq sozlash (bitta buyruq).
# Ubuntu 22.04 / 24.04 / Debian 12 uchun.
#
#   sudo bash deploy/install.sh
#
# Keyin: sudo -u ssd bash /opt/ssd-klinika/deploy/deploy.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Bu skriptni sudo bilan ishlating: sudo bash $0"
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/ssd-klinika}"
APP_USER="${APP_USER:-ssd}"
DB_NAME="${DB_NAME:-ssd_klinika}"
DB_USER="${DB_USER:-ssd}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)}"
JWT_SECRET_VAL="${JWT_SECRET_VAL:-$(openssl rand -base64 48 | tr -d '\n')}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> 1/10 Tizim paketlari"
apt-get update -y
apt-get install -y curl ca-certificates gnupg postgresql postgresql-contrib nginx ufw openssl rsync fail2ban

echo "==> 2/10 Node.js ${NODE_MAJOR} (NodeSource)"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi

echo "==> 3/10 pnpm"
if ! command -v pnpm >/dev/null; then
  npm install -g pnpm@10
fi

echo "==> 4/10 Foydalanuvchi: $APP_USER"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> 5/10 Postgres: $DB_NAME / $DB_USER"
systemctl enable --now postgresql >/dev/null 2>&1 || true
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null

echo "==> 6/10 .env fayli"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<ENV
# SSD Klinika — production
DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
PORT=5000
NODE_ENV=production
AUTH_DISABLED=false
JWT_SECRET=$JWT_SECRET_VAL
LOG_LEVEL=info
# Allowed origins (vergul bilan ajratilgan). Prod'da domen(lar)ni kiriting:
# ALLOWED_ORIGINS=https://klinika.example.uz,https://www.klinika.example.uz
ALLOWED_ORIGINS=
ENV
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  echo "    → .env yaratildi. DB parol: $DB_PASS"
  echo "    → JWT_SECRET (48 byte) avto-generatsiya qilindi."
else
  echo "    → .env allaqachon mavjud, qayta yozilmadi."
fi

echo "==> 7/10 systemd service (ssd-klinika-api)"
if [ -f "$APP_DIR/deploy/ssd-klinika-api.service" ]; then
  cp "$APP_DIR/deploy/ssd-klinika-api.service" /etc/systemd/system/
  sed -i "s|/opt/ssd-klinika|$APP_DIR|g; s|User=ssd|User=$APP_USER|; s|Group=ssd|Group=$APP_USER|" \
    /etc/systemd/system/ssd-klinika-api.service
  systemctl daemon-reload
  systemctl enable ssd-klinika-api >/dev/null 2>&1 || true
else
  echo "    ⚠ $APP_DIR/deploy/ssd-klinika-api.service topilmadi — loyihani $APP_DIR ga nusxalab qo'ying."
fi

echo "==> 8/10 Nginx reverse-proxy"
if [ -f "$APP_DIR/deploy/nginx.conf.example" ] && [ ! -f /etc/nginx/sites-available/ssd-klinika ]; then
  cp "$APP_DIR/deploy/nginx.conf.example" /etc/nginx/sites-available/ssd-klinika
  sed -i "s|/opt/ssd-klinika|$APP_DIR|g" /etc/nginx/sites-available/ssd-klinika
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/ssd-klinika /etc/nginx/sites-enabled/ssd-klinika
  nginx -t && systemctl reload nginx || true
fi

echo "==> 9/10 Firewall (ufw)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo "==> 10/10 fail2ban (brute-force/scan himoyasi)"
if [ -d "$APP_DIR/deploy/fail2ban" ]; then
  cp "$APP_DIR/deploy/fail2ban/jail.d-ssd-klinika.conf"             /etc/fail2ban/jail.d/ssd-klinika.conf
  cp "$APP_DIR/deploy/fail2ban/filter.d-nginx-req-limit.conf"       /etc/fail2ban/filter.d/nginx-req-limit.conf
  cp "$APP_DIR/deploy/fail2ban/filter.d-nginx-bad-request.conf"     /etc/fail2ban/filter.d/nginx-bad-request.conf
  cp "$APP_DIR/deploy/fail2ban/filter.d-ssd-klinika-auth.conf"      /etc/fail2ban/filter.d/ssd-klinika-auth.conf
  systemctl enable --now fail2ban >/dev/null 2>&1 || true
  systemctl restart fail2ban >/dev/null 2>&1 || true
else
  echo "    ⚠ $APP_DIR/deploy/fail2ban/ topilmadi, o'tkazib yuborildi."
fi

echo ""
echo "============================================================"
echo "✅ Birlamchi sozlash tugadi."
echo ""
echo "   Keyingi qadamlar:"
echo "     1. Loyiha kodi $APP_DIR ichida bo'lishi kerak (rsync yoki git clone)."
echo "     2. Deploy (build + seed + servisni ishga tushirish):"
echo "          sudo -u $APP_USER bash $APP_DIR/deploy/deploy.sh"
echo "     3. (ixtiyoriy) HTTPS:"
echo "          sudo nano /etc/nginx/sites-available/ssd-klinika   # server_name"
echo "          sudo apt install -y certbot python3-certbot-nginx"
echo "          sudo certbot --nginx -d YOUR_DOMAIN"
echo ""
echo "   Ma'lumotlar:"
echo "     DB:   $DB_NAME / user: $DB_USER / pass: $DB_PASS"
echo "     ENV:  $ENV_FILE"
echo "============================================================"
