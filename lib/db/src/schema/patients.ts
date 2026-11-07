import { pgTable, text, bigint, boolean } from "drizzle-orm/pg-core";

export const patientsTable = pgTable("patients", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  region: text("region"),
  district: text("district"),
  gender: text("gender"),
  birthDate: text("birth_date"),
  passport: text("passport"),
  addedAt: bigint("added_at", { mode: "number" }).notNull(),
  archived: boolean("archived").notNull().default(false),
});

export type Patient = typeof patientsTable.$inferSelect;
export type InsertPatient = typeof patientsTable.$inferInsert;
