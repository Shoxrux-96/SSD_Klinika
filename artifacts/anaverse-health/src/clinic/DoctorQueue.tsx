import { useMemo, useState } from 'react';
import { Clock3, Monitor, UserCheck, X, SkipForward, Bell } from 'lucide-react';
import { removeFromQueue, setQueueStatus, useQueue } from '../admin/store';
import { usePagination, TablePagination } from '../admin/components/TablePagination';
import { TvScreen } from '../admin/components/TvScreen';
import { useAuth } from '../auth/AuthContext';

function waitLabel(ms: number) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return `${min} daq`;
}
function statusChip(s: 'navbatda' | 'kabinetda' | 'tugatildi') {
  if (s === 'kabinetda') return <span className="admin-chip chip-ok">kabinetda</span>;
  if (s === 'tugatildi') return <span className="admin-chip chip-missed">tugatildi</span>;
  return <span className="admin-chip chip-wait">navbatda</span>;
}

export function DoctorQueue() {
  const { user } = useAuth();
  const all = useQueue();
  const mine = useMemo(
    () => all.filter((q) => q.doctor === user?.fullName),
    [all, user],
  );
  const [tvOpen, setTvOpen] = useState(false);
  const pg = usePagination(mine, [mine.length]);

  const inRoomList = mine.filter((q) => q.status === 'kabinetda');
  const waitList = mine.filter((q) => q.status === 'navbatda');
  const inRoom = inRoomList.length;
  const waiting = waitList.length;
  const nextWaiting = waitList[0]; // chaqiriladigan keyingi bemor
  const callNext = () => {
    if (!nextWaiting) return;
    setQueueStatus(nextWaiting.id, 'kabinetda');
  };
  const avg = waiting === 0 ? '0 daq' : `${Math.round(
    mine.filter((q) => q.status === 'navbatda').reduce((s, q) => s + (Date.now() - q.addedAt) / 60000, 0) / Math.max(1, waiting),
  )} daq`;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Navbat</h1>
          <p>Faqat sizga yozilgan bemorlar. Qabul qilish → TV ekranda ko‘rinadi.</p>
        </div>
        <div className="admin-page-actions">
          <button
            className="admin-btn admin-btn-primary dq-call-btn"
            disabled={!nextWaiting || inRoom > 0}
            title={inRoom > 0 ? 'Avval kabinetdagi bemor ishini yakunlang' : nextWaiting ? `Chaqirish: ${nextWaiting.patient}` : 'Navbatda bemor yo‘q'}
            onClick={callNext}
          >
            <Bell size={15} /> Keyingini chaqirish
            {nextWaiting && <span className="dq-call-sub">· {nextWaiting.patient}</span>}
          </button>
          <button className="admin-btn admin-btn-ghost" onClick={() => setTvOpen(true)}>
            <Monitor size={15} /> TV ekran
          </button>
        </div>
      </div>
      <style>{dqCss}</style>

      <div className="admin-stat-grid">
        <div className="admin-stat-card"><div className="admin-stat-icon"><UserCheck size={18} /></div><div className="admin-stat-copy"><small>Navbatda</small><strong>{waiting} bemor</strong><span className="admin-stat-trend trend-flat">siz uchun</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Clock3 size={18} /></div><div className="admin-stat-copy"><small>O‘rtacha kutish</small><strong>{avg}</strong><span className="admin-stat-trend trend-flat">joriy</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><UserCheck size={18} /></div><div className="admin-stat-copy"><small>Kabinetda</small><strong>{inRoom} bemor</strong><span className="admin-stat-trend trend-up">faol</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><X size={18} /></div><div className="admin-stat-copy"><small>Jami</small><strong>{mine.length} bemor</strong><span className="admin-stat-trend trend-flat">bugun</span></div></div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Navbat</h2><small>Qabulga «Keldi» bosilgach bu yerga keladi</small></div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>№</th><th>Bemor</th><th>Xizmat</th><th>Kutish</th><th>Holat</th><th className="admin-cell-right">Amallar</th></tr>
            </thead>
            <tbody>
              {mine.length === 0 && (
                <tr><td colSpan={6} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>Sizning navbatingizda bemor yo‘q</td></tr>
              )}
              {pg.pageRows.map((q) => (
                <tr key={q.id}>
                  <td className="admin-cell-time">{q.number}</td>
                  <td><strong>{q.patient}</strong></td>
                  <td>{q.service}</td>
                  <td className="admin-cell-muted">{waitLabel(q.addedAt)}</td>
                  <td>{statusChip(q.status)}</td>
                  <td className="admin-cell-right">
                    <div className="queue-actions">
                      <button className="admin-icon-btn sm ok" title="Chaqirish — kabinetga qabul qilish"
                        onClick={() => setQueueStatus(q.id, 'kabinetda')}
                        disabled={q.status === 'kabinetda'}>
                        <UserCheck size={14} />
                      </button>
                      <button
                        className="admin-icon-btn sm warn"
                        title="Bemor kelmadi — navbatini o'tkazib yuborish"
                        onClick={() => {
                          if (confirm(`"${q.patient}" bemori navbati o'tkazilsinmi?`)) {
                            setQueueStatus(q.id, 'tugatildi');
                          }
                        }}
                        disabled={q.status === 'tugatildi'}
                      >
                        <SkipForward size={14} />
                      </button>
                      <button className="admin-icon-btn sm danger" title="O‘chirish" onClick={() => removeFromQueue(q.id)}><X size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>

      {tvOpen && (
        <TvScreen
          title={`SSD KLINIKA — ${user?.fullName ?? ''}`}
          doctorFilter={user?.fullName}
          onClose={() => setTvOpen(false)}
        />
      )}
    </div>
  );
}

const dqCss = `
.dq-call-btn {
  background: linear-gradient(135deg, #10b981, #059669) !important;
  color: #fff !important; border: 0 !important;
  box-shadow: 0 6px 20px -8px rgba(16,185,129,.6);
  display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px;
}
.dq-call-btn:disabled { opacity: .5; filter: grayscale(.3); cursor: not-allowed; box-shadow: none; }
.dq-call-sub { margin-left: 4px; font-size: 11.5px; opacity: .85; font-weight: 600; }

/* TV'da chaqirilayotgan bemor kartasi — yashil yonib-o'chadi */
@keyframes dqPulseGreen {
  0%, 100% {
    background: linear-gradient(135deg, #10b981, #059669);
    box-shadow: 0 0 0 0 rgba(16,185,129,.7), 0 20px 60px -20px rgba(16,185,129,.7);
    transform: scale(1);
  }
  50% {
    background: linear-gradient(135deg, #34d399, #10b981);
    box-shadow: 0 0 0 24px rgba(16,185,129,0), 0 25px 70px -15px rgba(16,185,129,.9);
    transform: scale(1.03);
  }
}
.dq-tv-call {
  animation: dqPulseGreen 1.1s ease-in-out infinite !important;
  color: #fff !important;
}
`;
