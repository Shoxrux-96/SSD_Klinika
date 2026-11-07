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

router.post("/patients", async (req, res) => {
  const b = req.body ?? {};
  if (!b.fullName) return res.status(400).json({ error: "fullName required" });
  const row = {
    id: b.id ?? randomUUID(),
    fullName: String(b.fullName),
    phone: b.phone ?? "",
    address: b.address ?? "",
    region: b.region ?? null,
    district: b.district ?? null,
    gender: b.gender ?? null,
    birthDate: b.birthDate ?? null,
    passport: b.passport ?? null,
    addedAt: b.addedAt ?? Date.now(),
    archived: Boolean(b.archived),
  };
  const [created] = await db.insert(patientsTable).values(row).returning();
  res.status(201).json(created);
});

async function updatePatient(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  delete patch.addedAt;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  const [row] = await db
    .update(patientsTable)
    .set(patch)
    .where(eq(patientsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
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
