import { useMemo, useState, type ReactNode } from 'react';

export type Period = 'day' | 'month' | 'year';

export type BucketDatum = { label: string; value: number; secondary?: number };

/** Pick a date-level key from a timestamp (ms) or YYYY-MM-DD string. */
function toDate(ts: number | string): Date {
  if (typeof ts === 'number') return new Date(ts);
  if (/^\d{4}-\d{2}-\d{2}/.test(ts)) return new Date(ts);
  return new Date(ts);
}

/** Bucket a list of records by period into aligned buckets ending today. */
export function bucketize<T>(
  items: T[],
  getTs: (t: T) => number | string,
  getValue: (t: T) => number,
  period: Period,
): BucketDatum[] {
  const now = new Date();
  const buckets: BucketDatum[] = [];

  const pad = (n: number) => String(n).padStart(2, '0');

  if (period === 'day') {
    // last 7 days, today last
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      buckets.push({ label: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`, value: 0 });
    }
    const keyFn = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayKeys = new Map<string, number>();
    buckets.forEach((_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (6 - i));
      todayKeys.set(keyFn(d), i);
    });
    for (const it of items) {
      const d = toDate(getTs(it));
      const idx = todayKeys.get(keyFn(d));
      if (idx !== undefined) buckets[idx].value += getValue(it) || 0;
    }
  } else if (period === 'month') {
    // last 12 months (short name), current month last
    const MN = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: MN[d.getMonth()], value: 0 });
    }
    const keyFn = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const keys = new Map<string, number>();
    buckets.forEach((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      keys.set(keyFn(d), i);
    });
    for (const it of items) {
      const d = toDate(getTs(it));
      const idx = keys.get(keyFn(d));
      if (idx !== undefined) buckets[idx].value += getValue(it) || 0;
    }
  } else {
    // last 5 years
    for (let i = 4; i >= 0; i--) {
      buckets.push({ label: String(now.getFullYear() - i), value: 0 });
    }
    for (const it of items) {
      const d = toDate(getTs(it));
      const idx = 4 - (now.getFullYear() - d.getFullYear());
      if (idx >= 0 && idx < 5) buckets[idx].value += getValue(it) || 0;
    }
  }

  return buckets;
}

export function BarChart({
  data, color = '#4f46e5', height = 180, format = (v) => String(v),
}: {
  data: BucketDatum[]; color?: string; height?: number; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="dc-bars" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (height - 28));
        return (
          <div key={i} className="dc-bar-wrap">
            <div className="dc-bar-val">{d.value > 0 ? format(d.value) : ''}</div>
            <div className="dc-bar" style={{ height: h, background: `linear-gradient(180deg, ${color}, ${color}cc)` }} />
            <div className="dc-bar-lbl">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({
  data, color = '#10b981', height = 180, format = (v) => String(v),
}: {
  data: BucketDatum[]; color?: string; height?: number; format?: (v: number) => string;
}) {
  const w = 600;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => {
    const x = i * stepX;
    const y = height - 28 - (d.value / max) * (height - 40);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${height - 28} L0,${height - 28} Z`;

  return (
    <div className="dc-line" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="dcLineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dcLineFill)" />
        <path d={path} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3.5" fill={color} />
            {data[i].value > 0 && (
              <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
                {format(data[i].value)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="dc-line-labels">
        {data.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  );
}

export function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const items: { k: Period; label: string }[] = [
    { k: 'day', label: 'Kunlik' },
    { k: 'month', label: 'Oylik' },
    { k: 'year', label: 'Yillik' },
  ];
  return (
    <div className="dc-tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.k}
          type="button"
          role="tab"
          aria-selected={value === it.k}
          className={`dc-tab${value === it.k ? ' is-active' : ''}`}
          onClick={() => onChange(it.k)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({
  label, value, hint, icon, tone = 'primary',
}: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode;
  tone?: 'primary' | 'ok' | 'warn' | 'violet' | 'cyan' | 'rose';
}) {
  return (
    <div className={`dc-tile dc-tile-${tone}`}>
      {icon && <div className="dc-tile-ico">{icon}</div>}
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <span className="dc-tile-hint">{hint}</span>}
    </div>
  );
}

export function usePeriod(initial: Period = 'month') {
  const [period, setPeriod] = useState<Period>(initial);
  return { period, setPeriod };
}

/** Compact Som formatter: 12.500.000 so'm → 12.5M so'm */
export function fmtSom(n: number): string {
  if (!n || n <= 0) return '0 so\'m';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M so'm`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K so'm`;
  return `${Math.round(n)} so'm`;
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n));
}

export type TopRow = { label: string; sub?: string; value: number };

export function TopList({
  rows, format = fmtNumber, color = '#4f46e5', max,
}: {
  rows: TopRow[]; format?: (v: number) => string; color?: string; max?: number;
}) {
  if (!rows.length) return <div className="dc-empty">Ma'lumot yo‘q</div>;
  const topMax = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="dc-top">
      {rows.map((r, i) => {
        const pct = Math.max(2, (r.value / topMax) * 100);
        return (
          <li key={i} className="dc-top-row">
            <span className="dc-top-rank">{i + 1}</span>
            <div className="dc-top-main">
              <div className="dc-top-head">
                <strong>{r.label}</strong>
                <span className="dc-top-val">{format(r.value)}</span>
              </div>
              {r.sub && <small>{r.sub}</small>}
              <div className="dc-top-track">
                <div className="dc-top-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Donut chart — up to 8 slices, legend on side. */
export function DonutChart({
  rows, format = fmtNumber, size = 160, colors,
}: {
  rows: TopRow[]; format?: (v: number) => string; size?: number; colors?: string[];
}) {
  const PALETTE = colors ?? ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'];
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <div className="dc-empty">Ma'lumot yo‘q</div>;
  const r = size / 2;
  const inner = r * 0.62;
  let acc = 0;
  const slices = rows.map((row, i) => {
    const frac = row.value / total;
    const start = acc;
    const end = acc + frac;
    acc = end;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = end * Math.PI * 2 - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = r + Math.cos(a0) * r;
    const y0 = r + Math.sin(a0) * r;
    const x1 = r + Math.cos(a1) * r;
    const y1 = r + Math.sin(a1) * r;
    const ix1 = r + Math.cos(a1) * inner;
    const iy1 = r + Math.sin(a1) * inner;
    const ix0 = r + Math.cos(a0) * inner;
    const iy0 = r + Math.sin(a0) * inner;
    const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${ix1},${iy1} A${inner},${inner} 0 ${large} 0 ${ix0},${iy0} Z`;
    return { d, color: PALETTE[i % PALETTE.length], pct: frac * 100, ...row };
  });
  return (
    <div className="dc-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <text x={r} y={r - 4} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">Jami</text>
        <text x={r} y={r + 12} textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="800">{format(total)}</text>
      </svg>
      <ul className="dc-donut-legend">
        {slices.map((s, i) => (
          <li key={i}>
            <span className="dc-donut-dot" style={{ background: s.color }} />
            <span className="dc-donut-label">{s.label}</span>
            <span className="dc-donut-val">{format(s.value)} · {s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Exported stylesheet string — include once per dashboard. */
export const dashboardCss = `
.dc-period-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 14px 0 12px; flex-wrap: wrap; }
.dc-period-head h3 { margin: 0; font-size: 15px; color: #0f172a; font-weight: 700; }
.dc-period-head p  { margin: 2px 0 0; font-size: 12.5px; color: #64748b; }

.dc-tabs { display: inline-flex; padding: 3px; gap: 2px; background: #f1f5f9; border-radius: 10px; border: 1px solid #e2e8f0; }
.dc-tab  { border: 0; background: transparent; font-size: 12.5px; font-weight: 600; color: #475569; padding: 7px 14px; border-radius: 8px; cursor: pointer; transition: .15s; }
.dc-tab:hover { color: #0f172a; }
.dc-tab.is-active { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(15,23,42,.08); }

.dc-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 18px; }
.dc-tile { position: relative; padding: 16px 18px; background: #fff; border: 1px solid #eef2f7; border-radius: 14px; overflow: hidden; }
.dc-tile::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: currentColor; opacity: .85; }
.dc-tile-ico { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: currentColor; color: #fff; margin-bottom: 8px; opacity: 1; }
.dc-tile-ico svg { color: #fff; }
.dc-tile small { display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; }
.dc-tile strong { display: block; font-size: 23px; color: #0f172a; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
.dc-tile-hint { display: block; font-size: 11.5px; color: #64748b; margin-top: 3px; }
.dc-tile-primary { color: #4f46e5; }
.dc-tile-ok      { color: #047857; }
.dc-tile-warn    { color: #d97706; }
.dc-tile-violet  { color: #7c3aed; }
.dc-tile-cyan    { color: #0891b2; }
.dc-tile-rose    { color: #db2777; }

.dc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.dc-panel { background: #fff; border: 1px solid #eef2f7; border-radius: 14px; padding: 16px 18px; }
.dc-panel-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.dc-panel-head h4 { margin: 0; font-size: 14px; color: #0f172a; font-weight: 700; }
.dc-panel-head small { font-size: 11.5px; color: #64748b; }

.dc-bars { display: flex; align-items: flex-end; gap: 6px; padding-top: 18px; }
.dc-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; position: relative; }
.dc-bar-val { font-size: 10px; color: #64748b; margin-bottom: 4px; font-weight: 600; white-space: nowrap; }
.dc-bar { width: 100%; max-width: 46px; border-radius: 6px 6px 0 0; transition: .4s; }
.dc-bar-lbl { font-size: 10.5px; color: #64748b; margin-top: 6px; font-weight: 500; }

.dc-line { position: relative; padding-bottom: 20px; }
.dc-line-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10.5px; color: #64748b; font-weight: 500; }

.dc-empty { padding: 28px; text-align: center; color: #94a3b8; font-size: 13px; }

.dc-top { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.dc-top-row { display: flex; align-items: center; gap: 12px; padding: 10px 2px; }
.dc-top-rank { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 800; display: grid; place-items: center; }
.dc-top-row:nth-child(1) .dc-top-rank { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; }
.dc-top-row:nth-child(2) .dc-top-rank { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
.dc-top-row:nth-child(3) .dc-top-rank { background: linear-gradient(135deg, #b45309, #92400e); color: #fff; }
.dc-top-main { flex: 1; min-width: 0; }
.dc-top-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.dc-top-head strong { font-size: 13.5px; color: #0f172a; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-top-val { font-size: 12.5px; color: #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.dc-top-main small { display: block; font-size: 11px; color: #64748b; margin-top: 1px; }
.dc-top-track { margin-top: 6px; height: 6px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.dc-top-fill  { height: 100%; border-radius: 4px; transition: width .4s; }

.dc-donut-wrap { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; padding: 6px 0; }
.dc-donut-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.dc-donut-legend li { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; font-size: 12px; }
.dc-donut-dot { width: 10px; height: 10px; border-radius: 3px; }
.dc-donut-label { color: #0f172a; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-donut-val   { color: #64748b; font-variant-numeric: tabular-nums; font-size: 11.5px; }
@media (max-width: 560px) { .dc-donut-wrap { grid-template-columns: 1fr; justify-items: center; } }
`;
