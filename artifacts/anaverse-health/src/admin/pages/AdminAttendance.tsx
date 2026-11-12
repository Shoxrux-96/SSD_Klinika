import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CalendarCheck, Search, Users, Clock, XCircle, Wallet } from 'lucide-react';
import { useEmployees } from '../store';
import { useAuth } from '../../auth/AuthContext';
import {
  useAttendance, setAttendance, salaryInRange, dailyRateFor, workingDaysInMonth,
  INCOME_TAX, type AttendanceStatus,
} from '../attendanceStore';
import { usePagination, TablePagination } from '../components/TablePagination';

function fmtSom(n: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " soʻm";
}

function toYM(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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
  const dow = new Date(y, m - 1, d).getDay();
  return ['Ya','Du','Se','Ch','Pa','Ju','Sh'][dow];
}

const LABEL: Record<AttendanceStatus, string> = {
  keldi: '✓',
  kech: 'K',
  kelmagan: '✗',
};
const TITLE: Record<AttendanceStatus, string> = {
  keldi: 'Keldi',
  kech: 'Kech kelgan',
  kelmagan: 'Kelmagan',
};
const COLOR: Record<AttendanceStatus, string> = {
  keldi: '#10b981',
  kech: '#f59e0b',
  kelmagan: '#ef4444',
};
const SOFT: Record<AttendanceStatus, string> = {
  keldi: '#ecfdf5',
  kech: '#fffbeb',
  kelmagan: '#fef2f2',
};

// ---- Payroll mini-API ----
type PayrollEntry = {
  employeeId: string;
  baseSalary: number;
  currency: 'som' | 'rubl' | 'dollar';
  note?: string;
  _rowId?: string;
};
async function payrollApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const txt = await res.text(); return txt ? (JSON.parse(txt) as T) : (undefined as T);
}
function parseNote(s: string | null | undefined): { currency?: 'som' | 'rubl' | 'dollar'; note?: string } {
  if (!s) return {};
  try { const o = JSON.parse(s); return typeof o === 'object' ? o : { note: s }; } catch { return { note: s }; }
}
let payrollState: Record<string, PayrollEntry> = {};
const pListeners = new Set<() => void>();
function pEmit() { pListeners.forEach((l) => l()); }
function pSub(l: () => void) { pListeners.add(l); return () => pListeners.delete(l); }
let hydrated = false;
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const rows = await payrollApi<any[]>('/payrolls');
    const next: Record<string, PayrollEntry> = {};
    for (const r of rows) {
      const n = parseNote(r.notes);
      next[r.employeeId] = {
        employeeId: r.employeeId,
        baseSalary: r.baseSalary ?? 0,
        currency: n.currency ?? 'som',
        note: n.note,
        _rowId: r.id,
      };
    }
    payrollState = next; pEmit();
  } catch (e) { console.error('payrolls hydrate failed', e); }
}
function usePayroll() {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(pSub, () => payrollState, () => payrollState);
}
async function upsertBase(employeeId: string, baseSalary: number) {
  const existing = payrollState[employeeId];
  const body = {
    employeeId,
    period: new Date().toISOString().slice(0, 7),
    baseSalary: Math.round(baseSalary) || 0,
    bonus: 0, deduction: 0,
    total: Math.round(baseSalary) || 0,
    status: 'kutilmoqda',
    notes: JSON.stringify({ currency: existing?.currency ?? 'som', note: existing?.note ?? '' }),
  };
  if (existing?._rowId) {
    await payrollApi(`/payrolls/${existing._rowId}`, { method: 'PATCH', body: JSON.stringify(body) });
    payrollState = { ...payrollState, [employeeId]: { ...(existing as PayrollEntry), baseSalary } };
  } else {
    const row = await payrollApi<any>('/payrolls', { method: 'POST', body: JSON.stringify(body) });
    payrollState = { ...payrollState, [employeeId]: {
      employeeId, baseSalary, currency: 'som', _rowId: row.id,
    } };
  }
  pEmit();
}

