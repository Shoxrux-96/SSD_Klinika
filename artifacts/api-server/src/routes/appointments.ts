import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, appointmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/appointments", async (_req, res) => {
  const rows = await db.select().from(appointmentsTable);
  res.json(rows);
});

router.get("/appointments/:id", async (req, res) => {
  const [row] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/appointments", async (req, res) => {
  const b = req.body ?? {};
  const row = {
    id: b.id ?? randomUUID(),
    date: b.date ?? "",
    time: b.time ?? "",
    patient: b.patient ?? "",
    doctor: b.doctor ?? "",
    service: b.service ?? "",
    status: b.status ?? "kutilmoqda",
  };
  const [created] = await db.insert(appointmentsTable).values(row).returning();
  res.status(201).json(created);
});

async function updateAppointment(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  const [row] = await db
    .update(appointmentsTable)
    .set(patch)
    .where(eq(appointmentsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}
router.put("/appointments/:id", updateAppointment);
router.patch("/appointments/:id", updateAppointment);

router.delete("/appointments/:id", async (req, res) => {
  const [row] = await db
    .delete(appointmentsTable)
    .where(eq(appointmentsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
