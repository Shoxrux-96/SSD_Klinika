import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  BookOpen, Phone, Calendar, Wallet, X, Banknote, CreditCard, ArrowRightLeft,
  Check, CheckCircle2, Clock, Search, Receipt, Trash2, AlertCircle,
} from 'lucide-react';
import { useDebts, removeDebt, type DebtRecord } from '../debtsStore';
import { useTreatments } from '../clinicalData';
import { usePatients, useServices, useEmployees } from '../store';
import { usePagination, TablePagination } from '../components/TablePagination';

/* ------- Payment API glue (bir xil AdminCashier bilan) ------- */
type Method = 'naqd' | 'plastik' | 'bank';
const METHOD_MAP: Record<Method, string> = { naqd: 'naqd', plastik: 'karta', bank: 'transfer' };

async function postTransaction(body: any): Promise<void> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API /transactions failed');
}

/* ------- Payments state (qisman to'lovlarni qayta o'qish uchun) ------- */
type PaidLine = { id: string; debtTreatmentId: string; amount: number; method: Method; date: number; note?: string };
let paidState: PaidLine[] = [];
let paidHydrated = false;
const paidListeners = new Set<() => void>();
function emit() { paidListeners.forEach((l) => l()); }
function sub(l: () => void) { paidListeners.add(l); return () => paidListeners.delete(l); }

const METHOD_FROM: Record<string, Method> = { naqd: 'naqd', karta: 'plastik', transfer: 'bank' };

async function hydratePaid() {
  if (paidHydrated) return;
  paidHydrated = true;
  try {
    const res = await fetch('/api/transactions');
    const rows: any[] = await res.json();
    paidState = rows.filter((r) => r.type === 'income').map((r) => {
      let extra: any = {};
      try { extra = r.description ? JSON.parse(r.description) : {}; } catch {}
      return {
        id: r.id,
        debtTreatmentId: extra.debtTreatmentId ?? extra.treatmentId ?? '',
        amount: r.amount,
        method: METHOD_FROM[r.method] ?? 'naqd',
        date: Number(r.createdAt) || Date.now(),
        note: extra.note,
      } as PaidLine;
    }).filter((p) => p.debtTreatmentId);
    emit();
  } catch (e) { console.error('paid hydrate failed', e); }
}
function usePaid(): PaidLine[] {
  useEffect(() => { hydratePaid(); }, []);
  return useSyncExternalStore(sub, () => paidState, () => paidState);
}

/* ------- Utils ------- */
const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU') + " soʻm";

