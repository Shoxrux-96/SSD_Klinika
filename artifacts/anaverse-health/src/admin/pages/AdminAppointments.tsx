import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { usePagination, TablePagination } from '../components/TablePagination';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  Lock,
  Plus,
  Table as TableIcon,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import {
  type Appointment,
  type Status,
  addAppointment as storeAdd,
  setAppointmentStatus,
  useAppointments,
  useAssignments,
  useEmployees,
  useServices,
} from '../store';

const SERVICES: string[] = [];

// Half-hour slots from 09:00 to 23:00 (last slot: 22:30–23:00)
const HOURS: string[] = (() => {
  const list: string[] = [];
  for (let m = 9 * 60; m < 23 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    list.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return list;
})();

function slotRange(start: string) {
  const [h, m] = start.split(':').map(Number);
  const end = h * 60 + m + 30;
  const eh = Math.floor(end / 60);
  const em = end % 60;
  return `${start}–${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<Status, string> = {
  kutilmoqda: 'kutilmoqda',
  keldi: 'keldi',
  bekor: 'bekor qilindi',
  kelmadi: 'kelmadi',
};

function statusCls(s: Status) {
  return s === 'keldi' ? 'ok' : s === 'bekor' ? 'danger' : s === 'kelmadi' ? 'missed' : 'wait';
}

type ViewMode = 'calendar' | 'table';
type CalendarRange = 'day' | 'week' | 'month';

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const UZ_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date) {
  const nd = new Date(d);
  const day = (nd.getDay() + 6) % 7; // Mon=0
  nd.setDate(nd.getDate() - day);
  return nd;
}

function addDays(d: Date, n: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function AdminAppointments() {
  const appointments = useAppointments();
  const employees = useEmployees();
  const assignments = useAssignments();
  const doctorList = useMemo(() => {
    // Barcha faol tibbiy xodimlar ko'rsatiladi — hatto xizmat biriktirilmagan
    // bo'lsa ham. Shunda admin yangi shifokor qo'shsa, u darhol ro'yxatda paydo bo'ladi.
    void assignments;
    return employees
      .filter((e) => !e.archived && e.category === 'medical')
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz'))
      .map((e) => e.fullName);
  }, [employees, assignments]);
  const [view, setView] = useState<ViewMode>('calendar');
  const [range, setRange] = useState<CalendarRange>('day');
  const [cursor, setCursor] = useState<Date>(new Date('2026-10-31'));
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ date?: string; time?: string; doctor?: string }>({});

  const filtered = useMemo(() => {
    return appointments.filter((a) => doctorFilter === 'all' || a.doctor === doctorFilter);
  }, [appointments, doctorFilter]);

  const inRange = useMemo(() => {
    if (range === 'day') {
      const iso = toISO(cursor);
      return filtered.filter((a) => a.date === iso);
    }
    if (range === 'week') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return filtered.filter((a) => a.date >= toISO(s) && a.date <= toISO(e));
    }
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    return filtered.filter((a) => {
      const d = new Date(a.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [filtered, range, cursor]);

  const openNew = (p: { date?: string; time?: string; doctor?: string } = {}) => {
    setPrefill(p);
    setModalOpen(true);
  };

  const shift = (dir: -1 | 1) => {
    if (range === 'day') setCursor(addDays(cursor, dir));
    else if (range === 'week') setCursor(addDays(cursor, dir * 7));
    else {
      const nd = new Date(cursor);
      nd.setMonth(nd.getMonth() + dir);
      setCursor(nd);
    }
  };

  const headerTitle = useMemo(() => {
    if (range === 'day') {
      return `${cursor.getDate()} ${UZ_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
    if (range === 'week') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.getDate()} ${UZ_MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${UZ_MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
    }
    return `${UZ_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [cursor, range]);

  return (
    <div className="admin-page appt-page">
      <div className="admin-page-head">
        <div>
          <h1>Qabullar</h1>
          <p>Kalendar va jadval ko‘rinishi, soatlik rejim va shifokorlar bo‘yicha qabullar.</p>
        </div>
      </div>

      <section className="admin-card appt-toolbar">
        <div className="appt-range">
          {(['day', 'week', 'month'] as CalendarRange[]).map((r) => (
            <button
              key={r}
              className={range === r ? 'active' : ''}
              onClick={() => setRange(r)}
            >
              {r === 'day' ? 'Kun' : r === 'week' ? 'Hafta' : 'Oy'}
            </button>
          ))}
        </div>

        <div className="appt-nav">
          <button className="admin-icon-btn sm" onClick={() => shift(-1)} aria-label="Oldingi">
            <ChevronLeft size={16} />
          </button>
          <div className="appt-nav-title">
            <CalendarDays size={16} /> {headerTitle}
          </div>
          <button className="admin-icon-btn sm" onClick={() => shift(1)} aria-label="Keyingi">
            <ChevronRight size={16} />
          </button>
        </div>

        <button className="admin-btn admin-btn-ghost appt-today" onClick={() => setCursor(new Date('2026-10-31'))}>
          Bugun
        </button>

        <div className="appt-doctor-filter">
          <label>Shifokor:</label>
          <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
            <option value="all">Barchasi</option>
            {doctorList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="appt-toolbar-sep" aria-hidden />

        <div className="appt-view-switch">
          <button
            className={view === 'calendar' ? 'active' : ''}
            onClick={() => setView('calendar')}
          >
            <LayoutGrid size={14} /> Kalendar
          </button>
          <button
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
          >
            <TableIcon size={14} /> Jadval
          </button>
        </div>

        <button className="admin-btn admin-btn-primary appt-new-btn" onClick={() => openNew()}>
          <Plus size={15} /> Yangi qabul
        </button>
      </section>

      {view === 'calendar' ? (
        range === 'day' ? (
          <DayView
            date={cursor}
            appointments={inRange}
            doctorFilter={doctorFilter}
            doctorList={doctorList}
            onSlotClick={(doctor, time) => openNew({ date: toISO(cursor), time, doctor })}
          />
        ) : range === 'week' ? (
          <WeekView
            cursor={cursor}
            appointments={inRange}
            onSlotClick={(date, time) => openNew({ date, time })}
          />
        ) : (
          <MonthView
            cursor={cursor}
            appointments={inRange}
            onDayClick={(date) => { setCursor(new Date(date)); setRange('day'); }}
          />
        )
      ) : (
        <TableView items={inRange} />
      )}

      {modalOpen && (
        <AppointmentModal
          prefill={prefill}
          onClose={() => setModalOpen(false)}
          onSave={(a) => { storeAdd(a); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

function statusChip(s: Status) {
  const cls = statusCls(s);
  return <span className={`admin-chip chip-${cls}`}>{STATUS_LABEL[s]}</span>;
}

// 1 kunlik grace: qabul kuni + 24 soat davomida status tahrir qilinadi, keyin bloklanadi.
const SLOT_MINUTES = 30;
const GRACE_MS = 24 * 60 * 60 * 1000; // 1 kun

function slotLockMs(date: string, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const start = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, m ?? 0, 0, 0);
  return start.getTime() + SLOT_MINUTES * 60_000 + GRACE_MS;
}

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function StatusActions({
  appt,
  size = 14,
  vertical = false,
}: { appt: Appointment; size?: number; vertical?: boolean }) {
  const now = useNow();
  const locked = now > slotLockMs(appt.date, appt.time);

  if (locked) {
    return (
      <div
        className={`appt-status-actions is-locked${vertical ? ' is-vertical' : ''}`}
        onClick={(e) => e.stopPropagation()}
        title="Vaqti o‘tgan — status o‘zgartirib bo‘lmaydi"
        aria-label="Yopiq"
      >
        <Lock size={size} />
      </div>
    );
  }

  return (
    <div className={`appt-status-actions${vertical ? ' is-vertical' : ''}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="admin-icon-btn sm ok"
        onClick={() => setAppointmentStatus(appt.id, 'keldi')}
        aria-label="Keldi"
        title="Keldi"
      >
        <CheckCircle2 size={size} />
      </button>
      <button
        type="button"
        className="admin-icon-btn sm danger"
        onClick={() => setAppointmentStatus(appt.id, 'bekor')}
        aria-label="Bekor qilish"
        title="Bekor qilish"
      >
        <XCircle size={size} />
      </button>
      <button
        type="button"
        className="admin-icon-btn sm missed"
        onClick={() => setAppointmentStatus(appt.id, 'kelmadi')}
        aria-label="Kelmadi"
        title="Kelmadi"
      >
        <UserX size={size} />
      </button>
    </div>
  );
}

/* ---------------- Day view: soatlik rejim per doctor ---------------- */

function DayView({
  date,
  appointments,
  doctorFilter,
  doctorList,
  onSlotClick,
}: {
  date: Date;
  appointments: Appointment[];
  doctorFilter: string;
  doctorList: string[];
  onSlotClick: (doctor: string, time: string) => void;
}) {
  const doctors = doctorFilter === 'all' ? doctorList : [doctorFilter];
  const findAppt = (doctor: string, time: string) =>
    appointments.find((a) => a.doctor === doctor && a.time === time);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [doctors.length]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(200, el.clientWidth * 0.6);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section className="admin-card appt-day">
      <div className="admin-card-head">
        <div>
          <h2>Kunlik soatlik jadval</h2>
          <small>{appointments.length} ta qabul · bo‘sh katakka bosib qabul qo‘shing</small>
        </div>
        <div className="appt-doctor-scroll-nav">
          <button
            type="button"
            className="admin-icon-btn sm"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            aria-label="Chapga"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="admin-icon-btn sm"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            aria-label="O‘ngga"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="appt-day-grid-wrap" ref={scrollRef}>
        <div
          className="appt-day-grid"
          style={{ gridTemplateColumns: `110px repeat(${doctors.length}, 220px)`, minWidth: 'min-content' }}
        >
          <div className="appt-day-corner">Soat</div>
          {doctors.map((d) => {
            const count = appointments.filter((a) => a.doctor === d).length;
            return (
              <div key={d} className="appt-doctor-head">
                <strong>{d}</strong>
                <small>{count} ta qabul</small>
              </div>
            );
          })}
          {HOURS.map((h) => (
            <Fragment key={`h-${h}`}>
              <div className="appt-hour-cell">{slotRange(h)}</div>
              {doctors.map((d) => {
                const appt = findAppt(d, h);
                return appt ? (
                  <div key={`${d}-${h}`} className={`appt-slot filled status-${statusCls(appt.status)}`}>
                    <StatusActions appt={appt} vertical />
                    <strong>{appt.patient}</strong>
                    <span>{appt.service}</span>
                    {statusChip(appt.status)}
                  </div>
                ) : (
                  <button
                    key={`${d}-${h}`}
                    className="appt-slot empty"
                    onClick={() => onSlotClick(d, h)}
                    aria-label="Bo‘sh"
                  >
                    <Plus size={14} />
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Week view ---------------- */

function WeekView({
  cursor,
  appointments,
  onSlotClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <section className="admin-card appt-week">
      <div className="admin-card-head">
        <h2>Haftalik ko‘rinish</h2>
        <small>{appointments.length} ta qabul</small>
      </div>
      <div className="appt-week-grid-wrap">
        <div className="appt-week-grid">
          <div className="appt-day-corner">Soat</div>
          {days.map((d) => (
            <div key={toISO(d)} className="appt-week-head">
              <strong>{UZ_WEEKDAYS[(d.getDay() + 6) % 7]}</strong>
              <span>{d.getDate()} {UZ_MONTHS[d.getMonth()].slice(0, 3)}</span>
            </div>
          ))}
          {HOURS.map((h) => (
            <Fragment key={`wh-${h}`}>
              <div className="appt-hour-cell">{slotRange(h)}</div>
              {days.map((d) => {
                const iso = toISO(d);
                const items = appointments.filter((a) => a.date === iso && a.time === h);
                return items.length ? (
                  <div key={`${iso}-${h}`} className="appt-slot filled stack">
                    {items.map((it) => (
                      <div key={it.id} className={`appt-pill status-${statusCls(it.status)}`}>
                        <StatusActions appt={it} size={12} />
                        <strong>{it.patient}</strong>
                        <small>{it.doctor}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    key={`${iso}-${h}`}
                    className="appt-slot empty"
                    onClick={() => onSlotClick(iso, h)}
                  >
                    <Plus size={14} />
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Month view ---------------- */

function MonthView({
  cursor,
  appointments,
  onDayClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onDayClick: (iso: string) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = toISO(new Date('2026-10-31'));

  return (
    <section className="admin-card appt-month">
      <div className="admin-card-head">
        <h2>Oylik ko‘rinish</h2>
        <small>{appointments.length} ta qabul</small>
      </div>
      <div className="appt-month-grid">
        {UZ_WEEKDAYS.map((w) => (
          <div key={w} className="appt-month-weekday">{w}</div>
        ))}
        {cells.map((d) => {
          const iso = toISO(d);
          const items = appointments.filter((a) => a.date === iso);
          const dim = !sameMonth(d, cursor);
          return (
            <button
              key={iso}
              onClick={() => onDayClick(iso)}
              className={`appt-month-cell${dim ? ' dim' : ''}${iso === today ? ' today' : ''}`}
            >
              <span className="appt-month-date">{d.getDate()}</span>
              <div className="appt-month-events">
                {items.slice(0, 3).map((it) => (
                  <div key={it.id} className={`appt-month-dot status-${statusCls(it.status)}`}>
                    <span>{it.time}</span> {it.patient}
                  </div>
                ))}
                {items.length > 3 && <small>+{items.length - 3} ko‘proq</small>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Table view ---------------- */

function TableView({ items }: { items: Appointment[] }) {
  const pg = usePagination(items, [items.length]);
  return (
    <section className="admin-card">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Vaqt</th>
              <th>Bemor</th>
              <th>Shifokor</th>
              <th>Xizmat</th>
              <th>Holat</th>
              <th className="admin-cell-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={7} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Qabullar topilmadi</td></tr>
            )}
            {pg.pageRows.map((a) => (
              <tr key={a.id} className={`appt-row status-${statusCls(a.status)}`}>
                <td>{a.date}</td>
                <td className="admin-cell-time">{a.time}</td>
                <td><strong>{a.patient}</strong></td>
                <td className="admin-cell-muted">{a.doctor}</td>
                <td>{a.service}</td>
                <td>{statusChip(a.status)}</td>
                <td className="admin-cell-right">
                  <StatusActions appt={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination {...pg} />
      </div>
    </section>
  );
}

/* ---------------- Modal ---------------- */

function AppointmentModal({
  prefill,
  onClose,
  onSave,
}: {
  prefill: { date?: string; time?: string; doctor?: string };
  onClose: () => void;
  onSave: (a: Omit<Appointment, 'id' | 'status'>) => void;
}) {
  const employees = useEmployees();
  const services = useServices();
  const assignments = useAssignments();

  const doctorEmployees = useMemo(() => {
    // Barcha faol tibbiy xodimlar (xizmat biriktirilmaganlar ham ko'rsatiladi)
    return employees.filter((e) => !e.archived && e.category === 'medical');
  }, [employees]);
  const activeServices = useMemo(() => services.filter((s) => !s.archived), [services]);

  const doctorNames = useMemo(
    () => doctorEmployees.map((e) => e.fullName),
    [doctorEmployees],
  );

  const [patient, setPatient] = useState('');
  const [date, setDate] = useState(prefill.date ?? '2026-10-31');
  const [time, setTime] = useState(prefill.time ?? '09:00');
  const [doctor, setDoctor] = useState(prefill.doctor ?? doctorNames[0] ?? '');

  const availableServices = useMemo(() => {
    const emp = doctorEmployees.find((e) => e.fullName === doctor);
    if (!emp) return activeServices;
    const ids = new Set(
      assignments.filter((a) => a.employeeId === emp.id).map((a) => a.serviceId),
    );
    const list = activeServices.filter((s) => ids.has(s.id));
    // Xizmat biriktirilmagan bo'lsa — barcha faol xizmatlardan tanlash mumkin
    // (admin keyin biriktirsa ham bo'ladi). Shunda shifokor bloklanmaydi.
    return list.length ? list : activeServices;
  }, [doctor, doctorEmployees, assignments, activeServices]);

  const [service, setService] = useState<string>(
    availableServices[0]?.name ?? SERVICES[0],
  );

  useEffect(() => {
    if (availableServices.length === 0) {
      setService('');
      return;
    }
    if (!availableServices.some((s) => s.name === service)) {
      setService(availableServices[0].name);
    }
  }, [availableServices, service]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient.trim() || !service) return;
    // UUID'larni qidirib topamiz — tarixiy barqarorlik uchun
    const emp = doctorEmployees.find((e) => e.fullName === doctor);
    const svc = availableServices.find((s) => s.name === service);
    onSave({
      patient: patient.trim(),
      date, time, doctor, service,
      doctorId: emp?.id,
      serviceId: svc?.id,
    });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><Clock size={18} /> Yangi qabul</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish">
            <X size={16} />
          </button>
        </div>
        <div className="appt-modal-body">
          <label>
            <span>Bemor ismi</span>
            <input value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="Ism Familiya" required />
          </label>
          <div className="appt-modal-row">
            <label>
              <span>Sana</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              <span>Vaqt</span>
              <select value={time} onChange={(e) => setTime(e.target.value)}>
                {HOURS.map((h) => <option key={h} value={h}>{slotRange(h)}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Shifokor</span>
            <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
              {doctorEmployees.map((e) => (
                <option key={e.id} value={e.fullName}>
                  {e.fullName}{e.position ? ` — ${e.position}` : ''}
                </option>
              ))}
            </select>
            {(() => {
              const sel = doctorEmployees.find((e) => e.fullName === doctor);
              if (!sel) return null;
              return (
                <div className="appt-doctor-info">
                  <strong>{sel.fullName}</strong>
                  {sel.position && <span className="appt-doctor-pos">{sel.position}</span>}
                </div>
              );
            })()}
          </label>
          <label>
            <span>Xizmat {availableServices.length > 0 && <small style={{ color: 'var(--admin-muted)', fontWeight: 400 }}>({availableServices.length} ta biriktirilgan)</small>}</span>
            {availableServices.length > 0 ? (
              <select value={service} onChange={(e) => setService(e.target.value)}>
                {availableServices.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <div className="appt-no-services">
                Ushbu shifokorga hali xizmat biriktirilmagan. «Xizmat biriktirish» sahifasidan biriktiring.
              </div>
            )}
          </label>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={!service}><Plus size={15} /> Saqlash</button>
        </div>
      </form>
    </div>
  );
}
