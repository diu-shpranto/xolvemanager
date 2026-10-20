import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, CalendarClock, CheckCircle2, CircleAlert, CircleDollarSign, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { formatAppDate, formatCurrency, getDateInTimeZone } from '../../utils/dateUtils';
import {
  getCashFlowSummary,
  getAccountLedger,
  getFinancialLedger,
  getTotalBusinessBalance,
} from '../../utils/financialLedger';
import { normalizePaymentMethods } from '../../utils/paymentMethods';
import { downloadCSV } from '../../utils/csvParser';
import {
  getAccountingLedgerBalance,
  getReceivableAging,
  runFinancialIntegrityCheck,
} from '../../utils/accountingControls';
import type { FinancialAccount } from '../../types';

const cardClass = 'surface-card financial-control-card min-w-0 p-3 sm:p-4';
const inputClass = 'control-field w-full px-3 py-2 text-sm';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';
const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = typeof value === 'number' || !/^[\s]*[=+\-@]/.test(text) ? text : `'${text}`;
  return `"${safe.replace(/"/g, '""')}"`;
};

function Metric({ label, value, icon: Icon, tone = 'default', compact = false }: { label: string; value: string | number; icon: LucideIcon; tone?: 'default' | 'good' | 'warn'; compact?: boolean }) {
  const toneClass = tone === 'good' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-950 dark:text-white';
  const iconClass = tone === 'good' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-violet-700 dark:text-violet-300';
  return <div className={`financial-control-metric min-w-0 rounded-xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-3.5 sm:p-4'} dark:border-slate-700 dark:bg-[#151C28]`}>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${iconClass}`} />
    </div>
    <p className={`mt-2 truncate font-mono font-bold tabular-nums tracking-tight ${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} ${toneClass}`}>{value}</p>
  </div>;
}

export const FinancialControlView: React.FC = () => {
  const { formatCurrency, formatDate: formatAppDate } = useAppFormatting();
  const {
    currentBusiness, financialAccounts, payments, expenses, otherIncome, financialTransfers,
    financialAdjustments, financialReconciliations, financialPeriods, dailyClosings, sales,
    invoices, subscriptions, customers, services, settings, currency, addFinancialReconciliation,
    closeFinancialPeriod, reopenFinancialPeriod,
  } = useApp();
  const { showToast } = useToast();
  const today = getDateInTimeZone(settings.businessProfile?.timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [reconcilingAccountId, setReconcilingAccountId] = useState('');
  const [actualBalance, setActualBalance] = useState('');
  const [reconciliationDate, setReconciliationDate] = useState(today);
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [ledgerStart, setLedgerStart] = useState('');
  const [ledgerEnd, setLedgerEnd] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [periodNote, setPeriodNote] = useState('');
  const [reopeningPeriodId, setReopeningPeriodId] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [periodBusy, setPeriodBusy] = useState(false);

  const records = useMemo(() => ({
    accounts: financialAccounts,
    payments,
    expenses,
    income: otherIncome,
    transfers: financialTransfers,
    adjustments: financialAdjustments,
    paymentMethods: normalizePaymentMethods(settings.paymentPreferences?.methods),
    expenseCategories: settings.financialPreferences?.expenseCategories || [],
    incomeCategories: settings.financialPreferences?.incomeCategories || [],
    sales,
    invoices,
    customers,
  }), [
    financialAccounts, payments, expenses, otherIncome, financialTransfers, financialAdjustments,
    settings.paymentPreferences?.methods, settings.financialPreferences, sales, invoices, customers,
  ]);
  const ledger = useMemo(() => getFinancialLedger(records), [records]);
  const periodLedger = useMemo(() => getCashFlowSummary(ledger, currency, { start: monthStart, end: today }), [ledger, currency, monthStart, today]);
  const totalBalance = useMemo(() => getTotalBusinessBalance(financialAccounts, ledger, currency), [financialAccounts, ledger, currency]);
  const aging = useMemo(() => getReceivableAging({ sales, payments, invoices, customers }, today, currency), [sales, payments, invoices, customers, today, currency]);
  const issues = useMemo(() => runFinancialIntegrityCheck({
    businessId: currentBusiness?.businessId,
    ...records,
    subscriptions,
    services,
    dailyClosings,
    reconciliations: financialReconciliations,
    periods: financialPeriods,
  }), [currentBusiness?.businessId, records, subscriptions, services, dailyClosings, financialReconciliations, financialPeriods]);
  const errors = issues.filter(issue => issue.severity === 'ERROR');
  const warnings = issues.filter(issue => issue.severity === 'WARNING');
  const activePeriod = financialPeriods.find(period =>
    period.businessId === currentBusiness?.businessId && period.status === 'closed'
    && today >= period.startDate && today <= period.endDate
  );
  const periodLabel = activePeriod ? 'CLOSED' : 'OPEN';
  const selectedAccount = financialAccounts.find(account => account.id === selectedAccountId);
  const accountLedger = useMemo(() => {
    if (!selectedAccount) return [];
    const range = ledgerStart || ledgerEnd
      ? { start: ledgerStart || selectedAccount.openingBalanceDate, end: ledgerEnd || today }
      : undefined;
    const needle = ledgerSearch.trim().toLocaleLowerCase();
    return getAccountLedger(selectedAccount, ledger, selectedAccount.currency, range)
      .filter(entry => !needle || [entry.reference, entry.description, entry.categoryName, entry.customerName || ''].some(value => value.toLocaleLowerCase().includes(needle)));
  }, [selectedAccount, ledger, ledgerStart, ledgerEnd, today, ledgerSearch]);
  const latestReconciliationByAccount = useMemo(() => {
    const map = new Map<string, (typeof financialReconciliations)[number]>();
    [...financialReconciliations]
      .filter(item => item.businessId === currentBusiness?.businessId)
      .sort((left, right) => right.reconciliationDate.localeCompare(left.reconciliationDate) || right.createdAt.localeCompare(left.createdAt))
      .forEach(item => { if (!map.has(item.accountId)) map.set(item.accountId, item); });
    return map;
  }, [financialReconciliations, currentBusiness?.businessId]);
  const reconciliationHistory = useMemo(() => [...financialReconciliations]
    .filter(item => item.businessId === currentBusiness?.businessId)
    .sort((left, right) => right.reconciliationDate.localeCompare(left.reconciliationDate)), [financialReconciliations, currentBusiness?.businessId]);
  const currentDailyClosing = dailyClosings.find(item => item.date === today
    && item.businessId === currentBusiness?.businessId && item.status === 'closed');
  const dailyClosingHistory = [...dailyClosings]
    .filter(item => item.businessId === currentBusiness?.businessId)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 12);
  const recentAdjustments = [...financialAdjustments]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 10);
  const currentMonthClosed = financialPeriods.some(period =>
    period.businessId === currentBusiness?.businessId && period.startDate === monthStart
    && today >= period.startDate && today <= period.endDate && period.status === 'closed'
  );

  const beginReconciliation = (account: FinancialAccount) => {
    setReconcilingAccountId(account.id);
    setSelectedAccountId(account.id);
    setActualBalance('');
    setReconciliationDate(today);
    setReconciliationNote('');
  };
  const submitReconciliation = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      addFinancialReconciliation({
        accountId: reconcilingAccountId,
        reconciliationDate,
        actualBalance: Number(actualBalance),
        note: reconciliationNote,
      });
      setReconcilingAccountId('');
      showToast('Reconciliation saved to history.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save reconciliation.', 'error');
    }
  };
  const submitPeriodClose = () => {
    const warningDetails = warnings.slice(0, 3).map(issue => `• ${issue.message}`).join('\n');
    const warningText = warnings.length
      ? `\n\nWarnings (${warnings.length}):\n${warningDetails}${warnings.length > 3 ? '\nMore warnings are listed in Financial Integrity Check.' : ''}`
      : '\n\nNo warnings detected.';
    if (!window.confirm(`Close the financial period ${monthStart} – ${today}?${warningText}\n\nThis blocks normal historical posting until the period is reopened.`)) return;
    setPeriodBusy(true);
    try {
      closeFinancialPeriod(monthStart, today, periodNote);
      setPeriodNote('');
      showToast('Financial period closed.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not close financial period.', 'error');
    } finally {
      setPeriodBusy(false);
    }
  };
  const submitPeriodReopen = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      reopenFinancialPeriod(reopeningPeriodId, reopenReason);
      setReopeningPeriodId('');
      setReopenReason('');
      showToast('Financial period reopened. Changes will be logged in Activity History.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not reopen financial period.', 'error');
    }
  };

  return (
    <div className="financial-control-view finance-responsive-page section-layout-shell customer-list-page mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-3 pb-10 sm:gap-4 sm:px-6 sm:py-6 lg:px-8">
      <header className="finance-responsive-header customer-page-header flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:pb-4">
        <div className="customer-heading flex min-w-0 items-start gap-3">
          <div className="customer-page-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 sm:h-11 sm:w-11">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="customer-page-eyebrow mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em]">Finance operations</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Financial Control</h1>
            <p className="mt-0.5 text-sm leading-5 text-slate-600 dark:text-slate-400">Monitor balances, reconciliation, and accounting integrity.</p>
          </div>
        </div>
      </header>

      <section aria-label="Financial overview" className="space-y-2">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Metric label="Business balance" value={formatCurrency(totalBalance, currency)} icon={Wallet} />
          <Metric label="Money in · MTD" value={formatCurrency(periodLedger.moneyIn, currency)} icon={ArrowDownLeft} tone="good" />
          <Metric label="Money out · MTD" value={formatCurrency(periodLedger.moneyOut, currency)} icon={ArrowDownRight} tone="warn" />
          <Metric label="Net cash flow · MTD" value={formatCurrency(periodLedger.netCashFlow, currency)} icon={CircleDollarSign} tone={periodLedger.netCashFlow >= 0 ? 'good' : 'warn'} />
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
          <Metric compact label="Receivable" value={formatCurrency(aging.total, currency)} icon={CircleDollarSign} tone="warn" />
          <Metric compact label="Errors" value={errors.length} icon={CircleAlert} tone={errors.length ? 'warn' : 'good'} />
          <Metric compact label="Period" value={periodLabel} icon={CalendarClock} tone={activePeriod ? 'warn' : 'good'} />
        </div>
      </section>

      <section className={`${cardClass} space-y-3`} aria-labelledby="financial-accounts-heading">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="financial-accounts-heading" className="section-title">Account Balances &amp; Reconciliation</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Opening balance plus posted movements; sales are not account movements.</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{financialAccounts.length} accounts</span></div>
        {!financialAccounts.length ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">No financial accounts yet. Create one in Cashbook to begin tracking balances.</p> : (
          <div className="space-y-3">
            {financialAccounts.map(account => {
              const systemBalance = getAccountingLedgerBalance(account, ledger);
              const latest = latestReconciliationByAccount.get(account.id);
              return <article key={account.id} className="financial-control-account rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-violet-200 dark:border-slate-700 dark:bg-[#151C28] dark:hover:border-violet-900 sm:p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><h3 className="truncate font-semibold text-slate-950 dark:text-white">{account.name}</h3><p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{account.type.replace('_', ' ')} · {account.currency}<span className="hidden sm:inline"> · Opening {formatCurrency(account.openingBalance, account.currency)} from {formatAppDate(account.openingBalanceDate)}</span></p><p className="mt-0.5 text-xs text-slate-500 sm:hidden">Opening {formatCurrency(account.openingBalance, account.currency)} · {formatAppDate(account.openingBalanceDate)}</p></div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <div className="min-w-0 sm:text-right"><p className="font-mono text-lg font-bold tabular-nums tracking-tight text-slate-950 dark:text-white">{formatCurrency(systemBalance, account.currency)}</p><p className={`text-[11px] ${latest?.status === 'difference' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{latest ? `${latest.status === 'matched' ? 'Last reconciled' : 'Difference'} · ${formatAppDate(latest.reconciliationDate)}${latest.status === 'difference' ? ` · ${formatCurrency(latest.difference, account.currency)}` : ''}` : 'Not reconciled'}</p></div>
                    <div className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => setSelectedAccountId(account.id)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">View ledger</button>
                    <button type="button" onClick={() => beginReconciliation(account)} className="customer-primary-action min-h-10 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">Reconcile</button>
                  </div>
                  </div>
                </div>
                {reconcilingAccountId === account.id && <form onSubmit={submitReconciliation} className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
                  <div><label className={labelClass} htmlFor={`system-${account.id}`}>System Balance</label><input id={`system-${account.id}`} className={inputClass} disabled value={formatCurrency(systemBalance, account.currency)} /></div>
                  <div><label className={labelClass} htmlFor={`actual-${account.id}`}>Actual Balance</label><input id={`actual-${account.id}`} className={inputClass} type="number" step="any" required value={actualBalance} onChange={event => setActualBalance(event.target.value)} /></div>
                  <div><label className={labelClass} htmlFor={`date-${account.id}`}>Reconciliation Date</label><input id={`date-${account.id}`} className={inputClass} type="date" required value={reconciliationDate} onChange={event => setReconciliationDate(event.target.value)} /></div>
                  <div><label className={labelClass} htmlFor={`note-${account.id}`}>Note</label><input id={`note-${account.id}`} className={inputClass} value={reconciliationNote} onChange={event => setReconciliationNote(event.target.value)} /></div>
                  <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4"><button type="button" onClick={() => setReconcilingAccountId('')} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700">Cancel</button><button type="submit" className="customer-primary-action min-h-10 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white">Save Reconciliation</button></div>
                </form>}
              </article>;
            })}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Reconciliation History</h3>
          <button type="button" onClick={() => {
            const content = [
              ['Date', 'Account', 'System Balance', 'Actual Balance', 'Difference', 'Status', 'Note'],
              ...reconciliationHistory.map(item => [
                item.reconciliationDate,
                financialAccounts.find(account => account.id === item.accountId)?.name || item.accountId,
                item.systemBalance,
                item.actualBalance,
                item.difference,
                item.status,
                item.note || '',
              ]),
            ].map(row => row.map(value => csvCell(value)).join(',')).join('\r\n');
            downloadCSV('reconciliation-history.csv', content);
          }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Export CSV</button>
        </div>
        <div className="financial-control-history-desktop hidden max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Account</th><th className="px-3 py-2 text-right">System</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Difference</th><th className="px-3 py-2">Status / Note</th></tr></thead>
            <tbody>{reconciliationHistory.map(item => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2.5">{formatAppDate(item.reconciliationDate)}</td><td className="px-3 py-2.5">{financialAccounts.find(account => account.id === item.accountId)?.name || 'Account unavailable'}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(item.systemBalance, financialAccounts.find(account => account.id === item.accountId)?.currency || currency)}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(item.actualBalance, financialAccounts.find(account => account.id === item.accountId)?.currency || currency)}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(item.difference, financialAccounts.find(account => account.id === item.accountId)?.currency || currency)}</td><td className="px-3 py-2.5"><span className="font-semibold uppercase">{item.status}</span>{item.note && <span className="block text-[10px] text-slate-400">{item.note}</span>}</td></tr>)}
              {!reconciliationHistory.length && <tr><td colSpan={6} className="px-3 py-7 text-center text-slate-500">No reconciliation history recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="financial-control-history-mobile space-y-2 md:hidden">
          {reconciliationHistory.map(item => {
            const account = financialAccounts.find(accountItem => accountItem.id === item.accountId);
            const itemCurrency = account?.currency || currency;
            return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{account?.name || 'Account unavailable'}</p><p className="mt-0.5 text-xs text-slate-500">{formatAppDate(item.reconciliationDate)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.status === 'matched' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>{item.status}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]"><div><p className="text-slate-500">System</p><p className="mt-0.5 font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(item.systemBalance, itemCurrency)}</p></div><div><p className="text-slate-500">Actual</p><p className="mt-0.5 font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(item.actualBalance, itemCurrency)}</p></div><div><p className="text-slate-500">Difference</p><p className="mt-0.5 font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(item.difference, itemCurrency)}</p></div></div>
              {item.note && <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">{item.note}</p>}
            </article>;
          })}
          {!reconciliationHistory.length && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500 dark:border-slate-700">No reconciliation history recorded.</p>}
        </div>
      </section>

      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <section className={`${cardClass} space-y-3`} aria-labelledby="receivables-heading">
          <div><h2 id="receivables-heading" className="text-base font-bold text-slate-900 dark:text-white">Receivables Aging</h2><p className="mt-1 text-xs text-slate-500">Outstanding amounts use linked sale payments, not raw payment totals. If an invoice due date is unavailable, sale date is used as the aging date.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[['Current', aging.current], ['1–7 Days', aging.days1To7], ['8–30 Days', aging.days8To30], ['31–60 Days', aging.days31To60], ['61–90 Days', aging.days61To90], ['90+ Days', aging.over90Days]].map(([label, amount]) => <div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(Number(amount), currency)}</p></div>)}
          </div>
          <div className="hidden max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-3 py-2">Customer / Invoice</th><th className="px-3 py-2">Due Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Due</th></tr></thead>
              <tbody>{aging.rows.map(row => <tr key={row.saleId} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{row.customerName}<span className="block text-[10px] text-slate-400">{row.invoiceNumber || row.saleId}</span></td><td className="px-3 py-2.5">{formatAppDate(row.dueDate)}</td><td className="px-3 py-2.5">{row.status === 'overdue' ? `Overdue · ${row.ageDays}d` : row.status}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(row.due, currency)}</td></tr>)}
                {!aging.rows.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No outstanding receivables.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {aging.rows.map(row => <article key={row.saleId} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.customerName}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{row.invoiceNumber || row.saleId}</p></div><p className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(row.due, currency)}</p></div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800"><span className="text-slate-500">Due {formatAppDate(row.dueDate)}</span><span className={`font-semibold ${row.status === 'overdue' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'}`}>{row.status === 'overdue' ? `Overdue · ${row.ageDays}d` : row.status}</span></div>
            </article>)}
            {!aging.rows.length && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500 dark:border-slate-700">No outstanding receivables.</p>}
          </div>
        </section>

        <section className={`${cardClass} space-y-3`} aria-labelledby="period-heading">
          <div><h2 id="period-heading" className="section-title">Financial Period</h2><p className="mt-1 text-xs text-slate-500">Period close is blocked by integrity errors or unresolved reconciliation differences.</p></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><p className="font-semibold text-slate-800 dark:text-slate-200">{monthStart} – {today} · {currentMonthClosed ? 'CLOSED' : 'OPEN'}</p><p className="mt-1 text-xs text-slate-500">{errors.length} blocking integrity errors · {warnings.length} warnings</p></div>
          {!currentMonthClosed && <div className="space-y-2"><label className={labelClass} htmlFor="period-close-note">Close note (optional)</label><input id="period-close-note" className={inputClass} value={periodNote} onChange={event => setPeriodNote(event.target.value)} /><button type="button" disabled={periodBusy} onClick={submitPeriodClose} className="customer-primary-action min-h-10 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{periodBusy ? 'Closing…' : 'Close Current Period'}</button></div>}
          <div className="max-h-64 space-y-2 overflow-auto">
            {financialPeriods.filter(period => period.businessId === currentBusiness?.businessId).sort((a, b) => b.startDate.localeCompare(a.startDate)).map(period => <div key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div><p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{period.startDate} – {period.endDate} · {period.status.toUpperCase()}</p>{period.closeNote && <p className="mt-1 text-[11px] text-slate-500">{period.closeNote}</p>}</div>{period.status === 'closed' && (reopeningPeriodId === period.id ? <form onSubmit={submitPeriodReopen} className="flex flex-wrap gap-2"><input aria-label="Reopen reason" required value={reopenReason} onChange={event => setReopenReason(event.target.value)} className="min-w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="Reason to reopen" /><button className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white">Confirm</button><button type="button" onClick={() => setReopeningPeriodId('')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700">Cancel</button></form> : <button type="button" onClick={() => setReopeningPeriodId(period.id)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:text-amber-300">Reopen</button>)}</div>)}
            {!financialPeriods.length && <p className="text-xs text-slate-500">No financial periods have been closed.</p>}
          </div>
        </section>
      </div>

      <section className={`${cardClass} space-y-3`} aria-labelledby="integrity-heading">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" /><div><h2 id="integrity-heading" className="section-title">Financial Integrity Check</h2><p className="mt-1 text-xs text-slate-500">{errors.length} errors · {warnings.length} warnings · {issues.filter(issue => issue.severity === 'INFO').length} information</p></div></div>
        {!issues.length ? <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />No integrity issues were detected in the checked records.</p> : <ul className="max-h-80 space-y-2 overflow-auto">{issues.map((issue, index) => <li key={`${issue.type}-${issue.entityId || index}`} className={`flex gap-2 rounded-lg p-3 text-xs ${issue.severity === 'ERROR' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'}`}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{issue.severity} · {issue.message}</p>{issue.entityId && <p className="mt-1 opacity-80">{issue.entityType}: {issue.entityId}</p>}{issue.suggestedFix && <p className="mt-1 opacity-80">{issue.suggestedFix}</p>}</div></li>)}</ul>}
      </section>

      <section className={`${cardClass} space-y-3`} aria-labelledby="ledger-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="ledger-heading" className="section-title">Account Ledger</h2>{selectedAccount && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{accountLedger.length} entries</span>}</div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Chronological balance includes opening funds and posted movements.</p></div><div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:gap-3"><label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:min-w-56 sm:flex-none">Financial account<select aria-label="Financial account ledger" value={selectedAccountId} onChange={event => setSelectedAccountId(event.target.value)} className={`${inputClass} mt-1 min-h-11`}><option value="">Select account</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>{selectedAccount && <button type="button" onClick={() => {
          const rows = [
            ['Date', 'Type', 'Reference', 'Description', 'Money In', 'Money Out', 'Balance'],
            ...accountLedger.map(entry => [
              entry.date,
              entry.type,
              entry.reference,
              entry.description,
              entry.direction === 'in' ? entry.amount : '',
              entry.direction === 'out' || entry.type === 'transfer' ? entry.amount : '',
              entry.runningBalance ?? '',
            ]),
          ];
          downloadCSV(`${selectedAccount.name.replace(/[^a-z0-9-]/gi, '-')}-ledger.csv`, rows.map(row => row.map(csvCell).join(',')).join('\r\n'));
        }} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Export Ledger CSV</button>}</div></div>
        {selectedAccount && <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">From<input type="date" aria-label="Ledger start date" className={`${inputClass} mt-1 min-h-11`} value={ledgerStart} onChange={event => setLedgerStart(event.target.value)} /></label><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">To<input type="date" aria-label="Ledger end date" className={`${inputClass} mt-1 min-h-11`} value={ledgerEnd} onChange={event => setLedgerEnd(event.target.value)} /></label><label className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-1">Search<input aria-label="Search account ledger" className={`${inputClass} mt-1 min-h-11`} placeholder="Reference, details, customer" value={ledgerSearch} onChange={event => setLedgerSearch(event.target.value)} /></label></div>
          <div className="hidden max-h-96 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block"><table className="w-full min-w-[700px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reference / Description</th><th className="px-3 py-2 text-right">Money In</th><th className="px-3 py-2 text-right">Money Out</th><th className="px-3 py-2 text-right">Balance</th></tr></thead><tbody>{accountLedger.map(entry => <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800"><td className="whitespace-nowrap px-3 py-2.5">{formatAppDate(entry.date)}</td><td className="px-3 py-2.5 capitalize">{entry.type.replace('_', ' ')}</td><td className="px-3 py-2.5">{entry.reference}<span className="block text-[10px] text-slate-400">{entry.description}</span></td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{entry.direction === 'in' ? formatCurrency(entry.amount, selectedAccount.currency) : '—'}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{entry.direction === 'out' || entry.type === 'transfer' ? formatCurrency(entry.amount, selectedAccount.currency) : '—'}</td><td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{entry.runningBalance === undefined ? '—' : formatCurrency(entry.runningBalance, selectedAccount.currency)}</td></tr>)}{!accountLedger.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No ledger movements match this filter.</td></tr>}</tbody></table></div>
          <div className="space-y-2 md:hidden">{accountLedger.map(entry => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{entry.description || entry.reference || entry.categoryName}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{formatAppDate(entry.date)} · {entry.type.replace('_', ' ')}</p></div><p className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{entry.runningBalance === undefined ? '—' : formatCurrency(entry.runningBalance, selectedAccount.currency)}</p></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800"><span className="text-emerald-700 dark:text-emerald-300">In: {entry.direction === 'in' ? formatCurrency(entry.amount, selectedAccount.currency) : '—'}</span><span className="text-rose-700 dark:text-rose-300">Out: {entry.direction === 'out' || entry.type === 'transfer' ? formatCurrency(entry.amount, selectedAccount.currency) : '—'}</span>{entry.reference && <span className="text-slate-500">Ref: {entry.reference}</span>}</div></article>)}{!accountLedger.length && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500 dark:border-slate-700">No ledger movements match this filter.</p>}</div>
        </>}
        {!selectedAccount && <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">Choose an account to view its detailed ledger.</p>}
      </section>

      <section className={`${cardClass} space-y-3`} aria-labelledby="adjustments-heading">
        <div><h2 id="adjustments-heading" className="section-title">Recent Adjustments & Reversals</h2><p className="mt-1 text-xs text-slate-500">Adjustments remain visible in the ledger and Activity History. Refunded payment movements appear as reversals in the ledger.</p></div>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Reason / Reference</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody>{recentAdjustments.map(item => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2.5">{formatAppDate(item.date)}</td><td className="px-3 py-2.5">{financialAccounts.find(account => account.id === item.accountId)?.name || 'Account unavailable'}</td><td className="px-3 py-2.5">{item.reason}{item.reference && <span className="block text-[10px] text-slate-400">{item.reference}</span>}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCurrency(item.amount, item.currency)}</td></tr>)}{!recentAdjustments.length && <tr><td colSpan={4} className="px-3 py-7 text-center text-slate-500">No adjustments recorded.</td></tr>}</tbody></table></div>
        <div className="space-y-2 md:hidden">{recentAdjustments.map(item => <article key={item.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.reason}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{formatAppDate(item.date)} · {financialAccounts.find(account => account.id === item.accountId)?.name || 'Account unavailable'}</p>{item.reference && <p className="mt-1 truncate text-[10px] text-slate-400">Ref: {item.reference}</p>}</div><p className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(item.amount, item.currency)}</p></article>)}{!recentAdjustments.length && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500 dark:border-slate-700">No adjustments recorded.</p>}</div>
      </section>

      <section className={`${cardClass} space-y-3`} aria-labelledby="daily-close-heading">
        <div><h2 id="daily-close-heading" className="section-title">Daily Closing</h2><p className="mt-1 text-xs text-slate-500">Internal transfers are excluded from business net cash flow and do not change total business balance.</p></div>
        {currentDailyClosing ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div><p className="font-semibold text-slate-900 dark:text-white">{currentDailyClosing.date} · {Math.abs(currentDailyClosing.difference) < 0.005 ? 'MATCHED' : `DIFFERENCE · ${formatCurrency(currentDailyClosing.difference, currency)}`}</p><p className="text-xs text-slate-500">Expected {formatCurrency(currentDailyClosing.expectedClosingBalance, currency)} · Actual {formatCurrency(currentDailyClosing.actualClosingBalance, currency)}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Closed</span></div> : <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Today’s financial day has not been closed.</div>}
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Opening</th><th className="px-3 py-2">Money In</th><th className="px-3 py-2">Money Out</th><th className="px-3 py-2">Transfers (in/out)</th><th className="px-3 py-2">Expected / Actual</th><th className="px-3 py-2">Difference</th></tr></thead><tbody>{dailyClosingHistory.map(item => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2.5">{formatAppDate(item.date)}</td><td className="px-3 py-2.5">{formatCurrency(item.openingBalance, item.currency)}</td><td className="px-3 py-2.5">{formatCurrency(item.totalMoneyIn, item.currency)}</td><td className="px-3 py-2.5">{formatCurrency(item.totalMoneyOut, item.currency)}</td><td className="px-3 py-2.5">{formatCurrency(item.transfersIn, item.currency)} / {formatCurrency(item.transfersOut, item.currency)}</td><td className="px-3 py-2.5">{formatCurrency(item.expectedClosingBalance, item.currency)} / {formatCurrency(item.actualClosingBalance, item.currency)}</td><td className="px-3 py-2.5 font-mono font-semibold">{formatCurrency(item.difference, item.currency)}</td></tr>)}{!dailyClosingHistory.length && <tr><td colSpan={7} className="px-3 py-7 text-center text-slate-500">No daily closings recorded.</td></tr>}</tbody></table></div>
        <div className="space-y-2 md:hidden">{dailyClosingHistory.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-white">{formatAppDate(item.date)}</p><p className={`text-xs font-bold tabular-nums ${Math.abs(item.difference) < 0.005 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{Math.abs(item.difference) < 0.005 ? 'Matched' : formatCurrency(item.difference, item.currency)}</p></div><div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800"><div><p className="text-slate-500">Opening</p><p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(item.openingBalance, item.currency)}</p></div><div><p className="text-slate-500">Expected / actual</p><p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(item.expectedClosingBalance, item.currency)} / {formatCurrency(item.actualClosingBalance, item.currency)}</p></div><div><p className="text-slate-500">Money in / out</p><p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(item.totalMoneyIn, item.currency)} / {formatCurrency(item.totalMoneyOut, item.currency)}</p></div><div><p className="text-slate-500">Transfers in / out</p><p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(item.transfersIn, item.currency)} / {formatCurrency(item.transfersOut, item.currency)}</p></div></div></article>)}{!dailyClosingHistory.length && <p className="rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500 dark:border-slate-700">No daily closings recorded.</p>}</div>
      </section>
    </div>
  );
};
