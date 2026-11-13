import { useMemo, useState } from 'react';
import {
  Activity, AlertCircle, Archive, ArchiveRestore, Calendar, CheckCircle2, ClipboardList, Edit3, Eye,
  FileHeart, FileText, Fingerprint, FlaskConical, Heart, Home, IdCard, Map as MapIcon,
  Phone, Pill, Plus, Printer, Save, Search, Stethoscope, Trash2, UserCircle2, Users, X,
} from 'lucide-react';
import {
  labTestDate, useLabTests, usePrescriptions, useTreatments,
  type LabTestRecord, type Prescription, type Treatment,
} from '../clinicalData';
import {
  addPatient,
  archivePatient,
  unarchivePatient,
  updatePatient,
  usePatients,
  type Gender,
  type Patient,
} from '../store';
import { UZ_REGIONS } from '../regions';
import { useAuth } from '../../auth/AuthContext';

const ROLES_CAN_ADD_PATIENT = new Set(['admin', 'registrator']);
import { usePagination, TablePagination } from '../components/TablePagination';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function daysAgo(n: number) {
  return startOfToday() - n * 86_400_000;
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1).getTime();
}

function matchDate(ms: number, f: DateFilter) {
  if (f === 'all') return true;
  if (f === 'today') return ms >= startOfToday();
  if (f === 'week') return ms >= daysAgo(7);
  if (f === 'month') return ms >= startOfMonth();
  return ms >= startOfYear();
}

