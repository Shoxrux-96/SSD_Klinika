import { useSyncExternalStore } from 'react';

export type Status = 'kutilmoqda' | 'keldi' | 'bekor' | 'kelmadi';

export type Appointment = {
  id: string;
  date: string;
  time: string;
  patient: string;        // display: bemor ismi
  patientId?: string;     // patients.id (UUID)
  doctor: string;         // display: shifokor ismi
  doctorId?: string;      // employees.id
  service: string;        // display: xizmat nomi
  serviceId?: string;     // services.id
  status: Status;
};

export type QueueItem = {
  id: string;
  number: string;
  patient: string;
  patientId?: string;
  doctor: string;
  doctorId?: string;
  service: string;
  serviceId?: string;
  addedAt: number;
  status: 'navbatda' | 'kabinetda' | 'tugatildi';
};

export type Gender = 'erkak' | 'ayol';
export type Patient = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  region?: string;
  district?: string;
  gender?: Gender;
  birthDate?: string;
  passport?: string;
  addedAt: number;
  archived: boolean;
};

export type ServiceCategory = { id: string; name: string; color: string };

export type Currency = 'som' | 'rubl' | 'dollar';

export type Service = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  currency: Currency;
  somValue?: number;
  doctorShare: number;
  archived: boolean;
};

export type EmployeeCategory = 'medical' | 'service';
export type EmployeeRole = 'admin' | 'shifokor' | 'laborant' | 'registrator' | 'kassir' | 'buxgalter' | 'oddiy';

export type Employee = {
  id: string;
  category: EmployeeCategory;
  photo?: string;
  fullName: string;
  phone: string;
  email: string;
  position: string;
  specialty: string;
  experience: string;
  diploma: string;
  addedAt: number;
  archived: boolean;
  // Auth maydonlari — hodim tizimga kirishi uchun
  username?: string | null;
  role?: EmployeeRole;
  // Login o'rnatilganmi (passwordHash mavjudmi)
  hasPassword?: boolean;
};

export type ServiceAssignment = { employeeId: string; serviceId: string };

type State = {
  appointments: Appointment[];
  queue: QueueItem[];
  patients: Patient[];
  employees: Employee[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  assignments: ServiceAssignment[];
};

const EMPTY: State = {
  appointments: [], queue: [], patients: [], employees: [],
  serviceCategories: [], services: [], assignments: [],
};

let state: State = EMPTY;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getState() { return state; }

// --- API helpers ---
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function refetchAll() {
  // Public endpointlar — hamma uchun ochiq. Auth talab qiluvchi endpointlar faqat
  // login qilgan foydalanuvchilarga. Bosh sahifaga kirganda, auth kerak bo'lgan
  // endpointlar chaqirilmaydi — console'da ortiqcha 401 chiqmaydi.
  const safe = async <T>(path: string): Promise<T> => {
    try { return (await api<T>(path)) as T; } catch { return [] as unknown as T; }
  };
  const hasToken =
    typeof window !== 'undefined' && !!window.localStorage?.getItem('ssd:auth:token');

  // Public — har doim
  const [employees, serviceCategories, services, assignments] = await Promise.all([
    safe<Employee[]>('/employees'),
    safe<ServiceCategory[]>('/service-categories'),
    safe<Service[]>('/services'),
    safe<ServiceAssignment[]>('/assignments'),
  ]);

  // Private — faqat login bo'lsa
  let appointments: Appointment[] = [];
  let patients: Patient[] = [];
  let queue: QueueItem[] = [];
  if (hasToken) {
    const [a, p, q] = await Promise.all([
      safe<Appointment[]>('/appointments'),
      safe<Patient[]>('/patients'),
      safe<QueueItem[]>('/queue'),
    ]);
    if (Array.isArray(a)) appointments = a as Appointment[];
    if (Array.isArray(p)) patients = p as Patient[];
    if (Array.isArray(q)) queue = q as QueueItem[];
  }

  state = {
    employees:         Array.isArray(employees) ? employees : [],
    serviceCategories: Array.isArray(serviceCategories) ? serviceCategories : [],
    services:          Array.isArray(services) ? services : [],
    assignments:       Array.isArray(assignments) ? assignments : [],
    appointments:      Array.isArray(appointments) ? appointments : [],
    patients:          Array.isArray(patients) ? patients : [],
    queue:             Array.isArray(queue) ? queue : [],
  };
  emit();
}

// Lazy hydrate once on client
let hydrated = false;
function ensureHydrated() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  refetchAll().catch((e) => console.error('Hydration failed:', e));
}

