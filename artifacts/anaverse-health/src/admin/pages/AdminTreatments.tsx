import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit, Eye, Plus, Search } from 'lucide-react';
import { useTreatments, type Treatment } from '../clinicalData';
import { TreatmentWizard } from './TreatmentWizard';
import { Form003View } from './Form003View';

const PAGE_SIZES = [15, 30, 50];

function formatSom(n?: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

export function AdminTreatments() {
  const treatments = useTreatments();
  const [q, setQ] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [pageSize, setPageSize] = useState<number>(15);
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [viewing, setViewing] = useState<Treatment | null>(null);

  const services = useMemo(() => {
    const set = new Set<string>();
    treatments.forEach((t) => { if (t.service) set.add(t.service); });
    return Array.from(set).sort();
  }, [treatments]);

  const doctors = useMemo(() => {
    const set = new Set<string>();
    treatments.forEach((t) => { if (t.doctor) set.add(t.doctor); });
    return Array.from(set).sort();
  }, [treatments]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return treatments.filter((t) => {
      if (needle && !t.patient.toLowerCase().includes(needle)) return false;
      if (serviceFilter !== 'all' && t.service !== serviceFilter) return false;
      if (doctorFilter !== 'all' && t.doctor !== doctorFilter) return false;
      return true;
    });
  }, [treatments, q, serviceFilter, doctorFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [q, serviceFilter, doctorFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const rangeFrom = filtered.length === 0 ? 0 : start + 1;
  const rangeTo = Math.min(start + pageSize, filtered.length);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Davolash tarixi</h1>
          <p>Barcha davolash kartalari, tashxislar va kuzatuvdagi bemorlar.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary" onClick={() => setWizardOpen(true)}><Plus size={15} /> Yangi davolash</button>
        </div>
      </div>

      <section className="admin-card">
        <div className="tr-toolbar">
          <div className="tr-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Bemor nomi bo'yicha izlash..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="tr-filter">
            <label>Xizmat:</label>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
              <option value="all">Barchasi</option>
              {services.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="tr-filter">
            <label>Shifokor:</label>
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
              <option value="all">Barchasi</option>
              {doctors.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="tr-count">
            Topildi: <strong>{filtered.length}</strong>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bemor</th>
                <th>Xizmat nomi</th>
                <th>Shifokor</th>
                <th>Sana</th>
                <th className="admin-cell-right">Jami summa</th>
                <th>Holat</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                    Hech narsa topilmadi.
                  </td>
                </tr>
              ) : pageRows.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.patient}</strong></td>
                  <td>{t.service ?? t.diagnosis}</td>
                  <td className="admin-cell-muted">{t.doctor}</td>
                  <td>{t.date}</td>
                  <td className="admin-cell-right"><strong>{formatSom(t.amount)}</strong></td>
                  <td><span className={`admin-chip chip-${t.status === 'yakunlandi' ? 'ok' : t.status === 'davolanmoqda' ? 'wait' : 'muted'}`}>{t.status}</span></td>
                  <td className="admin-cell-right">
                    <button className="admin-icon-btn sm" aria-label="Ko'rish" title="003 forma ko'rinishida" onClick={() => setViewing(t)}><Eye size={14} /></button>
                    <button
                      className="admin-icon-btn sm"
                      aria-label="Tahrirlash"
                      title={t.status === 'yakunlandi' ? 'Yakunlangan — tahrirlab bo\'lmaydi' : 'Tahrirlash'}
                      disabled={t.status === 'yakunlandi'}
                      onClick={() => setEditing(t)}
                    ><Edit size={14} /></button>
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
              <button
                key={n}
                type="button"
                className={'tr-page-size-btn' + (pageSize === n ? ' is-active' : '')}
                onClick={() => setPageSize(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="tr-page-info">
            {rangeFrom}–{rangeTo} / <strong>{filtered.length}</strong>
          </div>
          <div className="tr-page-nav">
            <button
              type="button"
              className="admin-icon-btn sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Oldingi"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="tr-page-num">{page} / {totalPages}</span>
            <button
              type="button"
              className="admin-icon-btn sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Keyingi"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>
      {wizardOpen && <TreatmentWizard onClose={() => setWizardOpen(false)} />}
      {editing && <TreatmentWizard existing={editing} onClose={() => setEditing(null)} />}
      {viewing && <Form003View treatment={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