function fmtDate(ms: number | string | null | undefined) {
  const n = typeof ms === 'string' ? Number(ms) : ms;
  if (n == null || !Number.isFinite(n)) return '—';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${mi}`;
}

export function AdminPatients() {
  const patients = usePatients();
  const { user } = useAuth();
  const canAddPatient = ROLES_CAN_ADD_PATIENT.has(user?.role ?? 'admin');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [query, setQuery] = useState('');
  const [onlyMissingJshshir, setOnlyMissingJshshir] = useState(false);
  const [viewing, setViewing] = useState<{ patient: Patient; mode: 'view' | 'edit' } | null>(null);
  const [cardFor, setCardFor] = useState<Patient | null>(null);
  const [adding, setAdding] = useState(false);

  const isJshshirValid = (p: Patient) => {
    const d = (p.jshshir ?? '').replace(/\D/g, '');
    return d.length === 14;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients
      .filter((p) => (tab === 'active' ? !p.archived : p.archived))
      .filter((p) => matchDate(p.addedAt, dateFilter))
      .filter((p) => !onlyMissingJshshir || !isJshshirValid(p))
      .filter((p) =>
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.jshshir ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [patients, tab, dateFilter, query, onlyMissingJshshir]);

  const pg = usePagination(filtered, [tab, dateFilter, query, onlyMissingJshshir, filtered.length]);
  const missingJshshirCount = patients.filter((p) => !p.archived && !isJshshirValid(p)).length;

  const activeCount = patients.filter((p) => !p.archived).length;
  const archivedCount = patients.filter((p) => p.archived).length;
  const todayCount = patients.filter((p) => !p.archived && matchDate(p.addedAt, 'today')).length;
  const monthCount = patients.filter((p) => !p.archived && matchDate(p.addedAt, 'month')).length;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Bemorlar</h1>
          <p>Klinikaga tashrif buyurgan bemorlar bazasi. Navbatdagi bemorlar kabinetga chaqirilgach bu yerga qo‘shiladi.</p>
        </div>
        {canAddPatient && (
          <div className="admin-page-actions">
            <button className="admin-btn admin-btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Yangi bemor
            </button>
          </div>
        )}
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy"><small>Jami bemorlar</small><strong>{patients.length}</strong><span className="admin-stat-trend trend-flat">umumiy</span></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy"><small>Faol</small><strong>{activeCount}</strong><span className="admin-stat-trend trend-up">bazada</span></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy"><small>Bu oyda</small><strong>{monthCount}</strong><span className="admin-stat-trend trend-up">yangi</span></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy"><small>Bugun</small><strong>{todayCount}</strong><span className="admin-stat-trend trend-flat">yangi</span></div>
        </div>
      </div>

      <section className="admin-card patients-toolbar">
        <div className="patients-tabs">
          <button
            className={tab === 'active' ? 'active' : ''}
            onClick={() => setTab('active')}
          >
            Faol ({activeCount})
          </button>
          <button
            className={tab === 'archived' ? 'active' : ''}
            onClick={() => setTab('archived')}
          >
            Arxiv ({archivedCount})
          </button>
        </div>

        <div className="patients-date-filter">
          {([
            ['all', 'Barchasi'],
            ['today', 'Bugun'],
            ['week', 'Hafta'],
            ['month', 'Oy'],
            ['year', 'Yil'],
          ] as Array<[DateFilter, string]>).map(([k, label]) => (
            <button
              key={k}
              className={dateFilter === k ? 'active' : ''}
              onClick={() => setDateFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="patients-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, telefon yoki manzil bo‘yicha qidirish…"
          />
        </div>

        {missingJshshirCount > 0 && (
          <button
            className={`patients-missing-jshshir${onlyMissingJshshir ? ' is-active' : ''}`}
            onClick={() => setOnlyMissingJshshir((v) => !v)}
            title="JSHSHIR kiritilmagan yoki noto'g'ri bemorlarni ko'rsatish"
          >
            <AlertCircle size={13} />
            JSHSHIRsiz bemorlar: <strong>{missingJshshirCount}</strong>
          </button>
        )}
      </section>

      <style>{`
        .patients-missing-jshshir {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 10px;
          background: #fef3c7; color: #92400e;
          border: 1px solid #fde68a; cursor: pointer;
          font-size: 13px; font-weight: 600;
          margin-left: 8px;
          transition: all .15s;
        }
        .patients-missing-jshshir:hover { background: #fde68a; }
        .patients-missing-jshshir.is-active {
          background: #dc2626; color: #fff; border-color: #dc2626;
          box-shadow: 0 4px 10px -2px rgba(220, 38, 38, 0.4);
        }
        .patient-view-chip.is-warn {
          background: #fef3c7; color: #92400e; border: 1px solid #fde68a;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 999px;
          font-size: 12px; font-weight: 600;
        }
        .patient-missing-banner {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin: 14px 20px 0; padding: 12px 14px;
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 1px solid #fcd34d; border-radius: 12px;
          color: #92400e;
        }
        .patient-missing-banner > div { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; }
        .patient-missing-banner strong { display: block; font-size: 13px; }
        .patient-missing-banner small { display: block; font-size: 12px; margin-top: 2px; opacity: 0.9; }
      `}</style>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Natijalar</h2>
            <small>Topilgan: <strong>{filtered.length}</strong> ta bemor</small>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>To‘liq ism</th>
                <th>Telefon raqami</th>
                <th>Manzil</th>
                <th>Qo‘shilgan vaqt</th>
                <th className="admin-cell-right">Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>
                    {tab === 'active'
                      ? 'Hali bemorlar yo‘q — Navbat sahifasida bemor kabinetga chaqirilsa shu yerda paydo bo‘ladi'
                      : 'Arxiv bo‘sh'}
                  </td>
                </tr>
              )}
              {pg.pageRows.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.fullName}</strong></td>
                  <td className="admin-cell-muted">
                    <Phone size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                    {p.phone}
                  </td>
                  <td>{p.address}</td>
                  <td className="admin-cell-time">{fmtDate(p.addedAt)}</td>
                  <td className="admin-cell-right">
                    <div className="patient-actions">
                      <button
                        className="admin-icon-btn sm"
                        aria-label="Profilni koʻrish"
                        title="Profilni koʻrish"
                        onClick={() => setViewing({ patient: p, mode: 'view' })}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="admin-icon-btn sm brand"
                        aria-label="Tibbiy karta"
                        title="Tibbiy karta — koʻrik tarixi"
                        onClick={() => setCardFor(p)}
                      >
                        <FileHeart size={14} />
                      </button>
                      <button
                        className="admin-icon-btn sm ok"
                        aria-label="Tahrirlash"
                        title="Tahrirlash"
                        onClick={() => setViewing({ patient: p, mode: 'edit' })}
                      >
                        <Edit3 size={14} />
                      </button>
                      {p.archived ? (
                        <button
                          className="admin-icon-btn sm"
                          aria-label="Arxivdan chiqarish"
                          title="Arxivdan chiqarish"
                          onClick={() => unarchivePatient(p.id)}
                        >
                          <ArchiveRestore size={14} />
                        </button>
                      ) : (
                        <button
                          className="admin-icon-btn sm missed"
                          aria-label="Arxivga olish"
                          title="Arxivga olish"
                          onClick={() => archivePatient(p.id)}
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>

      {viewing && (
        <PatientProfileModal
          patient={viewing.patient}
          initialMode={viewing.mode}
          onClose={() => setViewing(null)}
          onSave={(patch) => { updatePatient(viewing.patient.id, patch); setViewing(null); }}
        />
      )}
      {adding && (
        <PatientAddModal
          existingJshshirs={patients.map((p) => p.jshshir ?? '').filter(Boolean)}
          onClose={() => setAdding(false)}
          onSave={(p) => { addPatient(p); setAdding(false); }}
        />
      )}
      {cardFor && (
        <MedicalCardModal patient={cardFor} onClose={() => setCardFor(null)} />
      )}
    </div>
  );
}

function PatientAddModal({ onClose, onSave, existingJshshirs }: { onClose: () => void; onSave: (p: { fullName: string; phone: string; address: string; region?: string; district?: string; gender?: Gender; birthDate?: string; jshshir?: string }) => void; existingJshshirs: string[] }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [jshshir, setJshshir] = useState('');
  const [jshshirErr, setJshshirErr] = useState('');

  const districts = UZ_REGIONS.find((r) => r.name === region)?.districts ?? [];

  const normalizeJshshir = (v: string) => v.replace(/\D/g, '').slice(0, 14);

  const [formErr, setFormErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!fullName.trim()) { setFormErr("To'liq ism majburiy."); return; }
    if (!phone.trim() || phone.trim() === '+998') { setFormErr("Telefon raqami majburiy."); return; }
    if (!gender) { setFormErr("Jinsini tanlang."); return; }
    if (!birthDate) { setFormErr("Tug'ilgan sana majburiy."); return; }
    const p = normalizeJshshir(jshshir);
    if (!p || p.length !== 14) {
      setJshshirErr("JSHSHIR to'liq 14 raqamdan iborat bo'lishi kerak.");
      return;
    }
    if (existingJshshirs.includes(p)) {
      setJshshirErr("Bu JSHSHIR bilan bemor allaqachon roʻyxatdan oʻtgan.");
      return;
    }
    onSave({
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      region: region || undefined,
      district: district || undefined,
      gender,
      birthDate,
      jshshir: p,
    });
  };

  const allFilled =
    !!fullName.trim() &&
    phone.trim().length > 4 &&
    !!gender &&
    !!birthDate &&
    normalizeJshshir(jshshir).length === 14;

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><Plus size={18} /> Yangi bemor qo‘shish</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish">
            <X size={16} />
          </button>
        </div>
        <div className="appt-modal-body">
          <label>
            <span>To‘liq ism <span style={{ color: '#dc2626' }}>*</span></span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ism Familiya" autoFocus required />
          </label>
          <div className="appt-modal-row">
            <label>
              <span>Telefon raqami <span style={{ color: '#dc2626' }}>*</span></span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required />
            </label>
            <label>
              <span>Jinsi <span style={{ color: '#dc2626' }}>*</span></span>
              <select value={gender} onChange={(e) => setGender(e.target.value as Gender | '')} required>
                <option value="">Tanlang</option>
                <option value="erkak">Erkak</option>
                <option value="ayol">Ayol</option>
              </select>
            </label>
          </div>
          <label>
            <span>Tugʻilgan sana <span style={{ color: '#dc2626' }}>*</span></span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            <span>JSHSHIR <span style={{ color: '#dc2626' }}>*</span></span>
            <input
              value={jshshir}
              onChange={(e) => { setJshshir(normalizeJshshir(e.target.value)); setJshshirErr(''); }}
              placeholder="12345678901234"
              maxLength={14}
              inputMode="numeric"
              pattern="[0-9]{14}"
              required
              style={{ letterSpacing: '0.6px', fontVariantNumeric: 'tabular-nums' }}
            />
            {jshshirErr && <small style={{ color: '#dc2626' }}>{jshshirErr}</small>}
            {!jshshirErr && <small className="admin-cell-muted">Jismoniy shaxsning shaxsiy identifikatsiya raqami — 14 ta raqam. Majburiy, takrorlanmasligi kerak.</small>}
          </label>
          <div className="appt-modal-row">
            <label>
              <span>Viloyat</span>
              <select value={region} onChange={(e) => { setRegion(e.target.value); setDistrict(''); }}>
                <option value="">Viloyatni tanlang</option>
                {UZ_REGIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </label>
            <label>
              <span>Tuman / Shahar</span>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!region}>
                <option value="">{region ? 'Tumanni tanlang' : 'Avval viloyat'}</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Qo‘shimcha manzil (mahalla, ko‘cha, uy)</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mahalla, ko‘cha, uy raqami..." />
          </label>
        </div>
        {formErr && (
          <div style={{ padding: '0 20px', color: '#dc2626', fontSize: 13, marginBottom: 8 }}>
            {formErr}
          </div>
        )}
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={!allFilled}
            title={!allFilled ? "Barcha majburiy maydonlarni to'ldiring" : undefined}
          >
            <Plus size={15} /> Qo‘shish
          </button>
        </div>
      </form>
    </div>
  );
}

function PatientProfileModal({
  patient, initialMode, onClose, onSave,
}: {
  patient: Patient;
  initialMode: 'view' | 'edit';
  onClose: () => void;
  onSave: (patch: Partial<Patient>) => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [fullName, setFullName] = useState(patient.fullName);
  const [phone, setPhone] = useState(patient.phone);
  const [address, setAddress] = useState(patient.address);
  const [region, setRegion] = useState(patient.region ?? '');
  const [district, setDistrict] = useState(patient.district ?? '');
  const [gender, setGender] = useState<Gender | ''>(patient.gender ?? '');
  const [birthDate, setBirthDate] = useState(patient.birthDate ?? '');
  const [jshshir, setJshshir] = useState(patient.jshshir ?? '');

  const districts = UZ_REGIONS.find((r) => r.name === region)?.districts ?? [];
  const normalizeJshshir = (v: string) => v.replace(/\D/g, '').slice(0, 14);
  const [jshshirErr, setJshshirErr] = useState('');
  const [formErr, setFormErr] = useState('');

  const initials = (fullName || patient.fullName).split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const age = birthDate ? calcAge(birthDate) : null;
  const genderLabel = gender ? (gender === 'erkak' ? 'Erkak' : 'Ayol') : '—';
  const fullAddress = [region, district, address].filter(Boolean).join(', ') || '—';
  const allFilled =
    !!fullName.trim() &&
    phone.trim().length > 4 &&
    !!gender &&
    !!birthDate &&
    normalizeJshshir(jshshir).length === 14;

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormErr('');
    if (!fullName.trim()) { setFormErr("To'liq ism majburiy."); return; }
    if (!phone.trim() || phone.trim() === '+998') { setFormErr("Telefon raqami majburiy."); return; }
    if (!gender) { setFormErr("Jinsini tanlang."); return; }
    if (!birthDate) { setFormErr("Tug'ilgan sana majburiy."); return; }
    const p = normalizeJshshir(jshshir);
    if (!p || p.length !== 14) {
      setJshshirErr("JSHSHIR to'liq 14 raqamdan iborat bo'lishi kerak.");
      return;
    }
    onSave({
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      region: region || undefined,
      district: district || undefined,
      gender,
      birthDate,
      jshshir: p,
    });
  };

  const isEdit = mode === 'edit';

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form
        className="appt-modal patient-view patient-view-pro patient-profile-brand"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="patient-view-hero patient-view-hero-brand" data-mode={mode}>
          <button type="button" className="patient-view-close" onClick={onClose} aria-label="Yopish">
            <X size={18} />
          </button>
          <div className="patient-view-hero-inner">
            <div className="patient-view-avatar-xl">{initials || <UserCircle2 size={44} />}</div>
            <div className="patient-view-hero-text">
              <small>
                {isEdit ? <><Edit3 size={13} /> Bemorni tahrirlash</> : <><Eye size={13} /> Bemor profili</>}
              </small>
              {isEdit ? (
                <input
                  className="patient-view-hero-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Toʻliq ism"
                  required
                />
              ) : (
                <h2>{patient.fullName}</h2>
              )}
              <div className="patient-view-chips">
                <span className={`patient-view-chip ${patient.archived ? 'is-archived' : 'is-active'}`}>
                  <CheckCircle2 size={13} /> {patient.archived ? 'Arxivda' : 'Faol bemor'}
                </span>
                <span className="patient-view-chip neutral">
                  <UserCircle2 size={13} /> {genderLabel}
                </span>
                {age !== null && (
                  <span className="patient-view-chip neutral">
                    <Calendar size={13} /> {age} yosh
                  </span>
                )}
                {jshshir && jshshir.length === 14 ? (
                  <span className="patient-view-chip neutral">
                    <Fingerprint size={13} /> {jshshir}
                  </span>
                ) : (
                  <span className="patient-view-chip is-warn">
                    <AlertCircle size={13} /> JSHSHIR kiritilmagan
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isEdit && (!jshshir || jshshir.length !== 14) && (
          <div className="patient-missing-banner">
            <div>
              <AlertCircle size={16} />
              <div>
                <strong>JSHSHIR kiritilmagan</strong>
                <small>Bu bemor uchun JSHSHIR maydoni toʻldirilishi kerak. Tahrirlash tugmasini bosib 14 raqamli JSHSHIR kiriting.</small>
              </div>
            </div>
            <button type="button" className="admin-btn admin-btn-brand sm" onClick={() => setMode('edit')}>
              <Edit3 size={13} /> JSHSHIR kiritish
            </button>
          </div>
        )}

        <div className="patient-view-body-pro single">
          <div className="patient-view-group">
            <div className="patient-view-grid">
              <Field
                icon={<UserCircle2 size={16} />}
                label="Toʻliq ism"
                editable={isEdit}
                value={fullName}
                onChange={setFullName}
                required
                wide
              />
              <Field
                icon={<UserCircle2 size={16} />}
                label="Jinsi *"
                editable={isEdit}
                value={gender}
                onChange={(v) => setGender(v as Gender | '')}
                display={genderLabel}
                required
                select={[
                  { value: '', label: 'Tanlang' },
                  { value: 'erkak', label: 'Erkak' },
                  { value: 'ayol', label: 'Ayol' },
                ]}
              />
              <Field
                icon={<Calendar size={16} />}
                label="Tugʻilgan sana *"
                editable={isEdit}
                value={birthDate}
                onChange={setBirthDate}
                display={birthDate || '—'}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
                hint={age !== null ? `${age} yosh` : undefined}
              />
              <Field
                icon={<Fingerprint size={16} />}
                label="JSHSHIR *"
                editable={isEdit}
                value={jshshir}
                onChange={(v) => { setJshshir(normalizeJshshir(v)); setJshshirErr(''); }}
                display={jshshir || '—'}
                placeholder="12345678901234"
                mono
                maxLength={14}
                inputMode="numeric"
                required
                hint={jshshirErr || undefined}
                inputStyle={{ letterSpacing: '0.6px', fontVariantNumeric: 'tabular-nums' }}
              />
              <Field
                icon={<Phone size={16} />}
                label="Telefon raqami *"
                editable={isEdit}
                value={phone}
                onChange={setPhone}
                display={phone || '—'}
                placeholder="+998 90 ..."
                required
                href={!isEdit && phone ? `tel:${phone.replace(/\s/g, '')}` : undefined}
              />
              <Field
                icon={<MapIcon size={16} />}
                label="Viloyat"
                editable={isEdit}
                value={region}
                onChange={(v) => { setRegion(v); setDistrict(''); }}
                display={region || '—'}
                select={[{ value: '', label: 'Viloyatni tanlang' }, ...UZ_REGIONS.map((r) => ({ value: r.name, label: r.name }))]}
              />
              <Field
                icon={<MapIcon size={16} />}
                label="Tuman / Shahar"
                editable={isEdit}
                value={district}
                onChange={setDistrict}
                display={district || '—'}
                select={[{ value: '', label: region ? 'Tumanni tanlang' : 'Avval viloyat' }, ...districts.map((d) => ({ value: d, label: d }))]}
                disabled={!region}
              />
              <Field
                icon={<Home size={16} />}
                label="Qoʻshimcha manzil"
                editable={isEdit}
                value={address}
                onChange={setAddress}
                display={address || '—'}
                placeholder="Mahalla, koʻcha, uy..."
                wide
              />
              <InfoCard icon={<Calendar size={16} />} label="Qoʻshilgan vaqt" value={fmtDate(patient.addedAt)} />
              <InfoCard
                icon={<CheckCircle2 size={16} />}
                label="Holat"
                value={patient.archived ? 'Arxivda' : 'Faol'}
                tone={patient.archived ? 'warn' : 'ok'}
              />
            </div>
          </div>
        </div>

        {isEdit && formErr && (
          <div style={{ padding: '0 20px', color: '#dc2626', fontSize: 13, marginBottom: 6 }}>
            {formErr}
          </div>
        )}
        <div className="appt-modal-foot patient-view-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Yopish</button>
          {isEdit ? (
            <>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => {
                  setFullName(patient.fullName); setPhone(patient.phone); setAddress(patient.address);
                  setRegion(patient.region ?? ''); setDistrict(patient.district ?? '');
                  setGender(patient.gender ?? ''); setBirthDate(patient.birthDate ?? '');
                  setJshshir(patient.jshshir ?? ''); setMode('view'); setFormErr('');
                }}
              >Bekor qilish</button>
              <button
                type="submit"
                className="admin-btn admin-btn-brand"
                disabled={!allFilled}
                title={!allFilled ? "Barcha majburiy maydonlarni to'ldiring" : undefined}
              >
                <CheckCircle2 size={15} /> Saqlash
              </button>
            </>
          ) : (
            <button type="button" className="admin-btn admin-btn-brand" onClick={() => setMode('edit')}>
              <Edit3 size={15} /> Tahrirlash
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------- Field helper (view-or-edit) ---------- */
function Field({
  icon, label, editable, value, onChange, display, placeholder, type, max, hint,
  mono, wide, select, href, disabled, required, inputStyle, maxLength, inputMode,
}: {
  icon: React.ReactNode;
  label: string;
  editable: boolean;
  value: string;
  onChange: (v: string) => void;
  display?: string;
  placeholder?: string;
  type?: string;
  max?: string;
  hint?: string;
  mono?: boolean;
  wide?: boolean;
  select?: { value: string; label: string }[];
  href?: string;
  disabled?: boolean;
  required?: boolean;
  inputStyle?: React.CSSProperties;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none';
}) {
  if (!editable) {
    return (
      <InfoCard
        icon={icon}
        label={label}
        value={display ?? value ?? '—'}
        href={href}
        hint={hint}
        mono={mono}
        wide={wide}
      />
    );
  }
  return (
    <label className={`info-card is-edit${wide ? ' wide' : ''}`}>
      <div className="info-card-head">
        <span className="info-card-icon">{icon}</span>
        <span className="info-card-label">{label}</span>
      </div>
      {select ? (
        <select
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {select.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          className={`field-input${mono ? ' mono' : ''}`}
          type={type ?? 'text'}
          value={value}
          placeholder={placeholder}
          max={max}
          maxLength={maxLength}
          inputMode={inputMode}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
      {hint && <div className="info-card-hint">{hint}</div>}
    </label>
  );
}

function calcAge(birthDate: string): number | null {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 0 ? null : age;
}

function InfoCard({
  icon, label, value, href, hint, mono, wide, muted, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  hint?: string;
  mono?: boolean;
  wide?: boolean;
  muted?: boolean;
  tone?: 'ok' | 'warn';
}) {
  const inner = (
    <>
      <div className="info-card-head">
        <span className="info-card-icon">{icon}</span>
        <span className="info-card-label">{label}</span>
      </div>
      <div className={`info-card-value${mono ? ' mono' : ''}${muted ? ' muted' : ''}${tone ? ` tone-${tone}` : ''}`}>
        {value}
      </div>
      {hint && <div className="info-card-hint">{hint}</div>}
    </>
  );
  return href && value !== '—'
    ? <a className={`info-card${wide ? ' wide' : ''} is-link`} href={href}>{inner}</a>
    : <div className={`info-card${wide ? ' wide' : ''}`}>{inner}</div>;
}

/* ====================================================================== */
/*  MEDICAL CARD — Patient visits history                                  */
/* ====================================================================== */

type SectionKey = 'complaints' | 'diagnoses' | 'advice' | 'labResults' | 'treatments' | 'prescriptions';

type SectionDef = { key: SectionKey; label: string; icon: typeof Heart; color: string; source: string };

const SECTION_DEFS: SectionDef[] = [
  { key: 'complaints',    label: 'Shikoyatlar',             icon: Heart,         color: '#dc2626', source: 'Davolash tarixi' },
  { key: 'diagnoses',     label: 'Tashxislar',              icon: Stethoscope,   color: '#2563eb', source: 'Davolash tarixi' },
  { key: 'advice',        label: 'Maslahatlar',             icon: ClipboardList, color: '#059669', source: 'Davolash tarixi' },
  { key: 'labResults',    label: 'Laboratoriya natijalari', icon: FlaskConical,  color: '#9333ea', source: 'Laboratoriya' },
  { key: 'treatments',    label: 'Davolash usullari',       icon: Activity,      color: '#f97316', source: 'Davolash tarixi' },
  { key: 'prescriptions', label: 'Retseptlar',              icon: Pill,          color: '#0ea5e9', source: 'Retseptlar' },
];

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatYmd(ymd: string) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  const months = ['yanv', 'fev', 'mart', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sent', 'okt', 'noy', 'dek'];
  return `${+d} ${months[+m - 1] ?? m} ${y}`;
}

type VisitBundle = {
  date: string;
  doctors: Set<string>;
  treatments: Treatment[];
  prescriptions: Prescription[];
  labTests: LabTestRecord[];
};

function joinUniq(parts: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const s = (p || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join('\n\n');
}

function formatLabResults(labs: LabTestRecord[]) {
  if (labs.length === 0) return '';
  return labs.map((t) => {
    const entries = Object.entries(t.results ?? {}).filter(([, v]) => v && v.trim());
    const head = `• ${t.testType}${t.labDoctor ? ` — ${t.labDoctor}` : ''}`;
    if (entries.length === 0) return head;
    const body = entries.slice(0, 8).map(([k, v]) => `   ${k}: ${v}`).join('\n');
    const more = entries.length > 8 ? `\n   … va yana ${entries.length - 8} koʻrsatkich` : '';
    return `${head}\n${body}${more}`;
  }).join('\n\n');
}

function MedicalCardModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const treatments = useTreatments();
  const prescriptions = usePrescriptions();
  const labTests = useLabTests();

  // Yozuvni ushbu bemor bilan bog'lashni 3 qatlamda tekshiramiz:
  // 1) patientId === patient.id (UUID — eng ishonchli)
  // 2) patientJshshir === patient.jshshir (ikkinchi himoya qatlami)
  // 3) legacy fallback — ism-familya bo'yicha
  const normJshshir = (v?: string | null) => (v ?? '').replace(/\s+/g, '').toUpperCase();
  const myJshshir = normJshshir(patient.jshshir);
  const myNameLower = patient.fullName.toLowerCase();
  const belongs = (rec: { patientId?: string; patientJshshir?: string; patient?: string; patientName?: string }) => {
    if (rec.patientId && rec.patientId === patient.id) return true;
    if (myJshshir && rec.patientJshshir && normJshshir(rec.patientJshshir) === myJshshir) return true;
    const legacy = rec.patient ?? rec.patientName ?? '';
    return legacy.toLowerCase() === myNameLower;
  };

  const bundles = useMemo<VisitBundle[]>(() => {
    const byDate = new Map<string, VisitBundle>();
    const ensure = (date: string) => {
      let b = byDate.get(date);
      if (!b) {
        b = { date, doctors: new Set(), treatments: [], prescriptions: [], labTests: [] };
        byDate.set(date, b);
      }
      return b;
    };
    for (const t of treatments) {
      if (!belongs(t)) continue;
      const b = ensure(t.date);
      b.treatments.push(t);
      if (t.doctor) b.doctors.add(t.doctor);
    }
    for (const p of prescriptions) {
      if (!belongs(p)) continue;
      const b = ensure(p.date);
      b.prescriptions.push(p);
      if (p.doctor) b.doctors.add(p.doctor);
    }
    for (const l of labTests) {
      if (!belongs(l)) continue;
      const b = ensure(labTestDate(l));
      b.labTests.push(l);
      if (l.labDoctor) b.doctors.add(l.labDoctor);
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [patient.id, patient.fullName, patient.jshshir, treatments, prescriptions, labTests]);

  const sectionsFor = (b: VisitBundle): Record<SectionKey, string> => ({
    complaints:    joinUniq(b.treatments.map((t) => t.complaints ?? '')),
    diagnoses:     joinUniq(b.treatments.map((t) => t.diagnosis)),
    advice:        joinUniq(b.treatments.map((t) => t.advice ?? '')),
    treatments:    joinUniq(b.treatments.map((t) => t.methods ?? '')),
    labResults:    formatLabResults(b.labTests),
    prescriptions: joinUniq(b.prescriptions.map((p) => p.meds)),
  });

  const [openDate, setOpenDate] = useState<string | null>(bundles[0]?.date ?? null);

  const initials = patient.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const age = patient.birthDate ? calcAge(patient.birthDate) : null;
  const genderLabel = patient.gender ? (patient.gender === 'erkak' ? 'Erkak' : 'Ayol') : '—';

  const print = () => window.print();

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <div className="appt-modal med-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="patient-view-hero patient-view-hero-brand med-card-hero">
          <button type="button" className="patient-view-close" onClick={onClose} aria-label="Yopish">
            <X size={18} />
          </button>
          <div className="patient-view-hero-inner">
            <div className="patient-view-avatar-xl">{initials || <UserCircle2 size={44} />}</div>
            <div className="patient-view-hero-text">
              <small><FileHeart size={13} /> Elektron tibbiy karta</small>
              <h2>{patient.fullName}</h2>
              <div className="patient-view-chips">
                <span className="patient-view-chip neutral"><UserCircle2 size={13} /> {genderLabel}</span>
                {age !== null && <span className="patient-view-chip neutral"><Calendar size={13} /> {age} yosh</span>}
                {patient.jshshir && <span className="patient-view-chip neutral"><Fingerprint size={13} /> {patient.jshshir}</span>}
                <span className="patient-view-chip is-active"><FileText size={13} /> {bundles.length} ta koʻrik</span>
              </div>
            </div>
          </div>
        </div>

        <div className="med-card-toolbar no-print">
          <div className="med-card-toolbar-left">
            <strong>Koʻrik tarixi</strong>
            <small>Avtomatik yigʻiladi: <b>Davolash tarixi</b>, <b>Laboratoriya</b>, <b>Retseptlar</b> sahifalaridan sana boʻyicha</small>
          </div>
          <div className="med-card-toolbar-right">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={print}>
              <Printer size={14} /> Chop etish
            </button>
          </div>
        </div>

        <div className="med-card-body">
          {bundles.length === 0 && (
            <div className="med-card-empty">
              <FileHeart size={42} />
              <strong>Hali koʻriklar yozilmagan</strong>
              <p>
                Ushbu bemor uchun hech qanday <b>Davolash tarixi</b>, <b>Laboratoriya natijasi</b> yoki
                <b> Retsept</b> topilmadi. Shu bemor nomidan tegishli sahifalarda yozuvlar yarating —
                tibbiy karta avtomatik toʻldiriladi.
              </p>
            </div>
          )}

          <div className="med-card-timeline">
            {bundles.map((b) => {
              const sections = sectionsFor(b);
              const filled = SECTION_DEFS.filter((s) => (sections[s.key] || '').trim());
              const isOpen = openDate === b.date;
              const doctorList = Array.from(b.doctors).join(', ');
              return (
                <article key={b.date} className={`med-visit${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="med-visit-head"
                    onClick={() => setOpenDate(isOpen ? null : b.date)}
                  >
                    <div className="med-visit-date">
                      <Calendar size={16} />
                      <strong>{formatYmd(b.date)}</strong>
                      {doctorList && <small> · {doctorList}</small>}
                    </div>
                    <div className="med-visit-head-tags">
                      {filled.slice(0, 4).map((s) => (
                        <span key={s.key} className="med-visit-tag" style={{ background: `${s.color}1a`, color: s.color }}>
                          <s.icon size={11} /> {s.label}
                        </span>
                      ))}
                      {filled.length > 4 && (
                        <span className="med-visit-tag" style={{ background: '#f1f5f9', color: '#64748b' }}>
                          +{filled.length - 4}
                        </span>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="med-visit-body">
                      {filled.length === 0 && <div className="med-card-empty tight">Shu sanada maʼlumot topilmadi.</div>}
                      {filled.map((s) => (
                        <div key={s.key} className="med-visit-section">
                          <div className="med-visit-section-head" style={{ color: s.color }}>
                            <s.icon size={15} /> <span>{s.label}</span>
                            <span className="med-visit-section-source">{s.source}</span>
                          </div>
                          <div className="med-visit-section-text">{sections[s.key]}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <div className="appt-modal-foot patient-view-foot no-print">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
}
