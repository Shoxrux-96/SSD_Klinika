import { useSyncExternalStore } from 'react';

export type Status = 'kutilmoqda' | 'keldi' | 'bekor' | 'kelmadi';

export type Appointment = {
  id: string;
  date: string;
  time: string;
  patient: string;
  doctor: string;
  service: string;
  status: Status;
};

export type QueueItem = {
  id: string;
  number: string;
  patient: string;
  doctor: string;
  service: string;
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
  const [employees, serviceCategories, services, assignments, appointments, patients, queue] = await Promise.all([
    api<Employee[]>('/employees'),
    api<ServiceCategory[]>('/service-categories'),
    api<Service[]>('/services'),
    api<ServiceAssignment[]>('/assignments'),
    api<Appointment[]>('/appointments'),
    api<Patient[]>('/patients'),
    api<QueueItem[]>('/queue'),
  ]);
  state = { employees, serviceCategories, services, assignments, appointments, patients, queue };
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
      id, number: nextQueueNumber(), patient: target.patient, doctor: target.doctor,
      service: target.service, addedAt: Date.now(), status: 'navbatda',
    };
    const created = await api<QueueItem>('/queue', { method: 'POST', body: JSON.stringify(q) });
    set('queue', (prev) => [...prev, created]);
    printQueueTicket(created);
  } else if (status !== 'keldi') {
    const existing = state.queue.find((q) => q.patient === target.patient);
    if (existing) {
      await api(`/queue/${existing.id}`, { method: 'DELETE' });
      set('queue', (prev) => prev.filter((q) => q.id !== existing.id));
    }
  }
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
export async function addEmployee(e: Omit<Employee, 'id' | 'addedAt' | 'archived'>) {
  const created = await api<Employee>('/employees', { method: 'POST', body: JSON.stringify(e) });
  set('employees', (prev) => [created, ...prev]);
}
export async function updateEmployee(id: string, patch: Partial<Omit<Employee, 'id' | 'addedAt'>>) {
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
