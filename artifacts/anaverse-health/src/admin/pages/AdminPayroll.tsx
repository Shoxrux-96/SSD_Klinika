import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Banknote, Calculator, CheckCircle2, ChevronDown, ChevronRight, Edit3, Package,
  Printer, Search, Users, Wallet, X,
} from 'lucide-react';
import { useAppointments, useEmployees, useServices } from '../store';
import {
  useAttendance, salaryInRange, dailyRateFor, INCOME_TAX,
} from '../attendanceStore';
import { useTreatments } from '../clinicalData';
import { useTechProducts } from '../techStore';

type Period = 'daily' | 'monthly' | 'yearly';

type PayrollEntry = {
  employeeId: string;
  baseSalary: number;
  currency: 'som' | 'rubl' | 'dollar';
  note?: string;
};

async function payrollApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const txt = await res.text(); return txt ? (JSON.parse(txt) as T) : (undefined as T);
}

function parseNote(s: string | null | undefined): { currency?: 'som' | 'rubl' | 'dollar'; note?: string } {
  if (!s) return {};
  try { const o = JSON.parse(s); return typeof o === 'object' ? o : { note: s }; } catch { return { note: s }; }
}

let payrollState: Record<string, PayrollEntry & { _rowId?: string }> = {};
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function sub(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

let payrollHydrated = false;
async function hydratePayroll() {
  if (payrollHydrated || typeof window === 'undefined') return;
  payrollHydrated = true;
  try {
    const rows = await payrollApi<any[]>('/payrolls');
    const next: Record<string, PayrollEntry & { _rowId?: string }> = {};
    for (const r of rows) {
      const n = parseNote(r.notes);
      next[r.employeeId] = {
        employeeId: r.employeeId,
        baseSalary: r.baseSalary ?? 0,
        currency: n.currency ?? 'som',
        note: n.note,
        _rowId: r.id,
      };
    }
    payrollState = next;
    emit();
  } catch (e) { console.error('payrolls hydrate failed', e); }
}

export function usePayroll() {
  useEffect(() => { hydratePayroll(); }, []);
  return useSyncExternalStore(sub, () => payrollState, () => payrollState);
}

async function upsertEntry(e: PayrollEntry) {
  const existing = payrollState[e.employeeId];
  const body = {
    employeeId: e.employeeId,
    period: new Date().toISOString().slice(0, 7),
    baseSalary: Math.round(e.baseSalary) || 0,
    bonus: 0,
    deduction: 0,
    total: Math.round(e.baseSalary) || 0,
    status: 'kutilmoqda',
    notes: JSON.stringify({ currency: e.currency, note: e.note ?? '' }),
  };
  if (existing?._rowId) {
    await payrollApi(`/payrolls/${existing._rowId}`, { method: 'PATCH', body: JSON.stringify(body) });
    payrollState = { ...payrollState, [e.employeeId]: { ...e, _rowId: existing._rowId } };
  } else {
    const row = await payrollApi<any>('/payrolls', { method: 'POST', body: JSON.stringify(body) });
    payrollState = { ...payrollState, [e.employeeId]: { ...e, _rowId: row.id } };
  }
  emit();
}

function fmtMoney(n: number, cur: 'som' | 'rubl' | 'dollar' = 'som') {
  const sym = cur === 'som' ? "soʻm" : cur === 'rubl' ? 'rubl' : 'USD';
  return `${Math.round(n).toLocaleString('ru-RU')} ${sym}`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function periodRange(period: Period, anchor: string): { from: string; to: string; label: string } {
  // anchor format:
  // daily -> YYYY-MM-DD
  // monthly -> YYYY-MM
  // yearly -> YYYY
  if (period === 'daily') {
    return { from: anchor, to: anchor, label: anchor };
  }
  if (period === 'monthly') {
    const [y, m] = anchor.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}`, label: anchor };
  }
  const y = Number(anchor);
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: anchor };
}

function monthsInRange(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function AdminPayroll() {
  const employees = useEmployees().filter((e) => !e.archived);
  const services = useServices();
  const appointments = useAppointments();
  const payroll = usePayroll();
  const attendance = useAttendance();
  const treatments = useTreatments();
  const techProducts = useTechProducts();

  const today = new Date();
  const [period, setPeriod] = useState<Period>('monthly');
  const [dailyAnchor, setDailyAnchor] = useState(ymd(today));
  const [monthlyAnchor, setMonthlyAnchor] = useState(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`);
  const [yearlyAnchor, setYearlyAnchor] = useState(String(today.getFullYear()));

  const [tab, setTab] = useState<'medical' | 'service'>('medical');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<15 | 30 | 50>(15);
  const [medPage, setMedPage] = useState(1);
  useEffect(() => { setMedPage(1); }, [query, period, dailyAnchor, monthlyAnchor, yearlyAnchor, pageSize, tab]);

  const anchor = period === 'daily' ? dailyAnchor : period === 'monthly' ? monthlyAnchor : yearlyAnchor;
  const { from, to, label } = useMemo(() => periodRange(period, anchor), [period, anchor]);

  const serviceByName = useMemo(() => new Map(services.map((s) => [s.name, s])), [services]);
  const techPriceByName = useMemo(() => {
    const m = new Map<string, number>();
    techProducts.forEach((p) => m.set(p.name, p.salePrice));
    return m;
  }, [techProducts]);

  const medicalRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((e) => e.category === 'medical')
      .filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.position.toLowerCase().includes(q))
      .map((e) => {
        const entry = payroll[e.id];
        const base = entry?.baseSalary ?? 0;
        const cur = entry?.currency ?? 'som';

        const appts = appointments.filter((a) =>
          a.doctor === e.fullName && a.status === 'keldi' && a.date >= from && a.date <= to,
        );
        let revenue = 0;
        let shareAmount = 0;
        const breakdown: Record<string, { count: number; revenue: number; share: number }> = {};
        for (const a of appts) {
          const svc = serviceByName.get(a.service);
          if (!svc) continue;
          const price = svc.currency === 'som' ? svc.price : (svc.somValue ?? svc.price);
          revenue += price;
          const sh = price * (svc.doctorShare / 100);
          shareAmount += sh;
          const b = breakdown[a.service] ?? { count: 0, revenue: 0, share: 0 };
          b.count += 1; b.revenue += price; b.share += sh;
          breakdown[a.service] = b;
        }

        // Shifokor tomonidan tavsiya etilgan texnik buyurtmalar — davolash yozuvlaridan to'planadi.
        const docTreatments = treatments.filter(
          (t) => t.doctor === e.fullName
            && t.date >= from && t.date <= to
            && Array.isArray(t.techOrderItems) && (t.techOrderItems?.length ?? 0) > 0,
        );
        type OrderLine = { date: string; productName: string; qty: number; unitPrice: number; totalAmount: number; patient?: string };
        const orderList: OrderLine[] = [];
        const orderByProduct: Record<string, { qty: number; amount: number }> = {};
        let orderQty = 0, orderAmount = 0;
        for (const t of docTreatments) {
          for (const it of (t.techOrderItems ?? [])) {
            const price = techPriceByName.get(it.name) ?? 0;
            const total = it.qty * price;
            orderList.push({
              date: t.date, productName: it.name, qty: it.qty,
              unitPrice: price, totalAmount: total, patient: t.patient,
            });
            orderQty += it.qty;
            orderAmount += total;
            const agg = orderByProduct[it.name] ?? { qty: 0, amount: 0 };
            agg.qty += it.qty; agg.amount += total;
            orderByProduct[it.name] = agg;
          }
        }
        const orders = { count: orderQty, amount: orderAmount, list: orderList, byProduct: orderByProduct };

        const months = period === 'yearly' ? 12 : period === 'monthly' ? 1 : (1 / 30);
        const baseGross = base * months;
        const baseTax = baseGross * INCOME_TAX;
        const baseProrated = baseGross - baseTax;
        const total = baseProrated + shareAmount;

        // group appts by date for daily breakdown
        const byDate: Record<string, { count: number; services: string[]; revenue: number; share: number }> = {};
        for (const a of appts) {
          const svc = serviceByName.get(a.service);
          const price = svc ? (svc.currency === 'som' ? svc.price : (svc.somValue ?? svc.price)) : 0;
          const sh = svc ? price * (svc.doctorShare / 100) : 0;
          const d = byDate[a.date] ?? { count: 0, services: [], revenue: 0, share: 0 };
          d.count += 1; d.services.push(a.service); d.revenue += price; d.share += sh;
          byDate[a.date] = d;
        }

        return {
          employee: e, entry, base, cur,
          appointmentsCount: appts.length,
          revenue, shareAmount,
          baseGross, baseTax, baseProrated, total,
          orders,
          breakdown, byDate,
        };
      });
  }, [employees, appointments, serviceByName, payroll, from, to, period, query, treatments, techPriceByName]);

  const serviceRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((e) => e.category === 'service')
      .filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.position.toLowerCase().includes(q))
      .map((e) => {
        const entry = payroll[e.id];
        const gross = entry?.baseSalary ?? 0;
        const cur = entry?.currency ?? 'som';
        const monthRef = period === 'daily' ? from.slice(0, 7)
                        : period === 'monthly' ? anchor
                        : `${anchor}-01`;
        const rate = dailyRateFor(gross, monthRef);
        const s = salaryInRange(e.id, gross, from, to);
        return {
          employee: e, entry, gross, cur, rate,
          present: s.present, late: s.late, absent: s.absent,
          workedDays: s.worked,
          tax: s.tax,
          net: s.net,
        };
      });
  }, [employees, payroll, attendance, from, to, query, period, anchor]);

  const medTotals = useMemo(() => medicalRows.reduce((a, r) => ({
    base: a.base + r.baseProrated,
    baseGross: a.baseGross + r.baseGross,
    baseTax: a.baseTax + r.baseTax,
    revenue: a.revenue + r.revenue,
    share: a.share + r.shareAmount,
    orders: a.orders + r.orders.amount,
    ordersCount: a.ordersCount + r.orders.count,
    total: a.total + r.total,
    count: a.count + r.appointmentsCount,
    staff: a.staff + 1,
  }), { base: 0, baseGross: 0, baseTax: 0, revenue: 0, share: 0, orders: 0, ordersCount: 0, total: 0, count: 0, staff: 0 }),
  [medicalRows]);

  const svcTotals = useMemo(() => serviceRows.reduce((a, r) => ({
    worked: a.worked + r.workedDays,
    gross: a.gross + r.gross,
    tax: a.tax + r.tax,
    net: a.net + r.net,
    staff: a.staff + 1,
  }), { worked: 0, gross: 0, tax: 0, net: 0, staff: 0 }), [serviceRows]);

  const medTotalPages = Math.max(1, Math.ceil(medicalRows.length / pageSize));
  const medPageSafe = Math.min(medPage, medTotalPages);
  const medPageRows = useMemo(
    () => medicalRows.slice((medPageSafe - 1) * pageSize, medPageSafe * pageSize),
    [medicalRows, medPageSafe, pageSize]
  );

  const periodLabel =
    period === 'daily' ? `Kunlik — ${label}` :
    period === 'monthly' ? `Oylik — ${label}` :
    `Yillik — ${label}`;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Oylik maosh va ulushlar</h1>
          <p>Shifokorlar — bajarilgan xizmatlar va texnik buyurtmalar bo'yicha ulush. Hodimlar — davomat asosida.</p>
        </div>
        <div className="admin-page-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['daily','monthly','yearly'] as const).map((p) => (
              <button key={p}
                className={`admin-btn ${period === p ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                onClick={() => setPeriod(p)}>
                {p === 'daily' ? 'Kunlik' : p === 'monthly' ? 'Oylik' : 'Yillik'}
              </button>
            ))}
          </div>
          {period === 'daily' && (
            <input className="admin-input" type="date" value={dailyAnchor}
              onChange={(e) => setDailyAnchor(e.target.value || ymd(today))} />
          )}
          {period === 'monthly' && (
            <input className="admin-input" type="month" value={monthlyAnchor}
              onChange={(e) => setMonthlyAnchor(e.target.value || `${today.getFullYear()}-${pad(today.getMonth()+1)}`)} />
          )}
          {period === 'yearly' && (
            <input className="admin-input" type="number" min={2000} max={2100} value={yearlyAnchor}
              style={{ width: 120 }}
              onChange={(e) => setYearlyAnchor(e.target.value || String(today.getFullYear()))} />
          )}
          <button className="admin-btn admin-btn-ghost" onClick={() => window.print()}>
            <Printer size={14} /> Chop etish
          </button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy">
            <small>Shifokorlar / Hodimlar</small>
            <strong>{medTotals.staff} / {svcTotals.staff}</strong>
            <span className="admin-stat-trend trend-up">{periodLabel}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Banknote size={18} /></div>
          <div className="admin-stat-copy">
            <small>Umumiy daromad</small><strong>{fmtMoney(medTotals.revenue)}</strong>
            <span className="admin-stat-trend trend-up">{medTotals.count} ta xizmat</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Package size={18} /></div>
          <div className="admin-stat-copy">
            <small>Texnik buyurtmalar</small><strong>{fmtMoney(medTotals.orders)}</strong>
            <span className="admin-stat-trend trend-up">{medTotals.ordersCount} ta buyurtma</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Calculator size={18} /></div>
          <div className="admin-stat-copy">
            <small>Umumiy toʻlov</small>
            <strong>{fmtMoney(medTotals.total + svcTotals.net)}</strong>
            <span className="admin-stat-trend trend-up">shifokor + hodim</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '6px 0 12px' }}>
        <button className={`admin-btn ${tab === 'medical' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          onClick={() => setTab('medical')}>Shifokorlar (ulush)</button>
        <button className={`admin-btn ${tab === 'service' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          onClick={() => setTab('service')}>Hodimlar (davomat)</button>
      </div>

      <section className="admin-card">
        <div className="admin-card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>{tab === 'medical' ? 'Shifokorlar roʻyxati' : 'Hodimlar roʻyxati'}</h2>
            <small>
              {tab === 'medical' ? medicalRows.length : serviceRows.length} ta yozuv — {periodLabel}
            </small>
          </div>
          <div className="admin-search" style={{ minWidth: 240 }}>
            <Search size={14} />
            <input placeholder="Ism yoki lavozim..." value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {tab === 'medical' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Shifokor</th>
                  <th style={{ textAlign: 'center' }}>Xizmatlar</th>
                  <th style={{ textAlign: 'right' }}>Daromad</th>
                  <th style={{ textAlign: 'right' }}>Ulush</th>
                  <th style={{ textAlign: 'center' }}>Tavsiya etilgan (dona)</th>
                  <th style={{ textAlign: 'right' }}>Tavsiya summasi</th>
                  <th style={{ textAlign: 'right' }}>Baza brutto ({period === 'yearly' ? '×12' : period === 'daily' ? '/30' : '×1'})</th>
                  <th style={{ textAlign: 'right' }}>Soliq (12%)</th>
                  <th style={{ textAlign: 'right' }}>Baza netto</th>
                  <th style={{ textAlign: 'right' }}>Umumiy toʻlov</th>
                  <th style={{ width: 60 }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {medicalRows.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                    Natija yoʻq
                  </td></tr>
                )}
                {medPageRows.map((r) => {
                  const open = expanded === r.employee.id;
                  return (
                    <Fragment key={r.employee.id}>
                      <tr>
                        <td>
                          <button className="admin-icon-btn sm"
                            onClick={() => setExpanded(open ? null : r.employee.id)}
                            title={open ? 'Yopish' : 'Batafsil'}>
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="payroll-avatar">{r.employee.fullName.charAt(0)}</div>
                            <div>
                              <strong>{r.employee.fullName}</strong>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{r.employee.position}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="admin-chip">{r.appointmentsCount}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.revenue > 0 ? fmtMoney(r.revenue) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#16a34a', fontWeight: 600 }}>
                          {r.shareAmount > 0 ? fmtMoney(r.shareAmount) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="admin-chip">{r.orders.count}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.orders.amount > 0 ? fmtMoney(r.orders.amount) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.baseGross > 0 ? fmtMoney(r.baseGross, r.cur) : <span style={{ color: '#94a3b8' }}>belg. emas</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                          {r.baseTax > 0 ? fmtMoney(r.baseTax, r.cur) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.baseProrated > 0 ? fmtMoney(r.baseProrated, r.cur) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {fmtMoney(r.total, r.cur)}
                        </td>
                        <td>
                          <button className="admin-icon-btn sm" title="Oylik baza"
                            onClick={() => setEditing(r.employee.id)}>
                            <Edit3 size={14} />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td></td>
                          <td colSpan={11} style={{ background: '#f8fafc', padding: 12 }}>
                            <DoctorDetail
                              byDate={r.byDate}
                              breakdown={r.breakdown}
                              orders={r.orders.list}
                              ordersByProduct={r.orders.byProduct}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {medicalRows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
                    <td></td>
                    <td>Jami</td>
                    <td style={{ textAlign: 'center' }}>{medTotals.count}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(medTotals.revenue)}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(medTotals.share)}</td>
                    <td style={{ textAlign: 'center' }}>{medTotals.ordersCount}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(medTotals.orders)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(medTotals.baseGross)}</td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtMoney(medTotals.baseTax)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(medTotals.base)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(medTotals.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
            {medicalRows.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 4px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                  <span>Qatorlar:</span>
                  {([15, 30, 50] as const).map((n) => (
                    <button key={n}
                      className={`admin-btn ${pageSize === n ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                      style={{ padding: '4px 10px' }}
                      onClick={() => setPageSize(n)}>{n}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                  <span>
                    {(medPageSafe - 1) * pageSize + 1}
                    –{Math.min(medPageSafe * pageSize, medicalRows.length)} / {medicalRows.length}
                  </span>
                  <button className="admin-btn admin-btn-ghost" style={{ padding: '4px 10px' }}
                    disabled={medPageSafe <= 1}
                    onClick={() => setMedPage((p) => Math.max(1, p - 1))}>‹</button>
                  <span>{medPageSafe} / {medTotalPages}</span>
                  <button className="admin-btn admin-btn-ghost" style={{ padding: '4px 10px' }}
                    disabled={medPageSafe >= medTotalPages}
                    onClick={() => setMedPage((p) => Math.min(medTotalPages, p + 1))}>›</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hodim</th>
                  <th>Lavozim</th>
                  <th style={{ textAlign: 'right' }}>Oylik (brutto)</th>
                  <th style={{ textAlign: 'right' }}>Soliq (12%)</th>
                  <th style={{ textAlign: 'right' }}>Kunlik stavka</th>
                  <th style={{ textAlign: 'center' }}>Keldi</th>
                  <th style={{ textAlign: 'center' }}>Kech</th>
                  <th style={{ textAlign: 'center' }}>Kelmagan</th>
                  <th style={{ textAlign: 'right' }}>Ishga chiqqan</th>
                  <th style={{ textAlign: 'right' }}>Hisoblangan (netto)</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {serviceRows.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Natija yoʻq</td></tr>
                )}
                {serviceRows.map((r) => (
                  <tr key={r.employee.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="payroll-avatar">{r.employee.fullName.charAt(0)}</div>
                        <strong>{r.employee.fullName}</strong>
                      </div>
                    </td>
                    <td>{r.employee.position}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.gross > 0 ? fmtMoney(r.gross, r.cur) : <span style={{ color: '#94a3b8' }}>belg. emas</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                      {r.gross > 0 ? fmtMoney(r.gross * INCOME_TAX) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.rate > 0 ? fmtMoney(r.rate) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{r.present}</td>
                    <td style={{ textAlign: 'center', color: '#f59e0b' }}>{r.late}</td>
                    <td style={{ textAlign: 'center', color: '#dc2626' }}>{r.absent}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.workedDays} kun</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmtMoney(r.net)}</td>
                    <td>
                      <button className="admin-icon-btn sm" title="Oylik maoshni oʻzgartirish"
                        onClick={() => setEditing(r.employee.id)}>
                        <Edit3 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {serviceRows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
                    <td colSpan={2}>Jami</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(svcTotals.gross)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMoney(svcTotals.tax)}</td>
                    <td></td><td></td><td></td><td></td>
                    <td style={{ textAlign: 'right' }}>{svcTotals.worked}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(svcTotals.net)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {editing && (() => {
        const emp = employees.find((e) => e.id === editing);
        if (!emp) return null;
        return (
          <SalaryModal
            employeeName={emp.fullName}
            entry={payroll[emp.id]}
            onClose={() => setEditing(null)}
            onSave={(data) => { upsertEntry({ employeeId: emp.id, ...data }); setEditing(null); }}
          />
        );
      })()}

    </div>
  );
}

function DoctorDetail({
  byDate, breakdown, orders, ordersByProduct,
}: {
  byDate: Record<string, { count: number; services: string[]; revenue: number; share: number }>;
  breakdown: Record<string, { count: number; revenue: number; share: number }>;
  orders: { date: string; productName: string; qty: number; unitPrice: number; totalAmount: number; patient?: string }[];
  ordersByProduct: Record<string, { qty: number; amount: number }>;
}) {
  const dates = Object.keys(byDate).sort();
  const svcNames = Object.keys(breakdown).sort();
  const productNames = Object.keys(ordersByProduct).sort();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Kunlik faoliyat</div>
        {dates.length === 0 ? <div style={{ color: '#94a3b8' }}>Hech qanday xizmat yoʻq</div> : (
          <table className="admin-table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Sana</th><th style={{ textAlign: 'center' }}>Soni</th>
                <th style={{ textAlign: 'right' }}>Daromad</th><th style={{ textAlign: 'right' }}>Ulush</th></tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr key={d}>
                  <td>{d}</td>
                  <td style={{ textAlign: 'center' }}>{byDate[d].count}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(byDate[d].revenue)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(byDate[d].share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Xizmatlar bo'yicha</div>
        {svcNames.length === 0 ? <div style={{ color: '#94a3b8' }}>Boʻsh</div> : (
          <table className="admin-table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Xizmat</th><th style={{ textAlign: 'center' }}>Soni</th>
                <th style={{ textAlign: 'right' }}>Daromad</th><th style={{ textAlign: 'right' }}>Ulush</th></tr>
            </thead>
            <tbody>
              {svcNames.map((n) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td style={{ textAlign: 'center' }}>{breakdown[n].count}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(breakdown[n].revenue)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(breakdown[n].share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Tavsiya etilgan texnik buyurtmalar (mahsulot bo'yicha)</div>
        {productNames.length === 0 ? <div style={{ color: '#94a3b8' }}>Tavsiyalar yoʻq</div> : (
          <table className="admin-table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Mahsulot</th>
                <th style={{ textAlign: 'center' }}>Soni</th>
                <th style={{ textAlign: 'right' }}>Jami summa</th></tr>
            </thead>
            <tbody>
              {productNames.map((n) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td style={{ textAlign: 'center' }}>{ordersByProduct[n].qty}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(ordersByProduct[n].amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Tavsiyalar — batafsil (davolash yozuvi)</div>
        {orders.length === 0 ? <div style={{ color: '#94a3b8' }}>Yozuvlar yoʻq</div> : (
          <table className="admin-table" style={{ fontSize: 13 }}>
            <thead>
              <tr><th>Sana</th><th>Bemor</th><th>Mahsulot</th>
                <th style={{ textAlign: 'center' }}>Soni</th>
                <th style={{ textAlign: 'right' }}>Dona narxi</th>
                <th style={{ textAlign: 'right' }}>Summa</th></tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={i}>
                  <td>{o.date}</td>
                  <td>{o.patient ?? '—'}</td>
                  <td>{o.productName}</td>
                  <td style={{ textAlign: 'center' }}>{o.qty}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(o.unitPrice)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMoney(o.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SalaryModal({
  employeeName, entry, onClose, onSave,
}: {
  employeeName: string;
  entry: PayrollEntry | undefined;
  onClose: () => void;
  onSave: (data: Omit<PayrollEntry, 'employeeId'>) => void;
}) {
  const [baseSalary, setBaseSalary] = useState<number>(entry?.baseSalary ?? 0);
  const [currency, setCurrency] = useState<'som' | 'rubl' | 'dollar'>(entry?.currency ?? 'som');
  const [note, setNote] = useState(entry?.note ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ baseSalary: Number(baseSalary) || 0, currency, note: note.trim() || undefined });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><Wallet size={18} /> Oylik baza</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="appt-modal-body">
          <div style={{ color: '#64748b', marginBottom: 8 }}><strong>{employeeName}</strong></div>
          <div className="appt-modal-row">
            <label>
              <span>Oylik baza</span>
              <input type="number" min={0} value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))} />
            </label>
            <label>
              <span>Valyuta</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                <option value="som">Soʻm</option>
                <option value="rubl">Rubl</option>
                <option value="dollar">USD</option>
              </select>
            </label>
          </div>
          <label>
            <span>Izoh</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: KPI bonus bilan" />
          </label>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
            <CheckCircle2 size={11} /> Ulush — xizmatlar jadvalidagi "doctorShare" foizidan avtomatik hisoblanadi.
          </div>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary">Saqlash</button>
        </div>
      </form>
    </div>
  );
}

