import { useSyncExternalStore } from 'react';
import { makeKvStore } from '../lib/dbKv';

export type TechOrder = {
  id: string;
  doctorId: string;
  date: string;
  productName: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  note?: string;
};

const store = makeKvStore<TechOrder[]>('ssd-tech-orders', []);

export function useTechOrders() {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function addTechOrder(o: Omit<TechOrder, 'id' | 'totalAmount'> & { totalAmount?: number }) {
  const id = `TO-${Date.now().toString(36).toUpperCase()}`;
  const totalAmount = o.totalAmount ?? Math.max(0, o.qty) * Math.max(0, o.unitPrice);
  store.set((prev) => [{ ...o, id, totalAmount }, ...prev]);
}

export function updateTechOrder(id: string, patch: Partial<Omit<TechOrder, 'id'>>) {
  store.set((prev) =>
    prev.map((o) => {
      if (o.id !== id) return o;
      const merged = { ...o, ...patch };
      if (patch.qty !== undefined || patch.unitPrice !== undefined) {
        merged.totalAmount = Math.max(0, merged.qty) * Math.max(0, merged.unitPrice);
      }
      return merged;
    }),
  );
}

export function removeTechOrder(id: string) {
  store.set((prev) => prev.filter((o) => o.id !== id));
}

export function summarizeOrders(doctorId: string, from: string, to: string) {
  const list = store.get().filter((o) => o.doctorId === doctorId && o.date >= from && o.date <= to);
  const count = list.length;
  const qty = list.reduce((s, o) => s + o.qty, 0);
  const amount = list.reduce((s, o) => s + o.totalAmount, 0);
  return { count, qty, amount, list };
}
