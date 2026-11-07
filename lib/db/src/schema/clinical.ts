import { pgTable, text, bigint, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const prescriptionsTable = pgTable("prescriptions", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  doctorId: text("doctor_id").notNull(),
  date: text("date").notNull(),
  medications: jsonb("medications").notNull().default([]),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const treatmentsTable = pgTable("treatments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  doctorId: text("doctor_id").notNull(),
  serviceId: text("service_id"),
  date: text("date").notNull(),
  diagnosis: text("diagnosis"),
  procedure: text("procedure"),
  price: integer("price").notNull().default(0),
  status: text("status").notNull().default("tugatildi"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const labResultsTable = pgTable("lab_results", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  doctorId: text("doctor_id"),
  testName: text("test_name").notNull(),
  result: text("result"),
  unit: text("unit"),
  referenceRange: text("reference_range"),
  status: text("status").notNull().default("tayyor"),
  date: text("date").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const dentalRecordsTable = pgTable("dental_records", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  tooth: text("tooth").notNull(),
  condition: text("condition").notNull(),
  procedure: text("procedure"),
  notes: text("notes"),
  date: text("date").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type Prescription = typeof prescriptionsTable.$inferSelect;
export type Treatment = typeof treatmentsTable.$inferSelect;
export type LabResult = typeof labResultsTable.$inferSelect;
export type DentalRecord = typeof dentalRecordsTable.$inferSelect;
