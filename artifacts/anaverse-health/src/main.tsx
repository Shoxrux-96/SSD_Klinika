import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import App from './App';
import { AdminLayout } from './admin/AdminLayout';
import { AdminOverview } from './admin/pages/AdminOverview';
import { AdminStaff } from './admin/pages/AdminStaff';
import { AdminPatients } from './admin/pages/AdminPatients';
import { AdminAppointments } from './admin/pages/AdminAppointments';
import { AdminServices } from './admin/pages/AdminServices';
import { AdminAssignments } from './admin/pages/AdminAssignments';
import { AdminWorkers } from './admin/pages/AdminWorkers';
import { AdminRoles } from './admin/pages/AdminRoles';
import { AdminFinance } from './admin/pages/AdminFinance';
import { AdminCashier } from './admin/pages/AdminCashier';
import { AdminCallCenter } from './admin/pages/AdminCallCenter';
import { AdminReports } from './admin/pages/AdminReports';
import { AdminSettings } from './admin/pages/AdminSettings';
import { AdminQueue } from './admin/pages/AdminQueue';
import { AdminTreatments } from './admin/pages/AdminTreatments';
import { AdminTechProducts } from './admin/pages/AdminTechProducts';
import { AdminPrescriptions } from './admin/pages/AdminPrescriptions';
import { AdminLaboratory } from './admin/pages/AdminLaboratory';
import { AdminAudit } from './admin/pages/AdminAudit';
import { AdminPayroll } from './admin/pages/AdminPayroll';
import { AdminAttendance } from './admin/pages/AdminAttendance';
import { ErrorBoundary } from '@/components/error-boundary';

import { AuthProvider } from './auth/AuthContext';
import { RoleRoute } from './auth/RoleRoute';
import { NoAccess } from './auth/NoAccess';

import { ClinicLayout } from './clinic/ClinicLayout';
import { ClinicOverview } from './clinic/ClinicOverview';
import { DoctorQueue } from './clinic/DoctorQueue';
import { DoctorReferrals } from './clinic/DoctorReferrals';
import { DoctorAttendance } from './clinic/DoctorAttendance';
import { DoctorPayroll } from './clinic/DoctorPayroll';
import { DoctorTreatments } from './clinic/DoctorTreatments';
import { LaborantLab } from './clinic/LaborantLab';
import { ReceptionLayout } from './reception/ReceptionLayout';
import { ReceptionOverview } from './reception/ReceptionOverview';
import { CashierLayout } from './cashier/CashierLayout';
import { CashierOverview } from './cashier/CashierOverview';

import './index.css';
import './admin/admin.css';

// Barcha same-origin /api/* fetch so'rovlariga localStorage'dagi JWT ni qo'shamiz.
// 401 kelsa — sessiya revoke/expired → lokal tokenni tozalash + login sahifasiga.
(() => {
  if (typeof window === 'undefined' || (window as any).__ssdFetchPatched) return;
  (window as any).__ssdFetchPatched = true;
  const TOKEN_KEY = 'ssd:auth:token';
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let response: Response;
    try {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
      const isSameOriginApi = url.startsWith('/api') || url.startsWith(`${location.origin}/api`);
      if (isSameOriginApi) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has('authorization') && !headers.has('x-api-key')) {
            headers.set('authorization', `Bearer ${token}`);
          }
          response = await originalFetch(input, { ...(init ?? {}), headers });
        } else {
          response = await originalFetch(input, init);
        }
        // Server tomonidan sessiya bekor qilingan / muddati o'tgan
        if (response.status === 401 && !url.includes('/api/auth/login')) {
          localStorage.removeItem(TOKEN_KEY);
          if (!location.pathname.startsWith('/no-access') && location.pathname !== '/') {
            setTimeout(() => { location.href = '/'; }, 50);
          }
        }
        return response;
      }
    } catch { /* no-op */ }
    return originalFetch(input, init);
  };
})();

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/no-access" element={<NoAccess />} />

          {/* ADMIN — faqat admin */}
          <Route path="/admin" element={
            <RoleRoute allow={['admin']}><AdminLayout /></RoleRoute>
          }>
            <Route index element={<AdminOverview />} />
            <Route path="queue" element={<AdminQueue />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="patients" element={<AdminPatients />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="workers" element={<AdminWorkers />} />
            <Route path="payroll" element={<AdminPayroll />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="assignments" element={<AdminAssignments />} />
            <Route path="finance" element={<AdminFinance />} />
            <Route path="cashier" element={<AdminCashier />} />
            <Route path="debts" element={<Navigate to="/admin/cashier" replace />} />
            <Route path="call-center" element={<AdminCallCenter />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="treatments" element={<AdminTreatments />} />
            <Route path="tech-products" element={<AdminTechProducts />} />
            <Route path="prescriptions" element={<AdminPrescriptions />} />
            <Route path="laboratory" element={<AdminLaboratory />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* CLINIC — shifokor, laborant */}
          <Route path="/clinic" element={
            <RoleRoute allow={['shifokor', 'laborant']}><ClinicLayout /></RoleRoute>
          }>
            <Route index element={<ClinicOverview />} />
            <Route path="queue" element={<DoctorQueue />} />
            <Route path="patients" element={<AdminPatients />} />
            <Route path="treatments" element={<DoctorTreatments />} />
            <Route path="prescriptions" element={<AdminPrescriptions />} />
            <Route path="referrals" element={<DoctorReferrals />} />
            <Route path="laboratory" element={<LaborantLab />} />
            <Route path="attendance" element={<DoctorAttendance />} />
            <Route path="payroll" element={<DoctorPayroll />} />
          </Route>

          {/* RECEPTION — reg/oper/mod */}
          <Route path="/reception" element={
            <RoleRoute allow={['registrator']}><ReceptionLayout /></RoleRoute>
          }>
            <Route index element={<ReceptionOverview />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="queue" element={<AdminQueue />} />
            <Route path="patients" element={<AdminPatients />} />
            <Route path="call-center" element={<AdminCallCenter />} />
            <Route path="services" element={<AdminServices />} />
          </Route>

          {/* CASHIER / BUXGALTER — admin kabi, faqat Davolash va Xizmatlar bo'limlarisiz */}
          <Route path="/cashier" element={
            <RoleRoute allow={['kassir', 'buxgalter']}><CashierLayout /></RoleRoute>
          }>
            <Route index element={<CashierOverview />} />
            <Route path="kassa" element={<AdminCashier />} />
            <Route path="finance" element={<AdminFinance />} />
            <Route path="call-center" element={<AdminCallCenter />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="queue" element={<AdminQueue />} />
            <Route path="patients" element={<AdminPatients />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="workers" element={<AdminWorkers />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="payroll" element={<AdminPayroll />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
