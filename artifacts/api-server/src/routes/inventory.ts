import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { techProductsTable, attendanceTable, db } from "@workspace/db";
import { crudRouter } from "../lib/crud";

const router: IRouter = Router();

// --- Tech products — mahsulotlar katalogi (narx + tannarx)
router.use(crudRouter({
  path: "/tech-products",
  table: techProductsTable,
  idColumn: techProductsTable.id,
  defaults: () => ({ addedAt: Date.now() }),
  orderBy: techProductsTable.addedAt,
}));

// --- Attendance — davomat (hodim × sana)
router.get("/attendance", async (_req, res) => {
  const rows = await db.select().from(attendanceTable);
  res.json(rows);
});

router.get("/attendance/:employeeId/:date", async (req, res) => {
  const [row] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.employeeId, req.params.employeeId), eq(attendanceTable.date, req.params.date)),
  );
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/attendance", async (req, res) => {
  const b = req.body ?? {};
  const employeeId = String(b.employeeId ?? "");
  const date = String(b.date ?? "");
  const status = String(b.status ?? "");
  if (!employeeId || !date || !["keldi", "kech", "kelmagan"].includes(status)) {
    return res.status(400).json({ error: "employeeId, date (YYYY-MM-DD), status (keldi|kech|kelmagan) kerak" });
  }
  // Mavjud bo'lsa — qaytarish; yangi — qo'shish (idempotent, lekin status o'zgarmaydi)
  const [existing] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, date)),
  );
  if (existing) return res.status(200).json(existing);
  const row = {
    id: b.id ?? randomUUID(),
    employeeId, date, status,
    createdAt: Date.now(),
  };
  try {
    const [created] = await db.insert(attendanceTable).values(row).returning();
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Insert failed" });
  }
});

router.delete("/attendance/:employeeId/:date", async (req, res) => {
  const result = await db.delete(attendanceTable).where(
    and(eq(attendanceTable.employeeId, req.params.employeeId), eq(attendanceTable.date, req.params.date)),
  );
  res.status(204).send();
});

export default router;
