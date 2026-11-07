import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';

export function NoAccess() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="noaccess-wrap">
      <style>{`
        .noaccess-wrap { min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e2e8f0; padding: 24px; }
        .noaccess-card { max-width: 440px; width: 100%; background: linear-gradient(180deg,#111827,#0b1220); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 32px; text-align: center; }
        .noaccess-ico { width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 16px; background: rgba(239,68,68,.15); color: #fca5a5; display: grid; place-items: center; }
        .noaccess-card h1 { margin: 0 0 8px; font-size: 20px; color: #f8fafc; }
        .noaccess-card p { color: #94a3b8; font-size: 14px; margin: 0 0 20px; }
        .noaccess-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .noaccess-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 0; }
        .noaccess-btn-ghost { background: rgba(255,255,255,.06); color: #cbd5e1; }
        .noaccess-btn-ghost:hover { background: rgba(255,255,255,.1); }
        .noaccess-btn-primary { background: linear-gradient(135deg,#ef4444,#dc2626); color: #fff; box-shadow: 0 8px 22px -8px rgba(239,68,68,.6); }
      `}</style>
      <div className="noaccess-card">
        <div className="noaccess-ico"><ShieldAlert size={32} /></div>
        <h1>Ruxsat berilmagan</h1>
        <p>Sizda ushbu panelga kirish huquqi yo‘q. {user ? (<><br/><small>Foydalanuvchi: <b>{user.fullName}</b> · rol: <b>{user.role}</b></small></>) : null}</p>
        <div className="noaccess-actions">
          <button className="noaccess-btn noaccess-btn-ghost" onClick={() => nav('/')}>Bosh sahifa</button>
          <button className="noaccess-btn noaccess-btn-primary" onClick={() => { logout(); nav('/'); }}>
            <LogOut size={14} /> Chiqish
          </button>
        </div>
      </div>
    </div>
  );
}
