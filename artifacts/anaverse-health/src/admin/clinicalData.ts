import { useEffect, useSyncExternalStore } from 'react';

/* ---------- shared helpers ---------- */
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/* ---------------- Treatments ---------------- */
export type TreatmentStatus = 'rejalashtirildi' | 'davolanmoqda' | 'yakunlandi';
export type TechOrderItem = { name: string; qty: number; note?: string };
export type AdmissionTests = {
  rw?: boolean; oits?: boolean; feces?: boolean; pediculosis?: boolean; other?: string;
};
export type Treatment = {
  id: string;
  // Asosiy identifikator: patients.id (UUID). Eski yozuvlar uchun ism-familya bo'lishi mumkin.
  patientId?: string;
  // Qo'shimcha identifikator (xavfsizlik/legacy fallback)
  patientPassport?: string;
  // Ko'rsatish uchun ism (hamma UI shu yerdan oladi)
  patient: string;
  diagnosis: string;
  service?: string;
  services?: string[];
  amount?: number;
  complaints?: string;
  methods?: string;
  advice?: string;
  examPlan?: string;
  treatmentPlan?: string;
  doctorNote?: string;
  techOrderEnabled?: boolean;
  techOrderItems?: TechOrderItem[];
  doctor: string;
  date: string;
  status: TreatmentStatus;
  admissionTime?: string; dischargeDate?: string; dischargeTime?: string;
  department?: string; roomNo?: string; stayDays?: string;
  bloodGroup?: string; rh?: string; drugAllergy?: string;
  height?: string; weight?: string; temperature?: string;
  workplace?: string; transport?: string; timeSinceOnset?: string;
  complication?: string; comorbidity?: string;
  admissionCount?: 'first' | 'repeat'; totalAdmissions?: string;
  anesthesia?: string; sickLeave?: string;
  treatmentResult?: string; workCapacity?: string; expertiseConclusion?: string;
  specialMarks?: string; admissionTests?: AdmissionTests;
  headOfDepartment?: string; receptionNote?: string;
  pathologyConclusion?: string; pathDxMain?: string;
  pathDxComplication?: string; pathDxComorbid?: string;
  pathologistName?: string;
};

