import { Router, type IRouter } from "express";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  rolesTable,
  usersTable,
  settingsTable,
  auditLogsTable,
  apiKeysTable,
  db,
} from "@workspace/db";
import { crudRouter } from "../lib/crud";

const router: IRouter = Router();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// --- Roles ---
router.use(crudRouter({
  path: "/roles",
  table: rolesTable,
  idColumn: rolesTable.id,
  defaults: () => ({ createdAt: Date.now(), permissions: [] }),
}));

// --- Audit logs (read-only + append) ---
router.get("/audit-logs", async (_req, res) => {
  const rows = await db.select().from(auditLogsTable).orderBy(auditLogsTable.at);
  res.json(rows);
});
router.post("/audit-logs", async (req, res) => {
  // Actor har doim JWT'dan olinadi — client o'zini boshqa odam deb ko'rsata olmaydi.
  const authUser = (req as any).authUser as { sub?: string } | undefined;
  const actor = authUser?.sub ?? null;
  if (!actor) return res.status(401).json({ error: "Actor aniqlanmadi" });

  const b = req.body ?? {};
  const row = {
    id: randomUUID(),
    actor,
    action: String(b.action ?? ""),
    entity: String(b.entity ?? ""),
    entityId: b.entityId ?? null,
    before: b.before ?? null,
    after: b.after ?? null,
    at: Date.now(),
  };
  const [created] = await db.insert(auditLogsTable).values(row).returning();
  res.status(201).json(created);
});

// --- Settings (key-value) ---
router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  res.json(rows);
});
router.get("/settings/:key", async (req, res) => {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, req.params.key));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});
router.put("/settings/:key", async (req, res) => {
  const key = req.params.key;
  const value = req.body?.value ?? req.body;
  const now = Date.now();
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing) {
    const [row] = await db
      .update(settingsTable)
      .set({ value, updatedAt: now })
      .where(eq(settingsTable.key, key))
      .returning();
    return res.json(row);
  }
  const [row] = await db.insert(settingsTable).values({ key, value, updatedAt: now }).returning();
  res.status(201).json(row);
});
router.delete("/settings/:key", async (req, res) => {
  const [row] = await db
    .delete(settingsTable)
    .where(eq(settingsTable.key, req.params.key))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

// --- Users (admin) ---
router.get("/users", async (_req, res) => {
  const rows = await db.select().from(usersTable);
  res.json(rows.map(({ passwordHash: _p, ...u }) => u));
});
router.post("/users", async (req, res) => {
  const b = req.body ?? {};
  if (!b.username || !b.password || !b.fullName) {
    return res.status(400).json({ error: "username, password, fullName required" });
  }
  const row = {
    id: randomUUID(),
    username: String(b.username),
    passwordHash: hashPassword(String(b.password)),
    roleId: b.roleId ?? null,
    employeeId: b.employeeId ?? null,
    fullName: String(b.fullName),
    active: b.active !== false,
    createdAt: Date.now(),
  };
  const [created] = await db.insert(usersTable).values(row).returning();
  const { passwordHash: _p, ...safe } = created;
  res.status(201).json(safe);
});
router.patch("/users/:id", async (req, res) => {
  const patch: Record<string, unknown> = { ...(req.body ?? {}) };
  delete patch.id;
  if (patch.password) {
    patch.passwordHash = hashPassword(String(patch.password));
    delete patch.password;
  }
  const [row] = await db.update(usersTable).set(patch).where(eq(usersTable.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  const { passwordHash: _p, ...safe } = row;
  res.json(safe);
});
router.delete("/users/:id", async (req, res) => {
  const [row] = await db.delete(usersTable).where(eq(usersTable.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

// (Eski /auth/login yo'li olib tashlandi — `routes/auth.ts` da JWT-ga asoslangan
//  rasmiy login turadi va rate-limit + lockout + jurnal bilan himoyalangan.)

// --- API keys management ---
router.get("/api-keys", async (_req, res) => {
  const rows = await db.select().from(apiKeysTable);
  res.json(rows);
});
router.post("/api-keys", async (req, res) => {
  const b = req.body ?? {};
  const row = {
    id: randomUUID(),
    key: "key_" + randomBytes(24).toString("base64url"),
    name: String(b.name ?? "unnamed"),
    scope: b.scope ?? "full",
    active: true,
    createdAt: Date.now(),
    lastUsedAt: null,
  };
  const [created] = await db.insert(apiKeysTable).values(row).returning();
  res.status(201).json(created);
});
router.delete("/api-keys/:id", async (req, res) => {
  const [row] = await db.delete(apiKeysTable).where(eq(apiKeysTable.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

export default router;
