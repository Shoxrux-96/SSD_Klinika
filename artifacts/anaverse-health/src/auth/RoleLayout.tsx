import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, Hospital, LogOut, Menu, Search, X,
} from 'lucide-react';
import { useAuth } from './AuthContext';

export type NavItem = { to: string; end?: boolean; icon: any; label: string };
export type NavSection = { key: string; label: string; items: NavItem[] };

export function RoleLayout({
  brandSub, topItems, sections,
}: {
  brandSub: string;
  topItems: NavItem[];
  sections: NavSection[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useAuth();

  const activeSection = sections.find((s) =>
    s.items.some((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to))),
  )?.key ?? sections[0]?.key;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    activeSection ? { [activeSection]: true } : {},
  );

  const toggleSection = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className={`admin-shell${sidebarOpen ? ' is-mobile-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <a className="admin-brand" href={topItems[0]?.to ?? '/'}>
            <span className="admin-brand-mark"><Hospital size={20} strokeWidth={2.4} /></span>
            <span className="admin-brand-name">
              <strong>SSD KLINIKA</strong>
              <small>{brandSub}</small>
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
                key={item.to} to={item.to} end={item.end}
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
            const hasActive = section.items.some((i) =>
              i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to),
            );
            return (
              <div className={`admin-nav-group${isOpen ? ' is-open' : ''}${hasActive ? ' has-active' : ''}`} key={section.key}>
                <button type="button" className="admin-nav-group-head" onClick={() => toggleSection(section.key)} aria-expanded={isOpen}>
                  <span>{section.label}</span>
                  <ChevronDown size={14} className="admin-nav-chevron" />
                </button>
                <ul className="admin-nav-list">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to} end={item.end}
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
            <span className="admin-user-avatar">{(user?.fullName ?? '?').charAt(0).toUpperCase()}</span>
            <span className="admin-user-copy">
              <strong>{user?.fullName ?? '—'}</strong>
              <small>{user?.role ?? ''}</small>
            </span>
          </div>
          <button type="button" className="admin-logout" onClick={() => { logout(); nav('/'); }} aria-label="Chiqish">
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
            <input type="text" placeholder="Qidirish…" aria-label="Qidirish" />
            <kbd>⌘K</kbd>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" className="admin-icon-btn" aria-label="Bildirishnomalar">
              <Bell size={18} />
              <span className="admin-badge-dot" aria-hidden="true" />
            </button>
            <button type="button" className="admin-profile">
              <span className="admin-user-avatar sm">{(user?.fullName ?? '?').charAt(0).toUpperCase()}</span>
              <span>{user?.username ?? user?.fullName}</span>
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
