import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { callTasksTable, callLogsTable, db } from "@workspace/db";

const router: IRouter = Router();

/* ============ Call tasks ============ */
router.get("/call-tasks", async (_req, res) => {
  const rows = await db.select().from(callTasksTable).orderBy(desc(callTasksTable.createdAt));
  res.json(rows);
});

router.post("/call-tasks", async (req, res) => {
  const b = req.body ?? {};
  if (!b.patient || !b.reason || !b.dueDate) {
    return res.status(400).json({ error: "patient, reason, dueDate kerak" });
  }
  const row = {
    id: b.id ?? randomUUID(),
    patientId: b.patientId ?? null,
    patient: String(b.patient),
    phone: b.phone ?? null,
    doctor: b.doctor ?? null,
    reason: String(b.reason),
    priority: ["oddiy", "muhim", "shoshilinch"].includes(b.priority) ? b.priority : "oddiy",
    dueDate: String(b.dueDate),
    status: ["kutilmoqda", "bajarildi", "bekor"].includes(b.status) ? b.status : "kutilmoqda",
    completedAt: b.completedAt ?? null,
    note: b.note ?? null,
    createdAt: Date.now(),
  };
  try {
    const [created] = await db.insert(callTasksTable).values(row).returning();
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Insert failed" });
  }
});

router.patch("/call-tasks/:id", async (req, res) => {
  const b = req.body ?? {};
  const patch: Record<string, any> = {};
  if (b.status !== undefined) patch.status = b.status;
  if (b.priority !== undefined) patch.priority = b.priority;
  if (b.dueDate !== undefined) patch.dueDate = b.dueDate;
  if (b.completedAt !== undefined) patch.completedAt = b.completedAt;
  if (b.note !== undefined) patch.note = b.note;
  if (b.reason !== undefined) patch.reason = b.reason;
  if (b.doctor !== undefined) patch.doctor = b.doctor;
  if (b.phone !== undefined) patch.phone = b.phone;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Hech nima o'zgarmadi" });
  try {
    const [updated] = await db.update(callTasksTable).set(patch).where(eq(callTasksTable.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Update failed" });
  }
});

router.delete("/call-tasks/:id", async (req, res) => {
  const result = await db.delete(callTasksTable).where(eq(callTasksTable.id, req.params.id));
  res.status(result.rowCount && result.rowCount > 0 ? 204 : 404).end();
});

/* ============ Call logs ============ */
router.get("/call-logs", async (_req, res) => {
  const rows = await db.select().from(callLogsTable).orderBy(desc(callLogsTable.at));
  res.json(rows);
});

router.post("/call-logs", async (req, res) => {
  const b = req.body ?? {};
  if (!b.patient || !b.outcome) {
    return res.status(400).json({ error: "patient, outcome kerak" });
  }
  const row = {
    id: b.id ?? randomUUID(),
    taskId: b.taskId ?? null,
    patient: String(b.patient),
    phone: b.phone ?? null,
    outcome: String(b.outcome),
    duration: b.duration ?? null,
    note: b.note ?? null,
    at: b.at ?? Date.now(),
  };
  try {
    const [created] = await db.insert(callLogsTable).values(row).returning();
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Insert failed" });
  }
});

export default router;
