export type ClinicRole =
  | "admin"
  | "shifokor"
  | "laborant"
  | "registrator"
  | "kassir"
  | "buxgalter"
  | "oddiy";

export type ModuleKey =
  | "patient-emr"
  | "medical-history"
  | "diagnosis"
  | "treatment-plan"
  | "prescriptions"
  | "timeline"
  | "attachments"
  | "lab-results"
  | "billing"
  | "inventory"
  | "reports"
  | "notifications"
  | "documents"
  | "appointments"
  | "queue"
  | "call-center";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  description: string;
  category: "clinical" | "finance" | "operations" | "reports" | "automation";
  roles: ClinicRole[];
  writeRoles: ClinicRole[];
};

export const CLINIC_MODULES: ModuleDefinition[] = [
  {
    key: "patient-emr",
    label: "Bemor EMR / EHR",
    description: "Bemor profili, tarix, diagnostika va umumiy tibbiy ma’lumotlar.",
    category: "clinical",
    roles: ["admin", "shifokor", "laborant", "registrator"],
    writeRoles: ["admin", "shifokor", "registrator"],
  },
  {
    key: "medical-history",
    label: "Tibbiy tarix",
    description: "Kelgan bemorlarning oldingi muolajalar, kasalliklar va alerjiyalar tarixi.",
    category: "clinical",
    roles: ["admin", "shifokor", "registrator"],
    writeRoles: ["admin", "shifokor", "registrator"],
  },
  {
    key: "diagnosis",
    label: "Diagnostika va muolajalar",
    description: "Diagnostika, davolash usullari, qo‘shimcha tahlillar va doktor qarorlari.",
    category: "clinical",
    roles: ["admin", "shifokor"],
    writeRoles: ["admin", "shifokor"],
  },
  {
    key: "treatment-plan",
    label: "Treatment plan",
    description: "Bosqichlar, buyruqlar, davolash reja va kuzatuv jarayoni.",
    category: "clinical",
    roles: ["admin", "shifokor"],
    writeRoles: ["admin", "shifokor"],
  },
  {
    key: "prescriptions",
    label: "Retseptlar",
    description: "Retseptlar, dorilar va ketma-ket davolash yozuvlari.",
    category: "clinical",
    roles: ["admin", "shifokor"],
    writeRoles: ["admin", "shifokor"],
  },
  {
    key: "timeline",
    label: "Xronologik yozuvlar",
    description: "Bemor uchun vaqt bo‘yicha barcha muolaja, qaror va natijalar tarixi.",
    category: "clinical",
    roles: ["admin", "shifokor", "registrator"],
    writeRoles: ["admin", "shifokor"],
  },
  {
    key: "attachments",
    label: "Foto, fayl, X-ray va lab hujjatlari",
    description: "Hujjatlar, rasmlar, rentgen, PDF va boshqa qo‘shimcha materiallar.",
    category: "clinical",
    roles: ["admin", "shifokor", "laborant", "registrator"],
    writeRoles: ["admin", "shifokor", "laborant"],
  },
  {
    key: "lab-results",
    label: "Lab natijalari",
    description: "Analiz natijalari, import, PDF ko‘rinishi va shifokor ko‘rishi.",
    category: "clinical",
    roles: ["admin", "shifokor", "laborant"],
    writeRoles: ["admin", "laborant"],
  },
  {
    key: "appointments",
    label: "Qabul va soat jadvali",
    description: "Doktor va bemor jadvali, qabul vaqtlarini rejalashtirish.",
    category: "operations",
    roles: ["admin", "shifokor", "registrator", "kassir", "buxgalter"],
    writeRoles: ["admin", "registrator", "shifokor"],
  },
  {
    key: "queue",
    label: "Navbat boshqaruvi",
    description: "Bemorlarning kutish, chaqirish va navbat holati.",
    category: "operations",
    roles: ["admin", "shifokor", "registrator", "kassir", "buxgalter"],
    writeRoles: ["admin", "registrator", "shifokor"],
  },
  {
    key: "call-center",
    label: "Call-center eslatmalar",
    description: "Qo‘ng‘iroqlar, follow-up, SMS va WhatsApp eslatmalar.",
    category: "automation",
    roles: ["admin", "registrator", "shifokor"],
    writeRoles: ["admin", "registrator"],
  },
  {
    key: "billing",
    label: "Kassa va to‘lovlar",
    description: "Invoice, receipt, payment status, to‘lov usullari va qarzlar.",
    category: "finance",
    roles: ["admin", "kassir", "buxgalter"],
    writeRoles: ["admin", "kassir", "buxgalter"],
  },
  {
    key: "inventory",
    label: "Inventar va material nazorati",
    description: "Mahsulotlar qoldig‘i, buyurtma, yetkazib beruvchi va ogohlantirishlar.",
    category: "finance",
    roles: ["admin", "buxgalter"],
    writeRoles: ["admin", "buxgalter"],
  },
  {
    key: "reports",
    label: "Reporting va KPI",
    description: "Kunlik, oylik, kasal bo‘yicha, doktor bo‘yicha va tushum hisobotlari.",
    category: "reports",
    roles: ["admin", "shifokor", "laborant", "registrator", "kassir", "buxgalter"],
    writeRoles: ["admin"],
  },
  {
    key: "notifications",
    label: "Bildirishnomalar va eslatmalar",
    description: "SMS, email, WhatsApp, appointment reminder va follow-up.",
    category: "automation",
    roles: ["admin", "shifokor", "registrator", "kassir"],
    writeRoles: ["admin", "registrator"],
  },
  {
    key: "documents",
    label: "Dokumentlar va PDF",
    description: "Retsept, invoice, yozuvlar, PDF eksport va arxiv.",
    category: "automation",
    roles: ["admin", "shifokor", "kassir", "buxgalter"],
    writeRoles: ["admin", "shifokor", "kassir", "buxgalter"],
  },
];

export const ROLE_MODULE_ACCESS: Record<ClinicRole, ModuleKey[]> = {
  admin: CLINIC_MODULES.map((m) => m.key),
  shifokor: [
    "patient-emr",
    "medical-history",
    "diagnosis",
    "treatment-plan",
    "prescriptions",
    "timeline",
    "attachments",
    "lab-results",
    "appointments",
    "queue",
    "reports",
    "notifications",
    "documents",
  ],
  laborant: ["patient-emr", "attachments", "lab-results", "reports"],
  registrator: [
    "patient-emr",
    "medical-history",
    "timeline",
    "attachments",
    "appointments",
    "queue",
    "call-center",
    "notifications",
    "reports",
  ],
  kassir: ["appointments", "queue", "billing", "reports", "notifications"],
  buxgalter: ["appointments", "queue", "billing", "inventory", "reports", "documents", "notifications"],
  oddiy: [],
};

export const ROLE_PRIORITY = [
  "patient-emr",
  "appointments",
  "treatment-plan",
  "billing",
  "inventory",
  "reports",
  "notifications",
  "lab-results",
  "documents",
] as const;

export const STAFF_FEATURE_COMPLETION = {
  phase1: [
    "patient-emr",
    "appointments",
    "treatment-plan",
    "billing",
    "reports",
  ],
  phase2: [
    "inventory",
    "notifications",
    "lab-results",
    "documents",
  ],
  phase3: [
    "call-center",
    "attachments",
    "timeline",
    "medical-history",
  ],
};
