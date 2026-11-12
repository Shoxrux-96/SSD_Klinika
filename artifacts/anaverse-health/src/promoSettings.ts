import { useEffect, useSyncExternalStore } from 'react';
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

// --- Promo kodlar DB bilan sinxronlashtiriladi (/api/promo-codes) ---
let codes: PromoCode[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function sub(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

function normalize(row: any): PromoCode {
  return {
    id: row.id,
    code: row.code,
    amount: row.amount ?? 0,
    percent: row.percent ?? 0,
    patientId: row.patientId ?? undefined,
    patientName: row.patientName ?? undefined,
    paymentId: row.paymentId ?? undefined,
    createdAt: Number(row.createdAt) || Date.now(),
    expiresAt: Number(row.expiresAt) || 0,
    usedAt: row.usedAt ? Number(row.usedAt) : undefined,
    usedPaymentId: row.usedPaymentId ?? undefined,
  };
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const res = await fetch('/api/promo-codes');
    const rows: any[] = await res.json();
    codes = rows.map(normalize);
    emit();
  } catch (e) { console.warn('promo hydrate failed', e); }
}

export function usePromoSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}
export function usePromoCodes(): PromoCode[] {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(sub, () => codes, () => codes);
}

export function updatePromoSettings(patch: Partial<PromoSettings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}
export function getPromoSettings() { return settingsStore.get(); }
export function getPromoCodes() { return codes; }

function randomSuffix(len = 4) {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export async function generatePromoForPayment(opts: {
  paymentId?: string;
  paymentTotal: number;
  patientId?: string;
  patientName?: string;
}): Promise<PromoCode | null> {
  const settings = settingsStore.get();
  if (!settings.enabled) return null;
  if (settings.minAmount > 0 && opts.paymentTotal < settings.minAmount) return null;
  const amount = Math.round((opts.paymentTotal * settings.percent) / 100);
  if (amount <= 0) return null;

  const now = Date.now();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + Math.max(1, settings.validMonths || 6));

  const prefix = (settings.prefix || 'PROMO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'PROMO';
  const entry: PromoCode = {
    id: `pc_${now}_${Math.random().toString(36).slice(2, 6)}`,
    code: `${prefix}-${randomSuffix(4)}`,
    amount,
    percent: settings.percent,
    patientId: opts.patientId,
    patientName: opts.patientName,
    paymentId: opts.paymentId,
    createdAt: now,
    expiresAt: expires.getTime(),
  };
  try {
    const res = await fetch('/api/promo-codes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = normalize(await res.json());
    codes = [saved, ...codes];
    emit();
    return saved;
  } catch (e) {
    console.warn('promo save failed', e);
    return null;
  }
}

export function findPromoByCode(code: string): PromoCode | undefined {
  const c = code.trim().toUpperCase();
  return codes.find((x) => x.code === c);
}

export async function markPromoUsed(id: string, paymentId?: string) {
  try {
    const res = await fetch(`/api/promo-codes/${id}/mark-used`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    const row = normalize(await res.json());
    codes = codes.map((c) => (c.id === id ? row : c));
    emit();
  } catch (e) { console.warn('promo mark-used failed', e); }
}

export async function removePromoCode(id: string) {
  try {
    await fetch(`/api/promo-codes/${id}`, { method: 'DELETE' });
    codes = codes.filter((c) => c.id !== id);
    emit();
  } catch (e) { console.warn('promo delete failed', e); }
}
