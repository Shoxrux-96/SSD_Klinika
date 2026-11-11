// Tish xaritasi (FDI nomenklaturasi — 32 tish, 4 kvadrant).
// Har bir tishga bosilganda tanlash; o'ng tomondagi panelda holat va muolaja yoziladi.
// Yozuvlar `dental_records` jadvaliga (API) saqlanadi — patientId (UUID) + patientJshshir bilan.

import { useMemo, useState } from 'react';
import { Trash2, Plus, Printer } from 'lucide-react';
import {
  useDentalRecords,
  addDentalRecord,
  removeDentalRecord,
  type DentalRecord,
  type ToothCondition,
} from '../dentalStore';
import type { Patient } from '../store';

// FDI nomenklaturasi — kattalar: 11-18, 21-28, 31-38, 41-48
const QUADRANTS = {
  UR: [18, 17, 16, 15, 14, 13, 12, 11], // Yuqori o'ng
  UL: [21, 22, 23, 24, 25, 26, 27, 28], // Yuqori chap
  LL: [31, 32, 33, 34, 35, 36, 37, 38], // Pastki chap
  LR: [48, 47, 46, 45, 44, 43, 42, 41], // Pastki o'ng
};

const CONDITION_COLOR: Record<string, { bg: string; label: string }> = {
  soglom:  { bg: '#ffffff', label: "Sog'lom" },
  kariyes: { bg: '#fca5a5', label: 'Kariyes' },
  plomba:  { bg: '#a5b4fc', label: 'Plomba' },
  ildiz:   { bg: '#fcd34d', label: 'Ildiz davolangan' },
  tojsiz:  { bg: '#d1d5db', label: "Toj yo'q" },
  olingan: { bg: '#1f2937', label: 'Tish olingan' },
  implant: { bg: '#34d399', label: 'Implant' },
  koronka: { bg: '#fdba74', label: 'Koronka' },
  protez:  { bg: '#c4b5fd', label: 'Protez' },
};

function normalizeJshshir(v?: string) {
  return (v ?? '').replace(/\s+/g, '').toUpperCase() || undefined;
}

