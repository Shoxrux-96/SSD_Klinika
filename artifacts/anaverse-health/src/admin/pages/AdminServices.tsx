import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Edit3,
  FolderPlus,
  Percent,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  addService,
  addServiceCategory,
  archiveService,
  removeService,
  removeServiceCategory,
  type Currency,
  type Service,
  type ServiceCategory,
  unarchiveService,
  updateService,
  updateServiceCategory,
  useServiceCategories,
  useServices,
} from '../store';

const CATEGORY_COLORS = ['#ff3c00', '#0e8e52', '#4a5bcf', '#9c6b00', '#634a9f', '#2c7766', '#c22', '#17a2b8'];

const CURRENCY_LABEL: Record<Currency, string> = {
  som: 'so‘m',
  rubl: 'rubl',
  dollar: 'dollar',
};
const CURRENCY_SYMBOL: Record<Currency, string> = {
  som: 'so‘m',
  rubl: '₽',
  dollar: '$',
};

function fmtNumber(n: number) {
  return n.toLocaleString('uz-UZ').replace(/,/g, ' ');
}
function fmtSom(n: number) {
  return `${fmtNumber(n)} so‘m`;
}
function fmtPrice(price: number, currency: Currency) {
  if (currency === 'som') return `${fmtNumber(price)} so‘m`;
  if (currency === 'rubl') return `${fmtNumber(price)} ₽`;
  return `$${fmtNumber(price)}`;
}
function somOf(s: Service) {
  return s.currency === 'som' ? s.price : (s.somValue ?? 0);
}

