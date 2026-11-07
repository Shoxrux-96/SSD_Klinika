# SSD Klinika

**Sirius Stoma Dent Diagnostika markazi** uchun to'liq tibbiy boshqaruv tizimi — veb-sayt, admin paneli, qabulxona, kassa, shifokor va laborant ish stollari bilan birgalikda.

Monorepo (pnpm workspaces), TypeScript-first, PostgreSQL + Drizzle ORM asosida qurilgan. Ikkita buyruq bilan lokal ishga tushadi, bitta buyruq bilan VPS'ga joylashadi.

---

## Tez boshlash

### Lokal dev (bitta buyruq)

```bash
./start.sh
```

Skript avtomatik: Postgres'ni `.pgdata/` ichida ishga tushiradi, drizzle schema push qiladi, test foydalanuvchilarni seed qiladi, API va Vite dev-serverni ko'taradi.

- **Web:** http://localhost:3000
- **API:** http://localhost:5000/api (docs: `/api/docs`)
- **Login:** `admin / shifokor / laborant / reg / kassir / bux / hodim` (parol: `parol1234`)

To'xtatish: `./stop.sh`

### VPS deploy (ikki buyruq)

```bash
# 1) Fayllarni VPS'ga ko'chirish (lokaldan):
rsync -az --delete \
  --exclude node_modules --exclude .pgdata --exclude .logs --exclude dist \
  ./ root@VPS_IP:/opt/ssd-klinika/

# 2) VPS ichida:
ssh root@VPS_IP "sudo bash /opt/ssd-klinika/deploy/install.sh && sudo -u ssd bash /opt/ssd-klinika/deploy/deploy.sh"
```

Shu bilan: Node.js, pnpm, PostgreSQL, Nginx, UFW, systemd service, `.env` + auto-generatsiya qilingan `JWT_SECRET` va DB parol, drizzle schema, API+Web build, seed, va ishga tushirilgan servislar. Keyin faqat HTTPS (certbot) qoldi.