export function DentalChart({ patient }: { patient: Patient }) {
  const all = useDentalRecords();
  const [selected, setSelected] = useState<string | null>(null);
  const [condition, setCondition] = useState<ToothCondition>('kariyes');
  const [procedure, setProcedure] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const myJshshir = normalizeJshshir(patient.jshshir);
  const belongs = (r: DentalRecord) => {
    if (r.patientId === patient.id) return true;
    if (myJshshir && normalizeJshshir(r.patientJshshir) === myJshshir) return true;
    return false;
  };

  const records = useMemo(() => all.filter(belongs).sort((a, b) => b.createdAt - a.createdAt),
    [all, patient.id, patient.jshshir]);

  // Tishga qarab eng so'nggi holat
  const toothCurrent = useMemo(() => {
    const m = new Map<string, DentalRecord>();
    for (const r of [...records].reverse()) m.set(r.tooth, r); // oldingi → keyingi tartibi; keyingisi oldingini bosadi
    return m;
  }, [records]);

  const toothHistory = (t: string) => records.filter((r) => r.tooth === t);

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await addDentalRecord({
        patientId: patient.id,
        patientJshshir: myJshshir,
        tooth: selected,
        condition,
        procedure: procedure.trim() || undefined,
        notes: notes.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
      });
      setProcedure(''); setNotes('');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Ushbu yozuvni o'chirishga ishonchingiz komilmi?")) return;
    await removeDentalRecord(id);
  }

  const renderTooth = (num: number) => {
    const key = String(num);
    const cur = toothCurrent.get(key);
    const c = CONDITION_COLOR[cur?.condition ?? 'soglom'] ?? CONDITION_COLOR.soglom;
    const isSel = selected === key;
    return (
      <button
        key={num}
        type="button"
        className={`dc-tooth${isSel ? ' is-sel' : ''}${cur?.condition === 'olingan' ? ' is-missing' : ''}`}
        style={{ background: c.bg, color: cur?.condition === 'olingan' ? '#fff' : '#111' }}
        onClick={() => setSelected(key)}
        title={`Tish ${num}${cur ? ` — ${c.label}` : ''}`}
      >
        <span className="dc-tooth-num">{num}</span>
      </button>
    );
  };

  return (
    <div className="dc">
      <style>{css}</style>

      <div className="dc-head">
        <div>
          <h3>Tish xaritasi (FDI)</h3>
          <p>Har bir tishga bosib holat va bajarilgan ishni qo'shing. O'zgarishlar bemor kartasida qoladi.</p>
        </div>
        <button type="button" className="dc-print" onClick={() => window.print()}>
          <Printer size={14} /> Chop etish
        </button>
      </div>

      {/* Yuqori jag' */}
      <div className="dc-row">
        <div className="dc-quadrant">
          {QUADRANTS.UR.map(renderTooth)}
        </div>
        <div className="dc-quadrant">
          {QUADRANTS.UL.map(renderTooth)}
        </div>
      </div>

      {/* Pastki jag' */}
      <div className="dc-row">
        <div className="dc-quadrant">
          {QUADRANTS.LR.map(renderTooth)}
        </div>
        <div className="dc-quadrant">
          {QUADRANTS.LL.map(renderTooth)}
        </div>
      </div>

      <div className="dc-legend">
        {Object.entries(CONDITION_COLOR).map(([k, v]) => (
          <span key={k} className="dc-legend-item">
            <span className="dc-legend-dot" style={{ background: v.bg }} />{v.label}
          </span>
        ))}
      </div>

      {selected && (
        <div className="dc-editor">
          <strong>Tish № {selected}</strong>

          <div className="dc-form">
            <label>
              Holati
              <select value={condition} onChange={(e) => setCondition(e.target.value as ToothCondition)}>
                {Object.entries(CONDITION_COLOR).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
            <label>
              Muolaja
              <input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Masalan: plomba qo'yildi, Light Cure" />
            </label>
            <label className="dc-wide">
              Izoh
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qo'shimcha izoh (ixtiyoriy)" />
            </label>
            <button type="button" className="dc-btn" onClick={save} disabled={saving}>
              <Plus size={14} /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </div>

          <div className="dc-history">
            <strong>Tarix (tish {selected}):</strong>
            {toothHistory(selected).length === 0 ? (
              <small className="dc-empty">Hali yozuv yo'q.</small>
            ) : (
              <ul>
                {toothHistory(selected).map((r) => (
                  <li key={r.id}>
                    <span className="dc-chip" style={{ background: (CONDITION_COLOR[r.condition]?.bg) ?? '#f1f5f9' }}>
                      {CONDITION_COLOR[r.condition]?.label ?? r.condition}
                    </span>
                    <span className="dc-date">{r.date}</span>
                    {r.procedure && <span className="dc-proc">— {r.procedure}</span>}
                    {r.notes && <small> ({r.notes})</small>}
                    <button type="button" className="dc-del" onClick={() => remove(r.id)} title="O'chirish">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const css = `
.dc { display: flex; flex-direction: column; gap: 14px; padding: 14px; background: #f8fafc; border-radius: 12px; }
.dc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.dc-head h3 { margin: 0; font-size: 15px; color: #0f172a; }
.dc-head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
.dc-print { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12.5px; cursor: pointer; }
.dc-row { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
.dc-quadrant { display: flex; gap: 4px; }
.dc-tooth { position: relative; width: 36px; height: 48px; border: 1px solid #cbd5e1; border-radius: 6px 6px 10px 10px; background: #fff; cursor: pointer; font-size: 10px; display: grid; place-items: center; transition: transform 0.1s, border-color 0.1s; }
.dc-tooth:hover { border-color: #6366f1; transform: translateY(-2px); }
.dc-tooth.is-sel { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3); }
.dc-tooth.is-missing { border-style: dashed; }
.dc-tooth-num { font-weight: 700; font-size: 11px; }
.dc-legend { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; padding: 8px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
.dc-legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: #475569; }
.dc-legend-dot { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #cbd5e1; }
.dc-editor { background: #fff; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; }
.dc-editor > strong { color: #4f46e5; font-size: 14px; }
.dc-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-top: 10px; align-items: end; }
.dc-form label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: #475569; font-weight: 500; }
.dc-form select, .dc-form input { padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 13px; background: #f8fafc; }
.dc-wide { grid-column: 1 / -1; }
.dc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: #4f46e5; color: #fff; border: 0; border-radius: 8px; font-size: 13px; cursor: pointer; height: 34px; }
.dc-btn:hover { background: #4338ca; }
.dc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dc-history { margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.dc-history strong { font-size: 12px; color: #334155; }
.dc-history ul { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 6px; }
.dc-history li { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; padding: 6px 8px; background: #f8fafc; border-radius: 6px; }
.dc-chip { padding: 2px 8px; border-radius: 10px; font-size: 11px; color: #0f172a; font-weight: 600; }
.dc-date { color: #64748b; font-size: 11.5px; }
.dc-proc { color: #0f172a; }
.dc-del { background: transparent; border: 0; color: #dc2626; cursor: pointer; margin-left: auto; padding: 4px; }
.dc-del:hover { color: #991b1b; }
.dc-empty { color: #94a3b8; font-style: italic; }
@media (max-width: 720px) {
  .dc-form { grid-template-columns: 1fr; }
  .dc-tooth { width: 30px; height: 40px; }
}
`;
