import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Calculator,
  Printer, Save, Stethoscope, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import { useAppointments, useEmployees, useServices } from '../store';
import { useTreatments } from '../clinicalData';
import { useTechProducts } from '../techStore';
import { usePayroll } from './AdminPayroll';
import { salaryInRange } from '../attendanceStore';
import { usePagination, TablePagination } from '../components/TablePagination';

type Txn = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  method: string;
  patientId: string | null;
  serviceId: string | null;
  employeeId?: string | null;
  description: string | null;
  date: string;
  createdAt: number;
};

type Period = 'daily' | 'monthly' | 'yearly';

type Category =
  | 'elektr' | 'gaz' | 'suv' | 'ijara' | 'internet'
  | 'telefon' | 'maosh' | 'soliq' | 'xomashyo' | 'transport'
  | 'ta_mir' | 'reklama' | 'boshqa';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'elektr', label: 'Elektr' },
  { key: 'gaz', label: 'Gaz' },
  { key: 'suv', label: 'Suv' },
  { key: 'ijara', label: 'Ijara' },
  { key: 'internet', label: 'Internet' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'maosh', label: 'Maosh' },
  { key: 'soliq', label: 'Soliq' },
  { key: 'xomashyo', label: 'Xomashyo / rasxodniy' },
  { key: 'transport', label: 'Transport' },
  { key: 'ta_mir', label: 'Taʼmir' },
  { key: 'reklama', label: 'Reklama' },
  { key: 'boshqa', label: 'Boshqa' },
];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
function parseDesc(s: string | null): { patientName?: string; serviceName?: string; note?: string; category?: string; categoryLabel?: string; kind?: string } {
  if (!s) return {};
  try { const o = JSON.parse(s); return typeof o === 'object' ? o : { note: s }; } catch { return { note: s }; }
}
function fmtDateTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function periodRange(period: Period, anchor: Date): { from: number; to: number; fromDate: string; toDate: string; label: string; months: number } {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (period === 'daily') {
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end = new Date(y, m, d + 1, 0, 0, 0, 0);
    return { from: start.getTime(), to: end.getTime(), fromDate: ymd(start), toDate: ymd(new Date(end.getTime() - 1)), label: `Kunlik — ${ymd(anchor)}`, months: 1 / 30 };
  }
  if (period === 'monthly') {
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 1, 0, 0, 0, 0);
    return { from: start.getTime(), to: end.getTime(), fromDate: ymd(start), toDate: ymd(new Date(end.getTime() - 1)), label: `Oylik — ${y}-${pad(m + 1)}`, months: 1 };
  }
  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
  return { from: start.getTime(), to: end.getTime(), fromDate: ymd(start), toDate: ymd(new Date(end.getTime() - 1)), label: `Yillik — ${y}`, months: 12 };
}

