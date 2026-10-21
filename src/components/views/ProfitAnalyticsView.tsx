import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  CircleHelp,
  Coins,
  Download,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { getDateInTimeZone } from '../../utils/dateUtils';
import { getLocalDateString } from '../../utils/reportMetrics';
import { buildActualProfitAnalytics, type ActualProfitDimensionRow, type ProfitDatePreset } from '../../utils/actualProfitAnalytics';
import type { AppCurrency } from '../../types';

interface ProfitAnalyticsViewProps {
  onViewSale: (saleId: string) => void;
  onViewSales: (saleIds: string[]) => void;
}

const rangeLabels: Record<ProfitDatePreset, string> = {
  today: 'Today',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  month: 'This month',
  custom: 'Custom',
};

const cardClass = 'min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#151C28]';

function dateBounds(preset: ProfitDatePreset, today: string, customStart: string, customEnd: string) {
  if (preset === 'custom') return { start: customStart, end: customEnd };
  const endDate = new Date(`${today}T12:00:00`);
  const startDate = new Date(endDate);
  if (preset === 'last_7_days') startDate.setDate(startDate.getDate() - 6);
  if (preset === 'last_30_days') startDate.setDate(startDate.getDate() - 29);
  if (preset === 'month') startDate.setDate(1);
  return { start: getLocalDateString(startDate), end: getLocalDateString(endDate) };
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'slate',
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'slate' | 'violet' | 'amber' | 'emerald' | 'rose';
}) {
  const toneClasses = {
    slate: 'text-slate-900 dark:text-white',
    violet: 'text-violet-700 dark:text-violet-300',
    amber: 'text-amber-700 dark:text-amber-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    rose: 'text-rose-700 dark:text-rose-300',
  };
  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
      <p className={`mt-2 break-words font-mono text-xl font-bold tabular-nums ${toneClasses[tone]}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
    </article>
  );
}

function ProfitTable({
  rows,
  currency,
  formatCurrency,
  onViewSales,
}: {
  rows: ActualProfitDimensionRow[];
  currency: AppCurrency;
  formatCurrency: (amount: number, currency?: string) => string;
  onViewSales: (saleIds: string[]) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700" role="region" aria-label="Profit breakdown table; scroll horizontally to view all columns" tabIndex={0}>
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
          <tr>
            <th className="px-3 py-3">Name</th><th className="px-3 py-3 text-right">Sales</th>
            <th className="px-3 py-3 text-right">Gross sales</th><th className="px-3 py-3 text-right">Actual cost</th>
            <th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">Margin</th>
            <th className="px-3 py-3 text-right">Unknown cost</th><th className="px-3 py-3">Sales list</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(row => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">{row.name}</td>
              <td className="px-3 py-3 text-right tabular-nums">{row.salesCount}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(row.grossSales, currency)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(row.allocatedCost, currency)}</td>
              <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums">{row.grossProfit === null ? 'Incomplete cost data' : formatCurrency(row.grossProfit, currency)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{row.margin === null ? '—' : `${row.margin.toFixed(1)}%`}</td>
              <td className="px-3 py-3 text-right tabular-nums">{row.unknownCostSales}</td>
              <td className="px-3 py-3">
                {row.salesCount > 0 && <button type="button" onClick={() => onViewSales(row.saleIds)} className="min-h-8 rounded-lg border border-violet-200 px-2.5 font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/30">Sales list</button>}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No sales match this date range.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export const ProfitAnalyticsView: React.FC<ProfitAnalyticsViewProps> = ({ onViewSale, onViewSales }) => {
  const { formatCurrency, formatDate: formatBusinessDate } = useAppFormatting();
  const {
    sales,
    customers,
    services,
    payments,
    profitabilityCosts,
    currency,
    settings,
    currentBusiness,
  } = useApp();
  const [datePreset, setDatePreset] = useState<ProfitDatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [breakdown, setBreakdown] = useState<'service' | 'plan' | 'unit' | 'customer_type'>('service');
  const businessId = currentBusiness?.businessId;
  const scoped = <T extends { businessId?: string }>(records: T[]) =>
    businessId ? records.filter(record => !record.businessId || record.businessId === businessId) : records;
  const businessToday = getDateInTimeZone(settings.businessProfile?.timeZone);
  const bounds = useMemo(
    () => dateBounds(datePreset, businessToday, customStart, customEnd),
    [datePreset, businessToday, customStart, customEnd]
  );
  const validBounds = Boolean(bounds.start && bounds.end && bounds.start <= bounds.end);
  const scopedSales = useMemo(() => scoped(sales), [sales, businessId]);
  const scopedCustomers = useMemo(() => scoped(customers), [customers, businessId]);
  const scopedServices = useMemo(() => scoped(services), [services, businessId]);
  const scopedPayments = useMemo(() => scoped(payments), [payments, businessId]);
  const scopedCosts = useMemo(() => scoped(profitabilityCosts), [profitabilityCosts, businessId]);
  const analytics = useMemo(() => validBounds ? buildActualProfitAnalytics({
    sales: scopedSales,
    customers: scopedCustomers,
    services: scopedServices,
    payments: scopedPayments,
    profitabilityCosts: scopedCosts,
    currency,
    bounds,
  }) : null, [validBounds, scopedSales, scopedCustomers, scopedServices, scopedPayments, scopedCosts, currency, bounds.start, bounds.end]);
  const breakdownRows = analytics
    ? breakdown === 'service' ? analytics.byService
      : breakdown === 'plan' ? analytics.byPlan
        : breakdown === 'unit' ? analytics.byUnit : analytics.byCustomerType
    : [];
  const trendData = useMemo(() => analytics?.trend.map(point => ({
    ...point,
    label: formatBusinessDate(point.date, { month: 'short', day: 'numeric' }),
  })) || [], [analytics?.trend, formatBusinessDate]);
  const breakdownChartData = breakdownRows.slice(0, 8);
  const presetOptions: ProfitDatePreset[] = ['today', 'last_7_days', 'last_30_days', 'month', 'custom'];

  return (
    <div className="section-layout-shell mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 px-3 py-3 pb-10 sm:px-6 sm:py-6 lg:px-8">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"><TrendingUp className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Financial performance</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Profit Analytics</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Account purchase costs are snapshotted to sales; customer payments are not treated as revenue again.</p>
          </div>
        </div>
        {analytics && <button type="button" onClick={() => {
          const lines = [
            ['Date', 'Sale ID', 'Customer', 'Customer Type', 'Service', 'Unit', 'Gross Sales', 'Actual Allocated Cost', 'Cost Source', 'Gross Profit', 'Unknown Cost'],
            ...analytics.rows.map(row => [
              row.sale.date, row.sale.id, row.customerName, row.customerType, row.serviceName, row.unit,
              String(row.grossSales), row.allocatedCost === null ? '' : String(row.allocatedCost),
              row.costSource, row.grossProfit === null ? '' : String(row.grossProfit),
              row.allocatedCost === null ? 'Yes' : 'No',
            ]),
          ];
          const csv = lines.map(line => line.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
          link.download = `profit-analytics-${bounds.start}-${bounds.end}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
        }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200"><Download className="h-4 w-4" />Export CSV</button>}
      </header>

      <section aria-label="Profit analytics filters" className={`${cardClass} space-y-3`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Profit date range">
          {presetOptions.map(preset => (
            <button key={preset} type="button" aria-pressed={datePreset === preset} onClick={() => setDatePreset(preset)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${datePreset === preset ? 'bg-violet-700 text-white' : 'border border-slate-200 text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:text-slate-300'}`}>{rangeLabels[preset]}</button>
          ))}
          <span className="ml-auto self-center text-xs text-slate-500">{bounds.start} – {bounds.end}</span>
        </div>
        {datePreset === 'custom' && <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Start date<input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">End date<input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
        </div>}
        {!validBounds && <p role="alert" className="text-xs font-semibold text-rose-600">Choose a valid date range with an end date on or after the start date.</p>}
      </section>

      {analytics && <>
        <section aria-label="Profit summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Gross Sales" value={formatCurrency(analytics.grossSales, currency)} detail="Eligible sale totals for the selected sale dates; not payment receipts." icon={Coins} tone="violet" />
          <Metric label="Actual Allocated Cost" value={formatCurrency(analytics.actualAllocatedCost, currency)} detail={`Account snapshots and sale-linked actual costs; ${analytics.unknownCostSales} unknown-cost sale(s) excluded.`} icon={ArrowDownRight} tone="amber" />
          <Metric label="Gross Profit" value={analytics.grossProfit === null ? 'Unavailable' : formatCurrency(analytics.grossProfit, currency)} detail={analytics.unknownCostSales ? `${analytics.unknownCostSales} sale(s) have unknown cost; total gross profit is withheld.` : 'Gross sales less actual allocated costs, before refunds and adjustments.'} icon={Activity} tone={analytics.grossProfit === null ? 'amber' : 'emerald'} />
          <Metric label="Refunds & Adjustments" value={formatCurrency(analytics.refunds + analytics.adjustments, currency)} detail={`Recorded sale refunds ${formatCurrency(analytics.refunds, currency)} · cost adjustments ${formatCurrency(analytics.adjustments, currency)}.`} icon={ArrowDownRight} tone="rose" />
          <Metric label="Net Profit" value="Unavailable" detail="Operating expenses and all other adjustment sources are not fully reconciled to sales." icon={CircleHelp} tone="slate" />
          <Metric label="Sales with Unknown Cost" value={String(analytics.unknownCostSales)} detail="No account snapshot or sale-linked actual cost is available." icon={CircleHelp} tone={analytics.unknownCostSales ? 'amber' : 'emerald'} />
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          <article className={`${cardClass} min-h-72`}>
            <div className="mb-3"><h2 className="text-sm font-bold text-slate-900 dark:text-white">Sales and allocated cost trend</h2><p className="mt-1 text-xs text-slate-500">Sale-date trend; gross profit appears only for dates where every sale has known actual cost.</p></div>
            <div className="h-64 min-w-0">
              {trendData.length ? <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10 }} width={56} />
                  <Tooltip formatter={value => formatCurrency(Number(value) || 0, currency)} />
                  <Legend />
                  <Area type="monotone" dataKey="grossSales" name="Gross sales" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="allocatedCost" name="Actual allocated cost" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke="#059669" fill="#059669" fillOpacity={0.08} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer> : <p className="flex h-full items-center justify-center text-sm text-slate-500">No eligible sales in this range.</p>}
            </div>
          </article>
          <article className={`${cardClass} min-h-72`}>
            <div className="mb-3"><h2 className="text-sm font-bold text-slate-900 dark:text-white">Sales vs actual allocated cost</h2><p className="mt-1 text-xs text-slate-500">Top 8 entries in the selected breakdown. Incomplete cost groups remain visibly incomplete.</p></div>
            <div className="h-64 min-w-0">
              {breakdownChartData.length ? <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownChartData} margin={{ top: 8, right: 8, bottom: 32, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 10 }} width={56} />
                  <Tooltip formatter={value => formatCurrency(Number(value) || 0, currency)} />
                  <Legend />
                  <Bar dataKey="grossSales" name="Gross sales" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="allocatedCost" name="Actual allocated cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <p className="flex h-full items-center justify-center text-sm text-slate-500">No breakdown data in this range.</p>}
            </div>
          </article>
        </section>

        <section className={`${cardClass} min-w-0 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Profitability breakdown</h2><p className="mt-1 text-xs text-slate-500">One calculation and date range drives this table and both charts.</p></div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Profit breakdown grouping">
              {([
                ['service', 'Service'],
                ['plan', 'Plan'],
                ['unit', 'Selling unit'],
                ['customer_type', 'Customer vs reseller'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={breakdown === value} onClick={() => setBreakdown(value)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${breakdown === value ? 'bg-violet-700 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{label}</button>
              ))}
            </div>
          </div>
          <ProfitTable rows={breakdownRows} currency={currency} formatCurrency={formatCurrency} onViewSales={onViewSales} />
        </section>

        <section className={`${cardClass} min-w-0 space-y-3`}>
          <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Sale detail</h2><p className="mt-1 text-xs text-slate-500">Refunds are reported separately and do not count customer payment balances as costs. A missing snapshot is never replaced with the current account cost.</p></div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700" role="region" aria-label="Profit analytics sale detail table; scroll horizontally to view all columns" tabIndex={0}>
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"><tr><th className="px-3 py-3">Sale / date</th><th className="px-3 py-3">Customer type</th><th className="px-3 py-3">Service / plan</th><th className="px-3 py-3">Selling unit</th><th className="px-3 py-3 text-right">Gross sales</th><th className="px-3 py-3 text-right">Actual cost</th><th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">Refunds</th><th className="px-3 py-3">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {analytics.rows.map(row => <tr key={row.sale.id}>
                  <td className="px-3 py-3"><span className="font-mono font-semibold">{row.sale.invoiceNo}</span><span className="mt-1 block text-[10px] text-slate-500">{formatBusinessDate(row.sale.date)}</span></td>
                  <td className="px-3 py-3"><span className={row.customerType === 'Reseller' ? 'rounded-full bg-violet-100 px-2 py-1 text-violet-800 dark:bg-violet-950 dark:text-violet-200' : 'rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}>{row.customerType}</span><span className="mt-1 block">{row.customerName}</span></td>
                  <td className="px-3 py-3">{row.serviceName}<span className="mt-1 block text-slate-500">{row.sale.plan}</span></td>
                  <td className="px-3 py-3">{row.unit}<span className="mt-1 block text-[10px] text-slate-500">{row.costSource === 'account_snapshot' ? row.sale.actualCostAllocation?.replace('_', ' ') || 'Account cost snapshot' : row.costSource === 'sale_cost_record' ? 'Sale-linked direct cost' : 'Unknown actual cost'}</span></td>
                  <td className="px-3 py-3 text-right font-mono">{formatCurrency(row.grossSales, currency)}</td>
                  <td className="px-3 py-3 text-right font-mono">{row.allocatedCost === null ? <span className="font-sans font-semibold text-amber-700 dark:text-amber-300">Unknown</span> : formatCurrency(row.allocatedCost, currency)}</td>
                  <td className="px-3 py-3 text-right font-mono">{row.grossProfit === null ? '—' : formatCurrency(row.grossProfit, currency)}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatCurrency(row.refunded, currency)}</td>
                  <td className="px-3 py-3"><button type="button" onClick={() => onViewSale(row.sale.id)} className="min-h-8 rounded-lg border border-violet-200 px-2.5 font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300">Open sale</button></td>
                </tr>)}
                {!analytics.rows.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No eligible sales in this date range.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          New sales capture account costs at completion. For a profile/family-slot sale the saved account cost is divided by its configured profile capacity; a full-account sale uses the full saved cost. An explicit sale-linked direct cost record is used only when no account snapshot exists. Sales without either source remain unknown. Net profit is withheld because operating expenses and all adjustment sources are not fully attributable to these sales.
        </p>
      </>}
    </div>
  );
};