export function AdminServices() {
  const categories = useServiceCategories();
  const services = useServices();

  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | Currency>('all');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [catModal, setCatModal] = useState<{ mode: 'add' | 'edit'; initial?: ServiceCategory } | null>(null);
  const [svcModal, setSvcModal] = useState<{ mode: 'add' | 'edit'; initial?: Service; categoryId?: string } | null>(null);

  const q = query.trim().toLowerCase();
  const visibleServices = services
    .filter((s) => (tab === 'active' ? !s.archived : s.archived))
    .filter((s) => categoryFilter === 'all' || s.categoryId === categoryFilter)
    .filter((s) => currencyFilter === 'all' || s.currency === currencyFilter)
    .filter((s) => !q || s.name.toLowerCase().includes(q));

  const visibleCategories = categoryFilter === 'all' ? categories : categories.filter((c) => c.id === categoryFilter);

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    categories.forEach((c) => map.set(c.id, []));
    visibleServices.forEach((s) => {
      if (!map.has(s.categoryId)) map.set(s.categoryId, []);
      map.get(s.categoryId)!.push(s);
    });
    return map;
  }, [visibleServices, categories]);

  const totalActive = services.filter((s) => !s.archived).length;
  const totalArchived = services.length - totalActive;
  const totalRevenue = services.filter((s) => !s.archived).reduce((sum, s) => sum + somOf(s), 0);
  const avgShare =
    services.filter((s) => !s.archived).length === 0
      ? 0
      : Math.round(
          services.filter((s) => !s.archived).reduce((s, x) => s + x.doctorShare, 0) /
            services.filter((s) => !s.archived).length,
        );

  const toggleCat = (id: string) => setOpenCats((p) => ({ ...p, [id]: !(p[id] ?? true) }));

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Xizmatlar</h1>
          <p>Kategoriya va xizmatlar — narxi, tannarxi va shifokor ulushi (foizda).</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-ghost" onClick={() => setCatModal({ mode: 'add' })}>
            <FolderPlus size={15} /> Yangi kategoriya
          </button>
          <button className="admin-btn admin-btn-primary" onClick={() => setSvcModal({ mode: 'add' })}>
            <Plus size={15} /> Yangi xizmat
          </button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card"><div className="admin-stat-icon"><Wallet size={18} /></div><div className="admin-stat-copy"><small>Kategoriyalar</small><strong>{categories.length}</strong><span className="admin-stat-trend trend-flat">bo‘limlar</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Wallet size={18} /></div><div className="admin-stat-copy"><small>Faol xizmatlar</small><strong>{totalActive}</strong><span className="admin-stat-trend trend-up">faol</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Archive size={18} /></div><div className="admin-stat-copy"><small>Arxivda</small><strong>{totalArchived}</strong><span className="admin-stat-trend trend-flat">arxiv</span></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><Percent size={18} /></div><div className="admin-stat-copy"><small>O‘rt. shifokor ulushi</small><strong>{avgShare}%</strong><span className="admin-stat-trend trend-flat">foiz</span></div></div>
      </div>

      <section className="admin-card patients-toolbar">
        <div className="patients-tabs">
          <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Faol ({totalActive})</button>
          <button className={tab === 'archived' ? 'active' : ''} onClick={() => setTab('archived')}>Arxiv ({totalArchived})</button>
        </div>
        <div className="appt-doctor-filter">
          <label>Kategoriya:</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Barchasi</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="appt-doctor-filter">
          <label>Valyuta:</label>
          <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as 'all' | Currency)}>
            <option value="all">Barchasi</option>
            <option value="som">So‘m</option>
            <option value="rubl">Rubl (₽)</option>
            <option value="dollar">Dollar ($)</option>
          </select>
        </div>
        <div className="patients-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Xizmat nomi bo‘yicha qidirish…"
          />
        </div>
      </section>

      <div className="svc-categories">
        {visibleCategories.map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          const isOpen = openCats[cat.id] ?? true;
          return (
            <section key={cat.id} className="admin-card svc-cat">
              <div className="svc-cat-head">
                <button type="button" className="svc-cat-title" onClick={() => toggleCat(cat.id)}>
                  <ChevronDown size={16} className={`svc-chev${isOpen ? ' open' : ''}`} />
                  <span className="svc-cat-dot" style={{ background: cat.color }} />
                  <h3>{cat.name}</h3>
                  <small>({items.length} ta xizmat)</small>
                </button>
                <div className="svc-cat-actions">
                  <button className="admin-icon-btn sm ok" title="Tahrirlash" onClick={() => setCatModal({ mode: 'edit', initial: cat })}><Edit3 size={14} /></button>
                  <button className="admin-icon-btn sm danger" title="Kategoriyani o‘chirish" onClick={() => confirm(`"${cat.name}" kategoriyasini va uning xizmatlarini o‘chirasizmi?`) && removeServiceCategory(cat.id)}><Trash2 size={14} /></button>
                  <button className="admin-btn admin-btn-ghost svc-cat-add" onClick={() => setSvcModal({ mode: 'add', categoryId: cat.id })}>
                    <Plus size={13} /> Xizmat
                  </button>
                </div>
              </div>

              {isOpen && (
                items.length === 0 ? (
                  <div className="svc-empty">Ushbu kategoriyada {tab === 'active' ? 'faol' : 'arxivdagi'} xizmat yo‘q</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table svc-table">
                      <thead>
                        <tr>
                          <th>Xizmat nomi</th>
                          <th>Narxi</th>
                          <th>Valyuta</th>
                          <th>Shifokor ulushi</th>
                          <th>Shifokorga</th>
                          <th className="admin-cell-right">Amallar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((s) => {
                          const somVal = somOf(s);
                          const doctorAmount = Math.round((somVal * s.doctorShare) / 100);
                          return (
                            <tr key={s.id} className={s.archived ? 'svc-row-archived' : ''}>
                              <td><strong>{s.name}</strong></td>
                              <td>{fmtPrice(s.price, s.currency)}</td>
                              <td><span className={`svc-currency-chip cur-${s.currency}`}>{CURRENCY_LABEL[s.currency]}</span></td>
                              <td><span className="svc-share-chip">{s.doctorShare}%</span></td>
                              <td className="admin-cell-muted">{fmtSom(doctorAmount)}</td>
                              <td className="admin-cell-right">
                                <button className="admin-icon-btn sm ok" title="Tahrirlash" onClick={() => setSvcModal({ mode: 'edit', initial: s })}><Edit3 size={14} /></button>
                                {s.archived ? (
                                  <button className="admin-icon-btn sm" title="Arxivdan chiqarish" onClick={() => unarchiveService(s.id)}><ArchiveRestore size={14} /></button>
                                ) : (
                                  <button className="admin-icon-btn sm missed" title="Arxivga olish" onClick={() => archiveService(s.id)}><Archive size={14} /></button>
                                )}
                                <button
                                  className="admin-icon-btn sm danger"
                                  title="O‘chirish"
                                  onClick={() => confirm(`"${s.name}" xizmatini butunlay o‘chirasizmi?`) && removeService(s.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </section>
          );
        })}
      </div>

      {catModal && (
        <CategoryModal
          mode={catModal.mode}
          initial={catModal.initial}
          onClose={() => setCatModal(null)}
          onSave={(data) => {
            if (catModal.mode === 'add') addServiceCategory(data.name, data.color);
            else if (catModal.initial) updateServiceCategory(catModal.initial.id, data);
            setCatModal(null);
          }}
        />
      )}

      {svcModal && (
        <ServiceModal
          mode={svcModal.mode}
          initial={svcModal.initial}
          defaultCategoryId={svcModal.categoryId}
          categories={categories}
          onClose={() => setSvcModal(null)}
          onSave={(data) => {
            if (svcModal.mode === 'add') addService(data);
            else if (svcModal.initial) updateService(svcModal.initial.id, data);
            setSvcModal(null);
          }}
        />
      )}

      {totalRevenue > 0 && (
        <div className="svc-revenue">
          Jami faol xizmatlar narxi: <strong>{fmtSom(totalRevenue)}</strong>
        </div>
      )}
    </div>
  );
}

/* -------- Category modal -------- */

function CategoryModal({
  mode,
  initial,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit';
  initial?: ServiceCategory;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[0]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><FolderPlus size={18} /> {mode === 'add' ? 'Yangi kategoriya' : 'Kategoriyani tahrirlash'}</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>
        <div className="appt-modal-body">
          <label>
            <span>Kategoriya nomi</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Ortodontiya" required autoFocus />
          </label>
          <label>
            <span>Rang</span>
            <div className="svc-color-row">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`svc-color-dot${color === c ? ' active' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </label>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary">Saqlash</button>
        </div>
      </form>
    </div>
  );
}

/* -------- Service modal -------- */

function ServiceModal({
  mode,
  initial,
  defaultCategoryId,
  categories,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit';
  initial?: Service;
  defaultCategoryId?: string;
  categories: ServiceCategory[];
  onClose: () => void;
  onSave: (data: Omit<Service, 'id' | 'archived'>) => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState<string>(initial ? String(initial.price) : '0');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'som');
  const [somValue, setSomValue] = useState<string>(initial?.somValue ? String(initial.somValue) : '0');
  const [doctorShare, setDoctorShare] = useState<string>(initial ? String(initial.doctorShare) : '30');

  const priceN = Number(price) || 0;
  const somValueN = Number(somValue) || 0;
  const shareN = Math.min(100, Math.max(0, Number(doctorShare) || 0));
  const effectiveSom = currency === 'som' ? priceN : somValueN;
  const doctorAmount = Math.round((effectiveSom * shareN) / 100);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    onSave({
      categoryId,
      name: name.trim(),
      price: priceN,
      currency,
      somValue: currency === 'som' ? undefined : somValueN,
      doctorShare: shareN,
    });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal emp-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><Plus size={18} /> {mode === 'add' ? 'Yangi xizmat' : 'Xizmatni tahrirlash'}</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>
        <div className="appt-modal-body">
          <label>
            <span>Kategoriya</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span>Xizmat nomi</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Keramik koronka" required />
          </label>

          <div className="appt-modal-row">
            <label>
              <span>Narxi</span>
              <div className="svc-share-input">
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                <span className="svc-share-suffix">{CURRENCY_SYMBOL[currency]}</span>
              </div>
            </label>
            <label>
              <span>Valyuta</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="som">So‘m</option>
                <option value="rubl">Rubl (₽)</option>
                <option value="dollar">Dollar ($)</option>
              </select>
            </label>
          </div>

          {currency !== 'som' && (
            <label>
              <span>So‘mdagi qiymati</span>
              <div className="svc-share-input">
                <input
                  type="number"
                  min="0"
                  value={somValue}
                  onChange={(e) => setSomValue(e.target.value)}
                  placeholder="Masalan: 4 800 000"
                />
                <span className="svc-share-suffix">so‘m</span>
              </div>
            </label>
          )}

          <label>
            <span>Shifokor ulushi (foizda)</span>
            <div className="svc-share-input">
              <input type="number" min="0" max="100" value={doctorShare} onChange={(e) => setDoctorShare(e.target.value)} />
              <span className="svc-share-suffix">%</span>
            </div>
          </label>

          <div className="svc-preview">
            <div><small>So‘mdagi narxi</small><strong>{fmtSom(effectiveSom)}</strong></div>
            <div><small>Shifokorga</small><strong>{fmtSom(doctorAmount)}</strong></div>
            <div><small>Klinikaga</small><strong>{fmtSom(effectiveSom - doctorAmount)}</strong></div>
          </div>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary">Saqlash</button>
        </div>
      </form>
    </div>
  );
}