HTTPS:
```bash
sudo nano /etc/nginx/sites-available/ssd-klinika   # server_name
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

---

## Texnologiyalar

### Monorepo va build
- **pnpm** `^10` workspaces (`pnpm-workspace.yaml`) — barcha paketlar bitta repo ichida, hard-link cache.
- **TypeScript** `~5.9` — strict rejim (`strictNullChecks`, `noImplicitAny`, `isolatedModules`), composite project references.
- **Prettier** `^3.9` — formatter.
- **minimumReleaseAge: 1440** — pnpm supply-chain himoyasi (paketlar kamida 1 kunlik bo'lishi kerak).

### Backend (`artifacts/api-server`)
- **Node.js** `>= 20` (prod: 22, NodeSource).
- **Express** `^5.3` — HTTP server.
- **Drizzle ORM** `^0.45` + **drizzle-zod** `^0.8` — type-safe DB access.
- **PostgreSQL** `17` + **node-postgres** (`pg` `^8.23`).
- **jsonwebtoken** `^9.0` — JWT login tokeni (HS256, 8 soat).
- **express-rate-limit** `^7.5` — `/auth/login` brute-force himoyasi.
- **cors** `^2.8` — origin whitelist (prod: `ALLOWED_ORIGINS` env).
- **pino** `^9.14` + **pino-http** `^10.5` + **pino-pretty** — strukturaviy loglash.
- **esbuild** `0.28` + **esbuild-plugin-pino** — CJS bundle (`dist/index.mjs`), pino worker fayllar ajratilgan.
- **node:crypto scrypt** — parollar `salt:hash` formatida, `timingSafeEqual` tekshirish.

### Frontend (`artifacts/anaverse-health`)
- **React** `19.1` + **React DOM** `19.1`.
- **Vite** `^7.3` — dev server + prod build, `manualChunks` bilan code-split.
- **react-router-dom** `^7.18` — SPA routing (role-based layout'lar: admin / clinic / reception / cashier).
- **wouter** `^3.3` — yengil router (ichki modullarda).
- **TailwindCSS** `^4.1` (Oxide + `@tailwindcss/vite` plugin) + **tw-animate-css**.
- **Radix UI** — accessible primitive'lar (dialog, dropdown, select, tabs, …).
- **lucide-react** `^0.545` — ikonlar.
- **framer-motion** `^12.23` — animatsiyalar.
- **@tanstack/react-query** `^5.90` — server state.
- **react-hook-form** `^7.55` + **@hookform/resolvers** + **zod** `^3.25`.
- **recharts** `^2.15` — grafiklar (admin dashboard).
- **react-leaflet** `^5.0` + **leaflet** `^1.9` — klinika xaritasi.
- **three** `^0.187` + **@react-three/fiber** + **@react-three/drei** — 3D skelet/anatomiya modeli.
- **react-day-picker**, **embla-carousel-react**, **sonner**, **cmdk**, **vaul** — qo'shimcha UX komponentlari.
- **date-fns** `^3.6` — sana formatlash.

### DB sxemasi (`lib/db`)
- Drizzle Kit `^0.31` — migratsiya va push.
- 22 ta jadval: `employees`, `patients`, `appointments`, `queue_items`, `services`, `service_categories`, `service_assignments`, `treatments`, `prescriptions`, `lab_results`, `dental_records`, `transactions`, `payrolls`, `attendance`, `tech_products`, `call_tasks`, `call_logs`, `roles`, `users`, `settings`, `audit_logs`, `api_keys`.

### API Spec va kodogen (`lib/api-spec`, `lib/api-zod`, `lib/api-client-react`)
- **OpenAPI 3** spec → **Orval** `^8.41` → React Query hooks + Zod sxemalari.
- Qayta generatsiya: `pnpm --filter @workspace/api-spec run codegen`.

### Deploy infrastrukturasi (`deploy/`)
- **systemd** — `ssd-klinika-api.service` (xavfsiz: `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`).
- **Nginx** — reverse-proxy (`/api` → `127.0.0.1:5000`), statik Vite build, gzip, keepalive, cache headers.
- **UFW** — OpenSSH + Nginx Full ochiq.
- **certbot** — Let's Encrypt HTTPS (qo'lda bir marta ishga tushiriladi).

---

## Monorepo tuzilishi

```
.
├── artifacts/
│   ├── api-server/          # Express + Drizzle API (port 5000)
│   ├── anaverse-health/     # React + Vite UI (port 3000)
│   └── mockup-sandbox/      # Dizayn sandbox (deploy'ga kirmaydi)
├── lib/
│   ├── db/                  # Drizzle schema + client (@workspace/db)
│   ├── api-spec/            # OpenAPI spec + Orval config
│   ├── api-zod/             # Avto-generatsiya qilingan Zod sxemalari
│   └── api-client-react/    # React Query hooks
├── scripts/                 # seed-users.mjs, test-api.sh, …
├── deploy/
│   ├── install.sh           # Birinchi marta VPS setup (root)
│   ├── deploy.sh            # Har safar yangilash (idempotent)
│   ├── ssd-klinika-api.service
│   ├── nginx.conf.example
│   └── .env.example
├── start.sh                 # Lokal dev one-shot
└── stop.sh
```

---

## Arxitektura qarorlari

- **Auth birlashgan**: login `/api/auth/login` JWT qaytaradi. Frontend `main.tsx` da global `fetch` patch mavjud — same-origin `/api/*` so'rovlariga localStorage'dagi JWT'ni avtomatik `Authorization: Bearer` sarlavhasiga qo'shadi. Server middleware'i JWT'ni verify qiladi; muvaffaqiyatsiz bo'lsa `apiKeysTable`'ga tushadi (mobile / integratsiya kalitlari uchun).
- **Rol-asosli yo'nalish**: login javobi `home: /admin | /clinic | /reception | /cashier` qiymatini qaytaradi; `RoleRoute` komponenti ruxsat etilmagan rollarni `/no-access` ga yo'naltiradi.
- **Idempotent schema**: `drizzle-kit push --force` har deploy'da chaqiriladi, migratsiya fayllari saqlanmaydi (schema → DB).
- **Prod safety guards**: `index.ts` startup'da `NODE_ENV=production` holda `JWT_SECRET` default qiymatda bo'lsa yoki `AUTH_DISABLED=true` bo'lsa, server to'xtaydi.
- **Bundle code-split**: Vite `manualChunks` bilan `three`, `leaflet`, `recharts`, `@radix-ui`, `framer-motion`, `router`, `vendor` alohida chunk'larga bo'linadi.

---

## Env o'zgaruvchilari

| Nomi | Tavsif | Dev default | Prod talab |
|---|---|---|---|
| `DATABASE_URL` | Postgres ulanish satri | `postgres://postgres@127.0.0.1:55434/ssd_klinika` | Majburiy |
| `PORT` | API ichki portini | `5000` | Majburiy |
| `NODE_ENV` | `development` / `production` | `development` | `production` |
| `AUTH_DISABLED` | Barcha auth'ni o'chirish (faqat dev) | `true` | **`false`** |
| `JWT_SECRET` | JWT imzolash kaliti (≥32 byte) | avto-hostname-based | **Majburiy** |
| `ALLOWED_ORIGINS` | CORS whitelist (vergul) | bo'sh ⇒ reflect | Domen(lar) |
| `LOG_LEVEL` | pino darajasi | `info` | `info` / `warn` |

Prod'da `JWT_SECRET` dev default'da qolsa yoki `AUTH_DISABLED=true` bo'lsa — server ishga tushmaydi.

---

## Rivojlantirish komandalari

```bash
pnpm install                                        # deps o'rnatish
pnpm run typecheck                                  # hamma paketlar TS tekshiruvi
pnpm run build                                      # typecheck + barcha paketlarni build qilish
pnpm --filter @workspace/api-server run build       # faqat API
pnpm --filter @workspace/anaverse-health run build  # faqat web (PORT/BASE_PATH kerak)
pnpm --filter @workspace/db run push                # drizzle schema push
pnpm --filter @workspace/api-spec run codegen       # OpenAPI → hooks + Zod
node scripts/seed-users.mjs                         # test foydalanuvchilarni qayta yaratish
```

---

## Xavfsizlik (DDoS / DoS / SQLi / brute-force)

Tizim quyidagi qatlamli himoyaga ega:

### API qatlami (Express)
- **helmet** `^8.1` — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy`, HSTS (HTTPS orqasida), `Permissions-Policy`.
- **CSP** — API uchun `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`.
- **CORS whitelist** — prodda `ALLOWED_ORIGINS` env'dan oq ro'yxat; evil origin'ga `Access-Control-Allow-Origin` yuborilmaydi.
- **Global rate-limit** — IP uchun 300 so'rov/daqiqa (`RATE_LIMIT_PER_MIN` env bilan sozlanadi); `/api/healthz` chiqarilgan. Haqiqiy IP `X-Forwarded-For` orqali (`trust proxy=1`).
- **`/auth/login` rate-limit** — IP uchun 20 urinish / 15 daqiqa → 429.
- **Body limit** — JSON va urlencoded 256 KB (katta payload bilan DoS'dan himoya) → 413.
- **Zod validatsiya** — `/auth/login` inputi `{ username:string, password:string>=8 }` sxemasiga qattiq moslanadi; begona maydonlar/yomon tiplar 400 qaytaradi.

### Login va foydalanuvchi sessiyalari (barcha hodimlar uchun xavfsiz kirish/chiqish)
- **JWT + jti** — login tokeni (`HS256`, 8 soat) `jti` claim'ga ega; har token DB'dagi `auth_sessions` yozuvi bilan bog'langan.
- **Logout** — `POST /api/auth/logout` sessiyani `revoked=true` qiladi; keyingi har qanday so'rov 401 qaytaradi (hatto JWT exp hali tugamagan bo'lsa ham).
- **Session ro'yxati** — `GET /api/auth/sessions` foydalanuvchining barcha faol sessiyalarini (IP, User-Agent, lastSeen) qaytaradi. `current: true` — hozirgi.
- **"Boshqa qurilmalardan chiqish"** — `POST /api/auth/sessions/revoke-others` barcha boshqa aktiv sessiyalarini bekor qiladi (joriy — qoladi).
- **Account lockout** — bitta login uchun 15 daqiqada 5 ta xato urinishdan so'ng 15 daqiqa qulf → 429. Hisoblash `login_attempts` jadvalidan parametrizatsiya qilingan `count(*)` orqali.
- **Audit log** — har login/logout `audit_logs` ga yoziladi; har kirish urinishi (muvaffaqiyatli/xato + sabab + IP + UA) `login_attempts` ga yoziladi.
- **Parol xavfsizligi** — scrypt (16 byte salt + 64 byte hash); `timingSafeEqual` bilan timing-attack'dan himoya; parol uzunligi `>= 8` server tomonidan tekshiriladi.
- **Secrets tekshiruvi** — prodda `JWT_SECRET` default/bo'sh bo'lsa yoki `AUTH_DISABLED=true` bo'lsa server ishga tushmaydi.
- **401 yoki sessiya revoke** — frontend fetch patcher 401 kelganida localStorage tokenni tozalab, login sahifasiga yo'naltiradi.

### SQL injection
- **Drizzle ORM** — barcha query'lar parametrizatsiya qilingan (`eq()`, `sql<T>\`count(*)\``). Hech qanday string konkatenatsiya yo'q.
- **Zod** — har login kiritish inputi tipli validatsiya qilinadi; `username: "admin' OR '1'='1"` oddiy string sifatida saqlanadi va topilmagani uchun 401.
- Test: `admin' OR '1'='1` login urinishi → 401 "Login yoki parol noto'g'ri" (SQL xatosi yo'q, injection ishlamadi).

### Nginx qatlami (`deploy/nginx.conf.example`)
- **`limit_req_zone`** — har IP uchun 10 r/s (burst 20) umumiy, 1 r/s (burst 5) `/api/auth/login` uchun.
- **`limit_conn_zone`** — IP bo'yicha 30 parallel ulanish (slowloris'dan himoya).
- **Timeout'lar** — `client_body_timeout 10s`, `send_timeout 10s`, `reset_timedout_connection on` (slow-attack'dan himoya).
- **`client_max_body_size 2M`** — katta payload'larni Nginx qatlamida to'xtatish.
- **User-Agent qora ro'yxati** — `sqlmap`, `nikto`, `nessus`, `openvas`, `masscan`, `zgrab` → 444.
- **Scan'larni bloklash** — `/\.git`, `/\.env`, `/wp-admin`, `/phpmyadmin` → 404/deny.
- **Xavfsizlik sarlavhalari** — HTTP qatlamida ham qaytariladi.

### Tizim qatlami (`deploy/install.sh`)
- **UFW firewall** — faqat SSH + Nginx Full ochiq.
- **fail2ban** — uchta jail:
  - `sshd` — SSH brute-force (5 urinish → 1 soat ban).
  - `nginx-req-limit` — Nginx 429 javoblari (10 ta → 1 soat ban).
  - `nginx-bad-request` — Nginx 4xx/444 scan'lar (30 ta → 2 soat ban).
  - `ssd-klinika-auth` — API `/auth/login` 401/429 javoblari pino journald log'idan (`ip` maydon + `statusCode` 401/429), 8 ta → 2 soat ban.
- **PostgreSQL** — `127.0.0.1` ga bog'langan; tashqi port yo'q; parol 24-byte avto-generatsiya.
- **systemd service** — `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`.

### Qo'shimcha tavsiya
- HTTPS/HSTS — certbot avtomatik. HSTS (`Strict-Transport-Security`) `helmet` orqali.
- `JWT_SECRET` ni vaqti-vaqti bilan yangilash (session'lar avtomatik invalidatsiya bo'ladi).
- Postgres backup — kundalik `pg_dump` cron.
- Monitoring — `sudo fail2ban-client status ssd-klinika-auth` bilan banlangan IP'larni ko'rish.

---

## Backup va monitoring

**Kuniga bir marta backup (prod):**
```
# /etc/cron.d/ssd-klinika-backup
0 3 * * * ssd pg_dump $DATABASE_URL | gzip > /var/backups/ssd-$(date +\%F).sql.gz
```

**Loglar:**
```bash
sudo systemctl status ssd-klinika-api
sudo journalctl -u ssd-klinika-api -f           # API jonli log
sudo tail -f /var/log/nginx/ssd-klinika.error.log
```

---

## Litsenziya

MIT.
