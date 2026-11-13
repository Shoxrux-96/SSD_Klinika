import { useEffect, useState } from 'react';
import {
  Check, X, Lock, Info, ShieldCheck, Stethoscope, FlaskConical, ClipboardList,
  Wallet, Calculator, UserCog, Users, UserPlus, Activity, CalendarCheck, FileText,
  Pill, Microscope, Receipt, Settings as SettingsIcon, Phone, Package, Shield,
  LayoutDashboard, Briefcase, TrendingUp, UserX, UserRound, Smile, DollarSign,
} from 'lucide-react';

// Rollar — RBAC middleware'da amalga oshirilgan (rbac.ts fayli).
type BuiltInRole = {
  id: 'admin' | 'shifokor' | 'laborant' | 'registrator' | 'kassir' | 'buxgalter' | 'oddiy';
  name: string;
  color: string;      // HEX
  bgColor: string;    // orqa fon
  home: string;
  icon: typeof ShieldCheck;
  description: string;
};

const ROLES: BuiltInRole[] = [
  { id: 'admin',       name: 'Administrator', color: '#ffffff', bgColor: '#4f46e5', home: '/admin',     icon: ShieldCheck,    description: "Tizim to'liq boshqaruvi" },
  { id: 'shifokor',    name: 'Shifokor',      color: '#ffffff', bgColor: '#059669', home: '/clinic',    icon: Stethoscope,    description: 'Davolash va retsept' },
  { id: 'laborant',    name: 'Laborant',      color: '#ffffff', bgColor: '#9333ea', home: '/clinic',    icon: FlaskConical,   description: 'Laboratoriya tahlillari' },
  { id: 'registrator', name: 'Registrator',   color: '#ffffff', bgColor: '#ea580c', home: '/reception', icon: UserCog,        description: 'Qabul va navbat' },
  { id: 'kassir',      name: 'Kassir',        color: '#ffffff', bgColor: '#0891b2', home: '/cashier',   icon: Wallet,         description: "To'lov va qarz" },
  { id: 'buxgalter',   name: 'Buxgalter',     color: '#ffffff', bgColor: '#7c2d12', home: '/cashier',   icon: Calculator,     description: 'Moliya va payroll' },
  { id: 'oddiy',       name: 'Oddiy',         color: '#ffffff', bgColor: '#64748b', home: '/no-access', icon: UserX,          description: "Kirishga ruxsat yo'q" },
];

type Permission = {
  key: string;
  label: string;
  group: string;
  icon: typeof ShieldCheck;
  roles: BuiltInRole['id'][];
};

type Group = {
  key: string;
  name: string;
  icon: typeof ShieldCheck;
  color: string;
};

const GROUPS: Group[] = [
  { key: 'admin',     name: 'Boshqaruv',   icon: Shield,           color: '#4f46e5' },
  { key: 'staff',     name: 'Hodimlar',    icon: Users,            color: '#059669' },
  { key: 'patients',  name: 'Bemorlar',    icon: UserRound,        color: '#0891b2' },
  { key: 'appts',     name: 'Qabul',       icon: CalendarCheck,    color: '#ea580c' },
  { key: 'services',  name: 'Xizmatlar',   icon: Briefcase,        color: '#9333ea' },
  { key: 'clinical',  name: 'Klinik',      icon: Stethoscope,      color: '#dc2626' },
  { key: 'finance',   name: 'Moliya',      icon: DollarSign,       color: '#f59e0b' },
  { key: 'callcenter',name: 'Call-markaz', icon: Phone,            color: '#ec4899' },
  { key: 'inventory', name: 'Inventar',    icon: Package,          color: '#7c2d12' },
];

