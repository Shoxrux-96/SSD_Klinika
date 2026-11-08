#!/usr/bin/env node
// Email-style test foydalanuvchilarini yaratadi.
//
// Parollar hech qachon manba kodda qoldirilmaydi — ular `scripts/seed-users.sh`
// faylidan (`upsert <login> '<parol>' ...` qatorlari) o'qiladi. `seed-users.sh`
// mavjud bo'lmasa, env orqali `SEED_<LOGIN>` qiymatlari qabul qilinadi
// (masalan: SEED_ADMIN=... SEED_SHIFOKOR=... ), yoki fallback o'rniga random
// parollar generatsiya qilinib terminalga chiqariladi.
import { scryptSync, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55434/ssd_klinika";

function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_SH = path.join(__dirname, "seed-users.sh");

// `seed-users.sh` dan upsert qatorlarini parslaymiz:
//   upsert admin@ssdklinika.uz  'Admin@2026'  admin  "Tizim Admini" ...
function loadPasswordsFromShell() {
  if (!existsSync(SEED_SH)) return {};
  const txt = readFileSync(SEED_SH, "utf8");
  const map = {};
  const re = /^\s*upsert\s+(\S+)\s+'([^']+)'/gm;
  for (const m of txt.matchAll(re)) map[m[1]] = m[2];
  return map;
}

const shellPws = loadPasswordsFromShell();

function randomPw() {
  // 12 belgi, alnum + bitta maxsus belgi
  const bytes = randomBytes(10).toString("base64url");
  return bytes + "@9";
}

function pickPw(login, envKey) {
  const envVal = process.env[envKey];
  if (envVal && envVal.length >= 8) return envVal;
  const shellVal = shellPws[login];
  if (shellVal && shellVal.length >= 8) return shellVal;
  return randomPw();
}

const USERS = [
  { username: "admin@ssdklinika.uz",       role: "admin",       fullName: "Tizim Admini",   category: "admin",   specialty: "Admin",    position: "",            env: "SEED_ADMIN" },
  { username: "shifokor@ssdklinika.uz",    role: "shifokor",    fullName: "Dr. Shifokorov", category: "medical", specialty: "Terapevt", position: "",            env: "SEED_SHIFOKOR" },
  { username: "laborant@ssdklinika.uz",    role: "laborant",    fullName: "Laborantov L.",  category: "medical", specialty: "Laborant", position: "",            env: "SEED_LABORANT" },
  { username: "registrator@ssdklinika.uz", role: "registrator", fullName: "Registratorova", category: "service", specialty: "",         position: "Registrator", env: "SEED_REGISTRATOR" },
  { username: "kassir@ssdklinika.uz",      role: "kassir",      fullName: "Kassirova",      category: "service", specialty: "",         position: "Kassir",      env: "SEED_KASSIR" },
  { username: "buxgalter@ssdklinika.uz",   role: "buxgalter",   fullName: "Buxgalterova",   category: "service", specialty: "",         position: "Buxgalter",   env: "SEED_BUXGALTER" },
  { username: "hodim@ssdklinika.uz",       role: "oddiy",       fullName: "Oddiy Hodim",    category: "service", specialty: "",         position: "Yordamchi",   env: "SEED_HODIM" },
];

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

for (const u of USERS) {
  const pw = pickPw(u.username, u.env);
  const pwHash = hash(pw);
  const existing = await client.query(
    "SELECT id FROM employees WHERE username = $1",
    [u.username],
  );
  if (existing.rowCount > 0) {
    await client.query(
      `UPDATE employees SET password_hash = $1, role = $2, full_name = $3 WHERE username = $4`,
      [pwHash, u.role, u.fullName, u.username],
    );
    console.log(`  ↻ ${u.username.padEnd(28)} (${u.role})`);
  } else {
    const id = randomUUID();
    await client.query(
      `INSERT INTO employees
       (id, category, full_name, phone, email, position, specialty, experience, diploma, added_at, archived, username, password_hash, role)
       VALUES ($1, $2, $3, '', '', $4, $5, '', '', $6, false, $7, $8, $9)`,
      [id, u.category, u.fullName, u.position, u.specialty, Date.now(), u.username, pwHash, u.role],
    );
    console.log(`  + ${u.username.padEnd(28)} (${u.role})`);
  }
}

// Eski qisqa loginli yozuvlarni olib tashlash (admin, shifokor, laborant, ...)
const removed = await client.query(
  `DELETE FROM employees
   WHERE username IN ('admin','shifokor','laborant','reg','kassir','bux','hodim')
   RETURNING username`,
);
if (removed.rowCount > 0) {
  console.log(`\n  ✗ olib tashlandi: ${removed.rows.map((r) => r.username).join(", ")}`);
}

await client.end();
console.log(
  "\n✅ Foydalanuvchilar tayyor. Parollar scripts/seed-users.sh ichida ko'rsatilgan" +
    "\n   (yoki SEED_<ROL> env orqali majburiy qilib yuborish mumkin).",
);
