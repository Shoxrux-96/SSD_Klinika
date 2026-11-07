import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Receipt, Wallet, TrendingUp, TrendingDown, Banknote, PiggyBank } from 'lucide-react';
import {
  BarChart, LineChart, PeriodTabs, StatTile, usePeriod, bucketize, dashboardCss, fmtSom,
} from '../admin/components/DashboardCharts';

type Txn = { id: string; type: 'income' | 'expense' | string; amount: number; createdAt: number };

export function CashierOverview() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Txn[]>([]);
  const { period, setPeriod } = usePeriod('month');

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => setTxns(Array.isArray(rows) ? rows : []))
      .catch(() => setTxns([]));
  }, []);

  const incomes = useMemo(() => txns.filter((t) => t.type === 'income'), [txns]);
  const expenses = useMemo(() => txns.filter((t) => t.type === 'expense'), [txns]);

  const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const profit = totalIncome - totalExpense;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const sameDay = (ts: number) => new Date(ts).toISOString().slice(0, 10) === todayKey;
  const sameMonth = (ts: number) => new Date(ts).toISOString().slice(0, 7) === monthKey;

  const dayIncome = incomes.filter((t) => sameDay(t.createdAt)).reduce((s, t) => s + t.amount, 0);
  const monthIncome = incomes.filter((t) => sameMonth(t.createdAt)).reduce((s, t) => s + t.amount, 0);

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
          <p>Moliya faoliyati va davriy ko‘rsatkichlar</p>
        </div>
      </div>

      <div className="dc-tiles">
        <StatTile tone="ok" icon={<TrendingUp size={16} />} label="Jami daromad" value={fmtSom(totalIncome)} hint="barcha davr" />
        <StatTile tone="rose" icon={<TrendingDown size={16} />} label="Jami xarajat" value={fmtSom(totalExpense)} hint="barcha davr" />
        <StatTile tone="violet" icon={<PiggyBank size={16} />} label="Sof foyda" value={fmtSom(profit)} hint={profit >= 0 ? 'ijobiy' : 'salbiy'} />
        <StatTile tone="primary" icon={<Banknote size={16} />} label="Bugun daromad" value={fmtSom(dayIncome)} hint={todayKey} />
        <StatTile tone="cyan" icon={<Wallet size={16} />} label="Oylik daromad" value={fmtSom(monthIncome)} hint={monthKey} />
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
    </section>
  );
}