const PERMISSIONS: Permission[] = [
  // Boshqaruv
  { key: 'admin_panel',     group: 'admin',     label: "Boshqaruv paneliga kirish",     icon: LayoutDashboard, roles: ['admin'] },
  { key: 'manage_users',    group: 'admin',     label: "Foydalanuvchilarni boshqarish", icon: UserCog,         roles: ['admin'] },
  { key: 'manage_roles',    group: 'admin',     label: "Rollar va huquqlar",            icon: Shield,          roles: ['admin'] },
  { key: 'manage_settings', group: 'admin',     label: "Tizim sozlamalari",             icon: SettingsIcon,    roles: ['admin'] },
  { key: 'read_audit',      group: 'admin',     label: "Audit log ko'rish",              icon: Activity,        roles: ['admin'] },

  // Hodimlar
  { key: 'read_employees',  group: 'staff',     label: "Hodimlar ro'yxati",              icon: Users,           roles: ['admin', 'shifokor', 'laborant', 'registrator', 'kassir', 'buxgalter'] },
  { key: 'write_employees', group: 'staff',     label: "Hodim qo'shish/tahrirlash",      icon: UserPlus,        roles: ['admin'] },

  // Bemorlar
  { key: 'read_patients',   group: 'patients',  label: "Bemorlar ro'yxati",              icon: UserRound,       roles: ['admin', 'shifokor', 'laborant', 'registrator', 'kassir', 'buxgalter'] },
  { key: 'write_patients',  group: 'patients',  label: "Bemor yaratish/tahrirlash",      icon: UserPlus,        roles: ['admin', 'registrator', 'shifokor'] },
  { key: 'delete_patients', group: 'patients',  label: "Bemorni o'chirish",              icon: UserX,           roles: ['admin'] },

  // Qabul
  { key: 'read_appts',      group: 'appts',     label: "Qabullar ro'yxati",              icon: CalendarCheck,   roles: ['admin', 'shifokor', 'laborant', 'registrator', 'kassir', 'buxgalter'] },
  { key: 'write_appts',     group: 'appts',     label: "Qabul yaratish/o'zgartirish",    icon: CalendarCheck,   roles: ['admin', 'registrator', 'shifokor'] },
  { key: 'manage_queue',    group: 'appts',     label: "Navbat boshqarish",              icon: Activity,        roles: ['admin', 'registrator', 'shifokor'] },

  // Xizmatlar
  { key: 'read_services',   group: 'services',  label: "Xizmatlar katalogi",             icon: Briefcase,       roles: ['admin', 'shifokor', 'laborant', 'registrator', 'kassir', 'buxgalter'] },
  { key: 'write_services',  group: 'services',  label: "Xizmat yaratish / narx",         icon: Briefcase,       roles: ['admin'] },

  // Klinik
  { key: 'read_clinical',   group: 'clinical',  label: "Davolash / retsept / tahlil",    icon: ClipboardList,   roles: ['admin', 'shifokor', 'laborant', 'registrator', 'kassir', 'buxgalter'] },
  { key: 'write_treatment', group: 'clinical',  label: "Davolash yozuvi",                icon: FileText,        roles: ['admin', 'shifokor'] },
  { key: 'write_rx',        group: 'clinical',  label: "Retsept yozish",                 icon: Pill,            roles: ['admin', 'shifokor'] },
  { key: 'write_lab',       group: 'clinical',  label: "Tahlil natijalari",              icon: Microscope,      roles: ['admin', 'shifokor', 'laborant'] },

  // Moliya
  { key: 'read_finance',    group: 'finance',   label: "Tranzaksiyalar / qarzlar",       icon: Receipt,         roles: ['admin', 'kassir', 'buxgalter'] },
  { key: 'write_payment',   group: 'finance',   label: "To'lov qabul qilish",            icon: Wallet,          roles: ['admin', 'kassir', 'buxgalter'] },
  { key: 'manage_payroll',  group: 'finance',   label: "Oylik maosh belgilash",          icon: Calculator,      roles: ['admin', 'buxgalter'] },
  { key: 'read_reports',    group: 'finance',   label: "Hisobotlar",                     icon: TrendingUp,      roles: ['admin', 'kassir', 'buxgalter'] },

  // Call-markaz
  { key: 'read_calls',      group: 'callcenter',label: "Qo'ng'iroq vazifalari",          icon: Phone,           roles: ['admin', 'registrator', 'shifokor'] },
  { key: 'write_calls',     group: 'callcenter',label: "Qo'ng'iroq yaratish/yangilash",  icon: Phone,           roles: ['admin', 'registrator'] },

  // Inventar
  { key: 'read_tech',       group: 'inventory', label: "Texnik mahsulotlar",             icon: Package,         roles: ['admin', 'shifokor', 'kassir', 'buxgalter'] },
  { key: 'write_tech_ord',  group: 'inventory', label: "Tibbiy buyurtma yaratish",       icon: Package,         roles: ['admin', 'shifokor'] },
  { key: 'read_att',        group: 'inventory', label: "Davomat",                        icon: CalendarCheck,   roles: ['admin', 'shifokor', 'laborant', 'registrator', 'kassir', 'buxgalter'] },
];

