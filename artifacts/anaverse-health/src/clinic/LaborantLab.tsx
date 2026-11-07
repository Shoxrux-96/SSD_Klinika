import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Search, CheckCircle2, Eye, Edit, Play, Printer } from 'lucide-react';
import { useTreatments, updateTreatment, type Treatment } from '../admin/clinicalData';
import { useDebts } from '../admin/debtsStore';
import { usePagination, TablePagination } from '../admin/components/TablePagination';
import { Form003View } from '../admin/pages/Form003View';
import { TreatmentWizard } from '../admin/pages/TreatmentWizard';
import { useAuth } from '../auth/AuthContext';

type PayStatus = 'paid' | 'debt' | 'unpaid';

const isLabService = (name?: string) => !!name && /lab|tahlil|analiz|anali[zs]/i.test(name);

function fmtSom(n?: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

export function LaborantLab() {
  const { user } = useAuth();
  const treatments = useTreatments();
  const debts = useDebts();
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [viewing, setViewing] = useState<Treatment | null>(null);

  // Fetch paid treatment IDs from /api/transactions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/transactions');
        if (!res.ok) return;
        const rows = await res.json();
        if (cancelled) return;
        const ids = new Set<string>();
        for (const r of rows) {
          if (r.type !== 'income') continue;
          // description may contain treatmentId
          try {
            const d = JSON.parse(r.description ?? '{}');
            if (d.treatmentId) ids.add(d.treatmentId);
          } catch {}
          // also match by patientId + serviceId if linked
          if (r.patientId && r.serviceId) ids.add(`${r.patientId}|${r.serviceId}`);
        }
        setPaidIds(ids);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const debtIds = useMemo(() => new Set(debts.map((d) => d.treatmentId)), [debts]);

  const labTreatments = useMemo(() => {
    return treatments.filter((t) => {
      if (!isLabService(t.service)) return false;
      const isPaid = paidIds.has(t.id) || paidIds.has(`${t.patient}|${t.service}`);
      const isDebt = debtIds.has(t.id);
      return isPaid || isDebt;
    });
  }, [treatments, paidIds, debtIds]);

  const payStatus = (t: Treatment): PayStatus => {
    if (paidIds.has(t.id) || paidIds.has(`${t.patient}|${t.service}`)) return 'paid';
    if (debtIds.has(t.id)) return 'debt';
    return 'unpaid';
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return labTreatments;
    return labTreatments.filter((t) => {
      const hay = `${t.patient} ${t.service} ${t.doctor}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [labTreatments, q]);

  const pg = usePagination(filtered, [filtered.length]);

  async function startProcessing(t: Treatment) {
    await updateTreatment(t.id, { status: 'davolanmoqda', methods: `${t.methods ?? ''}\nLaborant: ${user?.fullName} — ish boshlandi ${new Date().toLocaleString('uz-UZ')}`.trim() });
  }
  async function markDone(t: Treatment) {
    if (!confirm(`"${t.service}" — tahlil tayyormi?`)) return;
    await updateTreatment(t.id, { status: 'yakunlandi', methods: `${t.methods ?? ''}\nLaborant: ${user?.fullName} — tahlil yakunlandi ${new Date().toLocaleString('uz-UZ')}`.trim() });
  }

  return (
    <div className="admin-page">
      <style>{css}</style>
      <div className="admin-page-head">
        <div>
          <h1>Laboratoriya</h1>
          <p>Shifokorlar yo'naltirgan tahlillar — kassaga to'langan yoki qarzga yozilganlar</p>
        </div>
      </div>

      <section className="admin-card">
        {labTreatments.length > 0 && (
          <div className="lb-toolbar">
            <div className="lb-search">
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bemor, xizmat yoki shifokor bo'yicha izlash..." />
            </div>
          </div>
        )}

        {labTreatments.length === 0 ? (
          <div className="lb-empty">
            <div className="lb-empty-ico"><FlaskConical size={34} /></div>
            <h3>Hozircha yo'naltirilgan tahlil yo'q</h3>
            <p>Shifokor laboratoriya xizmatiga yo'naltirib kassaga to'lov qabul qilingandan keyin bu yerda ko'rinadi.</p>
          </div>
        ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Bemor</th>
                <th>Tahlil / Xizmat</th>
                <th>Yo'naltirgan shifokor</th>
                <th>To'lov</th>
                <th>Holat</th>
                <th className="admin-cell-right">Summa</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageRows.map((t) => {
                const ps = payStatus(t);
                return (
                  <tr key={t.id}>
                    <td className="admin-cell-time">{t.date}</td>
                    <td><strong>{t.patient}</strong></td>
                    <td>{t.service}</td>
                    <td className="admin-cell-muted">{t.doctor}</td>
                    <td>
                      {ps === 'paid' && <span className="admin-chip chip-ok">To'landi</span>}
                      {ps === 'debt' && <span className="admin-chip chip-wait">Qarzda</span>}
                    </td>
                    <td>
                      <span className={`admin-chip chip-${t.status === 'yakunlandi' ? 'ok' : t.status === 'davolanmoqda' ? 'wait' : 'muted'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="admin-cell-right"><strong>{fmtSom(t.amount)}</strong></td>
                    <td className="admin-cell-right">
                      <button className="admin-icon-btn sm" title="Ko'rish (003)" onClick={() => setViewing(t)}><Eye size={14} /></button>
                      <button className="admin-icon-btn sm" title="Tahrirlash" onClick={() => setEditing(t)}><Edit size={14} /></button>
                      {t.status === 'rejalashtirildi' && (
                        <button className="admin-icon-btn sm ok" title="Ishni boshlash" onClick={() => startProcessing(t)}><Play size={14} /></button>
                      )}
                      {t.status === 'davolanmoqda' && (
                        <button className="admin-icon-btn sm ok" title="Tayyor" onClick={() => markDone(t)}><CheckCircle2 size={14} /></button>
                      )}
                      <button className="admin-icon-btn sm" title="Chop etish" onClick={() => window.print()}><Printer size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
        )}
      </section>

      {viewing && <Form003View treatment={viewing} onClose={() => setViewing(null)} />}
      {editing && <TreatmentWizard existing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const css = `
.lb-toolbar { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid #eef2f7; flex-wrap: wrap; }
.lb-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; }
.lb-search input { flex: 1; border: 0; background: transparent; outline: none; font-size: 13px; color: #0f172a; }
.lb-search svg { color: #94a3b8; }

.lb-empty { padding: 60px 24px; text-align: center; color: #64748b; }
.lb-empty-ico { width: 72px; height: 72px; border-radius: 20px; margin: 0 auto 16px;
  background: linear-gradient(135deg, #eef2ff, #f3e8ff); color: #6366f1;
  display: grid; place-items: center; }
.lb-empty h3 { color: #0f172a; font-size: 17px; font-weight: 700; margin: 0 0 6px; }
.lb-empty p { font-size: 13.5px; color: #64748b; max-width: 440px; margin: 0 auto; line-height: 1.5; }
`;