export function AdminDebts({ embedded = false }: { embedded?: boolean } = {}) {
  const debts = useDebts();
  const treatments = useTreatments();
  const patients = usePatients();
  const paid = usePaid();
  const [query, setQuery] = useState('');
  type RowWithTotals = DebtRecord & { totalAmount: number; paidSum: number; remaining: number };
  const [payRow, setPayRow] = useState<RowWithTotals | null>(null);
  const [historyRow, setHistoryRow] = useState<RowWithTotals | null>(null);

  // Davolash umumiy summasi (debt.amount lekin treatment.amount bilan ham moslash)
  const treatmentById = useMemo(() => {
    const m = new Map<string, any>();
    treatments.forEach((t) => m.set(t.id, t));
    return m;
  }, [treatments]);

  // Har bir qarz uchun qisman to'lovlar jami (kassa payments'dan)
  const paidByDebt = useMemo(() => {
    const m = new Map<string, number>();
    paid.forEach((p) => {
      if (!p.debtTreatmentId) return;
      m.set(p.debtTreatmentId, (m.get(p.debtTreatmentId) ?? 0) + p.amount);
    });
    return m;
  }, [paid]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return debts
      .map((d) => {
        const t = treatmentById.get(d.treatmentId);
        const totalAmount = t?.amount ?? d.amount;
        const paidSum = paidByDebt.get(d.treatmentId) ?? 0;
        const remaining = Math.max(0, d.amount - paidSum);
        return { ...d, totalAmount, paidSum, remaining };
      })
      .filter((d) => d.remaining > 0)
      .filter((d) => {
        if (!q) return true;
        return (d.patient + (d.phone ?? '') + d.doctor + d.services.join(' ')).toLowerCase().includes(q);
      })
      .sort((a, b) => b.deferredAt - a.deferredAt);
  }, [debts, treatmentById, paidByDebt, query]);

  // Avto-tozalash: qarz 0 bo'lgan yozuvlarni daftardan chiqarish
  useEffect(() => {
    debts.forEach((d) => {
      const s = paidByDebt.get(d.treatmentId) ?? 0;
      if (s >= d.amount) removeDebt(d.treatmentId);
    });
  }, [paidByDebt, debts]);

  const totals = useMemo(() => {
    const debtTotal = rows.reduce((s, r) => s + r.remaining, 0);
    const paidTotal = rows.reduce((s, r) => s + r.paidSum, 0);
    const count = rows.length;
    return { debtTotal, paidTotal, count };
  }, [rows]);

  const pg = usePagination(rows, [rows.length, query]);

  return (
    <div className={embedded ? 'debt-embedded' : 'admin-page'}>
      {!embedded && (
        <div className="admin-page-head">
          <div>
            <h1><BookOpen size={20} style={{ verticalAlign: '-3px', marginRight: 6 }} /> Qarz daftar</h1>
            <p>Qarzdorlar roʻyxati — bemor nomi, telefon va qolgan qarz. Qarzni boʻlib-boʻlib toʻlash mumkin.</p>
          </div>
        </div>
      )}

      <div className="debt-kpis">
        <div className="debt-kpi">
          <small>Qarzdorlar soni</small>
          <strong>{totals.count}</strong>
        </div>
        <div className="debt-kpi debt-kpi-debt">
          <small>Jami qolgan qarz</small>
          <strong>{fmt(totals.debtTotal)}</strong>
        </div>
        <div className="debt-kpi debt-kpi-paid">
          <small>Jami toʻlangan</small>
          <strong>{fmt(totals.paidTotal)}</strong>
        </div>
      </div>

      <div className="debt-search">
        <Search size={14} />
        <input
          type="search"
          placeholder="Bemor, telefon, shifokor yoki xizmat boʻyicha qidirish…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Qarzdorlar roʻyxati</h2>
            <small>{rows.length} ta yozuv</small>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="admin-empty" style={{ padding: 32 }}>Qarzdor bemor yoʻq.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table debt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bemor</th>
                  <th>Telefon</th>
                  <th>Shifokor</th>
                  <th>Xizmatlar</th>
                  <th>Qarz sanasi</th>
                  <th className="t-right">Jami qarz</th>
                  <th className="t-right">Toʻlangan</th>
                  <th className="t-right">Qoldiq</th>
                  <th className="t-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageRows.map((d, i) => (
                  <tr key={d.treatmentId}>
                    <td>{pg.start + i + 1}</td>
                    <td><strong>{d.patient}</strong></td>
                    <td>
                      {d.phone ? (
                        <a href={`tel:${d.phone}`} className="debt-phone">
                          <Phone size={11} /> {d.phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td>{d.doctor || '—'}</td>
                    <td title={d.services.join(', ')}>
                      {d.services[0] ?? '—'}
                      {d.services.length > 1 && <em style={{ color: '#64748b' }}> (+{d.services.length - 1})</em>}
                    </td>
                    <td>{d.date}</td>
                    <td className="t-right">{fmt(d.amount)}</td>
                    <td className="t-right">
                      {d.paidSum > 0 ? <span style={{ color: '#047857' }}>{fmt(d.paidSum)}</span> : '—'}
                    </td>
                    <td className="t-right"><strong style={{ color: '#b91c1c' }}>{fmt(d.remaining)}</strong></td>
                    <td className="t-right">
                      <div className="debt-actions">
                        <button
                          className="admin-btn admin-btn-ghost sm"
                          title="Toʻlov tarixi"
                          onClick={() => setHistoryRow(d)}
                        >
                          <Receipt size={12} />
                        </button>
                        <button
                          className="admin-btn admin-btn-primary sm"
                          onClick={() => setPayRow(d)}
                        >
                          <Wallet size={12} /> Toʻlov
                        </button>
                        <button
                          className="admin-btn admin-btn-ghost sm"
                          title="Qarz daftaridan oʻchirish"
                          onClick={() => {
                            if (confirm(`"${d.patient}" uchun qarz yozuvi oʻchirilsinmi? (Toʻlov tarixi saqlanadi)`)) {
                              removeDebt(d.treatmentId);
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination {...pg} />
          </div>
        )}
      </section>

      {payRow && (
        <DebtPaymentModal
          debt={payRow}
          paidSum={payRow.paidSum ?? 0}
          remaining={payRow.remaining ?? payRow.amount}
          patients={patients}
          onClose={() => setPayRow(null)}
          onConfirm={async (amount, method, note) => {
            const p = patients.find((x) => x.fullName === payRow.patient);
            await postTransaction({
              type: 'income',
              amount,
              currency: 'som',
              method: METHOD_MAP[method],
              patientId: p?.id ?? null,
              serviceId: null,
              employeeId: null,
              description: JSON.stringify({
                patientName: payRow.patient,
                serviceName: payRow.services.join(', '),
                doctorName: payRow.doctor,
                amount: payRow.amount,
                discount: 0,
                debtTreatmentId: payRow.treatmentId,
                kind: 'debt_payment',
                note,
              }),
              date: new Date().toISOString().slice(0, 10),
            });
            paidState = [{
              id: crypto.randomUUID(),
              debtTreatmentId: payRow.treatmentId,
              amount, method, date: Date.now(), note,
            }, ...paidState];
            emit();
            // Qarz to'liq to'landi — daftardan chiqariladi
            const newPaid = (payRow.paidSum ?? 0) + amount;
            if (newPaid >= payRow.amount) removeDebt(payRow.treatmentId);
            setPayRow(null);
          }}
        />
      )}

      {historyRow && (
        <DebtHistoryModal
          debt={historyRow}
          lines={paid.filter((p) => p.debtTreatmentId === historyRow.treatmentId)}
          onClose={() => setHistoryRow(null)}
        />
      )}
    </div>
  );
}

/* ------- To'lov modali ------- */
function DebtPaymentModal({
  debt, paidSum, remaining, onClose, onConfirm,
}: {
  debt: DebtRecord;
  paidSum: number;
  remaining: number;
  patients: ReturnType<typeof usePatients>;
  onClose: () => void;
  onConfirm: (amount: number, method: Method, note?: string) => void | Promise<void>;
}) {
  const [sum, setSum] = useState<number>(remaining);
  const [method, setMethod] = useState<Method>('naqd');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const clean = Math.max(0, Math.min(remaining, Math.round(sum || 0)));
  const after = remaining - clean;
  const pct = debt.amount > 0 ? Math.round(((paidSum + clean) / debt.amount) * 100) : 0;

  const quick = [
    { label: '25%', v: Math.round(remaining * 0.25) },
    { label: '50%', v: Math.round(remaining * 0.5) },
    { label: '75%', v: Math.round(remaining * 0.75) },
    { label: "To'liq", v: remaining },
  ];

  const methodMeta: { k: Method; label: string; Ico: any; color: string; soft: string }[] = [
    { k: 'naqd',    label: 'Naqd',     Ico: Banknote,       color: '#047857', soft: '#ecfdf5' },
    { k: 'plastik', label: 'Karta',    Ico: CreditCard,     color: '#4f46e5', soft: '#eef2ff' },
    { k: 'bank',    label: "Oʻtkazma", Ico: ArrowRightLeft, color: '#b45309', soft: '#fef3c7' },
  ];

  return (
    <div className="pay-backdrop" onClick={onClose}>
      <div className="pay-modal pp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pay-head">
          <div className="pay-head-ico" style={{ background: '#fef3c7', color: '#92400e' }}>
            <BookOpen size={18} />
          </div>
          <div>
            <h2>Qarzni toʻlash</h2>
            <p>Boʻlib-boʻlib yoki toʻliq toʻlash mumkin</p>
          </div>
          <button className="pay-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pp-body">
          <div className="pp-summary-chip">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', color: '#92400e', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
              {debt.patient.charAt(0).toUpperCase()}
            </div>
            <div className="pp-summary-main">
              <strong>{debt.patient}</strong>
              <small>
                {debt.phone ? <><Phone size={10} /> {debt.phone} · </> : null}
                {debt.services[0] ?? '—'} · {debt.doctor || '—'} · <Calendar size={10} /> {debt.date}
              </small>
            </div>
          </div>

          <div className="pp-stats">
            <div className="pp-stat"><small>Jami qarz</small><strong>{fmt(debt.amount)}</strong></div>
            <div className="pp-stat pp-stat-paid"><small>Toʻlangan</small><strong>{fmt(paidSum)}</strong></div>
            <div className="pp-stat pp-stat-debt"><small>Qoldiq</small><strong>{fmt(remaining)}</strong></div>
          </div>

          <div className="pp-progress">
            <div className="pp-progress-bar">
              <span className="pp-progress-prev" style={{ width: `${debt.amount > 0 ? (paidSum / debt.amount) * 100 : 0}%` }} />
              <span className="pp-progress-now" style={{
                left: `${debt.amount > 0 ? (paidSum / debt.amount) * 100 : 0}%`,
                width: `${debt.amount > 0 ? (clean / debt.amount) * 100 : 0}%`,
              }} />
            </div>
            <div className="pp-progress-label">
              Toʻlovdan soʻng: <strong>{pct}%</strong>
              {after > 0 && <span> · qoladi: <em>{fmt(after)}</em></span>}
              {after === 0 && clean > 0 && <span className="pp-close-chip"><CheckCircle2 size={12} /> Qarz yopiladi</span>}
            </div>
          </div>

          <div className="pay-field">
            <label className="pay-label"><Wallet size={13} /> Toʻlov summasi</label>
            <div className="pp-amount-row">
              <div className="pay-money-input pp-amount-input">
                <input type="number" min={0} max={remaining} value={sum} onChange={(e) => setSum(Number(e.target.value))} />
                <span>soʻm</span>
              </div>
            </div>
            <div className="pp-quick">
              {quick.map((q) => (
                <button key={q.label} type="button" onClick={() => setSum(q.v)}
                  className={`pp-quick-btn ${sum === q.v ? 'is-active' : ''}`}>
                  {q.label} <em>— {fmt(q.v)}</em>
                </button>
              ))}
            </div>
          </div>

          <div className="pay-field">
            <label className="pay-label"><CreditCard size={13} /> Toʻlov usuli</label>
            <div className="pay-method-grid">
              {methodMeta.map((m) => {
                const active = method === m.k;
                return (
                  <button key={m.k} type="button" onClick={() => setMethod(m.k)}
                    className={`pay-method ${active ? 'is-active' : ''}`}
                    style={active ? { borderColor: m.color, background: m.soft } : undefined}>
                    <span className="pay-method-ico" style={{ background: m.soft, color: m.color }}>
                      <m.Ico size={16} />
                    </span>
                    <span className="pay-method-name">{m.label}</span>
                    {active && <Check size={14} className="pay-method-check" style={{ color: m.color }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pay-field">
            <label className="pay-label">Izoh (ixtiyoriy)</label>
            <input className="admin-input" placeholder="qisqa izoh…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="pay-actions">
            <button className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
            <button
              className="admin-btn admin-btn-primary"
              disabled={busy || clean <= 0}
              onClick={async () => {
                setBusy(true);
                try { await onConfirm(clean, method, note || undefined); }
                finally { setBusy(false); }
              }}
            >
              <Wallet size={14} /> Toʻlov qilish — {fmt(clean)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------- To'lov tarixi modali ------- */
function DebtHistoryModal({ debt, lines, onClose }: {
  debt: DebtRecord;
  lines: PaidLine[];
  onClose: () => void;
}) {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="pay-backdrop" onClick={onClose}>
      <div className="pay-modal pp-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="pay-head">
          <div className="pay-head-ico" style={{ background: '#ecfdf5', color: '#047857' }}>
            <Receipt size={18} />
          </div>
          <div>
            <h2>{debt.patient} — toʻlov tarixi</h2>
            <p>Qarz uchun qilingan barcha toʻlovlar</p>
          </div>
          <button className="pay-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {lines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>
              <AlertCircle size={28} /><br /> Toʻlovlar hali yoʻq
            </div>
          ) : (
            <table className="admin-table" style={{ fontSize: 13 }}>
              <thead><tr><th>#</th><th>Sana</th><th>Usul</th><th className="t-right">Summa</th><th>Izoh</th></tr></thead>
              <tbody>
                {lines.sort((a, b) => b.date - a.date).map((l, i) => (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td>{new Date(l.date).toLocaleDateString('uz-UZ')}</td>
                    <td>{l.method === 'naqd' ? 'Naqd' : l.method === 'plastik' ? 'Karta' : 'Oʻtkazma'}</td>
                    <td className="t-right"><strong>{fmt(l.amount)}</strong></td>
                    <td style={{ color: '#64748b' }}>{l.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}><strong>JAMI</strong></td><td className="t-right"><strong>{fmt(total)}</strong></td><td /></tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDebts;