export function AdminAttendance() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'registrator';
  const employees = useEmployees().filter((e) => !e.archived);
  const records = useAttendance();
  const payroll = usePayroll();

  const [month, setMonth] = useState(toYM(new Date()));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'medical' | 'service'>('service');
  const [localBase, setLocalBase] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<{ employeeId: string; date: string; x: number; y: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!picker) return;
    const close = () => setPicker(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [picker]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => daysInMonth(month), [month]);
  const from = days[0];
  const to = days[days.length - 1];
  const wd = workingDaysInMonth(month);

  const recMap = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of records) {
      if (r.date >= from && r.date <= to) m.set(`${r.employeeId}|${r.date}`, r.status);
    }
    return m;
  }, [records, from, to]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((e) => filter === 'all' ? true : e.category === filter)
      .filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
  }, [employees, filter, query]);

  const pg = usePagination(filtered, [filter, query, filtered.length]);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowLabel = `${today} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Bugungi kun statistikasi
  const todayStats = useMemo(() => {
    let keldi = 0, kech = 0, kelmagan = 0;
    for (const e of filtered) {
      const s = recMap.get(`${e.id}|${today}`);
      if (s === 'keldi') keldi++;
      else if (s === 'kech') kech++;
      else if (s === 'kelmagan') kelmagan++;
    }
    const belgilanmagan = filtered.length - (keldi + kech + kelmagan);
    return { keldi, kech, kelmagan, belgilanmagan };
  }, [filtered, recMap, today]);

  // Oylik umumiy netto
  const monthTotal = useMemo(() => {
    let total = 0;
    for (const e of filtered) {
      const gross = payroll[e.id]?.baseSalary ?? 0;
      if (!gross) continue;
      total += salaryInRange(e.id, gross, from, to).net;
    }
    return total;
  }, [filtered, payroll, from, to, records]);

  function openPicker(e: React.MouseEvent<HTMLButtonElement>, employeeId: string, date: string) {
    e.stopPropagation();
    if (date !== today) return;
    const cur = recMap.get(`${employeeId}|${date}`);
    if (cur) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPicker({ employeeId, date, x: r.left + r.width / 2, y: r.top });
  }
  function choose(status: AttendanceStatus) {
    if (!picker) return;
    setAttendance(picker.employeeId, picker.date, status);
    setPicker(null);
  }

  return (
    <div className="admin-page att-page">
      <style>{attStyles}</style>

      <div className="admin-page-head">
        <div>
          <h1>Davomat {!canEdit && <small style={{ fontSize: 12, fontWeight: 500, color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: 999, marginLeft: 8, verticalAlign: 'middle' }}>Faqat koʻrish</small>}</h1>
          <p className="att-sub">
            {canEdit ? (
              <>Faqat <strong>bugungi kun</strong> uchun belgilash mumkin · <Clock size={12} style={{ verticalAlign: '-2px' }} /> {nowLabel}</>
            ) : (
              <>Davomatni faqat <strong>admin</strong> va <strong>registrator</strong> belgilaydi. Siz faqat koʻrishingiz mumkin.</>
            )}
          </p>
        </div>
        <div className="admin-page-actions">
          <input className="admin-input" type="month" value={month}
            onChange={(e) => setMonth(e.target.value || toYM(new Date()))} />
        </div>
      </div>

      {/* KPI kartochkalar */}
      <div className="att-kpis">
        <div className="att-kpi">
          <div className="att-kpi-ico" style={{ background: '#eef2ff', color: '#4f46e5' }}><Users size={16} /></div>
          <div>
            <small>Hodimlar</small>
            <strong>{filtered.length}</strong>
          </div>
        </div>
        <div className="att-kpi att-kpi-green">
          <div className="att-kpi-ico" style={{ background: SOFT.keldi, color: COLOR.keldi }}><span style={{ fontSize: 14, fontWeight: 800 }}>✓</span></div>
          <div>
            <small>Bugun keldi</small>
            <strong>{todayStats.keldi}</strong>
          </div>
        </div>
        <div className="att-kpi att-kpi-amber">
          <div className="att-kpi-ico" style={{ background: SOFT.kech, color: COLOR.kech }}><span style={{ fontSize: 14, fontWeight: 800 }}>K</span></div>
          <div>
            <small>Kech kelgan</small>
            <strong>{todayStats.kech}</strong>
          </div>
        </div>
        <div className="att-kpi att-kpi-red">
          <div className="att-kpi-ico" style={{ background: SOFT.kelmagan, color: COLOR.kelmagan }}><XCircle size={14} /></div>
          <div>
            <small>Kelmagan</small>
            <strong>{todayStats.kelmagan}</strong>
          </div>
        </div>
        <div className="att-kpi">
          <div className="att-kpi-ico" style={{ background: '#f0fdf4', color: '#15803d' }}><Wallet size={16} /></div>
          <div>
            <small>Oylik netto (jami)</small>
            <strong>{fmtSom(monthTotal)}</strong>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <section className="admin-card att-card">
        <div className="att-toolbar">
          <div className="admin-search att-search">
            <Search size={14} />
            <input placeholder="Ism yoki lavozim..." value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="att-tabs">
            {(['service','medical','all'] as const).map((k) => (
              <button key={k}
                className={`att-tab ${filter === k ? 'is-active' : ''}`}
                onClick={() => setFilter(k)}>
                {k === 'service' ? 'Hodimlar' : k === 'medical' ? 'Shifokorlar' : 'Barchasi'}
              </button>
            ))}
          </div>
          <div className="att-legend">
            <span className="att-legend-item"><i style={{ background: COLOR.keldi }} /> Keldi</span>
            <span className="att-legend-item"><i style={{ background: COLOR.kech }} /> Kech</span>
            <span className="att-legend-item"><i style={{ background: COLOR.kelmagan }} /> Kelmagan</span>
            <span className="att-legend-item att-legend-muted">Shu oy ish kunlari: <strong>{wd}</strong></span>
          </div>
        </div>

        <div className="att-table-wrap">
          <table className="att-table" style={{ minWidth: Math.max(1200, 440 + days.length * 38) }}>
            <thead>
              <tr>
                <th className="att-sticky-left">Hodim</th>
                <th className="att-th-num">Oylik (brutto)</th>
                <th className="att-th-num att-th-muted">Soliq (12%)</th>
                <th className="att-th-num">Kunlik stavka</th>
                {days.map((d) => (
                  <th key={d} className={`att-day-th ${d === today ? 'is-today' : ''}`}>
                    <div className="att-day-num">{d.slice(8)}</div>
                    <div className="att-day-dow">{dowShort(d)}</div>
                  </th>
                ))}
                <th className="att-th-num">Kelgan</th>
                <th className="att-th-num">Oylik (netto)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={days.length + 6} className="att-empty">Natija yoʻq</td></tr>
              )}
              {pg.pageRows.map((e) => {
                const entry = payroll[e.id];
                const gross = entry?.baseSalary ?? 0;
                const rate = dailyRateFor(gross, month);
                const s = salaryInRange(e.id, gross, from, to);
                const baseStr = localBase[e.id] ?? String(gross || '');
                const initial = e.fullName.trim().charAt(0).toUpperCase();
                return (
                  <tr key={e.id}>
                    <td className="att-sticky-left">
                      <div className="att-emp">
                        <div className="att-ava">{initial}</div>
                        <div>
                          <strong className="att-emp-name">{e.fullName}</strong>
                          <div className="att-emp-pos">{e.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="att-td-num">
                      <div className="att-money-input">
                        <input
                          type="number" min={0} value={baseStr}
                          onChange={(ev) => setLocalBase((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          onBlur={() => {
                            const v = Number(baseStr) || 0;
                            if (v !== gross) upsertBase(e.id, v);
                          }}
                          placeholder="0"
                        />
                        <span>soʻm</span>
                      </div>
                    </td>
                    <td className="att-td-num att-tax">
                      {gross > 0 ? fmtSom(gross * INCOME_TAX) : <span className="att-dim">—</span>}
                    </td>
                    <td className="att-td-num att-rate">
                      {rate > 0 ? fmtSom(rate) : <span className="att-dim">—</span>}
                    </td>
                    {days.map((d) => {
                      const st = recMap.get(`${e.id}|${d}`);
                      const isToday = d === today;
                      const interactable = canEdit && isToday && !st;
                      const title = st
                        ? `${d} — ${TITLE[st]} (qulflangan)`
                        : isToday
                          ? `${d} — belgilash uchun bosing`
                          : d < today ? `${d} — o'tgan kun` : `${d} — kelajak sana`;
                      return (
                        <td key={d} className={`att-day-td ${isToday ? 'is-today' : ''}`}>
                          <button
                            type="button"
                            onClick={(ev) => openPicker(ev, e.id, d)}
                            disabled={!interactable}
                            title={title}
                            className={`att-cell ${st ? `is-${st}` : ''} ${isToday && !st ? 'is-today-empty' : ''} ${!isToday && !st ? 'is-dim' : ''}`}
                          >
                            {st ? LABEL[st] : (isToday ? '+' : '')}
                          </button>
                        </td>
                      );
                    })}
                    <td className="att-td-num">
                      <span className="att-worked">{s.worked} <small>kun</small></span>
                      {s.late > 0 && <span className="att-late-bubble">K: {s.late}</span>}
                    </td>
                    <td className="att-td-num att-netto">{fmtSom(s.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>

        <div className="att-foot">
          <CalendarCheck size={14} />{' '}
          <span>Formula: <code>netto = brutto × (1 − {Math.round(INCOME_TAX * 100)}%)</code> · <code>kunlik stavka = netto ÷ ish kunlari</code> · <code>oylik = stavka × (keldi + kech)</code></span>
        </div>
      </section>

      {/* Status picker popover */}
      {picker && (
        <div
          onClick={(ev) => ev.stopPropagation()}
          className="att-picker"
          style={{ left: picker.x, top: picker.y - 10 }}
        >
          {(['keldi','kech','kelmagan'] as AttendanceStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => choose(s)}
              className="att-picker-btn"
              style={{ background: COLOR[s] }}>
              <span className="att-picker-glyph">{LABEL[s]}</span>
              <span>{TITLE[s]}</span>
            </button>
          ))}
          <span className="att-picker-arrow" />
        </div>
      )}
    </div>
  );
}

