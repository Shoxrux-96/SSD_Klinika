import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, apiKeysTable, authSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PUBLIC_PATHS = new Set([
  "/healthz",
  "/docs",
  "/openapi.yaml",
  "/auth/login",
  "/auth/me",
  "/auth/logout",
]);

const JWT_SECRET = process.env.JWT_SECRET ?? "ssd-klinika-dev-secret-change-me";

function isPublicPath(reqPath: string): boolean {
  if (PUBLIC_PATHS.has(reqPath)) return true;
  if (reqPath.startsWith("/docs")) return true;
  if (reqPath.startsWith("/api/docs")) return true;
  return PUBLIC_PATHS.has(reqPath.replace(/^\/api/, ""));
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.AUTH_DISABLED === "true") return next();
  if (isPublicPath(req.path)) return next();
  if (req.method === "OPTIONS") return next();

  const headerKey = req.header("x-api-key");
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const token = headerKey ?? bearer;

  if (!token) {
    return res.status(401).json({
      error: "Avtorizatsiya talab qilinadi. x-api-key yoki Authorization: Bearer <token>",
    });
  }

  // 1) JWT — employee login tokeni
  if (bearer && !headerKey) {
    try {
      const payload = jwt.verify(bearer, JWT_SECRET) as {
        sub: string;
        role?: string;
        name?: string;
        jti?: string;
      };

      // Sessiya mavjud va revoked emasligini tekshiramiz (logout/revocation)
      if (payload.jti) {
        const [s] = await db
          .select()
          .from(authSessionsTable)
          .where(eq(authSessionsTable.id, payload.jti));
        if (!s || s.revoked || s.expiresAt < Date.now()) {
          return res.status(401).json({ error: "Sessiya tugagan yoki bekor qilingan" });
        }
      }

      (req as any).authUser = payload;
      return next();
    } catch {
      // JWT emas — API key sifatida tekshiramiz
    }
  }

  // 2) API key — mobil/integratsiya kalitlari
  const [row] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, token));
  if (!row || !row.active) {
    return res.status(403).json({ error: "Yaroqsiz yoki faolsiz token" });
  }
  if (row.scope === "readonly" && !["GET", "HEAD"].includes(req.method)) {
    return res.status(403).json({ error: "Faqat o'qish uchun kalit" });
  }

  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: Date.now() })
    .where(eq(apiKeysTable.id, row.id));

  (req as any).apiKey = row;
  next();
}
