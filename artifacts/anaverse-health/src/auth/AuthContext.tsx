import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Role = 'admin' | 'shifokor' | 'laborant' | 'registrator' | 'kassir' | 'buxgalter' | 'oddiy';

export type AuthUser = {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  category: string;
  home: string;
};

type AuthCtx = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<AuthUser>;
  logout: () => Promise<void> | void;
};

const Ctx = createContext<AuthCtx | null>(null);
const TOKEN_KEY = 'ssd:auth:token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('invalid');
        setUser(await res.json());
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null); setUser(null);
      } finally { setLoading(false); }
    })();
  }, [token]);

  async function login(username: string, password: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Kirish xatosi' }));
      throw new Error(err.error ?? 'Kirish xatosi');
    }
    const { token: t, user: u } = await res.json();
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    return u;
  }

  async function logout() {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      // Serverdagi sessiyani bekor qilish (revoke). Xato bo'lsa ham lokal tozalash bajariladi.
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { authorization: `Bearer ${t}` },
        });
      } catch { /* no-op */ }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null); setUser(null);
  }

  return <Ctx.Provider value={{ user, token, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