// --- hooks ---
function useSlice<T>(sel: (s: State) => T): T {
  ensureHydrated();
  return useSyncExternalStore(subscribe, () => sel(getState()), () => sel(getState()));
}
export function useAppointments() { return useSlice((s) => s.appointments); }
export function useQueue()        { return useSlice((s) => s.queue); }
export function usePatients()     { return useSlice((s) => s.patients); }
export function useEmployees()    { return useSlice((s) => s.employees); }
export function useServiceCategories() { return useSlice((s) => s.serviceCategories); }
export function useServices()     { return useSlice((s) => s.services); }
export function useAssignments()  { return useSlice((s) => s.assignments); }

// --- helpers for optimistic updates ---
function set<K extends keyof State>(key: K, update: (prev: State[K]) => State[K]) {
  state = { ...state, [key]: update(state[key]) };
  emit();
}

// --- Appointments ---
export async function addAppointment(a: Omit<Appointment, 'id' | 'status'>) {
  const created = await api<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(a) });
  set('appointments', (prev) => [...prev, created]);
}

// Qabul'ni butunlay o'chirish — slot bo'shaydi va yangi qabul yoziladigan bo'ladi.
// Tegishli navbat yozuvi ham tozalanadi (agar bor bo'lsa).
export async function deleteAppointment(id: string) {
  set('appointments', (prev) => prev.filter((a) => a.id !== id));
  // Agar navbatda bo'lsa — uni ham o'chiramiz
  const q = state.queue.find((q) => q.id === id);
  if (q) {
    set('queue', (prev) => prev.filter((x) => x.id !== id));
    try { await api(`/queue/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
  }
  await api(`/appointments/${id}`, { method: 'DELETE' });
}
function isToday(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function nextQueueNumber() {
  // Count only numbers assigned today — resets to A001 each day.
  const todays = state.queue.filter((q) => isToday(q.addedAt)).map((q) => {
    const m = q.number.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  });
  const maxToday = todays.length ? Math.max(...todays) : 0;
  return `A${String(maxToday + 1).padStart(3, '0')}`;
}
export async function setAppointmentStatus(id: string, status: Status) {
  const target = state.appointments.find((a) => a.id === id);
  if (!target) return;
  set('appointments', (prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  await api(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

  if (status === 'keldi' && !state.queue.some((q) => q.id === id)) {
    const q: QueueItem = {
      id, number: nextQueueNumber(),
      patient: target.patient, patientId: target.patientId,
      doctor: target.doctor, doctorId: target.doctorId,
      service: target.service, serviceId: target.serviceId,
      addedAt: Date.now(), status: 'navbatda',
    };
    const created = await api<QueueItem>('/queue', { method: 'POST', body: JSON.stringify(q) });
    set('queue', (prev) => [...prev, created]);
    printQueueTicket(created);

    // Oqim avtomatizatsiyasi: "keldi" bosilganda — qabul uchun qoralama davolash
    // yozuvi (rejalashtirildi statusida) ham yaratiladi. Shu orqali shifokor
    // paneliga darhol ko'rinadi va qayta ma'lumot kiritish shart emas.
    try { await ensureDraftTreatmentForAppointment(target); } catch (e) {
      console.warn('draft treatment creation failed', e);
    }
  } else if (status !== 'keldi') {
    const existing = state.queue.find((q) => q.patient === target.patient);
    if (existing) {
      await api(`/queue/${existing.id}`, { method: 'DELETE' });
      set('queue', (prev) => prev.filter((q) => q.id !== existing.id));
    }
  }
}

// Qabul "keldi" bo'lganda avtomatik qoralama davolash yozuvini qo'shadi.
// Bir qabul uchun bir marta — takrorlanmaydi (appointmentId notes ichida saqlanadi).
async function ensureDraftTreatmentForAppointment(a: Appointment) {
  // Takrorlanmasligi uchun treatment yozuvlarini bir marta tekshiramiz
  let existing: any[] = [];
  try { existing = await api<any[]>('/treatments'); } catch { return; }
  const already = existing.some((t) => {
    try {
      const n = typeof t.notes === 'string' ? JSON.parse(t.notes) : t.notes;
      return n?.appointmentId === a.id;
    } catch { return false; }
  });
  if (already) return;

  const svc = state.services.find((s) => s.id === a.serviceId || s.name === a.service);
  const amount = svc ? (svc.somValue ?? svc.price) : 0;
  const patient = state.patients.find((p) => p.id === a.patientId || p.fullName === a.patient);

  const payload = {
    id: `T-${Date.now().toString(36).toUpperCase()}`,
    patientId: a.patientId ?? patient?.id ?? a.patient,
    patientPassport: patient?.passport,
    doctorId: a.doctor,
    serviceId: a.serviceId ?? null,
    date: a.date,
    diagnosis: '',
    procedure: null,
    price: amount,
    status: 'rejalashtirildi',
    notes: JSON.stringify({
      patientName: a.patient,
      service: a.service,
      services: [a.service],
      amount,
      appointmentId: a.id,
    }),
    createdAt: Date.now(),
  };
  await api('/treatments', { method: 'POST', body: JSON.stringify(payload) });
}

// --- Queue ---
export async function removeFromQueue(id: string) {
  set('queue', (prev) => prev.filter((q) => q.id !== id));
  await api(`/queue/${id}`, { method: 'DELETE' });
}
export async function setQueueStatus(id: string, status: QueueItem['status']) {
  const target = state.queue.find((q) => q.id === id);
  set('queue', (prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
  await api(`/queue/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  if (target && status === 'kabinetda') {
    const existing = state.patients.find((p) => p.fullName === target.patient);
    if (!existing) {
      const created = await api<Patient>('/patients', {
        method: 'POST',
        body: JSON.stringify({ fullName: target.patient, phone: '', address: '' }),
      });
      set('patients', (prev) => [created, ...prev]);
    }
  }
}

// --- Patients ---
function normalizePassport(v?: string | null) {
  return (v ?? '').replace(/\s+/g, '').toUpperCase() || undefined;
}
export async function addPatient(p: {
  fullName: string;
  phone: string;
  address: string;
  region?: string;
  district?: string;
  gender?: Gender;
  birthDate?: string;
  passport?: string;
}): Promise<Patient> {
  const body = { ...p, passport: normalizePassport(p.passport) };
  const created = await api<Patient>('/patients', { method: 'POST', body: JSON.stringify(body) });
  set('patients', (prev) => [created, ...prev]);
  return created;
}
export async function updatePatient(id: string, patch: Partial<Omit<Patient, 'id' | 'addedAt'>>) {
  const normalized = { ...patch, ...(patch.passport !== undefined ? { passport: normalizePassport(patch.passport) } : {}) };
  set('patients', (prev) => prev.map((p) => (p.id === id ? { ...p, ...normalized } : p)));
  await api(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(normalized) });
}
export const archivePatient   = (id: string) => updatePatient(id, { archived: true });
export const unarchivePatient = (id: string) => updatePatient(id, { archived: false });
export async function deletePatient(id: string) {
  set('patients', (prev) => prev.filter((p) => p.id !== id));
  await api(`/patients/${id}`, { method: 'DELETE' });
}

// --- Employees ---
// Login maydonlari (`username`, `role`, `password`) ixtiyoriy — faqat admin
// hodimga tizimga kirish imkonini bermoqchi bo'lsa to'ldiradi.
export async function addEmployee(
  e: Omit<Employee, 'id' | 'addedAt' | 'archived' | 'hasPassword'> & { password?: string },
) {
  const created = await api<Employee>('/employees', { method: 'POST', body: JSON.stringify(e) });
  set('employees', (prev) => [created, ...prev]);
}
export async function updateEmployee(
  id: string,
  patch: Partial<Omit<Employee, 'id' | 'addedAt' | 'hasPassword'>> & { password?: string },
) {
  set('employees', (prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  await api(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
export const archiveEmployee   = (id: string) => updateEmployee(id, { archived: true });
export const unarchiveEmployee = (id: string) => updateEmployee(id, { archived: false });
export async function deleteEmployee(id: string) {
  set('employees', (prev) => prev.filter((e) => e.id !== id));
  await api(`/employees/${id}`, { method: 'DELETE' });
}

// --- Service categories ---
export async function addServiceCategory(name: string, color: string) {
  const created = await api<ServiceCategory>('/service-categories', {
    method: 'POST', body: JSON.stringify({ name, color }),
  });
  set('serviceCategories', (prev) => [...prev, created]);
}
export async function updateServiceCategory(id: string, patch: Partial<Omit<ServiceCategory, 'id'>>) {
  set('serviceCategories', (prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  await api(`/service-categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
export async function removeServiceCategory(id: string) {
  set('serviceCategories', (prev) => prev.filter((c) => c.id !== id));
  set('services', (prev) => prev.filter((s) => s.categoryId !== id));
  await api(`/service-categories/${id}`, { method: 'DELETE' });
}

// --- Services ---
export async function addService(s: Omit<Service, 'id' | 'archived'>) {
  const created = await api<Service>('/services', { method: 'POST', body: JSON.stringify(s) });
  set('services', (prev) => [...prev, created]);
}
export async function updateService(id: string, patch: Partial<Omit<Service, 'id'>>) {
  set('services', (prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  await api(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
export const archiveService   = (id: string) => updateService(id, { archived: true });
export const unarchiveService = (id: string) => updateService(id, { archived: false });
export async function removeService(id: string) {
  set('services', (prev) => prev.filter((s) => s.id !== id));
  set('assignments', (prev) => prev.filter((a) => a.serviceId !== id));
  await api(`/services/${id}`, { method: 'DELETE' });
}

// --- Assignments ---
export async function toggleAssignment(employeeId: string, serviceId: string) {
  const exists = state.assignments.some((a) => a.employeeId === employeeId && a.serviceId === serviceId);
  set('assignments', (prev) =>
    exists
      ? prev.filter((a) => !(a.employeeId === employeeId && a.serviceId === serviceId))
      : [...prev, { employeeId, serviceId }],
  );
  await api('/assignments/toggle', { method: 'POST', body: JSON.stringify({ employeeId, serviceId }) });
}
export async function setEmployeeAssignments(employeeId: string, serviceIds: string[]) {
  const others = state.assignments.filter((a) => a.employeeId !== employeeId);
  const next = serviceIds.map((serviceId) => ({ employeeId, serviceId }));
  set('assignments', () => [...others, ...next]);
  await api(`/assignments/${employeeId}`, { method: 'PUT', body: JSON.stringify({ serviceIds }) });
}

// Manual refresh (handy for admin reset)
export async function refreshAll() { await refetchAll(); }

// --- Queue ticket (chek) ---
export function printQueueTicket(q: QueueItem) {
  if (typeof window === 'undefined') return;
  const now = new Date();
  const date = now.toLocaleDateString('uz-UZ');
  const time = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  const html = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><title>Navbat ${q.number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #000; background: #fff; }
  .ticket { width: 80mm; padding: 10px 12px 18px; }
  .brand { text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 2px; padding: 4px 0 6px; border-bottom: 2px dashed #000; }
  .brand small { display: block; font-weight: 500; font-size: 10px; letter-spacing: 1px; margin-top: 2px; }
  .label { text-align: center; font-size: 10px; letter-spacing: 3px; color: #333; margin-top: 10px; text-transform: uppercase; }
  .num { text-align: center; font-size: 72px; font-weight: 900; line-height: 1; margin: 6px 0 8px; letter-spacing: -2px; font-variant-numeric: tabular-nums; }
  .info { font-size: 12px; line-height: 1.6; border-top: 1px dashed #333; border-bottom: 1px dashed #333; padding: 8px 2px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row strong { font-weight: 700; }
  .foot { text-align: center; font-size: 10px; margin-top: 10px; color: #333; }
  .foot b { font-size: 11px; color: #000; }
</style></head>
<body>
  <div class="ticket">
    <div class="brand">SSD KLINIKA<small>Navbat chek — ticket</small></div>
    <div class="label">Sizning navbatingiz</div>
    <div class="num">${q.number}</div>
    <div class="info">
      <div class="row"><span>Bemor:</span><strong>${q.patient}</strong></div>
      <div class="row"><span>Shifokor:</span><strong>${q.doctor}</strong></div>
      <div class="row"><span>Xizmat:</span><strong>${q.service}</strong></div>
      <div class="row"><span>Sana:</span><strong>${date}</strong></div>
      <div class="row"><span>Vaqt:</span><strong>${time}</strong></div>
    </div>
    <div class="foot">Iltimos, <b>TV ekrandagi</b> raqamingizni kuzatib boring.<br/>Sabringiz uchun rahmat!</div>
  </div>
  <script>window.addEventListener('load', () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 500); }, 200); });<\/script>
</body></html>`;
  const w = window.open('', 'queue-ticket', 'width=320,height=640');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
