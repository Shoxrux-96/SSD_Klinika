import { useState } from 'react';
import { CheckCircle2, Clock3, DoorOpen, Monitor, Phone, Printer, Trash2, UserCheck } from 'lucide-react';
import {
  printQueueTicket, removeFromQueue, setQueueStatus, useQueue,
  getChekWidth, setChekWidth, type ChekWidth, type QueueItem,
} from '../store';
import { usePagination, TablePagination } from '../components/TablePagination';
import { TvScreen } from '../components/TvScreen';

function waitLabel(ms: number) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return `${min} daq`;
}

type QStatus = 'navbatda' | 'kabinetda' | 'tugatildi';

function statusChip(s: QStatus) {
  if (s === 'kabinetda') return <span className="admin-chip chip-ok">Kabinetda</span>;
  if (s === 'tugatildi') return <span className="admin-chip chip-missed">Tugatildi</span>;
  return <span className="admin-chip chip-wait">Navbatda</span>;
}

/** Bir marta bosiladigan status tugmalari (double-click himoyasi) */
function QueueStatusActions({ item }: { item: QueueItem }) {
  const [busy, setBusy] = useState(false);
  const callToRoom = async () => {
    if (busy || item.status === 'kabinetda' || item.status === 'tugatildi') return;
    setBusy(true);
    try { await setQueueStatus(item.id, 'kabinetda'); } finally { setBusy(false); }
  };
  const markDone = async () => {
    if (busy || item.status === 'tugatildi') return;
    setBusy(true);
    try { await setQueueStatus(item.id, 'tugatildi'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy) return;
    if (!confirm("Navbatdan o'chirilsinmi? Bu amal qaytarib bo'lmaydi.")) return;
    setBusy(true);
    try { await removeFromQueue(item.id); } finally { setBusy(false); }
  };

  return (
    <div className="queue-actions">
      {/* Kabinetga chaqirish — faqat 'navbatda' statusida ko'rinadi */}
      {item.status === 'navbatda' && (
        <button
          className="admin-icon-btn sm ok"
          disabled={busy}
          onClick={callToRoom}
          title="Kabinetga chaqirish"
          aria-label="Kabinetga chaqirish"
        >
          <DoorOpen size={14} />
        </button>
      )}
      {/* Tugatildi — 'kabinetda' statusida ko'rinadi */}
      {item.status === 'kabinetda' && (
        <button
          className="admin-icon-btn sm ok"
          disabled={busy}
          onClick={markDone}
          title="Qabulni yakunlash"
          aria-label="Tugatildi"
        >
          <CheckCircle2 size={14} />
        </button>
      )}
      {/* Chek chop etish — har doim mumkin (navbat talonini qayta chop etish) */}
      <button
        className="admin-icon-btn sm"
        onClick={() => printQueueTicket(item)}
        title="Navbat chekini chop etish"
        aria-label="Chekni chop etish"
      >
        <Printer size={14} />
      </button>
      {/* Qo'ng'iroq — jonli bemor bilan aloqa (hamma statusda) */}
      <button
        className="admin-icon-btn sm warn"
        title="Qo'ng'iroq"
        aria-label="Qo'ng'iroq"
      >
        <Phone size={14} />
      </button>
      {/* O'chirish — faqat tugatilmagan statuslarda */}
      {item.status !== 'tugatildi' && (
        <button
          className="admin-icon-btn sm danger"
          disabled={busy}
          onClick={remove}
          title="Navbatdan o'chirish"
          aria-label="O'chirish"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function AdminQueue() {
  const queue = useQueue();
  const [tvOpen, setTvOpen] = useState(false);
  const [chekW, setChekW] = useState<ChekWidth>(() => getChekWidth());
  const changeWidth = (w: ChekWidth) => { setChekWidth(w); setChekW(w); };
  const pg = usePagination(queue, [queue.length]);

  const inRoom = queue.filter((q) => q.status === 'kabinetda').length;
  const waiting = queue.filter((q) => q.status === 'navbatda').length;
  const done = queue.filter((q) => q.status === 'tugatildi').length;
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
            <Printer size={14} /> Chek kengligi:
            <select
              value={chekW}
              onChange={(e) => changeWidth(e.target.value as ChekWidth)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13 }}
              title="Termal printer qog'oz kengligi"
            >
              <option value="58mm">58mm (kichik)</option>
              <option value="72mm">72mm</option>
              <option value="76mm">76mm</option>
              <option value="80mm">80mm (standart)</option>
              <option value="112mm">112mm (katta)</option>
            </select>
          </label>
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
        <div className="admin-stat-card"><div className="admin-stat-icon"><CheckCircle2 size={18} /></div><div className="admin-stat-copy"><small>Yakunlangan</small><strong>{done} bemor</strong><span className="admin-stat-trend trend-up">bugun</span></div></div>
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
                    <QueueStatusActions item={q} />
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

