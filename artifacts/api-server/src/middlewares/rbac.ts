import type { Request, Response, NextFunction } from "express";

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

// Faqat admin
const ADMIN = ["admin"] as const;

const RULES: Rule[] = [
  // --- Tizim boshqaruvi ---
  { path: "/users",       roles: [...ADMIN] },
  { path: "/api-keys",    roles: [...ADMIN] },
  { path: "/roles",       roles: [...ADMIN] },
  { path: "/audit-logs",  roles: [...ADMIN] },
  // Settings: o'qish — login qilgan hamma (klinika brending/promokod UI'da kerak).
  // Yozish — faqat admin.
  { path: "/settings", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"] },
  { path: "/settings", methods: ["PUT", "PATCH", "DELETE", "POST"], roles: [...ADMIN] },

  // --- Hodimlar ---
  { path: "/employees", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"] },
  { path: "/employees", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: [...ADMIN] },

  // --- Bemorlar — hamma rol o'qiydi, admin/registrator/shifokor yozadi ---
  { path: "/patients", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"] },
  { path: "/patients", methods: ["POST", "PUT", "PATCH"], roles: ["admin", "registrator", "shifokor"] },
  { path: "/patients", methods: ["DELETE"], roles: [...ADMIN] },

  // --- Qabul va navbat ---
  { path: "/appointments", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/appointments", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "registrator", "shifokor"] },
  { path: "/queue",        methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/queue",        methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "registrator", "shifokor"] },

  // --- Xizmatlar katalogi ---
  { path: "/services",          methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"] },
  { path: "/services",          methods: ["POST", "PUT", "PATCH", "DELETE"], roles: [...ADMIN] },
  { path: "/service-categories", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"] },
  { path: "/service-categories", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: [...ADMIN] },
  { path: "/assignments",       methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/assignments",       methods: ["POST", "PUT", "PATCH", "DELETE"], roles: [...ADMIN] },

  // --- Klinik yozuvlar ---
  { path: "/treatments", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/treatments", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "shifokor"] },

  { path: "/prescriptions", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/prescriptions", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "shifokor"] },

  { path: "/lab-results", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/lab-results", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "shifokor", "laborant"] },

  { path: "/dental-records", methods: ["GET"], roles: ["admin", "shifokor", "laborant", "registrator", "kassir"] },
  { path: "/dental-records", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "shifokor"] },

  // --- Moliya ---
  { path: "/transactions", methods: ["GET"], roles: ["admin", "kassir", "buxgalter"] },
  { path: "/transactions", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "kassir", "buxgalter"] },
  { path: "/payrolls",     methods: ["GET"], roles: ["admin", "kassir", "buxgalter"] },
  { path: "/payrolls",     methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "buxgalter"] },
  { path: "/finance",      roles: ["admin", "kassir", "buxgalter"] },
  { path: "/debts",        roles: ["admin", "kassir", "buxgalter", "registrator"] },

  // --- Hisobotlar ---
  { path: "/reports", methods: ["GET"], roles: ["admin", "kassir", "buxgalter"] },

  // --- Call markaz ---
  { path: "/call-tasks", methods: ["GET"], roles: ["admin", "registrator", "shifokor"] },
  { path: "/call-tasks", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "registrator"] },
  { path: "/call-logs",  methods: ["GET"], roles: ["admin", "registrator", "shifokor"] },
  { path: "/call-logs",  methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "registrator"] },

  // --- Inventar / davomat ---
  { path: "/tech-products", methods: ["GET"], roles: ["admin", "shifokor", "kassir", "buxgalter"] },
  { path: "/tech-products", methods: ["POST", "PUT", "PATCH", "DELETE"], roles: [...ADMIN] },
  { path: "/tech-orders",   methods: ["GET"], roles: ["admin", "shifokor", "kassir", "buxgalter"] },
  { path: "/tech-orders",   methods: ["POST", "PUT", "PATCH", "DELETE"], roles: ["admin", "shifokor"] },
  { path: "/attendance",    roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"] },
];

// Autentifikatsiya talab qilinmaydigan path'lar (auth.ts'da batafsil belgilangan).
const PUBLIC_PREFIXES = ["/healthz", "/docs", "/openapi", "/auth/"];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
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
  if (isPublic(req.path)) return next();

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
  if (!rule) {
    // Qoida yozilmagan endpoint — xavfsizlikning birinchi tamoyili: deny by default.
    // Admin bo'lmaganlar uchun to'sib qo'yamiz.
    return res.status(403).json({ error: "Ushbu amalga ruxsat yo'q" });
  }

  if (!rule.roles.includes(role)) {
    return res.status(403).json({ error: "Ushbu amalga ruxsat yo'q" });
  }

  next();
}
