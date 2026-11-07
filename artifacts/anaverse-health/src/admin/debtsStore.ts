// Qarz daftar store — "Keyinroq to'lash" bosilgan davolashlar.
// DB (/api/settings:ssd-debts) orqali saqlanadi, barcha sahifa va foydalanuvchilar o'rtasida sinxron.
// localStorage — cache + offline fallback.
import { useSyncExternalStore } from 'react';
import { makeKvStore } from '../lib/dbKv';

export type DebtRecord = {
  treatmentId: string;
  patient: string;
  phone?: string;
  doctor: string;
  services: string[];
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  deferredAt: number;
};

const store = makeKvStore<DebtRecord[]>('ssd-debts', []);

export function useDebts(): DebtRecord[] {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function addDebt(rec: Omit<DebtRecord, 'deferredAt'>): void {
  store.set((prev) => {
    const existing = prev.find((d) => d.treatmentId === rec.treatmentId);
    if (existing) {
      return prev.map((d) => (d.treatmentId === rec.treatmentId ? { ...d, ...rec } : d));
    }
    return [{ ...rec, deferredAt: Date.now() }, ...prev];
  });
}

export function removeDebt(treatmentId: string): void {
  store.set((prev) => prev.filter((d) => d.treatmentId !== treatmentId));
}

export function isDeferred(treatmentId: string): boolean {
  return store.get().some((d) => d.treatmentId === treatmentId);
}

export function getDeferredIds(): Set<string> {
  return new Set(store.get().map((d) => d.treatmentId));
}
