// Markaziy bemor identifikatori helper.
// Barcha tibbiy yozuvlar (treatments, lab_results, prescriptions, dental_records)
// `patientId` (UUID) ga bog'lanadi. Qo'shimcha xavfsizlik uchun `patientJshshir`
// yoziladi — ism-familya o'zgarsa yoki xato yozilsa, jshshir orqali topish mumkin.
//
// Legacy yozuvlar (eski "patientName" string'ga asoslangan) — fallback bilan
// topiladi: avval UUID bo'yicha, keyin jshshir, keyin ism-familya.

import type { Patient } from './store';

export type PatientRef = {
  id: string;            // patients.id (UUID) — asosiy kalit
  name: string;          // ko'rsatish uchun to'liq ism
  jshshir?: string;     // xavfsizlik uchun ikkinchi kalit
};

export function normalizeJshshir(raw?: string | null): string {
  return (raw ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Bemorni istalgan ko'rsatkich bo'yicha topadi: UUID → jshshir → ism */
export function resolvePatient(key: string | undefined | null, patients: Patient[]): Patient | undefined {
  if (!key) return undefined;
  const k = String(key).trim();
  if (!k) return undefined;
  // 1) UUID bo'yicha (asosiy)
  const byId = patients.find((p) => p.id === k);
  if (byId) return byId;
  // 2) Normalizatsiya qilingan jshshir bo'yicha
  const kNorm = normalizeJshshir(k);
  if (kNorm) {
    const byJshshir = patients.find((p) => normalizeJshshir(p.jshshir) === kNorm);
    if (byJshshir) return byJshshir;
  }
  // 3) Legacy — ism-familya bo'yicha
  const kLower = k.toLowerCase();
  const byName = patients.find((p) => p.fullName.toLowerCase() === kLower);
  return byName;
}

/** Yozuvdagi patientId + patientJshshir ikkalasidan ham topishga uruniladi */
export function resolvePatientByRef(
  record: { patientId?: string; patientJshshir?: string | null },
  patients: Patient[],
): Patient | undefined {
  // 1) patientId (UUID) — eng ishonchli
  const byId = resolvePatient(record.patientId, patients);
  if (byId) return byId;
  // 2) patientJshshir — ikkinchi himoya qatlami
  if (record.patientJshshir) {
    const byJshshir = resolvePatient(record.patientJshshir, patients);
    if (byJshshir) return byJshshir;
  }
  return undefined;
}

export function patientLabel(p: Patient): string {
  const jshshir = (p.jshshir ?? '').trim();
  return jshshir ? `${p.fullName} · ${jshshir}` : p.fullName;
}

/** Form-input uchun: UUID yoki ism, normalizatsiya qilingan jshshir'ni qaytaradi */
export function toPatientRef(p: Patient): PatientRef {
  return { id: p.id, name: p.fullName, jshshir: normalizeJshshir(p.jshshir) || undefined };
}
