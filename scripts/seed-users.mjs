#!/usr/bin/env node
// Har role'dan test foydalanuvchi yaratadi. Parol: "parol1234" (server >= 8 simvol talab qiladi).
import { scryptSync, randomBytes } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55434/ssd_klinika";

function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const USERS = [
  { username: "admin",    role: "admin",       fullName: "Tizim Admini",   category: "admin",   specialty: "Admin" },
  { username: "shifokor", role: "shifokor",    fullName: "Dr. Shifokorov", category: "medical", specialty: "Terapevt" },
  { username: "laborant", role: "laborant",    fullName: "Laborantov L.",  category: "medical", specialty: "Laborant" },
  { username: "reg",      role: "registrator", fullName: "Registratorova", category: "staff",   position: "Registrator" },
  { username: "kassir",   role: "kassir",      fullName: "Kassirova",      category: "staff",   position: "Kassir" },
  { username: "bux",      role: "buxgalter",   fullName: "Buxgalterova",   category: "staff",   position: "Buxgalter" },
  { username: "hodim",    role: "oddiy",       fullName: "Oddiy Hodim",    category: "staff",   position: "Yordamchi" },
];

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "parol1234";

for (const u of USERS) {
  const pw = hash(DEFAULT_PASSWORD);
  const existing = await client.query("SELECT id FROM employees WHERE username = $1", [u.username]);
  if (existing.rowCount > 0) {
    await client.query(
      `UPDATE employees SET password_hash = $1, role = $2, full_name = $3 WHERE username = $4`,
      [pw, u.role, u.fullName, u.username],
    );
    console.log(`  ↻ updated ${u.username} (${u.role})`);
  } else {
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO employees
       (id, category, full_name, phone, email, position, specialty, experience, diploma, added_at, archived, username, password_hash, role)
       VALUES ($1, $2, $3, '', '', $4, $5, '', '', $6, false, $7, $8, $9)`,
      [id, u.category, u.fullName, u.position ?? "", u.specialty ?? "", Date.now(), u.username, pw, u.role],
    );
    console.log(`  + created ${u.username} (${u.role})`);
  }
}

// Clean up legacy rows
await client.query("DELETE FROM employees WHERE role IN ('operator', 'moderator') OR username IN ('operator', 'mod')");

await client.end();
console.log(`\n✅ Foydalanuvchilar tayyor. Parol: ${DEFAULT_PASSWORD}`);
console.log("   Login: admin / shifokor / laborant / reg / kassir / bux / hodim");
