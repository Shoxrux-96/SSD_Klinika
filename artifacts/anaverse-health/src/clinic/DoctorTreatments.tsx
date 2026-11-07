import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit, Eye, Plus, Search, UserCheck, AlertCircle } from 'lucide-react';
import { useTreatments, type Treatment, type TreatmentStatus } from '../admin/clinicalData';
import { TreatmentWizard } from '../admin/pages/TreatmentWizard';
import { Form003View } from '../admin/pages/Form003View';
import { useQueue, removeFromQueue, setQueueStatus } from '../admin/store';
import { useAuth } from '../auth/AuthContext';

const PAGE_SIZES = [15, 30, 50];

function formatSom(n?: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

export function DoctorTreatments() {
  const { user } = useAuth();
  const allTreatments = useTreatments();
  const queue = useQueue();

  const treatments = useMemo(
    () => allTreatments.filter((t) => t.doctor === user?.fullName),
    [allTreatments, user],
  );
  const myQueue = useMemo(
    () => queue.filter((q) => q.doctor === user?.fullName && q.status !== 'tugatildi'),
    [queue, user],
  );
  // Qabulga avval "kabinetda" bo'lganlar, keyin "navbatda" turganlar
  const nextInQueue = useMemo(() => {
    const inRoom = myQueue.find((q) => q.status === 'kabinetda');
    if (inRoom) return inRoom;
    return myQueue.find((q) => q.status === 'navbatda');
  }, [myQueue]);

  const [q, setQ] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [pageSize, setPageSize] = useState<number>(15);
  const [page, setPage] = useState(1);
  const [autoPatient, setAutoPatient] = useState<string | undefined>();
  const [autoQueueId, setAutoQueueId] = useState<string | undefined>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [viewing, setViewing] = useState<Treatment | null>(null);

  const services = useMemo(() => {
    const set = new Set<string>();
    treatments.forEach((t) => { if (t.service) set.add(t.service); });
    return Array.from(set).sort();
  }, [treatments]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return treatments.filter((t) => {
      if (needle && !t.patient.toLowerCase().includes(needle)) return false;
      if (serviceFilter !== 'all' && t.service !== serviceFilter) return false;
      return true;
    });
  }, [treatments, q, serviceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [q, serviceFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const rangeFrom = filtered.length === 0 ? 0 : start + 1;
  const rangeTo = Math.min(start + pageSize, filtered.length);

  function openNew() {
    if (nextInQueue) {
      // Navbatdagi keyingi bemorni avtomatik qabul qilamiz
      setAutoPatient(nextInQueue.patient);
      setAutoQueueId(nextInQueue.id);
      if (nextInQueue.status === 'navbatda') {
        setQueueStatus(nextInQueue.id, 'kabinetda');
      }
    } else {
      setAutoPatient(undefined);
      setAutoQueueId(undefined);
    }
    setWizardOpen(true);
  }

  function handleWizardClose() {
    setWizardOpen(false);
    setAutoPatient(undefined);
    setAutoQueueId(undefined);
  }

  function handleSaved({ status }: { patient: string; doctor: string; status: TreatmentStatus }) {
    if (!autoQueueId) return;
    // Faqat yakunlangan bo'lsa navbatdan o'chiramiz.
    // "davolanmoqda" — bemor hali kabinetda, navbat holati o'zgarmaydi.
    // "rejalashtirildi" — navbatga qaytariladi.
    if (status === 'yakunlandi') {
      removeFromQueue(autoQueueId);
    } else if (status === 'rejalashtirildi') {
      setQueueStatus(autoQueueId, 'navbatda');
    }
  }

  return (
    <div className="admin-page">
      <style>{`
        .dt-queue-banner {
          display: flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, #dbeafe, #ede9fe);
          border: 1px solid #c7d2fe;
          padding: 12px 16px; border-radius: 12px; margin-bottom: 16px;
        }
        .dt-queue-banner .dt-qb-ico { width: 38px; height: 38px; border-radius: 10px; background: #4f46e5; color: #fff; display: grid; place-items: center; }
        .dt-queue-banner strong { color: #1e293b; }
        .dt-queue-banner small { color: #475569; }
        .dt-queue-banner.is-empty { background: #f8fafc; border-color: #e2e8f0; }
        .dt-queue-banner.is-empty .dt-qb-ico { background: #94a3b8; }
      `}</style>

      <div className="admin-page-head">
        <div>
          <h1>Davolash tarixi</h1>
          <p>Faqat siz davolagan bemorlar ro‘yxati.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary" onClick={openNew}>
            <Plus size={15} /> Yangi davolash
            {nextInQueue && <span style={{ marginLeft: 6, fontSize: 11, opacity: .8 }}>· {nextInQueue.patient}</span>}
          </button>
        </div>
      </div>

      {nextInQueue ? (
        <div className="dt-queue-banner">
          <div className="dt-qb-ico"><UserCheck size={18} /></div>
          <div style={{ flex: 1 }}>
            <strong>Navbatdagi keyingi bemor: {nextInQueue.patient}</strong>
            <br />
            <small>
              № {nextInQueue.number} · {nextInQueue.service} · holat: {nextInQueue.status}
              {' — "Yangi davolash" tugmasi bosilsa avtomatik qabul qilinadi'}
            </small>
          </div>
        </div>
      ) : (
        <div className="dt-queue-banner is-empty">
          <div className="dt-qb-ico"><AlertCircle size={18} /></div>
          <div><strong>Navbatda bemor yo‘q</strong><br/><small>Yangi davolash yozishingiz mumkin, bemorni qo‘lda tanlaysiz</small></div>
        </div>
      )}

      <section className="admin-card">
        <div className="tr-toolbar">
          <div className="tr-search">
            <Search size={14} />
            <input type="text" placeholder="Bemor nomi bo'yicha izlash..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="tr-filter">
            <label>Xizmat:</label>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
              <option value="all">Barchasi</option>
              {services.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="tr-count">Topildi: <strong>{filtered.length}</strong></div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bemor</th><th>Xizmat</th><th>Sana</th>
                <th className="admin-cell-right">Summa</th><th>Holat</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Siz davolagan bemor yo‘q</td></tr>
              ) : pageRows.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.patient}</strong></td>
                  <td>{t.service ?? t.diagnosis}</td>
                  <td>{t.date}</td>
                  <td className="admin-cell-right"><strong>{formatSom(t.amount)}</strong></td>
                  <td><span className={`admin-chip chip-${t.status === 'yakunlandi' ? 'ok' : t.status === 'davolanmoqda' ? 'wait' : 'muted'}`}>{t.status}</span></td>
                  <td className="admin-cell-right">
                    <button className="admin-icon-btn sm" title="003 forma" onClick={() => setViewing(t)}><Eye size={14} /></button>
                    <button className="admin-icon-btn sm" title={t.status === 'yakunlandi' ? 'Yakunlangan' : 'Tahrirlash'}
                      disabled={t.status === 'yakunlandi'} onClick={() => setEditing(t)}><Edit size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tr-pagination">
          <div className="tr-page-size">
            <label>Qatorlar:</label>
            {PAGE_SIZES.map((n) => (
              <button key={n} type="button"
                className={'tr-page-size-btn' + (pageSize === n ? ' is-active' : '')}
                onClick={() => setPageSize(n)}>{n}</button>
            ))}
          </div>
          <div className="tr-page-info">{rangeFrom}–{rangeTo} / <strong>{filtered.length}</strong></div>
          <div className="tr-page-nav">
            <button type="button" className="admin-icon-btn sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={14} /></button>
            <span className="tr-page-num">{page} / {totalPages}</span>
            <button type="button" className="admin-icon-btn sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      {wizardOpen && (
        <TreatmentWizard
          onClose={handleWizardClose}
          initialPatient={autoPatient}
          initialDoctor={user?.fullName}
          onSaved={handleSaved}
        />
      )}
      {editing && <TreatmentWizard existing={editing} onClose={() => setEditing(null)} />}
      {viewing && <Form003View treatment={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
