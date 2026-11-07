import { pgTable, text, bigint, boolean, integer, primaryKey } from "drizzle-orm/pg-core";

export const appointmentsTable = pgTable("appointments", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  patient: text("patient").notNull(),
  doctor: text("doctor").notNull(),
  service: text("service").notNull(),
  status: text("status").notNull().default("kutilmoqda"),
});

export const queueItemsTable = pgTable("queue_items", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  patient: text("patient").notNull(),
  doctor: text("doctor").notNull(),
  service: text("service").notNull(),
  addedAt: bigint("added_at", { mode: "number" }).notNull(),
  status: text("status").notNull().default("navbatda"),
});

export const serviceCategoriesTable = pgTable("service_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
});

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  currency: text("currency").notNull().default("som"),
  somValue: integer("som_value"),
  doctorShare: integer("doctor_share").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
});

export const serviceAssignmentsTable = pgTable(
  "service_assignments",
  {
    employeeId: text("employee_id").notNull(),
    serviceId: text("service_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.employeeId, t.serviceId] }),
  }),
);

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;
export type QueueItem = typeof queueItemsTable.$inferSelect;
export type InsertQueueItem = typeof queueItemsTable.$inferInsert;
export type ServiceCategory = typeof serviceCategoriesTable.$inferSelect;
export type InsertServiceCategory = typeof serviceCategoriesTable.$inferInsert;
export type Service = typeof servicesTable.$inferSelect;
export type InsertService = typeof servicesTable.$inferInsert;
export type ServiceAssignment = typeof serviceAssignmentsTable.$inferSelect;
