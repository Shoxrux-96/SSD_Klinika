import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  Hospital,
  LayoutDashboard,
  Link2,
  ListOrdered,
  LogOut,
  Menu,
  FlaskConical,
  Package,
  PhoneCall,
  Pill,
  Search,
  Settings,
  Receipt,
  Shield,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';

type NavItem = { to: string; end?: boolean; icon: typeof Users; label: string };
type NavSection = { key: string; label: string; items: NavItem[] };

const sections: NavSection[] = [
  { key: 'bemorlar', label: 'Qabul va Bemorlar', items: [
    { to: '/admin/appointments', icon: CalendarCheck, label: 'Qabullar' },
    { to: '/admin/queue', icon: ListOrdered, label: 'Navbat' },
    { to: '/admin/patients', icon: Users, label: 'Bemorlar' },
  ]},
  { key: 'hr', label: 'Hodimlar bo‘limi', items: [
    { to: '/admin/staff', icon: Stethoscope, label: 'Shifokorlar' },
    { to: '/admin/workers', icon: UserCog, label: 'Hodimlar' },
    { to: '/admin/attendance', icon: CalendarCheck, label: 'Davomat' },
    { to: '/admin/payroll', icon: Wallet, label: 'Oylik maosh va ulushlar' },
  ]},
  { key: 'moliya', label: 'Xizmatlar bo‘limi', items: [
    { to: '/admin/services', icon: Briefcase, label: 'Xizmatlar' },
    { to: '/admin/assignments', icon: Link2, label: 'Xizmat biriktirish' },
    { to: '/admin/reports', icon: FileBarChart, label: 'Hisobotlar' },
  ]},
  { key: 'davolash', label: 'Davolash bo‘limi', items: [
    { to: '/admin/treatments', icon: ClipboardList, label: 'Davolash tarixi' },
    { to: '/admin/prescriptions', icon: Pill, label: 'Retseptlar' },
    { to: '/admin/laboratory', icon: FlaskConical, label: 'Laboratoriya' },
    { to: '/admin/tech-products', icon: Package, label: 'Texnik buyurtma' },
  ]},
  { key: 'boshqaruv', label: 'Boshqaruv bo‘limi', items: [
    { to: '/admin/roles', icon: Shield, label: 'Rollar va huquqlar' },
    { to: '/admin/audit', icon: Activity, label: 'Audit log' },
    { to: '/admin/settings', icon: Settings, label: 'Sozlamalar' },
  ]},
];

const topItems: NavItem[] = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/cashier', icon: Receipt, label: 'Kassa' },
  { to: '/admin/finance', icon: Wallet, label: 'Moliya' },
  { to: '/admin/call-center', icon: PhoneCall, label: 'Call markaz' },
];

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Which section is currently active?
  const activeSection = sections.find((s) =>
    s.items.some((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)),
  )?.key ?? sections[0].key;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({ [activeSection]: true }));

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`admin-shell${sidebarOpen ? ' is-mobile-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <a className="admin-brand" href="/admin">
            <span className="admin-brand-mark"><Hospital size={20} strokeWidth={2.4} /></span>
            <span className="admin-brand-name">
              <strong>SSD KLINIKA</strong>
              <small>Admin panel</small>
            </span>
          </a>
          <button className="admin-sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Yopish">
            <X size={18} />
          </button>
        </div>

        <nav className="admin-nav">
          <div className="admin-nav-top">
            {topItems.map((item, idx) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-nav-link${idx === 0 ? ' admin-nav-link-top' : ''}${isActive ? ' is-active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
          {sections.map((section) => {
            const isOpen = !!openSections[section.key];
            const hasActive = section.items.some((item) =>
              item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
            );
            return (
              <div className={`admin-nav-group${isOpen ? ' is-open' : ''}${hasActive ? ' has-active' : ''}`} key={section.key}>
                <button
                  type="button"
                  className="admin-nav-group-head"
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={isOpen}
                >
                  <span>{section.label}</span>
                  <ChevronDown size={14} className="admin-nav-chevron" />
                </button>
                <ul className="admin-nav-list">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-user-chip">
            <span className="admin-user-avatar">A</span>
            <span className="admin-user-copy">
              <strong>Tizim admini</strong>
              <small>Barcha huquqlar</small>
            </span>
          </div>
          <button type="button" className="admin-logout" onClick={() => navigate('/')} aria-label="Chiqish">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" type="button" onClick={() => setSidebarOpen(true)} aria-label="Menyuni ochish">
            <Menu size={20} />
          </button>
          <div className="admin-search">
            <Search size={16} />
            <input type="text" placeholder="Qidirish — bemor, xodim, qabul, xizmat..." aria-label="Qidirish" />
            <kbd>⌘K</kbd>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" className="admin-icon-btn" aria-label="Bildirishnomalar">
              <Bell size={18} />
              <span className="admin-badge-dot" aria-hidden="true" />
            </button>
            <button type="button" className="admin-profile">
              <span className="admin-user-avatar sm">A</span>
              <span>Admin</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>

      <div className="admin-backdrop" role="presentation" onClick={() => setSidebarOpen(false)} />
    </div>
  );
}
