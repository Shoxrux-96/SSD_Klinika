import { pgTable, text, bigint, boolean, jsonb } from "drizzle-orm/pg-core";

export const employeesTable = pgTable("employees", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  photo: text("photo"),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  position: text("position").notNull().default(""),
  specialty: text("specialty").notNull().default(""),
  experience: text("experience").notNull().default(""),
  diploma: text("diploma").notNull().default(""),
  addedAt: bigint("added_at", { mode: "number" }).notNull(),
  archived: boolean("archived").notNull().default(false),
  // Auth
  username: text("username"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("oddiy"),
  // Ish jadvali
  workHours: jsonb("work_hours").$type<Record<string, [string, string] | null>>(),
  offDates: jsonb("off_dates").$type<string[]>().default([]),
});

export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = typeof employeesTable.$inferInsert;
