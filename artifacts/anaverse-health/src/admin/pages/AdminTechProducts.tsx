import { useMemo, useState } from 'react';
import { Edit, Package, Plus, Save, Trash2, X } from 'lucide-react';
import { useTechProducts, addTechProduct, updateTechProduct, removeTechProduct, type TechProduct } from '../techStore';
import { usePagination, TablePagination } from '../components/TablePagination';

function formatSom(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

type FormState = {
  id?: string;
  name: string;
  qty: string;
  costPrice: string;
  salePrice: string;
};

const EMPTY: FormState = { name: '', qty: '', costPrice: '', salePrice: '' };

export function AdminTechProducts() {
  const products = useTechProducts();
  const [modal, setModal] = useState<FormState | null>(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => p.name.toLowerCase().includes(needle));
  }, [products, q]);

  const pg = usePagination(filtered, [q, filtered.length]);

  const totals = useMemo(() => {
    const qty = products.reduce((s, p) => s + p.qty, 0);
    const costValue = products.reduce((s, p) => s + p.qty * p.costPrice, 0);
    const saleValue = products.reduce((s, p) => s + p.qty * p.salePrice, 0);
    return { qty, costValue, saleValue, profit: saleValue - costValue };
  }, [products]);

  function openCreate() { setModal({ ...EMPTY }); }
  function openEdit(p: TechProduct) {
    setModal({
      id: p.id,
      name: p.name,
      qty: String(p.qty),
      costPrice: String(p.costPrice),
      salePrice: String(p.salePrice),
    });
  }
  function closeModal() { setModal(null); }

  function save() {
    if (!modal) return;
    const payload = {
      name: modal.name.trim(),
      qty: Math.max(0, Number(modal.qty) || 0),
      costPrice: Math.max(0, Number(modal.costPrice) || 0),
      salePrice: Math.max(0, Number(modal.salePrice) || 0),
    };
    if (!payload.name) return;
    if (modal.id) updateTechProduct(modal.id, payload);
    else addTechProduct(payload);
    closeModal();
  }

  function handleDelete(p: TechProduct) {
    if (confirm(`"${p.name}" mahsulotini o'chirasizmi?`)) removeTechProduct(p.id);
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Texnik buyurtma</h1>
          <p>Klinikaga olib kelinadigan mahsulotlar — nomi, soni, tannarxi va sotish narxi.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary" onClick={openCreate}><Plus size={15} /> Yangi mahsulot</button>
        </div>
      </div>

      <div className="rep-kpi-row">
        <div className="rep-kpi">
          <small>Jami mahsulot nomlari</small>
          <strong>{products.length}</strong>
          <span className="rep-kpi-sub">omborda: {totals.qty} dona</span>
        </div>
        <div className="rep-kpi">
          <small>Tannarx qiymati</small>
          <strong>{formatSom(totals.costValue)}</strong>
          <span className="rep-kpi-sub">kirim bo'yicha</span>
        </div>
        <div className="rep-kpi rep-kpi-primary">
          <small>Sotish qiymati</small>
          <strong>{formatSom(totals.saleValue)}</strong>
          <span className="rep-kpi-sub">foyda: {formatSom(totals.profit)}</span>
        </div>
      </div>

      <section className="admin-card">
        <div className="tr-toolbar">
          <div className="tr-search">
            <Package size={14} />
            <input
              type="text"
              placeholder="Mahsulot nomi bo'yicha izlash..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="tr-count">Topildi: <strong>{filtered.length}</strong></div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Mahsulot nomi</th>
                <th className="admin-cell-right">Soni</th>
                <th className="admin-cell-right">Tannarx (dona)</th>
                <th className="admin-cell-right">Sotish narxi (dona)</th>
                <th className="admin-cell-right">Jami sotish qiymati</th>
                <th className="admin-cell-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Mahsulot topilmadi.</td></tr>
              ) : pg.pageRows.map((p, i) => (
                <tr key={p.id}>
                  <td className="admin-cell-time">{i + 1}</td>
                  <td><strong>{p.name}</strong></td>
                  <td className="admin-cell-right">{p.qty}</td>
                  <td className="admin-cell-right admin-cell-muted">{formatSom(p.costPrice)}</td>
                  <td className="admin-cell-right">{formatSom(p.salePrice)}</td>
                  <td className="admin-cell-right"><strong>{formatSom(p.qty * p.salePrice)}</strong></td>
                  <td className="admin-cell-right">
                    <button className="admin-icon-btn sm" onClick={() => openEdit(p)} aria-label="Tahrirlash"><Edit size={14} /></button>
                    <button className="admin-icon-btn sm" onClick={() => handleDelete(p)} aria-label="O'chirish"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>

      {modal && (
        <div className="appt-modal-backdrop" onClick={closeModal}>
          <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tw-head">
              <h2>{modal.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h2>
              <button className="admin-icon-btn sm" onClick={closeModal} aria-label="Yopish"><X size={16} /></button>
            </div>
            <div className="tw-body">
              <label className="tw-label">
                <span>Mahsulot nomi</span>
                <input type="text" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="masalan: Keramika koronka" />
              </label>
              <div className="appt-modal-row">
                <label className="tw-label">
                  <span>Soni</span>
                  <input type="number" min={0} value={modal.qty} onChange={(e) => setModal({ ...modal, qty: e.target.value })} placeholder="0" />
                </label>
                <label className="tw-label">
                  <span>Tannarx (dona uchun)</span>
                  <input type="number" min={0} value={modal.costPrice} onChange={(e) => setModal({ ...modal, costPrice: e.target.value })} placeholder="so'mda" />
                </label>
              </div>
              <label className="tw-label">
                <span>Sotish narxi (dona uchun)</span>
                <input type="number" min={0} value={modal.salePrice} onChange={(e) => setModal({ ...modal, salePrice: e.target.value })} placeholder="so'mda" />
              </label>
              {(Number(modal.qty) > 0 && Number(modal.salePrice) > 0) && (
                <div className="tw-selected-summary">
                  Jami sotish qiymati: <strong>{formatSom(Number(modal.qty) * Number(modal.salePrice))}</strong>
                </div>
              )}
            </div>
            <div className="tw-foot">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={closeModal}>Bekor qilish</button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={!modal.name.trim()}>
                <Save size={15} /> Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
