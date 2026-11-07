import { pgTable, text, bigint, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const techProductsTable = pgTable("tech_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  qty: integer("qty").notNull().default(0),
  costPrice: integer("cost_price").notNull().default(0),
  salePrice: integer("sale_price").notNull().default(0),
  addedAt: bigint("added_at", { mode: "number" }).notNull(),
});

export const attendanceTable = pgTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    status: text("status").notNull(), // keldi | kech | kelmagan
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    uniqByEmpDate: uniqueIndex("attendance_emp_date_unique").on(t.employeeId, t.date),
  }),
);

export type TechProduct = typeof techProductsTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
