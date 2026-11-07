import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  db,
  servicesTable,
  serviceCategoriesTable,
  serviceAssignmentsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router();

// --- Service categories ---
router.get("/service-categories", async (_req, res) => {
  const rows = await db.select().from(serviceCategoriesTable);
  res.json(rows);
});

router.post("/service-categories", async (req, res) => {
  const b = req.body ?? {};
  if (!b.name) return res.status(400).json({ error: "name required" });
  const row = {
    id: b.id ?? randomUUID(),
    name: String(b.name),
    color: b.color ?? "#64748b",
  };
  const [created] = await db.insert(serviceCategoriesTable).values(row).returning();
  res.status(201).json(created);
});

async function updateCategory(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  const [row] = await db
    .update(serviceCategoriesTable)
    .set(patch)
    .where(eq(serviceCategoriesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}
router.put("/service-categories/:id", updateCategory);
router.patch("/service-categories/:id", updateCategory);

router.delete("/service-categories/:id", async (req, res) => {
  const [row] = await db
    .delete(serviceCategoriesTable)
    .where(eq(serviceCategoriesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  // cascade remove services and assignments in this category
  const removed = await db
    .delete(servicesTable)
    .where(eq(servicesTable.categoryId, req.params.id))
    .returning({ id: servicesTable.id });
  for (const s of removed) {
    await db.delete(serviceAssignmentsTable).where(eq(serviceAssignmentsTable.serviceId, s.id));
  }
  res.status(204).send();
});

// --- Services ---
router.get("/services", async (_req, res) => {
  const rows = await db.select().from(servicesTable);
  res.json(rows);
});

router.post("/services", async (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !b.categoryId) {
    return res.status(400).json({ error: "name and categoryId required" });
  }
  const row = {
    id: b.id ?? randomUUID(),
    categoryId: String(b.categoryId),
    name: String(b.name),
    price: Number(b.price ?? 0),
    currency: b.currency ?? "som",
    somValue: b.somValue != null ? Number(b.somValue) : null,
    doctorShare: Number(b.doctorShare ?? 0),
    archived: Boolean(b.archived),
  };
  const [created] = await db.insert(servicesTable).values(row).returning();
  res.status(201).json(created);
});

async function updateService(req: any, res: any) {
  const patch = { ...req.body };
  delete patch.id;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields" });
  const [row] = await db
    .update(servicesTable)
    .set(patch)
    .where(eq(servicesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}
router.put("/services/:id", updateService);
router.patch("/services/:id", updateService);

router.delete("/services/:id", async (req, res) => {
  const [row] = await db
    .delete(servicesTable)
    .where(eq(servicesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  await db
    .delete(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.serviceId, req.params.id));
  res.status(204).send();
});

// --- Assignments ---
router.get("/assignments", async (_req, res) => {
  const rows = await db.select().from(serviceAssignmentsTable);
  res.json(rows);
});

router.post("/assignments/toggle", async (req, res) => {
  const { employeeId, serviceId } = req.body ?? {};
  if (!employeeId || !serviceId) {
    return res.status(400).json({ error: "employeeId and serviceId required" });
  }
  const [existing] = await db
    .select()
    .from(serviceAssignmentsTable)
    .where(
      and(
        eq(serviceAssignmentsTable.employeeId, employeeId),
        eq(serviceAssignmentsTable.serviceId, serviceId),
      ),
    );
  if (existing) {
    await db
      .delete(serviceAssignmentsTable)
      .where(
        and(
          eq(serviceAssignmentsTable.employeeId, employeeId),
          eq(serviceAssignmentsTable.serviceId, serviceId),
        ),
      );
    return res.json({ assigned: false });
  }
  await db.insert(serviceAssignmentsTable).values({ employeeId, serviceId });
  res.json({ assigned: true });
});

router.put("/assignments/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  const serviceIds: string[] = Array.isArray(req.body?.serviceIds) ? req.body.serviceIds : [];
  await db
    .delete(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.employeeId, employeeId));
  if (serviceIds.length > 0) {
    await db
      .insert(serviceAssignmentsTable)
      .values(serviceIds.map((serviceId) => ({ employeeId, serviceId })));
  }
  const rows = await db
    .select()
    .from(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.employeeId, employeeId));
  res.json(rows);
});

export default router;
