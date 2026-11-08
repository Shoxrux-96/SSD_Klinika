// Klinika rasmiy ma'lumotlari — /api/settings kalit "ssd-clinic-info" orqali.
import { useSyncExternalStore } from 'react';
import { makeKvStore } from './lib/dbKv';

export type ClinicInfo = {
  name: string;
  email: string;
};

export const DEFAULT_CLINIC_INFO: ClinicInfo = {
  name: 'SSD Klinika — Sirius Stoma Dent Diagnostika markazi',
  email: 'info@ssdclinic.uz',
};

const store = makeKvStore<ClinicInfo>('ssd-clinic-info', DEFAULT_CLINIC_INFO);

export function useClinicInfo(): ClinicInfo {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function updateClinicInfo(patch: Partial<ClinicInfo>): void {
  store.set((prev) => ({ ...prev, ...patch }));
}
