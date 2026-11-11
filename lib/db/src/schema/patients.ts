import { pgTable, text, bigint, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

// Bemor — tibbiy kartaning asosiy "lampa"si. `id` (UUID) + `jshshir` birgalikda
// ikki qatlamli identifikator: hamma tibbiy yozuvlar shu id'ga bog'lanadi,
// jshshir esa ikkinchi darajali tekshiruv (xato ism yozilsa, jshshir orqali topish).
export const patientsTable = pgTable(
  "patients",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    region: text("region"),
    district: text("district"),
    gender: text("gender"),
    birthDate: text("birth_date"),
    // JSHSHIR (seriya+raqam birgalikda, masalan "AA1234567"). Normalizatsiya:
    // UPPER + bo'sh joysiz. Unique index (sparse) — ikki bemorda bir xil jshshir bo'lmaydi.
    jshshir: text("jshshir"),
    addedAt: bigint("added_at", { mode: "number" }).notNull(),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => ({
    jshshirUniq: uniqueIndex("patients_jshshir_uniq").on(t.jshshir),
    fullNameIdx: index("patients_full_name_idx").on(t.fullName),
  }),
);

export type Patient = typeof patientsTable.$inferSelect;
export type InsertPatient = typeof patientsTable.$inferInsert;
