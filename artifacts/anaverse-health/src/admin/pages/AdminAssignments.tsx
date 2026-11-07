import { useMemo, useState } from 'react';
import { Check, Link2, Search, UserCog, Users } from 'lucide-react';
import {
  setEmployeeAssignments,
  toggleAssignment,
  useAssignments,
  useEmployees,
  useServiceCategories,
  useServices,
} from '../store';

export function AdminAssignments() {
  const employees = useEmployees();
  const services = useServices();
  const categories = useServiceCategories();
  const assignments = useAssignments();

  const activeEmployees = employees.filter((e) => !e.archived && e.category === 'medical');
  const activeServices = services.filter((s) => !s.archived);

  const [selectedId, setSelectedId] = useState<string>(activeEmployees[0]?.id ?? '');
  const [empQuery, setEmpQuery] = useState('');
  const [svcQuery, setSvcQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    return activeEmployees
      .filter((e) =>
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.specialty.toLowerCase().includes(q),
      );
  }, [activeEmployees, empQuery]);

  const selected = activeEmployees.find((e) => e.id === selectedId) ?? filteredEmployees[0];
  const selectedAssignmentSet = new Set(assignments.filter((a) => a.employeeId === selected?.id).map((a) => a.serviceId));

  const assignedCount = (empId: string) => assignments.filter((a) => a.employeeId === empId).length;

  const filteredServices = useMemo(() => {
    const q = svcQuery.trim().toLowerCase();
    return activeServices
      .filter((s) => catFilter === 'all' || s.categoryId === catFilter)
      .filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [activeServices, catFilter, svcQuery]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const categoryColor = (id: string) => categories.find((c) => c.id === id)?.color ?? '#999';

  const selectAllInView = () => {
    if (!selected) return;
    const ids = filteredServices.map((s) => s.id);
    const current = new Set(selectedAssignmentSet);
    ids.forEach((id) => current.add(id));
    setEmployeeAssignments(selected.id, Array.from(current));
  };

  const clearAllInView = () => {
    if (!selected) return;
    const removeIds = new Set(filteredServices.map((s) => s.id));
    const next = Array.from(selectedAssignmentSet).filter((id) => !removeIds.has(id));
    setEmployeeAssignments(selected.id, next);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Xizmat biriktirish</h1>
          <p>Har bir shifokorga u bajara oladigan xizmatlarni biriktiring.</p>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card"><div className="admin-stat-icon"><Users size={18} /></div><div className="admin-stat-copy"><small>Shifokorlar</small><strong>{activeEmployees.length}</strong><span className="admin-stat-trend trend-flat">faol</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Link2 size={18} /></div><div className="admin-stat-copy"><small>Jami biriktirishlar</small><strong>{assignments.length}</strong><span className="admin-stat-trend trend-up">yozuv</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Check size={18} /></div><div className="admin-stat-copy"><small>Xizmatlar</small><strong>{activeServices.length}</strong><span className="admin-stat-trend trend-flat">faol</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><UserCog size={18} /></div><div className="admin-stat-copy"><small>Biriktirilmagan</small><strong>{activeEmployees.filter((e) => assignedCount(e.id) === 0).length}</strong><span className="admin-stat-trend trend-flat">shifokor</span></div></div>
      </div>

      <div className="assign-layout">
        {/* Left: employees list */}
        <section className="admin-card assign-emp">
          <div className="admin-card-head">
            <div><h2>Shifokorlar</h2><small>{filteredEmployees.length} ta ko‘rsatilmoqda</small></div>
          </div>
          <div className="patients-search assign-search">
            <Search size={14} />
            <input
              type="search"
              value={empQuery}
              onChange={(e) => setEmpQuery(e.target.value)}
              placeholder="Ism yoki lavozim…"
            />
          </div>
          <div className="assign-emp-list">
            {filteredEmployees.length === 0 && <div className="svc-empty">Hodim topilmadi</div>}
            {filteredEmployees.map((e) => {
              const n = assignedCount(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`assign-emp-item${selected?.id === e.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(e.id)}
                >
                  <div className="assign-emp-avatar">
                    {e.photo ? <img src={e.photo} alt={e.fullName} /> : <span>{e.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>}
                  </div>
                  <div className="assign-emp-body">
                    <strong>{e.fullName}</strong>
                    <small>{e.position}</small>
                  </div>
                  <span className={`assign-count${n > 0 ? ' has' : ''}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: services for selected employee */}
        <section className="admin-card assign-svc">
          <div className="admin-card-head">
            <div>
              <h2>{selected ? `${selected.fullName} uchun xizmatlar` : 'Hodim tanlang'}</h2>
              <small>
                {selected ? `${selectedAssignmentSet.size} ta biriktirilgan · ${activeServices.length} ta mavjud` : '—'}
              </small>
            </div>
            {selected && (
              <div className="admin-page-actions">
                <button className="admin-btn admin-btn-ghost" onClick={clearAllInView}>Tanlashlarni tozalash</button>
                <button className="admin-btn admin-btn-primary" onClick={selectAllInView}>Barchasini biriktirish</button>
              </div>
            )}
          </div>

          <div className="assign-svc-toolbar">
            <div className="appt-doctor-filter">
              <label>Kategoriya:</label>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">Barchasi</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="patients-search">
              <Search size={14} />
              <input
                type="search"
                value={svcQuery}
                onChange={(e) => setSvcQuery(e.target.value)}
                placeholder="Xizmat nomi…"
              />
            </div>
          </div>

          {selected ? (
            <div className="assign-svc-grid">
              {filteredServices.length === 0 && <div className="svc-empty">Xizmatlar topilmadi</div>}
              {filteredServices.map((s) => {
                const checked = selectedAssignmentSet.has(s.id);
                return (
                  <label key={s.id} className={`assign-svc-row${checked ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignment(selected.id, s.id)}
                    />
                    <span className="assign-check-box">{checked && <Check size={14} />}</span>
                    <div className="assign-svc-main">
                      <strong>{s.name}</strong>
                      <small style={{ color: categoryColor(s.categoryId) }}>{categoryName(s.categoryId)}</small>
                    </div>
                    <span className="svc-share-chip">{s.doctorShare}%</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="svc-empty">Chapdan hodim tanlang</div>
          )}
        </section>
      </div>
    </div>
  );
}
