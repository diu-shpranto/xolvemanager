import React, { useMemo, useState } from 'react';
import { Download, Eye, Pencil, Plus, Search, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import type { Expense } from '../../types';
import { formatAppDate, formatAppDateTime, formatCurrency, getTodayDateString } from '../../utils/dateUtils';
import { convertReportCurrency } from '../../utils/reportMetrics';
import { getAccountBalance, getFinancialLedger } from '../../utils/financialLedger';
import { normalizePaymentMethods } from '../../utils/paymentMethods';
import { downloadCSV } from '../../utils/csvParser';
import type { NavSection } from '../navigation/Sidebar';

interface ExpensesViewProps {
  onNavigate: (section: NavSection, targetId?: string) => void;
  createRequest?: number;
  onCreateRequestHandled?: () => void;
}

type ExpenseDraft = Pick<Expense,
  'accountId' | 'categoryId' | 'amount' | 'currency' | 'date' | 'description' | 'vendor' | 'reference' | 'notes'
>;

const cardClass = 'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';
const today = getTodayDateString();

const csvCell = (value: string | number): string => {
  const text = String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const expenseReference = (id: string): string => `EXP-${id.replace(/^expense[-_]?/i, '').slice(-8).toUpperCase()}`;

export const ExpensesView: React.FC<ExpensesViewProps> = ({ onNavigate, createRequest = 0, onCreateRequestHandled }) => {
  const {
    currentBusiness,
    financialAccounts,
    payments,
    expenses,
    otherIncome,
    financialTransfers,
    financialAdjustments,
    sales,
    invoices,
    customers,
    settings,
    currency,
    addExpense,
    updateExpense,
  } = useApp();
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'voided'>('posted');
  const [vendorFilter, setVendorFilter] = useState('');
  const [query, setQuery] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [maximumAmount, setMaximumAmount] = useState('');
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const inBusiness = <T extends { businessId?: string }>(records: T[]): T[] =>
    records.filter(record => !currentBusiness?.businessId || !record.businessId || record.businessId === currentBusiness.businessId);
  const scopedAccounts = useMemo(() => inBusiness(financialAccounts), [financialAccounts, currentBusiness?.businessId]);
  const scopedExpenses = useMemo(() => inBusiness(expenses), [expenses, currentBusiness?.businessId]);
  const scopedPayments = useMemo(() => inBusiness(payments), [payments, currentBusiness?.businessId]);
  const scopedIncome = useMemo(() => inBusiness(otherIncome), [otherIncome, currentBusiness?.businessId]);
  const scopedTransfers = useMemo(() => inBusiness(financialTransfers), [financialTransfers, currentBusiness?.businessId]);
  const scopedAdjustments = useMemo(() => inBusiness(financialAdjustments), [financialAdjustments, currentBusiness?.businessId]);
  const scopedSales = useMemo(() => inBusiness(sales), [sales, currentBusiness?.businessId]);
  const scopedInvoices = useMemo(() => inBusiness(invoices), [invoices, currentBusiness?.businessId]);
  const scopedCustomers = useMemo(() => inBusiness(customers), [customers, currentBusiness?.businessId]);
  const categories = settings.financialPreferences?.expenseCategories || [];
  const activeCategories = categories.filter(category => category.enabled).sort((left, right) => left.sortOrder - right.sortOrder);
  const accountById = useMemo(() => new Map(scopedAccounts.map(account => [account.id, account])), [scopedAccounts]);
  const expenseById = useMemo(() => new Map(scopedExpenses.map(expense => [expense.id, expense])), [scopedExpenses]);
  const ledger = useMemo(() => getFinancialLedger({
    accounts: scopedAccounts,
    payments: scopedPayments,
    expenses: scopedExpenses,
    income: scopedIncome,
    transfers: scopedTransfers,
    adjustments: scopedAdjustments,
    paymentMethods: normalizePaymentMethods(settings.paymentPreferences?.methods),
    expenseCategories: categories,
    incomeCategories: settings.financialPreferences?.incomeCategories || [],
    sales: scopedSales,
    invoices: scopedInvoices,
    customers: scopedCustomers,
  }), [
    scopedAccounts, scopedPayments, scopedExpenses, scopedIncome, scopedTransfers, scopedAdjustments,
    settings.paymentPreferences?.methods, categories, settings.financialPreferences?.incomeCategories,
    scopedSales, scopedInvoices, scopedCustomers,
  ]);
  const postedExpenses = useMemo(() => scopedExpenses.filter(expense => expense.status === 'posted'), [scopedExpenses]);
  const accountBalances = useMemo(() => new Map(scopedAccounts.map(account =>
    [account.id, getAccountBalance(account, ledger, account.currency)]
  )), [scopedAccounts, ledger]);

  const validDates = !fromDate || !toDate || fromDate <= toDate;
  const filteredExpenses = useMemo(() => {
    if (!validDates) return [];
    const needle = query.trim().toLocaleLowerCase();
    const vendorNeedle = vendorFilter.trim().toLocaleLowerCase();
    return [...scopedExpenses].filter(expense => {
      const category = categories.find(item => item.id === expense.categoryId)?.name || 'Uncategorized';
      const account = accountById.get(expense.accountId)?.name || 'Account unavailable';
      const statusMatches = statusFilter === 'all' || expense.status === statusFilter;
      const amount = convertReportCurrency(expense.amount, expense.currency, currency);
      return statusMatches
        && (accountFilter === 'all' || expense.accountId === accountFilter)
        && (categoryFilter === 'all' || expense.categoryId === categoryFilter)
        && (!fromDate || expense.date >= fromDate)
        && (!toDate || expense.date <= toDate)
        && (!vendorNeedle || (expense.vendor || '').toLocaleLowerCase().includes(vendorNeedle))
        && (!needle || [
          expenseReference(expense.id), expense.id, expense.description, expense.vendor || '',
          expense.reference || '', category, account,
        ].some(value => value.toLocaleLowerCase().includes(needle)))
        && (!minimumAmount || amount >= Number(minimumAmount))
        && (!maximumAmount || amount <= Number(maximumAmount));
    }).sort((left, right) => right.date.localeCompare(left.date)
      || (right.createdAt || '').localeCompare(left.createdAt || ''));
  }, [
    scopedExpenses, validDates, query, vendorFilter, statusFilter, accountFilter, categoryFilter,
    fromDate, toDate, minimumAmount, maximumAmount, currency, categories, accountById,
  ]);

  const totals = useMemo(() => {
    const amountFor = (items: Expense[]) => items.reduce((sum, item) =>
      sum + convertReportCurrency(item.amount, item.currency, currency), 0);
    const month = today.slice(0, 7);
    const largest = [...postedExpenses].sort((left, right) =>
      convertReportCurrency(right.amount, right.currency, currency)
      - convertReportCurrency(left.amount, left.currency, currency)
    )[0];
    return {
      total: amountFor(postedExpenses),
      today: amountFor(postedExpenses.filter(item => item.date === today)),
      month: amountFor(postedExpenses.filter(item => item.date.startsWith(month))),
      count: postedExpenses.length,
      largest: largest ? convertReportCurrency(largest.amount, largest.currency, currency) : 0,
      average: postedExpenses.length ? amountFor(postedExpenses) / postedExpenses.length : 0,
    };
  }, [postedExpenses, currency]);

  const startCreate = () => {
    setEditingExpense(null);
    setDraft({
      accountId: scopedAccounts.find(account => account.enabled)?.id || '',
      categoryId: activeCategories[0]?.id || '',
      amount: 0,
      currency: scopedAccounts.find(account => account.enabled)?.currency || currency,
      date: today,
      description: '',
      vendor: '',
      reference: '',
      notes: '',
    });
  };

  React.useEffect(() => {
    if (createRequest <= 0) return;
    startCreate();
    onCreateRequestHandled?.();
  }, [createRequest]);

  const saveExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const account = accountById.get(draft.accountId);
    if (!account || !account.enabled) {
      showToast('Choose an enabled financial account for this business.', 'error');
      return;
    }
    if (!activeCategories.some(category => category.id === draft.categoryId)) {
      showToast('Choose an enabled expense category in Settings.', 'error');
      return;
    }
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      showToast('Expense amount must be greater than zero.', 'error');
      return;
    }
    if (!draft.date || !Number.isFinite(new Date(`${draft.date}T00:00:00`).getTime())) {
      showToast('Enter a valid expense date.', 'error');
      return;
    }
    if (!draft.description.trim()) {
      showToast('Enter an expense description.', 'error');
      return;
    }
    try {
      const payload = {
        ...draft,
        amount: Number(draft.amount),
        currency: account.currency,
        description: draft.description.trim(),
        vendor: draft.vendor?.trim() || undefined,
        reference: draft.reference?.trim() || undefined,
        notes: draft.notes?.trim() || undefined,
      };
      if (editingExpense) {
        updateExpense(editingExpense.id, payload);
        showToast('Expense updated.', 'success');
      } else {
        addExpense(payload);
        showToast('Expense recorded.', 'success');
      }
      setDraft(null);
      setEditingExpense(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this expense.', 'error');
    }
  };

  const editExpense = (expense: Expense) => {
    if (expense.status !== 'posted') return;
    setSelectedExpense(null);
    setEditingExpense(expense);
    setDraft({
      accountId: expense.accountId,
      categoryId: expense.categoryId,
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      description: expense.description,
      vendor: expense.vendor || '',
      reference: expense.reference || '',
      notes: expense.notes || '',
    });
  };

  const voidExpense = () => {
    if (!voidTarget || !voidReason.trim()) {
      showToast('Enter a reason before voiding this expense.', 'error');
      return;
    }
    try {
      const note = `Voided: ${voidReason.trim()}`;
      updateExpense(voidTarget.id, {
        status: 'voided',
        notes: [voidTarget.notes, note].filter(Boolean).join('\n'),
      });
      showToast('Expense voided; the original record remains in history.', 'success');
      setVoidTarget(null);
      setVoidReason('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not void this expense.', 'error');
    }
  };

  const exportExpenses = () => {
    const rows = filteredExpenses.map(expense => [
      expenseReference(expense.id),
      expense.date,
      categories.find(category => category.id === expense.categoryId)?.name || 'Uncategorized',
      expense.description,
      accountById.get(expense.accountId)?.name || 'Account unavailable',
      expense.vendor || '',
      expense.amount,
      expense.currency,
      expense.reference || '',
      expense.status === 'posted' ? 'Recorded' : 'Voided',
    ]);
    const headers = ['Expense ID', 'Date', 'Category', 'Description', 'Account', 'Vendor', 'Amount', 'Currency', 'Reference', 'Status'];
    downloadCSV('expenses.csv', [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'));
  };

  const balanceAfter = (accountId: string, amount: number): number => {
    const account = accountById.get(accountId);
    if (!account) return 0;
    const existingCredit = editingExpense?.status === 'posted' && editingExpense.accountId === accountId
      ? editingExpense.amount : 0;
    return (accountBalances.get(accountId) || 0) + existingCredit - amount;
  };

  const displayStatus = (expense: Expense) => expense.status === 'voided' ? 'Voided' : 'Recorded';
  const formAccount = draft ? accountById.get(draft.accountId) : undefined;
  const projectedBalance = draft && formAccount ? balanceAfter(draft.accountId, Number(draft.amount) || 0) : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track business spending and outgoing money.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportExpenses} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Download className="h-4 w-4" />Export</button>
          <button type="button" onClick={startCreate} disabled={!scopedAccounts.some(account => account.enabled) || !activeCategories.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Add Expense</button>
        </div>
      </header>

      {(!scopedAccounts.some(account => account.enabled) || !activeCategories.length) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        {!scopedAccounts.some(account => account.enabled) ? 'Add an enabled financial account in Cashbook before recording expenses.' : 'Enable or add an expense category in Settings → Payments before recording expenses.'}
      </div>}

      <section aria-label="Expense summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total Expenses', formatCurrency(totals.total, currency)],
          ['Today', formatCurrency(totals.today, currency)],
          ['This Month', formatCurrency(totals.month, currency)],
          ['Number of Expenses', String(totals.count)],
          ['Largest Expense', formatCurrency(totals.largest, currency)],
          ['Average Expense', formatCurrency(totals.average, currency)],
        ].map(([label, value]) => <div key={label} className={`${cardClass} min-w-0`}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 truncate font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
        </div>)}
      </section>

      <section className={cardClass}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block sm:col-span-2 lg:col-span-1"><span className={labelClass}>Search expenses</span><Search className="absolute left-3 top-9 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-9`} value={query} onChange={event => setQuery(event.target.value)} placeholder="ID, description, vendor..." /></label>
          <label><span className={labelClass}>From date</span><input className={inputClass} type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
          <label><span className={labelClass}>To date</span><input className={inputClass} type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
          <label><span className={labelClass}>Account</span><select className={inputClass} value={accountFilter} onChange={event => setAccountFilter(event.target.value)}><option value="all">All accounts</option>{scopedAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label><span className={labelClass}>Category</span><select className={inputClass} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.enabled ? '' : ' (disabled)'}</option>)}</select></label>
          <label><span className={labelClass}>Vendor</span><input className={inputClass} value={vendorFilter} onChange={event => setVendorFilter(event.target.value)} placeholder="Filter by vendor" /></label>
          <label><span className={labelClass}>Status</span><select className={inputClass} value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option value="posted">Recorded</option><option value="voided">Voided</option><option value="all">All statuses</option></select></label>
          <div className="grid grid-cols-2 gap-2"><label><span className={labelClass}>Minimum</span><input className={inputClass} type="number" min="0" step="0.01" value={minimumAmount} onChange={event => setMinimumAmount(event.target.value)} /></label><label><span className={labelClass}>Maximum</span><input className={inputClass} type="number" min="0" step="0.01" value={maximumAmount} onChange={event => setMaximumAmount(event.target.value)} /></label></div>
        </div>
        {!validDates && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">End date must be on or after the start date.</p>}
      </section>

      <section className={`${cardClass} !p-0`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Expense records</h2><p className="mt-0.5 text-xs text-slate-500">{filteredExpenses.length} matching record{filteredExpenses.length === 1 ? '' : 's'}</p></div>
          <button type="button" onClick={() => onNavigate('cashbook')} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Open Cashbook</button>
        </div>
        {filteredExpenses.length === 0 ? <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{scopedExpenses.length ? 'No expenses match these filters.' : 'No expenses recorded.'}</p>
          <p className="mt-1 text-xs text-slate-500">Record business spending to track outgoing money and account balances.</p>
          <button type="button" disabled={!scopedAccounts.some(account => account.enabled) || !activeCategories.length} onClick={startCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Add Expense</button>
        </div> : <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="text-slate-500"><tr className="border-b border-slate-100 dark:border-slate-800">{['Expense ID', 'Date', 'Category', 'Description', 'Account', 'Vendor', 'Amount', 'Status', 'Actions'].map(label => <th key={label} scope="col" className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
              <tbody>{filteredExpenses.map(expense => <tr key={expense.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70">
                <td className="px-3 py-3 font-mono font-semibold">{expenseReference(expense.id)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatAppDate(expense.date)}</td>
                <td className="px-3 py-3">{categories.find(category => category.id === expense.categoryId)?.name || 'Uncategorized'}</td>
                <td className="max-w-56 truncate px-3 py-3" title={expense.description}>{expense.description}</td>
                <td className="px-3 py-3">{accountById.get(expense.accountId)?.name || 'Account unavailable'}</td>
                <td className="px-3 py-3">{expense.vendor || '—'}</td>
                <td className="px-3 py-3 font-mono font-semibold">{formatCurrency(expense.amount, expense.currency)}</td>
                <td className="px-3 py-3"><span>{displayStatus(expense)}</span></td>
                <td className="px-3 py-3"><div className="flex items-center gap-1">
                  <button type="button" aria-label={`View ${expenseReference(expense.id)}`} onClick={() => setSelectedExpense(expense)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-slate-800"><Eye className="h-4 w-4" /></button>
                  {expense.status === 'posted' && <>
                    <button type="button" aria-label={`Edit ${expenseReference(expense.id)}`} onClick={() => editExpense(expense)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Void ${expenseReference(expense.id)}`} onClick={() => setVoidTarget(expense)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 dark:hover:bg-rose-950/30"><XCircle className="h-4 w-4" /></button>
                  </>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 lg:hidden">{filteredExpenses.map(expense => <article key={expense.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{categories.find(category => category.id === expense.categoryId)?.name || 'Uncategorized'} · {displayStatus(expense)}</p><h3 className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{expense.description}</h3></div><p className="shrink-0 font-mono text-sm font-bold">{formatCurrency(expense.amount, expense.currency)}</p></div>
            <p className="mt-2 text-[11px] text-slate-500">{formatAppDate(expense.date)} · {accountById.get(expense.accountId)?.name || 'Account unavailable'}{expense.vendor ? ` · ${expense.vendor}` : ''}</p>
            <div className="mt-3 flex gap-2"><button type="button" onClick={() => setSelectedExpense(expense)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">View</button>{expense.status === 'posted' && <><button type="button" onClick={() => editExpense(expense)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Edit</button><button type="button" onClick={() => setVoidTarget(expense)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300">Void</button></>}</div>
          </article>)}</div>
        </>}
      </section>

      <Modal isOpen={Boolean(draft)} onClose={() => { setDraft(null); setEditingExpense(null); }} title={editingExpense ? 'Edit Expense' : 'Add Expense'} subtitle="Changes update the existing Cashbook ledger record.">
        {draft && <form className="space-y-4" onSubmit={saveExpense}>
          <label className="block"><span className={labelClass}>Expense Account *</span><select className={inputClass} value={draft.accountId} onChange={event => {
            const account = accountById.get(event.target.value);
            setDraft({ ...draft, accountId: event.target.value, currency: account?.currency || currency });
          }} required><option value="">Select account</option>{scopedAccounts.filter(account => account.enabled).map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>
          <label className="block"><span className={labelClass}>Category *</span><select className={inputClass} value={draft.categoryId} onChange={event => setDraft({ ...draft, categoryId: event.target.value })} required><option value="">Select category</option>{activeCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          {formAccount && projectedBalance !== undefined && <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
            <div><p className="text-slate-500">Current balance</p><p className="mt-1 font-mono font-semibold">{formatCurrency((accountBalances.get(formAccount.id) || 0) + (editingExpense?.status === 'posted' && editingExpense.accountId === formAccount.id ? editingExpense.amount : 0), formAccount.currency)}</p></div>
            <div><p className="text-slate-500">Expense amount</p><p className="mt-1 font-mono font-semibold">{formatCurrency(Number(draft.amount) || 0, formAccount.currency)}</p></div>
            <div><p className="text-slate-500">After expense</p><p className={`mt-1 font-mono font-semibold ${projectedBalance < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(projectedBalance, formAccount.currency)}</p></div>
          </div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Amount *</span><input className={inputClass} type="number" min="0.01" step="0.01" value={draft.amount || ''} onChange={event => setDraft({ ...draft, amount: Number(event.target.value), currency: formAccount?.currency || currency })} required /></label>
            <label><span className={labelClass}>Date *</span><input className={inputClass} type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} required /></label>
          </div>
          <label className="block"><span className={labelClass}>Description *</span><input className={inputClass} maxLength={200} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} required /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Vendor</span><input className={inputClass} maxLength={120} value={draft.vendor || ''} onChange={event => setDraft({ ...draft, vendor: event.target.value })} /></label>
            <label><span className={labelClass}>Reference</span><input className={inputClass} maxLength={120} value={draft.reference || ''} onChange={event => setDraft({ ...draft, reference: event.target.value })} /></label>
          </div>
          <label className="block"><span className={labelClass}>Notes</span><textarea className={inputClass} rows={3} maxLength={1000} value={draft.notes || ''} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => { setDraft(null); setEditingExpense(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Cancel</button><button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{editingExpense ? 'Save Changes' : 'Record Expense'}</button></div>
        </form>}
      </Modal>

      <Modal isOpen={Boolean(selectedExpense)} onClose={() => setSelectedExpense(null)} title="Expense Details" subtitle={selectedExpense ? expenseReference(selectedExpense.id) : undefined}>
        {selectedExpense && <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ['Date', formatAppDate(selectedExpense.date)],
              ['Category', categories.find(category => category.id === selectedExpense.categoryId)?.name || 'Uncategorized'],
              ['Description', selectedExpense.description],
              ['Account', accountById.get(selectedExpense.accountId)?.name || 'Account unavailable'],
              ['Amount', formatCurrency(selectedExpense.amount, selectedExpense.currency)],
              ['Vendor', selectedExpense.vendor || '—'],
              ['Reference', selectedExpense.reference || '—'],
              ['Status', displayStatus(selectedExpense)],
              ['Created At', formatAppDateTime(selectedExpense.createdAt)],
              ['Updated At', formatAppDateTime(selectedExpense.updatedAt)],
              ['Notes', selectedExpense.notes || '—'],
            ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</dd></div>)}
          </dl>
          <button type="button" onClick={() => onNavigate('cashbook', selectedExpense.accountId)} className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Account Ledger</button>
          {selectedExpense.status === 'posted' && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => editExpense(selectedExpense)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Edit</button><button type="button" onClick={() => { setVoidTarget(selectedExpense); setSelectedExpense(null); }} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300">Void Expense</button></div>}
        </div>}
      </Modal>

      <Modal isOpen={Boolean(voidTarget)} onClose={() => { setVoidTarget(null); setVoidReason(''); }} title="Void Expense" subtitle="The expense will remain in history but will no longer affect the Cashbook balance.">
        {voidTarget && <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">{expenseReference(voidTarget.id)} · {voidTarget.description} · {formatCurrency(voidTarget.amount, voidTarget.currency)}</p>
          <label className="block"><span className={labelClass}>Reason *</span><textarea className={inputClass} rows={3} value={voidReason} onChange={event => setVoidReason(event.target.value)} required /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => { setVoidTarget(null); setVoidReason(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Cancel</button><button type="button" onClick={voidExpense} disabled={!voidReason.trim()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Void Expense</button></div>
        </div>}
      </Modal>
    </div>
  );
};