export function AdminRoles() {
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const map: Record<string, number> = {};
        for (const u of rows) {
          if (!u.username) continue;
          const r = u.role ?? 'oddiy';
          map[r] = (map[r] ?? 0) + 1;
        }
        setUserCounts(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalGranted = (roleId: BuiltInRole['id']) =>
    roleId === 'admin' ? PERMISSIONS.length : PERMISSIONS.filter((p) => p.roles.includes(roleId)).length;

  return (
    <div className="admin-page">
      <style>{css}</style>

      <div className="admin-page-head">
        <div>
          <h1>Rollar va huquqlar</h1>
          <p>Tizimda belgilangan 7 ta rol — har biri uchun aniq ruxsat etilgan amallar</p>
        </div>
      </div>

      {/* Ko'k ogohlantirish — bu matritsa o'qish rejimida */}
      <div className="rbac-banner">
        <div className="rbac-banner-ico"><Info size={18} /></div>
        <div>
          <strong>O'qish uchun matritsa</strong>
          <p>
            Bu huquqlar tizimda <code>rbac.ts</code> fayli orqali qat'iy belgilangan. Admin uni
            o'zgartira olmaydi — xavfsizlik uchun. Yangi hodim qo'shganingizda shu 7 ta roldan birini tanlang.
          </p>
        </div>
      </div>

      {/* Rol kartochkalari — tezkor ko'rinish */}
      <div className="rbac-role-cards">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.id} className="rbac-role-card" style={{ borderTopColor: r.bgColor }}>
              <div className="rbac-role-card-head">
                <div className="rbac-role-ico" style={{ background: r.bgColor }}>
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.description}</small>
                </div>
              </div>
              <div className="rbac-role-stats">
                <div>
                  <span className="rbac-stat-n">{userCounts[r.id] ?? 0}</span>
                  <small>hodim</small>
                </div>
                <div>
                  <span className="rbac-stat-n">{totalGranted(r.id)}</span>
                  <small>huquq</small>
                </div>
                <div>
                  <code className="rbac-home">{r.home}</code>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Asosiy matritsa — guruhlar bo'yicha */}
      {loading ? (
        <section className="admin-card" style={{ padding: 20 }}>
          <p className="admin-cell-muted">Yuklanmoqda…</p>
        </section>
      ) : (
        GROUPS.map((group) => {
          const groupPerms = PERMISSIONS.filter((p) => p.group === group.key);
          if (groupPerms.length === 0) return null;
          const Icon = group.icon;
          return (
            <section key={group.key} className="admin-card rbac-group-card">
              <div className="rbac-group-head" style={{ background: `${group.color}10`, borderBottomColor: `${group.color}30` }}>
                <div className="rbac-group-ico" style={{ background: group.color }}>
                  <Icon size={18} strokeWidth={2.4} />
                </div>
                <h2>{group.name}</h2>
                <span className="rbac-group-count">{groupPerms.length} ta huquq</span>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table rbac-table">
                  <thead>
                    <tr>
                      <th>Huquq</th>
                      {ROLES.map((r) => {
                        const RIcon = r.icon;
                        return (
                          <th key={r.id} className="rbac-role-col">
                            <div className="rbac-role-header-cell">
                              <span className="rbac-role-chip" style={{ background: r.bgColor }}>
                                <RIcon size={12} />
                              </span>
                              <small>{r.name}</small>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groupPerms.map((perm) => {
                      const PIcon = perm.icon;
                      return (
                        <tr key={perm.key}>
                          <td>
                            <div className="rbac-perm-cell">
                              <span className="rbac-perm-ico" style={{ background: `${group.color}15`, color: group.color }}>
                                <PIcon size={15} />
                              </span>
                              <strong>{perm.label}</strong>
                            </div>
                          </td>
                          {ROLES.map((r) => {
                            const granted = r.id === 'admin' || perm.roles.includes(r.id);
                            return (
                              <td key={r.id} className="admin-cell-center">
                                {granted ? (
                                  <span
                                    className="rbac-tick yes"
                                    style={{ background: `${r.bgColor}20`, color: r.bgColor }}
                                    title={`${r.name} — ruxsat etilgan`}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </span>
                                ) : (
                                  <span className="rbac-tick no" title={`${r.name} — ruxsat yo'q`}>
                                    <X size={14} strokeWidth={2.5} />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      {/* Pastki eslatma */}
      <div className="rbac-footer-note">
        <Lock size={13} />
        <small>
          Xavfsizlik siyosati: bu matritsa koddan tashqari o'zgartirilmaydi. Agar
          kompaniya o'sib yangi rol kerak bo'lsa — dasturchiga murojaat qiling.
          Manba: <code>artifacts/api-server/src/middlewares/rbac.ts</code>
        </small>
      </div>
    </div>
  );
}

const css = `
/* Yuqori ko'k ogohlantirish */
.rbac-banner {
  display: flex; gap: 14px; align-items: flex-start;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  border: 1px solid #93c5fd;
  padding: 16px 18px; border-radius: 12px; margin-bottom: 20px;
}
.rbac-banner-ico {
  width: 36px; height: 36px; border-radius: 10px;
  background: #3b82f6; color: #fff;
  display: grid; place-items: center; flex-shrink: 0;
}
.rbac-banner strong { display: block; margin-bottom: 4px; color: #1e3a8a; font-size: 14px; }
.rbac-banner p { margin: 0; color: #1e40af; font-size: 12.5px; line-height: 1.5; }
.rbac-banner code { background: rgba(37, 99, 235, 0.15); padding: 1px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; }

/* Rol kartochkalari — yuqorida */
.rbac-role-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}
.rbac-role-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-top: 3px solid;
  border-radius: 12px;
  padding: 14px;
  transition: transform .15s, box-shadow .15s;
}
.rbac-role-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -8px rgba(15, 23, 42, 0.12);
}
.rbac-role-card-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
.rbac-role-ico {
  width: 36px; height: 36px; border-radius: 10px; color: #fff;
  display: grid; place-items: center; flex-shrink: 0;
  box-shadow: 0 4px 10px -4px rgba(15, 23, 42, 0.2);
}
.rbac-role-card-head strong {
  display: block; font-size: 14px; color: #0f172a; line-height: 1.3;
}
.rbac-role-card-head small {
  display: block; font-size: 11.5px; color: #64748b; margin-top: 2px; line-height: 1.4;
}
.rbac-role-stats {
  display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 6px;
  padding-top: 10px; border-top: 1px solid #f1f5f9;
}
.rbac-role-stats > div { text-align: center; }
.rbac-stat-n {
  display: block; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1;
}
.rbac-role-stats small {
  display: block; font-size: 10px; color: #94a3b8; margin-top: 3px;
  text-transform: uppercase; letter-spacing: 0.4px;
}
.rbac-home {
  display: inline-block; font-size: 11px;
  background: #f1f5f9; color: #475569;
  padding: 3px 7px; border-radius: 5px; margin-top: 4px;
}

/* Guruhlar — alohida kartalar */
.rbac-group-card { padding: 0; overflow: hidden; margin-bottom: 14px; }
.rbac-group-head {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid;
}
.rbac-group-ico {
  width: 36px; height: 36px; border-radius: 10px; color: #fff;
  display: grid; place-items: center;
}
.rbac-group-head h2 { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; flex: 1; }
.rbac-group-count {
  font-size: 11.5px; color: #64748b; font-weight: 600;
  background: #fff; padding: 4px 10px; border-radius: 10px; border: 1px solid #e2e8f0;
}

/* Jadval */
.rbac-table thead th {
  background: #f8fafc; padding: 10px 8px !important;
  vertical-align: middle;
}
.rbac-table tbody tr:hover { background: #fafbfc; }
.rbac-role-col { min-width: 85px; width: 85px; }
.rbac-role-header-cell {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.rbac-role-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 7px;
  color: #fff; box-shadow: 0 2px 6px -2px rgba(0,0,0,0.25);
}
.rbac-role-header-cell small {
  font-size: 10.5px; color: #475569; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.3px;
}

.rbac-perm-cell {
  display: flex; align-items: center; gap: 10px;
}
.rbac-perm-ico {
  width: 28px; height: 28px; border-radius: 7px;
  display: grid; place-items: center; flex-shrink: 0;
}
.rbac-perm-cell strong { font-size: 13px; color: #1e293b; font-weight: 500; }

/* Belgilar — katta va aniq */
.rbac-tick {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px;
  transition: transform .12s;
}
.rbac-tick.yes { font-weight: 700; }
.rbac-tick.no {
  background: #f1f5f9;
  color: #cbd5e1;
}

/* Pastki eslatma */
.rbac-footer-note {
  display: inline-flex; gap: 6px; align-items: center;
  margin-top: 16px; padding: 10px 14px;
  background: #f8fafc; border: 1px dashed #cbd5e1;
  border-radius: 8px; color: #64748b;
}
.rbac-footer-note code {
  background: #fff; padding: 2px 6px; border-radius: 4px;
  font-size: 11.5px; color: #4f46e5; border: 1px solid #e2e8f0;
}

/* Mobil */
@media (max-width: 900px) {
  .rbac-role-cards { grid-template-columns: repeat(2, 1fr); }
  .rbac-role-col { min-width: 65px; width: 65px; }
  .rbac-role-header-cell small { font-size: 9.5px; }
  .rbac-perm-cell strong { font-size: 12px; }
  .rbac-tick { width: 24px; height: 24px; }
}
@media (max-width: 560px) {
  .rbac-role-cards { grid-template-columns: 1fr; }
}
`;
