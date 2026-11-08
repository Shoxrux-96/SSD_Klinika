import { useMemo, useState } from 'react';
import { useAppointments, useServices, type Appointment, type Service } from '../store';
import { usePagination, TablePagination } from '../components/TablePagination';
import { exportCsv, todayStamp } from '../lib/exportCsv';

type Period = 'day' | 'month' | 'year';

const PERIOD_LABEL: Record<Period, string> = {
  day: 'Kunlik',
  month: 'Oylik',
  year: 'Yillik',
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatSom(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

function servicePriceSom(s: Service): number {
  return s.somValue ?? s.price;
}

function matchPeriod(a: Appointment, period: Period, anchor: string): boolean {
  // anchor is YYYY-MM-DD for day, YYYY-MM for month, YYYY for year
  if (period === 'day')   return a.date === anchor;
  if (period === 'month') return a.date.startsWith(anchor);
  return a.date.startsWith(anchor);
}

export function AdminReports() {
  const appointments = useAppointments();
  const services = useServices();

  const [period, setPeriod] = useState<Period>('month');
  const today = todayISO();
  const [dayAnchor, setDayAnchor]   = useState<string>(today);
  const [monthAnchor, setMonthAnchor] = useState<string>(today.slice(0, 7));
  const [yearAnchor, setYearAnchor]   = useState<string>(today.slice(0, 4));

  const anchor = period === 'day' ? dayAnchor : period === 'month' ? monthAnchor : yearAnchor;

  const priceByName = useMemo(() => {
    const map = new Map<string, number>();
    services.forEach((s) => map.set(s.name, servicePriceSom(s)));
    return map;
  }, [services]);

  const rows = useMemo(() => {
    const bucket = new Map<string, { count: number; cancelled: number; revenue: number }>();
    appointments.forEach((a) => {
      if (!matchPeriod(a, period, anchor)) return;
      const b = bucket.get(a.service) ?? { count: 0, cancelled: 0, revenue: 0 };
      if (a.status === 'bekor' || a.status === 'kelmadi') {
        b.cancelled += 1;
      } else {
        b.count += 1;
        b.revenue += priceByName.get(a.service) ?? 0;
      }
      bucket.set(a.service, b);
    });
    return Array.from(bucket.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [appointments, priceByName, period, anchor]);

  const totals = useMemo(() => {
    const count = rows.reduce((s, r) => s + r.count, 0);
    const cancelled = rows.reduce((s, r) => s + r.cancelled, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    return { count, cancelled, revenue };
  }, [rows]);

  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  const pg = usePagination(rows, [period, anchor, rows.length]);

  const periodTitle = period === 'day'
    ? `${anchor} sana uchun`
    : period === 'month'
      ? `${anchor} oyi uchun`
      : `${anchor} yili uchun`;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Xizmatlar hisoboti</h1>
          <p>Har bir xizmatdan kunlik, oylik va yillik foydalanishlar soni va daromad miqdori — real ma'lumotlar asosida.</p>
        </div>
        <div className="admin-page-actions">
          <button
            className="admin-btn admin-btn-primary"
            disabled={rows.length === 0}
            onClick={() => exportCsv(`xizmatlar-hisoboti-${anchor}-${todayStamp()}`, rows, [
              { header: 'Xizmat nomi',   get: (r) => r.name },
              { header: 'Soni',          get: (r) => r.count },
              { header: 'Bekor',         get: (r) => r.cancelled },
              { header: 'Bir martalik narx', get: (r) => priceByName.get(r.name) ?? 0 },
              { header: 'Jami daromad',  get: (r) => r.revenue },
              {
                header: 'Ulush (%)',
                get: (r) => totals.revenue > 0 ? ((r.revenue / totals.revenue) * 100).toFixed(1) : '0',
              },
            ])}
          >
            Excel (CSV) yuklab olish
          </button>
        </div>
      </div>

      <div className="rep-controls">
        <div className="rep-tabs">
          {(['day', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              className={'rep-tab' + (period === p ? ' is-active' : '')}
              onClick={() => setPeriod(p)}
              type="button"
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="rep-anchor">
          {period === 'day' && (
            <input type="date" value={dayAnchor} onChange={(e) => setDayAnchor(e.target.value)} />
          )}
          {period === 'month' && (
            <input type="month" value={monthAnchor} onChange={(e) => setMonthAnchor(e.target.value)} />
          )}
          {period === 'year' && (
            <input
              type="number"
              min="2000"
              max="2100"
              value={yearAnchor}
              onChange={(e) => setYearAnchor(e.target.value.slice(0, 4))}
            />
          )}
        </div>
      </div>

      <div className="rep-kpi-row">
        <div className="rep-kpi">
          <small>Davr</small>
          <strong>{PERIOD_LABEL[period]}</strong>
          <span className="rep-kpi-sub">{periodTitle}</span>
        </div>
        <div className="rep-kpi">
          <small>Jami qabullar</small>
          <strong>{totals.count}</strong>
          <span className="rep-kpi-sub">bekor: {totals.cancelled}</span>
        </div>
        <div className="rep-kpi rep-kpi-primary">
          <small>Jami daromad</small>
          <strong>{formatSom(totals.revenue)}</strong>
          <span className="rep-kpi-sub">{rows.length} ta xizmat</span>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Xizmatlar bo'yicha jadval</h2>
            <small>{periodTitle} — foydalanish soni va daromad miqdori</small>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="rep-empty">Tanlangan davrda qabullar topilmadi.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table rep-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Xizmat nomi</th>
                  <th className="rep-num">Soni</th>
                  <th className="rep-num">Bekor</th>
                  <th className="rep-num">Bir martalik narx</th>
                  <th className="rep-num">Jami daromad</th>
                  <th className="rep-num">Ulush</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageRows.map((r, i) => {
                  const share = totals.revenue > 0 ? (r.revenue / totals.revenue) * 100 : 0;
                  const unit = priceByName.get(r.name) ?? 0;
                  const idx = pg.start + i;
                  return (
                    <tr key={r.name}>
                      <td>{idx + 1}</td>
                      <td><strong>{r.name}</strong></td>
                      <td className="rep-num">{r.count}</td>
                      <td className="rep-num admin-cell-muted">{r.cancelled}</td>
                      <td className="rep-num">{formatSom(unit)}</td>
                      <td className="rep-num"><strong>{formatSom(r.revenue)}</strong></td>
                      <td className="rep-num">{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>JAMI</strong></td>
                  <td className="rep-num"><strong>{totals.count}</strong></td>
                  <td className="rep-num"><strong>{totals.cancelled}</strong></td>
                  <td className="rep-num">—</td>
                  <td className="rep-num"><strong>{formatSom(totals.revenue)}</strong></td>
                  <td className="rep-num">100%</td>
                </tr>
              </tfoot>
            </table>
            <TablePagination {...pg} />
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="admin-card">
          <div className="admin-card-head">
            <div>
              <h2>Daromad bo'yicha diagramma</h2>
              <small>{periodTitle} — xizmatlar reytingi</small>
            </div>
          </div>
          <div className="rep-bars">
            {rows.map((r) => {
              const w = (r.revenue / maxRevenue) * 100;
              return (
                <div className="rep-bar-row" key={r.name}>
                  <div className="rep-bar-label">
                    <span className="rep-bar-name">{r.name}</span>
                    <span className="rep-bar-meta">
                      {r.count} ta · <strong>{formatSom(r.revenue)}</strong>
                    </span>
                  </div>
                  <div className="rep-bar-track">
                    <div className="rep-bar-fill" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
