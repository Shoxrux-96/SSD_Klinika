import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Phone, PhoneCall, Clock, AlertCircle, Plus, SlidersHorizontal, Check, ChevronRight,
  X, Search, BarChart3, Save, User, FileText, Stethoscope, Flag, Calendar, Zap, Star,
} from 'lucide-react';
import { usePatients, useEmployees } from '../store';
import { useTreatments } from '../clinicalData';

/* ------- Call Task store (DB-backed via /api/call-tasks) ------- */
export type CallTask = {
  id: string;
  patientId?: string;
  patient: string;
  phone?: string;
  doctor?: string;
  reason: string;        // "Davolash tugallandi va to'landi", "Follow-up", etc
  priority: 'oddiy' | 'muhim' | 'shoshilinch';
  dueDate: string;       // YYYY-MM-DD
  status: 'kutilmoqda' | 'bajarildi' | 'bekor';
  completedAt?: number;
  note?: string;
  createdAt: number;
};

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const txt = await res.text(); return txt ? (JSON.parse(txt) as T) : (undefined as T);
}

// DB row → CallTask
function toTask(r: any): CallTask {
  return {
    id: r.id,
    patientId: r.patientId ?? undefined,
    patient: r.patient,
    phone: r.phone ?? undefined,
    doctor: r.doctor ?? undefined,
    reason: r.reason,
    priority: r.priority ?? 'oddiy',
    dueDate: r.dueDate,
    status: r.status ?? 'kutilmoqda',
    completedAt: r.completedAt ?? undefined,
    note: r.note ?? undefined,
    createdAt: Number(r.createdAt) || Date.now(),
  };
}

let state: CallTask[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function sub(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    // Eski localStorage kalitlarini (agar qolgan bo'lsa) tozalab yuboramiz —
    // Call markaz endi faqat DB bilan ishlaydi.
    try { localStorage.removeItem('ssd:call-tasks:v1'); } catch {}
    try { localStorage.removeItem('ssd:call-log:v1'); } catch {}
    const rows = await api<any[]>('/call-tasks');
    state = rows.map(toTask);
    emit();
  } catch (e) { console.error('call-tasks hydrate failed', e); }
}

function useCallTasks(): CallTask[] {
  useEffect(() => { hydrate(); }, []);
  return useSyncExternalStore(sub, () => state, () => state);
}

async function addTask(t: Omit<CallTask, 'id' | 'createdAt' | 'status'>): Promise<CallTask | null> {
  try {
    const created = await api<any>('/call-tasks', {
      method: 'POST',
      body: JSON.stringify({
        patientId: t.patientId ?? null,
        patient: t.patient,
        phone: t.phone ?? null,
        doctor: t.doctor ?? null,
        reason: t.reason,
        priority: t.priority,
        dueDate: t.dueDate,
      }),
    });
    const row = toTask(created);
    state = [row, ...state];
    emit();
    return row;
  } catch (e) { console.error('addTask failed', e); return null; }
}

