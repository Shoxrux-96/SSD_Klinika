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
        meds: meds.trim(),
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

  return (
    <div className="rx-backdrop" onClick={onClose}>
      <style>{css}</style>
      <div className="rx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rx-head">
          <div className="rx-head-left">
            <div className="rx-head-ico"><PillIcon size={20} /></div>
            <div>
              <h2>{existing ? 'Retseptni tahrirlash' : 'Yangi retsept'}</h2>
              <p>Bemor uchun dori-darmonlarni tayinlash</p>
            </div>
          </div>
          <button className="rx-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="rx-body">
          <div className="rx-field">
            <label><User size={13} /> Bemor <span className="rx-req">*</span></label>
            <input list="rx-patients" value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="F.I.Sh" />
            <datalist id="rx-patients">
              {patients.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.fullName}>{p.phone ?? ''}</option>
              ))}
            </datalist>
          </div>

          <div className="rx-field">
            <label><Stethoscope size={13} /> Shifokor <span className="rx-req">*</span></label>
            <input list="rx-doctors" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Dr. ..." />
            <datalist id="rx-doctors">
              {doctors.map((d) => <option key={d.id} value={d.fullName}>{d.specialty}</option>)}
            </datalist>
          </div>

          <div className="rx-field">
            <label><PillIcon size={13} /> Dori-darmonlar <span className="rx-req">*</span></label>
            <textarea
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
              placeholder={"Masalan:\n• Paratsetamol 500 mg — 3 marta kuniga, 5 kun\n• Amoksitsillin 250 mg — 2 marta kuniga, 7 kun"}
              rows={5}
            />
          </div>

          <div className="rx-field">
            <label><Calendar size={13} /> Sana</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="rx-foot">
          <button className="rx-btn rx-btn-ghost" onClick={onClose}>Bekor</button>
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
