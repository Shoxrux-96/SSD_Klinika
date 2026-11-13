// Admin hisobotlar — 9 ta yo'nalish bo'yicha real-time hisobotlar.
// Diagrammalar: BarChart, LineChart, DonutChart, TopList.

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarCheck, Stethoscope, Users, TrendingUp, TrendingDown,
  FlaskConical, Wallet, PhoneCall, Package, FileBarChart, AlertCircle,
  Download, UserRound, ClipboardList, Pill, Receipt, Award,
} from 'lucide-react';
import { useAppointments, usePatients, useQueue, useEmployees, useServices } from '../store';
import { useTreatments, usePrescriptions, useLabTests } from '../clinicalData';
import { useDebts } from '../debtsStore';
import { exportCsv, todayStamp } from '../lib/exportCsv';
import { usePagination, TablePagination } from '../components/TablePagination';
import {
  BarChart, LineChart, DonutChart, TopList, bucketize, dashboardCss,
  fmtSom, type Period as ChartPeriod, type TopRow,
} from '../components/DashboardCharts';

type Tab =
  | 'overview' | 'patients' | 'appointments' | 'clinical' | 'laboratory'
  | 'finance' | 'staff' | 'callcenter' | 'inventory';

type Txn = {
  id: string;
  type: 'income' | 'expense' | string;
  amount: number;
  method: string;
  patientId?: string;
  serviceId?: string;
  employeeId?: string;
  description?: string;
  date: string;
  createdAt: number;
};

type CallTask = {
  id: string; patient: string; doctor?: string; reason: string;
  priority: string; dueDate: string; status: string;
  completedAt?: number; createdAt: number;
};

type Period = 'today' | 'week' | 'month' | 'year' | 'all';
const PERIOD_LABEL: Record<Period, string> = {
  today: 'Bugun', week: 'Shu hafta', month: 'Shu oy', year: 'Shu yil', all: 'Barcha davr',
};
function periodStart(p: Period): string {
  const d = new Date();
  if (p === 'all') return '0000-01-01';
  if (p === 'today') return d.toISOString().slice(0, 10);
  if (p === 'week') { const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); }
  else if (p === 'month') { d.setDate(1); }
  else { d.setMonth(0, 1); }
  return d.toISOString().slice(0, 10);
}
function periodStartMs(p: Period) { return new Date(periodStart(p)).getTime(); }

// Period → chart bucket perioda moslash
function chartPeriodFromReport(p: Period): ChartPeriod {
  if (p === 'today' || p === 'week') return 'day';
  if (p === 'year' || p === 'all') return 'year';
  return 'month';
}

