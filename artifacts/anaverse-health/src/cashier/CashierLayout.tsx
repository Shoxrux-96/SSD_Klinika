import {
  LayoutDashboard, Receipt, Wallet, PhoneCall,
  CalendarCheck, ListOrdered, Users, Stethoscope, UserCog,
} from 'lucide-react';
import { RoleLayout, type NavSection } from '../auth/RoleLayout';

const topItems = [
  { to: '/cashier', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cashier/kassa', icon: Receipt, label: 'Kassa' },
  { to: '/cashier/finance', icon: Wallet, label: 'Moliya' },
  { to: '/cashier/call-center', icon: PhoneCall, label: 'Call markaz' },
];

const sections: NavSection[] = [
  { key: 'bemorlar', label: 'Qabul va Bemorlar', items: [
    { to: '/cashier/appointments', icon: CalendarCheck, label: 'Qabullar' },
    { to: '/cashier/queue', icon: ListOrdered, label: 'Navbat' },
    { to: '/cashier/patients', icon: Users, label: 'Bemorlar' },
  ]},
  { key: 'hr', label: 'Hodimlar bo‘limi', items: [
    { to: '/cashier/staff', icon: Stethoscope, label: 'Shifokorlar' },
    { to: '/cashier/workers', icon: UserCog, label: 'Hodimlar' },
    { to: '/cashier/attendance', icon: CalendarCheck, label: 'Davomat' },
    { to: '/cashier/payroll', icon: Wallet, label: 'Oylik maosh va ulushlar' },
  ]},
];

export function CashierLayout() {
  return <RoleLayout brandSub="Kassa / Buxgalteriya" topItems={topItems} sections={sections} />;
}
