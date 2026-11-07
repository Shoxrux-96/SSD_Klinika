import { useMemo, useState } from 'react';
import { FlaskConical, Stethoscope, Calendar, TrendingUp, Activity } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTreatments } from '../admin/clinicalData';
import { useServices } from '../admin/store';

type Period = 'daily' | 'monthly' | 'yearly';

function inPeriod(dateISO: string, p: Period): boolean {
  if (!dateISO) return false;
  const d = new Date(dateISO);
  const now = new Date();
  if (p === 'daily') return dateISO === now.toISOString().slice(0, 10);
  if (p === 'monthly') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return d.getFullYear() === now.getFullYear();
}

export function DoctorReferrals() {
  const { user } = useAuth();
  const treatments = useTreatments();
  const services = useServices();
  const [period, setPeriod] = useState<Period>('monthly');

  const mine = useMemo(
    () => treatments.filter((t) => t.doctor === user?.fullName),
    [treatments, user],
  );

  // Xizmatlar bo'yicha "laborant" bo'limini ajratamiz — xizmat nomi "lab" yoki "tahlil" so'zini o'z ichiga olsa
  const isLab = (serviceName: string) => /lab|tahlil|analiz|anali[zs]/i.test(serviceName);

  const scoped = useMemo(() => mine.filter((t) => inPeriod(t.date, period)), [mine, period]);

  const svc = (t: { service?: string }) => t.service ?? '';
  const labRefs = scoped.filter((t) => isLab(svc(t)));
  const otherRefs = scoped.filter((t) => !isLab(svc(t)));

  const stats = {
    daily:   mine.filter((t) => inPeriod(t.date, 'daily')).length,
    monthly: mine.filter((t) => inPeriod(t.date, 'monthly')).length,
    yearly:  mine.filter((t) => inPeriod(t.date, 'yearly')).length,
    labDaily:   mine.filter((t) => inPeriod(t.date, 'daily')   && isLab(svc(t))).length,
    labMonthly: mine.filter((t) => inPeriod(t.date, 'monthly') && isLab(svc(t))).length,
    labYearly:  mine.filter((t) => inPeriod(t.date, 'yearly')  && isLab(svc(t))).length,
  };

  // Guruhlash — xizmat bo'yicha necha marta
  const groupByService = (list: typeof scoped) => {
    const g = new Map<string, { count: number; lastDate: string }>();
    list.forEach((t) => {
      const name = svc(t);
      if (!name) return;
      const prev = g.get(name);
      if (!prev) g.set(name, { count: 1, lastDate: t.date });
      else g.set(name, { count: prev.count + 1, lastDate: t.date > prev.lastDate ? t.date : prev.lastDate });
    });
    return Array.from(g.entries())
      .map(([service, v]) => ({ service, ...v }))
      .sort((a, b) => b.count - a.count);
  };

  const labGroups = groupByService(labRefs);
  const otherGroups = groupByService(otherRefs);

  return (
    <div className="admin-page">
      <style>{css}</style>
      <div className="admin-page-head">
        <div>
          <h1>Yo‘naltirilgan xizmatlar</h1>
          <p>Siz tomondan laboratoriya va boshqa xizmatlarga yo‘naltirilgan bemorlar statistikasi</p>
        </div>
        <div className="dr-period-row">
          {(['daily','monthly','yearly'] as Period[]).map((p) => (
            <button key={p}
              className={`dr-period-btn ${period === p ? 'is-active' : ''}`}
              onClick={() => setPeriod(p)}>
              {p === 'daily' ? 'Kunlik' : p === 'monthly' ? 'Oylik' : 'Yillik'}
            </button>
          ))}
        </div>
      </div>

      <div className="dr-stat-grid">
        <div className="dr-stat dr-stat-blue">
          <div className="dr-stat-ico"><Calendar size={18} /></div>
          <small>Kunlik</small><strong>{stats.daily}</strong>
          <span className="dr-lab-sub">Lab: {stats.labDaily}</span>
        </div>
        <div className="dr-stat dr-stat-violet">
          <div className="dr-stat-ico"><TrendingUp size={18} /></div>
          <small>Oylik</small><strong>{stats.monthly}</strong>
          <span className="dr-lab-sub">Lab: {stats.labMonthly}</span>
        </div>
        <div className="dr-stat dr-stat-amber">
          <div className="dr-stat-ico"><Activity size={18} /></div>
          <small>Yillik</small><strong>{stats.yearly}</strong>
          <span className="dr-lab-sub">Lab: {stats.labYearly}</span>
        </div>
      </div>

      <div className="dr-columns">
        <section className="admin-card">
          <div className="admin-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="dr-sec-ico dr-sec-ico-lab"><FlaskConical size={18} /></div>
              <div><h2>Laboratoriyaga yo‘naltirilgan</h2><small>{period === 'daily' ? 'Bugun' : period === 'monthly' ? 'Shu oy' : 'Shu yil'}: {labRefs.length} ta</small></div>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Xizmat</th><th>Soni</th><th>Oxirgi sana</th></tr></thead>
              <tbody>
                {labGroups.length === 0 ? (
                  <tr><td colSpan={3} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Yo‘naltirilmagan</td></tr>
                ) : labGroups.map((g) => (
                  <tr key={g.service}>
                    <td><strong>{g.service}</strong></td>
                    <td><span className="dr-count-badge dr-count-lab">{g.count} marta</span></td>
                    <td className="admin-cell-muted">{g.lastDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="dr-sec-ico dr-sec-ico-other"><Stethoscope size={18} /></div>
              <div><h2>Boshqa xizmatlar</h2><small>{period === 'daily' ? 'Bugun' : period === 'monthly' ? 'Shu oy' : 'Shu yil'}: {otherRefs.length} ta</small></div>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Xizmat</th><th>Soni</th><th>Oxirgi sana</th></tr></thead>
              <tbody>
                {otherGroups.length === 0 ? (
                  <tr><td colSpan={3} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Yo‘naltirilmagan</td></tr>
                ) : otherGroups.map((g) => (
                  <tr key={g.service}>
                    <td><strong>{g.service}</strong></td>
                    <td><span className="dr-count-badge dr-count-other">{g.count} marta</span></td>
                    <td className="admin-cell-muted">{g.lastDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><div><h2>Oxirgi yo‘naltirishlar</h2><small>Jurnaldan so‘nggi 15 ta yozuv</small></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Sana</th><th>Bemor</th><th>Xizmat</th><th>Tur</th><th>Status</th></tr></thead>
            <tbody>
              {scoped.length === 0 ? (
                <tr><td colSpan={5} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Yozuv yo‘q</td></tr>
              ) : scoped.slice(0, 15).map((t) => (
                <tr key={t.id}>
                  <td className="admin-cell-muted">{t.date}</td>
                  <td><strong>{t.patient}</strong></td>
                  <td>{t.service}</td>
                  <td><span className={`admin-chip ${isLab(svc(t)) ? 'chip-ok' : 'chip-wait'}`}>{isLab(svc(t)) ? 'Laboratoriya' : 'Boshqa'}</span></td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const css = `
.dr-period-row { display: inline-flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 10px; }
.dr-period-btn {
  background: transparent; border: 0; padding: 7px 14px; border-radius: 7px;
  font-size: 12.5px; font-weight: 600; color: #64748b; cursor: pointer;
  transition: all .12s;
}
.dr-period-btn:hover { color: #0f172a; }
.dr-period-btn.is-active { background: #fff; color: #4f46e5; box-shadow: 0 2px 6px -2px rgba(0,0,0,.1); }

.dr-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
.dr-stat {
  background: #fff; border: 1px solid #eef2f7;
  padding: 18px; border-radius: 12px; position: relative;
}
.dr-stat small { color: #64748b; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; display: block; margin-top: 10px; }
.dr-stat strong { color: #0f172a; font-size: 28px; font-weight: 700; display: block; font-variant-numeric: tabular-nums; }
.dr-stat-ico { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; }
.dr-stat-blue   .dr-stat-ico { background: #dbeafe; color: #2563eb; }
.dr-stat-violet .dr-stat-ico { background: #ede9fe; color: #7c3aed; }
.dr-stat-amber  .dr-stat-ico { background: #fef3c7; color: #d97706; }
.dr-lab-sub { color: #94a3b8; font-size: 11.5px; font-weight: 500; }

.dr-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
@media (max-width: 1000px) {
  .dr-columns { grid-template-columns: 1fr; }
  .dr-stat-grid { grid-template-columns: repeat(2, 1fr); }
}

.dr-sec-ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; }
.dr-sec-ico-lab { background: #dcfce7; color: #047857; }
.dr-sec-ico-other { background: #ede9fe; color: #7c3aed; }

.dr-count-badge {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700;
}
.dr-count-lab { background: #dcfce7; color: #047857; }
.dr-count-other { background: #ede9fe; color: #7c3aed; }
`;