export function AdminReports() {
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('month');

  const appts = useAppointments();
  const patients = usePatients();
  const queue = useQueue();
  const employees = useEmployees();
  const services = useServices();
  const treatments = useTreatments();
  const prescriptions = usePrescriptions();
  const labs = useLabTests();
  const debts = useDebts();

  const [txns, setTxns] = useState<Txn[]>([]);
  const [callTasks, setCallTasks] = useState<CallTask[]>([]);
  const [techOrders, setTechOrders] = useState<any[]>([]);
  const [techProducts, setTechProducts] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // Real-time refresh — har 15 soniyada API yangilanadi
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [t, c, to, tp] = await Promise.all([
          fetch('/api/transactions').then((r) => r.ok ? r.json() : []),
          fetch('/api/call-tasks').then((r) => r.ok ? r.json() : []),
          fetch('/api/tech-orders').then((r) => r.ok ? r.json() : []),
          fetch('/api/tech-products').then((r) => r.ok ? r.json() : []),
        ]);
        if (cancelled) return;
        setTxns(Array.isArray(t) ? t : []);
        setCallTasks(Array.isArray(c) ? c : []);
        setTechOrders(Array.isArray(to) ? to : []);
        setTechProducts(Array.isArray(tp) ? tp : []);
        setLastRefresh(Date.now());
      } catch {}
    };
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const from = periodStart(period);
  const fromMs = periodStartMs(period);
  const chartP = chartPeriodFromReport(period);

  return (
    <div className="admin-page">
      <style>{dashboardCss}</style>
      <style>{css}</style>

      <div className="admin-page-head">
        <div>
          <h1>Hisobotlar</h1>
          <p>
            Real-vaqt — <strong>{PERIOD_LABEL[period]}</strong> uchun · oxirgi yangilash: <code>{new Date(lastRefresh).toLocaleTimeString('uz-UZ')}</code>
            <span className="rep-live"><span className="rep-live-dot" /> Jonli</span>
          </p>
        </div>
        <div className="admin-page-actions">
          <select className="rep-period-select" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {(['today', 'week', 'month', 'year', 'all'] as Period[]).map((p) => (
              <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab'lar */}
      <div className="rep-tabs">
        {([
          ['overview',    'Umumiy',       FileBarChart],
          ['patients',    'Bemorlar',     UserRound],
          ['appointments','Qabullar',     CalendarCheck],
          ['clinical',    'Davolash',     Stethoscope],
          ['laboratory',  'Laboratoriya', FlaskConical],
          ['finance',     'Moliya',       Wallet],
          ['staff',       'Hodimlar',     Users],
          ['callcenter',  'Call-markaz',  PhoneCall],
          ['inventory',   'Inventar',     Package],
        ] as [Tab, string, typeof FileBarChart][]).map(([k, label, Icon]) => (
          <button key={k} className={`rep-tab ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewReport
          period={period} chartP={chartP} from={from} fromMs={fromMs}
          patients={patients} appts={appts} treatments={treatments} labs={labs}
          txns={txns} debts={debts} queue={queue} employees={employees}
        />
      )}
      {tab === 'patients' && <PatientsReport patients={patients} appts={appts} fromMs={fromMs} chartP={chartP} period={period} />}
      {tab === 'appointments' && <AppointmentsReport appts={appts} from={from} services={services} chartP={chartP} />}
      {tab === 'clinical' && <ClinicalReport treatments={treatments} prescriptions={prescriptions} from={from} chartP={chartP} />}
      {tab === 'laboratory' && <LaboratoryReport labs={labs} fromMs={fromMs} chartP={chartP} />}
      {tab === 'finance' && <FinanceReport txns={txns} debts={debts} fromMs={fromMs} chartP={chartP} period={period} />}
      {tab === 'staff' && <StaffReport employees={employees} treatments={treatments} from={from} />}
      {tab === 'callcenter' && <CallCenterReport tasks={callTasks} fromMs={fromMs} chartP={chartP} />}
      {tab === 'inventory' && <InventoryReport techProducts={techProducts} techOrders={techOrders} fromMs={fromMs} chartP={chartP} />}
    </div>
  );
}

/* ========== UMUMIY ========== */
function OverviewReport({ period, chartP, from, fromMs, patients, appts, treatments, labs, txns, debts, queue, employees }: any) {
  const periodAppts = appts.filter((a: any) => a.date >= from);
  const periodTreat = treatments.filter((t: any) => (t.date ?? '') >= from);
  const periodTxns = txns.filter((t: Txn) => t.createdAt >= fromMs);
  const periodLabs = labs.filter((l: any) => (l.docDate ?? '') >= from);
  const openDebts = debts.filter((d: any) => d.status === 'ochiq');

  const income = periodTxns.filter((t: Txn) => t.type === 'income').reduce((s: number, t: Txn) => s + t.amount, 0);
  const expense = periodTxns.filter((t: Txn) => t.type === 'expense').reduce((s: number, t: Txn) => s + t.amount, 0);
  const activeDocs = employees.filter((e: any) => e.category === 'medical' && !e.archived).length;

  const tiles = [
    { label: 'Jami bemorlar', value: patients.length, icon: UserRound, color: '#4f46e5' },
    { label: 'Qabullar (davr)', value: periodAppts.length, icon: CalendarCheck, color: '#059669' },
    { label: 'Davolashlar (davr)', value: periodTreat.length, icon: ClipboardList, color: '#9333ea' },
    { label: 'Tahlillar (davr)', value: periodLabs.length, icon: FlaskConical, color: '#ea580c' },
    { label: 'Daromad', value: fmtSom(income), icon: TrendingUp, color: '#10b981' },
    { label: 'Xarajat', value: fmtSom(expense), icon: TrendingDown, color: '#dc2626' },
    { label: 'Sof foyda', value: fmtSom(income - expense), icon: Wallet, color: income >= expense ? '#10b981' : '#dc2626' },
    { label: 'Ochiq qarzlar', value: `${openDebts.length} ta`, icon: AlertCircle, color: '#f59e0b' },
    { label: 'Faol navbat', value: queue.length, icon: Activity, color: '#0891b2' },
    { label: 'Faol shifokorlar', value: activeDocs, icon: Stethoscope, color: '#7c3aed' },
  ];

  // Chartlar
  const apptSeries = useMemo(() => bucketize(appts, (a: any) => a.date, () => 1, chartP), [appts, chartP]);
  const treatSeries = useMemo(() => bucketize(treatments, (t: any) => t.date, () => 1, chartP), [treatments, chartP]);
  const incomeSeries = useMemo(() => bucketize(txns.filter((t: Txn) => t.type === 'income'), (t: Txn) => t.createdAt, (t: Txn) => t.amount, chartP), [txns, chartP]);
  const expenseSeries = useMemo(() => bucketize(txns.filter((t: Txn) => t.type === 'expense'), (t: Txn) => t.createdAt, (t: Txn) => t.amount, chartP), [txns, chartP]);

  return (
    <>
      <div className="rep-tile-grid">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rep-tile">
              <div className="rep-tile-ico" style={{ background: `${t.color}15`, color: t.color }}>
                <Icon size={20} />
              </div>
              <div>
                <small>{t.label}</small>
                <strong style={{ color: t.color }}>{t.value}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Qabullar dinamikasi" sum={apptSeries.reduce((s: number, b: any) => s + b.value, 0) + ' ta'}>
          <BarChart data={apptSeries} color="#059669" />
        </ChartCard>
        <ChartCard title="Davolashlar dinamikasi" sum={treatSeries.reduce((s: number, b: any) => s + b.value, 0) + ' ta'}>
          <LineChart data={treatSeries} color="#9333ea" />
        </ChartCard>
        <ChartCard title="Daromad" sum={fmtSom(incomeSeries.reduce((s: number, b: any) => s + b.value, 0))}>
          <LineChart data={incomeSeries} color="#10b981" format={fmtSom} />
        </ChartCard>
        <ChartCard title="Xarajat" sum={fmtSom(expenseSeries.reduce((s: number, b: any) => s + b.value, 0))}>
          <BarChart data={expenseSeries} color="#db2777" format={fmtSom} />
        </ChartCard>
      </div>
    </>
  );
}

/* ========== BEMORLAR ========== */
function PatientsReport({ patients, appts, fromMs, chartP, period }: any) {
  const periodNew = patients.filter((p: any) => (p.addedAt ?? 0) >= fromMs);

  const genderDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const p of patients) {
      const g = (p.gender === 'male' || p.gender === 'erkak') ? 'Erkak'
              : (p.gender === 'female' || p.gender === 'ayol') ? 'Ayol' : "Noma'lum";
      m[g] = (m[g] ?? 0) + 1;
    }
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  }, [patients]);

  const regionDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const p of patients) m[p.region ?? "Noma'lum"] = (m[p.region ?? "Noma'lum"] ?? 0) + 1;
    const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    if (rows.length <= 8) return rows;
    const rest = rows.slice(7).reduce((s, r) => s + r.value, 0);
    return [...rows.slice(0, 7), { label: 'Boshqalar', value: rest }];
  }, [patients]);

  const newSeries = useMemo(() => bucketize(patients, (p: any) => p.addedAt, () => 1, chartP), [patients, chartP]);

  // Yosh guruhlari
  const ageGroups = useMemo<TopRow[]>(() => {
    const groups = { '0-18': 0, '19-30': 0, '31-45': 0, '46-60': 0, '60+': 0 } as Record<string, number>;
    const now = new Date().getFullYear();
    for (const p of patients) {
      if (!p.birthDate) continue;
      const y = Number((p.birthDate as string).slice(0, 4));
      if (!y) continue;
      const age = now - y;
      if (age <= 18) groups['0-18']++;
      else if (age <= 30) groups['19-30']++;
      else if (age <= 45) groups['31-45']++;
      else if (age <= 60) groups['46-60']++;
      else groups['60+']++;
    }
    return Object.entries(groups).map(([label, value]) => ({ label, value }));
  }, [patients]);

  const activeIds = useMemo(() => {
    const now = Date.now();
    const d30 = now - 30 * 24 * 3600 * 1000;
    const s = new Set<string>();
    for (const a of appts) {
      if (!a.patientId) continue;
      const t = new Date(a.date + 'T00:00:00').getTime();
      if (t >= d30) s.add(a.patientId);
    }
    return s;
  }, [appts]);

  const pg = usePagination(regionDonut, [patients.length]);

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Jami bemorlar</small><strong>{patients.length}</strong></div>
        <div className="rep-mini"><small>Yangi ({PERIOD_LABEL[period as Period]})</small><strong>{periodNew.length}</strong></div>
        <div className="rep-mini"><small>Faol (30 kun)</small><strong>{activeIds.size}</strong></div>
        <div className="rep-mini"><small>Uxlagan (dormant)</small><strong>{patients.length - activeIds.size}</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Yangi bemorlar dinamikasi" sum={newSeries.reduce((s: number, b: any) => s + b.value, 0) + ' ta'}>
          <LineChart data={newSeries} color="#0891b2" />
        </ChartCard>
        <ChartCard title="Jins taqsimoti" sum={`${patients.length} ta`}>
          <DonutChart rows={genderDonut} />
        </ChartCard>
        <ChartCard title="Yosh guruhlari" sum={`${patients.length} ta`}>
          <BarChart data={ageGroups.map((r) => ({ label: r.label, value: r.value }))} color="#7c3aed" />
        </ChartCard>
        <ChartCard title="Hudud taqsimoti" sum={`${regionDonut.length} ta`}>
          <DonutChart rows={regionDonut} />
        </ChartCard>
      </div>

      <section className="admin-card">
        <div className="rep-section-head">
          <h2><UserRound size={16} /> Hudud bo'yicha batafsil</h2>
          <button className="admin-btn admin-btn-ghost" onClick={() =>
            exportCsv(`bemorlar-${todayStamp()}`, patients, [
              { header: 'F.I.Sh.', get: (p: any) => p.fullName },
              { header: 'Telefon', get: (p: any) => p.phone },
              { header: 'Jins', get: (p: any) => p.gender ?? '' },
              { header: 'JSHSHIR', get: (p: any) => p.jshshir ?? '' },
              { header: 'Hudud', get: (p: any) => p.region ?? '' },
              { header: 'Tuman', get: (p: any) => p.district ?? '' },
            ])
          }><Download size={14} /> CSV</button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Hudud</th><th className="admin-cell-right">Bemorlar</th><th className="admin-cell-right">Ulush</th></tr></thead>
            <tbody>
              {pg.pageRows.map((r: TopRow) => (
                <tr key={r.label}>
                  <td><strong>{r.label}</strong></td>
                  <td className="admin-cell-right">{r.value}</td>
                  <td className="admin-cell-right admin-cell-muted">{(r.value / Math.max(1, patients.length) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>
    </>
  );
}

/* ========== QABULLAR ========== */
function AppointmentsReport({ appts, from, services, chartP }: any) {
  const inPeriod = appts.filter((a: any) => a.date >= from);

  const statusDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const a of inPeriod) m[a.status] = (m[a.status] ?? 0) + 1;
    const label: Record<string, string> = { kutilmoqda: 'Kutilmoqda', keldi: 'Keldi', bekor: 'Bekor', kelmadi: 'Kelmadi' };
    return Object.entries(m).map(([k, v]) => ({ label: label[k] ?? k, value: v }));
  }, [inPeriod]);

  const priceByName = useMemo(() => {
    const m = new Map<string, number>();
    services.forEach((s: any) => m.set(s.name, s.somValue ?? s.price));
    return m;
  }, [services]);

  const svcRows = useMemo<TopRow[]>(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    for (const a of inPeriod) {
      const cur = m[a.service] ?? { count: 0, revenue: 0 };
      if (a.status !== 'bekor' && a.status !== 'kelmadi') {
        cur.count++;
        cur.revenue += priceByName.get(a.service) ?? 0;
      }
      m[a.service] = cur;
    }
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.count} marta` }));
  }, [inPeriod, priceByName]);

  const dayBuckets = useMemo(() => bucketize(inPeriod, (a: any) => a.date, () => 1, chartP), [inPeriod, chartP]);
  const hourSeries = useMemo(() => {
    const h: Record<string, number> = {};
    for (const a of inPeriod) {
      const k = (a.time ?? '09:00').slice(0, 2);
      h[k] = (h[k] ?? 0) + 1;
    }
    return Object.entries(h).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label: label + ':00', value }));
  }, [inPeriod]);

  return (
    <>
      <div className="rep-chart-grid">
        <ChartCard title="Status taqsimoti" sum={`${inPeriod.length} ta`}>
          <DonutChart rows={statusDonut} />
        </ChartCard>
        <ChartCard title="Kunlik dinamika" sum={`${inPeriod.length} ta`}>
          <LineChart data={dayBuckets} color="#059669" />
        </ChartCard>
        <ChartCard title="Soat bo'yicha band vaqtlar" sum={`${inPeriod.length} ta`}>
          <BarChart data={hourSeries} color="#4f46e5" />
        </ChartCard>
        <ChartCard title="Top xizmatlar (daromad)" sum={fmtSom(svcRows.reduce((s: number, r: TopRow) => s + r.value, 0))}>
          <TopList rows={svcRows} color="#7c3aed" format={fmtSom} />
        </ChartCard>
      </div>

      <section className="admin-card">
        <div className="rep-section-head">
          <h2><CalendarCheck size={16} /> Qabul tarixi</h2>
          <button className="admin-btn admin-btn-ghost" onClick={() =>
            exportCsv(`qabullar-${todayStamp()}`, inPeriod, [
              { header: 'Sana', get: (a: any) => a.date },
              { header: 'Vaqt', get: (a: any) => a.time },
              { header: 'Bemor', get: (a: any) => a.patient },
              { header: 'Shifokor', get: (a: any) => a.doctor },
              { header: 'Xizmat', get: (a: any) => a.service },
              { header: 'Status', get: (a: any) => a.status },
            ])
          }><Download size={14} /> CSV</button>
        </div>
      </section>
    </>
  );
}

