import { pgTable, text, bigint, integer } from "drizzle-orm/pg-core";

export const callTasksTable = pgTable("call_tasks", {
  id: text("id").primaryKey(),
  patientId: text("patient_id"),
  patient: text("patient").notNull(),
  phone: text("phone"),
  doctor: text("doctor"),
  reason: text("reason").notNull(),
  priority: text("priority").notNull().default("oddiy"), // oddiy | muhim | shoshilinch
  dueDate: text("due_date").notNull(),                   // YYYY-MM-DD
  status: text("status").notNull().default("kutilmoqda"), // kutilmoqda | bajarildi | bekor
  completedAt: bigint("completed_at", { mode: "number" }),
  note: text("note"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const callLogsTable = pgTable("call_logs", {
  id: text("id").primaryKey(),
  taskId: text("task_id"),
  patient: text("patient").notNull(),
  phone: text("phone"),
  outcome: text("outcome").notNull(), // javob berdi | javob yoq | band | notogri raqam
  duration: integer("duration"),      // seconds
  note: text("note"),
  at: bigint("at", { mode: "number" }).notNull(),
});

export type CallTaskRow = typeof callTasksTable.$inferSelect;
export type CallLogRow = typeof callLogsTable.$inferSelect;
