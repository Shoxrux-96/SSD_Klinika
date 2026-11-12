import {
  LayoutDashboard, CalendarCheck, Users, ListOrdered, PhoneCall, Briefcase, Receipt, Wallet,
} from 'lucide-react';
import { RoleLayout } from '../auth/RoleLayout';

const topItems = [
  { to: '/reception', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/reception/call-center', icon: PhoneCall, label: 'Call markaz' },
];

const sections = [
  { key: 'qabul', label: 'Qabul', items: [
    { to: '/reception/appointments', icon: CalendarCheck, label: 'Qabullar' },
    { to: '/reception/queue', icon: ListOrdered, label: 'Navbat' },
    { to: '/reception/patients', icon: Users, label: 'Bemorlar' },
  ]},
  { key: 'xizmat', label: 'Xizmat va kassa', items: [
    { to: '/reception/services', icon: Briefcase, label: 'Xizmatlar' },
    { to: '/reception/cashier', icon: Receipt, label: 'Kassa' },
  ]},
  { key: 'shaxsiy', label: 'Hodim boshqaruvi', items: [
    { to: '/reception/attendance', icon: CalendarCheck, label: 'Davomat (boshqarish)' },
    { to: '/reception/payroll', icon: Wallet, label: 'Oylik' },
  ]},
];

export function ReceptionLayout() {
  return <RoleLayout brandSub="Qabulxona" topItems={topItems} sections={sections} />;
}
