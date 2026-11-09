import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  Receipt, Wallet, TrendingUp, TrendingDown, Banknote, PiggyBank, AlertCircle, Clock,
} from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtSom,
} from '../admin/components/DashboardCharts';
import { useDebts } from '../admin/debtsStore';

type Txn = { id: string; type: 'income' | 'expense' | string; amount: number; createdAt: number };

// Tanlangan davr uchun vaqt oralig'i (ms).
function periodWindow(period: 'day' | 'month' | 'year'): { from: number; label: string } {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  if (period === 'day')   return { from: now - 7 * DAY,   label: 'oxirgi 7 kun' };
  if (period === 'month') return { from: now - 365 * DAY, label: 'oxirgi 12 oy' };
  return { from: now - 5 * 365 * DAY, label: 'oxirgi 5 yil' };
}

export function CashierOverview() {
  const { user } = useAuth();
  const debts = useDebts();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const { period, setPeriod } = usePeriod('month');

  const refreshTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const rows = response.ok ? await response.json() : [];
      setTxns(Array.isArray(rows) ? rows : []);
      setLastUpdated(Date.now());
    } catch {
      setTxns([]);
    }
  };

  useEffect(() => {
    void refreshTransactions();
    const interval = window.setInterval(() => { void refreshTransactions(); }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const { from: periodFrom, label: periodLabel } = useMemo(() => periodWindow(period), [period]);

  // Davrga mos tranzaksiyalar (tile'lar davr bo'yicha filtrlanadi)
  const incomes = useMemo(
    () => txns.filter((t) => t.type === 'income' && t.createdAt >= periodFrom),
    [txns, periodFrom],
  );
  const expenses = useMemo(
    () => txns.filter((t) => t.type === 'expense' && t.createdAt >= periodFrom),
    [txns, periodFrom],
  );

  const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const profit = totalIncome - totalExpense;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const sameDay = (ts: number) => new Date(ts).toISOString().slice(0, 10) === todayKey;
  const sameMonth = (ts: number) => new Date(ts).toISOString().slice(0, 7) === monthKey;

  const dayIncome = txns
    .filter((t) => t.type === 'income' && sameDay(t.createdAt))
    .reduce((s, t) => s + t.amount, 0);
  const monthIncome = txns
    .filter((t) => t.type === 'income' && sameMonth(t.createdAt))
    .reduce((s, t) => s + t.amount, 0);

  // Qarzdorlar — avtomatik oqimdan
  const openDebts = useMemo(() => debts.filter((d) => d.status === 'ochiq'), [debts]);
  const openDebtTotal = openDebts.reduce((s, d) => s + (d.amount ?? 0), 0);
  // Muddati o'tgan qarzlar — dueDate bugundan oldin
  const overdueDebts = useMemo(() => {
    return openDebts.filter((d) => d.dueDate && d.dueDate < todayKey);
  }, [openDebts, todayKey]);
  const overdueTotal = overdueDebts.reduce((s, d) => s + (d.amount ?? 0), 0);
  // Top 5 — summasi bo'yicha
  const topDebts = useMemo(
    () => [...openDebts].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [openDebts],
  );

  const incomeSeries = useMemo(
    () => bucketize(incomes, (t) => t.createdAt, (t) => t.amount || 0, period),
    [incomes, period],
  );
  const expenseSeries = useMemo(
    () => bucketize(expenses, (t) => t.createdAt, (t) => t.amount || 0, period),
    [expenses, period],
  );
  const countSeries = useMemo(
    () => bucketize(incomes, (t) => t.createdAt, () => 1, period),
    [incomes, period],
  );

  return (
    <section className="admin-page">
      <style>{dashboardCss}</style>
      <div className="admin-page-head">
        <div>
          <h1>Salom, {user?.fullName}</h1>
          <p>{user?.role === 'buxgalter' ? 'Kassa va moliya operatsiyalari — real-time kuzatuv' : 'Moliya faoliyati va davriy ko‘rsatkichlar'}</p>
        </div>
        <div className="admin-page-actions">
          <span className="admin-chip chip-ok">Live • {new Date(lastUpdated).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>

      <div className="dc-tiles">
        <StatTile tone="ok" icon={<TrendingUp size={16} />} label="Daromad" value={fmtSom(totalIncome)} hint={periodLabel} />
        <StatTile tone="rose" icon={<TrendingDown size={16} />} label="Xarajat" value={fmtSom(totalExpense)} hint={periodLabel} />
        <StatTile tone="violet" icon={<PiggyBank size={16} />} label="Sof foyda" value={fmtSom(profit)} hint={profit >= 0 ? 'ijobiy' : 'salbiy'} />
        <StatTile tone="primary" icon={<Banknote size={16} />} label="Bugungi daromad" value={fmtSom(dayIncome)} hint={todayKey} />
        <StatTile tone="cyan" icon={<Wallet size={16} />} label="Oylik daromad" value={fmtSom(monthIncome)} hint={monthKey} />
        <StatTile
          tone={openDebts.length > 0 ? 'warn' : 'cyan'}
          icon={<AlertCircle size={16} />}
          label="Ochiq qarzlar"
          value={`${openDebts.length} ta`}
          hint={openDebtTotal > 0 ? fmtSom(openDebtTotal) : "qarz yo'q"}
        />
        <StatTile
          tone={overdueDebts.length > 0 ? 'rose' : 'cyan'}
          icon={<Clock size={16} />}
          label="Muddati o'tgan"
          value={`${overdueDebts.length} ta`}
          hint={overdueTotal > 0 ? fmtSom(overdueTotal) : "yo'q"}
        />
        <StatTile tone="warn" icon={<Receipt size={16} />} label="Tranzaksiyalar" value={txns.length} hint="jami" />
      </div>

      <div className="dc-period-head">
        <div>
          <h3>Moliyaviy ko‘rsatkichlar</h3>
          <p>Kunlik — oxirgi 7 kun · Oylik — oxirgi 12 oy · Yillik — oxirgi 5 yil</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className="dc-grid">
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><TrendingUp size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Daromad</h4>
            <small>{fmtSom(incomeSeries.reduce((s, b) => s + b.value, 0))}</small>
          </div>
          <LineChart data={incomeSeries} color="#10b981" format={fmtSom} />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><TrendingDown size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Xarajat</h4>
            <small>{fmtSom(expenseSeries.reduce((s, b) => s + b.value, 0))}</small>
          </div>
          <BarChart data={expenseSeries} color="#db2777" format={fmtSom} />
        </div>
        <div className="dc-panel">
          <div className="dc-panel-head">
            <h4><Receipt size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Tranzaksiyalar soni</h4>
            <small>{countSeries.reduce((s, b) => s + b.value, 0)} ta</small>
          </div>
          <BarChart data={countSeries} color="#4f46e5" />
        </div>
      </div>

      {openDebts.length > 0 && (
        <section className="admin-card" style={{ marginTop: 20 }}>
          <div className="admin-card-head">
            <div>
              <h2><AlertCircle size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Eng katta ochiq qarzlar</h2>
              <small>Davolash yakunlangan, lekin to'lov qilinmagan — avtomatik oqimdan</small>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bemor</th>
                  <th>Xizmat</th>
                  <th>Shifokor</th>
                  <th>Sana</th>
                  <th className="admin-cell-right">Summa</th>
                </tr>
              </thead>
              <tbody>
                {topDebts.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.patient}</strong></td>
                    <td className="admin-cell-muted">{d.services.join(', ') || '—'}</td>
                    <td className="admin-cell-muted">{d.doctor}</td>
                    <td className="admin-cell-muted">{d.date}</td>
                    <td className="admin-cell-right"><strong>{fmtSom(d.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
