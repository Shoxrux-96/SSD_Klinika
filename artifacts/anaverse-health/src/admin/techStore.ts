import { useEffect, useSyncExternalStore } from 'react';

export type TechProduct = {
  id: string;
  name: string;
  qty: number;
  costPrice: number;
  salePrice: number;
  addedAt: number;
};

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

let state: TechProduct[] = [];
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

let hydrated = false;
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rows = await api<any[]>('/tech-products');
    state = (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        id: r.id,
        name: r.name,
        qty: Number(r.qty) || 0,
        costPrice: Number(r.costPrice) || 0,
        salePrice: Number(r.salePrice) || 0,
        addedAt: Number(r.addedAt) || Date.now(),
      }))
      .sort((a, b) => b.addedAt - a.addedAt);
    emit();
  } catch (e) { console.error('tech-products hydrate failed', e); }
}

export function useTechProducts() {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function addTechProduct(p: Omit<TechProduct, 'id' | 'addedAt'>) {
  const row = await api<any>('/tech-products', { method: 'POST', body: JSON.stringify(p) });
  state = [{
    id: row.id, name: row.name,
    qty: Number(row.qty) || 0,
    costPrice: Number(row.costPrice) || 0,
    salePrice: Number(row.salePrice) || 0,
    addedAt: Number(row.addedAt) || Date.now(),
  }, ...state];
  emit();
}

export async function updateTechProduct(id: string, patch: Partial<Omit<TechProduct, 'id' | 'addedAt'>>) {
  const row = await api<any>(`/tech-products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  state = state.map((p) => (p.id === id ? { ...p, ...row } : p));
  emit();
}

export async function removeTechProduct(id: string) {
  await api(`/tech-products/${id}`, { method: 'DELETE' });
  state = state.filter((p) => p.id !== id);
  emit();
}
