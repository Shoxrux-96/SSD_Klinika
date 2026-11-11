import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Banknote, CreditCard, ArrowRightLeft, Wallet, Users, Printer, Receipt,
  Search, X, Hash, CheckCircle2, ChevronDown, ChevronRight, UserRound, Stethoscope,
  Briefcase, Percent, MessageSquare, Check, Calendar, Eye, Clock,
  AlertCircle, ArrowRight,
} from 'lucide-react';
import { usePatients, useServices, useEmployees } from '../store';
import { useTreatments } from '../clinicalData';
import {
  generatePromoForPayment, usePromoCodes, findPromoByCode, markPromoUsed,
  type PromoCode,
} from '../../promoSettings';
import { useContactSettings } from '../../contactSettings';
import { useDebts, addDebt, removeDebt, getDeferredIds } from '../debtsStore';
import { AdminDebts } from './AdminDebts';

/* ---------------- Types & API glue ---------------- */
type Method = 'naqd' | 'plastik' | 'bank';

type Payment = {
  id: string;
  date: number;
  patientId: string;
  patientName: string;
  serviceId: string;
  serviceName: string;
  doctorId?: string;
  doctorName?: string;
  amount: number;
  discount: number;
  total: number;
  method: Method;
  note?: string;
  usedPromoCode?: string;
  usedPromoAmount?: number;
};

async function payApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const txt = await res.text(); return txt ? (JSON.parse(txt) as T) : (undefined as T);
}

const METHOD_MAP: Record<Method, string> = { naqd: 'naqd', plastik: 'karta', bank: 'transfer' };
const METHOD_FROM: Record<string, Method> = { naqd: 'naqd', karta: 'plastik', transfer: 'bank' };

function payFromRow(row: any): Payment {
  const extra = row.description ? (() => { try { return JSON.parse(row.description); } catch { return {}; } })() : {};
  return {
    id: row.id,
    date: Number(row.createdAt) || Date.now(),
    patientId: row.patientId ?? '',
    patientName: extra.patientName ?? row.patientId ?? '',
    serviceId: row.serviceId ?? '',
    serviceName: extra.serviceName ?? '',
    doctorId: row.employeeId ?? undefined,
    doctorName: extra.doctorName,
    amount: extra.amount ?? row.amount,
    discount: extra.discount ?? 0,
    total: row.amount,
    method: METHOD_FROM[row.method] ?? 'naqd',
    note: extra.note,
    usedPromoCode: extra.usedPromoCode,
    usedPromoAmount: extra.usedPromoAmount,
  };
}
function payToBody(p: Omit<Payment, 'id' | 'date'>) {
  return {
    type: 'income',
    amount: p.total,
    currency: 'som',
    method: METHOD_MAP[p.method],
    patientId: p.patientId || null,
    serviceId: p.serviceId || null,
    employeeId: p.doctorId || null,
    description: JSON.stringify({
      patientName: p.patientName, serviceName: p.serviceName, doctorName: p.doctorName,
      amount: p.amount, discount: p.discount, note: p.note,
      usedPromoCode: p.usedPromoCode, usedPromoAmount: p.usedPromoAmount,
    }),
    date: new Date().toISOString().slice(0, 10),
  };
}

let paymentsState: Payment[] = [];
const paymentListeners = new Set<() => void>();
function emitPayments() { paymentListeners.forEach((l) => l()); }
function subPayments(l: () => void) { paymentListeners.add(l); return () => paymentListeners.delete(l); }

