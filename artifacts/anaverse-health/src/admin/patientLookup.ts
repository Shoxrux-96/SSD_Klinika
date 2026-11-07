// Markaziy bemor identifikatori helper.
// Barcha tibbiy yozuvlar (treatments, lab_results, prescriptions, dental_records)
// `patientId` (UUID) ga bog'lanadi. Qo'shimcha xavfsizlik uchun `patientPassport`
// yoziladi — ism-familya o'zgarsa yoki xato yozilsa, passport orqali topish mumkin.
//
// Legacy yozuvlar (eski "patientName" string'ga asoslangan) — fallback bilan
// topiladi: avval UUID bo'yicha, keyin passport, keyin ism-familya.

import type { Patient } from './store';

export type PatientRef = {
  id: string;            // patients.id (UUID) — asosiy kalit
  name: string;          // ko'rsatish uchun to'liq ism
  passport?: string;     // xavfsizlik uchun ikkinchi kalit
};

export function normalizePassport(raw?: string | null): string {
  return (raw ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Bemorni istalgan ko'rsatkich bo'yicha topadi: UUID → passport → ism */
export function resolvePatient(key: string | undefined | null, patients: Patient[]): Patient | undefined {
  if (!key) return undefined;
  const k = String(key).trim();
  if (!k) return undefined;
  // 1) UUID bo'yicha (asosiy)
  const byId = patients.find((p) => p.id === k);
  if (byId) return byId;
  // 2) Normalizatsiya qilingan passport bo'yicha
  const kNorm = normalizePassport(k);
  if (kNorm) {
    const byPassport = patients.find((p) => normalizePassport(p.passport) === kNorm);
    if (byPassport) return byPassport;
  }
  // 3) Legacy — ism-familya bo'yicha
  const kLower = k.toLowerCase();
  const byName = patients.find((p) => p.fullName.toLowerCase() === kLower);
  return byName;
}

/** Yozuvdagi patientId + patientPassport ikkalasidan ham topishga uruniladi */
export function resolvePatientByRef(
  record: { patientId?: string; patientPassport?: string | null },
  patients: Patient[],
): Patient | undefined {
  // 1) patientId (UUID) — eng ishonchli
  const byId = resolvePatient(record.patientId, patients);
  if (byId) return byId;
  // 2) patientPassport — ikkinchi himoya qatlami
  if (record.patientPassport) {
    const byPassport = resolvePatient(record.patientPassport, patients);
    if (byPassport) return byPassport;
  }
  return undefined;
}

export function patientLabel(p: Patient): string {
  const passport = (p.passport ?? '').trim();
  return passport ? `${p.fullName} · ${passport}` : p.fullName;
}

/** Form-input uchun: UUID yoki ism, normalizatsiya qilingan passport'ni qaytaradi */
export function toPatientRef(p: Patient): PatientRef {
  return { id: p.id, name: p.fullName, passport: normalizePassport(p.passport) || undefined };
}
