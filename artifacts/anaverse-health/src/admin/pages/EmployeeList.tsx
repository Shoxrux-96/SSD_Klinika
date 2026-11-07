import { useMemo, useState } from 'react';
import { usePagination, TablePagination } from '../components/TablePagination';
import {
  Archive,
  ArchiveRestore,
  Award,
  Briefcase,
  Edit3,
  Eye,
  GraduationCap,
  LayoutGrid,
  Mail,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Table as TableIcon,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  addEmployee,
  archiveEmployee,
  unarchiveEmployee,
  updateEmployee,
  useEmployees,
  type Employee,
  type EmployeeCategory,
} from '../store';

type Props = {
  category: EmployeeCategory;
  title: string;
  subtitle: string;
  positions: string[];
};

function fmtDate(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export function EmployeeList({ category, title, subtitle, positions }: Props) {
  const all = useEmployees();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [position, setPosition] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'card' | 'table'>('card');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((e) => e.category === category)
      .filter((e) => (tab === 'active' ? !e.archived : e.archived))
      .filter((e) => position === 'all' || e.position === position)
      .filter((e) =>
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.specialty.toLowerCase().includes(q),
      )
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [all, category, tab, position, query]);

  const pg = usePagination(list, [category, tab, position, query, list.length]);

  const total = all.filter((e) => e.category === category);
  const active = total.filter((e) => !e.archived).length;
  const archived = total.length - active;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Yangi {category === 'medical' ? 'hodim' : 'ishchi'}
          </button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy"><small>Jami</small><strong>{total.length}</strong><span className="admin-stat-trend trend-flat">umumiy</span></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Users size={18} /></div>
          <div className="admin-stat-copy"><small>Faol</small><strong>{active}</strong><span className="admin-stat-trend trend-up">bazada</span></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Archive size={18} /></div>
          <div className="admin-stat-copy"><small>Arxivda</small><strong>{archived}</strong><span className="admin-stat-trend trend-flat">arxiv</span></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Briefcase size={18} /></div>
          <div className="admin-stat-copy"><small>Lavozimlar</small><strong>{positions.length}</strong><span className="admin-stat-trend trend-flat">turi</span></div>
        </div>
      </div>

      <section className="admin-card patients-toolbar">
        <div className="patients-tabs">
          <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Faol ({active})</button>
          <button className={tab === 'archived' ? 'active' : ''} onClick={() => setTab('archived')}>Arxiv ({archived})</button>
        </div>
        <div className="appt-doctor-filter">
          <label>Lavozim:</label>
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="all">Barchasi</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="patients-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, telefon, email, mutaxassislik…"
          />
        </div>
        <div className="appt-view-switch">
          <button className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}>
            <LayoutGrid size={14} /> Karta
          </button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            <TableIcon size={14} /> Jadval
          </button>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Natijalar</h2><small>Topilgan: <strong>{list.length}</strong> ta</small></div>
        </div>

        {list.length === 0 ? (
          <div className="emp-empty">
            {tab === 'active' ? `Hali hodimlar yo‘q — «Yangi» tugmasi orqali qo‘shing` : 'Arxiv bo‘sh'}
          </div>
        ) : view === 'card' ? (
          <div className="emp-grid">
            {pg.pageRows.map((e) => (
              <div key={e.id} className="emp-card photo-card">
                <div className="emp-photo-3x4">
                  {e.photo ? (
                    <img src={e.photo} alt={e.fullName} />
                  ) : category === 'medical' ? (
                    <img src="/assets/doctor-default.jpg" alt={e.fullName} />
                  ) : (
                    <div className="emp-photo-placeholder">{initials(e.fullName)}</div>
                  )}
                  <span className="emp-photo-position">{e.position}</span>
                </div>
                <div className="emp-card-body">
                  <div className="emp-card-top">
                    <strong className="emp-card-name">{e.fullName}</strong>
                    <div className="emp-card-foot">
                      <button className="admin-icon-btn sm" title="Ko‘rish" onClick={() => setViewing(e)}><Eye size={14} /></button>
                      <button className="admin-icon-btn sm ok" title="Tahrirlash" onClick={() => setEditing(e)}><Edit3 size={14} /></button>
                      {e.archived ? (
                        <button className="admin-icon-btn sm" title="Arxivdan chiqarish" onClick={() => unarchiveEmployee(e.id)}><ArchiveRestore size={14} /></button>
                      ) : (
                        <button className="admin-icon-btn sm missed" title="Arxivga olish" onClick={() => archiveEmployee(e.id)}><Archive size={14} /></button>
                      )}
                    </div>
                  </div>
                  <div className="emp-card-meta">
                    <div><Stethoscope size={13} /> {e.specialty}</div>
                    <div><Award size={13} /> {e.experience}</div>
                    <div><Phone size={13} /> {e.phone}</div>
                    <div><Mail size={13} /> {e.email}</div>
                    <div><GraduationCap size={13} /> {e.diploma}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table emp-table">
              <thead>
                <tr>
                  <th>Rasm</th>
                  <th>To‘liq ism</th>
                  <th>Lavozim</th>
                  <th>Mutaxassislik</th>
                  <th>Tajriba</th>
                  <th>Telefon</th>
                  <th>Email</th>
                  <th>Diplom</th>
                  <th className="admin-cell-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageRows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="emp-table-photo">
                        {e.photo ? (
                          <img src={e.photo} alt={e.fullName} />
                        ) : category === 'medical' ? (
                          <img src="/assets/doctor-default.jpg" alt={e.fullName} />
                        ) : (
                          <span>{initials(e.fullName)}</span>
                        )}
                      </div>
                    </td>
                    <td><strong>{e.fullName}</strong></td>
                    <td><span className="admin-chip chip-ok">{e.position}</span></td>
                    <td className="admin-cell-muted">{e.specialty}</td>
                    <td>{e.experience}</td>
                    <td className="admin-cell-muted">{e.phone}</td>
                    <td className="admin-cell-muted">{e.email}</td>
                    <td className="admin-cell-muted">{e.diploma}</td>
                    <td className="admin-cell-right">
                      <button className="admin-icon-btn sm" title="Ko‘rish" onClick={() => setViewing(e)}><Eye size={14} /></button>
                      <button className="admin-icon-btn sm ok" title="Tahrirlash" onClick={() => setEditing(e)}><Edit3 size={14} /></button>
                      {e.archived ? (
                        <button className="admin-icon-btn sm" title="Arxivdan chiqarish" onClick={() => unarchiveEmployee(e.id)}><ArchiveRestore size={14} /></button>
                      ) : (
                        <button className="admin-icon-btn sm missed" title="Arxivga olish" onClick={() => archiveEmployee(e.id)}><Archive size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 0 && <TablePagination {...pg} />}
      </section>

      {adding && (
        <EmployeeModal
          mode="add"
          category={category}
          positions={positions}
          onClose={() => setAdding(false)}
          onSave={(data) => { addEmployee({ ...data, category }); setAdding(false); }}
        />
      )}
      {editing && (
        <EmployeeModal
          mode="edit"
          category={category}
          positions={positions}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => { updateEmployee(editing.id, data); setEditing(null); }}
        />
      )}
      {viewing && (
        <EmployeeViewModal
          emp={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
        />
      )}
    </div>
  );
}

/* -------- View modal -------- */

function EmployeeViewModal({ emp, onClose, onEdit }: { emp: Employee; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <div className="appt-modal emp-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="appt-modal-head">
          <h3><Eye size={18} /> Hodim ma’lumotlari</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>
        <div className="appt-modal-body">
          <div className="emp-view-top">
            {emp.photo ? (
              <img src={emp.photo} alt={emp.fullName} className="emp-view-avatar img" />
            ) : (
              <div className="emp-view-avatar">{initials(emp.fullName)}</div>
            )}
            <div>
              <h4>{emp.fullName}</h4>
              <p>{emp.position} · {emp.specialty}</p>
            </div>
          </div>
          <div className="patient-view-field"><span>Telefon</span><strong>{emp.phone}</strong></div>
          <div className="patient-view-field"><span>Email</span><strong>{emp.email}</strong></div>
          <div className="patient-view-field"><span>Lavozim</span><strong>{emp.position}</strong></div>
          <div className="patient-view-field"><span>Mutaxassislik</span><strong>{emp.specialty}</strong></div>
          <div className="patient-view-field"><span>Tajriba</span><strong>{emp.experience}</strong></div>
          <div className="patient-view-field"><span>Diplom</span><strong>{emp.diploma}</strong></div>
          <div className="patient-view-field"><span>Qo‘shilgan</span><strong>{fmtDate(emp.addedAt)}</strong></div>
          <div className="patient-view-field"><span>Holat</span><strong>{emp.archived ? 'Arxivda' : 'Faol'}</strong></div>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Yopish</button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={onEdit}>
            <Edit3 size={15} /> Tahrirlash
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------- Add / Edit modal -------- */

function EmployeeModal({
  mode,
  category,
  positions,
  initial,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit';
  category: EmployeeCategory;
  positions: string[];
  initial?: Employee;
  onClose: () => void;
  onSave: (data: Omit<Employee, 'id' | 'addedAt' | 'archived' | 'category'>) => void;
}) {
  const [photo, setPhoto] = useState<string>(initial?.photo ?? '');
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '+998 ');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [position, setPosition] = useState(initial?.position ?? positions[0]);
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [experience, setExperience] = useState(initial?.experience ?? '');
  const [diploma, setDiploma] = useState(initial?.diploma ?? '');

  const onPhotoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    onSave({
      photo: photo || undefined,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      position,
      specialty: specialty.trim(),
      experience: experience.trim(),
      diploma: diploma.trim(),
    });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal emp-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3>
            {mode === 'add' ? <Plus size={18} /> : <Edit3 size={18} />}
            {mode === 'add' ? `Yangi ${category === 'medical' ? 'hodim' : 'ishchi'} qo‘shish` : 'Tahrirlash'}
          </h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>
        <div className="appt-modal-body emp-form-body">
          <div className="emp-form-photo">
            {photo ? (
              <img src={photo} alt="" className="emp-view-avatar img" />
            ) : (
              <div className="emp-view-avatar">{fullName ? initials(fullName) : '?'}</div>
            )}
            <label className="emp-upload-btn">
              <Upload size={14} /> {photo ? 'Rasmni almashtirish' : 'Rasm yuklash'}
              <input type="file" accept="image/*" onChange={(e) => onPhotoFile(e.target.files?.[0] ?? null)} hidden />
            </label>
            {photo && (
              <button type="button" className="emp-upload-btn ghost" onClick={() => setPhoto('')}>
                <X size={13} /> O‘chirish
              </button>
            )}
          </div>

          <label>
            <span>To‘liq ism</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ism Familiya" required autoFocus />
          </label>

          <div className="appt-modal-row">
            <label>
              <span>Telefon raqami</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 ..." />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@ssdklinika.uz" />
            </label>
          </div>

          <div className="appt-modal-row">
            <label>
              <span>Lavozim</span>
              <select value={position} onChange={(e) => setPosition(e.target.value)}>
                {positions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>
              <span>Mutaxassislik</span>
              <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Masalan: Ortodont" />
            </label>
          </div>

          <div className="appt-modal-row">
            <label>
              <span>Tajriba</span>
              <input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="5 yil" />
            </label>
            <label>
              <span>Diplom</span>
              <input value={diploma} onChange={(e) => setDiploma(e.target.value)} placeholder="TTA, 2018 — stomatologiya" />
            </label>
          </div>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary">
            {mode === 'add' ? <><Plus size={15} /> Qo‘shish</> : 'Saqlash'}
          </button>
        </div>
      </form>
    </div>
  );
}
