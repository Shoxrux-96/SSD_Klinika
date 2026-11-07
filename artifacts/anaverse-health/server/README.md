# SSD Klinika — Backend (PostgreSQL + Express)

## 1. PostgreSQL

Lokal PG o'rnating, keyin DB yarating:

```bash
createdb ssd_klinika
```

Yoki Docker bilan:
```bash
docker run --name ssd-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ssd_klinika \
  -p 5432:5432 -d postgres:16
```

## 2. Env

```bash
cd server
cp .env.example .env
# DATABASE_URL'ni o'z ulanishingizga mos sozlang
```

## 3. O'rnatish va migratsiya

```bash
cd server
npm install            # yoki pnpm install
npm run migrate        # jadvallarni yaratadi + seed (bo'sh DB bo'lsa)
npm run dev            # http://localhost:4000 da API
```

## 4. Frontend bilan ishlash

Frontend `/api/*` ni `http://localhost:4000` ga proksilaydi (vite.config.ts).
Backend ishga tushgach — oddiy frontend buyrug'i (loyihaning ildizidan):

```bash
PORT=5173 BASE_PATH=/ pnpm run dev
```

## Endpointlar

Har bir entity uchun REST CRUD:
- `GET/POST/PATCH/DELETE /api/employees[/:id]`
- `GET/POST/PATCH/DELETE /api/patients[/:id]`
- `GET/POST/PATCH/DELETE /api/appointments[/:id]`
- `GET/POST/PATCH/DELETE /api/queue[/:id]`
- `GET/POST/PATCH/DELETE /api/service-categories[/:id]`
- `GET/POST/PATCH/DELETE /api/services[/:id]`
- `GET /api/assignments`
- `POST /api/assignments/toggle` — `{ employeeId, serviceId }`
- `PUT  /api/assignments/:employeeId` — `{ serviceIds: [] }`
- `GET /api/health`