let paymentsHydrated = false;
async function hydratePayments() {
  if (paymentsHydrated || typeof window === 'undefined') return;
  paymentsHydrated = true;
  try {
    const rows = await payApi<any[]>('/transactions');
    paymentsState = rows.filter((r) => r.type === 'income').map(payFromRow).sort((a, b) => b.date - a.date);
    emitPayments();
  } catch (e) { console.error('transactions hydrate failed', e); }
}
function usePayments(): Payment[] {
  useEffect(() => { hydratePayments(); }, []);
  return useSyncExternalStore(subPayments, () => paymentsState, () => paymentsState);
}
async function addPayment(p: Omit<Payment, 'id' | 'date'> & { treatmentId?: string }) {
  const body = payToBody(p);
  // Agar to'lov ma'lum bir davolash uchun bo'lsa, treatmentId description ichiga qo'shiladi.
  if (p.treatmentId) {
    try {
      const desc = JSON.parse(body.description);
      body.description = JSON.stringify({ ...desc, treatmentId: p.treatmentId });
    } catch { /* already string */ }
  }
  const row = await payApi<any>('/transactions', { method: 'POST', body: JSON.stringify(body) });
  const created = payFromRow(row);
  paymentsState = [created, ...paymentsState];
  emitPayments();

  // Oqim avtomatizatsiyasi: to'lov qilingan davolash uchun qarzni avtomatik yopish.
  if (p.treatmentId) {
    try {
      const debts = await payApi<any[]>('/debts');
      const open = debts.find((d) => d.treatmentId === p.treatmentId && d.status === 'ochiq');
      if (open) {
        await payApi(`/debts/${open.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: "to'landi", paidAt: Date.now() }),
        });
      }
    } catch (e) { console.warn('auto-close debt failed', e); }
  }

  try {
    generatePromoForPayment({
      paymentId: created.id,
      paymentTotal: created.total,
      patientId: created.patientId,
      patientName: created.patientName,
    });
  } catch (e) { console.warn('promo generate failed', e); }
}
/* ---------------- Utils ---------------- */
const fmtSum = (n: number) => Math.round(n).toLocaleString('ru-RU') + " soʻm";
function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date | number) {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
function fmtDateTime(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function weekStart(now: Date): Date {
  const d = new Date(now);
  const dow = d.getDay(); // 0 (Yak)…6 (Sh)
  const diff = (dow + 6) % 7; // Monday as start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const methodLabel: Record<Method, string> = { naqd: 'Naqd', plastik: 'Karta', bank: 'Oʻtkazma' };
type Tab = 'tolanmagan' | 'tarix' | 'hisoblashish' | 'qarzdaftar';
type Range = 'bugun' | 'hafta' | 'custom';

/* ---------------- Page ---------------- */
export function AdminCashier() {
  const payments = usePayments();
  const patients = usePatients().filter((p) => !p.archived);
  const services = useServices();
  const employees = useEmployees().filter((e) => !e.archived);
  const medicals = employees.filter((e) => e.category === 'medical');
  const treatments = useTreatments();

  const [range, setRange] = useState<Range>('bugun');
  const todayStr = ymd(new Date());
  const [from, setFrom] = useState<string>(todayStr);
  const [to, setTo] = useState<string>(todayStr);
  const [tab, setTab] = useState<Tab>('hisoblashish');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [payPrefill, setPayPrefill] = useState<null | {
    patientId?: string; serviceId?: string; doctorId?: string;
  }>(null);
  const [partial, setPartial] = useState<null | {
    treatmentId: string; patient: string; patientId?: string; doctor: string;
    serviceName: string; serviceId?: string; doctorId?: string;
    amount: number; paid: number; debt: number; date: string;
  }>(null);

  // Range → from/to sync
  useEffect(() => {
    const now = new Date();
    if (range === 'bugun') { setFrom(ymd(now)); setTo(ymd(now)); }
    else if (range === 'hafta') {
      const ws = weekStart(now);
      setFrom(ymd(ws)); setTo(ymd(now));
    }
  }, [range]);

  const fromMs = new Date(from + 'T00:00:00').getTime();
  const toMs = new Date(to + 'T23:59:59').getTime();

  const inRange = (ms: number) => ms >= fromMs && ms <= toMs;

  const paymentsInRange = useMemo(
    () => payments.filter((p) => inRange(p.date)),
    [payments, fromMs, toMs],
  );

  const totals = useMemo(() => {
    const total = paymentsInRange.reduce((s, p) => s + p.total, 0);
    const naqd = paymentsInRange.filter((p) => p.method === 'naqd').reduce((s, p) => s + p.total, 0);
    const karta = paymentsInRange.filter((p) => p.method === 'plastik').reduce((s, p) => s + p.total, 0);
    const bank = paymentsInRange.filter((p) => p.method === 'bank').reduce((s, p) => s + p.total, 0);
    return { total, naqd, karta, bank, count: paymentsInRange.length };
  }, [paymentsInRange]);

  // Per-davolash qarzlari: har bir davolash uchun paid/qarz hisobi.
  // To'lovlar bemor bo'yicha FIFO tartibida davolashlarga yopishtiriladi
  // (eski davolashlar birinchi yopiladi), keyingi to'lov eski qarzni ham qoplaydi.
  const debts = useMemo(() => {
    type Row = {
      id: string;
      patient: string;
      doctor: string;
      date: string;
      services: string[];
      amount: number;
      paid: number;
      debt: number;
      overdue: boolean; // sana < bugun
    };

    // Guruhlash: bemor -> davolashlar (sana bo'yicha ortish tartibida)
    const trByPatient = new Map<string, typeof treatments>();
    for (const t of treatments) {
      if (!t.patient || (t.amount ?? 0) <= 0) continue;
      const arr = trByPatient.get(t.patient) ?? [];
      arr.push(t);
      trByPatient.set(t.patient, arr);
    }
    // Bemor -> umumiy to'langan summa
    const paidByPatient = new Map<string, number>();
    for (const p of payments) {
      if (!p.patientName) continue;
      paidByPatient.set(p.patientName, (paidByPatient.get(p.patientName) ?? 0) + p.total);
    }

    const list: Row[] = [];
    for (const [patient, trs] of trByPatient) {
      const sorted = [...trs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      let pool = paidByPatient.get(patient) ?? 0;
      for (const t of sorted) {
        const amount = t.amount ?? 0;
        const applied = Math.min(pool, amount);
        pool -= applied;
        const debt = amount - applied;
        if (debt <= 0) continue;
        list.push({
          id: t.id,
          patient: t.patient,
          doctor: t.doctor,
          date: t.date,
          services: t.services?.length ? t.services : (t.service ? [t.service] : []),
          amount, paid: applied, debt,
          overdue: t.date < todayStr,
        });
      }
    }

    list.sort((a, b) => (a.overdue === b.overdue ? b.debt - a.debt : a.overdue ? -1 : 1));
    const total = list.reduce((s, x) => s + x.debt, 0);
    return { list, count: list.length, total };
  }, [payments, treatments, todayStr]);

  const [debtDoctorFilter, setDebtDoctorFilter] = useState<string>('all');

  // Kassa qoldig'i — jami naqd kirim (hamma vaqt, chunki real kassada hozirgi qoldiq)
  const kassaBalance = useMemo(() => {
    return payments.filter((p) => p.method === 'naqd').reduce((s, p) => s + p.total, 0);
  }, [payments]);
  const naqdInRange = totals.naqd;


  /* ----- Searchable rows ----- */
  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return paymentsInRange.filter((p) => {
      if (!q) return true;
      return (p.patientName + p.serviceName + (p.doctorName ?? '')).toLowerCase().includes(q);
    });
  }, [paymentsInRange, query]);

  // Qarz daftariga ko'chirilgan treatment'lar to'lanmagan ro'yxatidan chiqariladi.
  useDebts(); // reaktivlik uchun
  const deferredIds = getDeferredIds();
  const unpaidTab = useMemo(
    () => debts.list.filter((r) => !deferredIds.has(r.id)),
    [debts.list, deferredIds],
  );

  // Agar qarz to'liq to'langan bo'lsa — avtomatik qarz daftaridan chiqariladi.
  useEffect(() => {
    debts.list.forEach((r) => {
      if (r.debt <= 0 && deferredIds.has(r.id)) removeDebt(r.id);
    });
  }, [debts.list, deferredIds]);

  return (
    <div className="admin-page cash-page">
      <style>{cashStyles}</style>

      {/* Header */}
      <div className="cash-head">
        <div className="cash-title">
          <h1>Kassa</h1>
        </div>
        <div className="cash-head-right">
          <div className="cash-range">
            <button className={`cash-pill ${range === 'bugun' ? 'is-active' : ''}`} onClick={() => setRange('bugun')}>Bugun</button>
            <button className={`cash-pill ${range === 'hafta' ? 'is-active' : ''}`} onClick={() => setRange('hafta')}>Bu hafta</button>
          </div>
          <div className="cash-date-group">
            <input className="cash-date" type="date" value={from}
              onChange={(e) => { setFrom(e.target.value); setRange('custom'); }} />
            <span className="cash-date-sep">—</span>
            <input className="cash-date" type="date" value={to}
              onChange={(e) => { setTo(e.target.value); setRange('custom'); }} />
          </div>
          <button className="admin-btn admin-btn-primary" onClick={() => setOpen(true)}>+ Yangi to‘lov</button>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="cash-kpis">
        <div className="cash-kpi cash-kpi-primary">
          <div className="cash-kpi-top">
            <span className="cash-kpi-icon"><Hash size={14} /></span>
            <span className="cash-kpi-label">Jami tushum</span>
          </div>
          <div className="cash-kpi-value">{fmtSum(totals.total)}</div>
          <div className="cash-kpi-sub">{totals.count} ta to‘lov</div>
        </div>

        <div className="cash-kpi">
          <div className="cash-kpi-top">
            <span className="cash-kpi-label">To‘lov usullari</span>
          </div>
          <div className="cash-methods">
            <div className="cash-method-row">
              <span className="cash-method-ico"><Banknote size={14} /></span>
              <span className="cash-method-name">Naqd</span>
              <span className="cash-method-sum">{fmtSum(totals.naqd)}</span>
            </div>
            <div className="cash-method-row">
              <span className="cash-method-ico"><CreditCard size={14} /></span>
              <span className="cash-method-name">Karta</span>
              <span className="cash-method-sum">{fmtSum(totals.karta)}</span>
            </div>
            <div className="cash-method-row">
              <span className="cash-method-ico"><ArrowRightLeft size={14} /></span>
              <span className="cash-method-name">O‘tkazma</span>
              <span className="cash-method-sum">{fmtSum(totals.bank)}</span>
            </div>
          </div>
        </div>

        <div className="cash-kpi cash-kpi-green">
          <div className="cash-kpi-top">
            <span className="cash-kpi-icon"><Wallet size={14} /></span>
            <span className="cash-kpi-label">Kassa qoldig‘i</span>
          </div>
          <div className="cash-kpi-value">{fmtSum(kassaBalance)}</div>
          <div className="cash-kpi-sub">
            Naqd kirim <span className="cash-kpi-plus">+{fmtSum(naqdInRange)}</span>
          </div>
        </div>

        <div className="cash-kpi cash-kpi-red">
          <div className="cash-kpi-top">
            <span className="cash-kpi-icon"><Users size={14} /></span>
            <span className="cash-kpi-label">Qarzdorlar</span>
          </div>
          <div className="cash-kpi-value cash-kpi-value-sm">{debts.count}</div>
          <div className="cash-kpi-sub">qarz: {fmtSum(debts.total)}</div>
        </div>
      </div>

      {/* Tabs row */}
      <div className="cash-tabs-wrap">
        <div className="cash-tabs">
          <button className={`cash-tab ${tab === 'tolanmagan' ? 'is-active' : ''}`} onClick={() => setTab('tolanmagan')}>
            To‘lanmagan
            {unpaidTab.length > 0 && <span className="cash-tab-badge">{unpaidTab.length}</span>}
          </button>
          <button className={`cash-tab ${tab === 'tarix' ? 'is-active' : ''}`} onClick={() => setTab('tarix')}>
            To‘lovlar tarixi
          </button>
          <button className={`cash-tab ${tab === 'hisoblashish' ? 'is-active' : ''}`} onClick={() => setTab('hisoblashish')}>
            Hisoblashish
          </button>
          <button className={`cash-tab ${tab === 'qarzdaftar' ? 'is-active' : ''}`} onClick={() => setTab('qarzdaftar')}>
            Qarz daftar
          </button>
        </div>
        {(tab === 'tarix' || tab === 'tolanmagan') && (
          <div className="admin-search cash-search">
            <Search size={14} />
            <input placeholder="Bemor qidirish..." value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
      </div>

      {/* Tab panels */}
      {tab === 'hisoblashish' && (
        <HisoblashishPanel
          medicals={medicals}
          services={services}
          treatments={treatments}
          payments={payments}
          onPayDoctor={async (docId, amount, label, doctorName) => {
            if (amount <= 0) return;
            const ok = confirm(
              `"${doctorName}" shifokorga ${fmtSum(amount)} ulush to‘lanadi.\n` +
              `(${label})\n\nBu summa moliya sahifasida chiqim sifatida yoziladi. Davom etasizmi?`,
            );
            if (!ok) return;
            try {
              await payApi('/transactions', {
                method: 'POST',
                body: JSON.stringify({
                  type: 'expense',
                  amount: Math.round(amount),
                  currency: 'som',
                  method: 'naqd',
                  employeeId: docId,
                  description: JSON.stringify({
                    doctorName,
                    note: `Shifokor ulushi — ${label}`,
                    kind: 'doctor_share',
                  }),
                  date: new Date().toISOString().slice(0, 10),
                }),
              });
              alert(`✓ ${fmtSum(amount)} chiqim sifatida yozildi (moliya sahifasida ko‘rinadi).`);
            } catch (e) {
              console.error(e);
              alert('Xatolik: to‘lov saqlanmadi');
            }
          }}
        />
      )}

      {tab === 'tarix' && (
        <ReceiptsPanel payments={filteredHistory} />
      )}

      {tab === 'tolanmagan' && (
        <UnpaidPanel
          rows={unpaidTab}
          query={query}
          medicals={medicals}
          patients={patients}
          doctorFilter={debtDoctorFilter}
          onDoctorFilter={setDebtDoctorFilter}
          onPayPartial={(r) => {
            const p = patients.find((x) => x.fullName === r.patient);
            const svcName = r.services[0] ?? '';
            const svc = services.find((s) => s.name === svcName);
            const doc = medicals.find((e) => e.fullName === r.doctor);
            setPayPrefill({ patientId: p?.id, serviceId: svc?.id, doctorId: doc?.id });
            setOpen(true);
          }}
          onDefer={(r) => {
            const p = patients.find((x) => x.fullName === r.patient);
            addDebt({
              treatmentId: r.id,
              patientId: p?.id,
              patientJshshir: p?.jshshir,
              patient: r.patient,
              phone: p?.phone,
              doctor: r.doctor,
              services: r.services,
              amount: r.debt,
              date: r.date,
              note: `Qarz daftariga ko'chirildi — ${new Date().toLocaleDateString('uz-UZ')}`,
            });
          }}
        />
      )}

      {tab === 'qarzdaftar' && (
        <AdminDebts embedded />
      )}

      {open && (
        <PaymentModal
          onClose={() => { setOpen(false); setPayPrefill(null); }}
          patients={patients}
          services={services.filter((s) => !s.archived)}
          employees={medicals}
          prefill={payPrefill ?? undefined}
        />
      )}

      {partial && (
        <PartialPaymentModal
          data={partial}
          onClose={() => setPartial(null)}
          onConfirm={async (amount, method, note) => {
            await addPayment({
              patientId: partial.patientId ?? '',
              patientName: partial.patient,
              serviceId: partial.serviceId ?? '',
              serviceName: partial.serviceName,
              doctorId: partial.doctorId,
              doctorName: partial.doctor,
              amount: partial.amount,
              discount: 0,
              total: amount,
              method,
              note: note || undefined,
              treatmentId: partial.treatmentId,
            });
            setPartial(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Hisoblashish panel ---------------- */
type HisobPeriod = 'daily' | 'monthly' | 'yearly';

function hisobRange(period: HisobPeriod, anchor: string): { from: string; to: string; label: string } {
  if (period === 'daily') return { from: anchor, to: anchor, label: anchor };
  if (period === 'monthly') {
    const [y, m] = anchor.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}`, label: anchor };
  }
  const y = Number(anchor);
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: anchor };
}

function HisoblashishPanel({
  medicals, services, treatments, payments, onPayDoctor,
}: {
  medicals: ReturnType<typeof useEmployees>;
  services: ReturnType<typeof useServices>;
  treatments: ReturnType<typeof useTreatments>;
  payments: Payment[];
  onPayDoctor: (doctorId: string, amount: number, label: string, doctorName: string) => void;
}) {
  const today = new Date();
  const [period, setPeriod] = useState<HisobPeriod>('daily');
  const [dailyAnchor, setDailyAnchor] = useState(ymd(today));
  const [monthlyAnchor, setMonthlyAnchor] = useState(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`);
  const [yearlyAnchor, setYearlyAnchor] = useState(String(today.getFullYear()));
  const anchor = period === 'daily' ? dailyAnchor : period === 'monthly' ? monthlyAnchor : yearlyAnchor;
  const { from, to, label } = useMemo(() => hisobRange(period, anchor), [period, anchor]);
  const [query, setQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');

  const serviceByName = useMemo(() => new Map(services.map((s) => [s.name, s])), [services]);

  // "Shifokorlar ulushi" to'lovlar tarixidan quriladi.
  // Har bir to'lov = alohida qator; ulush % xizmatdan olinadi.
  type Line = {
    key: string; payment: Payment;
    sharePct: number; share: number;
  };
  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Line[] = [];
    for (const p of payments) {
      if (!p.doctorId) continue;
      const d = ymd(p.date);
      if (d < from || d > to) continue;
      if (selectedDocId !== 'all' && p.doctorId !== selectedDocId) continue;
      if (q) {
        const hay = `${p.doctorName ?? ''} ${p.patientName ?? ''} ${p.serviceName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const s = serviceByName.get(p.serviceName);
      const sharePct = s?.doctorShare ?? 0;
      const share = p.total * (sharePct / 100);
      out.push({ key: p.id, payment: p, sharePct, share });
    }
    out.sort((a, b) => b.payment.date - a.payment.date);
    return out;
  }, [payments, serviceByName, from, to, query, selectedDocId]);

  const totals = useMemo(() => {
    const xizmat = lines.length;
    const daromad = lines.reduce((s, l) => s + l.payment.total, 0);
    const ulush = lines.reduce((s, l) => s + l.share, 0);
    const chegirma = lines.reduce((s, l) => s + (l.payment.discount || 0), 0);
    return { xizmat, daromad, ulush, chegirma };
  }, [lines]);

  const periodLabel = period === 'daily' ? `Kunlik — ${label}`
    : period === 'monthly' ? `Oylik — ${label}`
    : `Yillik — ${label}`;

  return (
    <>
      <div className="hisob-head">
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
        <div className="admin-search" style={{ minWidth: 240, marginLeft: 'auto' }}>
          <Search size={14} />
          <input placeholder="Shifokor qidirish..." value={query}
            onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="cash-mini-kpis">
        <div className="cash-mini">
          <div className="cash-mini-top"><Hash size={13} /><small>To‘lovlar soni</small></div>
          <strong className="cash-mini-val">{totals.xizmat}</strong>
        </div>
        <div className="cash-mini cash-mini-income">
          <div className="cash-mini-top"><Wallet size={13} /><small>Jami to‘lovlar</small></div>
          <strong className="cash-mini-val">{fmtSum(totals.daromad)}</strong>
        </div>
        <div className="cash-mini">
          <div className="cash-mini-top"><Percent size={13} /><small>Chegirma</small></div>
          <strong className="cash-mini-val">{fmtSum(totals.chegirma)}</strong>
        </div>
        <div className="cash-mini cash-mini-pending">
          <div className="cash-mini-top"><Receipt size={13} /><small>Shifokorlar ulushi</small></div>
          <strong className="cash-mini-val">{fmtSum(totals.ulush)}</strong>
        </div>
      </div>

      <section className="cash-panel">
        <div className="cash-panel-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3>Shifokorlar ulushi — {periodLabel}</h3>
          <div className="cash-doctor-select" style={{ marginLeft: 'auto' }}>
            <Users size={14} className="cash-doc-ico" />
            <select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
              <option value="all">Barcha shifokorlar</option>
              {medicals.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <ChevronDown size={14} className="cash-doc-chevron" />
          </div>
          <small>{lines.length} ta to‘lov</small>
        </div>
        <div className="cash-table-wrap">
          <table className="cash-table cash-table-fixed">
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Sana/vaqt</th>
                <th>Shifokor</th>
                <th>Bemor</th>
                <th>Xizmat</th>
                <th className="cash-num">Summa</th>
                <th className="cash-num">Chegirma</th>
                <th>Promo / Usul</th>
                <th className="cash-num">%</th>
                <th className="cash-num">Ulush</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={9} className="cash-empty">Bu davrda to‘lov yo‘q</td></tr>
              )}
              {lines.map((l) => {
                const p = l.payment;
                return (
                  <tr key={l.key}>
                    <td className="cash-nowrap cash-muted">{fmtDateTime(p.date)}</td>
                    <td className="cash-cell-wrap">{p.doctorName || '—'}</td>
                    <td className="cash-cell-wrap">{p.patientName || '—'}</td>
                    <td className="cash-cell-wrap">{p.serviceName || '—'}</td>
                    <td className="cash-num cash-total cash-nowrap">{fmtSum(p.total)}</td>
                    <td className="cash-num cash-nowrap">{p.discount > 0 ? `− ${fmtSum(p.discount)}` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span className={`cash-chip chip-${p.method}`}>{methodLabel[p.method]}</span>
                        {p.usedPromoCode && (
                          <code style={{ color: '#1e40af', fontWeight: 700, fontSize: 10.5 }}>{p.usedPromoCode}</code>
                        )}
                      </div>
                    </td>
                    <td className="cash-num cash-nowrap">{Math.round(l.sharePct)}%</td>
                    <td className="cash-num cash-commission cash-nowrap">{fmtSum(l.share)}</td>
                  </tr>
                );
              })}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td>Jami</td>
                  <td></td>
                  <td></td>
                  <td>{totals.xizmat} ta</td>
                  <td className="cash-num cash-total cash-nowrap">{fmtSum(totals.daromad)}</td>
                  <td className="cash-num cash-nowrap">{totals.chegirma > 0 ? `− ${fmtSum(totals.chegirma)}` : '—'}</td>
                  <td></td>
                  <td></td>
                  <td className="cash-num cash-commission cash-nowrap">{fmtSum(totals.ulush)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------------- Unpaid panel ---------------- */
const AVATAR_PALETTE = [
  { bg: 'linear-gradient(135deg,#fde68a,#f59e0b)', fg: '#78350f' }, // amber
  { bg: 'linear-gradient(135deg,#fecaca,#ef4444)', fg: '#7f1d1d' }, // red
  { bg: 'linear-gradient(135deg,#c7d2fe,#6366f1)', fg: '#312e81' }, // indigo
  { bg: 'linear-gradient(135deg,#a7f3d0,#10b981)', fg: '#064e3b' }, // green
  { bg: 'linear-gradient(135deg,#bfdbfe,#3b82f6)', fg: '#1e3a8a' }, // blue
  { bg: 'linear-gradient(135deg,#fbcfe8,#ec4899)', fg: '#831843' }, // pink
  { bg: 'linear-gradient(135deg,#ddd6fe,#8b5cf6)', fg: '#4c1d95' }, // violet
  { bg: 'linear-gradient(135deg,#fed7aa,#f97316)', fg: '#7c2d12' }, // orange
];

function avatarStyle(name: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const p = AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  return { background: p.bg, color: p.fg };
}

type UnpaidRow = {
  id: string; patient: string; doctor: string; date: string; services: string[];
  amount: number; paid: number; debt: number; overdue: boolean;
};

/* ---------------- Receipts (chek) panel ---------------- */
const CLINIC_NAME = 'SSD KLINIKA';
const CLINIC_SUB  = 'Sirius Stoma Dent Diagnostika markazi';

function ReceiptsPanel({
  payments,
}: {
  payments: Payment[];
}) {
  const promos = usePromoCodes();
  const promoByPayment = useMemo(() => {
    const m = new Map<string, PromoCode>();
    for (const c of promos) if (c.paymentId) m.set(c.paymentId, c);
    return m;
  }, [promos]);
  const [viewId, setViewId] = useState<string | null>(null);
  const viewing = payments.find((p) => p.id === viewId) || null;

  const [pageSize, setPageSize] = useState<number>(15);
  const [page, setPage] = useState<number>(1);
  const totalPages = Math.max(1, Math.ceil(payments.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [pageSize, payments.length]);
  const pageStart = (page - 1) * pageSize;
  const pageRows = payments.slice(pageStart, pageStart + pageSize);

  return (
    <section className="cash-panel">
      <div className="cash-panel-head">
        <h3>To‘lovlar tarixi</h3>
        <small>{payments.length} ta yozuv</small>
      </div>
      <div className="cash-table-wrap">
        <table className="cash-table">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Bemor</th>
              <th>Xizmat</th>
              <th>Shifokor</th>
              <th className="cash-num">Chegirma</th>
              <th className="cash-num">Summa</th>
              <th>Usul</th>
              <th>Promo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={9} className="cash-empty">To‘lovlar yo‘q</td></tr>
            )}
            {pageRows.map((p) => {
              const promo = promoByPayment.get(p.id);
              return (
                <tr key={p.id}>
                  <td className="cash-muted">{fmtDateTime(p.date)}</td>
                  <td>{p.patientName}</td>
                  <td>{p.serviceName}</td>
                  <td>{p.doctorName ?? '—'}</td>
                  <td className="cash-num">{p.discount > 0 ? fmtSum(p.discount) : '—'}</td>
                  <td className="cash-num cash-total">{fmtSum(p.total)}</td>
                  <td><span className={`cash-chip chip-${p.method}`}>{methodLabel[p.method]}</span></td>
                  <td>{promo ? <code style={{ color: '#1e40af', fontWeight: 700 }}>{promo.code}</code> : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="cash-icon-btn" title="Chop etish" onClick={() => setViewId(p.id)}>
                        <Printer size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payments.length > 0 && (
        <div className="cash-pagination">
          <div className="cash-page-size">
            <span>Sahifada:</span>
            {[15, 30, 50].map((n) => (
              <button
                key={n}
                className={pageSize === n ? 'is-active' : ''}
                onClick={() => setPageSize(n)}
              >{n}</button>
            ))}
          </div>
          <div className="cash-page-info">
            {pageStart + 1}–{Math.min(pageStart + pageSize, payments.length)} / {payments.length}
          </div>
          <div className="cash-page-nav">
            <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        </div>
      )}

      {viewing && (
        <ReceiptModal
          payment={viewing}
          promo={promoByPayment.get(viewing.id) ?? null}
          onClose={() => setViewId(null)}
        />
      )}
    </section>
  );
}

function ReceiptModal({
  payment, promo, onClose,
}: {
  payment: Payment;
  promo: PromoCode | null;
  onClose: () => void;
}) {
  const contact = useContactSettings();
  const logo = contact.logoEnabled !== false ? contact.logoDataUrl : undefined;
  const patients = usePatients();
  const patient = patients.find((x) => x.id === payment.patientId);
  const jshshir = patient?.jshshir;
  function print() {
    const node = document.getElementById('chek-print-area');
    if (!node) return;
    const w = window.open('', '_blank', 'width=360,height=640');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Chek — ${payment.patientName}</title>
      <style>${receiptPrintCss}</style></head><body><div class="chek">${node.innerHTML}</div>
      <script>window.onload=()=>{setTimeout(()=>{window.print();},150);};window.onafterprint=()=>window.close();<\/script>
      </body></html>`);
    w.document.close();
    w.focus();
  }

  return (
    <div className="chek-backdrop" onClick={onClose}>
      <div className="chek-center" onClick={(e) => e.stopPropagation()}>
        <button className="chek-close" onClick={onClose} aria-label="Yopish"><X size={14} /></button>
        <div className="chek" id="chek-print-area-wrap">
          <div id="chek-print-area">
            <div className="chek-head">
              {logo && <img src={logo} alt="logo" className="chek-logo" />}
              <div className="chek-clinic">SSD KLINIKA</div>
              <div className="chek-clinic-sub">{CLINIC_SUB}</div>
              {contact.address && <div className="chek-clinic-meta">{contact.address}</div>}
              {contact.phones?.[0] && (
                <div className="chek-clinic-meta">
                  Tel: {contact.phones.map((p) => p.number).slice(0, 2).join(' · ')}
                </div>
              )}
            </div>
            <div className="chek-divider double" />
            <div className="chek-title">TO‘LOV CHEKI</div>
            <div className="chek-receipt-no">
              № {payment.id.slice(-8).toUpperCase()} · {fmtDateTime(payment.date)}
            </div>
            <div className="chek-divider" />
            <dl className="chek-rows">
              <div><dt>Bemor</dt><dd>{payment.patientName || '—'}</dd></div>
              {jshshir && <div><dt>JSHSHIR</dt><dd>{jshshir}</dd></div>}
              {patient?.phone && <div><dt>Telefon</dt><dd>{patient.phone}</dd></div>}
              <div><dt>Shifokor</dt><dd>{payment.doctorName || '—'}</dd></div>
              <div><dt>Xizmat</dt><dd>{payment.serviceName || '—'}</dd></div>
            </dl>
            <div className="chek-divider" />
            <dl className="chek-rows">
              <div><dt>Xizmat summasi</dt><dd>{fmtSum(payment.amount)}</dd></div>
              {(payment.discount - (payment.usedPromoAmount || 0)) > 0 && (
                <div className="chek-discount">
                  <dt>Chegirma</dt><dd>− {fmtSum(payment.discount - (payment.usedPromoAmount || 0))}</dd>
                </div>
              )}
              {payment.usedPromoCode && (payment.usedPromoAmount || 0) > 0 && (
                <div className="chek-discount">
                  <dt>Promo ({payment.usedPromoCode})</dt><dd>− {fmtSum(payment.usedPromoAmount!)}</dd>
                </div>
              )}
              <div><dt>To‘lov usuli</dt><dd>{methodLabel[payment.method]}</dd></div>
            </dl>
            <div className="chek-divider" />
            <div className="chek-total">
              <span>JAMI TO‘LANGAN</span>
              <strong>{fmtSum(payment.total)}</strong>
            </div>
            {promo && (
              <>
                <div className="chek-divider" />
                <div className="chek-promo">
                  <div className="chek-promo-label">★ YANGI PROMO KOD ★</div>
                  <div className="chek-promo-code">{promo.code}</div>
                  <div className="chek-promo-meta">
                    Keyingi tashrifingizda <strong>{fmtSum(promo.amount)}</strong> chegirma
                  </div>
                  <div className="chek-promo-meta">
                    Amal muddati: {new Date(promo.expiresAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </>
            )}
            {payment.note && (
              <>
                <div className="chek-divider" />
                <div className="chek-note">Izoh: {payment.note}</div>
              </>
            )}
            <div className="chek-divider double" />
            <div className="chek-foot">
              <div className="chek-foot-thanks">Tashrifingiz uchun rahmat!</div>
              <div className="chek-foot-note">Sogʻliqni asrash — bizning asosiy maqsadimiz</div>
              {contact.socials?.[0]?.url && (
                <div className="chek-foot-meta">
                  {contact.socials.slice(0, 2).map((s) => s.handle).join(' · ')}
                </div>
              )}
              <div className="chek-foot-ts">
                Chop etilgan: {new Date().toLocaleString('ru-RU')}
              </div>
            </div>
          </div>
        </div>
        <button className="chek-print-btn" onClick={print}>
          <Printer size={14} /> Chop etish
        </button>
      </div>
    </div>
  );
}

const receiptPrintCss = `
@page { size: 80mm auto; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 10pt; line-height: 1.4; }
.chek { width: 72mm; margin: 0 auto; padding: 3mm; box-sizing: border-box; font-size: 10pt; }
.chek * { font-size: 10pt; }
.chek-head { text-align: center; }
.chek-logo { display: block; margin: 0 auto 3px; max-width: 48mm; max-height: 18mm; object-fit: contain; }
.chek-clinic { font-weight: 900; letter-spacing: .12em; font-size: 14pt; }
.chek-clinic-sub { font-weight: 600; margin-top: 2px; }
.chek-clinic-meta { margin-top: 1px; }
.chek-divider { border-top: 1px dashed #000; margin: 5px 0; }
.chek-divider.double { border-top: 2px solid #000; border-bottom: 1px dashed #000; height: 2px; margin: 6px 0; padding-top: 2px; }
.chek-title { text-align: center; font-weight: 900; letter-spacing: .25em; margin: 2px 0; font-size: 11pt; }
.chek-title * { font-size: 11pt; }
.chek-receipt-no { text-align: center; margin-bottom: 2px; }
.chek-rows { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.chek-rows > div { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
.chek-rows dt { margin: 0; }
.chek-rows dd { margin: 0; text-align: right; font-weight: 700; max-width: 55%; word-break: break-word; }
.chek-discount dd { color: #000; }
.chek-total { display: flex; justify-content: space-between; align-items: baseline; font-weight: 900; margin: 3px 0; font-size: 12pt; letter-spacing: .02em; }
.chek-total * { font-size: 12pt; }
.chek-total strong { text-decoration: underline; text-decoration-style: double; }
.chek-promo { margin-top: 4px; border: 2px dashed #000; padding: 6px 4px; text-align: center; }
.chek-promo-label { font-weight: 800; letter-spacing: .15em; }
.chek-promo-code { font-weight: 900; font-size: 13pt; letter-spacing: .12em; margin: 3px 0; padding: 2px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
.chek-promo-code * { font-size: 13pt; }
.chek-promo-meta { margin-top: 2px; }
.chek-note { margin-top: 4px; font-style: italic; }
.chek-foot { text-align: center; margin-top: 4px; }
.chek-foot-thanks { font-weight: 800; letter-spacing: .08em; }
.chek-foot-note { margin-top: 2px; }
.chek-foot-meta { margin-top: 3px; font-weight: 600; letter-spacing: .04em; }
.chek-foot-ts { margin-top: 4px; font-size: 8pt; }
.chek-foot-ts * { font-size: 8pt; }
`;

function UnpaidPanel({
  rows, query, medicals, patients, doctorFilter, onDoctorFilter, onPayPartial, onDefer,
}: {
  rows: UnpaidRow[];
  query: string;
  medicals: ReturnType<typeof useEmployees>;
  patients: ReturnType<typeof usePatients>;
  doctorFilter: string;
  onDoctorFilter: (v: string) => void;
  onPayPartial: (r: UnpaidRow) => void;
  onDefer: (r: UnpaidRow) => void;
}) {
  const phoneByName = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => { if (p.phone) m.set(p.fullName, p.phone); });
    return m;
  }, [patients]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (doctorFilter !== 'all' && r.doctor !== doctorFilter) return false;
      if (!q) return true;
      return (r.patient.toLowerCase().includes(q)
        || r.doctor.toLowerCase().includes(q)
        || r.services.join(' ').toLowerCase().includes(q));
    });
  }, [rows, query, doctorFilter]);

  const overdueTotal = filtered.filter((r) => r.overdue).reduce((s, r) => s + r.debt, 0);
  const pendingTotal = filtered.filter((r) => !r.overdue).reduce((s, r) => s + r.debt, 0);

  return (
    <section className="cash-panel unpaid-panel">
      <div className="cash-panel-head unpaid-head">
        <div>
          <h3>Qarzdorlar roʻyxati</h3>
          <small>{filtered.length} ta davolash yozuvi</small>
        </div>
        <div className="unpaid-head-chips">
          <span className="unpaid-chip-overdue"><AlertCircle size={12} /> Muddati o'tgan: {fmtSum(overdueTotal)}</span>
          <span className="unpaid-chip-pending"><Clock size={12} /> Kutilmoqda: {fmtSum(pendingTotal)}</span>
        </div>
        <div className="unpaid-doc-filter">
          <Stethoscope size={14} />
          <select value={doctorFilter} onChange={(e) => onDoctorFilter(e.target.value)}>
            <option value="all">Barcha shifokorlar</option>
            {medicals.map((e) => (
              <option key={e.id} value={e.fullName}>{e.fullName}</option>
            ))}
          </select>
          <ChevronDown size={13} className="unpaid-doc-chev" />
        </div>
      </div>

      {/* Jadval ustun nomlari */}
      <div className="unpaid-thead">
        <div>Bemor</div>
        <div>Telefon</div>
        <div>Shifokor</div>
        <div>Sana</div>
        <div>Xizmatlar</div>
        <div className="u-right">Jami summa</div>
        <div className="u-right">To'langan</div>
        <div className="u-right">Qolgan summa</div>
        <div className="u-right">Amallar</div>
      </div>

      <div className="unpaid-list">
        {filtered.length === 0 && (
          <div className="cash-empty" style={{ padding: 32, textAlign: 'center' }}>Qarzdor bemorlar yo'q</div>
        )}
        {filtered.map((r) => {
          const pct = r.amount > 0 ? Math.round((r.paid / r.amount) * 100) : 0;
          return (
            <div key={r.id} className={`unpaid-row ${r.overdue ? 'is-overdue' : ''}`}>
              <div className="unpaid-cell unpaid-cell-patient">
                <div className="unpaid-avatar" style={avatarStyle(r.patient)}>{r.patient.charAt(0).toUpperCase()}</div>
                <div className="unpaid-patient-text">
                  <strong>{r.patient}</strong>
                  {r.paid > 0 && (
                    <div className="unpaid-progress" title={`${pct}% to'langan`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="unpaid-cell unpaid-cell-phone">
                <small>Telefon</small>
                <span>{phoneByName.get(r.patient) || '—'}</span>
              </div>

              <div className="unpaid-cell unpaid-cell-doctor">
                <small>Shifokor</small>
                <span>{r.doctor || '—'}</span>
              </div>

              <div className="unpaid-cell unpaid-cell-date">
                <small><Calendar size={11} /> Sana</small>
                <span>{r.date}</span>
              </div>

              <div className="unpaid-cell unpaid-cell-services">
                <small>Xizmatlar</small>
                <div className="unpaid-svc">
                  <Briefcase size={12} />
                  <span title={r.services.join(', ')}>
                    {r.services[0] ?? '—'}
                    {r.services.length > 1 && <em> (+{r.services.length - 1})</em>}
                  </span>
                  <button className="unpaid-eye" title="Batafsil"><Eye size={13} /></button>
                </div>
              </div>

              <div className="unpaid-cell unpaid-cell-total">
                <small>Jami summa</small>
                <span className="unpaid-total-amount">{fmtSum(r.amount)}</span>
              </div>

              <div className="unpaid-cell unpaid-cell-paid">
                <small>To'langan</small>
                {r.paid > 0 ? (
                  <span className="unpaid-paid-amount">{fmtSum(r.paid)} <em>· {pct}%</em></span>
                ) : (
                  <span className="unpaid-paid-zero">— </span>
                )}
              </div>

              <div className="unpaid-cell unpaid-cell-remaining">
                <small>Qolgan summa</small>
                <span className={r.overdue ? 'unpaid-debt-amount' : 'unpaid-remaining-amount'}>
                  {fmtSum(r.debt)}
                </span>
                {r.overdue && <em className="unpaid-overdue-tag">muddati o'tgan</em>}
              </div>

              <div className="unpaid-cell unpaid-cell-actions">
                <button
                  className="unpaid-btn-later"
                  title="Qarz daftariga ko'chirish — bo'lib-bo'lib to'lash"
                  onClick={() => onDefer(r)}
                >
                  <Clock size={12} /> Keyinroq to'lash
                </button>
                <button
                  className="unpaid-btn-pay"
                  onClick={() => onPayPartial(r)}
                >
                  To'lov qilish <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Partial payment (bo'lib-bo'lib) modal ---------------- */

function PartialPaymentModal({
  data, onClose, onConfirm,
}: {
  data: {
    patient: string; doctor: string; serviceName: string;
    amount: number; paid: number; debt: number; date: string;
  };
  onClose: () => void;
  onConfirm: (amount: number, method: Method, note?: string) => void | Promise<void>;
}) {
  const [sum, setSum] = useState<number>(data.debt);
  const [method, setMethod] = useState<Method>('naqd');
  const [note, setNote] = useState('');

  const clean = Math.max(0, Math.min(data.debt, Math.round(sum || 0)));
  const after = data.debt - clean;
  const paidAfter = data.paid + clean;
  const pct = data.amount > 0 ? Math.round((paidAfter / data.amount) * 100) : 0;

  const quick = [
    { label: '25%', v: Math.round(data.debt * 0.25) },
    { label: '50%', v: Math.round(data.debt * 0.5) },
    { label: '75%', v: Math.round(data.debt * 0.75) },
    { label: "To'liq", v: data.debt },
  ];

  const methodMeta: { k: Method; label: string; icon: any; color: string; soft: string }[] = [
    { k: 'naqd',    label: 'Naqd',    icon: Banknote,       color: '#047857', soft: '#ecfdf5' },
    { k: 'plastik', label: 'Karta',   icon: CreditCard,     color: '#4f46e5', soft: '#eef2ff' },
    { k: 'bank',    label: 'O‘tkazma',icon: ArrowRightLeft, color: '#b45309', soft: '#fef3c7' },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const prevPct = data.amount > 0 ? (data.paid / data.amount) * 100 : 0;
  const nowPct  = data.amount > 0 ? (clean / data.amount) * 100 : 0;

  return (
    <div className="dpm-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dpm-head">
          <div className="dpm-head-top">
            <div className="dpm-head-ico" style={{ background: '#fff7ed', color: '#c2410c' }}>
              <Receipt size={18} />
            </div>
            <div className="dpm-head-text">
              <h2>Qarzni toʻlash</h2>
              <p>Boʻlib-boʻlib yoki toʻliq toʻlash mumkin</p>
            </div>
            <button className="dpm-close" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>

          <div className="dpm-patient">
            <div className="dpm-avatar">{data.patient.charAt(0).toUpperCase()}</div>
            <div className="dpm-patient-info">
              <strong>{data.patient}</strong>
              <div className="dpm-patient-meta">
                <span>{data.serviceName || '—'}</span>
                <span>{data.doctor || '—'}</span>
                <span><Calendar size={10} /> {data.date}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dpm-body">
          <div className="dpm-stats">
            <div className="dpm-stat">
              <small>Jami qarz</small>
              <strong>{fmtSum(data.amount)}</strong>
            </div>
            <div className="dpm-stat dpm-stat-paid">
              <small>Toʻlangan</small>
              <strong>{fmtSum(data.paid)}</strong>
            </div>
            <div className="dpm-stat dpm-stat-left">
              <small>Qoldiq</small>
              <strong>{fmtSum(data.debt)}</strong>
            </div>
          </div>

          <div className="dpm-progress-box">
            <div className="dpm-progress-head">
              <span>Toʻlovdan soʻng</span>
              <strong>{pct}%</strong>
            </div>
            <div className="dpm-progress-bar">
              <span className="dpm-progress-prev" style={{ width: `${prevPct}%` }} />
              <span className="dpm-progress-now"  style={{ left: `${prevPct}%`, width: `${nowPct}%` }} />
            </div>
            <div className="dpm-progress-note">
              {clean === 0 && <><span className="dpm-dot" /> Summa kiriting</>}
              {clean > 0 && after > 0 && <><span className="dpm-dot" /> Qoldiq: <strong>{fmtSum(after)} soʻm</strong></>}
              {clean > 0 && after === 0 && <span className="dpm-ok"><CheckCircle2 size={12} /> Qarz yopiladi</span>}
            </div>
          </div>

          <div className="dpm-field">
            <label className="dpm-label"><Wallet size={13} /> Toʻlov summasi</label>
            <div className="dpm-amount">
              <input type="number" min={0} max={data.debt} value={sum}
                onChange={(e) => setSum(Number(e.target.value))} />
              <span>soʻm</span>
            </div>
            <div className="dpm-chips">
              {quick.map((q) => (
                <button key={q.label} type="button" onClick={() => setSum(q.v)}
                  className={`dpm-chip ${sum === q.v ? 'is-active' : ''}`}>
                  <strong>{q.label}</strong>
                  <em>{fmtSum(q.v)}</em>
                </button>
              ))}
            </div>
          </div>

          <div className="dpm-field">
            <label className="dpm-label"><CreditCard size={13} /> Toʻlov usuli</label>
            <div className="dpm-methods">
              {methodMeta.map((m) => {
                const Ico = m.icon; const active = method === m.k;
                return (
                  <button key={m.k} type="button" onClick={() => setMethod(m.k)}
                    className={`dpm-method ${active ? 'is-active' : ''}`}>
                    <Ico size={15} />
                    <span>{m.label}</span>
                    {active && <Check size={13} className="dpm-method-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dpm-field">
            <label className="dpm-label"><MessageSquare size={13} /> Izoh <span className="dpm-opt">(ixtiyoriy)</span></label>
            <textarea className="dpm-textarea" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="qisqa izoh…" />
          </div>
        </div>

        <div className="dpm-foot">
          <button className="dpm-btn dpm-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button className="dpm-btn dpm-btn-primary" disabled={clean <= 0}
            onClick={() => clean > 0 && onConfirm(clean, method, note.trim() || undefined)}>
            <Wallet size={14} /> Toʻlov qilish — {fmtSum(clean)} soʻm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Payment Modal ---------------- */
function PaymentModal({
  onClose, patients, services, employees, prefill,
}: {
  onClose: () => void;
  patients: ReturnType<typeof usePatients>;
  services: ReturnType<typeof useServices>;
  employees: ReturnType<typeof useEmployees>;
  prefill?: { patientId?: string; serviceId?: string; doctorId?: string };
}) {
  const [patientId, setPatientId] = useState(prefill?.patientId ?? '');
  const [serviceId, setServiceId] = useState(prefill?.serviceId ?? '');
  const [doctorId, setDoctorId] = useState(prefill?.doctorId ?? '');
  const [discount, setDiscount] = useState<number>(0);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [method, setMethod] = useState<Method>('naqd');
  const [note, setNote] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const allPromos = usePromoCodes();

  const patient = patients.find((p) => p.id === patientId);
  const service = services.find((s) => s.id === serviceId);
  const price = service?.price ?? 0;
  const promoDiscount = appliedPromo ? Math.min(appliedPromo.amount, Math.max(0, price - discount)) : 0;
  const total = Math.max(0, price - discount - promoDiscount);
  const canSubmit = !!patientId && !!serviceId && total > 0;

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    const list = q ? patients.filter((p) => p.fullName.toLowerCase().includes(q) || p.phone.includes(q)) : patients;
    return list.slice(0, 8);
  }, [patients, patientQuery]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    const list = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
    return list.slice(0, 8);
  }, [services, serviceQuery]);

  // keep discount and percent in sync with each other and price
  function setDiscountSum(v: number) {
    const clean = Math.max(0, Math.min(price, Math.round(v)));
    setDiscount(clean);
    setDiscountPct(price > 0 ? Math.round((clean / price) * 100) : 0);
  }
  function setDiscountPercent(v: number) {
    const clean = Math.max(0, Math.min(100, Math.round(v)));
    setDiscountPct(clean);
    setDiscount(price > 0 ? Math.round((clean / 100) * price) : 0);
  }

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoMsg({ ok: false, text: 'Kod kiritilmadi' }); return; }
    const found = findPromoByCode(code);
    if (!found) { setPromoMsg({ ok: false, text: 'Bunday kod topilmadi' }); return; }
    if (found.usedAt) { setPromoMsg({ ok: false, text: 'Kod allaqachon ishlatilgan' }); return; }
    if (found.expiresAt < Date.now()) { setPromoMsg({ ok: false, text: 'Kod muddati tugagan' }); return; }
    setAppliedPromo(found);
    setPromoMsg({ ok: true, text: `${fmtSum(found.amount)} chegirma qo‘llandi` });
  }
  function clearPromo() {
    setAppliedPromo(null);
    setPromoMsg(null);
    setPromoInput('');
  }

  const submit = () => {
    const p = patients.find((x) => x.id === patientId);
    const svc = services.find((s) => s.id === serviceId);
    const doc = employees.find((e) => e.id === doctorId);
    if (!p || !svc) return;
    const totalDiscount = discount + promoDiscount;
    addPayment({
      patientId: p.id, patientName: p.fullName,
      serviceId: svc.id, serviceName: svc.name,
      doctorId: doc?.id, doctorName: doc?.fullName,
      amount: svc.price, discount: totalDiscount, total, method,
      note: note.trim() || undefined,
      usedPromoCode: appliedPromo?.code,
      usedPromoAmount: appliedPromo ? promoDiscount : undefined,
    });
    if (appliedPromo) markPromoUsed(appliedPromo.id);
    onClose();
  };

  const methodMeta: { k: Method; label: string; icon: any; color: string; soft: string }[] = [
    { k: 'naqd',    label: 'Naqd',    icon: Banknote,       color: '#047857', soft: '#ecfdf5' },
    { k: 'plastik', label: 'Karta',   icon: CreditCard,     color: '#4f46e5', soft: '#eef2ff' },
    { k: 'bank',    label: 'O‘tkazma',icon: ArrowRightLeft, color: '#b45309', soft: '#fef3c7' },
  ];

  return (
    <div className="pay-backdrop" role="presentation" onClick={onClose}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pay-head">
          <div className="pay-head-ico"><Receipt size={18} /></div>
          <div>
            <h2>Yangi to‘lov</h2>
            <p>Bemordan to‘lov qabul qilish</p>
          </div>
          <button className="pay-close" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>

        <div className="pay-body">
          {/* Chap taraf — forma */}
          <div className="pay-form">
            {/* Patient */}
            <div className="pay-field">
              <label className="pay-label"><UserRound size={13} /> Bemor</label>
              <div className="pay-combo">
                <div className="pay-combo-input">
                  <Search size={14} className="pay-combo-ico" />
                  <input
                    placeholder="Ism yoki telefon raqami..."
                    value={patient ? patient.fullName : patientQuery}
                    onChange={(e) => { setPatientQuery(e.target.value); setPatientId(''); setPatientOpen(true); }}
                    onFocus={() => setPatientOpen(true)}
                  />
                  {patient && (
                    <button className="pay-clear" onClick={() => { setPatientId(''); setPatientQuery(''); }} type="button">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {patientOpen && (
                  <>
                    <div className="pay-dropdown">
                      {filteredPatients.length === 0 && (
                        <div className="pay-dropdown-empty">Bemor topilmadi</div>
                      )}
                      {filteredPatients.map((p) => (
                        <button key={p.id} type="button" className="pay-dropdown-item"
                          onClick={() => { setPatientId(p.id); setPatientQuery(''); setPatientOpen(false); }}>
                          <div className="pay-ava">{p.fullName.charAt(0).toUpperCase()}</div>
                          <div className="pay-item-main">
                            <strong>{p.fullName}</strong>
                            <small>{p.phone || 'telefon yoʻq'}</small>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="pay-dropdown-backdrop" onClick={() => setPatientOpen(false)} />
                  </>
                )}
              </div>
            </div>

            {/* Service */}
            <div className="pay-field">
              <label className="pay-label"><Briefcase size={13} /> Xizmat</label>
              <div className="pay-combo">
                <div className="pay-combo-input">
                  <Search size={14} className="pay-combo-ico" />
                  <input
                    placeholder="Xizmat nomi..."
                    value={service ? service.name : serviceQuery}
                    onChange={(e) => { setServiceQuery(e.target.value); setServiceId(''); setServiceOpen(true); }}
                    onFocus={() => setServiceOpen(true)}
                  />
                  {service && (
                    <button className="pay-clear" onClick={() => { setServiceId(''); setServiceQuery(''); setDiscount(0); setDiscountPct(0); }} type="button">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {serviceOpen && (
                  <>
                    <div className="pay-dropdown">
                      {filteredServices.length === 0 && (
                        <div className="pay-dropdown-empty">Xizmat topilmadi</div>
                      )}
                      {filteredServices.map((s) => (
                        <button key={s.id} type="button" className="pay-dropdown-item"
                          onClick={() => { setServiceId(s.id); setServiceQuery(''); setServiceOpen(false); }}>
                          <div className="pay-svc-ico"><Briefcase size={14} /></div>
                          <div className="pay-item-main">
                            <strong>{s.name}</strong>
                            <small>Ulush: {s.doctorShare}%</small>
                          </div>
                          <div className="pay-item-price">{fmtSum(s.price)}</div>
                        </button>
                      ))}
                    </div>
                    <div className="pay-dropdown-backdrop" onClick={() => setServiceOpen(false)} />
                  </>
                )}
              </div>
            </div>

            {/* Doctor */}
            <div className="pay-field">
              <label className="pay-label"><Stethoscope size={13} /> Shifokor <span className="pay-opt">(ixtiyoriy)</span></label>
              <div className="pay-select-wrap">
                <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  <option value="">Tanlanmagan</option>
                  {employees.map((e) => (<option key={e.id} value={e.id}>{e.fullName}</option>))}
                </select>
                <ChevronDown size={14} className="pay-select-chev" />
              </div>
            </div>

            {/* Discount */}
            <div className="pay-field">
              <label className="pay-label"><Percent size={13} /> Chegirma</label>
              <div className="pay-discount-row">
                <div className="pay-money-input">
                  <input type="number" min={0} max={price} value={discount}
                    onChange={(e) => setDiscountSum(Number(e.target.value))} placeholder="0" />
                  <span>soʻm</span>
                </div>
                <div className="pay-money-input pay-pct-input">
                  <input type="number" min={0} max={100} value={discountPct}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))} placeholder="0" />
                  <span>%</span>
                </div>
                <div className="pay-quick-pct">
                  {[0, 5, 10, 20].map((v) => (
                    <button key={v} type="button" onClick={() => setDiscountPercent(v)}
                      className={`pay-quick ${discountPct === v ? 'is-active' : ''}`}>
                      {v === 0 ? '0' : `${v}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Promo code */}
            <div className="pay-field">
              <label className="pay-label"><Hash size={13} /> Promo kod</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoMsg(null); }}
                  placeholder="SIRIUS-A7K3"
                  disabled={!!appliedPromo}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8,
                    border: '1px solid #cbd5e1', fontFamily: 'ui-monospace, Menlo, monospace',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                />
                {appliedPromo ? (
                  <button type="button" onClick={clearPromo}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ef4444',
                      background: '#fff', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>
                    Bekor qilish
                  </button>
                ) : (
                  <button type="button" onClick={applyPromo}
                    style={{ padding: '8px 14px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(180deg,#3b82f6,#2563eb)', color: '#fff',
                      fontWeight: 700, cursor: 'pointer' }}>
                    Qo‘llash
                  </button>
                )}
              </div>
              {(() => {
                if (appliedPromo) return null;
                const now = Date.now();
                const own = patientId
                  ? allPromos.filter((c) => c.patientId === patientId && !c.usedAt && c.expiresAt > now)
                  : [];
                const others = allPromos
                  .filter((c) => !c.usedAt && c.expiresAt > now && c.patientId !== patientId)
                  .slice(0, 6);
                if (own.length === 0 && others.length === 0) return null;
                return (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {own.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <small style={{ color: '#64748b' }}>Bemorning promolari:</small>
                        {own.map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setPromoInput(c.code); setAppliedPromo(c); setPromoMsg({ ok: true, text: `${fmtSum(c.amount)} chegirma qo‘llandi` }); }}
                            style={{
                              padding: '3px 8px', borderRadius: 6, border: '1px dashed #2563eb',
                              background: '#eff6ff', color: '#1e40af', fontFamily: 'ui-monospace, Menlo, monospace',
                              fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
                            }}>
                            {c.code} · −{fmtSum(c.amount)}
                          </button>
                        ))}
                      </div>
                    )}
                    <small style={{ color: '#94a3b8', fontSize: 11 }}>
                      Istalgan bemorning promo kodini qo‘lda kiriting — har qanday xizmat uchun ishlatish mumkin.
                    </small>
                  </div>
                );
              })()}
              {promoMsg && (
                <small style={{ color: promoMsg.ok ? '#047857' : '#dc2626', marginTop: 4, display: 'block' }}>
                  {promoMsg.text}
                </small>
              )}
            </div>

            {/* Method */}
            <div className="pay-field">
              <label className="pay-label"><Wallet size={13} /> To‘lov usuli</label>
              <div className="pay-method-grid">
                {methodMeta.map((m) => {
                  const Ico = m.icon; const active = method === m.k;
                  return (
                    <button key={m.k} type="button" onClick={() => setMethod(m.k)}
                      className={`pay-method ${active ? 'is-active' : ''}`}
                      style={active ? { borderColor: m.color, background: m.soft } : undefined}>
                      <span className="pay-method-ico" style={{ background: m.soft, color: m.color }}>
                        <Ico size={16} />
                      </span>
                      <span className="pay-method-name">{m.label}</span>
                      {active && <Check size={14} className="pay-method-check" style={{ color: m.color }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            <div className="pay-field">
              <label className="pay-label"><MessageSquare size={13} /> Izoh <span className="pay-opt">(ixtiyoriy)</span></label>
              <input className="pay-text-input" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Qo‘shimcha ma’lumot..." />
            </div>
          </div>

          {/* O'ng taraf — xulosa */}
          <aside className="pay-summary">
            <div className="pay-summary-head">
              <small>HISOB-KITOB</small>
            </div>
            <div className="pay-summary-rows">
              <div className="pay-sum-row">
                <span>Xizmat narxi</span>
                <strong>{fmtSum(price)}</strong>
              </div>
              <div className="pay-sum-row">
                <span>Chegirma {discountPct > 0 && <em>({discountPct}%)</em>}</span>
                <strong className="pay-discount-val">− {fmtSum(discount)}</strong>
              </div>
              {appliedPromo && (
                <div className="pay-sum-row">
                  <span>Promo <em>({appliedPromo.code})</em></span>
                  <strong className="pay-discount-val">− {fmtSum(promoDiscount)}</strong>
                </div>
              )}
              <div className="pay-sum-divider" />
              <div className="pay-sum-row pay-sum-total">
                <span>Jami to‘lov</span>
                <strong>{fmtSum(total)}</strong>
              </div>
            </div>

            {patient && (
              <div className="pay-summary-chip">
                <div className="pay-ava sm">{patient.fullName.charAt(0).toUpperCase()}</div>
                <div>
                  <strong>{patient.fullName}</strong>
                  <small>{patient.phone || '—'}</small>
                </div>
              </div>
            )}

            <button className="pay-submit-btn" disabled={!canSubmit} onClick={submit}>
              <CheckCircle2 size={16} /> To‘lovni qabul qilish
            </button>
            <button className="pay-cancel" type="button" onClick={onClose}>Bekor qilish</button>
          </aside>
        </div>
      </div>

      <style>{paymentStyles}</style>
    </div>
  );
}

/* ---------------- Styles ---------------- */
const cashStyles = `
.cash-page { --brand: #4f46e5; --brand-soft: #eef2ff; --green: #10b981; --amber: #f59e0b; --red: #ef4444; }

.cash-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 14px; flex-wrap: wrap;
}
.cash-title h1 { margin: 0; font-size: 22px; color: #0f172a; }
.cash-head-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.cash-range { display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 10px; gap: 2px; }
.cash-pill {
  border: none; background: transparent; padding: 6px 14px; border-radius: 8px;
  font-size: 13px; font-weight: 600; color: #475569; cursor: pointer;
}
.cash-pill.is-active { background: var(--brand); color: #fff; box-shadow: 0 1px 3px rgba(79,70,229,.3); }

.cash-date-group {
  display: inline-flex; align-items: center; gap: 4px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 3px;
}
.cash-date {
  border: none; background: transparent; padding: 5px 8px; border-radius: 6px;
  font-size: 13px; color: #0f172a; outline: none;
}
.cash-date:focus { background: var(--brand-soft); }
.cash-date-sep { color: #94a3b8; padding: 0 4px; }

/* KPI row */
.cash-kpis {
  display: grid; gap: 12px; margin-bottom: 14px;
  grid-template-columns: repeat(4, 1fr);
}
@media (max-width: 1100px) { .cash-kpis { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { .cash-kpis { grid-template-columns: 1fr; } }

.cash-kpi {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
  padding: 14px 16px; box-shadow: 0 1px 2px rgba(15,23,42,.04);
  display: flex; flex-direction: column; gap: 6px; min-height: 108px;
}
.cash-kpi-top { display: flex; align-items: center; gap: 8px; color: #64748b; }
.cash-kpi-icon {
  width: 24px; height: 24px; border-radius: 8px; background: var(--brand-soft);
  color: var(--brand); display: inline-flex; align-items: center; justify-content: center;
}
.cash-kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
.cash-kpi-value { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; }
.cash-kpi-value-sm { font-size: 24px; }
.cash-kpi-sub { color: #64748b; font-size: 12px; }
.cash-kpi-plus { color: var(--green); font-weight: 700; }

.cash-kpi-primary .cash-kpi-icon { background: var(--brand-soft); color: var(--brand); }
.cash-kpi-primary .cash-kpi-value { color: var(--brand); }
.cash-kpi-green { background: linear-gradient(180deg, #ecfdf5 0%, #fff 70%); border-color: #d1fae5; }
.cash-kpi-green .cash-kpi-icon { background: #fff; color: var(--green); }
.cash-kpi-green .cash-kpi-value { color: #047857; }
.cash-kpi-red .cash-kpi-icon { background: #fef2f2; color: var(--red); }
.cash-kpi-red .cash-kpi-value { color: #b91c1c; }

.cash-methods { display: flex; flex-direction: column; gap: 6px; }
.cash-method-row {
  display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: center;
  font-size: 13px; color: #0f172a;
}
.cash-method-ico {
  width: 24px; height: 24px; border-radius: 6px; background: #f8fafc;
  color: #475569; display: inline-flex; align-items: center; justify-content: center;
}
.cash-method-name { color: #475569; }
.cash-method-sum { font-weight: 700; font-variant-numeric: tabular-nums; }

/* Tabs */
.cash-tabs-wrap {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 12px;
}
.cash-tabs {
  display: inline-flex; gap: 4px;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 0;
}
.cash-tab {
  background: transparent; border: none; padding: 10px 14px; cursor: pointer;
  font-size: 13.5px; font-weight: 600; color: #64748b;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  display: inline-flex; align-items: center; gap: 6px;
}
.cash-tab:hover { color: #0f172a; }
.cash-tab.is-active { color: var(--brand); border-bottom-color: var(--brand); }
.cash-tab-badge {
  background: var(--brand); color: #fff; font-size: 10.5px; font-weight: 700;
  padding: 2px 7px; border-radius: 999px;
}

.cash-doctor-select {
  position: relative; margin-left: auto;
  display: inline-flex; align-items: center;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 2px 10px 2px 10px; min-width: 240px;
}
.cash-doctor-select:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.cash-doc-ico { color: var(--brand); margin-right: 6px; }
.cash-doctor-select select {
  border: none; background: transparent; outline: none;
  padding: 7px 24px 7px 0; font-size: 13.5px; color: #0f172a; width: 100%;
  appearance: none; -webkit-appearance: none;
}
.cash-doc-chevron { position: absolute; right: 10px; color: #94a3b8; pointer-events: none; }
.cash-search { min-width: 240px; margin-left: auto; }

/* Mini KPI row (Hisoblashish) */
.cash-mini-kpis {
  display: grid; gap: 12px; grid-template-columns: repeat(4, 1fr);
  margin-bottom: 12px;
}
@media (max-width: 1000px) { .cash-mini-kpis { grid-template-columns: repeat(2, 1fr); } }
.cash-mini {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.cash-mini-top {
  display: flex; align-items: center; justify-content: space-between;
  color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
}
.cash-mini-top-left { display: inline-flex; align-items: center; gap: 6px; }
.cash-mini-top small { font-weight: 700; letter-spacing: .5px; }
.cash-mini-val { font-size: 20px; color: #0f172a; font-variant-numeric: tabular-nums; }
.cash-mini-income .cash-mini-val { color: var(--green); }
.cash-mini-pending { background: linear-gradient(180deg, #fffbeb 0%, #fff 60%); border-color: #fde68a; }
.cash-mini-pending .cash-mini-val { color: #b45309; }

.cash-btn-pay {
  background: var(--brand); color: #fff; border: none; padding: 5px 12px;
  border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer;
  box-shadow: 0 1px 3px rgba(79,70,229,.3);
}
.cash-btn-pay:hover:not(:disabled) { background: #4338ca; }
.cash-btn-pay:disabled { background: #cbd5e1; cursor: not-allowed; box-shadow: none; }

/* Panel / table */
.cash-panel {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.cash-panel-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 14px 16px 10px; border-bottom: 1px solid #f1f5f9;
}
.cash-panel-head h3 { margin: 0; font-size: 15px; color: #0f172a; }
.cash-panel-head small { color: #94a3b8; font-size: 12px; }

.cash-table-wrap { overflow-x: auto; }
.cash-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
.cash-table-fixed { table-layout: fixed; min-width: 760px; }
.cash-table-fixed td, .cash-table-fixed th { vertical-align: top; }
.cash-nowrap { white-space: nowrap; }
.cash-cell-wrap { overflow-wrap: anywhere; word-break: break-word; }
.cash-table thead th {
  text-align: left; padding: 10px 14px; background: #f8fafc;
  font-size: 11px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: .5px;
  border-bottom: 1px solid #e2e8f0;
}
.cash-table tbody td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.cash-table tbody tr:hover td { background: #fafbff; }
.cash-table tfoot td {
  padding: 12px 14px; background: #f8fafc; font-weight: 700; color: #0f172a;
  border-top: 1px solid #e2e8f0;
}
.cash-num { text-align: right; font-variant-numeric: tabular-nums; }
.cash-total { font-weight: 700; color: #0f172a; }
.cash-commission { font-weight: 700; color: var(--green); }
.cash-muted { color: #64748b; font-size: 12.5px; }
.cash-sub { color: #94a3b8; font-size: 11.5px; margin-top: 2px; }
.cash-empty { text-align: center; padding: 28px !important; color: #94a3b8; }
.cash-danger-text { color: #dc2626; font-weight: 700; }

.cash-chip {
  display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
}
.chip-naqd    { background: #ecfdf5; color: #047857; }
.chip-plastik { background: var(--brand-soft); color: var(--brand); }
.chip-bank    { background: #fef3c7; color: #b45309; }

.cash-pct {
  display: inline-block; background: var(--brand-soft); color: var(--brand);
  padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 12px;
}

.cash-icon-btn {
  width: 28px; height: 28px; border-radius: 7px; border: 1px solid #e2e8f0;
  background: #fff; color: #475569; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.cash-icon-btn:hover { background: #f8fafc; color: var(--brand); }
.cash-icon-danger:hover { background: #fef2f2; color: var(--red); border-color: #fecaca; }

.cash-info-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px; display: flex; flex-direction: column; gap: 6px;
}
.cash-info-card small { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }

/* ---- Unpaid panel ---- */
.unpaid-panel { background: #fff; }
.unpaid-head {
  flex-wrap: wrap; gap: 12px; align-items: center;
}
.unpaid-head-chips { display: inline-flex; gap: 8px; flex-wrap: wrap; }
.unpaid-chip-overdue {
  display: inline-flex; align-items: center; gap: 5px;
  background: #fef2f2; color: #b91c1c; font-size: 11.5px; font-weight: 700;
  padding: 4px 10px; border-radius: 999px; border: 1px solid #fecaca;
}
.unpaid-chip-pending {
  display: inline-flex; align-items: center; gap: 5px;
  background: #fffbeb; color: #b45309; font-size: 11.5px; font-weight: 700;
  padding: 4px 10px; border-radius: 999px; border: 1px solid #fde68a;
}
.unpaid-doc-filter {
  position: relative; margin-left: auto;
  display: inline-flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 2px 28px 2px 10px; color: #475569;
}
.unpaid-doc-filter:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.unpaid-doc-filter select {
  border: none; background: transparent; outline: none;
  padding: 7px 0; font-size: 13px; color: #0f172a;
  appearance: none; -webkit-appearance: none; cursor: pointer; min-width: 170px;
}
.unpaid-doc-chev { position: absolute; right: 10px; color: #94a3b8; pointer-events: none; }

.unpaid-list { padding: 4px 8px 12px; }

/* Jadval ustun nomlari */
.unpaid-thead {
  display: grid;
  grid-template-columns:
    minmax(170px, 1.3fr) minmax(120px, 0.85fr) minmax(110px, 0.8fr) minmax(95px, 0.7fr)
    minmax(180px, 1.3fr) minmax(115px, 0.85fr) minmax(105px, 0.75fr)
    minmax(125px, 0.9fr) minmax(220px, auto);
  gap: 12px; align-items: center;
  padding: 10px 18px;
  background: #f8fafc; border-top: 1px solid #eef2f7; border-bottom: 1px solid #e2e8f0;
  font-size: 11px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: .4px;
}
.unpaid-thead .u-right { text-align: right; }
@media (max-width: 1200px) { .unpaid-thead { display: none; } }

.unpaid-row {
  display: grid;
  grid-template-columns:
    minmax(170px, 1.3fr) minmax(120px, 0.85fr) minmax(110px, 0.8fr) minmax(95px, 0.7fr)
    minmax(180px, 1.3fr) minmax(115px, 0.85fr) minmax(105px, 0.75fr)
    minmax(125px, 0.9fr) minmax(220px, auto);
  gap: 12px; align-items: center;
  padding: 14px 14px;
  border-radius: 12px; background: #fff;
  border: 1px solid #eef2f7;
  margin: 8px 0;
  transition: background .14s, border-color .14s, box-shadow .14s;
}
.unpaid-row:hover { background: #fafbff; border-color: #e0e7ff; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.unpaid-row.is-overdue { border-left: 3px solid #ef4444; }
@media (max-width: 1200px) {
  .unpaid-row { grid-template-columns: 1fr; gap: 10px; padding: 12px; }
}

.unpaid-cell-phone span { color: #0f172a; font-size: 13px; font-variant-numeric: tabular-nums; }
.unpaid-cell-phone small { color: #94a3b8; }

.unpaid-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.unpaid-cell small {
  display: inline-flex; align-items: center; gap: 4px;
  color: #94a3b8; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .4px;
}
@media (min-width: 1201px) {
  .unpaid-cell small { display: none; } /* desktopda headerlar top row'da — cell small yashirin */
}

.unpaid-cell-patient { flex-direction: row; align-items: center; gap: 12px; }
.unpaid-cell-patient strong { color: #0f172a; font-size: 14px; }
.unpaid-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px;
  box-shadow: 0 1px 2px rgba(15,23,42,.08);
  flex-shrink: 0;
}

.unpaid-cell-doctor span,
.unpaid-cell-date span { color: #334155; font-size: 13px; }
.unpaid-cell-date span { font-variant-numeric: tabular-nums; }

.unpaid-cell-services .unpaid-svc {
  display: inline-flex; align-items: center; gap: 6px;
  color: #334155; font-size: 13px; min-width: 0;
}
.unpaid-cell-services .unpaid-svc > svg { color: #94a3b8; flex-shrink: 0; }
.unpaid-cell-services .unpaid-svc > span {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.unpaid-cell-services em { color: #94a3b8; font-style: normal; }
.unpaid-eye {
  background: transparent; border: none; cursor: pointer; color: #94a3b8;
  padding: 2px 4px; border-radius: 4px;
}
.unpaid-eye:hover { color: var(--brand); background: #eef2ff; }

.unpaid-cell-total,
.unpaid-cell-paid,
.unpaid-cell-remaining { align-items: flex-end; text-align: right; }
@media (max-width: 1100px) {
  .unpaid-cell-total, .unpaid-cell-paid, .unpaid-cell-remaining {
    align-items: flex-start; text-align: left;
  }
}

.unpaid-total-amount {
  color: #0f172a; font-weight: 700; font-size: 14px; font-variant-numeric: tabular-nums;
}
.unpaid-paid-amount {
  color: #0f766e; font-weight: 700; font-size: 13.5px; font-variant-numeric: tabular-nums;
}
.unpaid-paid-amount em { color: #94a3b8; font-style: normal; font-weight: 600; font-size: 11px; margin-left: 2px; }
.unpaid-paid-zero { color: #cbd5e1; font-weight: 600; }

.unpaid-remaining-amount {
  color: #b45309; font-weight: 700; font-size: 14.5px; font-variant-numeric: tabular-nums;
}
.unpaid-debt-amount {
  color: #dc2626; font-weight: 800; font-size: 14.5px; font-variant-numeric: tabular-nums;
}
.unpaid-overdue-tag {
  display: inline-block; background: #fef2f2; color: #b91c1c; font-style: normal;
  font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: .4px; margin-top: 2px;
}

.unpaid-patient-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.unpaid-progress {
  width: 100px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;
}
.unpaid-progress span {
  display: block; height: 100%; background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 2px;
}

.unpaid-cell-actions { flex-direction: row; gap: 6px; justify-content: flex-end; }
@media (max-width: 1100px) { .unpaid-cell-actions { justify-content: flex-start; flex-wrap: wrap; } }

.unpaid-btn-later {
  display: inline-flex; align-items: center; gap: 4px;
  background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;
  padding: 7px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 700;
  cursor: pointer;
}
.unpaid-btn-later:hover { background: #ffedd5; }

.unpaid-btn-pay {
  display: inline-flex; align-items: center; gap: 4px;
  background: linear-gradient(180deg,#3b82f6 0%,#2563eb 100%); color: #fff;
  border: none; padding: 7px 14px; border-radius: 8px;
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  box-shadow: 0 2px 6px rgba(37,99,235,.3);
}
.unpaid-btn-pay:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(37,99,235,.45); }

.unpaid-btn-debt {
  display: inline-flex; align-items: center; gap: 4px;
  background: linear-gradient(180deg,#f87171 0%,#ef4444 100%); color: #fff;
  border: none; padding: 8px 14px; border-radius: 8px;
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  box-shadow: 0 2px 6px rgba(239,68,68,.3);
}
.unpaid-btn-debt:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(239,68,68,.4); }

/* ---------- Hisoblashish period toolbar ---------- */
.hisob-head {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 10px 0 14px;
}

/* ---------- Pagination ---------- */
.cash-pagination {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px; border-top: 1px solid #e2e8f0; background: #f8fafc;
  font-size: 12.5px; color: #475569; flex-wrap: wrap;
}
.cash-page-size { display: inline-flex; align-items: center; gap: 6px; }
.cash-page-size span { font-weight: 600; }
.cash-page-size button {
  background: #fff; border: 1px solid #cbd5e1; color: #475569;
  padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.cash-page-size button.is-active { background: #2563eb; border-color: #2563eb; color: #fff; }
.cash-page-info { font-weight: 600; color: #334155; }
.cash-page-nav { display: inline-flex; align-items: center; gap: 6px; }
.cash-page-nav button {
  background: #fff; border: 1px solid #cbd5e1; color: #334155;
  width: 28px; height: 28px; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.cash-page-nav button:disabled { opacity: .4; cursor: not-allowed; }
.cash-page-nav button:not(:disabled):hover { background: #f1f5f9; }
.cash-page-nav span { margin: 0 6px; font-weight: 600; color: #0f172a; }

/* ---------- Chek (receipt) preview ---------- */
.chek-backdrop {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(15,23,42,.55); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.chek-center {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px;
  max-height: 95vh;
}
.chek-close {
  position: absolute; top: -8px; right: -8px; z-index: 2;
  width: 28px; height: 28px; border-radius: 50%;
  background: #0f172a; color: #fff; border: 2px solid #fff;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,.25);
}
.chek-print-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(180deg,#3b82f6,#2563eb); color: #fff;
  border: none; padding: 9px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 12px rgba(37,99,235,.35);
}
.chek-print-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37,99,235,.5); }

.chek {
  background: #fff; color: #0f172a;
  border-radius: 8px; padding: 14px 16px; box-sizing: border-box;
  width: 80mm; font-size: 10pt; line-height: 1.45;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  box-shadow: 0 20px 50px rgba(0,0,0,.3);
  max-height: 92vh; overflow: auto;
}
.chek-head { text-align: center; }
.chek-logo { display: block; margin: 0 auto 6px; max-width: 60%; max-height: 70px; object-fit: contain; }
.chek-clinic { font-weight: 900; letter-spacing: .14em; font-size: 15pt; color: #0f172a; }
.chek-clinic-sub { font-weight: 600; color: #334155; margin-top: 3px; }
.chek-clinic-meta { color: #64748b; margin-top: 2px; font-size: 9pt; }
.chek-divider { border-top: 1px dashed #94a3b8; margin: 7px 0; }
.chek-divider.double {
  border-top: 2px solid #0f172a; border-bottom: 1px dashed #94a3b8;
  height: 2px; margin: 8px 0; padding-top: 3px;
}
.chek-title {
  text-align: center; font-weight: 900; letter-spacing: .28em;
  color: #1e293b; margin: 3px 0; font-size: 11pt;
}
.chek-receipt-no { text-align: center; color: #64748b; font-size: 9pt; margin-bottom: 2px; }
.chek-rows { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.chek-rows > div { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.chek-rows dt { color: #64748b; margin: 0; }
.chek-rows dd { margin: 0; text-align: right; font-weight: 700; color: #0f172a; max-width: 58%; word-break: break-word; }
.chek-discount dd { color: #047857; }
.chek-total {
  display: flex; justify-content: space-between; align-items: center;
  font-weight: 900; margin: 6px 0;
  padding: 6px 2px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;
  font-size: 12pt;
}
.chek-total span { color: #1e293b; letter-spacing: .04em; }
.chek-total strong { color: #1e40af; font-size: 13pt; letter-spacing: .02em; }
.chek-promo {
  margin-top: 6px; border: 2px dashed #2563eb; border-radius: 8px;
  padding: 10px 8px; text-align: center;
  background: linear-gradient(135deg, #eff6ff, #e0e7ff);
}
.chek-promo-label { color: #2563eb; letter-spacing: .16em; font-weight: 800; font-size: 9pt; }
.chek-promo-code {
  font-weight: 900; font-size: 14pt; letter-spacing: .14em;
  color: #1e40af; margin: 4px 0; padding: 4px 0;
  border-top: 1px dashed #2563eb; border-bottom: 1px dashed #2563eb;
}
.chek-promo-meta { color: #475569; margin-top: 3px; font-size: 9pt; }
.chek-promo-meta strong { color: #059669; font-weight: 700; }
.chek-note { color: #475569; margin-top: 4px; font-style: italic; }
.chek-foot { text-align: center; margin-top: 4px; color: #475569; }
.chek-foot-thanks { font-weight: 800; color: #0f172a; letter-spacing: .08em; }
.chek-foot-note { margin-top: 3px; color: #64748b; font-size: 9pt; }
.chek-foot-meta { margin-top: 4px; font-weight: 600; color: #475569; font-size: 9pt; letter-spacing: .04em; }
.chek-foot-ts { margin-top: 6px; font-size: 8pt; color: #94a3b8; }
`;

/* ---------------- Payment modal styles ---------------- */
const paymentStyles = `
.pay-backdrop {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(15,23,42,.52); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
  animation: pay-fade .14s ease-out;
}
@keyframes pay-fade { from { opacity: 0 } to { opacity: 1 } }

.pay-modal {
  width: 100%; max-width: 860px; max-height: 92vh;
  background: #fff; border-radius: 18px; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 30px 80px rgba(15,23,42,.35);
  animation: pay-slide .18s cubic-bezier(.2,.9,.3,1);
}
@keyframes pay-slide { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.pay-head {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px; border-bottom: 1px solid #eef2f7;
  background: linear-gradient(180deg, #fafbff 0%, #fff 100%);
}
.pay-head-ico {
  width: 40px; height: 40px; border-radius: 12px;
  background: #eef2ff; color: #4f46e5;
  display: flex; align-items: center; justify-content: center;
}
.pay-head h2 { margin: 0; font-size: 17px; color: #0f172a; }
.pay-head p { margin: 2px 0 0; font-size: 12.5px; color: #64748b; }
.pay-close {
  margin-left: auto; width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid #e2e8f0; background: #fff; color: #475569; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.pay-close:hover { background: #f1f5f9; color: #0f172a; }

.pay-body {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 0;
  overflow: auto;
}
@media (max-width: 760px) { .pay-body { grid-template-columns: 1fr; } }

/* Form */
.pay-form { padding: 20px 20px 18px; display: flex; flex-direction: column; gap: 14px; }

.pay-field { display: flex; flex-direction: column; gap: 6px; position: relative; }
.pay-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; color: #334155;
  text-transform: uppercase; letter-spacing: .4px;
}
.pay-opt { color: #94a3b8; font-weight: 500; text-transform: none; font-size: 11px; letter-spacing: 0; }

/* Combobox (patient / service search) */
.pay-combo { position: relative; }
.pay-combo-input {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
  padding: 8px 10px; transition: all .12s;
}
.pay-combo-input:focus-within { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,.1); }
.pay-combo-ico { color: #94a3b8; }
.pay-combo-input input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; color: #0f172a;
}
.pay-clear {
  background: #f1f5f9; border: none; cursor: pointer; border-radius: 50%;
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
  color: #64748b;
}
.pay-clear:hover { background: #fee2e2; color: #dc2626; }

.pay-dropdown {
  position: absolute; left: 0; right: 0; top: calc(100% + 6px);
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15,23,42,.14);
  max-height: 280px; overflow: auto; z-index: 10;
  padding: 4px;
}
.pay-dropdown-backdrop { position: fixed; inset: 0; z-index: 5; }
.pay-dropdown-empty { padding: 16px; text-align: center; color: #94a3b8; font-size: 13px; }
.pay-dropdown-item {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: transparent; border: none; cursor: pointer;
  border-radius: 8px; text-align: left; font: inherit;
}
.pay-dropdown-item:hover { background: #f5f7ff; }
.pay-item-main { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pay-item-main strong { color: #0f172a; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pay-item-main small { color: #94a3b8; font-size: 11.5px; }
.pay-item-price { color: #4f46e5; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }

.pay-ava {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  color: #4338ca; font-weight: 800; font-size: 13px;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.pay-ava.sm { width: 36px; height: 36px; font-size: 14px; }
.pay-svc-ico {
  width: 32px; height: 32px; border-radius: 8px; background: #eef2ff; color: #4f46e5;
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* Select */
.pay-select-wrap {
  position: relative; display: flex; align-items: center;
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
}
.pay-select-wrap:focus-within { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,.1); }
.pay-select-wrap select {
  width: 100%; border: none; outline: none; background: transparent;
  padding: 10px 32px 10px 12px; font-size: 14px; color: #0f172a;
  appearance: none; -webkit-appearance: none; cursor: pointer;
}
.pay-select-chev { position: absolute; right: 10px; color: #94a3b8; pointer-events: none; }

/* Discount */
.pay-discount-row {
  display: grid; grid-template-columns: 1fr 100px 1fr; gap: 8px;
  align-items: center;
}
@media (max-width: 500px) { .pay-discount-row { grid-template-columns: 1fr; } }
.pay-money-input {
  display: flex; align-items: center;
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
  padding: 0 10px;
}
.pay-money-input:focus-within { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,.1); }
.pay-money-input input {
  flex: 1; border: none; outline: none; background: transparent;
  padding: 10px 4px; font-size: 14px; color: #0f172a; text-align: right;
  font-variant-numeric: tabular-nums;
}
.pay-money-input span { color: #94a3b8; font-size: 12px; font-weight: 600; }
.pay-pct-input input { text-align: center; }

.pay-quick-pct { display: flex; gap: 4px; }
.pay-quick {
  flex: 1; background: #f1f5f9; border: none; cursor: pointer; padding: 10px 6px;
  border-radius: 8px; font-size: 12px; font-weight: 700; color: #475569;
}
.pay-quick:hover { background: #e2e8f0; }
.pay-quick.is-active { background: #4f46e5; color: #fff; box-shadow: 0 1px 3px rgba(79,70,229,.3); }

/* Method */
.pay-method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.pay-method {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px;
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
  cursor: pointer; transition: all .14s;
  font: inherit;
}
.pay-method:hover { border-color: #cbd5e1; background: #fafbff; }
.pay-method.is-active { box-shadow: 0 2px 8px rgba(15,23,42,.06); }
.pay-method-ico {
  width: 30px; height: 30px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
}
.pay-method-name { font-size: 13.5px; font-weight: 600; color: #0f172a; }
.pay-method-check { margin-left: auto; }

/* Text input */
.pay-text-input {
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
  padding: 10px 12px; font-size: 14px; color: #0f172a; outline: none;
  transition: all .12s;
}
.pay-text-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79,70,229,.1); }

/* Summary */
.pay-summary {
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  border-left: 1px solid #eef2f7;
  padding: 20px; display: flex; flex-direction: column; gap: 14px;
}
@media (max-width: 760px) { .pay-summary { border-left: none; border-top: 1px solid #eef2f7; } }

.pay-summary-head small {
  color: #94a3b8; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .6px;
}

.pay-summary-rows {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.pay-sum-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13.5px; color: #475569; }
.pay-sum-row strong { color: #0f172a; font-variant-numeric: tabular-nums; }
.pay-sum-row em { color: #94a3b8; font-style: normal; font-size: 11px; }
.pay-discount-val { color: #dc2626 !important; }
.pay-sum-divider { height: 1px; background: #e5e7eb; }
.pay-sum-total { font-size: 15px; }
.pay-sum-total span { color: #0f172a; font-weight: 700; }
.pay-sum-total strong { color: #4f46e5; font-size: 22px; font-weight: 800; }

.pay-summary-chip {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px 12px;
}
.pay-summary-chip strong { display: block; color: #0f172a; font-size: 13.5px; }
.pay-summary-chip small { color: #94a3b8; font-size: 11.5px; }

.pay-submit-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px 16px; border-radius: 12px; border: none; cursor: pointer;
  background: linear-gradient(180deg, #5b52f0 0%, #4f46e5 100%);
  color: #fff; font-size: 14px; font-weight: 700;
  box-shadow: 0 4px 14px rgba(79,70,229,.35);
  transition: transform .08s ease, box-shadow .14s ease;
}
.pay-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(79,70,229,.45); }
.pay-submit-btn:disabled {
  background: #e2e8f0; color: #94a3b8; cursor: not-allowed; box-shadow: none;
}

.pay-cancel {
  background: transparent; border: none; cursor: pointer;
  color: #64748b; font-size: 13px; font-weight: 600; padding: 6px;
}
.pay-cancel:hover { color: #0f172a; }
`;

/* ---------------- Partial payment modal styles ---------------- */
const partialStyles = `
.pp-modal { max-width: 560px; }
.pp-body { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 14px; }

.pp-summary-chip {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px 12px;
}
.pp-summary-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pp-summary-main strong { color: #0f172a; font-size: 14px; }
.pp-summary-main small {
  color: #64748b; font-size: 11.5px;
  display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap;
}

.pp-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.pp-stat {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.pp-stat small {
  color: #94a3b8; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .4px;
}
.pp-stat strong {
  color: #0f172a; font-size: 15px; font-variant-numeric: tabular-nums;
}
.pp-stat-paid { background: #ecfdf5; border-color: #a7f3d0; }
.pp-stat-paid strong { color: #047857; }
.pp-stat-debt { background: #fef2f2; border-color: #fecaca; }
.pp-stat-debt strong { color: #b91c1c; }

.pp-progress { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.pp-progress-bar {
  position: relative; height: 10px; background: #f1f5f9; border-radius: 6px; overflow: hidden;
}
.pp-progress-prev {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: #10b981;
}
.pp-progress-now {
  position: absolute; top: 0; bottom: 0;
  background: repeating-linear-gradient(45deg, #4f46e5 0 6px, #6366f1 6px 12px);
}
.pp-progress-label {
  margin-top: 8px; font-size: 12.5px; color: #475569;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.pp-progress-label strong { color: #4f46e5; }
.pp-progress-label em { color: #b45309; font-style: normal; font-weight: 700; }
.pp-close-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: #ecfdf5; color: #047857; font-size: 11.5px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px; border: 1px solid #a7f3d0;
}

.pp-amount-row { display: flex; }
.pp-amount-input { flex: 1; }
.pp-amount-input input {
  font-size: 18px !important; font-weight: 700; color: #0f172a;
  padding: 12px 4px !important;
}

.pp-quick {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;
}
.pp-quick-btn {
  background: #f8fafc; border: 1px solid #e2e8f0; cursor: pointer;
  padding: 8px 6px; border-radius: 8px; color: #334155;
  font-size: 12px; font-weight: 700; text-align: center;
}
.pp-quick-btn em { display: block; color: #94a3b8; font-style: normal; font-weight: 500; font-size: 10.5px; margin-top: 2px; }
.pp-quick-btn:hover { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }
.pp-quick-btn.is-active {
  background: #4f46e5; border-color: #4f46e5; color: #fff;
  box-shadow: 0 2px 6px rgba(79,70,229,.3);
}
.pp-quick-btn.is-active em { color: rgba(255,255,255,.8); }

.pp-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding-top: 4px;
}
.pp-footer .pay-submit-btn { padding: 12px 18px; min-width: 200px; }
`;
