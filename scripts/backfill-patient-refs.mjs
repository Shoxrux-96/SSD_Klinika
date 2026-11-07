#!/usr/bin/env node
// Legacy tibbiy yozuvlarni UUID + passport ga bog'laydi.
//
// Nima qiladi:
//   treatments / lab_results / prescriptions / dental_records ichida
//   patient_id maydoni "ism-familya" bo'lsa, patients jadvalidan ism bo'yicha
//   topib, UUID'ga almashtiradi va passport bo'lsa patient_passport ga yozadi.
//
// Ishga tushirish:
//   DATABASE_URL=postgres://... node scripts/backfill-patient-refs.mjs
//
// Idempotent: bir necha marta ishlatish mumkin.
import pg from "pg";

const { Client } = pg;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55434/ssd_klinika";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const patients = (await client.query(
  "SELECT id, full_name, passport FROM patients",
)).rows;

const byName = new Map();
for (const p of patients) {
  const key = (p.full_name ?? "").trim().toLowerCase();
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(p);
}

const TABLES = ["treatments", "lab_results", "prescriptions", "dental_records"];
const stats = {};

for (const table of TABLES) {
  stats[table] = { total: 0, migrated: 0, ambiguous: 0, missing: 0 };
  const rows = (await client.query(
    `SELECT id, patient_id, patient_passport FROM ${table}`,
  )).rows;
  for (const r of rows) {
    stats[table].total++;
    const key = (r.patient_id ?? "").trim();
    if (!key) continue;
    // Allaqachon UUID — tegib o'tmaymiz
    if (UUID_RE.test(key)) continue;

    const matches = byName.get(key.toLowerCase()) ?? [];
    if (matches.length === 0) {
      stats[table].missing++;
      continue;
    }
    if (matches.length > 1) {
      // Ikki yoki ko'p bemor bir xil ismda — passport orqali farqlash kerak
      stats[table].ambiguous++;
      continue;
    }
    const p = matches[0];
    const passport =
      r.patient_passport ??
      (p.passport ? p.passport.replace(/\s+/g, "").toUpperCase() : null);
    await client.query(
      `UPDATE ${table} SET patient_id = $1, patient_passport = $2 WHERE id = $3`,
      [p.id, passport, r.id],
    );
    stats[table].migrated++;
  }
}

console.log("\n=== Backfill natijalari ===");
for (const t of TABLES) {
  const s = stats[t];
  console.log(
    `  ${t.padEnd(15)}  jami: ${s.total}, ko'chdi: ${s.migrated}, bir xil ismli: ${s.ambiguous}, topilmadi: ${s.missing}`,
  );
}
if (Object.values(stats).some((s) => s.ambiguous > 0)) {
  console.log(
    "\n⚠ Bir xil ismli yozuvlar passport orqali qo'lda tekshirilishi kerak.",
  );
}

await client.end();
console.log("\n✅ Backfill tugadi.");
