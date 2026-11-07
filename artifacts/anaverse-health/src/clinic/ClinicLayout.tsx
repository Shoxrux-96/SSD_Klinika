import {
  LayoutDashboard, CalendarCheck, Users, ClipboardList, Pill, Share2, Wallet, ListOrdered, FlaskConical,
} from 'lucide-react';
import { RoleLayout, type NavSection } from '../auth/RoleLayout';
import { useAuth } from '../auth/AuthContext';

const topItems = [
  { to: '/clinic', end: true, icon: LayoutDashboard, label: 'Dashboard' },
];

const shifokorSections: NavSection[] = [
  { key: 'bemorlar', label: 'Bemorlar va navbat', items: [
    { to: '/clinic/queue', icon: ListOrdered, label: 'Navbat' },
    { to: '/clinic/patients', icon: Users, label: 'Bemorlar' },
  ]},
  { key: 'davolash', label: 'Davolash', items: [
    { to: '/clinic/treatments', icon: ClipboardList, label: 'Davolash tarixi' },
    { to: '/clinic/prescriptions', icon: Pill, label: 'Retseptlar' },
    { to: '/clinic/referrals', icon: Share2, label: 'Yo‘naltirilgan xizmatlar' },
  ]},
  { key: 'shaxsiy', label: 'Shaxsiy', items: [
    { to: '/clinic/attendance', icon: CalendarCheck, label: 'Mening davomatim' },
    { to: '/clinic/payroll', icon: Wallet, label: 'Oylik maosh' },
  ]},
];

const laborantSections: NavSection[] = [
  { key: 'bemorlar', label: 'Bemorlar va navbat', items: [
    { to: '/clinic/queue', icon: ListOrdered, label: 'Navbat' },
    { to: '/clinic/patients', icon: Users, label: 'Bemorlar' },
  ]},
  { key: 'ish', label: 'Laboratoriya', items: [
    { to: '/clinic/laboratory', icon: FlaskConical, label: 'Laboratoriya' },
    { to: '/clinic/treatments', icon: ClipboardList, label: 'Davolash tarixi' },
    { to: '/clinic/prescriptions', icon: Pill, label: 'Retseptlar' },
  ]},
  { key: 'shaxsiy', label: 'Shaxsiy', items: [
    { to: '/clinic/attendance', icon: CalendarCheck, label: 'Mening davomatim' },
    { to: '/clinic/payroll', icon: Wallet, label: 'Oylik maosh' },
  ]},
];

export function ClinicLayout() {
  const { user } = useAuth();
  const isLaborant = user?.role === 'laborant';
  return (
    <RoleLayout
      brandSub={isLaborant ? 'Laborant paneli' : 'Shifokor paneli'}
      topItems={topItems}
      sections={isLaborant ? laborantSections : shifokorSections}
    />
  );
}
