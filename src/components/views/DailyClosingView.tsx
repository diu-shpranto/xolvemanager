import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft,
  ChevronRight, LockKeyhole, Scale, Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { StatCard } from '../common/StatCard';
import { formatAppDate, formatCurrency, getDateInTimeZone } from '../../utils/dateUtils';
import { getDailyFinancialSummary, getFinancialLedger } from '../../utils/financialLedger';
import { normalizePaymentMethods } from '../../utils/paymentMethods';

const addDays = (date: string, delta: number) => {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + delta * 86400000);
  return shifted.toISOString().slice(0, 10);
};

export const DailyClosingView: React.FC<{ onNavigate: (section: 'cashbook') => void }> = ({ onNavigate }) => {
  const { formatCurrency, formatDate: formatAppDate } = useAppFormatting();
  const {
    currentBusiness, financialAccounts, payments, expenses, otherIncome, financialTransfers,
    financialAdjustments, sales, invoices, customers, settings, currency, dailyClosings,
    closeFinancialDay, reopenFinancialDay,
  } = useApp();
  const { showToast } = useToast();
  const today = getDateInTimeZone(settings.businessProfile?.timeZone);
  const [date, setDate] = useState(today);
  const [actualBalances, setActualBalances] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [createAdjustments, setCreateAdjustments] = useState(false);
  const [busy, setBusy] = useState(false);

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
  const summary = useMemo(
    () => getDailyFinancialSummary(financialAccounts, ledger, date, currency),
    [financialAccounts, ledger, date, currency],
  );
  const existingClosing = dailyClosings.find(closing =>
    closing.businessId === currentBusiness?.businessId && closing.date === date && closing.status === 'closed'
  );
  const history = dailyClosings
    .filter(closing => closing.businessId === currentBusiness?.businessId)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 14);

  const totalDifference = useMemo(() => summary.accounts.reduce((total, account) => {
    const raw = actualBalances[account.accountId];
    const actual = raw === undefined || raw === '' ? account.expectedClosingBalance : Number(raw);
    return total + (Number.isNaN(actual) ? 0 : actual - account.expectedClosingBalance);
  }, 0), [summary.accounts, actualBalances]);
  const dayMatched = Math.abs(totalDifference) < 0.005;

  useEffect(() => {
    setActualBalances(Object.fromEntries(summary.accounts.map(account => {
      const previouslyClosed = existingClosing?.accounts.find(item => item.accountId === account.accountId);
      return [account.accountId, String(previouslyClosed?.actualClosingBalance ?? account.expectedClosingBalance)];
    })));
  }, [summary.accounts, existingClosing]);

  const submitClosing = (event: React.FormEvent) => {
    event.preventDefault();
    const balances = Object.fromEntries(Object.entries(actualBalances).map(([accountId, value]) => [accountId, Number(value)]));
    setBusy(true);
    try {
      const closing = closeFinancialDay(date, balances, reason, createAdjustments);
      showToast(`Daily closing saved for ${formatAppDate(closing.date)}.`, 'success');
      setReason('');
      setCreateAdjustments(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not close this financial day.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reopenDay = () => {
    if (!window.confirm(`Reopen ${formatAppDate(date)} for financial corrections?`)) return;
    try {
      reopenFinancialDay(date);
      showToast('Financial day reopened.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not reopen this financial day.', 'error');
    }
  };

  const shiftDay = (delta: number) => setDate(current => {
    const next = addDays(current, delta);
    return next > today ? today : next;
  });

  return (
    <div className="daily-closing-view finance-responsive-page section-layout-shell customer-list-page mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-3 pb-10 sm:gap-4 sm:px-6 sm:py-6 lg:px-8" data-section="daily-closing">
      <header className="dc-page-header--v2 finance-responsive-header customer-page-header flex min-w-0 items-center gap-3">
        <div className="customer-heading flex min-w-0 items-start gap-3">
          <div className="dc-page-icon customer-page-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"><LockKeyhole className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="customer-page-eyebrow mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em]">Finance operations</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Daily Totals</h1>
            <p className="mt-0.5 text-sm leading-5 text-slate-600 dark:text-slate-400">Compare expected account balances with the cash counted at day end.</p>
          </div>
        </div>
      </header>

      {!financialAccounts.length ? (
        <section className="dc-empty--v2 surface-card flex flex-col items-center p-3 text-center sm:p-4">
          <span className="dc-empty-icon flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Wallet className="h-5 w-5" /></span>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Create a financial account before closing a day.</p>
          <button type="button" onClick={() => onNavigate('cashbook')} className="dc-btn-primary customer-primary-action mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white">
            Open Cashbook <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Day summary">
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Opening balance"
              value={formatCurrency(summary.openingBalance, currency)}
              hint="All accounts at day start"
              tone="violet"
              valueClassName="text-xl sm:text-2xl"
            />
            <StatCard
              icon={<ArrowDownLeft className="h-5 w-5" />}
              label="Money in"
              value={formatCurrency(summary.totalMoneyIn, currency)}
              hint={`Received on ${formatAppDate(date)}`}
              tone="emerald"
              valueTone="emerald"
              valueClassName="text-xl sm:text-2xl"
            />
            <StatCard
              icon={<ArrowUpRight className="h-5 w-5" />}
              label="Money out"
              value={formatCurrency(summary.totalMoneyOut, currency)}
              hint={`Paid on ${formatAppDate(date)}`}
              tone="rose"
              valueTone="rose"
              valueClassName="text-xl sm:text-2xl"
            />
            <StatCard
              icon={<Scale className="h-5 w-5" />}
              label="Expected closing"
              value={formatCurrency(summary.expectedClosingBalance, currency)}
              hint="Opening + in − out"
              tone="violet"
              valueClassName="text-xl sm:text-2xl"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Day difference"
              value={dayMatched ? formatCurrency(0, currency) : formatCurrency(totalDifference, currency)}
              hint={dayMatched ? 'Counts match expected' : 'Counts differ from expected'}
              tone={dayMatched ? 'emerald' : 'amber'}
              valueTone={dayMatched ? 'emerald' : 'amber'}
              valueClassName="text-xl sm:text-2xl"
            />
          </section>

          <form onSubmit={submitClosing} className="space-y-3">
            <section className="dc-panel--v2 surface-card space-y-3 p-3 sm:p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="dc-date-row flex w-full max-w-md items-end gap-2">
                  <button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day" className="dc-date-nav dc-date-nav--prev"><ChevronLeft className="h-4 w-4" /></button>
                  <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Closing date
                    <input type="date" aria-label="Daily closing date" max={today} value={date} onChange={event => setDate(event.target.value)} className="dc-field control-field w-full px-3 py-2 text-sm" required />
                  </label>
                  <button type="button" onClick={() => shiftDay(1)} disabled={date >= today} aria-label="Next day" className="dc-date-nav dc-date-nav--next"><ChevronRight className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDate(today)} disabled={date === today} className="dc-today-btn">Today</button>
                </div>
                {existingClosing && <span className="dc-closed-pill inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" />Closed</span>}
              </div>
              {existingClosing && (
                <div role="status" className="dc-closed-banner flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm">
                  <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />This day is closed. Reopen it before making changes to the closing record.</span>
                  <button type="button" onClick={reopenDay} className="dc-reopen-btn rounded-lg px-3 py-1.5 text-xs font-semibold">Reopen day</button>
                </div>
              )}
              <p className="dc-note flex items-start gap-2 text-xs leading-5 text-slate-500"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />Internal transfers are shown per account but do not change the business-wide balance. A reason is required if an account has a difference.</p>
              <div className="space-y-3">
                {summary.accounts.map(account => {
                  const raw = actualBalances[account.accountId];
                  const parsed = raw === undefined || raw === '' ? null : Number(raw);
                  const difference = parsed === null || Number.isNaN(parsed) ? null : parsed - account.expectedClosingBalance;
                  const matched = difference !== null && Math.abs(difference) < 0.005;
                  return (
                    <div key={account.accountId} className="dc-account--v2">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="dc-account-icon"><Wallet className="h-4 w-4" /></span>
                          <p className="dc-account-name truncate text-sm font-semibold text-slate-900 dark:text-white">{account.accountName}</p>
                          <span className="dc-account-currency">{account.currency}</span>
                        </div>
                        <dl className="dc-account-stats">
                          <div><dt>Opening</dt><dd>{formatCurrency(account.openingBalance, account.currency)}</dd></div>
                          <div><dt>In</dt><dd className="dc-stat-in">{formatCurrency(account.moneyIn, account.currency)}</dd></div>
                          <div><dt>Out</dt><dd className="dc-stat-out">{formatCurrency(account.moneyOut, account.currency)}</dd></div>
                          <div><dt>Expected</dt><dd className="dc-stat-expected">{formatCurrency(account.expectedClosingBalance, account.currency)}</dd></div>
                        </dl>
                        {(account.transferIn !== 0 || account.transferOut !== 0) && <p className="dc-account-sub mt-1 text-xs text-slate-500">Transfers in {formatCurrency(account.transferIn, account.currency)} · out {formatCurrency(account.transferOut, account.currency)}</p>}
                        {account.adjustmentNet !== 0 && <p className="dc-account-sub mt-1 text-xs text-slate-500">Adjustments {formatCurrency(account.adjustmentNet, account.currency)}</p>}
                      </div>
                      <div className="dc-account-actual">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Actual closing balance
                          <input type="number" step="0.01" inputMode="decimal" aria-label={`Actual closing balance for ${account.accountName}`} value={actualBalances[account.accountId] ?? ''} onChange={event => setActualBalances(current => ({ ...current, [account.accountId]: event.target.value }))} className="dc-field control-field mt-1 w-full px-3 py-2 text-sm" required />
                        </label>
                        {difference !== null && (
                          <span className={`dc-diff-badge ${matched ? 'dc-diff-badge--matched' : 'dc-diff-badge--off'}`}>
                            {matched ? 'Matched' : `Difference ${formatCurrency(difference, account.currency)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Difference reason
                <textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} className="dc-field control-field mt-1 w-full resize-y px-3 py-2 text-sm" placeholder="Required when actual and expected balances differ" />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={createAdjustments} onChange={event => setCreateAdjustments(event.target.checked)} className="dc-check mt-0.5 accent-violet-600" />
                Create ledger adjustments for differences (this changes account balances)
              </label>
              <button type="submit" disabled={busy || Boolean(existingClosing) || !currentBusiness?.businessId} className="dc-btn-primary customer-primary-action min-h-11 w-full rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                {busy ? 'Saving closing…' : existingClosing ? 'Day already closed' : 'Close Financial Day'}
              </button>
            </section>
          </form>
        </>
      )}

      <section className="dc-history--v2 surface-card space-y-3 p-3 sm:p-4">
        <div className="dc-list-head flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="section-title">Recent Closings</h2>
            <p className="mt-1 text-xs text-slate-500">Latest daily closing records for this business.</p>
          </div>
          <span className="dc-history-count">{history.length} {history.length === 1 ? 'record' : 'records'}</span>
        </div>
        {!history.length ? <p className="dc-history-empty rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800/50">No daily closings recorded yet.</p> : (
          <>
            <div className="dc-history-table-wrap hidden sm:block">
              <table className="dc-history-table w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-right">Expected closing</th>
                    <th className="text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(closing => {
                    const matched = Math.abs(closing.difference) < 0.005;
                    return (
                      <tr key={closing.id}>
                        <td><button type="button" onClick={() => setDate(closing.date)} className="dc-history-date-btn">{formatAppDate(closing.date)}</button></td>
                        <td><span className={`dc-status-pill ${closing.status === 'closed' ? 'dc-status-pill--closed' : 'dc-status-pill--reopened'}`}>{closing.status === 'closed' ? 'Closed' : 'Reopened'}</span></td>
                        <td className="dc-history-amount text-right">{formatCurrency(closing.expectedClosingBalance, closing.currency)}</td>
                        <td className={`text-right font-semibold ${matched ? 'dc-diff--matched' : 'dc-diff--off'}`}>{matched ? 'Matched' : `Difference ${formatCurrency(closing.difference, closing.currency)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 sm:hidden">
              {history.map(closing => {
                const matched = Math.abs(closing.difference) < 0.005;
                return (
                  <button key={closing.id} type="button" onClick={() => setDate(closing.date)} className="dc-history-card--v2 grid w-full gap-2 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:hover:bg-slate-800">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatAppDate(closing.date)}</span>
                      <span className={`dc-status-pill ${closing.status === 'closed' ? 'dc-status-pill--closed' : 'dc-status-pill--reopened'}`}>{closing.status === 'closed' ? 'Closed' : 'Reopened'}</span>
                    </span>
                    <span className="text-xs text-slate-500">Expected {formatCurrency(closing.expectedClosingBalance, closing.currency)}</span>
                    <span className={`text-xs font-semibold ${matched ? 'dc-diff--matched' : 'dc-diff--off'}`}>{matched ? 'Matched' : `Difference ${formatCurrency(closing.difference, closing.currency)}`}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
