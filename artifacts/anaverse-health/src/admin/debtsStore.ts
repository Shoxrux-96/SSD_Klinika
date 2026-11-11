// Qarz daftar store — "Keyinroq to'lash" bosilgan davolashlar.
// Endi /api/debts jadvaliga yoziladi (ilgari KV JSON-blobda edi).
import { useEffect, useSyncExternalStore } from 'react';

export type DebtRecord = {
  id: string;
  treatmentId: string;
  patientId?: string;
  patientJshshir?: string;
  patient: string;
  phone?: string;
  doctor: string;
  services: string[];
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  status: 'ochiq' | 'to\'landi' | 'yopildi';
  paidAt?: number;
  deferredAt: number;
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

function fromApi(row: any): DebtRecord {
  return {
    id: row.id,
    treatmentId: row.treatmentId ?? '',
    patientId: row.patientId ?? undefined,
    patientJshshir: row.patientJshshir ?? undefined,
    patient: row.patient ?? '',
    phone: row.phone ?? undefined,
    doctor: row.doctor ?? '',
    services: typeof row.services === 'string' && row.services.length
      ? row.services.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    amount: Number(row.amount) || 0,
    date: row.date ?? '',
    dueDate: row.dueDate ?? undefined,
    note: row.note ?? undefined,
    status: (row.status ?? 'ochiq') as DebtRecord['status'],
    paidAt: row.paidAt ?? undefined,
    deferredAt: Number(row.deferredAt) || Date.now(),
  };
}

function toApi(r: Partial<DebtRecord>) {
  const body: any = { ...r };
  if (Array.isArray(r.services)) body.services = r.services.join(', ');
  return body;
}

let state: DebtRecord[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

let hydrated = false;
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rows = await api<any[]>('/debts');
    state = (Array.isArray(rows) ? rows : []).map(fromApi).sort((a, b) => b.deferredAt - a.deferredAt);
    emit();
  } catch (e) { console.error('debts hydrate failed', e); }
}

export function useDebts(): DebtRecord[] {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function addDebt(rec: Omit<DebtRecord, 'id' | 'deferredAt' | 'status'> & { status?: DebtRecord['status'] }): Promise<void> {
  // Xuddi shu treatmentId uchun yozuv bo'lsa — yangilaymiz, aks holda qo'shamiz.
  const existing = state.find((d) => d.treatmentId === rec.treatmentId && d.status === 'ochiq');
  if (existing) {
    const body = toApi({ ...rec });
    const updated = await api<any>(`/debts/${existing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    state = state.map((d) => (d.id === existing.id ? fromApi(updated) : d));
    emit();
    return;
  }
  const body = toApi({ ...rec, id: `D-${Date.now().toString(36).toUpperCase()}` as any, status: rec.status ?? 'ochiq' });
  const created = await api<any>('/debts', { method: 'POST', body: JSON.stringify(body) });
  state = [fromApi(created), ...state];
  emit();
}

export async function removeDebt(treatmentId: string): Promise<void> {
  const target = state.find((d) => d.treatmentId === treatmentId);
  if (!target) return;
  await api(`/debts/${target.id}`, { method: 'DELETE' });
  state = state.filter((d) => d.id !== target.id);
  emit();
}

export async function markDebtPaid(treatmentId: string): Promise<void> {
  const target = state.find((d) => d.treatmentId === treatmentId);
  if (!target) return;
  const updated = await api<any>(`/debts/${target.id}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'to\'landi', paidAt: Date.now() }),
  });
  state = state.map((d) => (d.id === target.id ? fromApi(updated) : d));
  emit();
}

export function isDeferred(treatmentId: string): boolean {
  return state.some((d) => d.treatmentId === treatmentId && d.status === 'ochiq');
}

export function getDeferredIds(): Set<string> {
  return new Set(state.filter((d) => d.status === 'ochiq').map((d) => d.treatmentId));
}
