#!/usr/bin/env node
// Legacy JSON-blob ma'lumotlarni (settings jadvalidagi ssd-debts / ssd-tech-orders)
// yangi `debts` va `tech_orders` jadvallariga ko'chiradi.
//
// Idempotent — bir necha marta ishlatish mumkin. treatmentId / id bo'yicha
// yozuv mavjud bo'lsa — qayta qo'shilmaydi.
//
// Ishga tushirish:
//   DATABASE_URL=postgres://... node scripts/migrate-blob-stores.mjs
import pg from "pg";

const { Client } = pg;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55434/ssd_klinika";

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

async function readBlob(key) {
  const { rows } = await client.query(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  const v = rows[0]?.value;
  if (!v) return null;
  // settings.value — jsonb; pg allaqachon parse qiladi
  return Array.isArray(v) ? v : null;
}

async function tableExists(name) {
  const { rows } = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = $1",
    [name],
  );
  return rows.length > 0;
}

/* ------------ Debts ------------ */
async function migrateDebts() {
  if (!(await tableExists("debts"))) {
    console.log("⏭  debts jadvali yo'q — drizzle push ishga tushiring");
    return;
  }
  const blob = await readBlob("ssd-debts");
  if (!blob || blob.length === 0) {
    console.log("ℹ debts blob bo'sh yoki yo'q");
    return;
  }
  const { rows: existing } = await client.query(
    "SELECT treatment_id FROM debts",
  );
  const have = new Set(existing.map((r) => r.treatment_id));
  let inserted = 0;
  for (const d of blob) {
    if (!d?.treatmentId || have.has(d.treatmentId)) continue;
    const id = `D-${(d.deferredAt ?? Date.now()).toString(36).toUpperCase()}`;
    const services = Array.isArray(d.services) ? d.services.join(", ") : "";
    await client.query(
      `INSERT INTO debts (
        id, treatment_id, patient, phone, doctor, services, amount, date,
        due_date, note, status, deferred_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ochiq',$11)
      ON CONFLICT (id) DO NOTHING`,
      [
        id, d.treatmentId, d.patient ?? "", d.phone ?? null,
        d.doctor ?? null, services, Number(d.amount) || 0,
        d.date ?? new Date().toISOString().slice(0, 10),
        d.dueDate ?? null, d.note ?? null, Number(d.deferredAt) || Date.now(),
      ],
    );
    inserted++;
  }
  console.log(`✅ debts: ${inserted} ta yozuv ko'chdi`);
}

/* ------------ Tech orders ------------ */
async function migrateTechOrders() {
  if (!(await tableExists("tech_orders"))) {
    console.log("⏭  tech_orders jadvali yo'q — drizzle push ishga tushiring");
    return;
  }
  const blob = await readBlob("ssd-tech-orders");
  if (!blob || blob.length === 0) {
    console.log("ℹ tech-orders blob bo'sh yoki yo'q");
    return;
  }
  const { rows: existing } = await client.query("SELECT id FROM tech_orders");
  const have = new Set(existing.map((r) => r.id));
  let inserted = 0;
  for (const o of blob) {
    if (!o?.id || have.has(o.id)) continue;
    await client.query(
      `INSERT INTO tech_orders (
        id, doctor_id, date, product_name, qty, unit_price, total_amount,
        status, note, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'buyurtmada',$8,$9)
      ON CONFLICT (id) DO NOTHING`,
      [
        o.id, o.doctorId ?? "", o.date ?? new Date().toISOString().slice(0, 10),
        o.productName ?? "", Number(o.qty) || 0, Number(o.unitPrice) || 0,
        Number(o.totalAmount) || 0, o.note ?? null, Date.now(),
      ],
    );
    inserted++;
  }
  console.log(`✅ tech_orders: ${inserted} ta yozuv ko'chdi`);
}

await migrateDebts();
await migrateTechOrders();

await client.end();
console.log("\n✅ Blob store migratsiyasi tugadi.");
