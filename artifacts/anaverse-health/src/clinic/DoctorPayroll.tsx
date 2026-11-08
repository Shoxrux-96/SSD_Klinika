import { useEffect, useMemo, useState } from 'react';
import { Banknote, Calculator, Wallet, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useEmployees, useServices } from '../admin/store';
import { useTreatments } from '../admin/clinicalData';
import { salaryInRange, INCOME_TAX } from '../admin/attendanceStore';

function fmtSom(n: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " soʻm";
}
function toYM(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0);
  return [first, `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`];
}

export function DoctorPayroll() {
  const { user } = useAuth();
  const employees = useEmployees();
  const treatments = useTreatments();
  const services = useServices();
  const [ym, setYm] = useState(toYM(new Date()));
  const [baseSalary, setBaseSalary] = useState<number>(0);

  const me = useMemo(
    () => employees.find((e) => e.id === user?.id || e.fullName === user?.fullName),
    [employees, user],
  );

  // Xizmat nomi orqali doctorShare foizini topish
  const shareByService = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) m.set(s.name, Number(s.doctorShare ?? 0));
    return m;
  }, [services]);

  // Payroll config'ni DB'dan olib kelamiz (admin belgilagan)
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

  const [from, to] = monthRange(ym);
  const salary = useMemo(
    () => me ? salaryInRange(me.id, baseSalary, from, to) : { gross: 0, net: 0, workedDays: 0 } as any,
    [me, baseSalary, from, to],
  );

  // Shifokorning davolashlari — UUID yoki ism bo'yicha topamiz
  const treatmentsMine = useMemo(() => {
    if (!me) return [];
    return treatments.filter((t) => t.doctor === me.fullName || t.doctor === me.id);
  }, [treatments, me]);

  const monthTreatments = useMemo(
    () => treatmentsMine.filter((t) => t.date >= from && t.date <= to && t.status === 'yakunlandi'),
    [treatmentsMine, from, to],
  );

  const revenue = monthTreatments.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // Har bir xizmatning doctorShare foizi bo'yicha aniq hisoblash (services jadvalidagi qiymat).
  // Agar xizmat uchun doctorShare belgilanmagan bo'lsa — 0%.
  const share = useMemo(() => {
    let total = 0;
    for (const t of monthTreatments) {
      const svcName = t.service ?? t.services?.[0] ?? '';
      const pct = shareByService.get(svcName) ?? 0;
      total += Math.round(((Number(t.amount) || 0) * pct) / 100);
    }
    return total;
  }, [monthTreatments, shareByService]);

  const effectivePct = revenue > 0 ? ((share / revenue) * 100).toFixed(1) : '0';
  const total = (salary?.net ?? 0) + share;

  return (
    <div className="admin-page">
      <style>{css}</style>
      <div className="admin-page-head">
        <div>
          <h1>Mening oyligim</h1>
          <p>{user?.fullName} · {ym}</p>
        </div>
        <input type="month" className="admin-input" value={ym} onChange={(e) => setYm(e.target.value)} style={{ width: 170 }} />
      </div>

      <div className="dp-stat-grid">
        <div className="dp-stat dp-emerald">
          <div className="dp-ico"><Banknote size={20} /></div>
          <small>Asos oylik (brutto)</small>
          <strong>{fmtSom(baseSalary)}</strong>
        </div>
        <div className="dp-stat dp-blue">
          <div className="dp-ico"><Calculator size={20} /></div>
          <small>Hisoblangan (net)</small>
          <strong>{fmtSom(salary?.net ?? 0)}</strong>
          <span>{salary?.workedDays ?? 0} ish kuni</span>
        </div>
        <div className="dp-stat dp-violet">
          <div className="dp-ico"><TrendingUp size={20} /></div>
          <small>Davolash ulushi ({effectivePct}%)</small>
          <strong>{fmtSom(share)}</strong>
          <span>daromad: {fmtSom(revenue)}</span>
        </div>
        <div className="dp-stat dp-amber">
          <div className="dp-ico"><Wallet size={20} /></div>
          <small>Jami olish</small>
          <strong>{fmtSom(total)}</strong>
          <span>net + ulush</span>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Shu oydagi davolashlar</h2><small>Jami {monthTreatments.length} ta, umumiy daromad {fmtSom(revenue)}</small></div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Sana</th><th>Bemor</th><th>Xizmat</th><th>Status</th><th className="admin-cell-right">Narx</th></tr></thead>
            <tbody>
              {monthTreatments.length === 0 ? (
                <tr><td colSpan={5} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Shu oyda davolash yo‘q</td></tr>
              ) : monthTreatments.sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                <tr key={t.id}>
                  <td className="admin-cell-time">{t.date}</td>
                  <td><strong>{t.patient}</strong></td>
                  <td className="admin-cell-muted">{t.service}</td>
                  <td>{t.status}</td>
                  <td className="admin-cell-right"><strong>{fmtSom(Number(t.amount) || 0)}</strong></td>
                </tr>
              ))}
            </tbody>
            {monthTreatments.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} className="admin-cell-muted" style={{ textAlign: 'right', fontWeight: 600 }}>Jami:</td>
                  <td className="admin-cell-right"><strong style={{ color: '#047857' }}>{fmtSom(revenue)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <div className="dp-note">
        <Calendar size={14} />
        <small>Daromad solig‘i {Math.round(INCOME_TAX * 100)}% ushlab qolindi. Ulush foizi har bir xizmat uchun admin paneli (Xizmatlar → Doktor ulushi %) orqali belgilangan qiymatdan olinadi.</small>
      </div>
    </div>
  );
}

const css = `
.dp-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 16px 0 20px; }
.dp-stat { background: #fff; border: 1px solid #eef2f7; padding: 18px; border-radius: 12px; }
.dp-stat small { color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; display: block; margin-top: 10px; }
.dp-stat strong { color: #0f172a; font-size: 22px; font-weight: 700; display: block; font-variant-numeric: tabular-nums; }
.dp-stat > span:last-child { color: #94a3b8; font-size: 11.5px; }
.dp-ico { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; }
.dp-emerald .dp-ico { background: #dcfce7; color: #047857; }
.dp-blue    .dp-ico { background: #dbeafe; color: #2563eb; }
.dp-violet  .dp-ico { background: #ede9fe; color: #7c3aed; }
.dp-amber   .dp-ico { background: #fef3c7; color: #d97706; }

.dp-note { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; color: #94a3b8; }
@media (max-width: 900px) { .dp-stat-grid { grid-template-columns: repeat(2, 1fr); } }
`;
