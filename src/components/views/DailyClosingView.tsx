import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { formatAppDate, formatCurrency, getDateInTimeZone } from '../../utils/dateUtils';
import { getDailyFinancialSummary, getFinancialLedger } from '../../utils/financialLedger';
import { normalizePaymentMethods } from '../../utils/paymentMethods';

const cardClass = 'surface-card p-4 sm:p-5';
const inputClass = 'control-field w-full px-3 py-2 text-sm';

export const DailyClosingView: React.FC<{ onNavigate: (section: 'cashbook') => void }> = ({ onNavigate }) => {
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

  return (
    <div className="page-container max-w-5xl space-y-5">
      <header className="page-header">
        <div className="page-header__copy">
          <h1 className="page-title">Daily Closing</h1>
          <p className="page-description">Compare each account’s expected balance with the amount counted at the end of the day.</p>
        </div>
      </header>

      {!financialAccounts.length ? (
        <section className={`${cardClass} text-center`}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Create a financial account before closing a day.</p>
          <button type="button" onClick={() => onNavigate('cashbook')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Open Cashbook <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <form onSubmit={submitClosing} className="space-y-5">
          <section className={`${cardClass} space-y-4`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="w-full max-w-xs text-xs font-semibold text-slate-600 dark:text-slate-300">
                Closing date
                <input type="date" aria-label="Daily closing date" max={today} value={date} onChange={event => setDate(event.target.value)} className={`${inputClass} mt-1`} required />
              </label>
              {existingClosing && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" />Closed</span>}
            </div>
            {existingClosing && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />This day is closed. Reopen it before making changes to the closing record.</span>
                <button type="button" onClick={reopenDay} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold hover:bg-white dark:border-emerald-800 dark:hover:bg-emerald-950">Reopen day</button>
              </div>
            )}
            <p className="text-xs text-slate-500">Internal transfers are shown per account but do not change the business-wide balance. A reason is required if an account has a difference.</p>
            <div className="space-y-3">
              {summary.accounts.map(account => (
                <div key={account.accountId} className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{account.accountName}</p>
                    <p className="mt-1 text-xs text-slate-500">Opening {formatCurrency(account.openingBalance, account.currency)} · In {formatCurrency(account.moneyIn, account.currency)} · Out {formatCurrency(account.moneyOut, account.currency)}</p>
                    {(account.transferIn !== 0 || account.transferOut !== 0) && <p className="mt-1 text-xs text-slate-500">Transfers in {formatCurrency(account.transferIn, account.currency)} · out {formatCurrency(account.transferOut, account.currency)}</p>}
                    <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">Expected {formatCurrency(account.expectedClosingBalance, account.currency)}</p>
                  </div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Actual closing balance
                    <input type="number" step="0.01" inputMode="decimal" aria-label={`Actual closing balance for ${account.accountName}`} value={actualBalances[account.accountId] ?? ''} onChange={event => setActualBalances(current => ({ ...current, [account.accountId]: event.target.value }))} className={`${inputClass} mt-1`} required />
                  </label>
                </div>
              ))}
            </div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Difference reason
              <textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} className={`${inputClass} mt-1 resize-y`} placeholder="Required when actual and expected balances differ" />
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={createAdjustments} onChange={event => setCreateAdjustments(event.target.checked)} className="mt-0.5 accent-emerald-600" />
              Create ledger adjustments for differences (this changes account balances)
            </label>
            <button type="submit" disabled={busy || Boolean(existingClosing) || !currentBusiness?.businessId} className="action-primary w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {busy ? 'Saving closing…' : existingClosing ? 'Day already closed' : 'Close Financial Day'}
            </button>
          </section>
        </form>
      )}

      <section className={`${cardClass} space-y-3`}>
        <div>
          <h2 className="section-title">Recent Closings</h2>
          <p className="mt-1 text-xs text-slate-500">Latest daily closing records for this business.</p>
        </div>
        {!history.length ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800/50">No daily closings recorded yet.</p> : (
          <div className="space-y-2">
            {history.map(closing => (
              <button key={closing.id} type="button" onClick={() => setDate(closing.date)} className="grid w-full gap-2 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:hover:bg-slate-800 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatAppDate(closing.date)} · {closing.status === 'closed' ? 'Closed' : 'Reopened'}</span>
                <span className="text-xs text-slate-500">Expected {formatCurrency(closing.expectedClosingBalance, closing.currency)}</span>
                <span className={`text-xs font-semibold ${Math.abs(closing.difference) < 0.005 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{Math.abs(closing.difference) < 0.005 ? 'Matched' : `Difference ${formatCurrency(closing.difference, closing.currency)}`}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