/* ========== DAVOLASH ========== */
function ClinicalReport({ treatments, prescriptions, from, chartP }: any) {
  const inPeriod = treatments.filter((t: any) => (t.date ?? '') >= from);

  const statusDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const t of inPeriod) m[t.status] = (m[t.status] ?? 0) + 1;
    return Object.entries(m).map(([k, v]) => ({ label: k, value: v }));
  }, [inPeriod]);

  const topDx = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const t of inPeriod) {
      const dx = (t.diagnosis ?? '').trim();
      if (dx) m[dx] = (m[dx] ?? 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [inPeriod]);

  const topDocs = useMemo<TopRow[]>(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    for (const t of inPeriod) {
      const d = t.doctor ?? '';
      const c = m[d] ?? { count: 0, revenue: 0 };
      c.count++;
      c.revenue += t.amount ?? 0;
      m[d] = c;
    }
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.count} ta` }));
  }, [inPeriod]);

  const revenueSeries = useMemo(() => bucketize(inPeriod, (t: any) => t.date, (t: any) => t.amount ?? 0, chartP), [inPeriod, chartP]);
  const countSeries = useMemo(() => bucketize(inPeriod, (t: any) => t.date, () => 1, chartP), [inPeriod, chartP]);

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Jami davolash</small><strong>{inPeriod.length}</strong></div>
        <div className="rep-mini"><small>Yakunlangan</small><strong style={{ color: '#059669' }}>{inPeriod.filter((t: any) => t.status === 'yakunlandi').length}</strong></div>
        <div className="rep-mini"><small>Davolanmoqda</small><strong style={{ color: '#ea580c' }}>{inPeriod.filter((t: any) => t.status === 'davolanmoqda').length}</strong></div>
        <div className="rep-mini"><small>Rejalashtirilgan</small><strong>{inPeriod.filter((t: any) => t.status === 'rejalashtirildi').length}</strong></div>
        <div className="rep-mini"><small>Retseptlar</small><strong>{prescriptions.length}</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Davolashlar soni" sum={`${inPeriod.length} ta`}>
          <LineChart data={countSeries} color="#9333ea" />
        </ChartCard>
        <ChartCard title="Davolash daromadi" sum={fmtSom(revenueSeries.reduce((s: number, b: any) => s + b.value, 0))}>
          <BarChart data={revenueSeries} color="#d97706" format={fmtSom} />
        </ChartCard>
        <ChartCard title="Status taqsimoti" sum={`${inPeriod.length} ta`}>
          <DonutChart rows={statusDonut} />
        </ChartCard>
        <ChartCard title="Top 10 tashxis" sum={`${topDx.length} ta`}>
          <TopList rows={topDx} color="#dc2626" />
        </ChartCard>
        <ChartCard title="Top shifokorlar (daromad)" sum={fmtSom(topDocs.reduce((s: number, r: TopRow) => s + r.value, 0))} wide>
          <TopList rows={topDocs} color="#10b981" format={fmtSom} />
        </ChartCard>
      </div>
    </>
  );
}

/* ========== LABORATORIYA ========== */
function LaboratoryReport({ labs, fromMs, chartP }: any) {
  const inPeriod = labs.filter((l: any) => (l.createdAt ?? 0) >= fromMs);

  const statusDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const l of inPeriod) m[l.status] = (m[l.status] ?? 0) + 1;
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  }, [inPeriod]);

  const topTypes = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const l of inPeriod) m[l.testType] = (m[l.testType] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [inPeriod]);

  const topLaborants = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const l of inPeriod) {
      const lab = l.laborant || l.labDoctor || '—';
      m[lab] = (m[lab] ?? 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }, [inPeriod]);

  const dailySeries = useMemo(() => bucketize(inPeriod, (l: any) => l.createdAt, () => 1, chartP), [inPeriod, chartP]);

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Jami tahlil</small><strong>{inPeriod.length}</strong></div>
        <div className="rep-mini"><small>Tayyor</small><strong style={{ color: '#059669' }}>{inPeriod.filter((l: any) => l.status === 'tayyor').length}</strong></div>
        <div className="rep-mini"><small>Jarayonda</small><strong style={{ color: '#ea580c' }}>{inPeriod.filter((l: any) => l.status === 'jarayonda').length}</strong></div>
        <div className="rep-mini"><small>Kutilmoqda</small><strong>{inPeriod.filter((l: any) => l.status === 'kutilmoqda').length}</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Tahlillar dinamikasi" sum={`${inPeriod.length} ta`}>
          <LineChart data={dailySeries} color="#ea580c" />
        </ChartCard>
        <ChartCard title="Status taqsimoti" sum={`${inPeriod.length} ta`}>
          <DonutChart rows={statusDonut} />
        </ChartCard>
        <ChartCard title="Top 10 tahlil turi" sum={`${topTypes.length} ta`}>
          <TopList rows={topTypes} color="#9333ea" />
        </ChartCard>
        <ChartCard title="Laborantlar reytingi" sum={`${topLaborants.length} ta`}>
          <TopList rows={topLaborants} color="#0891b2" />
        </ChartCard>
      </div>
    </>
  );
}

/* ========== MOLIYA ========== */
function FinanceReport({ txns, debts, fromMs, chartP, period }: any) {
  const inPeriod = txns.filter((t: Txn) => t.createdAt >= fromMs);
  const income = inPeriod.filter((t: Txn) => t.type === 'income');
  const expense = inPeriod.filter((t: Txn) => t.type === 'expense');
  const incomeTotal = income.reduce((s: number, t: Txn) => s + t.amount, 0);
  const expenseTotal = expense.reduce((s: number, t: Txn) => s + t.amount, 0);

  const methodDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const t of income) m[t.method ?? 'naqd'] = (m[t.method ?? 'naqd'] ?? 0) + t.amount;
    const label: Record<string, string> = { naqd: 'Naqd', karta: 'Plastik karta', transfer: 'Bank o\'tkazma' };
    return Object.entries(m).map(([k, v]) => ({ label: label[k] ?? k, value: v }));
  }, [income]);

  const incomeSeries = useMemo(() => bucketize(income, (t: Txn) => t.createdAt, (t: Txn) => t.amount, chartP), [income, chartP]);
  const expenseSeries = useMemo(() => bucketize(expense, (t: Txn) => t.createdAt, (t: Txn) => t.amount, chartP), [expense, chartP]);
  const profitSeries = useMemo(() => {
    return incomeSeries.map((b: any, i: number) => ({ label: b.label, value: b.value - (expenseSeries[i]?.value ?? 0) }));
  }, [incomeSeries, expenseSeries]);

  const openDebts = debts.filter((d: any) => d.status === 'ochiq');
  const totalOpen = openDebts.reduce((s: number, d: any) => s + d.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = openDebts.filter((d: any) => d.dueDate && d.dueDate < today);
  const paid = debts.filter((d: any) => d.status === "to'landi");

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Daromad ({PERIOD_LABEL[period as Period]})</small><strong style={{ color: '#059669' }}>{fmtSom(incomeTotal)}</strong></div>
        <div className="rep-mini"><small>Xarajat</small><strong style={{ color: '#dc2626' }}>{fmtSom(expenseTotal)}</strong></div>
        <div className="rep-mini"><small>Sof foyda</small><strong style={{ color: incomeTotal >= expenseTotal ? '#059669' : '#dc2626' }}>{fmtSom(incomeTotal - expenseTotal)}</strong></div>
        <div className="rep-mini"><small>Tranzaksiya</small><strong>{inPeriod.length}</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Daromad dinamikasi" sum={fmtSom(incomeTotal)}>
          <LineChart data={incomeSeries} color="#10b981" format={fmtSom} />
        </ChartCard>
        <ChartCard title="Xarajat dinamikasi" sum={fmtSom(expenseTotal)}>
          <BarChart data={expenseSeries} color="#db2777" format={fmtSom} />
        </ChartCard>
        <ChartCard title="Sof foyda" sum={fmtSom(incomeTotal - expenseTotal)}>
          <LineChart data={profitSeries} color="#4f46e5" format={fmtSom} />
        </ChartCard>
        <ChartCard title="To'lov usullari" sum={fmtSom(incomeTotal)}>
          <DonutChart rows={methodDonut} format={fmtSom} />
        </ChartCard>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 10 }}>Qarzdorlar</h3>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Ochiq qarzlar</small><strong>{openDebts.length}</strong></div>
        <div className="rep-mini"><small>Ochiq summa</small><strong style={{ color: '#f59e0b' }}>{fmtSom(totalOpen)}</strong></div>
        <div className="rep-mini"><small>Muddati o'tgan</small><strong style={{ color: '#dc2626' }}>{overdue.length}</strong></div>
        <div className="rep-mini"><small>To'langan</small><strong style={{ color: '#059669' }}>{paid.length}</strong></div>
      </div>
    </>
  );
}

/* ========== HODIMLAR ========== */
function StaffReport({ employees, treatments, from }: any) {
  const inPeriod = treatments.filter((t: any) => (t.date ?? '') >= from);
  const activeMedical = employees.filter((e: any) => e.category === 'medical' && !e.archived);
  const activeService = employees.filter((e: any) => e.category === 'service' && !e.archived);
  const archived = employees.filter((e: any) => e.archived);

  const perfMap: Record<string, { count: number; done: number; revenue: number }> = {};
  for (const t of inPeriod) {
    const d = t.doctor ?? '';
    const c = perfMap[d] ?? { count: 0, done: 0, revenue: 0 };
    c.count++;
    if (t.status === 'yakunlandi') c.done++;
    c.revenue += t.amount ?? 0;
    perfMap[d] = c;
  }
  const perfRows = activeMedical.map((e: any) => {
    const p = perfMap[e.fullName] ?? { count: 0, done: 0, revenue: 0 };
    return { name: e.fullName, position: e.position, ...p, eff: p.count > 0 ? (p.done / p.count * 100).toFixed(0) : '0' };
  }).sort((a: any, b: any) => b.count - a.count);

  const topByCount = perfRows.slice(0, 10).map((r: any) => ({ label: r.name, value: r.count, sub: `${r.done} yakun` }));
  const topByRevenue = perfRows.slice(0, 10).map((r: any) => ({ label: r.name, value: r.revenue })).sort((a: any, b: any) => b.value - a.value).slice(0, 10);

  const categoryDonut: TopRow[] = [
    { label: 'Tibbiy', value: activeMedical.length },
    { label: 'Xizmat', value: activeService.length },
    { label: 'Arxiv', value: archived.length },
  ];

  const pg = usePagination(perfRows, [inPeriod.length]);

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Tibbiy hodim</small><strong>{activeMedical.length}</strong></div>
        <div className="rep-mini"><small>Xizmat hodimi</small><strong>{activeService.length}</strong></div>
        <div className="rep-mini"><small>Arxivda</small><strong>{archived.length}</strong></div>
        <div className="rep-mini"><small>Jami</small><strong>{employees.length}</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Hodim toifalari" sum={`${employees.length} ta`}>
          <DonutChart rows={categoryDonut} />
        </ChartCard>
        <ChartCard title="Top shifokorlar (soni)" sum={`${topByCount.reduce((s: number, r: TopRow) => s + r.value, 0)} ta`}>
          <TopList rows={topByCount} color="#059669" />
        </ChartCard>
        <ChartCard title="Top shifokorlar (daromad)" sum={fmtSom(topByRevenue.reduce((s: number, r: TopRow) => s + r.value, 0))} wide>
          <TopList rows={topByRevenue} color="#10b981" format={fmtSom} />
        </ChartCard>
      </div>

      <section className="admin-card">
        <div className="rep-section-head">
          <h2><Award size={16} /> Shifokorlar samaradorligi</h2>
          <button className="admin-btn admin-btn-ghost" onClick={() =>
            exportCsv(`hodimlar-${todayStamp()}`, perfRows, [
              { header: 'F.I.Sh.', get: (r: any) => r.name },
              { header: 'Lavozim', get: (r: any) => r.position },
              { header: 'Davolash', get: (r: any) => r.count },
              { header: 'Yakunlangan', get: (r: any) => r.done },
              { header: 'Samaradorlik (%)', get: (r: any) => r.eff },
              { header: 'Daromad', get: (r: any) => r.revenue },
            ])
          }><Download size={14} /> CSV</button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>F.I.Sh.</th><th>Lavozim</th><th className="admin-cell-right">Davolash</th><th className="admin-cell-right">Yakun</th><th className="admin-cell-right">%</th><th className="admin-cell-right">Daromad</th></tr></thead>
            <tbody>
              {pg.pageRows.map((r: any) => (
                <tr key={r.name}>
                  <td><strong>{r.name}</strong></td>
                  <td className="admin-cell-muted">{r.position}</td>
                  <td className="admin-cell-right">{r.count}</td>
                  <td className="admin-cell-right">{r.done}</td>
                  <td className="admin-cell-right"><strong>{r.eff}%</strong></td>
                  <td className="admin-cell-right">{fmtSom(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>
    </>
  );
}

/* ========== CALL-MARKAZ ========== */
function CallCenterReport({ tasks, fromMs, chartP }: any) {
  const inPeriod = tasks.filter((t: CallTask) => (t.createdAt ?? 0) >= fromMs);

  const statusDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const t of inPeriod) m[t.status] = (m[t.status] ?? 0) + 1;
    const label: Record<string, string> = { kutilmoqda: 'Kutilmoqda', bajarildi: 'Bajarildi', bekor: 'Bekor' };
    return Object.entries(m).map(([k, v]) => ({ label: label[k] ?? k, value: v }));
  }, [inPeriod]);

  const priorityDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const t of inPeriod) m[t.priority] = (m[t.priority] ?? 0) + 1;
    const label: Record<string, string> = { shoshilinch: 'Shoshilinch', muhim: 'Muhim', oddiy: 'Oddiy' };
    return Object.entries(m).map(([k, v]) => ({ label: label[k] ?? k, value: v }));
  }, [inPeriod]);

  const dailySeries = useMemo(() => bucketize(inPeriod, (t: CallTask) => t.createdAt, () => 1, chartP), [inPeriod, chartP]);

  const done = inPeriod.filter((t: CallTask) => t.status === 'bajarildi').length;
  const rate = inPeriod.length > 0 ? (done / inPeriod.length * 100).toFixed(1) : '0';

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Jami vazifa</small><strong>{inPeriod.length}</strong></div>
        <div className="rep-mini"><small>Bajarildi</small><strong style={{ color: '#059669' }}>{done}</strong></div>
        <div className="rep-mini"><small>Muvaffaqiyat</small><strong>{rate}%</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Status" sum={`${inPeriod.length} ta`}>
          <DonutChart rows={statusDonut} />
        </ChartCard>
        <ChartCard title="Muhimlik" sum={`${inPeriod.length} ta`}>
          <DonutChart rows={priorityDonut} />
        </ChartCard>
        <ChartCard title="Vazifalar dinamikasi" sum={`${inPeriod.length} ta`} wide>
          <BarChart data={dailySeries} color="#ec4899" />
        </ChartCard>
      </div>
    </>
  );
}

/* ========== INVENTAR ========== */
function InventoryReport({ techProducts, techOrders, fromMs, chartP }: any) {
  const inPeriod = techOrders.filter((o: any) => (o.createdAt ?? 0) >= fromMs);
  const totalProducts = techProducts.length;
  const lowStock = techProducts.filter((p: any) => (p.qty ?? 0) < 5);
  const totalStockValue = techProducts.reduce((s: number, p: any) => s + (Number(p.qty) || 0) * (Number(p.costPrice) || 0), 0);
  const totalRetailValue = techProducts.reduce((s: number, p: any) => s + (Number(p.qty) || 0) * (Number(p.salePrice) || 0), 0);

  const statusDonut = useMemo<TopRow[]>(() => {
    const m: Record<string, number> = {};
    for (const o of inPeriod) m[o.status ?? 'buyurtmada'] = (m[o.status ?? 'buyurtmada'] ?? 0) + 1;
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  }, [inPeriod]);

  const topProducts = useMemo<TopRow[]>(() => {
    const m: Record<string, { qty: number; revenue: number }> = {};
    for (const o of inPeriod) {
      const c = m[o.productName] ?? { qty: 0, revenue: 0 };
      c.qty += Number(o.qty) || 0;
      c.revenue += Number(o.totalAmount) || 0;
      m[o.productName] = c;
    }
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.qty} dona` }));
  }, [inPeriod]);

  const dailySeries = useMemo(() => bucketize(inPeriod, (o: any) => o.createdAt, (o: any) => Number(o.totalAmount) || 0, chartP), [inPeriod, chartP]);

  return (
    <>
      <div className="rep-mini-grid">
        <div className="rep-mini"><small>Katalog mahsulotlari</small><strong>{totalProducts}</strong></div>
        <div className="rep-mini"><small>Kam zaxira (&lt;5)</small><strong style={{ color: lowStock.length > 0 ? '#dc2626' : '#059669' }}>{lowStock.length}</strong></div>
        <div className="rep-mini"><small>Tannarx qiymati</small><strong>{fmtSom(totalStockValue)}</strong></div>
        <div className="rep-mini"><small>Chakana qiymati</small><strong style={{ color: '#059669' }}>{fmtSom(totalRetailValue)}</strong></div>
        <div className="rep-mini"><small>Buyurtmalar (davr)</small><strong>{inPeriod.length}</strong></div>
      </div>

      <div className="rep-chart-grid">
        <ChartCard title="Buyurtma daromadi" sum={fmtSom(dailySeries.reduce((s: number, b: any) => s + b.value, 0))}>
          <LineChart data={dailySeries} color="#7c2d12" format={fmtSom} />
        </ChartCard>
        <ChartCard title="Buyurtma holati" sum={`${inPeriod.length} ta`}>
          <DonutChart rows={statusDonut} />
        </ChartCard>
        <ChartCard title="Top mahsulotlar (daromad)" sum={fmtSom(topProducts.reduce((s: number, r: TopRow) => s + r.value, 0))} wide>
          <TopList rows={topProducts} color="#7c2d12" format={fmtSom} />
        </ChartCard>
      </div>

      {lowStock.length > 0 && (
        <section className="admin-card">
          <div className="rep-section-head">
            <h2><Package size={16} /> Zaxirasi kam mahsulotlar</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Mahsulot</th><th className="admin-cell-right">Qolgan</th><th className="admin-cell-right">Chakana narx</th></tr></thead>
              <tbody>
                {lowStock.map((p: any) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td className="admin-cell-right"><span style={{ color: '#dc2626', fontWeight: 700 }}>{p.qty}</span></td>
                    <td className="admin-cell-right">{fmtSom(p.salePrice ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/* ========== Chart Card wrapper ========== */
function ChartCard({ title, sum, wide, children }: { title: string; sum: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`dc-panel ${wide ? 'rep-chart-wide' : ''}`}>
      <div className="dc-panel-head">
        <h4>{title}</h4>
        <small>{sum}</small>
      </div>
      {children}
    </div>
  );
}

const css = `
.rep-live {
  display: inline-flex; align-items: center; gap: 5px; margin-left: 10px;
  padding: 3px 9px; border-radius: 10px; font-size: 11px;
  background: #d1fae5; color: #065f46; font-weight: 700;
}
.rep-live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,.25);
  animation: rep-pulse 1.4s ease-in-out infinite;
}
@keyframes rep-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(1.3); } }

.rep-period-select {
  padding: 9px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; background: #fff; font-weight: 600; color: #0f172a; cursor: pointer;
}

.rep-tabs {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px;
  background: #fff; padding: 8px; border-radius: 12px; border: 1px solid #e2e8f0;
}
.rep-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: 0; background: transparent;
  font-size: 13px; font-weight: 600; color: #64748b;
  border-radius: 8px; cursor: pointer; transition: all .15s;
}
.rep-tab:hover { background: #f1f5f9; color: #0f172a; }
.rep-tab.is-active {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff; box-shadow: 0 4px 12px -4px rgba(79, 70, 229, .4);
}

.rep-tile-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
  margin-bottom: 20px;
}
.rep-tile {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 16px; display: flex; gap: 12px; align-items: center;
  transition: transform .12s, box-shadow .12s;
}
.rep-tile:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -10px rgba(15,23,42,.15); }
.rep-tile-ico {
  width: 44px; height: 44px; border-radius: 10px;
  display: grid; place-items: center; flex-shrink: 0;
}
.rep-tile small { display: block; color: #64748b; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.rep-tile strong { display: block; font-size: 18px; margin-top: 4px; font-variant-numeric: tabular-nums; }

/* Chartlar grid — 2 ustun, keng chart 1 to -1 */
.rep-chart-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
  margin-bottom: 18px;
}
.rep-chart-wide { grid-column: 1 / -1; }
@media (max-width: 900px) { .rep-chart-grid { grid-template-columns: 1fr; } .rep-chart-wide { grid-column: auto; } }

.rep-mini-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px; }
.rep-mini {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 12px 14px;
}
.rep-mini small { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }
.rep-mini strong { display: block; font-size: 18px; margin-top: 4px; color: #0f172a; font-variant-numeric: tabular-nums; }

.rep-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.rep-section-head h2 { margin: 0; display: inline-flex; align-items: center; gap: 8px; font-size: 16px; color: #0f172a; }
`;
