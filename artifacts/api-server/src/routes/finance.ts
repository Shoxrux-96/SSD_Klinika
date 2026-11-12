import { Router, type IRouter } from "express";
import {
  transactionsTable, payrollsTable, debtsTable, promoCodesTable, db,
} from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { crudRouter } from "../lib/crud";

const router: IRouter = Router();

router.use((req, res, next) => {
  if (!req.path.startsWith("/transactions")) return next();
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") return next();
  if (req.body?.type === "refund") {
    return res.status(400).json({ error: "Refund type is disabled" });
  }
  next();
});

router.use(crudRouter({
  path: "/transactions",
  table: transactionsTable,
  idColumn: transactionsTable.id,
  defaults: () => ({ createdAt: Date.now() }),
  orderBy: transactionsTable.createdAt,
}));

router.use(crudRouter({
  path: "/payrolls",
  table: payrollsTable,
  idColumn: payrollsTable.id,
  defaults: () => ({ createdAt: Date.now() }),
  orderBy: payrollsTable.createdAt,
}));

// Qarzdorlar — alohida jadval (ilgari KV blob)
router.use(crudRouter({
  path: "/debts",
  table: debtsTable,
  idColumn: debtsTable.id,
  defaults: () => ({ deferredAt: Date.now(), status: "ochiq" }),
  orderBy: debtsTable.deferredAt,
}));

// --- Promo kodlar ---
router.use(crudRouter({
  path: "/promo-codes",
  table: promoCodesTable,
  idColumn: promoCodesTable.id,
  defaults: () => ({ createdAt: Date.now() }),
  orderBy: promoCodesTable.createdAt,
}));

router.get("/promo-codes/by-code/:code", async (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "code required" });
  const [row] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, code));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.post("/promo-codes/:id/mark-used", async (req, res) => {
  const paymentId = String(req.body?.paymentId ?? "") || null;
  const [row] = await db
    .update(promoCodesTable)
    .set({ usedAt: Date.now(), usedPaymentId: paymentId })
    .where(eq(promoCodesTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.get("/finance/summary", async (_req, res) => {
  const result: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::int AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::int AS total_expense,
      COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0)::int AS total_refund,
      COUNT(*)::int AS tx_count
    FROM transactions
  `);
  res.json(result.rows?.[0] ?? result[0] ?? { total_income: 0, total_expense: 0, total_refund: 0, tx_count: 0 });
});

export default router;
