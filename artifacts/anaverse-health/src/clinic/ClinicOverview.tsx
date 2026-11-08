import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTreatments } from '../admin/clinicalData';
import { useQueue, useServices, useEmployees } from '../admin/store';
import {
  ClipboardList, Pill, FlaskConical, Users, TrendingUp, Wallet, Activity, FileText, Banknote,
} from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtSom, fmtNumber,
} from '../admin/components/DashboardCharts';

const isLabService = (name?: string) => !!name && /lab|tahlil|analiz|anali[zs]/i.test(name);

// Tanlangan davr uchun vaqt oralig'i.
function periodWindow(period: 'day' | 'month' | 'year'): { from: string; label: string } {
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  if (period === 'day')
    return { from: new Date(now.getTime() - 7 * DAY).toISOString().slice(0, 10), label: 'oxirgi 7 kun' };
  if (period === 'month')
    return { from: new Date(now.getTime() - 365 * DAY).toISOString().slice(0, 10), label: 'oxirgi 12 oy' };
  return { from: new Date(now.getTime() - 5 * 365 * DAY).toISOString().slice(0, 10), label: 'oxirgi 5 yil' };
}

export function ClinicOverview() {
  const { user } = useAuth();
  const treatments = useTreatments();
  const services = useServices();
  const employees = useEmployees();
  const queue = useQueue();
  const isLaborant = user?.role === 'laborant';
  const { period, setPeriod } = usePeriod('month');
  const [baseSalary, setBaseSalary] = useState<number>(0);

  const me = useMemo(
    () => employees.find((e) => e.id === user?.id || e.fullName === user?.fullName),
    [employees, user],
  );

  // Asos oylikni DB'dan olish (payrolls jadvalidan)
  useEffect(() => {
    if (!me) return;
    fetch('/api/payrolls')
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const row = rows.find((r) => r.employeeId === me.id);
        setBaseSalary(Number(row?.baseSalary ?? 0));
      })
      .catch(() => {});
  }, [me]);

  const mine = useMemo(() => {
    if (!user) return treatments;
    if (isLaborant) return treatments.filter((t) => isLabService(t.service));
    // shifokor — o'ziniki (hozircha doctor nomi orqali — kelajakda doctorId bo'yicha)
    return treatments.filter((t) => t.doctor === user.fullName || t.doctor === user.id);
  }, [treatments, user, isLaborant]);

  const { from: periodFrom, label: periodLabel } = useMemo(() => periodWindow(period), [period]);
  const periodMine = useMemo(() => mine.filter((t) => (t.date ?? '') >= periodFrom), [mine, periodFrom]);

  const myQueue = useMemo(() => (user ? queue.filter((q) => q.doctor === user.fullName) : []), [queue, user]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = mine.filter((t) => t.date === today).length;
  const activeCount = mine.filter((t) => t.status === 'davolanmoqda').length;
  // Yangi: rejalashtirilgan (qabulga keldi -> avto-yaratilgan) davolashlar
  const draftCount = mine.filter((t) => t.status === 'rejalashtirildi').length;
  const doneCount = periodMine.filter((t) => t.status === 'yakunlandi').length;
  const totalAmount = periodMine.reduce((s, t) => s + (t.amount ?? 0), 0);
  // Avtomatik yaratilgan qoralama davolashlar — shifokor diqqat qaratishi uchun
  const draftList = useMemo(() => mine.filter((t) => t.status === 'rejalashtirildi').slice(0, 8), [mine]);

  // Bu oyki ulush (services.doctorShare foizi bo'yicha aniq hisoblash)
  const shareByService = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) m.set(s.name, Number(s.doctorShare ?? 0));
    return m;
  }, [services]);
  const monthStart = today.slice(0, 7) + '-01';
  const monthShare = useMemo(() => {
    let total = 0;
    for (const t of mine) {
      if (t.status !== 'yakunlandi') continue;
      if ((t.date ?? '') < monthStart) continue;
      const svcName = t.service ?? t.services?.[0] ?? '';
      const pct = shareByService.get(svcName) ?? 0;
      total += Math.round(((Number(t.amount) || 0) * pct) / 100);
    }
    return total;
  }, [mine, monthStart, shareByService]);
  const monthTotalPay = baseSalary + monthShare;

  const countSeries = useMemo(
    () => bucketize(periodMine, (t) => t.date, () => 1, period),
    [periodMine, period],
  );
  const amountSeries = useMemo(
    () => bucketize(periodMine, (t) => t.date, (t) => t.amount ?? 0, period),
    [periodMine, period],
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
        <StatTile
          tone={draftCount > 0 ? 'rose' : 'cyan'}
          icon={<FileText size={16} />}
          label="Yangi qoralamalar"
          value={draftCount}
          hint="qabuldan avto"
        />
        <StatTile tone="ok" icon={<Pill size={16} />} label="Yakunlangan" value={doneCount} hint={periodLabel} />
        <StatTile tone="violet" icon={<Activity size={16} />} label="Navbatimda" value={myQueue.length} hint="hozir" />
        <StatTile tone="cyan" icon={<FlaskConical size={16} />} label="Jami ishlar" value={fmtNumber(mine.length)} hint="barchasi" />
        <StatTile tone="rose" icon={<Wallet size={16} />} label="Jami summa" value={fmtSom(totalAmount)} hint={periodLabel} />
        {!isLaborant && (
          <>
            <StatTile tone="violet" icon={<TrendingUp size={16} />} label="Bu oyki ulush" value={fmtSom(monthShare)} hint="doctorShare %" />
            <StatTile tone="ok" icon={<Banknote size={16} />} label="Jami oylik + ulush" value={fmtSom(monthTotalPay)} hint={`asos: ${fmtSom(baseSalary)}`} />
          </>
        )}
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

      {draftList.length > 0 && (
        <div className="admin-card" style={{ marginTop: 20, padding: 20 }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} />
            Yangi qoralama davolashlar
            <small style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>
              — qabuldan avtomatik yaratilgan, davolashni to'ldirishga tayyor
            </small>
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px' }}>Sana</th>
                  <th style={{ padding: '8px 10px' }}>Bemor</th>
                  <th style={{ padding: '8px 10px' }}>Xizmat</th>
                  <th style={{ padding: '8px 10px' }}>Summa</th>
                </tr>
              </thead>
              <tbody>
                {draftList.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid #eef2f7' }}>
                    <td style={{ padding: '8px 10px' }}>{t.date}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.patient}</td>
                    <td style={{ padding: '8px 10px' }}>{t.service ?? '—'}</td>
                    <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>
                      {t.amount ? fmtSom(t.amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
