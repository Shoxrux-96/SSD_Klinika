import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/reports/overview", async (_req, res) => {
  const result: any = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM patients WHERE archived = false)                   AS patients,
      (SELECT COUNT(*)::int FROM employees WHERE archived = false)                  AS employees,
      (SELECT COUNT(*)::int FROM appointments)                                       AS appointments,
      (SELECT COUNT(*)::int FROM queue_items WHERE status != 'tugatildi')            AS queue_active,
      (SELECT COUNT(*)::int FROM services WHERE archived = false)                    AS services,
      (SELECT COALESCE(SUM(amount)::int, 0) FROM transactions WHERE type = 'income') AS income_total,
      (SELECT COALESCE(SUM(amount)::int, 0) FROM transactions WHERE type = 'expense') AS expense_total
  `);
  res.json(result.rows?.[0] ?? result[0] ?? {});
});

router.get("/reports/appointments-by-status", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT status, COUNT(*)::int AS count
    FROM appointments
    GROUP BY status
    ORDER BY count DESC
  `);
  res.json(rows.rows ?? rows);
});

router.get("/reports/top-services", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT a.service AS name, COUNT(*)::int AS count
    FROM appointments a
    GROUP BY a.service
    ORDER BY count DESC
    LIMIT 10
  `);
  res.json(rows.rows ?? rows);
});

export default router;
