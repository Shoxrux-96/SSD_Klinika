import { useEffect, useState } from 'react';
import { usePagination, TablePagination } from '../components/TablePagination';

type AuditLog = {
  id: string;
  actor: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  at: number;
};

function fmtTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/audit-logs')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((rows) => setLogs(Array.isArray(rows) ? rows.sort((a, b) => b.at - a.at) : []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const pg = usePagination(logs, [logs.length]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Audit log</h1>
          <p>Tizimdagi barcha harakatlar jurnali — xavfsizlik va kuzatuv uchun. ({logs.length} ta yozuv)</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-ghost">Excel yuklab olish</button>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vaqt</th>
                <th>Foydalanuvchi</th>
                <th>Harakat</th>
                <th>Obyekt</th>
                <th>Obyekt ID</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="admin-cell-muted">Yuklanmoqda…</td></tr>}
              {err && <tr><td colSpan={5} className="admin-cell-muted">Xatolik: {err}</td></tr>}
              {!loading && !err && logs.length === 0 && (
                <tr><td colSpan={5} className="admin-cell-muted">Hech qanday yozuv yo'q.</td></tr>
              )}
              {pg.pageRows.map((l) => (
                <tr key={l.id}>
                  <td className="admin-cell-muted">{fmtTime(l.at)}</td>
                  <td><strong>{l.actor ?? '—'}</strong></td>
                  <td>{l.action}</td>
                  <td className="admin-cell-muted">{l.entity}</td>
                  <td className="admin-cell-muted">{l.entityId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>
    </div>
  );
}
