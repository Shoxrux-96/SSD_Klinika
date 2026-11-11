import { useEffect, useMemo, useState } from 'react';
import {
  Shield, LogIn, LogOut, UserPlus, UserX, Edit3, Trash2, FileText, CheckCircle2,
  XCircle, AlertTriangle, Activity, Search, Filter, Download, Clock,
} from 'lucide-react';
import { usePagination, TablePagination } from '../components/TablePagination';
import { useEmployees } from '../store';
import { exportCsv, todayStamp } from '../lib/exportCsv';

type AuditLog = {
  id: string;
  actor: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before?: any;
  after?: any;
  at: number;
};

type ActionKind = 'success' | 'warning' | 'danger' | 'info';

const ACTION_DICT: Record<string, { label: string; icon: typeof Shield; kind: ActionKind }> = {
  // Autentifikatsiya
  'login':             { label: 'Tizimga kirdi',               icon: LogIn,        kind: 'success' },
  'logout':            { label: 'Tizimdan chiqdi',             icon: LogOut,       kind: 'info' },
  'access:denied':     { label: "Ruxsat berilmadi (bloklandi)", icon: Shield,       kind: 'danger' },
  // Laboratoriya
  'lab:jarayonda':     { label: "Tahlilni jarayonga qo'ydi",    icon: Activity,     kind: 'info' },
  'lab:tayyor':        { label: 'Tahlil natijasini tayyor deb belgiladi', icon: CheckCircle2, kind: 'success' },
  'lab:bekor':         { label: 'Tahlilni bekor qildi',         icon: XCircle,      kind: 'warning' },
  'lab:result_saved':  { label: 'Tahlil natijasini saqladi',    icon: FileText,     kind: 'success' },
  'lab:deleted':       { label: "Tahlilni o'chirdi",            icon: Trash2,       kind: 'danger' },
  // Umumiy CRUD
  'create':            { label: "Yangi yozuv qo'shdi",          icon: UserPlus,     kind: 'success' },
  'update':            { label: "Yozuvni yangiladi",            icon: Edit3,        kind: 'info' },
  'delete':            { label: "Yozuvni o'chirdi",             icon: Trash2,       kind: 'danger' },
  'archive':           { label: "Arxivga yubordi",              icon: UserX,        kind: 'warning' },
};

const ENTITY_DICT: Record<string, string> = {
  employee: 'Hodim',
  patient: 'Bemor',
  appointment: 'Qabul',
  treatment: 'Davolash',
  lab_result: 'Laboratoriya tahlili',
  prescription: 'Retsept',
  dental_record: 'Tish yozuvi',
  transaction: "To'lov",
  payroll: 'Oylik maosh',
  debt: 'Qarzdor',
  service: 'Xizmat',
  role: 'Rol',
  setting: 'Sozlama',
  endpoint: 'API endpoint',
  tech_product: 'Tibbiy mahsulot',
  tech_order: 'Buyurtma',
  call_task: "Qo'ng'iroq vazifasi",
};

function describe(log: AuditLog): { label: string; icon: typeof Shield; kind: ActionKind } {
  return ACTION_DICT[log.action] ?? {
    label: log.action.replace(/_/g, ' ').replace(/:/g, ' → '),
    icon: Activity,
    kind: 'info',
  };
}

function entityLabel(e: string): string {
  return ENTITY_DICT[e] ?? e;
}

function fmtTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sana = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const vaqt = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { sana, vaqt };
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'hozir';
  if (m < 60) return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} kun oldin`;
  return '';
}

type KindFilter = 'all' | ActionKind;

export function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const employees = useEmployees();

  useEffect(() => {
    const load = () => fetch('/api/audit-logs')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((rows) => setLogs(Array.isArray(rows) ? rows.sort((a, b) => b.at - a.at) : []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
    load();
    // Real-time — har 30 soniyada yangilash
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const actorName = (id: string | null): string => {
    if (!id) return '—';
    const e = employees.find((x) => x.id === id);
    if (!e) return id.slice(0, 8) + '…';
    return e.fullName;
  };

  const actorRole = (id: string | null): string => {
    if (!id) return '';
    const e = employees.find((x) => x.id === id);
    return e?.role ?? '';
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return logs.filter((l) => {
      const d = describe(l);
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false;
      if (!needle) return true;
      const hay = [
        actorName(l.actor),
        d.label,
        entityLabel(l.entity),
        l.entityId ?? '',
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [logs, q, kindFilter, employees]);

  const pg = usePagination(filtered, [filtered.length]);

  const stats = useMemo(() => {
    const r = { success: 0, warning: 0, danger: 0, info: 0 };
    for (const l of logs) r[describe(l).kind]++;
    return r;
  }, [logs]);

  return (
    <div className="admin-page">
      <style>{css}</style>

      <div className="admin-page-head">
        <div>
          <h1>Audit log</h1>
          <p>Tizimdagi barcha harakatlar — kim, qachon, nima qildi · <span className="rep-live"><span className="rep-live-dot" /> jonli (30 soniya)</span></p>
        </div>
        <div className="admin-page-actions">
          <button
            className="admin-btn admin-btn-primary"
            disabled={filtered.length === 0}
            onClick={() => exportCsv(`audit-log-${todayStamp()}`, filtered, [
              { header: 'Vaqt', get: (l) => fmtTime(l.at).sana + ' ' + fmtTime(l.at).vaqt },
              { header: 'Foydalanuvchi', get: (l) => actorName(l.actor) },
              { header: 'Rol', get: (l) => actorRole(l.actor) },
              { header: 'Harakat', get: (l) => describe(l).label },
              { header: 'Obyekt', get: (l) => entityLabel(l.entity) },
              { header: 'Obyekt ID', get: (l) => l.entityId ?? '' },
            ])}
          >
            <Download size={14} /> Excel (CSV)
          </button>
        </div>
      </div>

      {/* Statistika */}
      <div className="audit-stats">
        <button
          className={`audit-stat ${kindFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('all')}
        >
          <div className="audit-stat-ico" style={{ background: '#e2e8f0', color: '#475569' }}>
            <Activity size={18} />
          </div>
          <div>
            <small>Hammasi</small>
            <strong>{logs.length}</strong>
          </div>
        </button>
        <button
          className={`audit-stat ${kindFilter === 'success' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('success')}
        >
          <div className="audit-stat-ico" style={{ background: '#d1fae5', color: '#047857' }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <small>Muvaffaqiyatli</small>
            <strong>{stats.success}</strong>
          </div>
        </button>
        <button
          className={`audit-stat ${kindFilter === 'info' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('info')}
        >
          <div className="audit-stat-ico" style={{ background: '#dbeafe', color: '#1e40af' }}>
            <Edit3 size={18} />
          </div>
          <div>
            <small>Yangilash / kirish</small>
            <strong>{stats.info}</strong>
          </div>
        </button>
        <button
          className={`audit-stat ${kindFilter === 'warning' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('warning')}
        >
          <div className="audit-stat-ico" style={{ background: '#fef3c7', color: '#92400e' }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <small>Ogohlantirish</small>
            <strong>{stats.warning}</strong>
          </div>
        </button>
        <button
          className={`audit-stat ${kindFilter === 'danger' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('danger')}
        >
          <div className="audit-stat-ico" style={{ background: '#fee2e2', color: '#991b1b' }}>
            <Shield size={18} />
          </div>
          <div>
            <small>Bloklangan / o'chirilgan</small>
            <strong>{stats.danger}</strong>
          </div>
        </button>
      </div>

      <section className="admin-card">
        <div className="audit-toolbar">
          <div className="audit-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Foydalanuvchi, harakat, obyekt bo'yicha qidirish..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="audit-count">
            Topildi: <strong>{filtered.length}</strong>
            {filtered.length !== logs.length && ` / ${logs.length} dan`}
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table audit-table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Vaqt</th>
                <th>Foydalanuvchi</th>
                <th>Harakat</th>
                <th>Obyekt</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Yuklanmoqda…</td></tr>}
              {err && <tr><td colSpan={4} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24, color: '#dc2626' }}>Xatolik: {err}</td></tr>}
              {!loading && !err && filtered.length === 0 && (
                <tr><td colSpan={4} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Hech qanday yozuv topilmadi</td></tr>
              )}
              {pg.pageRows.map((l) => {
                const d = describe(l);
                const Icon = d.icon;
                const { sana, vaqt } = fmtTime(l.at);
                const ago = timeAgo(l.at);
                const name = actorName(l.actor);
                const role = actorRole(l.actor);
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="audit-time">
                        <strong>{vaqt}</strong>
                        <small>{sana}{ago && ` · ${ago}`}</small>
                      </div>
                    </td>
                    <td>
                      <div className="audit-user">
                        <div className="audit-user-avatar">{name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}</div>
                        <div>
                          <strong>{name}</strong>
                          {role && <small>{role}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`audit-action audit-action-${d.kind}`}>
                        <span className="audit-action-ico"><Icon size={14} /></span>
                        <span>{d.label}</span>
                      </div>
                    </td>
                    <td>
                      <div className="audit-entity">
                        <strong>{entityLabel(l.entity)}</strong>
                        {l.entityId && <small>{l.entityId.length > 40 ? l.entityId.slice(0, 40) + '…' : l.entityId}</small>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>
    </div>
  );
}

const css = `
.rep-live {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 10px; font-size: 11px;
  background: #d1fae5; color: #065f46; font-weight: 700;
}
.rep-live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #10b981;
  animation: live-pulse 1.4s ease-in-out infinite;
}
@keyframes live-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }

.audit-stats {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px;
}
.audit-stat {
  display: flex; gap: 12px; align-items: center;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 12px 14px; text-align: left;
  cursor: pointer; transition: all .15s;
}
.audit-stat:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -10px rgba(0,0,0,.1); }
.audit-stat.is-active { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15); }
.audit-stat-ico {
  width: 36px; height: 36px; border-radius: 8px;
  display: grid; place-items: center; flex-shrink: 0;
}
.audit-stat small { display: block; font-size: 10.5px; color: #64748b; text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }
.audit-stat strong { display: block; font-size: 18px; color: #0f172a; margin-top: 2px; font-variant-numeric: tabular-nums; }
@media (max-width: 820px) { .audit-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .audit-stats { grid-template-columns: 1fr 1fr; } }

.audit-toolbar {
  display: flex; gap: 12px; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
}
.audit-search {
  display: flex; align-items: center; gap: 8px;
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 8px 12px; flex: 1 1 280px;
}
.audit-search input {
  border: 0; background: transparent; outline: none; flex: 1; font-size: 13px;
}
.audit-count { font-size: 13px; color: #64748b; }
.audit-count strong { color: #0f172a; }

.audit-table tbody tr:hover { background: #fafbfc; }
.audit-table td { padding: 10px 14px; vertical-align: middle; }

.audit-time strong { display: block; font-size: 13px; color: #0f172a; font-variant-numeric: tabular-nums; }
.audit-time small { display: block; font-size: 11px; color: #94a3b8; }

.audit-user { display: flex; gap: 10px; align-items: center; }
.audit-user-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff; font-size: 11px; font-weight: 700;
  display: grid; place-items: center; flex-shrink: 0;
}
.audit-user strong { display: block; font-size: 13px; color: #0f172a; }
.audit-user small { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }

.audit-action {
  display: inline-flex; gap: 6px; align-items: center;
  padding: 5px 10px; border-radius: 6px; font-size: 12.5px; font-weight: 500;
}
.audit-action-ico { display: inline-flex; }
.audit-action-success { background: #d1fae5; color: #047857; }
.audit-action-info    { background: #dbeafe; color: #1e40af; }
.audit-action-warning { background: #fef3c7; color: #92400e; }
.audit-action-danger  { background: #fee2e2; color: #991b1b; }

.audit-entity strong { display: block; font-size: 13px; color: #0f172a; }
.audit-entity small { display: block; font-size: 10.5px; color: #94a3b8; font-family: ui-monospace, monospace; }
`;
