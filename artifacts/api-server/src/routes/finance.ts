import { Router, type IRouter } from "express";
import {
  transactionsTable, payrollsTable, debtsTable, db,
} from "@workspace/db";
import { sql } from "drizzle-orm";
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
