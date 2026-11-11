// Stomatologik tish xaritasi: patientId+jshshir ga bog'langan tish-tish yozuvlar.
// Jadval: `dental_records` (PostgreSQL). CRUD: /api/dental-records.
import { useEffect, useSyncExternalStore } from 'react';

export type ToothCondition =
  | 'soglom'    // sog'lom
  | 'kariyes'   // kariyes
  | 'plomba'    // plomba qo'yilgan
  | 'ildiz'     // ildiz davolangan
  | 'tojsiz'    // toj yo'q (sinishgan)
  | 'olingan'   // tish olingan
  | 'implant'   // implant
  | 'koronka'   // koronka
  | 'protez';   // protez

export type DentalRecord = {
  id: string;
  patientId: string;        // UUID (asosiy)
  patientJshshir?: string; // qo'shimcha identifikator
  tooth: string;            // FDI yoki qisqa ko'rinish: "18", "11", "48" (kattalar) yoki "51" bolalar
  condition: ToothCondition | string;
  procedure?: string;
  notes?: string;
  date: string;
  createdAt: number;
};

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : (undefined as T)) as T;
}

function fromApi(row: any): DentalRecord {
  return {
    id: row.id,
    patientId: row.patientId ?? '',
    patientJshshir: row.patientJshshir ?? undefined,
    tooth: String(row.tooth ?? ''),
    condition: row.condition,
    procedure: row.procedure ?? undefined,
    notes: row.notes ?? undefined,
    date: row.date,
    createdAt: Number(row.createdAt) || Date.now(),
  };
}

let state: DentalRecord[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

let hydrated = false;
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rows = await api<any[]>('/dental-records');
    state = rows.map(fromApi).sort((a, b) => b.createdAt - a.createdAt);
    emit();
  } catch (e) { console.error('dental-records hydrate failed', e); }
}

export function useDentalRecords(): DentalRecord[] {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function addDentalRecord(r: Omit<DentalRecord, 'id' | 'createdAt'>): Promise<DentalRecord> {
  const body = {
    id: `D-${Date.now().toString(36).toUpperCase()}`,
    patientId: r.patientId,
    patientJshshir: r.patientJshshir,
    tooth: r.tooth,
    condition: r.condition,
    procedure: r.procedure ?? null,
    notes: r.notes ?? null,
    date: r.date,
  };
  const created = await api<any>('/dental-records', { method: 'POST', body: JSON.stringify(body) });
  const row = fromApi(created);
  state = [row, ...state];
  emit();
  return row;
}

export async function updateDentalRecord(id: string, patch: Partial<DentalRecord>): Promise<void> {
  const body: any = { ...patch };
  await api(`/dental-records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  state = state.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
}

export async function removeDentalRecord(id: string): Promise<void> {
  await api(`/dental-records/${id}`, { method: 'DELETE' });
  state = state.filter((r) => r.id !== id);
  emit();
}
