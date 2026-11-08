import { pgTable, text, bigint, boolean, integer, primaryKey, index } from "drizzle-orm/pg-core";

// `patient`, `doctor`, `service` — ko'rsatish uchun ism-familya saqlanadi (eski kod bilan mos),
// lekin asosiy JOIN kaliti sifatida `patientId`, `doctorId`, `serviceId` UUID ustunlari qo'shildi.
// Ism-familya o'zgarsa ham tarixiy yozuvlar UUID orqali barqaror qoladi.
export const appointmentsTable = pgTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    patient: text("patient").notNull(), // display: bemor ismi
    patientId: text("patient_id"),       // patients.id (UUID)
    doctor: text("doctor").notNull(),
    doctorId: text("doctor_id"),         // employees.id
    service: text("service").notNull(),
    serviceId: text("service_id"),       // services.id
    status: text("status").notNull().default("kutilmoqda"),
  },
  (t) => ({
    byPatient: index("appt_patient_idx").on(t.patientId),
    byDoctor:  index("appt_doctor_idx").on(t.doctorId),
    byDate:    index("appt_date_idx").on(t.date),
  }),
);

export const queueItemsTable = pgTable(
  "queue_items",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull(),
    patient: text("patient").notNull(),
    patientId: text("patient_id"),
    doctor: text("doctor").notNull(),
    doctorId: text("doctor_id"),
    service: text("service").notNull(),
    serviceId: text("service_id"),
    addedAt: bigint("added_at", { mode: "number" }).notNull(),
    status: text("status").notNull().default("navbatda"),
  },
  (t) => ({
    byPatient: index("queue_patient_idx").on(t.patientId),
    byDoctor:  index("queue_doctor_idx").on(t.doctorId),
  }),
);

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
