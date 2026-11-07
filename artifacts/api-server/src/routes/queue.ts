import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, queueItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/queue", async (_req, res) => {
  const rows = await db.select().from(queueItemsTable).orderBy(queueItemsTable.addedAt);
  res.json(rows);
});

router.post("/queue", async (req, res) => {
  const b = req.body ?? {};
  const row = {
    id: b.id ?? randomUUID(),
    number: b.number ?? "",
    patient: b.patient ?? "",
    doctor: b.doctor ?? "",
    service: b.service ?? "",
    addedAt: b.addedAt ?? Date.now(),
    status: b.status ?? "navbatda",
  };
  const [created] = await db.insert(queueItemsTable).values(row).returning();
  res.status(201).json(created);
});

async function updateQueue(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  const [row] = await db
    .update(queueItemsTable)
    .set(patch)
    .where(eq(queueItemsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}
router.put("/queue/:id", updateQueue);
router.patch("/queue/:id", updateQueue);

router.delete("/queue/:id", async (req, res) => {
  const [row] = await db
    .delete(queueItemsTable)
    .where(eq(queueItemsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
