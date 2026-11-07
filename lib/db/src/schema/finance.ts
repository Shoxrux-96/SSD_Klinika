import { pgTable, text, bigint, integer } from "drizzle-orm/pg-core";

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // income | expense | refund
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("som"),
  method: text("method").notNull().default("naqd"), // naqd | karta | transfer
  patientId: text("patient_id"),
  serviceId: text("service_id"),
  employeeId: text("employee_id"),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const payrollsTable = pgTable("payrolls", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  period: text("period").notNull(), // YYYY-MM
  baseSalary: integer("base_salary").notNull().default(0),
  bonus: integer("bonus").notNull().default(0),
  deduction: integer("deduction").notNull().default(0),
  total: integer("total").notNull().default(0),
  status: text("status").notNull().default("kutilmoqda"), // kutilmoqda | to'landi
  paidAt: bigint("paid_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type Transaction = typeof transactionsTable.$inferSelect;
export type Payroll = typeof payrollsTable.$inferSelect;
