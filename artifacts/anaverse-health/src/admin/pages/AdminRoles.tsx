import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

const permissions = [
  'Boshqaruv paneliga kirish',
  'Bemorlarni ko‘rish',
  'Bemorlarni qo‘shish/tahrirlash',
  'Qabullarni boshqarish',
  'Shifokorlarni boshqarish',
  'Xodimlarni boshqarish',
  'Rollarni boshqarish',
  'Xizmatlarni boshqarish',
  'Moliya hisobotlari',
  'Tizim sozlamalari',
];

type Role = { id: string; name: string; permissions: string[] | Record<string, boolean>; createdAt: number };
type User = { id: string; username: string; roleId: string | null; fullName: string; active: boolean };

const COLORS = ['#ff3c00', '#2c7766', '#4a5bcf', '#9c6b00', '#634a9f', '#17a2b8'];

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  const t = await res.text(); return t ? (JSON.parse(t) as T) : (undefined as T);
}

function grantsOf(r: Role): boolean[] {
  const p = r.permissions as any;
  if (Array.isArray(p)) {
    if (p.includes('*')) return permissions.map(() => true);
    return permissions.map((_, i) => p.includes(String(i)) || p.includes(permissions[i]));
  }
  if (p && typeof p === 'object') {
    return permissions.map((perm, i) => Boolean(p[perm] ?? p[i]));
  }
  return permissions.map(() => false);
}

export function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api<Role[]>('/roles'), api<User[]>('/users')])
      .then(([r, u]) => { setRoles(r); setUsers(u); })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const userCount = (roleId: string) => users.filter((u) => u.roleId === roleId && u.active).length;

  const toggle = async (roleId: string, permIndex: number) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const g = grantsOf(role);
    g[permIndex] = !g[permIndex];
    const nextPerms = permissions.filter((_, i) => g[i]);
    setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, permissions: nextPerms } : r)));
    try {
      await api(`/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify({ permissions: nextPerms }) });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Rollar va huquqlar</h1>
          <p>Har bir rol uchun ruxsat etilgan amallarni belgilang. Katakka bosib huquqni yoqing yoki o‘chiring.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary">+ Yangi rol</button>
        </div>
      </div>
      <section className="admin-card">
        {loading && <p className="admin-cell-muted" style={{ padding: 16 }}>Yuklanmoqda…</p>}
        {!loading && roles.length === 0 && (
          <p className="admin-cell-muted" style={{ padding: 16 }}>Rollar yo'q.</p>
        )}
        {!loading && roles.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-matrix roles-table">
              <thead>
                <tr>
                  <th>Huquq</th>
                  {roles.map((r, i) => {
                    const g = grantsOf(r);
                    return (
                      <th key={r.id}>
                        <div className="admin-role-head">
                          <span className="admin-role-dot" style={{ background: COLORS[i % COLORS.length] }} />
                          <div>
                            <strong>{r.name}</strong>
                            <small>{userCount(r.id)} ta foydalanuvchi · {g.filter(Boolean).length}/{permissions.length}</small>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm, pi) => (
                  <tr key={perm}>
                    <td><strong>{perm}</strong></td>
                    {roles.map((role) => {
                      const granted = grantsOf(role)[pi];
                      return (
                        <td key={role.id} className="admin-cell-center">
                          <button
                            type="button"
                            className={`role-toggle ${granted ? 'yes' : 'no'}`}
                            onClick={() => toggle(role.id, pi)}
                            aria-label={granted ? 'Huquqni olib tashlash' : 'Huquq berish'}
                            title={granted ? 'Ruxsat berilgan — bosib olib tashlang' : 'Rad etilgan — bosib ruxsat bering'}
                          >
                            {granted ? <Check size={16} /> : <X size={16} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
