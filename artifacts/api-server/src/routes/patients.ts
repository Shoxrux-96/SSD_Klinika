import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, patientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/patients", async (_req, res) => {
  const rows = await db.select().from(patientsTable).orderBy(patientsTable.addedAt);
  res.json(rows);
});

router.get("/patients/:id", async (req, res) => {
  const [row] = await db.select().from(patientsTable).where(eq(patientsTable.id, req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

function normalizeJshshir(v: unknown): string | null {
  if (v == null) return null;
  const digits = String(v).replace(/\D/g, "");
  return digits || null;
}
function validateJshshir(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const j = normalizeJshshir(v);
  if (!j) return { ok: false, error: "JSHSHIR majburiy" };
  if (j.length !== 14) return { ok: false, error: "JSHSHIR to'liq 14 raqamdan iborat bo'lishi kerak" };
  return { ok: true, value: j };
}

router.post("/patients", async (req, res) => {
  const b = req.body ?? {};
  const name = String(b.fullName ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  const gender = b.gender ? String(b.gender).trim() : "";
  const birthDate = b.birthDate ? String(b.birthDate).trim() : "";
  if (!name) return res.status(400).json({ error: "To'liq ism majburiy" });
  if (!phone || phone === "+998") return res.status(400).json({ error: "Telefon raqami majburiy" });
  if (gender !== "erkak" && gender !== "ayol") return res.status(400).json({ error: "Jinsini tanlang" });
  if (!birthDate) return res.status(400).json({ error: "Tug'ilgan sana majburiy" });
  const jv = validateJshshir(b.jshshir);
  if (!jv.ok) return res.status(400).json({ error: jv.error });
  const row = {
    id: b.id ?? randomUUID(),
    fullName: name,
    phone,
    address: b.address ?? "",
    region: b.region ?? null,
    district: b.district ?? null,
    gender,
    birthDate,
    jshshir: jv.value,
    addedAt: b.addedAt ?? Date.now(),
    archived: Boolean(b.archived),
  };
  try {
    const [created] = await db.insert(patientsTable).values(row).returning();
    res.status(201).json(created);
  } catch (e: any) {
    if (String(e?.message ?? "").match(/unique|duplicate/i)) {
      return res.status(409).json({ error: "Bu JSHSHIR bilan bemor allaqachon roʻyxatdan oʻtgan" });
    }
    throw e;
  }
});

async function updatePatient(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  delete patch.addedAt;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  if (patch.fullName !== undefined) {
    const name = String(patch.fullName).trim();
    if (!name) return res.status(400).json({ error: "To'liq ism majburiy" });
    patch.fullName = name;
  }
  if (patch.phone !== undefined) {
    const phone = String(patch.phone).trim();
    if (!phone || phone === "+998") return res.status(400).json({ error: "Telefon raqami majburiy" });
    patch.phone = phone;
  }
  if (patch.gender !== undefined) {
    const g = String(patch.gender ?? "").trim();
    if (g !== "erkak" && g !== "ayol") return res.status(400).json({ error: "Jinsini tanlang" });
    patch.gender = g;
  }
  if (patch.birthDate !== undefined) {
    const bd = String(patch.birthDate ?? "").trim();
    if (!bd) return res.status(400).json({ error: "Tug'ilgan sana majburiy" });
    patch.birthDate = bd;
  }
  if (patch.jshshir !== undefined) {
    const jv = validateJshshir(patch.jshshir);
    if (!jv.ok) return res.status(400).json({ error: jv.error });
    patch.jshshir = jv.value;
  }
  try {
    const [row] = await db
      .update(patientsTable)
      .set(patch)
      .where(eq(patientsTable.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e: any) {
    if (String(e?.message ?? "").match(/unique|duplicate/i)) {
      return res.status(409).json({ error: "Bu JSHSHIR bilan bemor allaqachon roʻyxatdan oʻtgan" });
    }
    throw e;
  }
}
router.put("/patients/:id", updatePatient);
router.patch("/patients/:id", updatePatient);

router.delete("/patients/:id", async (req, res) => {
  const [row] = await db
    .delete(patientsTable)
    .where(eq(patientsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
