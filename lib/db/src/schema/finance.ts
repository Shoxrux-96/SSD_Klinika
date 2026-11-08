import { pgTable, text, bigint, integer, index } from "drizzle-orm/pg-core";

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

// Qarzdorlar daftari — "Keyinroq to'lash" bosilgan davolashlar/to'lovlar.
// Oldin /api/settings/ssd-debts JSON-blob sifatida saqlanardi (indeks/sort yo'q) —
// endi alohida jadval: har bir qator FK, index va status bilan.
export const debtsTable = pgTable(
  "debts",
  {
    id: text("id").primaryKey(),
    treatmentId: text("treatment_id"),
    patientId: text("patient_id"),
    patientPassport: text("patient_passport"),
    patient: text("patient").notNull(),      // display: bemor ismi
    phone: text("phone"),
    doctor: text("doctor"),
    services: text("services").notNull().default(""), // vergul bilan ajratilgan
    amount: integer("amount").notNull().default(0),
    date: text("date").notNull(),
    dueDate: text("due_date"),
    note: text("note"),
    status: text("status").notNull().default("ochiq"), // ochiq | to'landi | yopildi
    paidAt: bigint("paid_at", { mode: "number" }),
    deferredAt: bigint("deferred_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    byPatient: index("debts_patient_idx").on(t.patientId),
    byStatus:  index("debts_status_idx").on(t.status),
    byDate:    index("debts_date_idx").on(t.date),
  }),
);

// Tibbiy texnik buyurtmalar — oldin JSON-blob'da edi, endi tartibli jadvalda.
export const techOrdersTable = pgTable(
  "tech_orders",
  {
    id: text("id").primaryKey(),
    doctorId: text("doctor_id").notNull(),
    patientId: text("patient_id"),
    date: text("date").notNull(),
    productName: text("product_name").notNull(),
    qty: integer("qty").notNull().default(1),
    unitPrice: integer("unit_price").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    status: text("status").notNull().default("buyurtmada"), // buyurtmada | tayyor | berilgan
    note: text("note"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    byDoctor: index("tech_orders_doctor_idx").on(t.doctorId),
    byDate:   index("tech_orders_date_idx").on(t.date),
  }),
);

export type Transaction = typeof transactionsTable.$inferSelect;
export type Payroll = typeof payrollsTable.$inferSelect;
export type Debt = typeof debtsTable.$inferSelect;
export type TechOrder = typeof techOrdersTable.$inferSelect;
