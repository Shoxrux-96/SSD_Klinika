import { useMemo, useState } from 'react';
import { CalendarCheck, Clock, XCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useEmployees } from '../admin/store';
import { useAttendance, type AttendanceStatus } from '../admin/attendanceStore';

function toYM(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}
function dowShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['Ya','Du','Se','Ch','Pa','Ju','Sh'][new Date(y, m - 1, d).getDay()];
}

const LABEL: Record<AttendanceStatus, string> = { keldi: '✓', kech: 'K', kelmagan: '✗' };
const COLOR: Record<AttendanceStatus, string> = { keldi: '#10b981', kech: '#f59e0b', kelmagan: '#ef4444' };
const TITLE: Record<AttendanceStatus, string> = { keldi: 'Keldi', kech: 'Kech kelgan', kelmagan: 'Kelmagan' };

export function DoctorAttendance() {
  const { user } = useAuth();
  const employees = useEmployees();
  const att = useAttendance();
  const [ym, setYm] = useState(toYM(new Date()));

  const me = useMemo(
    () => employees.find((e) => e.fullName === user?.fullName),
    [employees, user],
  );

  const days = daysInMonth(ym);
  const statusFor = (dateStr: string): AttendanceStatus | undefined => {
    if (!me) return undefined;
    const row = att.find((a) => a.employeeId === me.id && a.date === dateStr);
    return row?.status;
  };

  const counts = useMemo(() => {
    const c = { keldi: 0, kech: 0, kelmagan: 0, total: days.length };
    days.forEach((d) => {
      const s = statusFor(d);
      if (s) c[s]++;
    });
    return c;
  }, [att, me, days]);

  const recent = useMemo(() => {
    if (!me) return [];
    return att
      .filter((a) => a.employeeId === me.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);
  }, [att, me]);

  return (
    <div className="admin-page">
      <style>{css}</style>
      <div className="admin-page-head">
        <div>
          <h1>Mening davomatim</h1>
          <p>{user?.fullName} · {ym}</p>
        </div>
        <input type="month" className="admin-input" value={ym} onChange={(e) => setYm(e.target.value)} style={{ width: 170 }} />
      </div>

      <div className="da-stat-grid">
        <div className="da-stat da-green">
          <div className="da-ico"><CalendarCheck size={18} /></div>
          <small>Keldi</small><strong>{counts.keldi}</strong><span>kun</span>
        </div>
        <div className="da-stat da-amber">
          <div className="da-ico"><Clock size={18} /></div>
          <small>Kech kelgan</small><strong>{counts.kech}</strong><span>kun</span>
        </div>
        <div className="da-stat da-red">
          <div className="da-ico"><XCircle size={18} /></div>
          <small>Kelmagan</small><strong>{counts.kelmagan}</strong><span>kun</span>
        </div>
        <div className="da-stat da-violet">
          <div className="da-ico"><TrendingUp size={18} /></div>
          <small>Davomat %</small>
          <strong>{counts.total > 0 ? Math.round(((counts.keldi + counts.kech) / counts.total) * 100) : 0}%</strong>
          <span>jami</span>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head"><div><h2>Oyning kalendari</h2><small>Oq kataklar — hali belgilanmagan</small></div></div>
        <div className="da-cal">
          {days.map((d) => {
            const s = statusFor(d);
            const day = d.slice(-2);
            return (
              <div key={d} className="da-cell" title={`${d} (${dowShort(d)}) — ${s ? TITLE[s] : 'belgilanmagan'}`}
                style={{
                  borderColor: s ? COLOR[s] : '#e2e8f0',
                  background: s ? COLOR[s] + '15' : '#fff',
                  color: s ? COLOR[s] : '#94a3b8',
                }}>
                <span className="da-cell-dow">{dowShort(d)}</span>
                <strong>{day}</strong>
                <span className="da-cell-mark">{s ? LABEL[s] : '·'}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><div><h2>Oxirgi 15 yozuv</h2></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Sana</th><th>Kun</th><th>Status</th></tr></thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={3} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Yozuv yo‘q</td></tr>
              ) : recent.map((r) => (
                <tr key={`${r.employeeId}-${r.date}`}>
                  <td className="admin-cell-time">{r.date}</td>
                  <td className="admin-cell-muted">{dowShort(r.date)}</td>
                  <td>
                    <span className="admin-chip" style={{ background: COLOR[r.status] + '20', color: COLOR[r.status] }}>{TITLE[r.status]}</span>
                  </td>
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
.da-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 16px; margin-bottom: 20px; }
.da-stat { background: #fff; border: 1px solid #eef2f7; padding: 18px; border-radius: 12px; }
.da-stat small { color: #64748b; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; display: block; margin-top: 10px; }
.da-stat strong { color: #0f172a; font-size: 28px; font-weight: 700; display: inline-block; margin-right: 6px; }
.da-stat > span:last-child { color: #94a3b8; font-size: 12px; }
.da-ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; }
.da-green  .da-ico { background: #dcfce7; color: #047857; }
.da-amber  .da-ico { background: #fef3c7; color: #d97706; }
.da-red    .da-ico { background: #fee2e2; color: #dc2626; }
.da-violet .da-ico { background: #ede9fe; color: #7c3aed; }

.da-cal {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
  gap: 8px; padding: 18px;
}
.da-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 10px 8px; border-radius: 10px; border: 1px solid; aspect-ratio: 1;
  transition: transform .12s;
}
.da-cell:hover { transform: scale(1.05); }
.da-cell-dow { font-size: 10px; font-weight: 600; opacity: .7; }
.da-cell strong { font-size: 16px; font-weight: 700; }
.da-cell-mark { font-size: 15px; font-weight: 800; }

@media (max-width: 900px) { .da-stat-grid { grid-template-columns: repeat(2, 1fr); } }
`;
