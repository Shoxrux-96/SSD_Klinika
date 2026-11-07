import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTreatments } from '../admin/clinicalData';
import { useQueue } from '../admin/store';
import { ClipboardList, Pill, FlaskConical, Users, TrendingUp, Wallet, Activity } from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtSom, fmtNumber,
} from '../admin/components/DashboardCharts';

const isLabService = (name?: string) => !!name && /lab|tahlil|analiz|anali[zs]/i.test(name);

export function ClinicOverview() {
  const { user } = useAuth();
  const treatments = useTreatments();
  const queue = useQueue();
  const isLaborant = user?.role === 'laborant';
  const { period, setPeriod } = usePeriod('month');

  const mine = useMemo(() => {
    if (!user) return treatments;
    if (isLaborant) return treatments.filter((t) => isLabService(t.service));
    return treatments.filter((t) => t.doctor === user.fullName);
  }, [treatments, user, isLaborant]);

  const myQueue = useMemo(() => (user ? queue.filter((q) => q.doctor === user.fullName) : []), [queue, user]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = mine.filter((t) => t.date === today).length;
  const activeCount = mine.filter((t) => t.status === 'davolanmoqda').length;
  const doneCount = mine.filter((t) => t.status === 'yakunlandi').length;
  const totalAmount = mine.reduce((s, t) => s + (t.amount ?? 0), 0);

  const countSeries = useMemo(
    () => bucketize(mine, (t) => t.date, () => 1, period),
    [mine, period],
  );
  const amountSeries = useMemo(
    () => bucketize(mine, (t) => t.date, (t) => t.amount ?? 0, period),
    [mine, period],
  );

  return (
    <section className="admin-page">
      <style>{dashboardCss}</style>
      <div className="admin-page-head">
        <div>
          <h1>Salom, {user?.fullName}</h1>
          <p>{isLaborant ? 'Laboratoriya faoliyati va ko‘rsatkichlar' : 'Sizning bugungi va davriy ko‘rsatkichlaringiz'}</p>
        </div>
      </div>

      <div className="dc-tiles">
        <StatTile tone="primary" icon={<ClipboardList size={16} />} label="Bugungi davolash" value={todayCount} hint="bugungi kun" />
        <StatTile tone="warn" icon={<Users size={16} />} label="Faol bemorlar" value={activeCount} hint="davolanmoqda" />
        <StatTile tone="ok" icon={<Pill size={16} />} label="Yakunlangan" value={doneCount} hint="jami" />
        <StatTile tone="violet" icon={<Activity size={16} />} label="Navbatimda" value={myQueue.length} hint="hozir" />
        <StatTile tone="cyan" icon={<FlaskConical size={16} />} label="Jami ishlar" value={fmtNumber(mine.length)} hint="barchasi" />
        <StatTile tone="rose" icon={<Wallet size={16} />} label="Jami summa" value={fmtSom(totalAmount)} hint="davolash" />
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
            <h4><TrendingUp size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Qabullar soni</h4>
            <small>{countSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <BarChart data={countSeries} color="#4f46e5" />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><Wallet size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Daromad</h4>
            <small>{fmtSom(amountSeries.reduce((s, b) => s + b.value, 0))}</small>
          </div>
          <LineChart data={amountSeries} color="#10b981" format={fmtSom} />
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>So‘nggi davolashlar</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: '8px 10px' }}>Sana</th>
                <th style={{ padding: '8px 10px' }}>Bemor</th>
                <th style={{ padding: '8px 10px' }}>Tashxis</th>
                <th style={{ padding: '8px 10px' }}>Summa</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {mine.slice(0, 10).map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid #eef2f7' }}>
                  <td style={{ padding: '8px 10px' }}>{t.date}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.patient}</td>
                  <td style={{ padding: '8px 10px' }}>{t.diagnosis}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{t.amount ? fmtSom(t.amount) : '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{t.status}</td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Hali davolash yozilmagan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
