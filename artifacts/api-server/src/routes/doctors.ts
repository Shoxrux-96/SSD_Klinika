import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/employees", async (_req, res) => {
  const rows = await db.select().from(employeesTable).orderBy(employeesTable.addedAt);
  res.json(rows);
});

router.get("/employees/:id", async (req, res) => {
  const [row] = await db.select().from(employeesTable).where(eq(employeesTable.id, req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/employees", async (req, res) => {
  const b = req.body ?? {};
  if (!b.fullName) return res.status(400).json({ error: "fullName required" });
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
  };
  const [created] = await db.insert(employeesTable).values(row).returning();
  res.status(201).json(created);
});

async function updateEmployee(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  delete patch.addedAt;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  const [row] = await db
    .update(employeesTable)
    .set(patch)
    .where(eq(employeesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
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