const attStyles = `
.att-page { --brand: #4f46e5; }
.att-sub { color: #64748b; margin-top: 2px; }
.att-sub strong { color: #0f172a; }

/* KPI row */
.att-kpis {
  display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 12px 0 14px;
}
.att-kpi {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.att-kpi small { display: block; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; }
.att-kpi strong { font-size: 18px; color: #0f172a; }
.att-kpi-ico {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}

/* Card */
.att-card { padding: 0; overflow: hidden; }
.att-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 12px 14px; border-bottom: 1px solid #eef2f7; background: #fafbfc;
}
.att-search { min-width: 240px; }
.att-tabs { display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 10px; gap: 2px; }
.att-tab {
  border: none; background: transparent; padding: 6px 12px; border-radius: 8px;
  font-size: 13px; font-weight: 600; color: #475569; cursor: pointer;
}
.att-tab.is-active { background: #fff; color: #0f172a; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
.att-legend { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 12px; color: #475569; }
.att-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.att-legend-item i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.att-legend-muted { color: #94a3b8; }
.att-legend-muted strong { color: #0f172a; }

/* Table */
.att-table-wrap { overflow-x: auto; }
.att-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.att-table thead th {
  position: sticky; top: 0; background: #f8fafc; z-index: 3;
  text-align: left; padding: 10px 10px; font-size: 11px; font-weight: 700;
  color: #64748b; text-transform: uppercase; letter-spacing: .4px;
  border-bottom: 1px solid #e2e8f0;
}
.att-table tbody td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.att-table tbody tr:hover td { background: #fafbff; }
.att-th-num { text-align: right; }
.att-th-muted { color: #94a3b8; }
.att-td-num { text-align: right; font-variant-numeric: tabular-nums; }

/* Sticky left column */
.att-sticky-left { position: sticky; left: 0; background: #fff; z-index: 2; min-width: 220px; }
.att-table thead .att-sticky-left { z-index: 4; background: #f8fafc; }
.att-table tbody tr:hover .att-sticky-left { background: #fafbff; }

/* Day headers */
.att-day-th { text-align: center !important; padding: 6px 4px !important; min-width: 36px; }
.att-day-th.is-today { background: #eef2ff !important; color: var(--brand) !important; }
.att-day-num { font-size: 12px; font-weight: 700; color: #0f172a; }
.att-day-th.is-today .att-day-num { color: var(--brand); }
.att-day-dow { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: .3px; margin-top: 2px; }

/* Day cell */
.att-day-td { text-align: center; padding: 4px !important; }
.att-day-td.is-today { background: #f5f7ff; }
.att-cell {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid transparent;
  background: transparent; color: #cbd5e1; font-weight: 700; font-size: 12px;
  cursor: pointer; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  transition: transform .08s ease, box-shadow .12s ease;
}
.att-cell:disabled { cursor: not-allowed; }
.att-cell.is-keldi    { background: ${COLOR.keldi}; color: #fff; border-color: ${COLOR.keldi}; box-shadow: 0 1px 2px rgba(16,185,129,.35); }
.att-cell.is-kech     { background: ${COLOR.kech};  color: #fff; border-color: ${COLOR.kech};  box-shadow: 0 1px 2px rgba(245,158,11,.35); }
.att-cell.is-kelmagan { background: ${COLOR.kelmagan}; color: #fff; border-color: ${COLOR.kelmagan}; box-shadow: 0 1px 2px rgba(239,68,68,.35); }
.att-cell.is-today-empty {
  background: #fff; color: var(--brand); border: 1.5px dashed #a5b4fc;
}
.att-cell.is-today-empty:hover { transform: scale(1.06); box-shadow: 0 2px 6px rgba(79,70,229,.15); }
.att-cell.is-dim { background: #f8fafc; border-color: transparent; color: transparent; }

/* Employee display */
.att-emp { display: flex; align-items: center; gap: 10px; }
.att-ava {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  color: #4338ca; font-weight: 800; font-size: 13px;
  display: inline-flex; align-items: center; justify-content: center;
}
.att-emp-name { color: #0f172a; font-size: 13px; }
.att-emp-pos { color: #64748b; font-size: 11px; margin-top: 1px; }

/* Money input */
.att-money-input {
  display: inline-flex; align-items: center; gap: 4px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 2px 8px 2px 6px;
}
.att-money-input:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.att-money-input input {
  width: 110px; border: none; outline: none; text-align: right;
  padding: 5px 2px; font-size: 13px; font-variant-numeric: tabular-nums;
  background: transparent;
}
.att-money-input span { font-size: 11px; color: #94a3b8; font-weight: 600; }

.att-tax { color: #dc2626; }
.att-rate { color: #334155; font-weight: 600; }
.att-netto { color: #15803d; font-weight: 800; font-size: 13.5px; }
.att-dim { color: #cbd5e1; }
.att-worked { font-weight: 600; color: #0f172a; }
.att-worked small { color: #94a3b8; font-weight: 500; margin-left: 2px; }
.att-late-bubble {
  display: inline-block; margin-left: 6px; font-size: 10px;
  background: ${SOFT.kech}; color: ${COLOR.kech};
  padding: 1px 6px; border-radius: 999px; font-weight: 700;
}
.att-empty { text-align: center; padding: 32px !important; color: #94a3b8; }

/* Footer */
.att-foot {
  padding: 10px 14px; border-top: 1px solid #eef2f7; background: #fafbfc;
  font-size: 12px; color: #475569; display: flex; align-items: center; gap: 8px;
}
.att-foot code { background: #eef2ff; color: #3730a3; padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }

/* Picker popover */
.att-picker {
  position: fixed; transform: translate(-50%, -100%);
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 6px; display: flex; gap: 6px; z-index: 1000; white-space: nowrap;
  box-shadow: 0 16px 36px rgba(15,23,42,.18);
  animation: att-pop .12s ease-out;
}
@keyframes att-pop {
  from { opacity: 0; transform: translate(-50%, -100%) translateY(4px); }
  to   { opacity: 1; transform: translate(-50%, -100%) translateY(0); }
}
.att-picker-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 8px; border: none; color: #fff;
  font-weight: 700; font-size: 12.5px; cursor: pointer;
  transition: transform .08s ease;
}
.att-picker-btn:hover { transform: translateY(-1px); }
.att-picker-glyph { font-size: 14px; font-weight: 800; }
.att-picker-arrow {
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 7px solid transparent; border-right: 7px solid transparent;
  border-top: 7px solid #fff;
  filter: drop-shadow(0 1px 0 #e2e8f0);
}
`;
