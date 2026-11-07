import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, type Role } from './AuthContext';

export function RoleRoute({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="auth-loading">Yuklanmoqda…</div>;
  if (!user) return <Navigate to="/" state={{ from: loc.pathname }} replace />;
  if (!allow.includes(user.role)) return <Navigate to="/no-access" replace />;
  return <>{children}</>;
}

export function Authenticated({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading">Yuklanmoqda…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
