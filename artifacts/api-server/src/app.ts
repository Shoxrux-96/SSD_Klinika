import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiKeyAuth } from "./middlewares/auth";

const app: Express = express();

// Nginx orqasida ishlagan uchun haqiqiy client IP ni X-Forwarded-For dan olish.
// Shu bilan rate-limit va audit log to'g'ri ishlaydi.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        const ip =
          (req.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        return { id: req.id, method: req.method, url: req.url?.split("?")[0], ip };
      },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

// --- Xavfsizlik sarlavhalari (Helmet) ---
// X-Frame-Options (clickjacking), X-Content-Type-Options, Strict-Transport-Security,
// Referrer-Policy, Cross-Origin-Resource-Policy, X-DNS-Prefetch-Control, ...
app.use(
  helmet({
    // CSP ni o'zimiz yozamiz (API uchun yumshoq)
    contentSecurityPolicy: false,
    // SPA va iframe-lar bilan muammo bo'lmasin
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS — prodda ALLOWED_ORIGINS orqali oq ro'yxat; dev yoki bo'sh bo'lsa reflect-origin
const corsAllowList = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigin: any =
  process.env.NODE_ENV === "production" && corsAllowList.length > 0
    ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return cb(null, true);
        cb(null, corsAllowList.includes(origin));
      }
    : true;
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    exposedHeaders: ["x-total-count"],
  }),
);

// --- Body parser (DoS'ga qarshi: kichik limit) ---
// Oldin 10mb edi — JSON payload uchun 256kb yetarli, katta fayl upload bu API'da yo'q.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// --- Global rate limit (DDoS/DoS himoyasi) ---
// Har IP uchun 1 daqiqada 300 so'rov. Admin UI'ning normal ish hajmidan katta, lekin avtomat skanerni to'xtatadi.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Juda ko'p so'rov. Birozdan keyin qayta urining." },
  // Healthz'ni cheklamaymiz (monitoring uchun)
  skip: (req) => req.path === "/api/healthz" || req.path === "/healthz",
});
app.use(globalLimiter);

// CSP — API uchun qattiq (hech qanday skript/inline ruxsat emas)
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Chrome DevTools avtomatik probe — 204 bilan jim qaytarish
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

// Root — brauzerdan API'ga kirganda foydali JSON javob
app.get("/", (_req, res) => {
  res.json({
    service: "SSD Klinika API",
    docs: "/api/docs",
    health: "/api/healthz",
  });
});

app.use("/api", apiKeyAuth, router);

// Generic error handler so external systems always get JSON
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(err?.status ?? 500).json({
    error: err?.message ?? "Internal server error",
    code: err?.code,
  });
});

export default app;
