import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarCheck, DollarSign, Stethoscope, Users, TrendingUp, TrendingDown,
  Receipt, ClipboardList, FlaskConical, PiggyBank,
} from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtSom, fmtNumber,
  TopList, DonutChart, type TopRow,
} from '../components/DashboardCharts';
import { Award, Microscope, PackageOpen } from 'lucide-react';
import {
  useAppointments, usePatients, useQueue, useEmployees, useServices,
} from '../store';
import { useTreatments } from '../clinicalData';

type Txn = { id: string; type: 'income' | 'expense' | string; amount: number; createdAt: number };

export function AdminOverview() {
  const appts = useAppointments();
  const patients = usePatients();
  const queue = useQueue();
  const employees = useEmployees();
  const services = useServices();
  const treatments = useTreatments();
  const [txns, setTxns] = useState<Txn[]>([]);
  const { period, setPeriod } = usePeriod('month');

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => setTxns(Array.isArray(rows) ? rows : []))
      .catch(() => setTxns([]));
  }, []);

  const incomes = useMemo(() => txns.filter((t) => t.type === 'income'), [txns]);
  const expenses = useMemo(() => txns.filter((t) => t.type === 'expense'), [txns]);

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter((a) => a.date === today).length;
  const activeDoctors = employees.filter((e) => e.category === 'medical' && !e.archived).length;
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const profit = totalIncome - totalExpense;
  const doneTreatments = treatments.filter((t) => t.status === 'yakunlandi').length;

  const apptSeries = useMemo(() => bucketize(appts, (a) => a.date, () => 1, period), [appts, period]);
  const patientSeries = useMemo(() => bucketize(patients, (p) => p.addedAt, () => 1, period), [patients, period]);
  const incomeSeries = useMemo(() => bucketize(incomes, (t) => t.createdAt, (t) => t.amount || 0, period), [incomes, period]);
  const expenseSeries = useMemo(() => bucketize(expenses, (t) => t.createdAt, (t) => t.amount || 0, period), [expenses, period]);
  const treatmentSeries = useMemo(() => bucketize(treatments, (t) => t.date, () => 1, period), [treatments, period]);
  const treatmentAmtSeries = useMemo(() => bucketize(treatments, (t) => t.date, (t) => t.amount ?? 0, period), [treatments, period]);

  const isLabName = (name?: string) => !!name && /lab|tahlil|analiz|anali[zs]/i.test(name);

  // --- Top services (by revenue and by count) ---
  const topServices = useMemo<TopRow[]>(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const t of treatments) {
      const name = t.service ?? (t.services?.[0] ?? '—');
      if (!name) continue;
      const cur = map.get(name) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += t.amount ?? 0;
      map.set(name, cur);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.count} marta` }));
  }, [treatments]);

  const topServicesByCount = useMemo<TopRow[]>(() => {
    const map = new Map<string, number>();
    for (const t of treatments) {
      const name = t.service ?? (t.services?.[0] ?? '—');
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }, [treatments]);

  // --- Top doctors (shifokorlar) ---
  const topDoctors = useMemo<TopRow[]>(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const t of treatments) {
      if (!t.doctor) continue;
      if (isLabName(t.service)) continue; // exclude lab services
      const cur = map.get(t.doctor) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += t.amount ?? 0;
      map.set(t.doctor, cur);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.count} ta bemor` }));
  }, [treatments]);

  // --- Top laborants (laboratoriya xizmatlarini bajargan shifokorlar/laborantlar) ---
  const topLaborants = useMemo<TopRow[]>(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const t of treatments) {
      if (!isLabName(t.service)) continue;
      const key = t.doctor || '—';
      const cur = map.get(key) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += t.amount ?? 0;
      map.set(key, cur);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.count} ta tahlil` }));
  }, [treatments]);

  // --- Service revenue donut (top 9 + others) ---
  const serviceDonut = useMemo<TopRow[]>(() => {
    if (!topServices.length) return [];
    if (topServices.length <= 10) return topServices;
    const rest = topServices.slice(9).reduce((s, r) => s + r.value, 0);
    return [...topServices.slice(0, 9), { label: 'Boshqalar', value: rest }];
  }, [topServices]);

  return (
    <section className="admin-page">
      <style>{dashboardCss}</style>
      <div className="admin-page-head">
        <div>
          <h1>Boshqaruv paneli</h1>
          <p>Klinikaning real vaqtdagi ko‘rsatkichlari</p>
        </div>
      </div>

      <div className="dc-tiles">
        <StatTile tone="primary" icon={<CalendarCheck size={16} />} label="Bugungi qabullar" value={todayAppts} hint={today} />
        <StatTile tone="violet" icon={<Users size={16} />} label="Jami bemorlar" value={fmtNumber(patients.length)} hint="bazada" />
        <StatTile tone="cyan" icon={<Stethoscope size={16} />} label="Faol shifokorlar" value={activeDoctors} hint="tibbiy hodim" />
        <StatTile tone="ok" icon={<DollarSign size={16} />} label="Jami daromad" value={fmtSom(totalIncome)} hint="barcha davr" />
        <StatTile tone="rose" icon={<TrendingDown size={16} />} label="Xarajat" value={fmtSom(totalExpense)} hint="barcha davr" />
        <StatTile tone="warn" icon={<PiggyBank size={16} />} label="Sof foyda" value={fmtSom(profit)} hint={profit >= 0 ? 'ijobiy' : 'salbiy'} />
        <StatTile tone="primary" icon={<ClipboardList size={16} />} label="Yakunlangan davolash" value={fmtNumber(doneTreatments)} hint={`jami ${treatments.length}`} />
        <StatTile tone="rose" icon={<Activity size={16} />} label="Faol navbat" value={queue.length} hint="hozir" />
        <StatTile tone="violet" icon={<FlaskConical size={16} />} label="Xizmatlar" value={services.filter((s) => !s.archived).length} hint="faol" />
        <StatTile tone="cyan" icon={<Receipt size={16} />} label="Tranzaksiya" value={fmtNumber(txns.length)} hint="jami" />
      </div>

      <div className="dc-period-head">
        <div>
          <h3>Davriy ko‘rsatkichlar</h3>
          <p>Kunlik — oxirgi 7 kun · Oylik — oxirgi 12 oy · Yillik — oxirgi 5 yil</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className="dc-grid">
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><TrendingUp size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Daromad</h4>
            <small>{fmtSom(incomeSeries.reduce((s, b) => s + b.value, 0))}</small>
          </div>
          <LineChart data={incomeSeries} color="#10b981" format={fmtSom} />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><TrendingDown size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Xarajat</h4>
            <small>{fmtSom(expenseSeries.reduce((s, b) => s + b.value, 0))}</small>
          </div>
          <BarChart data={expenseSeries} color="#db2777" format={fmtSom} />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><CalendarCheck size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Qabullar</h4>
            <small>{apptSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <BarChart data={apptSeries} color="#4f46e5" />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><Users size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Yangi bemorlar</h4>
            <small>{patientSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <LineChart data={patientSeries} color="#0891b2" />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><ClipboardList size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Davolash soni</h4>
            <small>{treatmentSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <BarChart data={treatmentSeries} color="#7c3aed" />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><DollarSign size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Davolash daromadi</h4>
            <small>{fmtSom(treatmentAmtSeries.reduce((s, b) => s + b.value, 0))}</small>
          </div>
          <LineChart data={treatmentAmtSeries} color="#d97706" format={fmtSom} />
        </div>
      </div>

      <div className="dc-period-head" style={{ marginTop: 28 }}>
        <div>
          <h3>Top ko‘rsatkichlar</h3>
          <p>Eng daromadli xizmatlar, shifokorlar va laborantlar reytingi — kamida 10 element</p>
        </div>
      </div>

      <div className="dc-top-grid">
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><PackageOpen size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Top xizmatlar — daromad</h4>
            <small>{topServices.length} ta</small>
          </div>
          <TopList rows={topServices} color="#4f46e5" format={fmtSom} />
        </div>

        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><Receipt size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Top xizmatlar — soni</h4>
            <small>{topServicesByCount.reduce((s, r) => s + r.value, 0)} ta</small>
          </div>
          <TopList rows={topServicesByCount} color="#7c3aed" format={(v) => `${v} marta`} />
        </div>

        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><Award size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Top shifokorlar</h4>
            <small>{topDoctors.length} ta</small>
          </div>
          <TopList rows={topDoctors} color="#10b981" format={fmtSom} />
        </div>

        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><Microscope size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Top laborantlar</h4>
            <small>{topLaborants.length} ta</small>
          </div>
          <TopList rows={topLaborants} color="#0891b2" format={fmtSom} />
        </div>

        <div className="dc-panel dc-top-full">
          <div className="dc-panel-head">
            <h4><DollarSign size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Xizmatlar bo‘yicha daromad ulushi</h4>
            <small>{fmtSom(serviceDonut.reduce((s, r) => s + r.value, 0))}</small>
          </div>
          <DonutChart rows={serviceDonut} format={fmtSom} />
        </div>
      </div>

      <style>{`
        .dc-top-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .dc-top-full { grid-column: 1 / -1; }
        @media (max-width: 900px) { .dc-top-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
