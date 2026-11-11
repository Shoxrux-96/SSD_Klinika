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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const paidAfter = paidSum + clean;
  const prevPct = debt.amount > 0 ? (paidSum / debt.amount) * 100 : 0;
  const nowPct  = debt.amount > 0 ? (clean / debt.amount) * 100 : 0;

  return (
    <div className="dpm-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="dpm-title">
      <div className="dpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dpm-head">
          <div className="dpm-head-top">
            <div className="dpm-head-ico"><BookOpen size={18} /></div>
            <div className="dpm-head-text">
              <h2 id="dpm-title">Qarzni toʻlash</h2>
              <p>Boʻlib-boʻlib yoki toʻliq toʻlash mumkin</p>
            </div>
            <button className="dpm-close" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>

          <div className="dpm-patient">
            <div className="dpm-avatar">{debt.patient.charAt(0).toUpperCase()}</div>
            <div className="dpm-patient-info">
              <strong>{debt.patient}</strong>
              <div className="dpm-patient-meta">
                {debt.phone ? <span><Phone size={10} /> {debt.phone}</span> : null}
                <span>{debt.services[0] ?? '—'}</span>
                <span>{debt.doctor || '—'}</span>
                <span><Calendar size={10} /> {debt.date}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dpm-body">
          <div className="dpm-stats">
            <div className="dpm-stat">
              <small>Jami qarz</small>
              <strong>{fmt(debt.amount)}</strong>
            </div>
            <div className="dpm-stat dpm-stat-paid">
              <small>Toʻlangan</small>
              <strong>{fmt(paidSum)}</strong>
            </div>
            <div className="dpm-stat dpm-stat-left">
              <small>Qoldiq</small>
              <strong>{fmt(remaining)}</strong>
            </div>
          </div>

          <div className="dpm-progress-box">
            <div className="dpm-progress-head">
              <span>Toʻlovdan soʻng</span>
              <strong>{pct}%</strong>
            </div>
            <div className="dpm-progress-bar">
              <span className="dpm-progress-prev" style={{ width: `${prevPct}%` }} />
              <span className="dpm-progress-now"  style={{ left: `${prevPct}%`, width: `${nowPct}%` }} />
            </div>
            <div className="dpm-progress-note">
              {clean === 0 && <><span className="dpm-dot" /> Summa kiriting</>}
              {clean > 0 && after > 0 && <><span className="dpm-dot" /> Qoldiq: <strong>{fmt(after)} soʻm</strong></>}
              {clean > 0 && after === 0 && <span className="dpm-ok"><CheckCircle2 size={12} /> Qarz yopiladi</span>}
            </div>
          </div>

          <div className="dpm-field">
            <label className="dpm-label"><Wallet size={13} /> Toʻlov summasi</label>
            <div className="dpm-amount">
              <input type="number" min={0} max={remaining} value={sum}
                onChange={(e) => setSum(Number(e.target.value))} />
              <span>soʻm</span>
            </div>
            <div className="dpm-chips">
              {quick.map((q) => (
                <button key={q.label} type="button" onClick={() => setSum(q.v)}
                  className={`dpm-chip ${sum === q.v ? 'is-active' : ''}`}>
                  <strong>{q.label}</strong>
                  <em>{fmt(q.v)}</em>
                </button>
              ))}
            </div>
          </div>

          <div className="dpm-field">
            <label className="dpm-label"><CreditCard size={13} /> Toʻlov usuli</label>
            <div className="dpm-methods">
              {methodMeta.map((m) => {
                const active = method === m.k;
                return (
                  <button key={m.k} type="button" onClick={() => setMethod(m.k)}
                    className={`dpm-method ${active ? 'is-active' : ''}`}>
                    <m.Ico size={15} />
                    <span>{m.label}</span>
                    {active && <Check size={13} className="dpm-method-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dpm-field">
            <label className="dpm-label">Izoh <span className="dpm-opt">(ixtiyoriy)</span></label>
            <textarea className="dpm-textarea" placeholder="qisqa izoh…" value={note}
              onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="dpm-foot">
          <button className="dpm-btn dpm-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button
            className="dpm-btn dpm-btn-primary"
            disabled={busy || clean <= 0}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(clean, method, note || undefined); }
              finally { setBusy(false); }
            }}
          >
            <Wallet size={14} /> Toʻlov qilish — {fmt(clean)} soʻm
          </button>
        </div>
      </div>
      <style>{debtPayStyles}</style>
    </div>
  );
}

const debtPayStyles = `
.dpm-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: radial-gradient(1200px 600px at 50% 0%, rgba(37, 99, 235, 0.18), transparent 60%),
              rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: grid; place-items: center;
  padding: 16px;
  animation: dpmFade .2s ease-out;
}
@keyframes dpmFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes dpmPop {
  from { opacity: 0; transform: translateY(12px) scale(.96) }
  to   { opacity: 1; transform: translateY(0)    scale(1) }
}
.dpm-modal {
  width: 100%; max-width: 500px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow:
    0 40px 80px -24px rgba(15, 23, 42, 0.45),
    0 20px 40px -20px rgba(37, 99, 235, 0.22),
    0 0 0 1px rgba(15, 23, 42, 0.04);
  overflow: hidden;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 32px);
  animation: dpmPop .25s cubic-bezier(.2,.9,.25,1);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
}

/* Head */
.dpm-head {
  padding: 22px 24px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef4ff 100%);
  border-bottom: 1px solid rgba(37, 99, 235, 0.08);
  position: relative;
}
.dpm-head::before {
  content: "";
  position: absolute; left: 0; right: 0; top: 0; height: 3px;
  background: linear-gradient(90deg, #2563eb, #4f46e5, #10b981);
}
.dpm-head-top { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start; }
.dpm-head-ico {
  width: 40px; height: 40px; border-radius: 12px;
  background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e;
  display: grid; place-items: center;
  box-shadow: 0 4px 10px -4px rgba(217, 119, 6, 0.4);
}
.dpm-head-text h2 {
  margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.015em; color: #0f172a;
}
.dpm-head-text p { margin: 3px 0 0; color: #64748b; font-size: 13px; }
.dpm-close {
  width: 32px; height: 32px; border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: #64748b;
  cursor: pointer; display: grid; place-items: center;
  transition: all .15s;
  backdrop-filter: blur(8px);
}
.dpm-close:hover { color: #0f172a; background: #fff; transform: rotate(90deg); }

.dpm-patient {
  margin-top: 14px;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 14px;
  backdrop-filter: blur(8px);
}
.dpm-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  display: grid; place-items: center; font-weight: 700; font-size: 15px;
  box-shadow: 0 6px 14px -4px rgba(59, 130, 246, 0.5);
}
.dpm-patient-info { min-width: 0; flex: 1; }
.dpm-patient-info strong { font-size: 13.5px; font-weight: 600; color: #0f172a; display: block; }
.dpm-patient-meta {
  margin-top: 2px; display: flex; flex-wrap: wrap; gap: 4px 10px;
  font-size: 11.5px; color: #64748b;
}
.dpm-patient-meta span { display: inline-flex; align-items: center; gap: 4px; }
.dpm-patient-meta span + span::before { content: "·"; color: #cbd5e1; margin-right: 10px; margin-left: -6px; }

/* Body */
.dpm-body {
  padding: 16px 22px;
  overflow-y: auto;
  display: grid; gap: 16px;
}

.dpm-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.dpm-stat {
  min-width: 0; text-align: center;
  padding: 12px 10px;
  background: #fff;
  border: 1px solid #e4e9f1;
  border-radius: 12px;
  position: relative;
  transition: transform .15s, box-shadow .15s;
}
.dpm-stat:hover { transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.08); }
.dpm-stat-paid { background: linear-gradient(180deg, #f0fdf4, #ecfdf5); border-color: #bbf7d0; }
.dpm-stat-left { background: linear-gradient(180deg, #fef2f2, #fee2e2); border-color: #fecaca; }
.dpm-stat small {
  display: block;
  font-size: 10.5px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;
}
.dpm-stat strong {
  display: block; margin-top: 4px;
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: #0f172a;
}
.dpm-stat-paid strong { color: #047857; }
.dpm-stat-left strong { color: #b91c1c; }

/* Progress */
.dpm-progress-box {
  padding: 14px 16px;
  background: linear-gradient(135deg, #fafbff, #f1f5ff);
  border: 1px solid #e4e9f1;
  border-radius: 14px;
}
.dpm-progress-head {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12px; color: #64748b;
}
.dpm-progress-head strong {
  color: #2563eb; font-size: 16px; font-weight: 700;
  font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
}
.dpm-progress-bar {
  position: relative;
  height: 10px; margin-top: 8px;
  background: #e4e9f1;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
}
.dpm-progress-prev {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, #10b981, #059669);
}
.dpm-progress-now {
  position: absolute; top: 0; bottom: 0;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}
.dpm-progress-note {
  margin-top: 8px; font-size: 12px; color: #64748b;
  display: flex; align-items: center; gap: 6px;
}
.dpm-progress-note strong { color: #0f172a; font-weight: 600; }
.dpm-dot { width: 6px; height: 6px; border-radius: 50%; background: #2563eb; }
.dpm-ok {
  display: inline-flex; align-items: center; gap: 4px;
  color: #047857; font-weight: 600; font-size: 12px;
}

/* Fields */
.dpm-field { display: grid; gap: 8px; }
.dpm-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 600; color: #0f172a;
}
.dpm-opt { color: #94a3b8; font-weight: 400; }

.dpm-amount {
  display: flex; align-items: center;
  background: #f6f8fb;
  border: 1.5px solid #e4e9f1;
  border-radius: 12px;
  padding: 2px 14px 2px 4px;
  transition: border-color .15s, background .15s;
}
.dpm-amount:focus-within { border-color: #2563eb; background: #fff; }
.dpm-amount input {
  flex: 1; min-width: 0;
  border: 0; background: transparent; outline: none;
  padding: 12px 10px;
  font: inherit;
  font-size: 20px; font-weight: 700; color: #0f172a;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}
.dpm-amount input::-webkit-outer-spin-button,
.dpm-amount input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.dpm-amount span { color: #64748b; font-size: 13px; font-weight: 500; padding-right: 4px; }

.dpm-chips {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.dpm-chip {
  appearance: none; cursor: pointer;
  border: 1px solid #e4e9f1;
  background: #f6f8fb;
  color: #0f172a;
  border-radius: 10px;
  padding: 9px 4px;
  display: grid; gap: 2px;
  text-align: center;
  transition: all .12s;
  font-family: inherit;
}
.dpm-chip strong { display: block; font-weight: 700; font-size: 12.5px; color: #0f172a; }
.dpm-chip em {
  display: block; font-style: normal;
  color: #64748b; font-size: 10.5px; font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dpm-chip:hover { border-color: #cfd6e3; background: #eef2f7; }
.dpm-chip.is-active {
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  border-color: #3b82f6;
  box-shadow: 0 2px 8px -2px rgba(59, 130, 246, 0.3);
}
.dpm-chip.is-active strong, .dpm-chip.is-active em { color: #1d4ed8; }

.dpm-methods {
  display: grid; grid-template-columns: repeat(3, 1fr);
  background: #f6f8fb;
  border: 1px solid #e4e9f1;
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
}
.dpm-method {
  appearance: none; border: 0; cursor: pointer;
  background: transparent; color: #64748b;
  padding: 10px 6px; border-radius: 8px;
  font: inherit; font-size: 12.5px; font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  position: relative;
  transition: all .12s;
}
.dpm-method:hover { color: #0f172a; }
.dpm-method.is-active {
  background: #fff; color: #0f172a; font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px #e4e9f1;
}
.dpm-method-check { color: #047857; }

.dpm-textarea {
  width: 100%; box-sizing: border-box;
  border: 1.5px solid #e4e9f1;
  background: #f6f8fb;
  color: #0f172a;
  border-radius: 12px;
  padding: 10px 14px;
  font: inherit; font-size: 13px;
  resize: vertical; min-height: 56px;
  outline: none;
  transition: border-color .15s, background .15s;
  font-family: inherit;
}
.dpm-textarea:focus { border-color: #2563eb; background: #fff; }
.dpm-textarea::placeholder { color: #94a3b8; }

/* Footer */
.dpm-foot {
  padding: 14px 22px 18px;
  border-top: 1px solid #e4e9f1;
  background: #f6f8fb;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
}
.dpm-btn {
  appearance: none; cursor: pointer; font: inherit;
  border: 0; border-radius: 12px;
  padding: 12px 18px;
  font-size: 13.5px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .12s;
}
.dpm-btn-ghost {
  background: transparent; color: #64748b;
  border: 1px solid #e4e9f1;
}
.dpm-btn-ghost:hover { color: #0f172a; background: #eef2f7; }
.dpm-btn-primary {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #fff;
  box-shadow: 0 10px 22px -8px rgba(37, 99, 235, 0.6), 0 0 0 1px rgba(37, 99, 235, 0.3) inset;
}
.dpm-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 14px 28px -8px rgba(37, 99, 235, 0.65); }
.dpm-btn-primary:active { transform: translateY(0); }
.dpm-btn-primary:disabled {
  opacity: 0.55; cursor: not-allowed; filter: none; box-shadow: none;
}

@media (max-width: 420px) {
  .dpm-chips { grid-template-columns: repeat(2, 1fr); }
  .dpm-head, .dpm-body, .dpm-foot { padding-left: 16px; padding-right: 16px; }
  .dpm-stat + .dpm-stat { padding-left: 6px; }
  .dpm-stat strong { font-size: 13.5px; }
}
`;

/* ------- To'lov tarixi modali ------- */
function DebtHistoryModal({ debt, lines, onClose }: {
  debt: DebtRecord;
  lines: PaidLine[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const sorted = [...lines].sort((a, b) => b.date - a.date);
  const total = sorted.reduce((s, l) => s + l.amount, 0);
  const methodLabel = (m: Method) => m === 'naqd' ? 'Naqd' : m === 'plastik' ? 'Karta' : 'Oʻtkazma';
  const methodColor = (m: Method) =>
    m === 'naqd'    ? { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' } :
    m === 'plastik' ? { bg: '#eef2ff', fg: '#4f46e5', bd: '#c7d2fe' } :
                      { bg: '#fef3c7', fg: '#b45309', bd: '#fde68a' };

  return (
    <div className="dpm-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dpm-modal dhm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dpm-head dhm-head">
          <div className="dpm-head-top">
            <div className="dpm-head-ico" style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', color: '#047857' }}>
              <Receipt size={18} />
            </div>
            <div className="dpm-head-text">
              <h2>{debt.patient} — toʻlov tarixi</h2>
              <p>Qarz uchun qilingan barcha toʻlovlar</p>
            </div>
            <button className="dpm-close" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>

          <div className="dhm-summary">
            <div className="dhm-summary-item">
              <small>Toʻlovlar soni</small>
              <strong>{sorted.length}</strong>
            </div>
            <div className="dhm-summary-item dhm-summary-total">
              <small>Jami toʻlangan</small>
              <strong>{fmt(total)}</strong>
            </div>
          </div>
        </div>

        <div className="dhm-body">
          {sorted.length === 0 ? (
            <div className="dhm-empty">
              <div className="dhm-empty-ico"><AlertCircle size={28} /></div>
              <div className="dhm-empty-title">Toʻlovlar hali yoʻq</div>
              <div className="dhm-empty-sub">Birinchi toʻlov qilingach, bu yerda koʻrinadi</div>
            </div>
          ) : (
            <ol className="dhm-list">
              {sorted.map((l, i) => {
                const c = methodColor(l.method);
                return (
                  <li key={l.id} className="dhm-item">
                    <div className="dhm-item-num">{sorted.length - i}</div>
                    <div className="dhm-item-main">
                      <div className="dhm-item-top">
                        <span className="dhm-date"><Clock size={11} /> {new Date(l.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="dhm-method" style={{ background: c.bg, color: c.fg, borderColor: c.bd }}>
                          {methodLabel(l.method)}
                        </span>
                      </div>
                      {l.note && <div className="dhm-note">{l.note}</div>}
                    </div>
                    <div className="dhm-item-amount">{fmt(l.amount)}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="dhm-foot">
            <span>JAMI</span>
            <strong>{fmt(total)}</strong>
          </div>
        )}
      </div>
      <style>{historyStyles}</style>
    </div>
  );
}

const historyStyles = `
.dhm-modal { max-width: 560px; }
.dhm-head { padding-bottom: 14px; }
.dhm-summary {
  margin-top: 14px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.dhm-summary-item {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 12px;
  padding: 10px 14px;
  backdrop-filter: blur(8px);
}
.dhm-summary-item small {
  display: block;
  color: #64748b; font-size: 11px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.dhm-summary-item strong {
  display: block; margin-top: 3px;
  font-size: 18px; font-weight: 700; color: #0f172a;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}
.dhm-summary-total strong {
  background: linear-gradient(135deg, #059669, #10b981);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.dhm-body {
  padding: 16px 22px;
  overflow-y: auto;
  flex: 1;
}

.dhm-empty {
  text-align: center;
  padding: 40px 20px;
}
.dhm-empty-ico {
  width: 56px; height: 56px; margin: 0 auto 12px;
  border-radius: 16px;
  background: #f6f8fb; color: #94a3b8;
  display: grid; place-items: center;
}
.dhm-empty-title { font-size: 14px; font-weight: 600; color: #0f172a; }
.dhm-empty-sub { margin-top: 4px; font-size: 12.5px; color: #64748b; }

.dhm-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.dhm-item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e4e9f1;
  border-radius: 12px;
  transition: transform .15s, box-shadow .15s, border-color .15s;
}
.dhm-item:hover {
  transform: translateY(-1px);
  border-color: #cfd6e3;
  box-shadow: 0 6px 16px -6px rgba(15, 23, 42, 0.1);
}
.dhm-item-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4f46e5;
  display: grid; place-items: center;
  font-size: 12px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.dhm-item-main { min-width: 0; }
.dhm-item-top {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.dhm-date {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: #475569; font-weight: 500;
}
.dhm-method {
  display: inline-flex; align-items: center;
  font-size: 11px; font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.dhm-note {
  margin-top: 4px;
  font-size: 12px; color: #64748b;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.dhm-item-amount {
  font-size: 14px; font-weight: 700;
  color: #047857;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.dhm-foot {
  padding: 14px 22px 18px;
  border-top: 1px solid #e4e9f1;
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  display: flex; align-items: center; justify-content: space-between;
}
.dhm-foot span {
  font-size: 11.5px; font-weight: 700;
  color: #047857; letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dhm-foot strong {
  font-size: 18px; font-weight: 700; color: #047857;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 420px) {
  .dhm-summary { grid-template-columns: 1fr; }
  .dhm-body { padding-left: 16px; padding-right: 16px; }
  .dhm-foot { padding-left: 16px; padding-right: 16px; }
}
`;

export default AdminDebts;
