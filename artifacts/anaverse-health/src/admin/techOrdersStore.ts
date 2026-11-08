// Tibbiy texnik buyurtmalar — /api/tech-orders jadvaliga yoziladi.
import { useEffect, useSyncExternalStore } from 'react';

export type TechOrder = {
  id: string;
  doctorId: string;
  patientId?: string;
  date: string;
  productName: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  status?: 'buyurtmada' | 'tayyor' | 'berilgan';
  note?: string;
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

function fromApi(row: any): TechOrder {
  return {
    id: row.id,
    doctorId: row.doctorId ?? '',
    patientId: row.patientId ?? undefined,
    date: row.date,
    productName: row.productName,
    qty: Number(row.qty) || 0,
    unitPrice: Number(row.unitPrice) || 0,
    totalAmount: Number(row.totalAmount) || 0,
    status: row.status ?? 'buyurtmada',
    note: row.note ?? undefined,
    createdAt: Number(row.createdAt) || Date.now(),
  };
}

let state: TechOrder[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

let hydrated = false;
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rows = await api<any[]>('/tech-orders');
    state = (Array.isArray(rows) ? rows : []).map(fromApi).sort((a, b) => b.createdAt - a.createdAt);
    emit();
  } catch (e) { console.error('tech-orders hydrate failed', e); }
}

export function useTechOrders() {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function addTechOrder(
  o: Omit<TechOrder, 'id' | 'createdAt' | 'totalAmount'> & { totalAmount?: number },
) {
  const id = `TO-${Date.now().toString(36).toUpperCase()}`;
  const totalAmount = o.totalAmount ?? Math.max(0, o.qty) * Math.max(0, o.unitPrice);
  const body = { ...o, id, totalAmount };
  const created = await api<any>('/tech-orders', { method: 'POST', body: JSON.stringify(body) });
  state = [fromApi(created), ...state];
  emit();
}

export async function updateTechOrder(id: string, patch: Partial<Omit<TechOrder, 'id'>>) {
  const existing = state.find((o) => o.id === id);
  const merged = { ...existing, ...patch } as TechOrder;
  if (patch.qty !== undefined || patch.unitPrice !== undefined) {
    merged.totalAmount = Math.max(0, merged.qty) * Math.max(0, merged.unitPrice);
  }
  const body: any = { ...patch };
  if (merged.totalAmount !== undefined) body.totalAmount = merged.totalAmount;
  const updated = await api<any>(`/tech-orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  state = state.map((o) => (o.id === id ? fromApi(updated) : o));
  emit();
}

export async function removeTechOrder(id: string) {
  await api(`/tech-orders/${id}`, { method: 'DELETE' });
  state = state.filter((o) => o.id !== id);
  emit();
}
