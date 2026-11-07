import { pgTable, text, bigint, jsonb, boolean } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  permissions: jsonb("permissions").notNull().default([]),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: text("role_id"),
  employeeId: text("employee_id"),
  fullName: text("full_name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actor: text("actor"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  at: bigint("at", { mode: "number" }).notNull(),
});

export const apiKeysTable = pgTable("api_keys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("full"), // full | readonly | mobile
  active: boolean("active").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  lastUsedAt: bigint("last_used_at", { mode: "number" }),
});

// Faol login sessiyalari — JWT jti bo'yicha, logout va revocation uchun.
export const authSessionsTable = pgTable("auth_sessions", {
  id: text("id").primaryKey(), // UUID = JWT jti
  employeeId: text("employee_id").notNull(),
  username: text("username").notNull(),
  role: text("role").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  lastSeenAt: bigint("last_seen_at", { mode: "number" }),
  revoked: boolean("revoked").notNull().default(false),
  revokedAt: bigint("revoked_at", { mode: "number" }),
});

// Login urinishlari — account lockout va audit uchun.
export const loginAttemptsTable = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  reason: text("reason"),
  at: bigint("at", { mode: "number" }).notNull(),
});

export type Role = typeof rolesTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Setting = typeof settingsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type ApiKey = typeof apiKeysTable.$inferSelect;
export type AuthSession = typeof authSessionsTable.$inferSelect;
export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
