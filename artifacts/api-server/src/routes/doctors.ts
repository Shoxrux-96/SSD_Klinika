import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { safeErrorMessage } from "../lib/safeError";

const router: IRouter = Router();

const VALID_ROLES = new Set([
  "admin",
  "shifokor",
  "laborant",
  "registrator",
  "kassir",
  "buxgalter",
  "oddiy",
]);

// Login/parol/hash maydonlarini client'ga chiqarmasdan, hasPassword bayrog'ini qaytaradi.
function sanitize(row: any) {
  if (!row) return row;
  const { passwordHash, ...rest } = row;
  return { ...rest, hasPassword: !!passwordHash };
}

router.get("/employees", async (_req, res) => {
  const rows = await db.select().from(employeesTable).orderBy(employeesTable.addedAt);
  res.json(rows.map(sanitize));
});

router.get("/employees/:id", async (req, res) => {
  const [row] = await db.select().from(employeesTable).where(eq(employeesTable.id, req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(sanitize(row));
});

router.post("/employees", async (req, res) => {
  const b = req.body ?? {};
  if (!b.fullName) return res.status(400).json({ error: "fullName required" });
  try {
    const role = typeof b.role === "string" && VALID_ROLES.has(b.role) ? b.role : "oddiy";
    const row = {
      id: b.id ?? randomUUID(),
      category: b.category ?? "medical",
      photo: b.photo ?? null,
      fullName: String(b.fullName),
      phone: b.phone ?? "",
      email: b.email ?? "",
      position: b.position ?? "",
      specialty: b.specialty ?? "",
      experience: b.experience ?? "",
      diploma: b.diploma ?? "",
      addedAt: b.addedAt ?? Date.now(),
      archived: Boolean(b.archived),
      // Auth maydonlari
      username: typeof b.username === "string" && b.username.trim().length > 0 ? b.username.trim() : null,
      passwordHash: typeof b.password === "string" && b.password.length >= 8 ? hashPassword(b.password) : null,
      role,
    };
    const [created] = await db.insert(employeesTable).values(row).returning();
    res.status(201).json(sanitize(created));
  } catch (e: any) {
    res.status(400).json({ error: safeErrorMessage(e, "Hodimni qo'shishda xatolik") });
  }
});

async function updateEmployee(req: any, res: any) {
  try {
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};

    // Oddiy maydonlar
    for (const k of [
      "category", "photo", "fullName", "phone", "email",
      "position", "specialty", "experience", "diploma", "archived", "username", "workHours", "offDates",
    ]) {
      if (b[k] !== undefined) patch[k] = b[k];
    }
    // Role ni validatsiya qilib qabul qilish
    if (b.role !== undefined) {
      if (typeof b.role !== "string" || !VALID_ROLES.has(b.role)) {
        return res.status(400).json({ error: "Noto'g'ri rol" });
      }
      patch.role = b.role;
    }
    // Parol yangilanmoqchi bo'lsa — hash qilib yoziladi (kamida 8 ta belgi)
    if (typeof b.password === "string" && b.password.length > 0) {
      if (b.password.length < 8) return res.status(400).json({ error: "Parol kamida 8 ta belgi bo'lishi kerak" });
      patch.passwordHash = hashPassword(b.password);
    }

    delete patch.id;
    delete (patch as any).addedAt;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });

    const [row] = await db
      .update(employeesTable)
      .set(patch as any)
      .where(eq(employeesTable.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(sanitize(row));
  } catch (e: any) {
    res.status(400).json({ error: safeErrorMessage(e, "Hodimni yangilashda xatolik") });
  }
}
router.put("/employees/:id", updateEmployee);
router.patch("/employees/:id", updateEmployee);

router.delete("/employees/:id", async (req, res) => {
  const [row] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
