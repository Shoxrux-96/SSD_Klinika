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
  const [meds, setMeds] = useState(existing?.meds ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [busy, setBusy] = useState(false);

  // Retsept maxsus maydonlari (hujjat shakliga mos)
  const selectedP = patients.find((p) => p.fullName === patient);
  const birth = selectedP?.birthDate ?? '';
  const addr = selectedP?.address ?? '';
  const selectedD = doctors.find((d) => d.fullName === doctor);
  const spec = selectedD?.specialty ?? '';
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');

  const canSave = patient.trim() && doctor.trim() && meds.trim();

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const name = patient.trim();
      const selected = patients.find((p) => p.fullName === name);
      const passport = (selected?.passport ?? '').replace(/\s+/g, '').toUpperCase() || existing?.patientPassport;
      const common = {
        patient: name,
        patientId: selected?.id ?? existing?.patientId,
        patientPassport: passport,
        doctor: doctor.trim(),
        meds: meds.trim() + (diagnosis ? `\n\nTashxis: ${diagnosis}` : '') + (notes ? `\n\nIzoh: ${notes}` : ''),
        date,
      };
      let row: Prescription | null;
      if (existing) {
        row = await updatePrescription(existing.id, common);
      } else {
        row = await addPrescription(common);
      }
      if (row && onSaved) onSaved(row);
      else onClose();
    } finally { setBusy(false); }
  }

  // PDF chop etish — Chek (80mm × dinamik) yoki A5 (148×210mm)
  function printDoc(kind: 'receipt' | 'a5') {
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const medsLines = meds.split('\n').filter((l) => l.trim());
    const rxNo = existing?.id ? existing.id.slice(-6).toUpperCase() : 'RX-' + Date.now().toString(36).toUpperCase().slice(-6);

    const pageCss = kind === 'receipt'
      ? `@page { size: 80mm auto; margin: 3mm; } body { width: 74mm; font-size: 9.5pt; }`
      : `@page { size: A5; margin: 10mm 12mm; } body { font-size: 11pt; }`;

    const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"/>
<title>Retsept #${esc(rxNo)}</title>
<style>
  ${pageCss}
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'DM Sans', Arial, sans-serif; color: #0f172a; margin: 0; line-height: 1.4; }
  .hdr { text-align: center; padding-bottom: 6pt; border-bottom: 1.5pt solid #0f172a; margin-bottom: 8pt; }
  .hdr h1 { margin: 0; font-size: ${kind === 'receipt' ? '12pt' : '15pt'}; letter-spacing: 0.3pt; font-weight: 800; }
  .hdr .sub { font-size: ${kind === 'receipt' ? '7.5pt' : '9pt'}; color: #475569; margin-top: 2pt; }
  .rx-rpno {
    display: inline-block; background: #4f46e5; color: #fff;
    padding: 2pt 8pt; border-radius: 3pt; font-size: ${kind === 'receipt' ? '8pt' : '9pt'};
    font-weight: 700; margin-top: 4pt; letter-spacing: 0.5pt;
  }
  .sec { margin: ${kind === 'receipt' ? '6pt' : '8pt'} 0; }
  .sec-title { font-size: ${kind === 'receipt' ? '8pt' : '9pt'}; font-weight: 700;
    color: #64748b; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 3pt; border-bottom: 0.3pt dashed #cbd5e1; padding-bottom: 2pt; }
  .kv { display: grid; grid-template-columns: 1fr; gap: 2pt; }
  .kv .row { display: flex; gap: 6pt; font-size: ${kind === 'receipt' ? '9pt' : '10.5pt'}; }
  .kv .k { color: #64748b; min-width: ${kind === 'receipt' ? '22mm' : '28mm'}; font-weight: 600; }
  .kv .v { color: #0f172a; font-weight: 500; flex: 1; }
  .rp-wrap {
    border: 1pt solid #0f172a; border-radius: 3pt;
    padding: ${kind === 'receipt' ? '6pt' : '10pt'};
    margin: 4pt 0 6pt;
    background: #fafafa;
  }
  .rp-mark {
    font-size: ${kind === 'receipt' ? '20pt' : '26pt'}; font-weight: 900;
    font-style: italic; line-height: 1; color: #4f46e5;
    float: left; margin-right: 6pt; margin-bottom: 2pt;
  }
  .rp-title { font-size: ${kind === 'receipt' ? '9.5pt' : '11pt'}; font-weight: 700; margin-bottom: 4pt; }
  .meds-list { list-style: none; padding: 0; margin: 0; counter-reset: medc; }
  .meds-list li {
    counter-increment: medc;
    padding: 3pt 0 3pt 14pt;
    position: relative;
    font-size: ${kind === 'receipt' ? '9.5pt' : '11pt'};
    border-bottom: 0.3pt dashed #e2e8f0;
  }
  .meds-list li:last-child { border-bottom: 0; }
  .meds-list li::before {
    content: counter(medc) ".";
    position: absolute; left: 0; top: 3pt;
    font-weight: 700; color: #4f46e5;
  }
  .sign {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8pt;
    margin-top: ${kind === 'receipt' ? '8pt' : '14pt'};
    font-size: ${kind === 'receipt' ? '8.5pt' : '10pt'};
  }
  .sign .box { border-top: 0.5pt solid #0f172a; padding-top: 3pt; }
  .sign .box .lbl { color: #64748b; font-size: ${kind === 'receipt' ? '7.5pt' : '8.5pt'}; }
  .sign .box .nm { font-weight: 700; margin-top: 2pt; }
  .ftr {
    margin-top: ${kind === 'receipt' ? '10pt' : '16pt'};
    text-align: center;
    font-size: ${kind === 'receipt' ? '7pt' : '8pt'};
    color: #94a3b8;
    border-top: 0.3pt dashed #cbd5e1;
    padding-top: 4pt;
  }
</style></head><body>
  <div class="hdr">
    <h1>SSD KLINIKA</h1>
    <div class="sub">Sirius Stoma Dent Diagnostika markazi</div>
    <div class="sub">ssdclinic.uz · Shavat, Jaloliddin Mangʻuberdi 8-uy</div>
    <div class="rx-rpno">RETSEPT № ${esc(rxNo)}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Bemor</div>
    <div class="kv">
      <div class="row"><span class="k">F.I.Sh.</span><span class="v">${esc(patient) || '____________________'}</span></div>
      ${birth ? `<div class="row"><span class="k">Tug'ilgan sana</span><span class="v">${esc(birth)}</span></div>` : ''}
      ${addr ? `<div class="row"><span class="k">Manzil</span><span class="v">${esc(addr)}</span></div>` : ''}
      ${selectedP?.phone ? `<div class="row"><span class="k">Telefon</span><span class="v">${esc(selectedP.phone)}</span></div>` : ''}
      <div class="row"><span class="k">Sana</span><span class="v">${esc(date)}</span></div>
    </div>
  </div>

  ${diagnosis ? `<div class="sec">
    <div class="sec-title">Tashxis</div>
    <div style="font-size: ${kind === 'receipt' ? '9.5pt' : '11pt'}; font-weight: 500;">${esc(diagnosis)}</div>
  </div>` : ''}

  <div class="rp-wrap">
    <div class="rp-mark">Rp.</div>
    <div class="rp-title">Tayinlangan dori-darmonlar:</div>
    <ol class="meds-list">
      ${medsLines.map((line) => `<li>${esc(line.replace(/^[•·\-\d.\s]+/, ''))}</li>`).join('')}
    </ol>
  </div>

  ${notes ? `<div class="sec">
    <div class="sec-title">Qo'shimcha ko'rsatma</div>
    <div style="font-size: ${kind === 'receipt' ? '9pt' : '10.5pt'};">${esc(notes).replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  <div class="sign">
    <div class="box">
      <div class="lbl">Tayinlagan shifokor</div>
      <div class="nm">${esc(doctor) || '________'}</div>
      ${spec ? `<div class="lbl" style="margin-top:1pt">${esc(spec)}</div>` : ''}
    </div>
    <div class="box">
      <div class="lbl">Imzo / muhr</div>
      <div style="height: ${kind === 'receipt' ? '18pt' : '28pt'}"></div>
    </div>
  </div>

  <div class="ftr">
    SSD Klinika · ssdclinic.uz · Retsept № ${esc(rxNo)} · ${esc(date)}
    <br>Dorilarni shifokor ko'rsatmasi bo'yicha qabul qiling.
  </div>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));</script>
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
        <div className="rx-head">
          <div className="rx-head-left">
            <div className="rx-head-ico"><PillIcon size={20} /></div>
            <div>
              <h2>{existing ? 'Retseptni tahrirlash' : 'Yangi retsept — hujjat shakli'}</h2>
              <p>Har maydon chop etilgan retseptning tegishli katagiga tushadi</p>
            </div>
          </div>
          <button className="rx-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="rx-body rx-doc">
          {/* Hujjat shakli — real retseptga o'xshash */}
          <div className="rx-doc-sheet">
            <div className="rx-doc-hdr">
              <div className="rx-doc-brand">
                <strong>SSD KLINIKA</strong>
                <small>Sirius Stoma Dent Diagnostika markazi</small>
                <small>ssdclinic.uz</small>
              </div>
              <div className="rx-doc-rxno">RETSEPT</div>
            </div>

            <div className="rx-doc-row">
              <div className="rx-doc-cell rx-doc-cell-full">
                <label>Bemor F.I.Sh. <span className="rx-req">*</span></label>
                <input list="rx-patients" value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="Ism Familiya Otasi ismi" />
                <datalist id="rx-patients">
                  {patients.filter((p) => !p.archived).map((p) => (
                    <option key={p.id} value={p.fullName}>{p.phone ?? ''}</option>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="rx-doc-row">
              <div className="rx-doc-cell">
                <label><Calendar size={11} /> Sana</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="rx-doc-cell">
                <label>Tug'ilgan sana</label>
                <input type="text" value={birth || '—'} readOnly placeholder="Bemor tanlanganda ko'rsatiladi" />
              </div>
            </div>

            <div className="rx-doc-row">
              <div className="rx-doc-cell rx-doc-cell-full">
                <label>Tashxis</label>
                <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Masalan: J02.0 Streptokokk faringiti" />
              </div>
            </div>

            <div className="rx-doc-rp">
              <div className="rx-doc-rp-mark">Rp.</div>
              <div className="rx-doc-cell rx-doc-cell-full" style={{ flex: 1 }}>
                <label>Dori-darmonlar (har qator — bitta dori) <span className="rx-req">*</span></label>
                <textarea
                  value={meds}
                  onChange={(e) => setMeds(e.target.value)}
                  placeholder={"Paratsetamol 500 mg — 3 marta kuniga, 5 kun\nAmoksitsillin 250 mg — 2 marta kuniga, 7 kun\nKetonal 100 mg — 2 marta kuniga, 3 kun"}
                  rows={5}
                />
                <small className="rx-hint">Ro'yxat chop etilganda avtomatik 1, 2, 3... deb raqamlanadi</small>
              </div>
            </div>

            <div className="rx-doc-row">
              <div className="rx-doc-cell rx-doc-cell-full">
                <label>Qo'shimcha ko'rsatma (ixtiyoriy)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ovqatdan keyin iste'mol qiling..." />
              </div>
            </div>

            <div className="rx-doc-row">
              <div className="rx-doc-cell">
                <label><Stethoscope size={11} /> Shifokor <span className="rx-req">*</span></label>
                <input list="rx-doctors" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Dr. ..." />
                <datalist id="rx-doctors">
                  {doctors.map((d) => <option key={d.id} value={d.fullName}>{d.specialty}</option>)}
                </datalist>
              </div>
              <div className="rx-doc-cell">
                <label>Mutaxassislik</label>
                <input type="text" value={spec || '—'} readOnly />
              </div>
            </div>
          </div>
        </div>

        <div className="rx-foot">
          <button className="rx-btn rx-btn-ghost" onClick={onClose}>Bekor</button>
          <div style={{ flex: 1 }} />
          {canSave && (
            <>
              <button className="rx-btn rx-btn-ghost" onClick={() => printDoc('receipt')} title="Chek qog'ozi (80mm) ga chop etish">
                🧾 Chek
              </button>
              <button className="rx-btn rx-btn-ghost" onClick={() => printDoc('a5')} title="A5 qog'oz (148×210mm)">
                📄 A5 PDF
              </button>
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
`;
