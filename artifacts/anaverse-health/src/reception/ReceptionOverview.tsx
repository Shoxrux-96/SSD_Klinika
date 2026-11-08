import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePatients, useAppointments, useQueue } from '../admin/store';
import { useTreatments } from '../admin/clinicalData';
import { useDebts } from '../admin/debtsStore';
import {
  CalendarCheck, Users, PhoneCall, ListOrdered, TrendingUp, UserPlus, FileText, AlertCircle,
} from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtNumber, fmtSom,
} from '../admin/components/DashboardCharts';

// Tanlangan davr uchun ko'rsatma.
function periodLabelOf(period: 'day' | 'month' | 'year'): string {
  if (period === 'day') return 'oxirgi 7 kun';
  if (period === 'month') return 'oxirgi 12 oy';
  return 'oxirgi 5 yil';
}
function periodFromISO(period: 'day' | 'month' | 'year'): string {
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  const back = period === 'day' ? 7 * DAY : period === 'month' ? 365 * DAY : 5 * 365 * DAY;
  return new Date(now.getTime() - back).toISOString().slice(0, 10);
}

export function ReceptionOverview() {
  const { user } = useAuth();
  const patients = usePatients();
  const appts = useAppointments();
  const queue = useQueue();
  const treatments = useTreatments();
  const debts = useDebts();
  const { period, setPeriod } = usePeriod('month');

  const periodLabel = periodLabelOf(period);
  const periodFrom = periodFromISO(period);

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter((a) => a.date === today).length;
  const currentMonth = today.slice(0, 7);
  const monthAppts = appts.filter((a) => a.date.startsWith(currentMonth)).length;
  const periodNewPatients = patients.filter((p) => {
    const d = p.addedAt ? new Date(p.addedAt).toISOString().slice(0, 10) : '';
    return d >= periodFrom;
  }).length;
  const comeCount = appts.filter((a) => a.status === 'keldi' && a.date >= periodFrom).length;

  // Qoralama davolashlar — qabuldan avtomatik yaratilganlar, hali shifokor bajarmagan
  const draftTreatments = useMemo(
    () => treatments.filter((t) => t.status === 'rejalashtirildi' && (t.date ?? '') === today),
    [treatments, today],
  );

  // Ochiq qarzlar (registrator qarz bo'yicha qayta murojaat haqida xabar beradi)
  const openDebts = useMemo(() => debts.filter((d) => d.status === 'ochiq'), [debts]);
  const openDebtTotal = openDebts.reduce((s, d) => s + (d.amount ?? 0), 0);

  const apptSeries = useMemo(
    () => bucketize(appts, (a) => a.date, () => 1, period),
    [appts, period],
  );
  const patientSeries = useMemo(
    () => bucketize(patients, (p) => p.addedAt, () => 1, period),
    [patients, period],
  );

  return (
    <section className="admin-page">
      <style>{dashboardCss}</style>
      <div className="admin-page-head">
        <div>
          <h1>Salom, {user?.fullName}</h1>
          <p>Qabulxona faoliyati va davriy ko‘rsatkichlar</p>
        </div>
      </div>

      <div className="dc-tiles">
        <StatTile tone="primary" icon={<CalendarCheck size={16} />} label="Bugungi qabullar" value={todayAppts} hint="rejada" />
        <StatTile tone="ok" icon={<Users size={16} />} label="Kelgan bemorlar" value={comeCount} hint={periodLabel} />
        <StatTile tone="violet" icon={<UserPlus size={16} />} label="Yangi bemorlar" value={periodNewPatients} hint={periodLabel} />
        <StatTile tone="warn" icon={<ListOrdered size={16} />} label="Navbatda" value={queue.length} hint="hozirgi" />
        <StatTile tone="cyan" icon={<CalendarCheck size={16} />} label="Oylik qabul" value={fmtNumber(monthAppts)} hint={currentMonth} />
        <StatTile tone="rose" icon={<PhoneCall size={16} />} label="Jami bemorlar" value={fmtNumber(patients.length)} hint="bazada" />
        <StatTile
          tone={draftTreatments.length > 0 ? 'rose' : 'cyan'}
          icon={<FileText size={16} />}
          label="Bugungi qoralamalar"
          value={draftTreatments.length}
          hint="shifokor ko'rikda"
        />
        <StatTile
          tone={openDebts.length > 0 ? 'warn' : 'cyan'}
          icon={<AlertCircle size={16} />}
          label="Ochiq qarzlar"
          value={`${openDebts.length} ta`}
          hint={openDebtTotal > 0 ? fmtSom(openDebtTotal) : "qarz yo'q"}
        />
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
            <h4><TrendingUp size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Qabullar</h4>
            <small>{apptSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <BarChart data={apptSeries} color="#4f46e5" />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><UserPlus size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Yangi bemorlar</h4>
            <small>{patientSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <LineChart data={patientSeries} color="#0891b2" />
        </div>
      </div>
    </section>
  );
}
