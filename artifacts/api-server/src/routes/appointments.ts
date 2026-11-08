import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, appointmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { safeErrorMessage } from "../lib/safeError";

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
  try {
    const b = req.body ?? {};
    const row = {
      id: b.id ?? randomUUID(),
      date: b.date ?? "",
      time: b.time ?? "",
      patient: b.patient ?? "",
      patientId: b.patientId ?? null,
      doctor: b.doctor ?? "",
      doctorId: b.doctorId ?? null,
      service: b.service ?? "",
      serviceId: b.serviceId ?? null,
      status: b.status ?? "kutilmoqda",
    };
    const [created] = await db.insert(appointmentsTable).values(row).returning();
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: safeErrorMessage(e, "Qabulni qo'shishda xatolik") });
  }
});

async function updateAppointment(req: any, res: any) {
  try {
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
  } catch (e: any) {
    res.status(400).json({ error: safeErrorMessage(e, "Qabulni yangilashda xatolik") });
  }
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