export function AdminFinance() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [period, setPeriod] = useState<Period>('monthly');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [modal, setModal] = useState<null | {
    type: 'expense' | 'income';
    category: Category;
    amount: string;
    method: 'naqd' | 'karta' | 'transfer';
    date: string;
    note: string;
  }>(null);
  const [saving, setSaving] = useState(false);

  const employees = useEmployees().filter((e) => !e.archived);
  const services = useServices();
  const appointments = useAppointments();
  const treatments = useTreatments();
  const techProducts = useTechProducts();
  const payroll = usePayroll();

  async function reload() {
    try {
      const r = await fetch('/api/transactions');
      const list = r.ok ? await r.json() : [];
      setTxns(Array.isArray(list) ? list : []);
    } catch { setTxns([]); }
  }
  useEffect(() => { reload(); }, []);

  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);

  const serviceByName = useMemo(() => new Map(services.map((s) => [s.name, s])), [services]);
  const techByName = useMemo(() => new Map(techProducts.map((p) => [p.name, p])), [techProducts]);

  // --- Operatsion hisob (hisoblanadi, boshqa sahifalardagi ma'lumotlardan)

  const ops = useMemo(() => {
    const inDateRange = (dateStr: string) => dateStr >= range.fromDate && dateStr <= range.toDate;

    // 1) Xizmatlar daromadi (bajarilgan qabullardan)
    let servicesRevenue = 0;
    let servicesCount = 0;
    let doctorShareExpense = 0;
    const perService: Record<string, { count: number; revenue: number; share: number }> = {};
    for (const a of appointments) {
      if (a.status !== 'keldi') continue;
      if (!inDateRange(a.date)) continue;
      const svc = serviceByName.get(a.service);
      if (!svc) continue;
      const price = svc.currency === 'som' ? svc.price : (svc.somValue ?? svc.price);
      servicesRevenue += price;
      servicesCount += 1;
      const sh = price * (svc.doctorShare / 100);
      doctorShareExpense += sh;
      const row = perService[a.service] ?? { count: 0, revenue: 0, share: 0 };
      row.count += 1; row.revenue += price; row.share += sh;
      perService[a.service] = row;
    }

    // 2) Texnik buyurtmalar — davolashdan tavsiya etilgan mahsulotlar
    let techSales = 0;       // daromad (sotish narxi × soni)
    let techCogs = 0;        // tannarx (xarajat)
    let techQty = 0;
    const perProduct: Record<string, { qty: number; sale: number; cost: number }> = {};
    for (const t of treatments) {
      if (!inDateRange(t.date)) continue;
      const items = t.techOrderItems ?? [];
      for (const it of items) {
        const p = techByName.get(it.name);
        if (!p) continue;
        const sale = (it.qty || 0) * p.salePrice;
        const cost = (it.qty || 0) * p.costPrice;
        techSales += sale;
        techCogs += cost;
        techQty += it.qty || 0;
        const row = perProduct[it.name] ?? { qty: 0, sale: 0, cost: 0 };
        row.qty += it.qty || 0; row.sale += sale; row.cost += cost;
        perProduct[it.name] = row;
      }
    }

    // 3) Oylik maosh — tibbiy xodimlar (bazaviy), xizmat xodimlari (davomat asosida)
    let medBase = 0;
    let svcGross = 0;
    let svcTax = 0;
    let svcNet = 0;
    const perEmployee: Record<string, { name: string; position: string; kind: string; gross: number; net: number; tax: number; worked?: number }> = {};
    for (const e of employees) {
      const entry = payroll[e.id];
      const base = entry?.baseSalary ?? 0;
      if (e.category === 'medical') {
        const gross = base * range.months;
        const tax = gross * 0.12;
        const net = gross - tax;
        medBase += net;
        perEmployee[e.id] = {
          name: e.fullName, position: e.position,
          kind: 'Shifokor', gross, net, tax,
        };
      } else {
        const s = salaryInRange(e.id, base, range.fromDate, range.toDate);
        svcGross += s.gross ?? 0;
        svcTax += s.tax ?? 0;
        svcNet += s.net ?? 0;
        perEmployee[e.id] = {
          name: e.fullName, position: e.position,
          kind: 'Xizmat', gross: s.gross ?? 0, net: s.net ?? 0, tax: s.tax ?? 0,
          worked: s.worked ?? 0,
        };
      }
    }

    const totalIncome = servicesRevenue + techSales;
    const totalOpExpense = doctorShareExpense + techCogs + medBase + svcNet; // chiqim: shifokor ulushi + tannarx + tibbiy baza + xizmat netto
    return {
      servicesRevenue, servicesCount,
      doctorShareExpense,
      techSales, techCogs, techQty,
      medBase, svcGross, svcTax, svcNet,
      totalIncome, totalOpExpense,
      opNet: totalIncome - totalOpExpense,
      perService, perProduct, perEmployee,
    };
  }, [appointments, serviceByName, treatments, techByName, employees, payroll, range]);

  // --- Qo'lda yozilgan tranzaksiyalar (modal + kassa)

  const inRangeTxns = useMemo(
    () => txns.filter((t) => t.createdAt >= range.from && t.createdAt < range.to),
    [txns, range]
  );
  // Kassa patient income → appointmentsdan qayta hisoblanadi, DBdagi income
  // satrini hisobga olmaymiz (ikki marta sanamaslik uchun). Faqat qo'lda
  // kiritilgan income rows (kind: 'manual_income') qo'shiladi.
  // Chiqim tomonda esa barcha DB rowslar hisoblanadi (eski `doctor_share`
  // avtomatik yozuvlardan tashqari — chunki ulush appointmentsdan hisoblanadi).
  const manualTxns = useMemo(
    () => inRangeTxns.filter((t) => {
      const d = parseDesc(t.description);
      if (t.type === 'income') return d.kind === 'manual_income';
      if (t.type === 'expense') return d.kind !== 'doctor_share';
      return false;
    }),
    [inRangeTxns]
  );
  const manualIncome = manualTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const manualExpense = manualTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  // --- Birlashtirilgan jami (operatsion + qo'lda kiritilgan)

  const total = {
    income: ops.totalIncome + manualIncome,
    expense: ops.totalOpExpense + manualExpense,
    net: ops.totalIncome + manualIncome - ops.totalOpExpense - manualExpense,
  };

  // --- Barcha kirim-chiqim satrlari (operatsion + DB qo'lda kiritilganlar)

  type Row = {
    date: string;
    kind: 'income' | 'expense';
    source: string;
    label: string;
    sub?: string;
    amount: number;
  };
  const ledger: Row[] = useMemo(() => {
    const rows: Row[] = [];
    const inDate = (s: string) => s >= range.fromDate && s <= range.toDate;

    // 1) Har bir qabul — xizmat daromadi + shifokor ulushi (alohida qatorlar)
    for (const a of appointments) {
      if (a.status !== 'keldi' || !inDate(a.date)) continue;
      const svc = serviceByName.get(a.service);
      if (!svc) continue;
      const price = svc.currency === 'som' ? svc.price : (svc.somValue ?? svc.price);
      rows.push({
        date: a.date, kind: 'income', source: 'Qabul',
        label: a.service,
        sub: `${a.patient}${a.doctor ? ' • ' + a.doctor : ''}`,
        amount: price,
      });
      const sh = price * (svc.doctorShare / 100);
      if (sh > 0) {
        rows.push({
          date: a.date, kind: 'expense', source: 'Ulush',
          label: `Shifokor ulushi — ${a.doctor || '—'}`,
          sub: `${a.service} • ${svc.doctorShare}% × ${fmt(price)}`,
          amount: sh,
        });
      }
    }

    // 2) Har bir texnik buyurtma elementi — sotuv + tannarx
    for (const t of treatments) {
      if (!inDate(t.date)) continue;
      for (const it of (t.techOrderItems ?? [])) {
        const prod = techByName.get(it.name);
        if (!prod) continue;
        const sale = (it.qty || 0) * prod.salePrice;
        const cost = (it.qty || 0) * prod.costPrice;
        if (sale > 0) rows.push({
          date: t.date, kind: 'income', source: 'Texnik buyurtma',
          label: `${it.name} (sotuv)`,
          sub: `${t.patient} • ${it.qty} dona × ${fmt(prod.salePrice)}${t.doctor ? ' • ' + t.doctor : ''}`,
          amount: sale,
        });
        if (cost > 0) rows.push({
          date: t.date, kind: 'expense', source: 'Texnik buyurtma',
          label: `${it.name} (tannarx)`,
          sub: `${t.patient} • ${it.qty} dona × ${fmt(prod.costPrice)}`,
          amount: cost,
        });
      }
    }

    // 3) Har bir xodim maoshi — alohida qator
    for (const e of employees) {
      const entry = payroll[e.id];
      const base = entry?.baseSalary ?? 0;
      if (!base) continue;
      if (e.category === 'medical') {
        const gross = base * range.months;
        const net = gross * 0.88;
        if (net > 0) rows.push({
          date: range.toDate, kind: 'expense', source: 'Maosh',
          label: `${e.fullName} — bazaviy maosh (netto)`,
          sub: `${e.position} • ${range.months === 12 ? '×12 oy' : range.months === 1 ? '1 oy' : 'kunlik proporsiya'} • brutto ${fmt(gross)} − soliq 12%`,
          amount: net,
        });
      } else {
        const s = salaryInRange(e.id, base, range.fromDate, range.toDate);
        if ((s.net ?? 0) > 0) rows.push({
          date: range.toDate, kind: 'expense', source: 'Maosh',
          label: `${e.fullName} — netto maosh`,
          sub: `${e.position} • ishga chiqqan ${s.worked} kun • soliq ${fmt(s.tax)}`,
          amount: s.net,
        });
      }
    }

    // 4) Qo'lda kiritilgan tranzaksiyalar — har biri
    for (const t of manualTxns) {
      const d = parseDesc(t.description);
      rows.push({
        date: t.date,
        kind: t.type === 'income' ? 'income' : 'expense',
        source: 'Qo‘lda',
        label: d.categoryLabel ?? d.note ?? '—',
        sub: d.note ?? undefined,
        amount: t.amount,
      });
    }

    return rows.sort((a, b) => {
      if (a.date === b.date) return a.kind === b.kind ? 0 : a.kind === 'income' ? -1 : 1;
      return a.date < b.date ? 1 : -1;
    });
  }, [appointments, serviceByName, treatments, techByName, employees, payroll, manualTxns, range]);

  const ledgerFiltered = useMemo(() => {
    if (filter === 'all') return ledger;
    return ledger.filter((r) => r.kind === filter);
  }, [ledger, filter]);

  const ledgerPg = usePagination(ledgerFiltered, [filter, range.from, range.to, ledgerFiltered.length]);

  // Snapshot hisobotlar (operatsion summalar bilan)
  const periodSnapshot = (p: Period, anc: Date) => {
    const r = periodRange(p, anc);
    const inDate = (s: string) => s >= r.fromDate && s <= r.toDate;
    let inc = 0, exp = 0;
    for (const a of appointments) {
      if (a.status !== 'keldi' || !inDate(a.date)) continue;
      const svc = serviceByName.get(a.service);
      if (!svc) continue;
      const price = svc.currency === 'som' ? svc.price : (svc.somValue ?? svc.price);
      inc += price;
      exp += price * (svc.doctorShare / 100);
    }
    for (const t of treatments) {
      if (!inDate(t.date)) continue;
      for (const it of (t.techOrderItems ?? [])) {
        const prod = techByName.get(it.name);
        if (!prod) continue;
        inc += (it.qty || 0) * prod.salePrice;
        exp += (it.qty || 0) * prod.costPrice;
      }
    }
    for (const e of employees) {
      const entry = payroll[e.id];
      const base = entry?.baseSalary ?? 0;
      if (!base) continue;
      if (e.category === 'medical') { exp += base * r.months; }
      else { const s = salaryInRange(e.id, base, r.fromDate, r.toDate); exp += s.net ?? 0; }
    }
    // manual from DB (bir xil qoida: income — faqat manual_income; expense — doctor_share'dan tashqari barchasi)
    const manual = txns.filter((t) => t.createdAt >= r.from && t.createdAt < r.to);
    const mi = manual.filter((t) => t.type === 'income' && parseDesc(t.description).kind === 'manual_income').reduce((s, t) => s + t.amount, 0);
    const me = manual.filter((t) => t.type === 'expense' && parseDesc(t.description).kind !== 'doctor_share').reduce((s, t) => s + t.amount, 0);
    return { income: inc + mi, expense: exp + me, net: inc + mi - exp - me };
  };
  const now = new Date();
  const todaySnap = useMemo(() => periodSnapshot('daily', now), [appointments, serviceByName, treatments, techByName, employees, payroll, txns]); // eslint-disable-line
  const monthSnap = useMemo(() => periodSnapshot('monthly', now), [appointments, serviceByName, treatments, techByName, employees, payroll, txns]); // eslint-disable-line
  const yearSnap = useMemo(() => periodSnapshot('yearly', now), [appointments, serviceByName, treatments, techByName, employees, payroll, txns]); // eslint-disable-line

  function openExpenseModal() {
    setModal({
      type: 'expense', category: 'elektr', amount: '',
      method: 'naqd', date: ymd(new Date()), note: '',
    });
  }

  async function saveModal() {
    if (!modal) return;
    const amount = Number(modal.amount.replace(/\s/g, ''));
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      const cat = CATEGORIES.find((c) => c.key === modal.category);
      const body = {
        type: modal.type,
        amount,
        currency: 'som',
        method: modal.method,
        patientId: null, serviceId: null, employeeId: null,
        description: JSON.stringify({
          category: modal.category,
          categoryLabel: cat?.label ?? modal.category,
          note: modal.note || null,
          kind: modal.type === 'expense' ? 'operational_expense' : 'manual_income',
        }),
        date: modal.date,
      };
      const r = await fetch('/api/transactions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('save failed');
      setModal(null);
      await reload();
    } catch (e) {
      alert('Saqlashda xatolik: ' + (e as Error).message);
    } finally { setSaving(false); }
  }

  function exportCsv() {
    const rows = [
      ['Sana', 'Tur', 'Manba', 'Nomi', 'Tafsilot', 'Summa'],
      ...ledgerFiltered.map((r) => [r.date, r.kind, r.source, r.label, r.sub ?? '', String(Math.round(r.amount))]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `moliya-${range.label}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const topProducts = Object.entries(ops.perProduct).sort((a, b) => b[1].sale - a[1].sale).slice(0, 10);
  const topServices = Object.entries(ops.perService).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
  const allEmployees = Object.values(ops.perEmployee).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'Shifokor' ? -1 : 1;
    return b.net - a.net;
  });

  // A4 PDF chop etish — barcha moliyaviy ko'rsatkichlar jadval shaklida
  function printPdf() {
    const now = new Date();
    const printedAt = `${ymd(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const expensesByCat = CATEGORIES.map((c) => {
      const sum = inRangeTxns
        .filter((t) => t.type === 'expense' && (parseDesc(t.description).category ?? 'boshqa') === c.key)
        .reduce((s, t) => s + t.amount, 0);
      return { label: c.label, sum };
    }).filter((r) => r.sum > 0);

    const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"/>
<title>SSD Klinika — Moliya hisobot (${esc(range.label)})</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'DM Sans', Arial, sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.35; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4pt; letter-spacing: -0.3pt; }
  h2 { font-size: 12pt; margin: 14pt 0 6pt; border-bottom: 1.5pt solid #0f172a; padding-bottom: 3pt; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5pt solid #0f172a; padding-bottom: 8pt; margin-bottom: 10pt; }
  .head .meta { font-size: 9pt; color: #475569; text-align: right; }
  .head .meta strong { display: block; color: #0f172a; font-size: 11pt; margin-bottom: 2pt; }
  .kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-bottom: 10pt; }
  .kpi > div { border: 1pt solid #cbd5e1; border-radius: 4pt; padding: 8pt; }
  .kpi small { display: block; font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.3pt; font-weight: 600; margin-bottom: 3pt; }
  .kpi strong { font-size: 14pt; font-variant-numeric: tabular-nums; }
  .kpi .ok { color: #047857; }
  .kpi .bad { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin-top: 4pt; font-size: 9.5pt; }
  th { background: #f1f5f9; text-align: left; padding: 5pt 6pt; border: 0.5pt solid #cbd5e1; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.2pt; }
  td { padding: 4.5pt 6pt; border: 0.5pt solid #e2e8f0; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fafbfc; }
  td.r, th.r { text-align: right; }
  tfoot td { font-weight: 700; background: #e2e8f0; border-top: 1pt solid #0f172a; }
  .footer { position: fixed; bottom: 6mm; left: 0; right: 0; font-size: 8pt; color: #94a3b8; text-align: center; }
  .page-break { page-break-before: always; }
  .muted { color: #64748b; }
  .chip-in { color: #047857; font-weight: 700; }
  .chip-out { color: #b91c1c; font-weight: 700; }
</style></head><body>
  <div class="head">
    <div>
      <h1>SSD Klinika — Moliyaviy hisobot</h1>
      <div class="muted">Sirius Stoma Dent Diagnostika markazi · ssdclinic.uz</div>
    </div>
    <div class="meta">
      <strong>${esc(range.label)}</strong>
      <div>Davr: ${esc(range.fromDate)} — ${esc(range.toDate)}</div>
      <div>Chop etilgan: ${esc(printedAt)}</div>
    </div>
  </div>

  <div class="kpi">
    <div><small>Jami kirim</small><strong class="ok">${fmt(total.income)} so'm</strong></div>
    <div><small>Jami chiqim</small><strong class="bad">${fmt(total.expense)} so'm</strong></div>
    <div><small>Sof foyda</small><strong class="${total.net >= 0 ? 'ok' : 'bad'}">${fmt(total.net)} so'm</strong></div>
  </div>

  <h2>1. Operatsion ko'rsatkichlar</h2>
  <table>
    <thead><tr><th>Ko'rsatkich</th><th class="r">Qiymat</th></tr></thead>
    <tbody>
      <tr><td>Xizmat daromadi (qabullardan)</td><td class="r chip-in">${fmt(ops.servicesRevenue)} so'm</td></tr>
      <tr><td>Texnik mahsulot sotuvi</td><td class="r chip-in">${fmt(ops.techSales)} so'm</td></tr>
      <tr><td>Shifokor ulushi (chiqim)</td><td class="r chip-out">${fmt(ops.doctorShareExpense)} so'm</td></tr>
      <tr><td>Mahsulot tannarxi (COGS)</td><td class="r chip-out">${fmt(ops.techCogs)} so'm</td></tr>
      <tr><td>Hodimlar oyligi (netto)</td><td class="r chip-out">${fmt(ops.medBase + ops.svcNet)} so'm</td></tr>
      <tr><td>Qo'lda kiritilgan kirim</td><td class="r chip-in">${fmt(manualIncome)} so'm</td></tr>
      <tr><td>Qo'lda kiritilgan chiqim</td><td class="r chip-out">${fmt(manualExpense)} so'm</td></tr>
    </tbody>
    <tfoot>
      <tr><td>SOF FOYDA</td><td class="r">${fmt(total.net)} so'm</td></tr>
    </tfoot>
  </table>

  ${expensesByCat.length > 0 ? `
  <h2>2. Chiqimlar kategoriyalar bo'yicha</h2>
  <table>
    <thead><tr><th>Kategoriya</th><th class="r">Summa</th><th class="r">Ulush (%)</th></tr></thead>
    <tbody>
      ${expensesByCat.map((e) => `
        <tr>
          <td>${esc(e.label)}</td>
          <td class="r chip-out">${fmt(e.sum)} so'm</td>
          <td class="r">${total.expense > 0 ? ((e.sum / total.expense) * 100).toFixed(1) : '0'}%</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot><tr><td>JAMI</td><td class="r">${fmt(expensesByCat.reduce((s, e) => s + e.sum, 0))} so'm</td><td class="r">100%</td></tr></tfoot>
  </table>` : ''}

  ${topServices.length > 0 ? `
  <h2>3. Top xizmatlar (daromad bo'yicha)</h2>
  <table>
    <thead><tr><th style="width:8%">#</th><th>Xizmat</th><th class="r">Soni</th><th class="r">Daromad</th></tr></thead>
    <tbody>
      ${topServices.map(([name, v], i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(name)}</td>
          <td class="r">${v.count}</td>
          <td class="r chip-in">${fmt(v.revenue)} so'm</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot><tr><td colspan="3">JAMI</td><td class="r">${fmt(topServices.reduce((s, [, v]) => s + v.revenue, 0))} so'm</td></tr></tfoot>
  </table>` : ''}

  ${topProducts.length > 0 ? `
  <h2>4. Top texnik mahsulotlar (sotuv bo'yicha)</h2>
  <table>
    <thead><tr><th style="width:8%">#</th><th>Mahsulot</th><th class="r">Soni</th><th class="r">Sotuv summasi</th></tr></thead>
    <tbody>
      ${topProducts.map(([name, v], i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(name)}</td>
          <td class="r">${v.qty}</td>
          <td class="r chip-in">${fmt(v.sale)} so'm</td>
        </tr>
      `).join('')}
    </tbody>
  </table>` : ''}

  ${allEmployees.length > 0 ? `
  <h2>5. Hodimlar bo'yicha hisob-kitob</h2>
  <table>
    <thead><tr><th>F.I.Sh.</th><th>Lavozim</th><th>Rol</th><th class="r">Brutto</th><th class="r">Soliq (12%)</th><th class="r">Netto</th></tr></thead>
    <tbody>
      ${allEmployees.map((e) => `
        <tr>
          <td>${esc(e.name)}</td>
          <td class="muted">${esc(e.position)}</td>
          <td class="muted">${esc(e.kind)}</td>
          <td class="r">${fmt(e.gross)} so'm</td>
          <td class="r chip-out">${fmt(e.tax)} so'm</td>
          <td class="r chip-in">${fmt(e.net)} so'm</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">JAMI</td>
        <td class="r">${fmt(allEmployees.reduce((s, e) => s + e.gross, 0))} so'm</td>
        <td class="r">${fmt(allEmployees.reduce((s, e) => s + e.tax, 0))} so'm</td>
        <td class="r">${fmt(allEmployees.reduce((s, e) => s + e.net, 0))} so'm</td>
      </tr>
    </tfoot>
  </table>` : ''}

  ${ledgerFiltered.length > 0 ? `
  <h2 class="page-break">6. Tranzaksiyalar jurnal (${ledgerFiltered.length} ta)</h2>
  <table>
    <thead><tr><th style="width:12%">Sana</th><th>Manba</th><th>Tavsif</th><th class="r">Summa</th></tr></thead>
    <tbody>
      ${ledgerFiltered.slice(0, 200).map((r) => `
        <tr>
          <td>${esc(r.date)}</td>
          <td class="muted">${esc(r.source)}</td>
          <td>${esc(r.label)}${r.sub ? ` <span class="muted">· ${esc(r.sub)}</span>` : ''}</td>
          <td class="r ${r.kind === 'income' ? 'chip-in' : 'chip-out'}">${r.kind === 'income' ? '+' : '−'}${fmt(r.amount)} so'm</td>
        </tr>
      `).join('')}
    </tbody>
    ${ledgerFiltered.length > 200 ? `<tfoot><tr><td colspan="4" class="muted">... va yana ${ledgerFiltered.length - 200} ta yozuv (to'liq ro'yxat CSV orqali)</td></tr></tfoot>` : ''}
  </table>` : ''}

  <div class="footer">SSD Klinika · Moliya hisoboti · ${esc(printedAt)} · ssdclinic.uz</div>
  <script>
    window.addEventListener('load', () => setTimeout(() => { window.print(); }, 180));
  </script>
</body></html>`;

    // Yangi oyna yoki yashirin iframe orqali chop etish — asosiy UI o'zgarmaydi
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // Chop oynasi yopilgach iframe o'chadi
    const cleanup = () => setTimeout(() => iframe.remove(), 500);
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 15000);
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Moliya</h1>
          <p>
            Korxona kirim-chiqimi — xizmatlar, texnik buyurtmalar, oylik maosh va shifokor ulushi birlashtirildi.
          </p>
        </div>
        <div className="admin-page-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['daily', 'monthly', 'yearly'] as const).map((p) => (
              <button key={p}
                className={`admin-btn ${period === p ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                onClick={() => setPeriod(p)}>
                {p === 'daily' ? 'Kunlik' : p === 'monthly' ? 'Oylik' : 'Yillik'}
              </button>
            ))}
          </div>
          {period === 'daily' && (
            <input className="admin-input" type="date" value={ymd(anchor)}
              onChange={(e) => setAnchor(e.target.value ? new Date(e.target.value) : new Date())} />
          )}
          {period === 'monthly' && (
            <input className="admin-input" type="month" value={`${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                if (y && m) setAnchor(new Date(y, m - 1, 1));
              }} />
          )}
          {period === 'yearly' && (
            <input className="admin-input" type="number" min={2000} max={2100} value={anchor.getFullYear()}
              style={{ width: 120 }}
              onChange={(e) => setAnchor(new Date(Number(e.target.value || new Date().getFullYear()), 0, 1))} />
          )}
          <button className="admin-btn admin-btn-ghost" onClick={printPdf} title="A4 formatda PDF hujjatga chop etish">
            <Printer size={14} /> Chop etish (PDF A4)
          </button>
          <button className="admin-btn admin-btn-ghost" onClick={exportCsv}>CSV yuklab olish</button>
          <button className="admin-btn admin-btn-primary" onClick={openExpenseModal}>+ Yangi to‘lov</button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Wallet size={18} /></div>
          <div className="admin-stat-copy">
            <small>Jami kirim ({range.label})</small>
            <strong style={{ color: '#16a34a' }}>{fmt(total.income)} soʻm</strong>
            <span className="admin-stat-trend trend-up"><ArrowUpRight size={13} /> xizmat + texnik</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><TrendingDown size={18} /></div>
          <div className="admin-stat-copy">
            <small>Jami chiqim</small>
            <strong style={{ color: '#dc2626' }}>{fmt(total.expense)} soʻm</strong>
            <span className="admin-stat-trend trend-down"><ArrowDownRight size={13} /> ulush + maosh + xarajat</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Calculator size={18} /></div>
          <div className="admin-stat-copy">
            <small>Sof foyda</small>
            <strong style={{ color: total.net >= 0 ? '#0f172a' : '#dc2626' }}>{fmt(total.net)} soʻm</strong>
            <span className={`admin-stat-trend trend-${total.net >= 0 ? 'up' : 'down'}`}>
              kirim − chiqim
            </span>
          </div>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Davriy hisobot (hozir)</h2>
            <small>Bugun, shu oy va shu yil bo‘yicha jami ko‘rsatkichlar.</small>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Davr</th>
                <th style={{ textAlign: 'right' }}>Kirim</th>
                <th style={{ textAlign: 'right' }}>Chiqim</th>
                <th style={{ textAlign: 'right' }}>Sof foyda</th>
              </tr>
            </thead>
            <tbody>
              {([
                { name: 'Bugun', s: todaySnap },
                { name: 'Shu oy', s: monthSnap },
                { name: 'Shu yil', s: yearSnap },
              ] as const).map((row) => (
                <tr key={row.name}>
                  <td><strong>{row.name}</strong></td>
                  <td style={{ textAlign: 'right', color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.s.income)}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.s.expense)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: row.s.net >= 0 ? '#0f172a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <section className="admin-card">
          <div className="admin-card-head">
            <div><h2><Stethoscope size={16} /> Top xizmatlar</h2><small>{range.label}</small></div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Xizmat</th><th style={{ textAlign: 'right' }}>Son</th><th style={{ textAlign: 'right' }}>Daromad</th></tr></thead>
              <tbody>
                {topServices.length === 0 && <tr><td colSpan={3} className="admin-cell-muted">Yo‘q.</td></tr>}
                {topServices.map(([name, v]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td style={{ textAlign: 'right' }}>{v.count}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmt(v.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <div><h2>Top texnik mahsulotlar</h2><small>sotuv va tannarx bo‘yicha</small></div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Mahsulot</th><th style={{ textAlign: 'right' }}>Dona</th><th style={{ textAlign: 'right' }}>Sotuv</th><th style={{ textAlign: 'right' }}>Foyda</th></tr></thead>
              <tbody>
                {topProducts.length === 0 && <tr><td colSpan={4} className="admin-cell-muted">Yo‘q.</td></tr>}
                {topProducts.map(([name, v]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td style={{ textAlign: 'right' }}>{v.qty}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmt(v.sale)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v.sale - v.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="admin-card" style={{ marginTop: 12 }}>
          <div className="admin-card-head">
            <div><h2>Xodimlar maosh ro‘yxati</h2><small>brutto × soliq × netto, davomat asosida kunlik hisob</small></div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr>
                <th>Xodim</th>
                <th>Tur</th>
                <th style={{ textAlign: 'center' }}>Kun</th>
                <th style={{ textAlign: 'right' }}>Brutto</th>
                <th style={{ textAlign: 'right' }}>Soliq</th>
                <th style={{ textAlign: 'right' }}>Netto</th>
              </tr></thead>
              <tbody>
                {allEmployees.length === 0 && <tr><td colSpan={6} className="admin-cell-muted">Yo‘q.</td></tr>}
                {allEmployees.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <div>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{r.position}</div>
                    </td>
                    <td className="admin-cell-muted" style={{ fontSize: 12 }}>{r.kind}</td>
                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {r.kind === 'Xizmat' ? (r.worked ?? 0) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.gross)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{fmt(r.tax)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.net)}</td>
                  </tr>
                ))}
              </tbody>
              {allEmployees.length > 0 && (() => {
                const g = allEmployees.reduce((s, r) => s + r.gross, 0);
                const t = allEmployees.reduce((s, r) => s + r.tax, 0);
                const n = allEmployees.reduce((s, r) => s + r.net, 0);
                return (
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
                      <td colSpan={3}>Jami ({allEmployees.length} ta xodim)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(g)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(t)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(n)}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
      </section>

      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Birlashgan kirim-chiqim jurnali</h2>
            <small>{ledgerFiltered.length} ta satr — {range.label}</small>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'income', 'expense'] as const).map((k) => (
              <button key={k}
                className={`admin-btn ${filter === k ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                onClick={() => setFilter(k)}>
                {k === 'all' ? 'Barchasi' : k === 'income' ? 'Kirim' : 'Chiqim'}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Manba</th>
                <th>Nomi</th>
                <th style={{ textAlign: 'right' }}>Summa</th>
                <th>Tur</th>
              </tr>
            </thead>
            <tbody>
              {ledgerFiltered.length === 0 && (
                <tr><td colSpan={5} className="admin-cell-muted">Maʼlumot yo‘q.</td></tr>
              )}
              {ledgerPg.pageRows.map((r, i) => (
                <tr key={i}>
                  <td className="admin-cell-muted">{r.date}</td>
                  <td>{r.source}</td>
                  <td>
                    <div>{r.label}</div>
                    {r.sub && <div style={{ fontSize: 11, color: '#64748b' }}>{r.sub}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: r.kind === 'income' ? '#16a34a' : '#dc2626' }}>
                    {r.kind === 'income' ? '+' : '−'}{fmt(r.amount)} soʻm
                  </td>
                  <td>
                    <span className={`admin-chip chip-${r.kind === 'income' ? 'ok' : 'danger'}`}>
                      {r.kind === 'income' ? 'kirim' : 'chiqim'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {ledgerFiltered.length > 0 && (() => {
              const sumInc = ledgerFiltered.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0);
              const sumExp = ledgerFiltered.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0);
              const net = sumInc - sumExp;
              return (
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={3} style={{ textAlign: 'right' }}>Jami kirim</td>
                    <td style={{ textAlign: 'right', color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                      +{fmt(sumInc)} soʻm
                    </td>
                    <td></td>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={3} style={{ textAlign: 'right' }}>Jami chiqim</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                      −{fmt(sumExp)} soʻm
                    </td>
                    <td></td>
                  </tr>
                  <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                    <td colSpan={3} style={{ textAlign: 'right' }}>Sof foyda</td>
                    <td style={{ textAlign: 'right', color: net >= 0 ? '#0f172a' : '#dc2626', fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>
                      {fmt(net)} soʻm
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
          <TablePagination {...ledgerPg} />
        </div>
      </section>

      {modal && (
        <div className="appt-modal-backdrop" onClick={() => !saving && setModal(null)}>
          <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tw-head">
              <h2>Yangi to‘lov</h2>
              <button className="admin-icon-btn sm" onClick={() => setModal(null)} aria-label="Yopish">
                <X size={16} />
              </button>
            </div>
            <div className="tw-body">
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button type="button"
                  className={`admin-btn ${modal.type === 'expense' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                  onClick={() => setModal({ ...modal, type: 'expense' })}>
                  <TrendingDown size={14} /> Chiqim
                </button>
                <button type="button"
                  className={`admin-btn ${modal.type === 'income' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                  onClick={() => setModal({ ...modal, type: 'income' })}>
                  <TrendingUp size={14} /> Kirim
                </button>
              </div>

              <label className="tw-label">
                <span>Kategoriya</span>
                <select value={modal.category}
                  onChange={(e) => setModal({ ...modal, category: e.target.value as Category })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </label>

              <div className="appt-modal-row">
                <label className="tw-label">
                  <span>Summa (soʻm)</span>
                  <input type="number" min={0} value={modal.amount}
                    onChange={(e) => setModal({ ...modal, amount: e.target.value })}
                    placeholder="0" autoFocus />
                </label>
                <label className="tw-label">
                  <span>To‘lov usuli</span>
                  <select value={modal.method}
                    onChange={(e) => setModal({ ...modal, method: e.target.value as any })}>
                    <option value="naqd">Naqd</option>
                    <option value="karta">Karta</option>
                    <option value="transfer">O‘tkazma</option>
                  </select>
                </label>
              </div>

              <label className="tw-label">
                <span>Sana</span>
                <input type="date" value={modal.date}
                  onChange={(e) => setModal({ ...modal, date: e.target.value })} />
              </label>

              <label className="tw-label">
                <span>Izoh</span>
                <input type="text" value={modal.note}
                  onChange={(e) => setModal({ ...modal, note: e.target.value })}
                  placeholder="masalan: 10-oy uchun elektr toʻlovi" />
              </label>

              {Number(modal.amount) > 0 && (
                <div className="tw-selected-summary">
                  {modal.type === 'expense' ? 'Chiqim' : 'Kirim'}:{' '}
                  <strong style={{ color: modal.type === 'expense' ? '#dc2626' : '#16a34a' }}>
                    {fmt(Number(modal.amount))} soʻm
                  </strong>
                </div>
              )}
            </div>
            <div className="tw-foot">
              <button type="button" className="admin-btn admin-btn-ghost"
                onClick={() => setModal(null)} disabled={saving}>Bekor qilish</button>
              <button type="button" className="admin-btn admin-btn-primary"
                onClick={saveModal} disabled={saving || !modal.amount || Number(modal.amount) <= 0}>
                <Save size={15} /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
