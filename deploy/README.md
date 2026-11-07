# SSD Klinika — VPS'ga joylashtirish

Ushbu qo'llanma Ubuntu 22.04 / 24.04 (Debian 12 ham mos) uchun. Bir buyruq bilan
to'liq tizim (Postgres + Node API + Nginx + SSL + systemd) ishga tushadi.

## 1. VPS tayyorlash

Minimum: 1 CPU, 1 GB RAM, 20 GB SSD. Root SSH kirishi bo'lsin.

## 2. Kodni VPS'ga ko'chirish

Ikkita variant:

**Variant A — rsync (bevosita lokaldan)**
```bash
# Lokaldagi loyiha katalogidan:
rsync -az --delete \
  --exclude node_modules --exclude .pgdata --exclude .logs --exclude dist \
  ./ root@VPS_IP:/opt/ssd-klinika/
```

**Variant B — git**
```bash
ssh root@VPS_IP
git clone https://git.example.com/ssd-klinika.git /opt/ssd-klinika
```

## 3. Avtomatik o'rnatish

```bash
ssh root@VPS_IP
cd /opt/ssd-klinika
sudo bash deploy/install.sh
```

Skript quyidagilarni avtomatik bajaradi:
- Node.js 22, pnpm, PostgreSQL, Nginx, UFW firewall
- `ssd` foydalanuvchisi
- Postgres DB va foydalanuvchi (parol avtomatik yaratiladi)
- `.env` fayli (DATABASE_URL va boshqalar)
- systemd service: `ssd-klinika-api`
- Nginx reverse-proxy

## 4. Deploy (kodni build va ishga tushirish)

```bash
sudo -u ssd bash /opt/ssd-klinika/deploy/deploy.sh
```

Bu buyruq:
- `pnpm install`
- `drizzle push` (yangi jadvallarni yaratadi: `tech_products`, `attendance`, va boshqalar)
- API va Frontend build
- `systemctl restart ssd-klinika-api`
- `systemctl reload nginx`

## 5. HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/ssd-klinika  # server_name ni to'ldiring
sudo certbot --nginx -d klinika.example.uz
```

## 6. Monitoring va loglar

```bash
sudo systemctl status ssd-klinika-api
sudo journalctl -u ssd-klinika-api -f           # jonli log
sudo tail -f /var/log/nginx/ssd-klinika.error.log
```

## 7. Yangilash (kod o'zgargach)

Lokaldan:
```bash
rsync -az --delete --exclude node_modules --exclude .pgdata --exclude .logs --exclude dist \
  ./ root@VPS_IP:/opt/ssd-klinika/
ssh root@VPS_IP "sudo -u ssd bash /opt/ssd-klinika/deploy/deploy.sh"
```

## 8. Zaxira nusxa (backup)

Kuniga bir marta:
```bash
# /etc/cron.d/ssd-klinika-backup
0 3 * * * ssd pg_dump $DATABASE_URL | gzip > /var/backups/ssd-$(date +\%F).sql.gz
```

## 9. Muhit o'zgaruvchilari

`.env` ichidagilar:
| Nomi | Nima uchun |
|---|---|
| `DATABASE_URL` | Postgres ulanish satri |
| `PORT` | API ichki port (standart `5000`) |
| `NODE_ENV` | `production` |
| `AUTH_DISABLED` | `false` — yozuv so'rovlariga x-api-key yoki Bearer kerak |
| `LOG_LEVEL` | `info` / `debug` |

API tokeni yaratish (admin login orqali):
```bash
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin@ssdklinika.uz","password":"YOUR_PASSWORD"}'
```

## 10. LocalStorage → DB migratsiya eslatmasi

Oldingi versiyalarda ushbu ma'lumotlar brauzer localStorage'da edi; endi
hammasi DB'ga ko'chirildi va bir nechta qurilmadan foydalanganda ham mos
keladi:

- **Davomat** (`attendance`) — `/api/attendance`
- **Texnik mahsulotlar** (`tech_products`) — `/api/tech-products`

Deploy qilgandan so'ng, hodim davomatini va mahsulot katalogini Admin UI
orqali qayta kiritish talab qilinishi mumkin (eski brauzerdan ma'lumot
chiqarib olish uchun DevTools → Application → Local Storage ichidan
`ssd_attendance_records_v2` va `ssd_tech_products_v1` kalitlarini olish va
API'ga yuborish mumkin).
