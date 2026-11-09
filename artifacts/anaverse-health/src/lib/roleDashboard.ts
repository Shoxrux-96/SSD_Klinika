export type DashboardSection = {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
};

export const roleDashboardConfig: Record<string, DashboardSection[]> = {
  admin: [
    { id: "overview", title: "Umumiy KPI", description: "Kunlik, oylik, kassa, qarzlar va bemor oqimi", priority: "high" },
    { id: "operations", title: "Operatsion nazorat", description: "Qabul, navbat, doktorlar va ish jadvali", priority: "high" },
    { id: "clinical", title: "Klinik ko‘rsatkichlar", description: "Davolash tarixi, retseptlar, lab natijalari", priority: "high" },
    { id: "finance", title: "Moliya va tushum", description: "Kassa, qarzlar, invoice va to‘lovlar", priority: "high" },
    { id: "inventory", title: "Inventar", description: "Mahsulotlar, buyurtma va minimal limit", priority: "medium" },
    { id: "alerts", title: "Xabarnoma va eslatmalar", description: "SMS, WhatsApp, follow-up va rejalashtirish", priority: "medium" },
    { id: "audit", title: "Audit va xavfsizlik", description: "Login attempts, sessiyalar va himoya holati", priority: "high" },
  ],
  shifokor: [
    { id: "today-patients", title: "Bugungi bemorlar", description: "Hozirgi navbat va qabul reja", priority: "high" },
    { id: "emr", title: "Bemor EMR", description: "Bemor profil, tarix, muolajalar va diagnozlar", priority: "high" },
    { id: "treatment", title: "Treatment plan", description: "Davolash bosqichlari, buyruqlar va reja", priority: "high" },
    { id: "lab", title: "Lab natijalari", description: "Analiz natijalari va doktor ko‘rishi", priority: "high" },
    { id: "prescriptions", title: "Retseptlar", description: "Retseptlar, dorilar va buyruqlar", priority: "medium" },
    { id: "follow-up", title: "Follow-up", description: "Qayta ko‘rish, nazorat va eslatmalar", priority: "medium" },
  ],
  laborant: [
    { id: "lab-queue", title: "Lab navbati", description: "Kutilayotgan va bajarilayotgan natijalar", priority: "high" },
    { id: "result-entry", title: "Natija kiritish", description: "Analiz natijalarini kirish va status boshqaruvi", priority: "high" },
    { id: "documents", title: "PDF va hisobotlar", description: "Natijalar, PDF va hujjatlarni yuklash", priority: "medium" },
  ],
  registrator: [
    { id: "appointment-board", title: "Qabul taxtasi", description: "Bugungi qabul, navbat va rejalashtirish", priority: "high" },
    { id: "new-patient", title: "Yangi bemor", description: "Bemor yakunlash, ro‘yxatga olish va profil yaratish", priority: "high" },
    { id: "follow-up", title: "Follow-up va eslatmalar", description: "Telefon, qayta aloqa va remiderlar", priority: "high" },
    { id: "payments", title: "To‘lov holati", description: "Qarz, to‘lov va oldindan ma’lumotlar", priority: "medium" },
  ],
  kassir: [
    { id: "cash-box", title: "Kassa va moliya", description: "Bugungi tushum, to‘lovlar, qarzlar va operatsion ko‘rsatkichlar", priority: "high" },
    { id: "payments", title: "To‘lovlar", description: "Invoice, receipt va qarzlarning real-time holati", priority: "high" },
    { id: "debt", title: "Qarzlar", description: "Qolgan va kechiktirilgan to‘lovlar", priority: "high" },
    { id: "summary", title: "Kunlik hisobot", description: "Kassa balansi, to‘lovlar va status", priority: "high" },
    { id: "inventory", title: "Inventar", description: "Mahsulotlar va buyurtmalarni kuzatish", priority: "medium" },
    { id: "reports", title: "Hisobotlar", description: "Real-time moliya va operatsion ko‘rsatkichlar", priority: "high" },
  ],
  buxgalter: [
    { id: "cash-box", title: "Kassa va moliya", description: "Bugungi tushum, to‘lovlar, qarzlar va operatsion ko‘rsatkichlar", priority: "high" },
    { id: "payments", title: "To‘lovlar", description: "Invoice, receipt va qarzlarning real-time holati", priority: "high" },
    { id: "debt", title: "Qarzlar", description: "Qolgan va kechiktirilgan to‘lovlar", priority: "high" },
    { id: "summary", title: "Kunlik hisobot", description: "Kassa balansi, to‘lovlar va status", priority: "high" },
    { id: "inventory", title: "Inventar", description: "Mahsulotlar va buyurtmalarni kuzatish", priority: "medium" },
    { id: "reports", title: "Hisobotlar", description: "Real-time moliya va operatsion ko‘rsatkichlar", priority: "high" },
  ],
};

export const roleQuickActions: Record<string, string[]> = {
  admin: [
    "Bemorlarni ko‘rish",
    "Kassa hisobotini ochish",
    "Audit loglarni tekshirish",
    "Xabarnomalarni yuborish",
  ],
  shifokor: [
    "Bugungi bemorlar",
    "Retsept yozish",
    "Lab natijasini ko‘rish",
    "Treatment plan yaratish",
  ],
  laborant: [
    "Natija kiritish",
    "Lab buyurtmasini ko‘rish",
    "PDF export",
    "Status yangilash",
  ],
  registrator: [
    "Yangi bemor qo‘shish",
    "Qabul jadvalini ko‘rish",
    "Eslatmalar yuborish",
    "Follow-up qilish",
  ],
  kassir: [
    "To‘lov qabul qilish",
    "Invoice yaratish",
    "Qarzlarni ko‘rish",
    "Kunlik hisobot",
    "Real-time kassa kuzatuvi",
  ],
  buxgalter: [
    "To‘lov qabul qilish",
    "Invoice yaratish",
    "Qarzlarni ko‘rish",
    "Kunlik hisobot",
    "Real-time kassa kuzatuvi",
  ],
};

export const professionalModuleChecklist = [
  "Bemor EMR / EHR",
  "Tibbiy tarix",
  "Diagnostika va muolajalar",
  "Treatment plan",
  "Retseptlar",
  "Xronologik yozuvlar",
  "Foto / fayl / X-ray / lab hujjatlari",
  "Qabul va navbat",
  "Kassa va to‘lovlar",
  "Inventory va material nazorati",
  "KPI va reporting",
  "SMS / WhatsApp / email eslatmalar",
  "Lab integrations",
  "Dokumentlar va PDF avtomatizatsiyasi",
];
