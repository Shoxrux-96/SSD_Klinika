import { useSyncExternalStore } from 'react';
import { makeKvStore } from './lib/dbKv';

export type PromoSettings = {
  enabled: boolean;
  prefix: string;
  percent: number;
  validMonths: number;
  minAmount: number;
};

export type PromoCode = {
  id: string;
  code: string;
  amount: number;
  percent: number;
  patientId?: string;
  patientName?: string;
  paymentId?: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  usedPaymentId?: string;
};

export const DEFAULT_PROMO: PromoSettings = {
  enabled: true,
  prefix: 'SIRIUS',
  percent: 5,
  validMonths: 6,
  minAmount: 300000,
};

const settingsStore = makeKvStore<PromoSettings>('ssd-promo-settings', DEFAULT_PROMO);
const codesStore = makeKvStore<PromoCode[]>('ssd-promo-codes', []);

export function usePromoSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}
export function usePromoCodes() {
  return useSyncExternalStore(codesStore.subscribe, codesStore.get, codesStore.get);
}

export function updatePromoSettings(patch: Partial<PromoSettings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}
export function getPromoSettings() { return settingsStore.get(); }
export function getPromoCodes() { return codesStore.get(); }

function randomSuffix(len = 4) {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export function generatePromoForPayment(opts: {
  paymentId?: string;
  paymentTotal: number;
  patientId?: string;
  patientName?: string;
}): PromoCode | null {
  const settings = settingsStore.get();
  if (!settings.enabled) return null;
  if (settings.minAmount > 0 && opts.paymentTotal < settings.minAmount) return null;
  const amount = Math.round((opts.paymentTotal * settings.percent) / 100);
  if (amount <= 0) return null;

  const now = Date.now();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + Math.max(1, settings.validMonths || 6));

  const prefix = (settings.prefix || 'PROMO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'PROMO';
  const code = `${prefix}-${randomSuffix(4)}`;
  const entry: PromoCode = {
    id: `pc_${now}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    amount,
    percent: settings.percent,
    patientId: opts.patientId,
    patientName: opts.patientName,
    paymentId: opts.paymentId,
    createdAt: now,
    expiresAt: expires.getTime(),
  };
  codesStore.set((prev) => [entry, ...prev]);
  return entry;
}

export function findPromoByCode(code: string): PromoCode | undefined {
  const c = code.trim().toUpperCase();
  return codesStore.get().find((x) => x.code === c);
}

export function markPromoUsed(id: string, paymentId?: string) {
  codesStore.set((prev) => prev.map((c) => (c.id === id ? { ...c, usedAt: Date.now(), usedPaymentId: paymentId } : c)));
}

export function removePromoCode(id: string) {
  codesStore.set((prev) => prev.filter((c) => c.id !== id));
}
