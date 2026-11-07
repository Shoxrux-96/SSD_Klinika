// Persistent key-value store backed by /api/settings — shared across all devices/users.
// Mirrors into localStorage as a fast-read cache + offline fallback.

import { getAuthToken } from '../auth/AuthContext';

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : (undefined as T)) as T;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const row = await api<{ key: string; value: T } | null>(`/settings/${encodeURIComponent(key)}`);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    await api(`/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) });
  } catch (e) {
    console.error(`kvSet(${key}) failed:`, e);
  }
}

/**
 * makeKvStore — minimal reactive store that persists to /api/settings AND mirrors to localStorage.
 * - First render returns cached (localStorage) value synchronously.
 * - On mount it fetches the DB value and reconciles.
 * - Writes go to both localStorage (sync) and DB (async).
 */
export function makeKvStore<T>(key: string, initial: T) {
  const lsKey = `ssd:kv:${key}`;
  let state: T = initial;
  let hydrated = false;
  let remotePulled = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function writeLs() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(lsKey, JSON.stringify(state)); } catch {}
  }

  function hydrateLs() {
    if (hydrated || typeof window === 'undefined') return;
    hydrated = true;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) state = JSON.parse(raw) as T;
    } catch {}
  }

  async function pullRemote() {
    if (remotePulled || typeof window === 'undefined') return;
    remotePulled = true;
    const v = await kvGet<T>(key);
    if (v != null) {
      state = v;
      writeLs();
      emit();
    }
  }

  return {
    get(): T {
      hydrateLs();
      void pullRemote();
      return state;
    },
    set(next: T | ((prev: T) => T)) {
      hydrateLs();
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      writeLs();
      emit();
      void kvSet(key, state);
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
