import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { db, auditLogsTable } from "@workspace/db";

// Rol asosida ruxsat berish (Role-Based Access Control).
// Har bir route uchun "qaysi rollar qaysi usullarda qila oladi" jadvali.
//
// Ruxsat berilmagan kombinatsiya → 403 Forbidden.
// `admin` rolli hamma narsani qila oladi (asosiy super-user).

export type Role = "admin" | "shifokor" | "laborant" | "registrator" | "kassir" | "buxgalter" | "oddiy";

type Methods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type Rule = {
  // Path prefix (regexsiz, startsWith). Masalan "/patients".
  path: string;
  // Hard-coded method ro'yxati; bo'sh bo'lsa barcha usul.
  methods?: Methods[];
  // Ruxsat etilgan rollar.
  roles: Role[];
};

// --- Rol guruhlari (nomlangan) ---
// Har bir guruh ma'noga ega — RBAC qoidalari oson o'qiladi va mos ravishda tozalanadi.
const ADMIN_ONLY: Role[] = ["admin"];
const ALL_STAFF: Role[] = ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"];
const CLINIC_STAFF: Role[] = ["admin", "shifokor", "laborant"];            // tibbiy jamoa
const FRONT_DESK: Role[] = ["admin", "registrator"];                       // qabulxona
const FINANCE: Role[] = ["admin", "kassir", "buxgalter"];                  // moliya
const DOCTOR_WRITE: Role[] = ["admin", "shifokor"];                        // davolash yozish
const LAB_WRITE: Role[] = ["admin", "laborant"];                           // lab natija yozish
const REGISTRAR_PLUS_DOCTOR: Role[] = ["admin", "registrator", "shifokor"]; // qabul boshqarish

const RULES: Rule[] = [
  // --- Tizim boshqaruvi (faqat admin) ---
  { path: "/users",       roles: ADMIN_ONLY },
  { path: "/api-keys",    roles: ADMIN_ONLY },
  { path: "/roles",       roles: ADMIN_ONLY },
  { path: "/audit-logs",  roles: ADMIN_ONLY },
  { path: "/settings", methods: ["GET"], roles: ALL_STAFF },
  { path: "/settings", methods: ["PUT", "PATCH", "DELETE", "POST"], roles: ADMIN_ONLY },

  // --- Hodimlar ---
  { path: "/employees", methods: ["GET"], roles: ALL_STAFF },
  { path: "/employees", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ADMIN_ONLY },

  // --- Bemorlar (hamma o'qiydi; registrator/shifokor yozadi; faqat admin o'chiradi) ---
  { path: "/patients", methods: ["GET"], roles: ALL_STAFF },
  { path: "/patients", methods: ["POST", "PUT", "PATCH"], roles: REGISTRAR_PLUS_DOCTOR },
  { path: "/patients", methods: ["DELETE"], roles: ADMIN_ONLY },

  // --- Qabul va navbat ---
  { path: "/appointments", methods: ["GET"], roles: ALL_STAFF },
  { path: "/appointments", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: REGISTRAR_PLUS_DOCTOR },
  { path: "/queue",        methods: ["GET"], roles: ALL_STAFF },
  { path: "/queue",        methods: ["POST", "PUT", "PATCH", "DELETE"], roles: REGISTRAR_PLUS_DOCTOR },

  // --- Xizmatlar katalogi (hamma o'qiydi; faqat admin yozadi) ---
  { path: "/services",          methods: ["GET"], roles: ALL_STAFF },
  { path: "/services",          methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ADMIN_ONLY },
  { path: "/service-categories", methods: ["GET"], roles: ALL_STAFF },
  { path: "/service-categories", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ADMIN_ONLY },
  { path: "/assignments",       methods: ["GET"], roles: ALL_STAFF },
  { path: "/assignments",       methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ADMIN_ONLY },

  // --- Klinik yozuvlar (ko'rish — hamma, yozish — shifokor/laborant alohida) ---
  { path: "/treatments", methods: ["GET"], roles: ALL_STAFF },
  { path: "/treatments", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: DOCTOR_WRITE },

  { path: "/prescriptions", methods: ["GET"], roles: ALL_STAFF },
  { path: "/prescriptions", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: DOCTOR_WRITE },

  // Laboratoriya — ko'rish hamma, yozish faqat laborant (shifokor faqat ko'radi)
  { path: "/lab-results", methods: ["GET"], roles: ALL_STAFF },
  { path: "/lab-results", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: LAB_WRITE },

  // Tish xaritasi — ko'rish hamma, yozish shifokor
  { path: "/dental-records", methods: ["GET"], roles: ALL_STAFF },
  { path: "/dental-records", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: DOCTOR_WRITE },

  // --- Moliya (kassir va buxgalter — bir xil to'liq huquqlar) ---
  { path: "/transactions", roles: FINANCE },
  { path: "/payrolls",     roles: FINANCE },
  { path: "/finance",      roles: FINANCE },
  { path: "/debts",        methods: ["GET"], roles: [...FINANCE, "registrator"] },
  { path: "/debts",        methods: ["POST", "PUT", "PATCH", "DELETE"], roles: FINANCE },
  // Promo kodlar — barcha hodim ko'ra oladi, faqat kassa yozadi
  { path: "/promo-codes",  methods: ["GET"], roles: ALL_STAFF },
  { path: "/promo-codes",  methods: ["POST", "PUT", "PATCH", "DELETE"], roles: FINANCE },

  // --- Hisobotlar ---
  { path: "/reports", methods: ["GET"], roles: [...FINANCE, "shifokor"] },

  // --- Call markaz (registrator yozadi, shifokor ko'radi) ---
  { path: "/call-tasks", methods: ["GET"], roles: ["admin", "registrator", "shifokor"] },
  { path: "/call-tasks", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: FRONT_DESK },
  { path: "/call-logs",  methods: ["GET"], roles: ["admin", "registrator", "shifokor"] },
  { path: "/call-logs",  methods: ["POST", "PUT", "PATCH", "DELETE"], roles: FRONT_DESK },

  // --- Inventar (texnik mahsulotlar va buyurtmalar) ---
  { path: "/tech-products", methods: ["GET"], roles: ["admin", "shifokor", "kassir", "buxgalter"] },
  { path: "/tech-products", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ADMIN_ONLY },
  { path: "/tech-orders",   methods: ["GET"], roles: ["admin", "shifokor", "kassir", "buxgalter"] },
  { path: "/tech-orders",   methods: ["POST", "PUT", "PATCH", "DELETE"], roles: DOCTOR_WRITE },

  // --- Davomat: barcha hodim ko'radi, faqat admin va registrator yozadi/o'chiradi ---
  { path: "/attendance", methods: ["GET"], roles: ALL_STAFF },
  { path: "/attendance", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: FRONT_DESK },
];

