import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  db,
  employeesTable,
  authSessionsTable,
  loginAttemptsTable,
  auditLogsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "ssd-klinika-dev-secret-change-me";
const JWT_EXPIRES_IN_SEC = 8 * 60 * 60; // 8 soat
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 daqiqa
const LOCKOUT_MAX_FAILURES = 5; // 15 daqiqada 5 ta xato = qulflash

// Brute-force himoyasi: har IP uchun 15 daqiqada 20 urinish
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining." },
});

/** scrypt: salt:hash formatida saqlaymiz */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  shifokor: "/clinic",
  laborant: "/clinic",
  registrator: "/reception",
  kassir: "/cashier",
  buxgalter: "/cashier",
  oddiy: "/no-access",
};

// Zod sxemalari — inputni qattiq validatsiya qilib SQLi/injectionni butunlay yopadi
const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
});

function clientInfo(req: Request) {
  const ip = (req.ip ?? "").slice(0, 60);
  const ua = (req.header("user-agent") ?? "").slice(0, 300);
  return { ip, ua };
}

async function recordAttempt(username: string, success: boolean, reason: string | null, req: Request) {
  const { ip, ua } = clientInfo(req);
  try {
    await db.insert(loginAttemptsTable).values({
      id: randomUUID(),
      username: username.slice(0, 120),
      ip,
      userAgent: ua,
      success,
      reason,
      at: Date.now(),
    });
  } catch (e) {
    logger.warn({ err: e }, "loginAttempts insert failed");
  }
}

async function isLockedOut(username: string): Promise<boolean> {
  const since = Date.now() - LOCKOUT_WINDOW_MS;
  // SQL injection xavfsiz: parametrizatsiya qilingan Drizzle count
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginAttemptsTable)
    .where(
      and(
        eq(loginAttemptsTable.username, username),
        eq(loginAttemptsTable.success, false),
        gte(loginAttemptsTable.at, since),
      ),
    );
  const n = Number(rows[0]?.n ?? 0);
  return n >= LOCKOUT_MAX_FAILURES;
}

router.post("/auth/login", loginLimiter, async (req, res) => {
  // 1) Zod validatsiya — begona maydon/noto'g'ri tip kirmaydi
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    await recordAttempt(String(req.body?.username ?? "-"), false, "bad_input", req);
    return res.status(400).json({ error: "Login va parol to'g'ri formatda bo'lishi kerak" });
  }
  const { username, password } = parsed.data;

  // 2) Account lockout tekshiruvi
  if (await isLockedOut(username)) {
    await recordAttempt(username, false, "locked_out", req);
    return res.status(429).json({ error: "Hisob vaqtincha bloklangan. 15 daqiqadan so'ng qayta urining." });
  }

  // 3) Foydalanuvchini topish
  const [row] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.username, username));
  if (!row || row.archived) {
    await recordAttempt(username, false, "user_not_found", req);
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }
  if (!row.passwordHash || !verifyPassword(password, row.passwordHash)) {
    await recordAttempt(username, false, "bad_password", req);
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }

  // 4) Yangi sessiya yaratish (jti = session id)
  const { ip, ua } = clientInfo(req);
  const now = Date.now();
  const sessionId = randomUUID();
  const expiresAt = now + JWT_EXPIRES_IN_SEC * 1000;

  await db.insert(authSessionsTable).values({
    id: sessionId,
    employeeId: row.id,
    username: row.username ?? username,
    role: row.role ?? "oddiy",
    ip,
    userAgent: ua,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    revoked: false,
    revokedAt: null,
  });

  const token = jwt.sign(
    { sub: row.id, role: row.role, name: row.fullName, jti: sessionId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN_SEC },
  );

  // 5) Audit
  await recordAttempt(username, true, null, req);
  try {
    await db.insert(auditLogsTable).values({
      id: randomUUID(),
      actor: row.id,
      action: "login",
      entity: "employee",
      entityId: row.id,
      before: null,
      after: { ip, ua, sessionId },
      at: now,
    });
  } catch { /* audit — best effort */ }

  res.json({
    token,
    user: {
      id: row.id,
      fullName: row.fullName,
      role: row.role,
      username: row.username,
      category: row.category,
      home: ROLE_HOME[row.role] ?? "/no-access",
    },
  });
});

router.get("/auth/me", async (req, res) => {
  const hdr = req.header("authorization") ?? "";
  const token = hdr.replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    // Sessiya DB'da mavjud va revoked emasligini tekshiramiz
    if (payload.jti) {
      const [s] = await db
        .select()
        .from(authSessionsTable)
        .where(eq(authSessionsTable.id, payload.jti));
      if (!s || s.revoked || s.expiresAt < Date.now()) {
        return res.status(401).json({ error: "Sessiya tugagan yoki bekor qilingan" });
      }
      // Last-seen yangilash
      await db
        .update(authSessionsTable)
        .set({ lastSeenAt: Date.now() })
        .where(eq(authSessionsTable.id, payload.jti));
    }

    const [row] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, payload.sub));
    if (!row || row.archived) return res.status(401).json({ error: "User topilmadi" });
    res.json({
      id: row.id,
      fullName: row.fullName,
      role: row.role,
      username: row.username,
      category: row.category,
      home: ROLE_HOME[row.role] ?? "/no-access",
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Logout — sessiyani revoke qiladi; token qaytib ishlamaydi
router.post("/auth/logout", async (req, res) => {
  const hdr = req.header("authorization") ?? "";
  const token = hdr.replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(204).end();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.jti) {
      await db
        .update(authSessionsTable)
        .set({ revoked: true, revokedAt: Date.now() })
        .where(eq(authSessionsTable.id, payload.jti));
      await db.insert(auditLogsTable).values({
        id: randomUUID(),
        actor: payload.sub ?? null,
        action: "logout",
        entity: "employee",
        entityId: payload.sub ?? null,
        before: null,
        after: { sessionId: payload.jti },
        at: Date.now(),
      }).catch(() => {});
    }
  } catch { /* expired / bad token → bari bir logout */ }
  res.status(204).end();
});

// Hozirgi foydalanuvchining barcha faol sessiyalarini ro'yxati (admin / self)
router.get("/auth/sessions", async (req, res) => {
  const hdr = req.header("authorization") ?? "";
  const token = hdr.replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const rows = await db
      .select()
      .from(authSessionsTable)
      .where(eq(authSessionsTable.employeeId, payload.sub));
    res.json(
      rows
        .filter((s) => !s.revoked && s.expiresAt > Date.now())
        .map((s) => ({
          id: s.id,
          ip: s.ip,
          userAgent: s.userAgent,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          lastSeenAt: s.lastSeenAt,
          current: s.id === payload.jti,
        })),
    );
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Barcha boshqa sessiyalarni bekor qilish (logout-everywhere-else)
router.post("/auth/sessions/revoke-others", async (req, res) => {
  const hdr = req.header("authorization") ?? "";
  const token = hdr.replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    await db
      .update(authSessionsTable)
      .set({ revoked: true, revokedAt: Date.now() })
      .where(
        and(
          eq(authSessionsTable.employeeId, payload.sub),
          eq(authSessionsTable.revoked, false),
        ),
      );
    // O'z sessiyamizni qaytarib tiklaymiz
    if (payload.jti) {
      await db
        .update(authSessionsTable)
        .set({ revoked: false, revokedAt: null })
        .where(eq(authSessionsTable.id, payload.jti));
    }
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
