import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import type { PgTable } from "drizzle-orm/pg-core";

type CrudOpts<T extends PgTable> = {
  path: string;
  table: T;
  idColumn: any;
  defaults?: (body: any) => Record<string, unknown>;
  beforeWrite?: (body: any) => Record<string, unknown>;
  orderBy?: SQL<any> | any;
};

export function crudRouter<T extends PgTable>(opts: CrudOpts<T>): IRouter {
  const r: IRouter = Router();
  const { path, table, idColumn } = opts;

  r.get(path, async (_req, res) => {
    const q = db.select().from(table as any);
    const rows = opts.orderBy ? await q.orderBy(opts.orderBy) : await q;
    res.json(rows);
  });

  r.get(`${path}/:id`, async (req, res) => {
    const [row] = await db.select().from(table as any).where(eq(idColumn, req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  r.post(path, async (req, res) => {
    try {
      const base = {
        id: req.body?.id ?? randomUUID(),
        ...(opts.defaults ? opts.defaults(req.body ?? {}) : {}),
        ...(req.body ?? {}),
      };
      const row = opts.beforeWrite ? opts.beforeWrite(base) : base;
      const [created] = (await db.insert(table as any).values(row).returning()) as any[];
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Insert failed" });
    }
  });

  const upd = async (req: Request, res: Response) => {
    try {
      const patch = { ...(req.body ?? {}) };
      delete patch.id;
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "No fields" });
      }
      const final = opts.beforeWrite ? opts.beforeWrite(patch) : patch;
      const [row] = await db
        .update(table as any)
        .set(final)
        .where(eq(idColumn, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Update failed" });
    }
  };
  r.put(`${path}/:id`, upd);
  r.patch(`${path}/:id`, upd);

  r.delete(`${path}/:id`, async (req, res) => {
    const [row] = (await db
      .delete(table as any)
      .where(eq(idColumn, req.params.id))
      .returning()) as any[];
    if (!row) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  });

  return r;
}
