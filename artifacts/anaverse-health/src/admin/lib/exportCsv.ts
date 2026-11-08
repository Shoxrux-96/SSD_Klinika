// CSV eksporti — Excel qabul qiladigan formatda (UTF-8 BOM + CRLF).
// Hech qanday 3rd-party kutubxona talab qilmaydi; brauzerda Blob orqali yuklab olinadi.

export type CsvColumn<T> = {
  header: string;
  get: (row: T) => string | number | null | undefined;
};

function escape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  // "," yoki '\n' yoki '"' bo'lsa — qo'shtirnoq ichiga olamiz
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(c.get(r))).join(',')).join('\r\n');
  // Excel BOM — UTF-8 ni to'g'ri aniqlashi uchun
  const csv = '﻿' + header + '\r\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Bugungi sanani fayl nomiga qo'shish uchun (YYYY-MM-DD). */
export function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
