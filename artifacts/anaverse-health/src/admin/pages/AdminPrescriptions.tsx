import { useMemo, useState } from 'react';
import { Printer, Edit, Plus, Save, X, User, Stethoscope, Pill as PillIcon, Calendar, Trash2 } from 'lucide-react';
import {
  usePrescriptions, addPrescription, updatePrescription, removePrescription,
  type Prescription,
} from '../clinicalData';
import { usePatients, useEmployees } from '../store';
import { RetseptView } from './RetseptView';
import { usePagination, TablePagination } from '../components/TablePagination';
import { useAuth } from '../../auth/AuthContext';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AdminPrescriptions() {
  const prescriptions = usePrescriptions();
  const patients = usePatients();
  const employees = useEmployees();
  const { user } = useAuth();

  const [viewing, setViewing] = useState<Prescription | null>(null);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [creating, setCreating] = useState(false);
  const pg = usePagination(prescriptions, [prescriptions.length]);

  const doctors = useMemo(
    () => employees.filter((e) => e.category === 'medical' && !e.archived),
    [employees],
  );

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Retseptlar</h1>
          <p>Shifokorlar tomonidan tayinlangan dori-darmonlar.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Yangi retsept
          </button>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Bemor</th>
                <th>Shifokor</th>
                <th>Dori-darmonlar</th>
                <th>Sana</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Retseptlar yo‘q — "Yangi retsept" bosib qo‘shing</td></tr>
              ) : pg.pageRows.map((p) => (
                <tr key={p.id}>
                  <td className="admin-cell-time">{p.id.slice(0, 8)}</td>
                  <td><strong>{p.patient}</strong></td>
                  <td className="admin-cell-muted">{p.doctor}</td>
                  <td style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{p.meds}</td>
                  <td>{p.date}</td>
                  <td className="admin-cell-right">
                    <button className="admin-icon-btn sm" aria-label="Chop etish" title="Chop etish" onClick={() => setViewing(p)}><Printer size={14} /></button>
                    <button className="admin-icon-btn sm" aria-label="Tahrirlash" title="Tahrirlash" onClick={() => setEditing(p)}><Edit size={14} /></button>
                    <button className="admin-icon-btn sm danger" aria-label="O'chirish" title="O'chirish"
                      onClick={() => { if (confirm("Retsept o'chirilsinmi?")) removePrescription(p.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>

      {viewing && <RetseptView prescription={viewing} onClose={() => setViewing(null)} />}
      {(creating || editing) && (
        <PrescriptionModal
          existing={editing ?? undefined}
          patients={patients}
          doctors={doctors}
          defaultDoctor={user?.role === 'shifokor' ? user.fullName : ''}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(p) => { setCreating(false); setEditing(null); setViewing(p); }}
        />
      )}
    </div>
  );
}

/* ================================================================
   RETSEPT MODAL — hujjat ko'rinishi (10 qatorli jadval)
   ================================================================ */

type MedRow = { name: string; dose: string; usage: string };

function PrescriptionModal({
  existing, patients, doctors, defaultDoctor, onClose, onSaved,
}: {
  existing?: Prescription;
  patients: ReturnType<typeof usePatients>;
  doctors: ReturnType<typeof useEmployees>;
  defaultDoctor: string;
  onClose: () => void;
  onSaved?: (p: Prescription) => void;
}) {
  const [patient, setPatient] = useState(existing?.patient ?? '');
  const [doctor, setDoctor] = useState(existing?.doctor ?? defaultDoctor ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [busy, setBusy] = useState(false);

  // Mavjud retseptdagi dori ro'yxatini 10 ta qatorli jadvalga parslash.
  // Format: "dori nomi | miqdori | qo'llanilishi" (vertical bar bilan ajratilgan).
  const initRows = (): MedRow[] => {
    const rows: MedRow[] = Array.from({ length: 10 }, () => ({ name: '', dose: '', usage: '' }));
    if (existing?.meds) {
      existing.meds.split('\n').slice(0, 10).forEach((line, i) => {
        const parts = line.split('|').map((s) => s.trim());
        rows[i] = {
          name: parts[0] ?? line.trim(),
          dose: parts[1] ?? '',
          usage: parts[2] ?? '',
        };
      });
    }
    return rows;
  };
  const [rows, setRows] = useState<MedRow[]>(initRows);
  const updateRow = (i: number, field: keyof MedRow, val: string) =>
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const canSave = patient.trim() && doctor.trim() && rows.some((r) => r.name.trim());

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const name = patient.trim();
      const selected = patients.find((p) => p.fullName === name);
      const jshshir = (selected?.jshshir ?? '').replace(/\s+/g, '').toUpperCase() || existing?.patientJshshir;
      // Dori ro'yxatini bitta satrga yig'ish: "nom | miqdor | qo'llanilishi"
      const medsStr = rows
        .filter((r) => r.name.trim())
        .map((r) => [r.name.trim(), r.dose.trim(), r.usage.trim()].join(' | '))
        .join('\n');
      const common = {
        patient: name,
        patientId: selected?.id ?? existing?.patientId,
        patientJshshir: jshshir,
        doctor: doctor.trim(),
        meds: medsStr,
        date,
      };
      let row: Prescription | null;
      if (existing) row = await updatePrescription(existing.id, common);
      else row = await addPrescription(common);
      if (row && onSaved) onSaved(row);
      else onClose();
    } finally { setBusy(false); }
  }

  // PDF chop etish — rasmdagi hujjat shakliga aniq mos keluvchi A5 yoki A4
  function printDoc(kind: 'a5' | 'a4' | 'receipt') {
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const filled = rows.map((r) => ({ ...r }));

    const pageCss = kind === 'receipt'
      ? `@page { size: 80mm auto; margin: 3mm; } body { width: 74mm; font-size: 8.5pt; }`
      : kind === 'a4'
        ? `@page { size: A4; margin: 15mm; } body { font-size: 11pt; }`
        : `@page { size: A5; margin: 10mm; } body { font-size: 10pt; }`;

    const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"/>
<title>Retsept — ${esc(patient)}</title>
<style>
  ${pageCss}
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'DM Sans', Arial, sans-serif; color: #0f172a; margin: 0; line-height: 1.35; }
  .title { text-align: center; font-weight: 800; font-size: ${kind === 'receipt' ? '11pt' : '15pt'}; margin-bottom: 2mm; }
  .title .red { color: #dc2626; }
  .title .green { color: #15803d; }
  .subtitle { text-align: center; font-weight: 700; font-size: ${kind === 'receipt' ? '9pt' : '11pt'}; margin-bottom: 4mm; letter-spacing: 0.3pt; }
  .meta { display: flex; justify-content: space-between; gap: 4mm; font-size: ${kind === 'receipt' ? '8pt' : '10pt'}; margin-bottom: 3mm; flex-wrap: wrap; }
  .meta span b { font-weight: 700; }
  table.rx { width: 100%; border-collapse: collapse; font-size: ${kind === 'receipt' ? '8pt' : '10pt'}; }
  table.rx th, table.rx td { border: 0.5pt solid #0f172a; padding: ${kind === 'receipt' ? '1.5mm' : '2mm'}; vertical-align: middle; }
  table.rx th { background: #f1f5f9; font-weight: 700; text-align: center; }
  table.rx td.n { text-align: center; width: ${kind === 'receipt' ? '8mm' : '12mm'}; font-weight: 600; }
  table.rx td.name { width: 44%; }
  table.rx td.dose, table.rx td.usage { width: 28%; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: ${kind === 'receipt' ? '6mm' : '12mm'}; font-size: ${kind === 'receipt' ? '8pt' : '10pt'}; }
  .sign .left { display: flex; gap: 4mm; align-items: baseline; }
  .sign .line { display: inline-block; min-width: ${kind === 'receipt' ? '20mm' : '40mm'}; border-bottom: 0.5pt solid #0f172a; height: ${kind === 'receipt' ? '4mm' : '6mm'}; }
  .sign .right { font-weight: 700; }
</style></head><body>
  <div class="title"><span class="red">SSD</span> <span class="green">DIAGNOSTIKA MARKAZI</span></div>
  <div class="subtitle">DORILAR RETSEPTI</div>
  <div class="meta">
    <span><b>Bemor:</b> ${esc(patient)}</span>
    <span><b>Shifokor:</b> ${esc(doctor)}</span>
    <span><b>Sana:</b> ${esc(date)}</span>
  </div>
  <table class="rx">
    <thead>
      <tr>
        <th style="width:${kind === 'receipt' ? '8mm' : '12mm'}">#</th>
        <th>Dori nomi</th>
        <th>Miqdori</th>
        <th>Qo'llanilishi</th>
      </tr>
    </thead>
    <tbody>
      ${filled.map((r, i) => `
        <tr>
          <td class="n">${i + 1}</td>
          <td class="name">${esc(r.name)}</td>
          <td class="dose">${esc(r.dose)}</td>
          <td class="usage">${esc(r.usage)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="sign">
    <div class="left"><span>Shifokor imzosi:</span><span class="line"></span></div>
    <div class="right">${esc(doctor)}</div>
  </div>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));</script>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const d = iframe.contentDocument;
    if (!d) return;
    d.open(); d.write(html); d.close();
    const cleanup = () => setTimeout(() => iframe.remove(), 600);
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 20000);
  }

  return (
    <div className="rx-backdrop" onClick={onClose}>
      <style>{css}</style>
      <div className="rx-modal rx-modal-doc" onClick={(e) => e.stopPropagation()}>
        {/* Modal head */}
        <div className="rx-head">
          <div className="rx-head-left">
            <div className="rx-head-ico"><PillIcon size={20} /></div>
            <div>
              <h2>{existing ? 'Retseptni tahrirlash' : 'Yangi retsept'}</h2>
              <p>Hujjat shakli — har dori alohida qatorga yoziladi</p>
            </div>
          </div>
          <button className="rx-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Modal body — rasm bo'yicha hujjat shakli */}
        <div className="rx-sheet-scroll">
          <div className="rx-sheet">
            <div className="rx-sheet-title"><span className="red">SSD</span> <span className="green">DIAGNOSTIKA MARKAZI</span></div>
            <div className="rx-sheet-sub">DORILAR RETSEPTI</div>

            {/* Meta qator: Bemor, Shifokor, Sana */}
            <div className="rx-sheet-meta">
              <div className="rx-meta-item">
                <label>Bemor:</label>
                <input list="rx-patients" value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="F.I.Sh" />
                <datalist id="rx-patients">
                  {patients.filter((p) => !p.archived).map((p) => (
                    <option key={p.id} value={p.fullName}>{p.phone ?? ''}</option>
                  ))}
                </datalist>
              </div>
              <div className="rx-meta-item">
                <label>Shifokor:</label>
                <input list="rx-doctors" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Shifokor nomi" />
                <datalist id="rx-doctors">
                  {doctors.map((d) => <option key={d.id} value={d.fullName}>{d.specialty}</option>)}
                </datalist>
              </div>
              <div className="rx-meta-item rx-meta-item-sm">
                <label>Sana:</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            {/* Dori-darmonlar jadval — 10 qator */}
            <table className="rx-sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Dori nomi</th>
                  <th style={{ width: 140 }}>Miqdori</th>
                  <th style={{ width: 180 }}>Qo'llanilishi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="rx-row-n">{i + 1}</td>
                    <td><input value={r.name} onChange={(e) => updateRow(i, 'name', e.target.value)} placeholder="" /></td>
                    <td><input value={r.dose} onChange={(e) => updateRow(i, 'dose', e.target.value)} placeholder="" /></td>
                    <td><input value={r.usage} onChange={(e) => updateRow(i, 'usage', e.target.value)} placeholder="" /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Imzo qator */}
            <div className="rx-sheet-sign">
              <div className="rx-sign-left">
                <span>Shifokor imzosi:</span>
                <span className="rx-sign-line" />
              </div>
              <div className="rx-sign-right">{doctor || <em style={{ color: '#94a3b8' }}>Shifokor</em>}</div>
            </div>
          </div>
        </div>

        {/* Foot — tugmalar */}
        <div className="rx-foot">
          <button className="rx-btn rx-btn-ghost" onClick={onClose}>Bekor</button>
          <div style={{ flex: 1 }} />
          {canSave && (
            <>
              <button className="rx-btn rx-btn-ghost" onClick={() => printDoc('receipt')} title="Chek qog'ozi (80mm)">🧾 Chek</button>
              <button className="rx-btn rx-btn-ghost" onClick={() => printDoc('a5')} title="A5 qog'oz">📄 A5 PDF</button>
              <button className="rx-btn rx-btn-ghost" onClick={() => printDoc('a4')} title="A4 qog'oz">📄 A4 PDF</button>
            </>
          )}
          <button className="rx-btn rx-btn-primary" disabled={!canSave || busy} onClick={save}>
            <Save size={15} /> {busy ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

const css = `
.rx-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15,23,42,.55); backdrop-filter: blur(4px);
  display: grid; place-items: center; padding: 20px;
  animation: rxFadeIn .18s ease-out;
}
@keyframes rxFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes rxSlideUp { from { transform: translateY(14px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }

.rx-modal {
  width: 100%; max-width: 560px; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 16px;
  box-shadow: 0 30px 80px -20px rgba(0,0,0,.25);
  overflow: hidden; animation: rxSlideUp .22s cubic-bezier(.2,.8,.2,1);
}
.rx-modal-doc { max-width: 680px; }

/* Hujjat ko'rinishdagi retsept forma */
.rx-doc { padding: 0; background: #f8fafc; }
.rx-doc-sheet {
  background: #fff;
  margin: 16px;
  padding: 24px 28px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
  background-image:
    linear-gradient(to right, transparent 40px, rgba(168, 85, 247, 0.03) 40px, rgba(168, 85, 247, 0.03) 42px, transparent 42px);
}
.rx-doc-hdr {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 14px; border-bottom: 2px solid #0f172a; margin-bottom: 14px;
}
.rx-doc-brand strong {
  display: block; font-size: 16px; font-weight: 800; letter-spacing: 0.3px; color: #0f172a;
}
.rx-doc-brand small { display: block; font-size: 11px; color: #64748b; margin-top: 2px; }
.rx-doc-rxno {
  background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff;
  padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 700;
  letter-spacing: 1px;
}

.rx-doc-row { display: flex; gap: 10px; margin-bottom: 10px; }
.rx-doc-cell {
  flex: 1 1 0; display: flex; flex-direction: column; gap: 3px;
  padding: 8px 10px;
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
  transition: border-color 0.15s;
}
.rx-doc-cell:focus-within { border-color: #a855f7; border-style: solid; }
.rx-doc-cell-full { flex-basis: 100%; }
.rx-doc-cell label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; color: #64748b; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.3px;
}
.rx-doc-cell input, .rx-doc-cell textarea {
  width: 100%; border: 0; outline: none; background: transparent;
  color: #0f172a; font-size: 14px; font-family: inherit; padding: 2px 0;
}
.rx-doc-cell textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
.rx-doc-cell input::placeholder, .rx-doc-cell textarea::placeholder { color: #cbd5e1; }
.rx-doc-cell input[readonly] { color: #64748b; font-style: italic; }
.rx-hint { font-size: 10px; color: #94a3b8; margin-top: 2px; }

.rx-doc-rp {
  display: flex; gap: 10px; align-items: flex-start;
  margin: 12px 0;
  padding: 10px;
  border: 2px solid #0f172a;
  border-radius: 6px;
  background: linear-gradient(to bottom, rgba(168, 85, 247, 0.02), transparent);
}
.rx-doc-rp-mark {
  font-size: 32px; font-weight: 900; font-style: italic;
  color: #4f46e5; line-height: 1; padding-top: 2px;
}

.rx-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 20px; background: #f8fafc; border-top: 1px solid #eef2f7; flex-wrap: wrap; }
.rx-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; gap: 14px;
  border-bottom: 1px solid #eef2f7;
  background: linear-gradient(180deg, #faf5ff, #ffffff); }
.rx-head-left { display: flex; gap: 14px; align-items: center; }
.rx-head-ico { width: 44px; height: 44px; border-radius: 12px;
  background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff;
  display: grid; place-items: center;
  box-shadow: 0 6px 22px -4px rgba(168,85,247,.5); }
.rx-head h2 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.rx-head p { margin: 2px 0 0; color: #64748b; font-size: 12.5px; }
.rx-close { width: 34px; height: 34px; border-radius: 10px; border: 0;
  background: #f1f5f9; color: #64748b; cursor: pointer;
  display: grid; place-items: center; transition: all .15s; }
.rx-close:hover { background: #fee2e2; color: #dc2626; }

.rx-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }

.rx-field { display: flex; flex-direction: column; gap: 6px; }
.rx-field > label { display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: #475569; }
.rx-field > label svg { color: #a855f7; }
.rx-req { color: #dc2626; }

.rx-field input, .rx-field textarea {
  width: 100%; background: #fff; border: 1px solid #e2e8f0; color: #0f172a;
  padding: 10px 12px; border-radius: 10px; font-size: 14px; outline: none;
  font-family: inherit;
  transition: border-color .15s, box-shadow .15s;
}
.rx-field textarea { resize: vertical; min-height: 110px; line-height: 1.5; }
.rx-field input:focus, .rx-field textarea:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }

.rx-foot { display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px; background: #f8fafc; border-top: 1px solid #eef2f7; }
.rx-btn { display: inline-flex; align-items: center; gap: 7px;
  padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: 0; transition: all .15s; }
.rx-btn-ghost { background: #fff; color: #475569; border: 1px solid #e2e8f0; }
.rx-btn-ghost:hover { background: #f1f5f9; }
.rx-btn-primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff;
  box-shadow: 0 8px 22px -8px rgba(168,85,247,.6); }
.rx-btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.rx-btn-primary:disabled { opacity: .45; cursor: not-allowed; }

/* ====== Retsept hujjati — rasm bo'yicha ====== */
.rx-modal-doc { max-width: 720px; }
.rx-sheet-scroll {
  background: #f1f5f9;
  padding: 20px;
  max-height: 72vh;
  overflow-y: auto;
}
.rx-sheet {
  background: #fff;
  padding: 24px 28px;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(15,23,42,.08);
  font-family: 'DM Sans', Arial, sans-serif;
  color: #0f172a;
}
.rx-sheet-title {
  text-align: center;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}
.rx-sheet-title .red { color: #dc2626; }
.rx-sheet-title .green { color: #15803d; }
.rx-sheet-sub {
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.5px;
  color: #0f172a;
  margin-bottom: 16px;
}
.rx-sheet-meta {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.rx-meta-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1 1 30%;
  min-width: 160px;
}
.rx-meta-item-sm { flex: 0 1 180px; }
.rx-meta-item label {
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
  white-space: nowrap;
}
.rx-meta-item input {
  flex: 1;
  border: 0;
  border-bottom: 1px dashed #94a3b8;
  outline: none;
  padding: 2px 4px;
  font-size: 13px;
  background: transparent;
  font-family: inherit;
  color: #0f172a;
}
.rx-meta-item input:focus { border-bottom-color: #4f46e5; border-bottom-style: solid; }

.rx-sheet-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 4px;
  font-size: 13px;
}
.rx-sheet-table th, .rx-sheet-table td {
  border: 1px solid #0f172a;
  padding: 0;
  vertical-align: middle;
}
.rx-sheet-table th {
  background: #f1f5f9;
  padding: 7px 8px;
  font-weight: 700;
  text-align: center;
  font-size: 12.5px;
}
.rx-sheet-table .rx-row-n {
  text-align: center;
  font-weight: 700;
  padding: 6px 4px;
  color: #334155;
}
.rx-sheet-table td input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  padding: 7px 10px;
  font-size: 13px;
  font-family: inherit;
  color: #0f172a;
  min-height: 32px;
}
.rx-sheet-table td input:focus {
  background: #eff6ff;
  box-shadow: inset 0 0 0 1.5px #4f46e5;
}

.rx-sheet-sign {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 20px;
  padding-top: 8px;
  gap: 16px;
  flex-wrap: wrap;
}
.rx-sign-left {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
  color: #0f172a;
}
.rx-sign-line {
  display: inline-block;
  min-width: 100px;
  border-bottom: 1px solid #0f172a;
  height: 14px;
}
.rx-sign-right {
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
}

@media (max-width: 640px) {
  .rx-sheet { padding: 16px 14px; }
  .rx-sheet-title { font-size: 16px; }
  .rx-sheet-sub { font-size: 12px; }
  .rx-meta-item { flex: 1 1 100%; }
  .rx-sheet-table { font-size: 11px; }
  .rx-sheet-table td input { padding: 6px 7px; font-size: 11.5px; min-height: 28px; }
}
`;
