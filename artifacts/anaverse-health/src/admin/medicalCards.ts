import { useSyncExternalStore } from 'react';
import { makeKvStore } from '../lib/dbKv';

export type MedicalVisit = {
  id: string;
  patientId: string;
  date: string;
  doctor?: string;
  complaints: string;
  diagnoses: string;
  advice: string;
  labResults: string;
  treatments: string;
  prescriptions: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

const store = makeKvStore<MedicalVisit[]>('ssd-medical-visits', []);

const cache = new Map<string, { snapshot: MedicalVisit[]; version: MedicalVisit[] }>();
function visitsByPatient(patientId: string, all: MedicalVisit[]) {
  const existing = cache.get(patientId);
  if (existing && existing.version === all) return existing.snapshot;
  const snapshot = all
    .filter((v) => v.patientId === patientId)
    .sort((a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt));
  cache.set(patientId, { snapshot, version: all });
  return snapshot;
}

export function useVisits(patientId: string) {
  return useSyncExternalStore(
    store.subscribe,
    () => visitsByPatient(patientId, store.get()),
    () => visitsByPatient(patientId, store.get()),
  );
}

export function addVisit(v: Omit<MedicalVisit, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = Date.now();
  const visit: MedicalVisit = {
    ...v,
    id: `mv_${now}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  store.set((prev) => [visit, ...prev]);
  return visit;
}

export function updateVisit(id: string, patch: Partial<MedicalVisit>) {
  store.set((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v)));
}

export function removeVisit(id: string) {
  store.set((prev) => prev.filter((v) => v.id !== id));
}

export function visitCount(patientId: string) {
  return store.get().filter((v) => v.patientId === patientId).length;
}