async function updateTask(id: string, patch: Partial<CallTask>): Promise<void> {
  // optimistic
  const prev = state;
  state = state.map((t) => t.id === id ? { ...t, ...patch } : t);
  emit();
  try {
    await api(`/call-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  } catch (e) {
    console.error('updateTask failed, rolling back', e);
    state = prev; emit();
  }
}

/* ------- Call Log store (DB-backed via /api/call-logs) ------- */
type CallLogEntry = {
  id: string;
  taskId?: string;
  patient: string;
  phone?: string;
  outcome: 'javob berdi' | 'javob yoq' | 'band' | 'notogri raqam';
  duration?: number;  // seconds
  note?: string;
  at: number;
};

function toLog(r: any): CallLogEntry {
  return {
    id: r.id,
    taskId: r.taskId ?? undefined,
    patient: r.patient,
    phone: r.phone ?? undefined,
    outcome: r.outcome,
    duration: r.duration ?? undefined,
    note: r.note ?? undefined,
    at: Number(r.at) || Date.now(),
  };
}

let logState: CallLogEntry[] = [];
let logHydrated = false;
const logListeners = new Set<() => void>();
function logEmit() { logListeners.forEach((l) => l()); }
function logSub(l: () => void) { logListeners.add(l); return () => logListeners.delete(l); }

async function logHydrate() {
  if (logHydrated || typeof window === 'undefined') return;
  logHydrated = true;
  try {
    const rows = await api<any[]>('/call-logs');
    logState = rows.map(toLog);
    logEmit();
  } catch (e) { console.error('call-logs hydrate failed', e); }
}

function useCallLog(): CallLogEntry[] {
  useEffect(() => { logHydrate(); }, []);
  return useSyncExternalStore(logSub, () => logState, () => logState);
}

async function addLog(e: Omit<CallLogEntry, 'id'>): Promise<void> {
  try {
    const created = await api<any>('/call-logs', {
      method: 'POST',
      body: JSON.stringify({
        taskId: e.taskId ?? null,
        patient: e.patient,
        phone: e.phone ?? null,
        outcome: e.outcome,
        duration: e.duration ?? null,
        note: e.note ?? null,
        at: e.at,
      }),
    });
    logState = [toLog(created), ...logState];
    logEmit();
  } catch (err) { console.error('addLog failed', err); }
}

/* ------- Utils ------- */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Tab = 'tasks' | 'log' | 'analytics';

export function CallCenter() {
  const tasks = useCallTasks();
  const log = useCallLog();
  const patients = usePatients();
  const employees = useEmployees();
  const treatments = useTreatments();

  const [tab, setTab] = useState<Tab>('tasks');
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | CallTask['priority']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CallTask['status']>('kutilmoqda');
  const [callModal, setCallModal] = useState<CallTask | null>(null);

  const today = todayISO();
  const currentYM = today.slice(0, 7);
  const [monthFilter, setMonthFilter] = useState<string>(currentYM);
  const [pageSize, setPageSize] = useState<number>(15);
  const [page, setPage] = useState<number>(1);
  const [logPage, setLogPage] = useState<number>(1);
  const [logPageSize, setLogPageSize] = useState<number>(15);

  // Bir martalik dedup + avtoseed — ref'lar orqali qayta ishlab ketmaydi.
  const didCleanup = useRef(false);
  const seededKeys = useRef<Set<string>>(new Set());

  // 1) DB'dagi eski dublikatlarni bir marta tozalash
  useEffect(() => {
    if (!hydrated || didCleanup.current || tasks.length === 0) return;
    didCleanup.current = true;
    const groups = new Map<string, CallTask[]>();
    tasks.forEach((t) => {
      const key = `${t.patient}::${t.dueDate.slice(0, 7)}`;
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    });
    const toDelete: string[] = [];
    groups.forEach((arr) => {
      if (arr.length < 2) return;
      const prio = (x: CallTask) => (x.status === 'kutilmoqda' ? 2 : x.status === 'bajarildi' ? 1 : 0);
      arr.sort((a, b) => prio(b) - prio(a) || b.createdAt - a.createdAt);
      arr.slice(1).forEach((x) => toDelete.push(x.id));
    });
    if (toDelete.length > 0) {
      Promise.all(toDelete.map((id) =>
        fetch(`/api/call-tasks/${id}`, { method: 'DELETE' }).catch(() => null),
      )).then(() => {
        state = state.filter((t) => !toDelete.includes(t.id));
        emit();
      });
    }
  }, [tasks.length]);

  // 2) Avtomatik topshiriq — har bemorga oyda BITTA.
  //    Qoida: agar bemorning OCHIQ (kutilmoqda) topshirig'i bo'lsa — yangisi yaratilmaydi.
  //    Oy almashganda shu bemorning oldingi topshirig'i bajarilgan/bekor bo'lsa — yangi oyga yangisi yaratiladi.
  useEffect(() => {
    if (!hydrated) return;
    // bemor → eng yangi topshirig'i xaritasi
    const latestByPatient = new Map<string, CallTask>();
    tasks.forEach((t) => {
      const prev = latestByPatient.get(t.patient);
      if (!prev || t.createdAt > prev.createdAt) latestByPatient.set(t.patient, t);
    });
    const uniqByPatient = new Map<string, typeof treatments[0]>();
    treatments.forEach((t) => {
      if (t.status !== 'davolanmoqda' && t.status !== 'yakunlandi') return;
      const prev = uniqByPatient.get(t.patient);
      if (!prev || (t.date ?? '') > (prev.date ?? '')) uniqByPatient.set(t.patient, t);
    });
    uniqByPatient.forEach((t) => {
      const existing = latestByPatient.get(t.patient);
      // 1) agar ochiq topshiriq bor bo'lsa — qayta yaratmaslik
      if (existing && existing.status === 'kutilmoqda') return;
      // 2) agar oldingi topshiriq shu oyda yaratilgan bo'lsa (hatto bajarilgan) — yaratmaslik
      if (existing && existing.dueDate.startsWith(currentYM)) return;
      // 3) sessiya ichida in-flight guard
      const key = `${t.patient}::${currentYM}`;
      if (seededKeys.current.has(key)) return;
      seededKeys.current.add(key);
      const p = patients.find((x) => x.fullName === t.patient);
      const isDone = t.status === 'yakunlandi';
      addTask({
        patient: t.patient, patientId: p?.id, phone: p?.phone, doctor: t.doctor,
        reason: isDone
          ? `Davolash yakunlandi — fikr va natija so‘rash`
          : `Oylik follow-up · ${currentYM}`,
        priority: isDone ? 'oddiy' : 'muhim',
        dueDate: today, // ← HAR DOIM today — existingKey/dueDate kelishmovchiligi oldini oladi
      });
    });
  }, [treatments.length, patients.length, currentYM, tasks.length]);

  // Barcha mavjud oylar (topshiriq + jurnal) — filtr uchun
  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.dueDate && s.add(t.dueDate.slice(0, 7)));
    log.forEach((l) => s.add(new Date(l.at).toISOString().slice(0, 7)));
    s.add(currentYM);
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [tasks, log, currentYM]);

  const stats = useMemo(() => {
    const scope = monthFilter === 'all' ? tasks : tasks.filter((t) => t.dueDate.startsWith(monthFilter));
    const pending = scope.filter((t) => t.status === 'kutilmoqda');
    const bugun = pending.filter((t) => t.dueDate === today).length;
    const kechikkan = pending.filter((t) => t.dueDate < today).length;
    const jami = pending.length;
    return { bugun, kechikkan, jami };
  }, [tasks, today, monthFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Har (bemor + oy) juftligi uchun faqat BITTA topshiriq — dublikatlar yashirin
    const dedupMap = new Map<string, CallTask>();
    tasks.forEach((t) => {
      const key = `${t.patient}::${t.dueDate.slice(0, 7)}`;
      const prev = dedupMap.get(key);
      if (!prev) { dedupMap.set(key, t); return; }
      // Kutilmoqda > boshqa statuslar; eng so'nggi createdAt ustun
      const prio = (x: CallTask) => (x.status === 'kutilmoqda' ? 2 : x.status === 'bajarildi' ? 1 : 0);
      if (prio(t) > prio(prev) || (prio(t) === prio(prev) && t.createdAt > prev.createdAt)) {
        dedupMap.set(key, t);
      }
    });
    return Array.from(dedupMap.values())
      .filter((t) => monthFilter === 'all' || t.dueDate.startsWith(monthFilter))
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => priorityFilter === 'all' || t.priority === priorityFilter)
      .filter((t) => !q || (t.patient + (t.phone ?? '') + t.reason + (t.doctor ?? '')).toLowerCase().includes(q))
      .sort((a, b) => {
        const ao = a.dueDate < today ? 0 : a.dueDate === today ? 1 : 2;
        const bo = b.dueDate < today ? 0 : b.dueDate === today ? 1 : 2;
        if (ao !== bo) return ao - bo;
        return a.dueDate < b.dueDate ? -1 : 1;
      });
  }, [tasks, query, statusFilter, priorityFilter, today, monthFilter]);

  useEffect(() => { setPage(1); }, [monthFilter, statusFilter, priorityFilter, query, pageSize]);
  useEffect(() => { setLogPage(1); }, [monthFilter, logPageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedTasks = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="admin-card call-center">
      <style>{callStyles}</style>

      <div className="cc-head">
        <div className="cc-title">
          <span className="cc-title-ico"><PhoneCall size={18} /></span>
          <h3>Call markaz</h3>
        </div>

        <div className="cc-head-right">
          <div className="cc-stats">
            <span className="cc-stat"><Clock size={12} /> <b>{stats.bugun}</b> bugun</span>
            <span className="cc-stat cc-stat-warn"><AlertCircle size={12} /> <b>{stats.kechikkan}</b> kechikkan</span>
            <span className="cc-stat cc-stat-neutral"><b>{stats.jami}</b> jami kutilmoqda</span>
          </div>
          <div className="cc-month-wrap">
            <Calendar size={13} />
            <select className="cc-month-sel" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="all">Barcha oylar</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <button className="admin-btn admin-btn-primary cc-new-btn" onClick={() => setShowNew(true)}>
            <Plus size={14} /> Topshiriq
          </button>
        </div>
      </div>

      <div className="cc-tabs-row">
        <div className="cc-tabs">
          <button className={`cc-tab ${tab === 'tasks' ? 'is-active' : ''}`} onClick={() => setTab('tasks')}>
            Topshiriqlar <span className="cc-tab-count">{tasks.filter((t) => t.status === 'kutilmoqda').length}</span>
          </button>
          <button className={`cc-tab ${tab === 'log' ? 'is-active' : ''}`} onClick={() => setTab('log')}>
            Qo‘ng‘iroqlar jurnali
          </button>
          <button className={`cc-tab ${tab === 'analytics' ? 'is-active' : ''}`} onClick={() => setTab('analytics')}>
            Tahlil
          </button>
        </div>

        {tab === 'tasks' && (
          <div className="cc-tools">
            <div className="cc-search">
              <Search size={13} />
              <input
                type="search"
                placeholder="Bemor yoki raqam qidirish…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className={`admin-btn admin-btn-ghost ${showFilter ? 'is-active' : ''}`}
              onClick={() => setShowFilter(!showFilter)}
            >
              <SlidersHorizontal size={13} /> Filtr
            </button>
          </div>
        )}
      </div>

      {showFilter && tab === 'tasks' && (
        <div className="cc-filter-row">
          <div>
            <small>Status:</small>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">Barchasi</option>
              <option value="kutilmoqda">Kutilmoqda</option>
              <option value="bajarildi">Bajarildi</option>
              <option value="bekor">Bekor qilindi</option>
            </select>
          </div>
          <div>
            <small>Prioritet:</small>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
              <option value="all">Barchasi</option>
              <option value="oddiy">Oddiy</option>
              <option value="muhim">Muhim</option>
              <option value="shoshilinch">Shoshilinch</option>
            </select>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="cc-list">
          {filtered.length === 0 && <div className="cc-empty">Topshiriqlar yo‘q</div>}
          {pagedTasks.map((t) => {
            const overdue = t.status === 'kutilmoqda' && t.dueDate < today;
            const taskLogs = log.filter((l) => l.taskId === t.id);
            const hasLog = taskLogs.length > 0;
            return (
              <div key={t.id} className={`cc-row ${overdue ? 'is-overdue' : ''} ${t.status === 'bajarildi' ? 'is-done' : ''}`}>
                <div className="cc-ava" title={t.patient}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 3c-2 0-3 1.4-3 3.5C3 10 5 14 7 20c.4 1 1.6 1 1.9-.1C9.8 16 10.3 13 12 13s2.2 3 3.1 6.9c.3 1.1 1.5 1.1 1.9.1 2-6 4-10 4-13.5C21 4.4 20 3 18 3c-1.5 0-2.5 1-3 2-.6-1-1.5-2-3-2s-2.4 1-3 2c-.5-1-1.5-2-3-2z"/>
                  </svg>
                </div>

                <div className="cc-main">
                  <div className="cc-line-1">
                    <strong>{t.patient}</strong>
                    {t.phone && <a href={`tel:${t.phone}`} className="cc-phone">{t.phone}</a>}
                    {hasLog && (
                      <span className="cc-logged-badge" title="Jurnalga yozilgan">
                        <Check size={10} /> jurnalga yozilgan
                      </span>
                    )}
                  </div>
                  <div className="cc-line-2">{t.reason}</div>
                  {hasLog && taskLogs[0].note && (
                    <div className="cc-note-preview" title={taskLogs[0].note}>
                      <FileText size={11} /> {taskLogs[0].note}
                    </div>
                  )}
                </div>

                <div className="cc-meta">
                  <span className={`cc-badge cc-prio-${t.priority}`}>
                    {t.priority === 'oddiy' ? 'Oddiy' : t.priority === 'muhim' ? 'Muhim' : 'Shoshilinch'}
                  </span>
                  <span className={`cc-date ${overdue ? 'is-overdue' : ''}`}>{t.dueDate}</span>
                </div>

                <div className="cc-actions">
                  <button
                    className="cc-icon-btn"
                    title="Qo‘ng‘iroq qilish — jurnalga yozish"
                    onClick={() => setCallModal(t)}
                  >
                    <Phone size={14} />
                  </button>
                  {t.status === 'kutilmoqda' && (
                    <button
                      className={`cc-icon-btn cc-icon-btn-ok ${!hasLog ? 'is-locked' : ''}`}
                      title={hasLog
                        ? 'Bajarildi deb belgilash — topshiriq o‘chadi, jurnalda qoladi'
                        : 'Avval qo‘ng‘iroq qilib jurnalga yozing'}
                      disabled={!hasLog}
                      onClick={() => {
                        if (!hasLog) { setCallModal(t); return; }
                        updateTask(t.id, { status: 'bajarildi', completedAt: Date.now() });
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    className="cc-icon-btn"
                    title="Keyingi kunga ko‘chirish"
                    onClick={() => updateTask(t.id, { dueDate: nextDay(t.dueDate) })}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'tasks' && filtered.length > 0 && (
        <Pagination
          page={page} totalPages={totalPages} pageSize={pageSize}
          total={filtered.length}
          onPage={setPage} onPageSize={setPageSize}
        />
      )}

      {tab === 'log' && (
        <CallLogPanel
          log={log}
          monthFilter={monthFilter}
          page={logPage} pageSize={logPageSize}
          onPage={setLogPage} onPageSize={setLogPageSize}
        />
      )}
      {tab === 'analytics' && <CallAnalyticsPanel tasks={tasks} log={log} monthFilter={monthFilter} />}

      {showNew && (
        <NewTaskModal
          patients={patients}
          employees={employees}
          onClose={() => setShowNew(false)}
          onSave={(t) => { addTask(t); setShowNew(false); }}
        />
      )}

      {callModal && (
        <CallModal
          task={callModal}
          onClose={() => setCallModal(null)}
          onLog={(outcome, note) => {
            addLog({ taskId: callModal.id, patient: callModal.patient, phone: callModal.phone, outcome, note, at: Date.now() });
            setCallModal(null);
          }}
        />
      )}
    </section>
  );
}

function nextDay(iso: string): string {
  const d = new Date(iso); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ------- Pagination ------- */
function Pagination({
  page, totalPages, pageSize, total, onPage, onPageSize,
}: {
  page: number; totalPages: number; pageSize: number; total: number;
  onPage: (n: number) => void; onPageSize: (n: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="cc-pager">
      <div className="cc-pager-info">
        <span>{from}–{to} / {total}</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          <option value={15}>15 qator</option>
          <option value={30}>30 qator</option>
          <option value={50}>50 qator</option>
        </select>
      </div>
      <div className="cc-pager-nav">
        <button disabled={page <= 1} onClick={() => onPage(1)}>«</button>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        <span className="cc-pager-page">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</button>
        <button disabled={page >= totalPages} onClick={() => onPage(totalPages)}>»</button>
      </div>
    </div>
  );
}

/* ------- Call Log Panel ------- */
function CallLogPanel({
  log, monthFilter, page, pageSize, onPage, onPageSize,
}: {
  log: CallLogEntry[]; monthFilter: string;
  page: number; pageSize: number;
  onPage: (n: number) => void; onPageSize: (n: number) => void;
}) {
  const outcomeLabel = (o: CallLogEntry['outcome']) => ({
    'javob berdi': 'Javob berdi', 'javob yoq': 'Javob yo‘q', 'band': 'Band', 'notogri raqam': "Noto‘g‘ri raqam"
  }[o]);
  const outcomeClass = (o: CallLogEntry['outcome']) =>
    o === 'javob berdi' ? 'cc-out-ok' : o === 'javob yoq' ? 'cc-out-warn' : 'cc-out-bad';

  const filtered = useMemo(() => {
    return log
      .filter((l) => monthFilter === 'all' || new Date(l.at).toISOString().slice(0, 7) === monthFilter)
      .sort((a, b) => b.at - a.at);
  }, [log, monthFilter]);

  if (filtered.length === 0) return <div className="cc-empty">Qo‘ng‘iroqlar jurnali bo‘sh</div>;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const [openNote, setOpenNote] = useState<CallLogEntry | null>(null);

  return (
    <>
      <div className="cc-list">
        {paged.map((l) => (
          <div key={l.id} className="cc-log-row">
            <div className="cc-log-time">{new Date(l.at).toLocaleString('uz-UZ')}</div>
            <div className="cc-log-patient">
              <strong>{l.patient}</strong>
              {l.phone && <small>{l.phone}</small>}
            </div>
            <div><span className={`cc-badge ${outcomeClass(l.outcome)}`}>{outcomeLabel(l.outcome)}</span></div>
            <div className="cc-log-note">
              {l.note ? (
                <button className="cc-log-note-btn" onClick={() => setOpenNote(l)} title="To‘liq ko‘rish">
                  <FileText size={12} /> {l.note}
                </button>
              ) : (
                <span className="cc-log-note-empty">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pagination
        page={page} totalPages={totalPages} pageSize={pageSize}
        total={filtered.length}
        onPage={onPage} onPageSize={onPageSize}
      />
      {openNote && (
        <div className="nt-backdrop" onClick={() => setOpenNote(null)}>
          <div className="nt-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="nt-head">
              <div className="nt-head-left">
                <div className="nt-head-ico" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}><FileText size={20} /></div>
                <div>
                  <h2>Bemorning fikrlari</h2>
                  <p>{openNote.patient} · {new Date(openNote.at).toLocaleString('uz-UZ')}</p>
                </div>
              </div>
              <button className="nt-close" onClick={() => setOpenNote(null)}><X size={18} /></button>
            </div>
            <div className="nt-body">
              <div className="cc-note-full">{openNote.note}</div>
              <div className="cc-note-outcome">
                <small>Natija:</small>
                <span className={`cc-badge ${outcomeClass(openNote.outcome)}`}>{outcomeLabel(openNote.outcome)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------- Analytics Panel ------- */
function CallAnalyticsPanel({ tasks, log, monthFilter }: { tasks: CallTask[]; log: CallLogEntry[]; monthFilter: string }) {
  const scopedTasks = monthFilter === 'all' ? tasks : tasks.filter((t) => t.dueDate.startsWith(monthFilter));
  const scopedLog = monthFilter === 'all'
    ? log
    : log.filter((l) => new Date(l.at).toISOString().slice(0, 7) === monthFilter);

  const total = scopedTasks.length;
  const done = scopedTasks.filter((t) => t.status === 'bajarildi').length;
  const pending = scopedTasks.filter((t) => t.status === 'kutilmoqda').length;
  const cancelled = scopedTasks.filter((t) => t.status === 'bekor').length;
  const answered = scopedLog.filter((l) => l.outcome === 'javob berdi').length;
  const noAnswer = scopedLog.filter((l) => l.outcome === 'javob yoq').length;
  const successRate = scopedLog.length > 0 ? Math.round((answered / scopedLog.length) * 100) : 0;
  const withFeedback = scopedLog.filter((l) => l.outcome === 'javob berdi' && (l.note ?? '').trim().length > 0).length;

  return (
    <div className="cc-analytics">
      <div className="cc-stat-card"><small>Jami topshiriq</small><strong>{total}</strong></div>
      <div className="cc-stat-card cc-stat-card-ok"><small>Bajarildi</small><strong>{done}</strong></div>
      <div className="cc-stat-card cc-stat-card-pending"><small>Kutilmoqda</small><strong>{pending}</strong></div>
      <div className="cc-stat-card cc-stat-card-bad"><small>Bekor qilindi</small><strong>{cancelled}</strong></div>
      <div className="cc-stat-card"><small>Jami qo‘ng‘iroqlar</small><strong>{scopedLog.length}</strong></div>
      <div className="cc-stat-card cc-stat-card-ok"><small>Javob berdi</small><strong>{answered}</strong></div>
      <div className="cc-stat-card cc-stat-card-bad"><small>Javob yo‘q</small><strong>{noAnswer}</strong></div>
      <div className="cc-stat-card cc-stat-card-primary"><small>Muvaffaqiyat %</small><strong>{successRate}%</strong></div>
      <div className="cc-stat-card cc-stat-card-pending"><small>Fikr yozilgan</small><strong>{withFeedback}</strong></div>
    </div>
  );
}

/* ------- New Task Modal ------- */
function NewTaskModal({
  patients, employees, onClose, onSave,
}: {
  patients: ReturnType<typeof usePatients>;
  employees: ReturnType<typeof useEmployees>;
  onClose: () => void;
  onSave: (t: Omit<CallTask, 'id' | 'createdAt' | 'status'>) => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [doctor, setDoctor] = useState('');
  const [priority, setPriority] = useState<CallTask['priority']>('oddiy');
  const [dueDate, setDueDate] = useState(todayISO());

  const patient = patients.find((p) => p.id === patientId);
  const canSave = !!patient && reason.trim().length > 0;

  const quickReasons = [
    "Follow-up qo‘ng‘iroq",
    "Davolanish eslatmasi",
    "Natijalarni bildirish",
    "Qabulga chaqirish",
  ];

  return (
    <div className="nt-backdrop" onClick={onClose}>
      <div className="nt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nt-head">
          <div className="nt-head-left">
            <div className="nt-head-ico"><PhoneCall size={20} /></div>
            <div>
              <h2>Yangi topshiriq</h2>
              <p>Bemorga qo‘ng‘iroq qilish uchun topshiriq yarating</p>
            </div>
          </div>
          <button className="nt-close" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="nt-body">
          <div className="nt-field">
            <label><User size={13} /> Bemor <span className="nt-req">*</span></label>
            <div className="nt-select-wrap">
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">— bemor tanlang —</option>
                {patients.filter((p) => !p.archived).map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}{p.phone ? ` · ${p.phone}` : ''}</option>
                ))}
              </select>
            </div>
            {patient && (
              <div className="nt-patient-chip">
                <div className="nt-pc-avatar">{patient.fullName.charAt(0)}</div>
                <div>
                  <strong>{patient.fullName}</strong>
                  {patient.phone && <small>{patient.phone}</small>}
                </div>
              </div>
            )}
          </div>

          <div className="nt-field">
            <label><FileText size={13} /> Sabab <span className="nt-req">*</span></label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: Follow-up, davolanish eslatmasi…"
            />
            <div className="nt-quick-reasons">
              {quickReasons.map((q) => (
                <button type="button" key={q} className="nt-chip" onClick={() => setReason(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="nt-grid-2">
            <div className="nt-field">
              <label><Stethoscope size={13} /> Shifokor</label>
              <div className="nt-select-wrap">
                <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
                  <option value="">— tanlanmagan —</option>
                  {employees.filter((e) => e.category === 'medical' && !e.archived).map((e) => (
                    <option key={e.id} value={e.fullName}>{e.fullName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="nt-field">
              <label><Calendar size={13} /> Muddat</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="nt-field">
            <label><Flag size={13} /> Prioritet</label>
            <div className="nt-prio-row">
              <button
                type="button"
                className={`nt-prio nt-prio-oddiy ${priority === 'oddiy' ? 'is-active' : ''}`}
                onClick={() => setPriority('oddiy')}
              >
                <Flag size={14} /> Oddiy
              </button>
              <button
                type="button"
                className={`nt-prio nt-prio-muhim ${priority === 'muhim' ? 'is-active' : ''}`}
                onClick={() => setPriority('muhim')}
              >
                <Star size={14} /> Muhim
              </button>
              <button
                type="button"
                className={`nt-prio nt-prio-shoshilinch ${priority === 'shoshilinch' ? 'is-active' : ''}`}
                onClick={() => setPriority('shoshilinch')}
              >
                <Zap size={14} /> Shoshilinch
              </button>
            </div>
          </div>
        </div>

        <div className="nt-foot">
          <button className="nt-btn nt-btn-ghost" onClick={onClose}>Bekor</button>
          <button
            className="nt-btn nt-btn-primary"
            disabled={!canSave}
            onClick={() => {
              if (!patient) return;
              onSave({
                patientId: patient.id, patient: patient.fullName, phone: patient.phone,
                reason: reason.trim(), doctor, priority, dueDate,
              });
            }}
          >
            <Save size={15} /> Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------- Call Modal ------- */
function CallModal({ task, onClose, onLog }: {
  task: CallTask; onClose: () => void;
  onLog: (outcome: CallLogEntry['outcome'], note?: string) => void;
}) {
  const [outcome, setOutcome] = useState<CallLogEntry['outcome']>('javob berdi');
  const [note, setNote] = useState('');

  const outcomes: { key: CallLogEntry['outcome']; label: string; cls: string }[] = [
    { key: 'javob berdi',   label: 'Javob berdi',  cls: 'cm-oc-ok' },
    { key: 'javob yoq',     label: 'Javob yo‘q',   cls: 'cm-oc-warn' },
    { key: 'band',          label: 'Band',         cls: 'cm-oc-warn' },
    { key: 'notogri raqam', label: 'Noto‘g‘ri',    cls: 'cm-oc-bad' },
  ];

  return (
    <div className="nt-backdrop" onClick={onClose}>
      <div className="nt-modal cm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nt-head cm-head">
          <div className="nt-head-left">
            <div className="nt-head-ico cm-head-ico"><Phone size={20} /></div>
            <div>
              <h2>Qo‘ng‘iroq qilish</h2>
              <p>Qo‘ng‘iroq natijasini jurnalga yozing</p>
            </div>
          </div>
          <button className="nt-close" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="nt-body">
          <div className="cm-patient">
            <div className="cm-pt-avatar">{task.patient.charAt(0).toUpperCase()}</div>
            <div className="cm-pt-info">
              <strong>{task.patient}</strong>
              {task.doctor && <small>Shifokor: {task.doctor}</small>}
            </div>
          </div>

          {task.phone && (
            <a href={`tel:${task.phone}`} className="cm-dial">
              <div className="cm-dial-ico"><Phone size={22} /></div>
              <div className="cm-dial-text">
                <small>Telefon raqam</small>
                <strong>{task.phone}</strong>
              </div>
              <div className="cm-dial-cta">Qo‘ng‘iroq <ChevronRight size={16} /></div>
            </a>
          )}

          <div className="nt-field">
            <label><Check size={13} /> Qo‘ng‘iroq natijasi</label>
            <div className="cm-outcomes">
              {outcomes.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`cm-oc ${o.cls} ${outcome === o.key ? 'is-active' : ''}`}
                  onClick={() => setOutcome(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="nt-field">
            <label><FileText size={13} /> Bemorning fikrlari</label>
            <textarea
              className="cm-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bemorning fikr va shikoyatlarini yozing…"
              rows={3}
            />
          </div>
        </div>

        <div className="nt-foot">
          <button className="nt-btn nt-btn-ghost" onClick={onClose}>Bekor</button>
          <button
            className="nt-btn nt-btn-primary cm-save"
            onClick={() => onLog(outcome, note || undefined)}
          >
            <Save size={15} /> Jurnalga yozish
          </button>
        </div>
      </div>
    </div>
  );
}

const callStyles = `
.call-center { background: #0f172a; color: #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 20px; }
.call-center .cc-head {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,.08);
}
.cc-title { display: flex; align-items: center; gap: 10px; }
.cc-title-ico { width: 34px; height: 34px; border-radius: 10px; background: rgba(79, 70, 229, .25); color: #a5b4fc; display: grid; place-items: center; }
.cc-title h3 { margin: 0; font-size: 18px; color: #fff; }
.cc-head-right { display: flex; align-items: center; gap: 12px; }
.cc-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.cc-stat {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,.06); padding: 6px 12px; border-radius: 8px;
  font-size: 12px; color: #cbd5e1;
}
.cc-stat b { color: #fff; font-weight: 700; }
.cc-stat-warn { background: rgba(239,68,68,.15); color: #fca5a5; }
.cc-stat-warn b { color: #fca5a5; }
.cc-stat-neutral { background: rgba(255,255,255,.08); }

.cc-new-btn { background: #2563eb !important; border-color: #2563eb !important; color: #fff !important; }

.cc-month-wrap {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08);
  padding: 6px 10px; border-radius: 8px; color: #cbd5e1;
}
.cc-month-wrap svg { color: #818cf8; }
.cc-month-sel {
  background: transparent; border: 0; color: #e2e8f0; font-size: 12.5px; font-weight: 600;
  outline: none; cursor: pointer; font-variant-numeric: tabular-nums;
}
.cc-month-sel option { background: #1e293b; color: #e2e8f0; }

.cc-pager {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 22px; border-top: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.02);
  flex-wrap: wrap;
}
.cc-pager-info { display: inline-flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 12.5px; }
.cc-pager-info select {
  background: rgba(255,255,255,.06); color: #e2e8f0;
  border: 1px solid rgba(255,255,255,.08);
  padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.cc-pager-nav { display: inline-flex; align-items: center; gap: 4px; }
.cc-pager-nav button {
  min-width: 30px; height: 30px; padding: 0 8px;
  background: rgba(255,255,255,.06); color: #cbd5e1;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px; cursor: pointer; font-weight: 700; font-size: 13px;
  transition: all .12s;
}
.cc-pager-nav button:hover:not(:disabled) { background: rgba(96,165,250,.2); color: #93c5fd; border-color: rgba(96,165,250,.3); }
.cc-pager-nav button:disabled { opacity: .35; cursor: not-allowed; }
.cc-pager-page { color: #cbd5e1; font-size: 12.5px; font-weight: 600; padding: 0 8px; font-variant-numeric: tabular-nums; }

.cc-tabs-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 22px; border-bottom: 1px solid rgba(255,255,255,.08);
  gap: 16px; flex-wrap: wrap;
}
.cc-tabs { display: flex; gap: 2px; }
.cc-tab {
  background: transparent; border: 0; color: #94a3b8; font-size: 13px; font-weight: 600;
  padding: 14px 14px; cursor: pointer; border-bottom: 2px solid transparent;
  display: inline-flex; align-items: center; gap: 6px;
}
.cc-tab:hover { color: #cbd5e1; }
.cc-tab.is-active { color: #60a5fa; border-bottom-color: #60a5fa; }
.cc-tab-count { background: rgba(96,165,250,.2); color: #93c5fd; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 700; }

.cc-tools { display: flex; gap: 8px; align-items: center; padding: 10px 0; }
.cc-search {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,.06); border-radius: 8px; padding: 6px 10px;
  color: #94a3b8; min-width: 240px;
}
.cc-search input { border: 0; outline: 0; background: transparent; color: #e2e8f0; font-size: 13px; flex: 1; }
.cc-search input::placeholder { color: #64748b; }

.cc-filter-row {
  display: flex; gap: 14px; padding: 12px 22px; background: rgba(255,255,255,.03);
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.cc-filter-row > div { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; }
.cc-filter-row select { background: #1e293b; color: #e2e8f0; border: 1px solid rgba(255,255,255,.08); padding: 5px 8px; border-radius: 6px; font-size: 12px; }

.cc-list { padding: 4px 0; max-height: 560px; overflow-y: auto; }
.cc-empty { padding: 40px; text-align: center; color: #64748b; font-size: 13px; }

.cc-row {
  display: grid; grid-template-columns: 44px 1fr auto auto; gap: 14px; align-items: center;
  padding: 12px 22px; border-bottom: 1px solid rgba(255,255,255,.05);
  transition: background .12s;
}
.cc-row:hover { background: rgba(255,255,255,.03); }
.cc-row.is-done { opacity: 0.55; }
.cc-row.is-overdue .cc-date { color: #f87171; }

.cc-ava {
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(16, 185, 129, .15); color: #6ee7b7;
  display: grid; place-items: center;
}

.cc-main { min-width: 0; }
.cc-line-1 { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.cc-line-1 strong { color: #f8fafc; font-size: 14px; font-weight: 700; }
.cc-phone { color: #60a5fa; font-size: 13px; text-decoration: none; font-variant-numeric: tabular-nums; }
.cc-phone:hover { text-decoration: underline; }
.cc-line-2 { color: #94a3b8; font-size: 12.5px; margin-top: 2px; }

.cc-meta { display: flex; align-items: center; gap: 10px; }
.cc-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
.cc-prio-oddiy      { background: rgba(37,99,235,.2);  color: #93c5fd; }
.cc-prio-muhim      { background: rgba(245,158,11,.2); color: #fcd34d; }
.cc-prio-shoshilinch{ background: rgba(239,68,68,.2);  color: #fca5a5; }
.cc-out-ok   { background: rgba(16,185,129,.2); color: #6ee7b7; }
.cc-out-warn { background: rgba(245,158,11,.2); color: #fcd34d; }
.cc-out-bad  { background: rgba(239,68,68,.2);  color: #fca5a5; }

.cc-date { color: #cbd5e1; font-size: 13px; font-variant-numeric: tabular-nums; }

.cc-actions { display: flex; gap: 6px; }
.cc-icon-btn {
  width: 30px; height: 30px; border-radius: 8px;
  background: rgba(255,255,255,.06); color: #cbd5e1;
  border: 0; cursor: pointer; display: grid; place-items: center;
  transition: background .12s, color .12s;
}
.cc-icon-btn:hover { background: rgba(96,165,250,.2); color: #93c5fd; }
.cc-icon-btn-ok:hover:not(:disabled):not(.is-locked) { background: rgba(16,185,129,.2); color: #6ee7b7; }
.cc-icon-btn.is-locked,
.cc-icon-btn:disabled { opacity: .35; cursor: not-allowed; }

.cc-logged-badge {
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(16,185,129,.15); color: #6ee7b7;
  padding: 2px 8px; border-radius: 999px;
  font-size: 10.5px; font-weight: 600; letter-spacing: .2px;
}
.cc-note-preview {
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 5px;
  color: #a5b4fc; font-size: 12px;
  background: rgba(99,102,241,.08);
  padding: 4px 9px; border-radius: 6px;
  border-left: 2px solid rgba(99,102,241,.4);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.cc-log-note-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(99,102,241,.1); color: #c7d2fe;
  border: 1px solid rgba(99,102,241,.2);
  padding: 4px 10px; border-radius: 6px;
  font-size: 12.5px; cursor: pointer; text-align: left;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: all .12s;
}
.cc-log-note-btn:hover { background: rgba(99,102,241,.2); color: #e0e7ff; }
.cc-log-note-empty { color: #475569; font-size: 12px; }

.cc-note-full {
  background: rgba(15,23,42,.6);
  border: 1px solid rgba(255,255,255,.08);
  color: #e2e8f0;
  padding: 14px 16px; border-radius: 10px;
  font-size: 14px; line-height: 1.55;
  white-space: pre-wrap; word-wrap: break-word;
  min-height: 80px;
}
.cc-note-outcome { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: #94a3b8; }
.cc-note-outcome small { font-weight: 600; }

.cc-log-row {
  display: grid; grid-template-columns: 160px 1fr 140px 1fr; gap: 14px;
  padding: 10px 22px; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 13px;
}
.cc-log-time { color: #64748b; font-variant-numeric: tabular-nums; }
.cc-log-patient strong { color: #f8fafc; display: block; }
.cc-log-patient small { color: #94a3b8; }
.cc-log-note { color: #94a3b8; }

.cc-analytics {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 20px 22px;
}
.cc-stat-card { background: rgba(255,255,255,.04); padding: 14px 16px; border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
.cc-stat-card small { color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.cc-stat-card strong { color: #f8fafc; font-size: 22px; font-weight: 700; }
.cc-stat-card-ok { border-left: 3px solid #10b981; }
.cc-stat-card-pending { border-left: 3px solid #3b82f6; }
.cc-stat-card-bad { border-left: 3px solid #ef4444; }
.cc-stat-card-primary { border-left: 3px solid #a855f7; }

.cc-form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

.cc-big-phone {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  background: #dcfce7; color: #047857; padding: 18px; border-radius: 12px;
  font-size: 22px; font-weight: 700; text-decoration: none; font-variant-numeric: tabular-nums;
}

@media (max-width: 1100px) {
  .cc-row { grid-template-columns: 36px 1fr auto; }
  .cc-meta { display: none; }
  .cc-head { flex-direction: column; align-items: flex-start; }
  .cc-analytics { grid-template-columns: repeat(2, 1fr); }
  .cc-form-row { grid-template-columns: 1fr; }
  .cc-log-row { grid-template-columns: 1fr; gap: 4px; }
}

/* ======= New Task Modal — chiroyli dark UI ======= */
.nt-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(2, 6, 23, .72); backdrop-filter: blur(6px);
  display: grid; place-items: center; padding: 20px;
  animation: ntFadeIn .18s ease-out;
}
@keyframes ntFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes ntSlideUp { from { transform: translateY(16px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }

.nt-modal {
  width: 100%; max-width: 560px;
  background: linear-gradient(180deg, #111827 0%, #0b1220 100%);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  box-shadow: 0 30px 80px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(99,102,241,.05);
  overflow: hidden;
  animation: ntSlideUp .22s cubic-bezier(.2,.8,.2,1);
  color: #e2e8f0;
}

.nt-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; gap: 14px;
  background:
    radial-gradient(1200px 120px at 20% 0%, rgba(99,102,241,.22), transparent 60%),
    linear-gradient(180deg, rgba(79,70,229,.08), transparent);
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.nt-head-left { display: flex; gap: 14px; align-items: center; min-width: 0; }
.nt-head-ico {
  width: 44px; height: 44px; border-radius: 12px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff; display: grid; place-items: center;
  box-shadow: 0 6px 22px -4px rgba(99,102,241,.6);
}
.nt-head h2 { margin: 0; font-size: 17px; font-weight: 700; color: #f8fafc; letter-spacing: -.01em; }
.nt-head p { margin: 2px 0 0; color: #94a3b8; font-size: 12.5px; }
.nt-close {
  width: 34px; height: 34px; border-radius: 10px; border: 0;
  background: rgba(255,255,255,.06); color: #cbd5e1; cursor: pointer;
  display: grid; place-items: center; transition: all .15s;
}
.nt-close:hover { background: rgba(239,68,68,.18); color: #fca5a5; }

.nt-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 70vh; overflow-y: auto; }

.nt-field { display: flex; flex-direction: column; gap: 7px; }
.nt-field > label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: #cbd5e1; letter-spacing: .01em;
}
.nt-field > label svg { color: #818cf8; }
.nt-req { color: #f87171; font-weight: 700; margin-left: 2px; }

.nt-field input,
.nt-field select,
.nt-select-wrap select {
  width: 100%;
  background: rgba(15,23,42,.6);
  border: 1px solid rgba(255,255,255,.09);
  color: #e2e8f0;
  padding: 11px 13px;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.nt-field input::placeholder { color: #64748b; }
.nt-field input:hover,
.nt-field select:hover { border-color: rgba(255,255,255,.18); }
.nt-field input:focus,
.nt-field select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,.18);
  background: rgba(15,23,42,.85);
}

.nt-select-wrap { position: relative; }
.nt-select-wrap::after {
  content: '▾'; position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  color: #64748b; font-size: 12px; pointer-events: none;
}
.nt-select-wrap select { appearance: none; padding-right: 32px; cursor: pointer; }

.nt-patient-chip {
  display: flex; align-items: center; gap: 12px;
  background: rgba(99,102,241,.1);
  border: 1px solid rgba(99,102,241,.2);
  padding: 10px 14px; border-radius: 10px;
  animation: ntSlideUp .2s ease-out;
}
.nt-pc-avatar {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff;
  display: grid; place-items: center; font-weight: 700; font-size: 15px;
}
.nt-patient-chip strong { color: #f8fafc; font-size: 14px; display: block; }
.nt-patient-chip small { color: #a5b4fc; font-size: 12px; font-variant-numeric: tabular-nums; }

.nt-quick-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.nt-chip {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  color: #94a3b8;
  padding: 5px 11px; border-radius: 999px;
  font-size: 11.5px; cursor: pointer;
  transition: all .15s;
}
.nt-chip:hover { background: rgba(99,102,241,.14); border-color: rgba(99,102,241,.3); color: #c7d2fe; }

.nt-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.nt-prio-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.nt-prio {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  color: #94a3b8;
  padding: 10px 12px; border-radius: 10px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all .15s;
}
.nt-prio:hover { background: rgba(255,255,255,.07); color: #e2e8f0; }
.nt-prio.is-active.nt-prio-oddiy {
  background: rgba(59,130,246,.2); color: #93c5fd; border-color: rgba(59,130,246,.5);
  box-shadow: 0 0 0 1px rgba(59,130,246,.3), 0 6px 16px -6px rgba(59,130,246,.5);
}
.nt-prio.is-active.nt-prio-muhim {
  background: rgba(245,158,11,.2); color: #fcd34d; border-color: rgba(245,158,11,.5);
  box-shadow: 0 0 0 1px rgba(245,158,11,.3), 0 6px 16px -6px rgba(245,158,11,.5);
}
.nt-prio.is-active.nt-prio-shoshilinch {
  background: rgba(239,68,68,.2); color: #fca5a5; border-color: rgba(239,68,68,.5);
  box-shadow: 0 0 0 1px rgba(239,68,68,.3), 0 6px 16px -6px rgba(239,68,68,.5);
}

.nt-foot {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px;
  background: rgba(2,6,23,.4);
  border-top: 1px solid rgba(255,255,255,.07);
}
.nt-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 10px 18px; border-radius: 10px;
  font-size: 14px; font-weight: 600; cursor: pointer; border: 0;
  transition: all .15s;
}
.nt-btn-ghost { background: rgba(255,255,255,.05); color: #cbd5e1; }
.nt-btn-ghost:hover { background: rgba(255,255,255,.1); color: #f1f5f9; }
.nt-btn-primary {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  box-shadow: 0 8px 22px -8px rgba(99,102,241,.7);
}
.nt-btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.nt-btn-primary:disabled { opacity: .45; cursor: not-allowed; }

@media (max-width: 560px) {
  .nt-grid-2 { grid-template-columns: 1fr; }
  .nt-prio-row { grid-template-columns: 1fr; }
}

/* ======= Call Modal ======= */
.cm-modal { max-width: 480px; }
.cm-head { background:
  radial-gradient(1200px 120px at 20% 0%, rgba(16,185,129,.22), transparent 60%),
  linear-gradient(180deg, rgba(16,185,129,.08), transparent); }
.cm-head-ico {
  background: linear-gradient(135deg, #10b981, #059669) !important;
  box-shadow: 0 6px 22px -4px rgba(16,185,129,.6) !important;
}

.cm-patient {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  padding: 12px 14px; border-radius: 12px;
}
.cm-pt-avatar {
  width: 44px; height: 44px; border-radius: 12px;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  color: #fff; display: grid; place-items: center;
  font-weight: 700; font-size: 18px;
}
.cm-pt-info strong { color: #f8fafc; font-size: 15px; display: block; }
.cm-pt-info small { color: #94a3b8; font-size: 12px; }

.cm-dial {
  display: flex; align-items: center; gap: 14px;
  background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(16,185,129,.04));
  border: 1px solid rgba(16,185,129,.3);
  padding: 14px 16px; border-radius: 12px;
  text-decoration: none; color: inherit;
  transition: all .18s;
}
.cm-dial:hover {
  border-color: rgba(16,185,129,.55);
  box-shadow: 0 10px 26px -10px rgba(16,185,129,.55);
  transform: translateY(-1px);
}
.cm-dial-ico {
  width: 46px; height: 46px; border-radius: 12px;
  background: linear-gradient(135deg, #10b981, #059669); color: #fff;
  display: grid; place-items: center;
}
.cm-dial-text { flex: 1; min-width: 0; }
.cm-dial-text small { color: #86efac; font-size: 11px; font-weight: 600; letter-spacing: .3px; text-transform: uppercase; display: block; }
.cm-dial-text strong { color: #f0fdf4; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .5px; }
.cm-dial-cta {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(16,185,129,.2); color: #6ee7b7;
  padding: 7px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
}

.cm-outcomes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.cm-oc {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  color: #94a3b8;
  padding: 11px 12px; border-radius: 10px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all .15s;
}
.cm-oc:hover { background: rgba(255,255,255,.07); color: #e2e8f0; }
.cm-oc.is-active.cm-oc-ok {
  background: rgba(16,185,129,.2); color: #6ee7b7; border-color: rgba(16,185,129,.5);
  box-shadow: 0 0 0 1px rgba(16,185,129,.3), 0 6px 16px -6px rgba(16,185,129,.5);
}
.cm-oc.is-active.cm-oc-warn {
  background: rgba(245,158,11,.2); color: #fcd34d; border-color: rgba(245,158,11,.5);
  box-shadow: 0 0 0 1px rgba(245,158,11,.3), 0 6px 16px -6px rgba(245,158,11,.5);
}
.cm-oc.is-active.cm-oc-bad {
  background: rgba(239,68,68,.2); color: #fca5a5; border-color: rgba(239,68,68,.5);
  box-shadow: 0 0 0 1px rgba(239,68,68,.3), 0 6px 16px -6px rgba(239,68,68,.5);
}

.cm-textarea {
  width: 100%;
  background: rgba(15,23,42,.6);
  border: 1px solid rgba(255,255,255,.09);
  color: #e2e8f0;
  padding: 11px 13px;
  border-radius: 10px;
  font-size: 14px; font-family: inherit;
  outline: none; resize: vertical; min-height: 72px;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.cm-textarea::placeholder { color: #64748b; }
.cm-textarea:hover { border-color: rgba(255,255,255,.18); }
.cm-textarea:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.18); background: rgba(15,23,42,.85); }

.cm-save { background: linear-gradient(135deg, #10b981, #059669) !important; box-shadow: 0 8px 22px -8px rgba(16,185,129,.7) !important; }

@media (max-width: 520px) { .cm-outcomes { grid-template-columns: 1fr; } }
`;
