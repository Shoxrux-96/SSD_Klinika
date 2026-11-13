import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { sql, and, eq, ne } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, employeesTable } from "@workspace/db";
import { safeErrorMessage } from "../lib/safeError";

const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
type WorkHours = Partial<Record<(typeof DAY_KEYS)[number], [string, string] | null>>;

const ALL_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = 9 * 60; m < 23 * 60; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

function unavailableSlotsForDay(workHours: WorkHours | null | undefined, offDates: string[] | null | undefined, date: string): string[] {
  if (offDates && Array.isArray(offDates) && offDates.includes(date)) return [...ALL_SLOTS];
  if (!workHours) return [];
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const key = DAY_KEYS[day];
  const window = workHours[key];
  if (window === null || window === undefined) return [...ALL_SLOTS];
  if (!Array.isArray(window) || window.length !== 2) return [];
  const [from, to] = window;
  const toMin = (s: string) => { const [h, mm] = s.split(":").map(Number); return h * 60 + mm; };
  const f = toMin(from), t = toMin(to);
  return ALL_SLOTS.filter((h) => { const x = toMin(h); return x < f || x >= t; });
}

const router: IRouter = Router();

// Qat'iy IP cheklov: har 10 daqiqada 5 ta qabul so'rovi
const appointmentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p so'rov. 10 daqiqadan keyin qayta urinib ko'ring." },
});

function normalizePhone(raw: unknown): string {
  const s = String(raw ?? "").replace(/[^\d+]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("998") && s.length >= 12) return `+${s}`;
  if (s.length === 9) return `+998${s}`;
  return s;
}

function isValidDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function isValidTime(t: unknown): t is string {
  return typeof t === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(t);
}
function isPastDateTime(date: string, time: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return dt.getTime() < Date.now() - 60 * 1000;
}

// Shifokorning tanlangan sanada band vaqtlari (ish jadvali tashqarisi ham "band")
router.get("/public/busy-slots", async (req, res) => {
  const date = String(req.query.date ?? "");
  const doctorId = String(req.query.doctorId ?? "");
  if (!isValidDate(date) || !doctorId) {
    return res.status(400).json({ error: "date va doctorId talab qilinadi" });
  }
  const [rows, doc] = await Promise.all([
    db
      .select({ time: appointmentsTable.time })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.date, date),
          eq(appointmentsTable.doctorId, doctorId),
          ne(appointmentsTable.status, "bekor"),
        ),
      ),
    db
      .select({
        workHours: sql<WorkHours | null>`work_hours`,
        offDates: sql<string[] | null>`off_dates`,
      })
      .from(employeesTable)
      .where(eq(employeesTable.id, doctorId))
      .limit(1),
  ]);
  const busy = new Set(rows.map((r) => r.time));
  if (doc[0]) {
    for (const t of unavailableSlotsForDay(doc[0].workHours ?? null, doc[0].offDates ?? null, date)) {
      busy.add(t);
    }
  }
  res.json({ busy: Array.from(busy) });
});

async function verifyTurnstile(token: string | undefined, ip: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // kalit sozlanmagan — tekshiruv o'chirilgan
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) return false;
    const j: any = await r.json();
    return j?.success === true;
  } catch { return false; }
}

// Public qabul so'rovi — anonim foydalanuvchidan
router.post("/public/appointment", appointmentLimiter, async (req, res) => {
  try {
    const b = req.body ?? {};
    const captchaOk = await verifyTurnstile(b.turnstileToken, req.ip);
    if (!captchaOk) return res.status(400).json({ error: "CAPTCHA tekshiruvdan o'tmadi" });
    const fullName = String(b.fullName ?? b.patient ?? "").trim();
    const phone = normalizePhone(b.phone);
    const date = String(b.date ?? "");
    const time = String(b.time ?? "");
    const doctor = String(b.doctor ?? "").trim();
    const doctorId = String(b.doctorId ?? "").trim();
    const service = String(b.service ?? "").trim();
    const serviceId = String(b.serviceId ?? "").trim();

    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      return res.status(400).json({ error: "Ism noto'g'ri" });
    }
    if (!/^\+?\d{9,15}$/.test(phone)) {
      return res.status(400).json({ error: "Telefon raqam noto'g'ri" });
    }
    if (!isValidDate(date) || !isValidTime(time)) {
      return res.status(400).json({ error: "Sana yoki vaqt noto'g'ri" });
    }
    if (isPastDateTime(date, time)) {
      return res.status(400).json({ error: "O'tgan vaqtni tanlab bo'lmaydi" });
    }
    if (!doctor || !doctorId || !service || !serviceId) {
      return res.status(400).json({ error: "Shifokor va xizmat talab qilinadi" });
    }

    // Slot konflikt tekshiruvi
    const existing = await db
      .select({ id: appointmentsTable.id })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.date, date),
          eq(appointmentsTable.time, time),
          eq(appointmentsTable.doctorId, doctorId),
          ne(appointmentsTable.status, "bekor"),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Bu vaqt band — boshqa vaqtni tanlang" });
    }

    // Bemor upsert telefon raqami bo'yicha
    let patientId: string;
    const foundPatient = await db
      .select({ id: patientsTable.id, fullName: patientsTable.fullName })
      .from(patientsTable)
      .where(eq(patientsTable.phone, phone))
      .limit(1);
    if (foundPatient.length > 0) {
      patientId = foundPatient[0].id;
    } else {
      patientId = randomUUID();
      await db.insert(patientsTable).values({
        id: patientId,
        fullName,
        phone,
        address: "",
        addedAt: Date.now(),
      });
    }

    // Qabul yozuvi
    const apptId = randomUUID();
    const [created] = await db
      .insert(appointmentsTable)
      .values({
        id: apptId,
        date,
        time,
        patient: fullName,
        patientId,
        doctor,
        doctorId,
        service,
        serviceId,
        status: "kutilmoqda",
      })
      .returning();

    res.status(201).json({ ok: true, appointment: created });
  } catch (e: any) {
    res.status(400).json({ error: safeErrorMessage(e, "So'rovni qabul qilib bo'lmadi") });
  }
});

export default router;
