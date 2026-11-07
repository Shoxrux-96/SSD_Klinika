import {
  LayoutDashboard, CalendarCheck, Users, ListOrdered, PhoneCall, Briefcase,
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
  { key: 'xizmatlar', label: 'Ma\'lumot', items: [
    { to: '/reception/services', icon: Briefcase, label: 'Xizmatlar' },
  ]},
];

export function ReceptionLayout() {
  return <RoleLayout brandSub="Qabulxona" topItems={topItems} sections={sections} />;
}