// API row shape → frontend Treatment
// `patient_id` DB maydoni endi UUID'ni ushlaydi; eski yozuvlar uchun esa ism qolishi mumkin.
// Ism-familya alohida `notes.patientName` ichida saqlanadi (UI uchun).
function trFromApi(row: any): Treatment {
  const extra = row.notes ? safeJson(row.notes) : {};
  return {
    id: row.id,
    patientId: row.patientId ?? undefined,
    patientPassport: row.patientPassport ?? extra.patientPassport,
    patient: extra.patientName ?? row.patientId ?? '', // ko'rsatish uchun
    doctor: row.doctorId ?? '',
    diagnosis: row.diagnosis ?? '',
    service: row.serviceId ?? undefined,
    amount: row.price ?? 0,
    date: row.date,
    status: (row.status ?? 'rejalashtirildi') as TreatmentStatus,
    methods: row.procedure ?? undefined,
    ...extra,
  };
}
function trToApi(t: Partial<Treatment>) {
  const {
    id, patient, patientId, patientPassport, doctor, diagnosis, service, amount, date, status, methods,
    ...rest
  } = t as any;
  // Agar yangi yozuv UUID bilan kelgan bo'lsa, ism `notes.patientName` ga ketadi
  const mergedExtra = { ...rest, ...(patient !== undefined ? { patientName: patient } : {}) };
  return {
    ...(id ? { id } : {}),
    ...(patientId !== undefined ? { patientId } : (patient !== undefined ? { patientId: patient } : {})),
    ...(patientPassport !== undefined ? { patientPassport } : {}),
    ...(doctor !== undefined ? { doctorId: doctor } : {}),
    ...(diagnosis !== undefined ? { diagnosis } : {}),
    ...(service !== undefined ? { serviceId: service || null } : {}),
    ...(amount !== undefined ? { price: Number(amount) || 0 } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(methods !== undefined ? { procedure: methods } : {}),
    notes: Object.keys(mergedExtra).length ? JSON.stringify(mergedExtra) : null,
  };
}
function safeJson(s: string): any { try { return JSON.parse(s); } catch { return {}; } }

let trState: Treatment[] = [];
const trListeners = new Set<() => void>();
function emitTr() { trListeners.forEach((l) => l()); }
function subTr(l: () => void) { trListeners.add(l); return () => trListeners.delete(l); }

let trHydrated = false;
async function hydrateTr() {
  if (trHydrated || typeof window === 'undefined') return;
  trHydrated = true;
  try {
    const rows = await api<any[]>('/treatments');
    trState = rows.map(trFromApi).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    emitTr();
  } catch (e) { console.error('treatments hydrate failed', e); }
}

export function useTreatments(): Treatment[] {
  useEffect(() => { hydrateTr(); }, []);
  return useSyncExternalStore(subTr, () => trState, () => trState);
}

export async function addTreatment(t: Omit<Treatment, 'id'>) {
  const created = await api<any>('/treatments', {
    method: 'POST',
    body: JSON.stringify(trToApi({ ...t, id: `T-${Date.now().toString(36).toUpperCase()}` as any })),
  });
  trState = [trFromApi(created), ...trState];
  emitTr();
}
export async function updateTreatment(id: string, patch: Partial<Treatment>) {
  const updated = await api<any>(`/treatments/${id}`, {
    method: 'PATCH', body: JSON.stringify(trToApi(patch)),
  });
  trState = trState.map((t) => (t.id === id ? trFromApi(updated) : t));
  emitTr();
}
export async function removeTreatment(id: string) {
  await api(`/treatments/${id}`, { method: 'DELETE' });
  trState = trState.filter((t) => t.id !== id);
  emitTr();
}

/* ---------------- Prescriptions ---------------- */
export type Prescription = {
  id: string;
  patientId?: string;      // UUID (yangi yozuvlar)
  patientPassport?: string; // qo'shimcha identifikator
  patient: string;          // ko'rsatish uchun ism
  doctor: string;
  meds: string;
  date: string;
};

function rxFromApi(row: any): Prescription {
  const meds = Array.isArray(row.medications)
    ? row.medications.map((m: any) => (typeof m === 'string' ? m : m?.name ?? '')).join(', ')
    : row.notes ?? '';
  const extra = row.notes && !Array.isArray(row.medications) ? {} : safeJson(row.notes ?? '{}');
  return {
    id: row.id,
    patientId: row.patientId ?? undefined,
    patientPassport: row.patientPassport ?? extra.patientPassport,
    patient: extra.patientName ?? row.patientId ?? '',
    doctor: row.doctorId ?? '',
    meds,
    date: row.date,
  };
}
function rxToApi(p: Partial<Prescription>) {
  const { id, patient, patientId, patientPassport, doctor, meds, date } = p as any;
  return {
    ...(id ? { id } : {}),
    ...(patientId !== undefined ? { patientId } : (patient !== undefined ? { patientId: patient } : {})),
    ...(patientPassport !== undefined ? { patientPassport } : {}),
    ...(doctor !== undefined ? { doctorId: doctor } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(meds !== undefined ? { medications: String(meds).split(/\s*,\s*/).filter(Boolean) } : {}),
    ...(patient !== undefined ? { notes: JSON.stringify({ patientName: patient }) } : {}),
  };
}

let rxState: Prescription[] = [];
const rxListeners = new Set<() => void>();
function emitRx() { rxListeners.forEach((l) => l()); }
function subRx(l: () => void) { rxListeners.add(l); return () => rxListeners.delete(l); }

let rxHydrated = false;
async function hydrateRx() {
  if (rxHydrated || typeof window === 'undefined') return;
  rxHydrated = true;
  try {
    const rows = await api<any[]>('/prescriptions');
    rxState = rows.map(rxFromApi).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    emitRx();
  } catch (e) { console.error('prescriptions hydrate failed', e); }
}

export function usePrescriptions(): Prescription[] {
  useEffect(() => { hydrateRx(); }, []);
  return useSyncExternalStore(subRx, () => rxState, () => rxState);
}
export async function addPrescription(p: Omit<Prescription, 'id'>): Promise<Prescription> {
  const created = await api<any>('/prescriptions', {
    method: 'POST',
    body: JSON.stringify(rxToApi({ ...p, id: `RX-${Date.now().toString(36).toUpperCase()}` as any })),
  });
  const row = rxFromApi(created);
  rxState = [row, ...rxState];
  emitRx();
  return row;
}
export async function updatePrescription(id: string, patch: Partial<Prescription>): Promise<Prescription | null> {
  const updated = await api<any>(`/prescriptions/${id}`, {
    method: 'PATCH', body: JSON.stringify(rxToApi(patch)),
  });
  const row = rxFromApi(updated);
  rxState = rxState.map((p) => (p.id === id ? row : p));
  emitRx();
  return row;
}
export async function removePrescription(id: string) {
  await api(`/prescriptions/${id}`, { method: 'DELETE' });
  rxState = rxState.filter((p) => p.id !== id);
  emitRx();
}

/* ---------------- Lab tests (read-only here; writes happen in Laboratory page) ---------------- */
export type LabTestRecord = {
  id: string;
  patientId?: string;       // UUID
  patientPassport?: string; // qo'shimcha identifikator
  patientName: string;      // ko'rsatish uchun
  testType: string;
  templateId?: string;
  status: string;
  createdAt: number;
  readyAt?: number;
  docDate?: string;
  results?: Record<string, string>;
  labDoctor?: string;
  laborant?: string;
};

function labFromApi(row: any): LabTestRecord {
  const extra = row.result ? safeJson(row.result) : {};
  return {
    id: row.id,
    patientId: row.patientId ?? undefined,
    patientPassport: row.patientPassport ?? extra.patientPassport,
    patientName: extra.patientName ?? row.patientId ?? '',
    testType: row.testName,
    status: row.status,
    createdAt: Number(row.createdAt) || Date.now(),
    readyAt: extra.readyAt,
    docDate: row.date,
    results: extra.results,
    labDoctor: row.doctorId ?? extra.labDoctor,
    laborant: extra.laborant,
    templateId: extra.templateId,
  };
}

let labState: LabTestRecord[] = [];
const labListeners = new Set<() => void>();
function emitLab() { labListeners.forEach((l) => l()); }
function subLab(l: () => void) { labListeners.add(l); return () => labListeners.delete(l); }

let labHydrated = false;
export async function hydrateLab() {
  if (typeof window === 'undefined') return;
  try {
    const rows = await api<any[]>('/lab-results');
    labState = rows.map(labFromApi).sort((a, b) => b.createdAt - a.createdAt);
    labHydrated = true;
    emitLab();
  } catch (e) { console.error('lab hydrate failed', e); }
}

export function useLabTests(): LabTestRecord[] {
  useEffect(() => { if (!labHydrated) hydrateLab(); }, []);
  return useSyncExternalStore(subLab, () => labState, () => labState);
}

export async function addLabTest(t: Omit<LabTestRecord, 'id' | 'createdAt'> & { id?: string }) {
  const body = {
    id: t.id ?? `LAB-${Date.now().toString(36).toUpperCase()}`,
    patientId: t.patientId ?? t.patientName, // UUID bo'lsa UUID, aks holda ism (legacy)
    patientPassport: t.patientPassport,
    doctorId: t.labDoctor ?? null,
    testName: t.testType,
    status: t.status ?? 'yangi',
    date: t.docDate ?? new Date().toISOString().slice(0, 10),
    result: JSON.stringify({
      patientName: t.patientName,
      patientPassport: t.patientPassport,
      readyAt: t.readyAt, results: t.results,
      laborant: t.laborant, templateId: t.templateId,
    }),
  };
  const created = await api<any>('/lab-results', { method: 'POST', body: JSON.stringify(body) });
  labState = [labFromApi(created), ...labState];
  emitLab();
  return created.id as string;
}
export async function updateLabTest(id: string, patch: Partial<LabTestRecord>) {
  const existing = labState.find((x) => x.id === id);
  const merged = { ...existing, ...patch } as LabTestRecord;
  const body: any = {};
  if (patch.patientId !== undefined) body.patientId = patch.patientId;
  else if (patch.patientName !== undefined && !merged.patientId) body.patientId = patch.patientName;
  if (patch.patientPassport !== undefined) body.patientPassport = patch.patientPassport;
  if (patch.labDoctor !== undefined) body.doctorId = patch.labDoctor;
  if (patch.testType !== undefined) body.testName = patch.testType;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.docDate !== undefined) body.date = patch.docDate;
  body.result = JSON.stringify({
    patientName: merged.patientName,
    patientPassport: merged.patientPassport,
    readyAt: merged.readyAt, results: merged.results,
    laborant: merged.laborant, templateId: merged.templateId,
  });
  const updated = await api<any>(`/lab-results/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  labState = labState.map((x) => (x.id === id ? labFromApi(updated) : x));
  emitLab();
}
export async function removeLabTest(id: string) {
  await api(`/lab-results/${id}`, { method: 'DELETE' });
  labState = labState.filter((x) => x.id !== id);
  emitLab();
}

export function labTestDate(t: LabTestRecord): string {
  if (t.docDate) return t.docDate;
  const ms = t.readyAt ?? t.createdAt;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
