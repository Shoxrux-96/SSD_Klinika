import { useSyncExternalStore } from 'react';
import { makeKvStore } from './lib/dbKv';

export type ContactPhone = {
  id: string;
  label: string;
  number: string;
  tel: string;
  note?: string;
};

export type SocialPlatform = 'telegram' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'website' | 'other';

export type ContactSocial = {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  url: string;
  note?: string;
};

export type ContactSettings = {
  phones: ContactPhone[];
  socials: ContactSocial[];
  address: string;
  addressNote: string;
  availability: string;
  mapPosition: [number, number];
  mapZoom: number;
  logoDataUrl?: string;
  logoEnabled?: boolean;
};

export const DEFAULT_CONTACT: ContactSettings = {
  phones: [
    { id: 'p1', label: 'Asosiy raqam',     number: '+998 91 434 37 35', tel: '+998914343735', note: 'Qoʻngʻiroq uchun bosing' },
    { id: 'p2', label: 'Qoʻshimcha raqam', number: '+998 91 207 07 77', tel: '+998912070777', note: 'Qoʻngʻiroq uchun bosing' },
  ],
  socials: [
    { id: 's1', platform: 'telegram',  label: 'Telegram',  handle: '@ssd_klinika', url: 'https://t.me/ssd_klinika',        note: 'Rasmiy kanalga oʻtish' },
    { id: 's2', platform: 'instagram', label: 'Instagram', handle: '@ssd_klinika', url: 'https://instagram.com/ssd_klinika', note: 'Rasmiy sahifa' },
  ],
  address: 'Shovot tumani, J. Manguberdi koʻchasi, 28-A uy',
  addressNote: 'Xorazm viloyati, Oʻzbekiston',
  availability: 'Har kuni, 24 soat',
  mapPosition: [41.654459, 60.290992],
  mapZoom: 15,
  logoDataUrl: undefined,
  logoEnabled: true,
};

const store = makeKvStore<ContactSettings>('ssd-contact-settings', DEFAULT_CONTACT);

export function useContactSettings() {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function updateContactSettings(patch: Partial<ContactSettings>) {
  store.set((prev) => ({ ...prev, ...patch }));
}

export function addPhone(p: Omit<ContactPhone, 'id'>) {
  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  store.set((prev) => ({ ...prev, phones: [...prev.phones, { id, ...p }] }));
}
export function updatePhone(id: string, patch: Partial<ContactPhone>) {
  store.set((prev) => ({ ...prev, phones: prev.phones.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}
export function removePhone(id: string) {
  store.set((prev) => ({ ...prev, phones: prev.phones.filter((p) => p.id !== id) }));
}

export function addSocial(s: Omit<ContactSocial, 'id'>) {
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  store.set((prev) => ({ ...prev, socials: [...prev.socials, { id, ...s }] }));
}
export function updateSocial(id: string, patch: Partial<ContactSocial>) {
  store.set((prev) => ({ ...prev, socials: prev.socials.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
}
export function removeSocial(id: string) {
  store.set((prev) => ({ ...prev, socials: prev.socials.filter((s) => s.id !== id) }));
}

export function telHref(tel: string) {
  const digits = tel.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}