// Autentifikatsiya talab qilinmaydigan path'lar (auth.ts'da batafsil belgilangan).
const PUBLIC_PREFIXES = ["/healthz", "/docs", "/openapi", "/auth/"];

// Bosh sahifa uchun public GET endpoints (auth.ts'ga mos)
const PUBLIC_GET = new Set(["/employees", "/services", "/service-categories", "/assignments"]);
const PUBLIC_SETTING_KEYS = new Set(["ssd-contact-settings", "ssd-promo-settings", "ssd-clinic-info"]);

function isPublic(path: string, method?: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (method === "GET" || method === "HEAD") {
    if (PUBLIC_GET.has(path)) return true;
    const m = path.match(/^\/settings\/([^/]+)$/);
    if (m && PUBLIC_SETTING_KEYS.has(decodeURIComponent(m[1]))) return true;
  }
  return false;
}

function findRule(path: string, method: string): Rule | undefined {
  // Eng aniq (uzun) prefix birinchi tanlanadi.
  const matches = RULES.filter((r) => path.startsWith(r.path));
  matches.sort((a, b) => b.path.length - a.path.length);
  for (const r of matches) {
    if (!r.methods || r.methods.includes(method as Methods)) return r;
  }
  return undefined;
}

export function rbac(req: Request, res: Response, next: NextFunction) {
  if (process.env.AUTH_DISABLED === "true") return next();
  if (req.method === "OPTIONS") return next();
  if (isPublic(req.path, req.method)) return next();

  const authUser = (req as any).authUser as { role?: Role } | undefined;
  const apiKey = (req as any).apiKey as { scope?: string } | undefined;

  // API key bo'lsa (mobil/integratsiya) — scope orqali boshqaramiz
  // (readonly tekshirish auth.ts'da amalga oshirilgan)
  if (apiKey && !authUser) return next();

  if (!authUser || !authUser.role) {
    return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
  }

  const role = authUser.role;

  // Admin har doim ruxsat etilgan
  if (role === "admin") return next();

  const rule = findRule(req.path, req.method);
  const denied = !rule || !rule.roles.includes(role);

  if (denied) {
    // Audit log — kim, qayerga, qaysi usul bilan urindi (block qilindi)
    logDeny(req, authUser as any).catch(() => {});
    return res.status(403).json({ error: "Ushbu amalga ruxsat yo'q" });
  }

  next();
}

// Ruxsatsiz urinishni audit'ga yozish (asinxron, best-effort)
async function logDeny(req: Request, authUser: { sub?: string; role?: string }) {
  try {
    await db.insert(auditLogsTable).values({
      id: randomUUID(),
      actor: authUser.sub ?? null,
      action: "access:denied",
      entity: "endpoint",
      entityId: `${req.method} ${req.path}`,
      before: null,
      after: { role: authUser.role, ip: req.ip ?? null, ua: req.header("user-agent") ?? null },
      at: Date.now(),
    });
  } catch { /* swallow */ }
}
