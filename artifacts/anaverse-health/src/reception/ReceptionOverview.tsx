import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePatients, useAppointments, useQueue } from '../admin/store';
import { CalendarCheck, Users, PhoneCall, ListOrdered, TrendingUp, UserPlus } from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtNumber,
} from '../admin/components/DashboardCharts';

export function ReceptionOverview() {
  const { user } = useAuth();
  const patients = usePatients();
  const appts = useAppointments();
  const queue = useQueue();
  const { period, setPeriod } = usePeriod('month');

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter((a) => a.date === today).length;
  const currentMonth = today.slice(0, 7);
  const monthAppts = appts.filter((a) => a.date.startsWith(currentMonth)).length;
  const monthNewPatients = patients.filter((p) => {
    const d = p.addedAt ? new Date(p.addedAt).toISOString().slice(0, 7) : '';
    return d === currentMonth;
  }).length;
  const comeCount = appts.filter((a) => a.status === 'keldi').length;

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
        <StatTile tone="ok" icon={<Users size={16} />} label="Kelgan bemorlar" value={comeCount} hint="jami" />
        <StatTile tone="violet" icon={<UserPlus size={16} />} label="Yangi bemorlar" value={monthNewPatients} hint={currentMonth} />
        <StatTile tone="warn" icon={<ListOrdered size={16} />} label="Navbatda" value={queue.length} hint="hozirgi" />
        <StatTile tone="cyan" icon={<CalendarCheck size={16} />} label="Oylik qabul" value={fmtNumber(monthAppts)} hint="joriy oy" />
        <StatTile tone="rose" icon={<PhoneCall size={16} />} label="Jami bemorlar" value={fmtNumber(patients.length)} hint="bazada" />
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
