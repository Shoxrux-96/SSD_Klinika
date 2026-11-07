import { useEffect, useSyncExternalStore } from 'react';

export type AttendanceStatus = 'keldi' | 'kech' | 'kelmagan';
export type AttendanceRecord = {
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
};

export const INCOME_TAX = 0.12; // 12% daromad solig'i

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

let records: AttendanceRecord[] = [];
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

let hydrated = false;
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rows = await api<any[]>('/attendance');
    records = (Array.isArray(rows) ? rows : []).map((r) => ({
      employeeId: r.employeeId,
      date: r.date,
      status: r.status as AttendanceStatus,
    }));
    emit();
  } catch (e) { console.error('attendance hydrate failed', e); }
}

export function useAttendance() {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(subscribe, () => records, () => records);
}

// Yangi yozuvni serverga yuboradi. Status o'zgartirilmaydi — bir marta kiritiladi.
export async function setAttendance(employeeId: string, date: string, status: AttendanceStatus) {
  const exists = records.find((r) => r.employeeId === employeeId && r.date === date);
  if (exists) return false;
  // Optimistik yangilanish
  records = [...records, { employeeId, date, status }];
  emit();
  try {
    await api('/attendance', { method: 'POST', body: JSON.stringify({ employeeId, date, status }) });
    return true;
  } catch (e) {
    // Rollback
    records = records.filter((r) => !(r.employeeId === employeeId && r.date === date));
    emit();
    console.error('setAttendance failed', e);
    return false;
  }
}

export function getAttendance(employeeId: string, date: string): AttendanceStatus | undefined {
  return records.find((r) => r.employeeId === employeeId && r.date === date)?.status;
}

export async function clearAttendance(employeeId: string, date: string) {
  const prev = records;
  records = records.filter((r) => !(r.employeeId === employeeId && r.date === date));
  emit();
  try {
    await api(`/attendance/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}`, { method: 'DELETE' });
  } catch (e) {
    records = prev;
    emit();
    console.error('clearAttendance failed', e);
  }
}

// Dam olish kuni — yakshanba (0). Shu kunlar ish kunidan chiqarib tashlanadi.
export function workingDaysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0) count++;
  }
  return count;
}

export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const out: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

// Kunlik stavka: (oylik brutto × (1 − soliq)) / shu oyning ish kunlari
export function dailyRateFor(grossMonthly: number, ym: string): number {
  const wd = workingDaysInMonth(ym);
  if (wd <= 0) return 0;
  return (grossMonthly * (1 - INCOME_TAX)) / wd;
}

export function workedDaysInRange(employeeId: string, from: string, to: string): number {
  return records.filter(
    (r) => r.employeeId === employeeId
      && r.date >= from && r.date <= to
      && (r.status === 'keldi' || r.status === 'kech'),
  ).length;
}

export function salaryInRange(employeeId: string, grossMonthly: number, from: string, to: string) {
  if (!grossMonthly) return { gross: 0, tax: 0, net: 0, worked: 0, present: 0, late: 0, absent: 0 };
  const months = monthsBetween(from, to);
  let net = 0;
  for (const ym of months) {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mStart = `${ym}-01`;
    const mEnd = `${ym}-${String(lastDay).padStart(2, '0')}`;
    const rangeFrom = from > mStart ? from : mStart;
    const rangeTo = to < mEnd ? to : mEnd;
    const rate = dailyRateFor(grossMonthly, ym);
    const worked = workedDaysInRange(employeeId, rangeFrom, rangeTo);
    net += rate * worked;
  }
  const in1 = records.filter((r) => r.employeeId === employeeId && r.date >= from && r.date <= to);
  const present = in1.filter((r) => r.status === 'keldi').length;
  const late = in1.filter((r) => r.status === 'kech').length;
  const absent = in1.filter((r) => r.status === 'kelmagan').length;
  const worked = present + late;
  const gross = net / (1 - INCOME_TAX);
  const tax = gross - net;
  return { gross, tax, net, worked, present, late, absent };
}
