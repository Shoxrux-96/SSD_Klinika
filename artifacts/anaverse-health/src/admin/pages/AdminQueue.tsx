import { useState } from 'react';
import { Clock3, Monitor, Phone, UserCheck, X } from 'lucide-react';
import { removeFromQueue, setQueueStatus, useQueue } from '../store';
import { usePagination, TablePagination } from '../components/TablePagination';
import { TvScreen } from '../components/TvScreen';

function waitLabel(ms: number) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return `${min} daq`;
}

function statusChip(s: 'navbatda' | 'kabinetda' | 'tugatildi') {
  if (s === 'kabinetda') return <span className="admin-chip chip-ok">kabinetda</span>;
  if (s === 'tugatildi') return <span className="admin-chip chip-missed">tugatildi</span>;
  return <span className="admin-chip chip-wait">navbatda</span>;
}

export function AdminQueue() {
  const queue = useQueue();
  const [tvOpen, setTvOpen] = useState(false);
  const pg = usePagination(queue, [queue.length]);

  const inRoom = queue.filter((q) => q.status === 'kabinetda').length;
  const waiting = queue.filter((q) => q.status === 'navbatda').length;
  const avg =
    waiting === 0
      ? '0 daq'
      : `${Math.round(
          queue
            .filter((q) => q.status === 'navbatda')
            .reduce((s, q) => s + (Date.now() - q.addedAt) / 60000, 0) /
            Math.max(1, waiting),
        )} daq`;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Navbat</h1>
          <p>Qabulga «Keldi» bosilgan bemorlar avtomatik ravishda shu yerda ko‘rinadi.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-ghost"><Clock3 size={15} /> Real vaqt</button>
          <button className="admin-btn admin-btn-primary" onClick={() => setTvOpen(true)}>
            <Monitor size={15} /> TV ekran
          </button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card"><div className="admin-stat-icon"><UserCheck size={18} /></div><div className="admin-stat-copy"><small>Navbatda</small><strong>{waiting} bemor</strong><span className="admin-stat-trend trend-flat">joriy</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Clock3 size={18} /></div><div className="admin-stat-copy"><small>O‘rtacha kutish</small><strong>{avg}</strong><span className="admin-stat-trend trend-flat">joriy</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><UserCheck size={18} /></div><div className="admin-stat-copy"><small>Kabinetda</small><strong>{inRoom} bemor</strong><span className="admin-stat-trend trend-up">faol</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><X size={18} /></div><div className="admin-stat-copy"><small>Jami navbat</small><strong>{queue.length} bemor</strong><span className="admin-stat-trend trend-flat">bugun</span></div></div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Joriy navbat</h2>
            <small>Qabullar sahifasida «Keldi» bosilgach, bemor shu yerga keladi</small>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Bemor</th>
                <th>Shifokor</th>
                <th>Xizmat</th>
                <th>Kutish</th>
                <th>Holat</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr><td colSpan={7} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Navbat bo‘sh — bemorlar Qabullar sahifasidan «Keldi» bosilgach bu yerda paydo bo‘ladi</td></tr>
              )}
              {pg.pageRows.map((q) => (
                <tr key={q.id}>
                  <td className="admin-cell-time">{q.number}</td>
                  <td><strong>{q.patient}</strong></td>
                  <td className="admin-cell-muted">{q.doctor}</td>
                  <td>{q.service}</td>
                  <td className="admin-cell-muted">{waitLabel(q.addedAt)}</td>
                  <td>{statusChip(q.status)}</td>
                  <td className="admin-cell-right">
                    <div className="queue-actions">
                      <button
                        className="admin-icon-btn sm ok"
                        aria-label="Kabinetga chaqirish"
                        title="Kabinetga chaqirish"
                        onClick={() => setQueueStatus(q.id, 'kabinetda')}
                        disabled={q.status === 'kabinetda'}
                      >
                        <UserCheck size={14} />
                      </button>
                      <button className="admin-icon-btn sm warn" aria-label="Qo‘ng‘iroq" title="Qo‘ng‘iroq"><Phone size={14} /></button>
                      <button className="admin-icon-btn sm danger" aria-label="O‘chirish" title="O‘chirish" onClick={() => removeFromQueue(q.id)}><X size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>

      {tvOpen && <TvScreen onClose={() => setTvOpen(false)} />}
    </div>
  );
}

