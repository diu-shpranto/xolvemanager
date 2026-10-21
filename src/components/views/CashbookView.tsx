import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, ArrowLeftRight, Download, Plus, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { convertReportCurrency } from '../../utils/reportMetrics';
import { formatAppDate, formatCurrency, getTodayDateString } from '../../utils/dateUtils';
import { getAccountBalance, getAccountLedger, getCashFlowSummary, getFinancialLedger } from '../../utils/financialLedger';
import { normalizePaymentMethods } from '../../utils/paymentMethods';
import { downloadCSV } from '../../utils/csvParser';
import type { FinancialAccount, FinancialAccountType } from '../../types';

type EntryKind = 'expense' | 'income' | 'transfer' | 'adjustment';
type ModalKind = EntryKind | 'account' | 'edit-account' | null;
export type CashbookAction = 'expense' | 'income' | 'transfer';

interface CashbookViewProps {
  focusAccountId?: string;
  initialAction?: CashbookAction;
  onTargetHandled?: () => void;
}

const inputClass = 'control-field w-full px-3 py-2.5 text-sm';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';
const cardClass = 'surface-card cashbook-card p-3 sm:p-4';
const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const CashbookView: React.FC<CashbookViewProps> = ({ focusAccountId, initialAction, onTargetHandled }) => {
  const { formatCurrency, formatDate: formatAppDate } = useAppFormatting();
  const {
    financialAccounts, payments, expenses, otherIncome, financialTransfers, financialAdjustments,
    sales, invoices, customers, settings, currency, addFinancialAccount, updateFinancialAccount,
    addExpense, addOtherIncome, addFinancialTransfer, addFinancialAdjustment,
  } = useApp();
  const today = getTodayDateString(settings.businessProfile?.timeZone);
  const { showToast } = useToast();
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [flowGrouping, setFlowGrouping] = useState<'daily' | 'monthly'>('daily');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<FinancialAccountType>('cash');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(today);
  const [accountCurrency, setAccountCurrency] = useState(currency);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [vendor, setVendor] = useState('');
  const [editingAccountId, setEditingAccountId] = useState('');

  const methods = useMemo(() => normalizePaymentMethods(settings.paymentPreferences?.methods), [settings.paymentPreferences?.methods]);
  const financialRecords = useMemo(() => ({
    accounts: financialAccounts, payments, expenses, income: otherIncome, transfers: financialTransfers,
    adjustments: financialAdjustments, paymentMethods: methods,
    expenseCategories: settings.financialPreferences?.expenseCategories || [],
    incomeCategories: settings.financialPreferences?.incomeCategories || [],
    sales, invoices, customers,
  }), [financialAccounts, payments, expenses, otherIncome, financialTransfers, financialAdjustments, methods, settings.financialPreferences, sales, invoices, customers]);
  const ledger = useMemo(() => getFinancialLedger(financialRecords), [financialRecords]);
  const enabledAccounts = financialAccounts.filter(account => account.enabled);
  const unresolvedPayments = useMemo(() => payments.filter(payment =>
    (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial' || payment.paymentStatus === 'refunded')
    && !ledger.some(entry => entry.paymentId === payment.id)
  ), [payments, ledger]);
  const activeAccount = financialAccounts.find(account => account.id === selectedAccountId);
  const period = fromDate || toDate
    ? { start: fromDate || '0000-01-01', end: toDate || '9999-12-31' }
    : undefined;
  const scopedLedger = useMemo(() => {
    const accountEntries = activeAccount
      ? getAccountLedger(activeAccount, getFinancialLedger(financialRecords, activeAccount.id), currency, period)
      : financialAccounts.flatMap(account =>
        getAccountLedger(account, getFinancialLedger(financialRecords, account.id), currency, period)
      );
    const needle = search.trim().toLocaleLowerCase();
    return accountEntries.filter(entry =>
      (!needle || [entry.description, entry.reference, entry.categoryName, entry.customerName || ''].some(value => value.toLocaleLowerCase().includes(needle)))
      && (selectedAccountId === 'all' || entry.accountId === selectedAccountId)
    ).sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
  }, [activeAccount, ledger, financialAccounts, financialRecords, currency, period, search, selectedAccountId]);
  const flow = getCashFlowSummary(ledger, currency, period);
  const flowRows = useMemo(() => {
    const rows = activeAccount ? getFinancialLedger(financialRecords, activeAccount.id) : ledger;
    const buckets = new Map<string, typeof rows>();
    rows.filter(entry => entry.type !== 'opening_balance'
      && (!period || (entry.date >= period.start && entry.date <= period.end))
    ).forEach(entry => {
      const key = flowGrouping === 'monthly' ? entry.date.slice(0, 7) : entry.date;
      buckets.set(key, [...(buckets.get(key) || []), entry]);
    });
    return [...buckets.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([periodKey, entries]) => ({
      period: periodKey,
      ...getCashFlowSummary(entries, currency),
    }));
  }, [activeAccount, financialRecords, ledger, period, flowGrouping, currency]);
  const totalBalance = financialAccounts.reduce((sum, account) =>
    sum + getAccountBalance(account, getFinancialLedger(financialRecords, account.id), currency), 0);

  const openModal = (kind: ModalKind) => {
    setModalKind(kind);
    setDate(today);
    setAccountId(enabledAccounts[0]?.id || '');
    setToAccountId(enabledAccounts.find(account =>
      account.id !== enabledAccounts[0]?.id && account.currency === enabledAccounts[0]?.currency
    )?.id || '');
    setCategoryId(kind === 'expense'
      ? settings.financialPreferences?.expenseCategories?.find(item => item.enabled)?.id || ''
      : settings.financialPreferences?.incomeCategories?.find(item => item.enabled)?.id || '');
    setAmount('');
    setDescription('');
    setReference('');
    setVendor('');
  };

  useEffect(() => {
    if (focusAccountId && financialAccounts.some(account => account.id === focusAccountId)) {
      setSelectedAccountId(focusAccountId);
      onTargetHandled?.();
    }
  }, [focusAccountId, financialAccounts, onTargetHandled]);

  useEffect(() => {
    if (!initialAction) return;
    openModal(initialAction);
    onTargetHandled?.();
  }, [initialAction]);

  const openEditAccount = (account: FinancialAccount) => {
    setEditingAccountId(account.id);
    setAccountName(account.name);
    setAccountIdentifier(account.identifier || '');
    setModalKind('edit-account');
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const numericAmount = Number(amount);
      const chosenAccount = financialAccounts.find(item => item.id === accountId);
      if (modalKind === 'account') {
        if (!accountName.trim()) throw new Error('Enter an account name.');
        addFinancialAccount({
          name: accountName.trim(), type: accountType, identifier: accountIdentifier.trim() || undefined,
          currency: accountCurrency, openingBalance: Number(openingBalance), openingBalanceDate,
          enabled: true, sortOrder: financialAccounts.length,
        });
        setAccountName('');
        setAccountIdentifier('');
        setOpeningBalance('0');
        showToast('Financial account created.', 'success');
      } else if (modalKind === 'edit-account') {
        if (!editingAccountId || !accountName.trim()) throw new Error('Enter an account name.');
        updateFinancialAccount(editingAccountId, { name: accountName.trim(), identifier: accountIdentifier.trim() || undefined });
        showToast('Financial account updated.', 'success');
      } else if (!chosenAccount) {
        throw new Error('Create or select an active financial account.');
      } else if (modalKind === 'expense') {
        addExpense({
          accountId, categoryId, amount: numericAmount, currency: chosenAccount.currency, date,
          description: description.trim(), vendor: vendor.trim() || undefined, reference: reference.trim() || undefined,
        });
        showToast('Expense recorded.', 'success');
      } else if (modalKind === 'income') {
        addOtherIncome({
          accountId, categoryId, amount: numericAmount, currency: chosenAccount.currency, date,
          description: description.trim(), reference: reference.trim() || undefined,
        });
        showToast('Other income recorded.', 'success');
      } else if (modalKind === 'transfer') {
        const destination = financialAccounts.find(item => item.id === toAccountId);
        if (!destination) throw new Error('Select a destination account.');
        if (destination.currency !== chosenAccount.currency) throw new Error('Transfers currently require both accounts to use the same currency.');
        addFinancialTransfer({
          fromAccountId: accountId, toAccountId, amount: numericAmount, currency: chosenAccount.currency,
          date, reference: reference.trim() || undefined,
        });
        showToast('Transfer recorded. Transfers are excluded from income and expense totals.', 'success');
      } else if (modalKind === 'adjustment') {
        if (!description.trim()) throw new Error('Enter a reconciliation reason.');
        addFinancialAdjustment({
          accountId, amount: numericAmount, currency: chosenAccount.currency,
          date, reason: description.trim(),
        });
        showToast('Balance adjustment recorded.', 'success');
      }
      setModalKind(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this entry.', 'error');
    }
  };

  const exportLedger = () => {
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Category', 'Account', 'Direction', 'Amount', 'Currency', 'Running balance'];
    const rows = scopedLedger.map(entry => [
      entry.date, entry.type, entry.reference, entry.description, entry.categoryName,
      financialAccounts.find(account => account.id === entry.accountId)?.name || '',
      entry.direction, entry.amount, entry.currency, entry.runningBalance ?? '',
    ]);
    downloadCSV('cashbook-ledger.csv', [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'));
  };

  const showEntryModal = modalKind !== null;
  const expenseCategories = settings.financialPreferences?.expenseCategories?.filter(item => item.enabled) || [];
  const incomeCategories = settings.financialPreferences?.incomeCategories?.filter(item => item.enabled) || [];

  return (
    <div className="cashbook-view finance-responsive-page section-layout-shell customer-list-page mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-3 pb-10 sm:gap-4 sm:px-6 sm:py-6 lg:px-8">
      <header className="finance-responsive-header customer-page-header cashbook-page-header flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-nowrap sm:gap-4 sm:pb-4">
        <div className="customer-heading flex min-w-0 flex-1 items-start gap-3">
          <div className="customer-page-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 sm:h-11 sm:w-11">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="customer-page-eyebrow mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Finance operations</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Cashbook</h1>
            <p className="mt-0.5 max-w-[28rem] text-sm leading-5 text-slate-600 dark:text-slate-400">Track account balances, money in &amp; out.</p>
          </div>
        </div>
        <div className="finance-responsive-actions customer-header-actions cashbook-header-actions flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={exportLedger} aria-label="Export cashbook CSV" title="Export CSV" className="cashbook-header-action inline-flex h-11 min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-0 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto sm:px-3"><Download size={16} /><span className="hidden sm:inline">Export CSV</span></button>
          <button type="button" onClick={() => openModal('account')} aria-label="Add financial account" title="Add account" className="cashbook-header-action inline-flex h-11 min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-0 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto sm:px-3"><Plus size={16} /><span className="hidden sm:inline">Add account</span></button>
          <button type="button" onClick={() => openModal('expense')} disabled={!enabledAccounts.length} aria-label="Record expense" title="Record expense" className="customer-primary-action cashbook-header-action inline-flex h-11 min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-lg bg-violet-700 px-0 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3"><Plus size={16} /><span className="hidden sm:inline">Record expense</span></button>
        </div>
      </header>

      {unresolvedPayments.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {unresolvedPayments.length} received payment{unresolvedPayments.length === 1 ? '' : 's'} are not assigned to a financial account. Map payment methods under Settings → Payments to include them in balances.
        </div>
      )}

      <section className="cashbook-summary-grid grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" aria-label="Cashbook summary">
        <div className="cashbook-summary-card cashbook-summary-card--primary min-w-0 rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900/60 dark:bg-violet-950/25 sm:p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300"><Wallet size={15} className="text-violet-700 dark:text-violet-300" /> Business balance</div>
          <div className="mt-2 text-xl font-bold tabular-nums tracking-tight text-slate-950 dark:text-white sm:text-2xl">{formatCurrency(totalBalance, currency)}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Converted to {currency}</div>
        </div>
        <div className={`${cardClass} cashbook-summary-card`}><div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300"><ArrowDownLeft size={15} className="text-emerald-600" /> Money in</div><div className="mt-2 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 sm:text-2xl">{formatCurrency(flow.moneyIn, currency)}</div></div>
        <div className={`${cardClass} cashbook-summary-card`}><div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300"><ArrowDownRight size={15} className="text-rose-600" /> Money out</div><div className="mt-2 text-xl font-bold tabular-nums text-rose-700 dark:text-rose-300 sm:text-2xl">{formatCurrency(flow.moneyOut, currency)}</div></div>
        <div className={`${cardClass} cashbook-summary-card`}><div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300"><ArrowLeftRight size={15} className="text-violet-600" /> Net cash flow</div><div className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${flow.netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{formatCurrency(flow.netCashFlow, currency)}</div></div>
      </section>

      <section className="cashbook-account-grid grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4" aria-label="Financial accounts">
        {financialAccounts.map(account => {
          const balance = getAccountBalance(account, getFinancialLedger(financialRecords, account.id), currency);
          return (
          <div key={account.id} className={`cashbook-account-card ${cardClass} transition ${selectedAccountId === account.id ? 'border-violet-500 ring-2 ring-violet-500/20' : ''}`}>
            <button type="button" aria-pressed={selectedAccountId === account.id} onClick={() => setSelectedAccountId(selectedAccountId === account.id ? 'all' : account.id)} className="w-full text-left">
              <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Wallet size={17} className="shrink-0 text-violet-600" /><span className="truncate font-semibold text-slate-900 dark:text-white">{account.name}</span></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800">{account.type.replace('_', ' ')}</span></div>
              <div className="mt-3 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(balance, currency)}</div>
              <div className="mt-1 text-xs text-slate-500">{account.identifier || account.currency}{account.enabled ? '' : ' · Disabled'}</div>
            </button>
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <button type="button" onClick={() => openEditAccount(account)} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40">Edit</button>
              <button type="button" onClick={() => updateFinancialAccount(account.id, { enabled: !account.enabled })} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800">{account.enabled ? 'Disable' : 'Enable'}</button>
            </div>
          </div>
          );
        })}
        {financialAccounts.length === 0 && <div className="cashbook-empty-account flex min-w-0 items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-300 sm:col-span-2 xl:col-span-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Wallet size={18} /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">No financial accounts yet</p><p className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">Add an account with its opening balance to start tracking cash flow.</p></div><button type="button" onClick={() => openModal('account')} className="customer-primary-action inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-600"><Plus size={14} /> Add</button></div>}
      </section>

      <section className={`${cardClass} cashbook-ledger-section`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{activeAccount ? `${activeAccount.name} ledger` : 'Business ledger'}</h2><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{scopedLedger.length} entries</span></div><p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">Only recorded payments and adjustments change balances; sale totals are excluded.</p></div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => openModal('income')} disabled={!enabledAccounts.length} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200 dark:hover:bg-slate-800">Add income</button>
            <button type="button" onClick={() => openModal('transfer')} disabled={enabledAccounts.length < 2} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200 dark:hover:bg-slate-800">Transfer</button>
            <button type="button" onClick={() => openModal('adjustment')} disabled={!enabledAccounts.length} className="min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200 dark:hover:bg-slate-800">Reconcile</button>
          </div>
        </div>
        <div className="cashbook-ledger-filters mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-900/60 sm:grid-cols-4 lg:grid-cols-[1.15fr_0.8fr_0.8fr_1.25fr]">
          <select aria-label="Filter by financial account" className={inputClass} value={selectedAccountId} onChange={event => setSelectedAccountId(event.target.value)}><option value="all">All accounts</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
          <input className={inputClass} type="date" aria-label="From date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
          <input className={inputClass} type="date" aria-label="To date" value={toDate} onChange={event => setToDate(event.target.value)} />
          <input className={inputClass} type="search" aria-label="Search ledger" placeholder="Search entries..." value={search} onChange={event => setSearch(event.target.value)} />
          {(selectedAccountId !== 'all' || fromDate || toDate || search) && <button type="button" onClick={() => { setSelectedAccountId('all'); setFromDate(''); setToDate(''); setSearch(''); }} className="col-span-2 min-h-9 justify-self-start rounded-lg px-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-950/50 sm:col-span-4">Clear filters</button>}
        </div>
        <div className="cashbook-ledger-desktop hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Account</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Balance</th></tr></thead>
            <tbody>
              {scopedLedger.map(entry => {
                const isIn = entry.direction === 'in';
                const amountDisplay = convertReportCurrency(entry.amount, entry.currency, currency);
                return <tr key={entry.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatAppDate(entry.date)}</td>
                  <td className="px-3 py-3"><div className="font-medium text-slate-900 dark:text-white">{entry.description || entry.categoryName}</div><div className="text-xs text-slate-500">{entry.reference} · {entry.categoryName}{entry.customerName ? ` · ${entry.customerName}` : ''}</div></td>
                  <td className="px-3 py-3 capitalize text-slate-600 dark:text-slate-300">{entry.type.replace('_', ' ')}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{financialAccounts.find(account => account.id === entry.accountId)?.name || '—'}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${entry.direction === 'transfer' ? 'text-sky-600' : isIn ? 'text-emerald-600' : 'text-rose-600'}`}>{entry.direction === 'transfer' ? '' : isIn ? '+' : '−'}{formatCurrency(amountDisplay, currency)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700 dark:text-slate-200">{entry.runningBalance === undefined ? '—' : formatCurrency(entry.runningBalance, currency)}</td>
                </tr>;
              })}
              {scopedLedger.length === 0 && <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-500">No cashbook entries match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="cashbook-ledger-mobile space-y-2 md:hidden">
          {scopedLedger.map(entry => {
            const isIn = entry.direction === 'in';
            const amountDisplay = convertReportCurrency(entry.amount, entry.currency, currency);
            const accountName = financialAccounts.find(account => account.id === entry.accountId)?.name || '—';
            return <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{entry.description || entry.categoryName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{formatAppDate(entry.date)} · {entry.categoryName}{entry.customerName ? ` · ${entry.customerName}` : ''}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold tabular-nums ${entry.direction === 'transfer' ? 'text-sky-600' : isIn ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{entry.direction === 'transfer' ? '' : isIn ? '+' : '−'}{formatCurrency(amountDisplay, currency)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="capitalize">{entry.type.replace('_', ' ')} · {accountName}</span>
                <span>Balance: {entry.runningBalance === undefined ? '—' : formatCurrency(entry.runningBalance, currency)}</span>
              </div>
              {entry.reference && <p className="mt-1 truncate text-[10px] text-slate-400">Ref: {entry.reference}</p>}
            </article>;
          })}
          {scopedLedger.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No cashbook entries match these filters.</div>}
        </div>
      </section>

      <section className={`${cardClass} cashbook-flow-section`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{flowGrouping === 'daily' ? 'Daily' : 'Monthly'} cash flow</h2><p className="mt-1 text-xs text-slate-500">Transfers and opening balances are excluded.</p></div>
          <select className={inputClass} value={flowGrouping} onChange={event => setFlowGrouping(event.target.value as 'daily' | 'monthly')} aria-label="Cash flow grouping"><option value="daily">Daily</option><option value="monthly">Monthly</option></select>
        </div>
        <div className="cashbook-flow-desktop hidden overflow-x-auto md:block">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-3 py-3">Period</th><th className="px-3 py-3 text-right">Money in</th><th className="px-3 py-3 text-right">Money out</th><th className="px-3 py-3 text-right">Net flow</th></tr></thead>
            <tbody>{flowRows.map(row => <tr key={row.period} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70"><td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">{row.period}</td><td className="px-3 py-3 text-right text-emerald-600">{formatCurrency(row.moneyIn, currency)}</td><td className="px-3 py-3 text-right text-rose-600">{formatCurrency(row.moneyOut, currency)}</td><td className={`px-3 py-3 text-right font-semibold ${row.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(row.netCashFlow, currency)}</td></tr>)}
            {flowRows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">No cash flow for this period.</td></tr>}</tbody>
          </table>
        </div>
        <div className="cashbook-flow-mobile space-y-2 md:hidden">
          {flowRows.map(row => <article key={row.period} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#151C28]">
            <div className="mb-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-950 dark:border-slate-800 dark:text-white">{row.period}</div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div><p className="text-slate-500">Money in</p><p className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(row.moneyIn, currency)}</p></div>
              <div><p className="text-slate-500">Money out</p><p className="mt-1 font-semibold tabular-nums text-rose-700 dark:text-rose-300">{formatCurrency(row.moneyOut, currency)}</p></div>
              <div><p className="text-slate-500">Net flow</p><p className={`mt-1 font-semibold tabular-nums ${row.netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{formatCurrency(row.netCashFlow, currency)}</p></div>
            </div>
          </article>)}
          {flowRows.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No cash flow for this period.</div>}
        </div>
      </section>

      <Modal isOpen={showEntryModal} onClose={() => setModalKind(null)} title={modalKind === 'account' ? 'Add financial account' : modalKind === 'edit-account' ? 'Edit financial account' : modalKind === 'expense' ? 'Record expense' : modalKind === 'income' ? 'Record other income' : modalKind === 'transfer' ? 'Transfer between accounts' : 'Reconcile account balance'} subtitle="This record is stored locally and included in business backups." maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          {modalKind === 'account' || modalKind === 'edit-account' ? <>
            <label className="block"><span className={labelClass}>Account name</span><input className={inputClass} value={accountName} onChange={event => setAccountName(event.target.value)} required maxLength={80} /></label>
            {modalKind === 'account' && <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className={labelClass}>Type</span><select className={inputClass} value={accountType} onChange={event => setAccountType(event.target.value as FinancialAccountType)}><option value="cash">Cash</option><option value="mobile_banking">Mobile banking</option><option value="bank">Bank</option><option value="card">Card</option><option value="other">Other</option></select></label><label className="block"><span className={labelClass}>Currency</span><select className={inputClass} value={accountCurrency} onChange={event => setAccountCurrency(event.target.value as typeof currency)}><option value="BDT">BDT</option><option value="USD">USD</option></select></label></div>}
            <label className="block"><span className={labelClass}>Account reference (optional)</span><input className={inputClass} value={accountIdentifier} onChange={event => setAccountIdentifier(event.target.value)} maxLength={100} /></label>
            {modalKind === 'account' && <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className={labelClass}>Opening balance</span><input className={inputClass} type="number" step="0.01" value={openingBalance} onChange={event => setOpeningBalance(event.target.value)} required /></label><label className="block"><span className={labelClass}>Balance as of</span><input className={inputClass} type="date" value={openingBalanceDate} onChange={event => setOpeningBalanceDate(event.target.value)} required /></label></div>}
          </> : <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={labelClass}>{modalKind === 'transfer' ? 'From account' : 'Account'}</span><select className={inputClass} value={accountId} onChange={event => { const next = event.target.value; setAccountId(next); const chosen = financialAccounts.find(item => item.id === next); if (chosen) { setAccountCurrency(chosen.currency); const destination = enabledAccounts.find(item => item.id !== next && item.currency === chosen.currency); if (destination) setToAccountId(destination.id); } }} required>{enabledAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>
              {modalKind === 'transfer' && <label className="block"><span className={labelClass}>To account (same currency)</span><select className={inputClass} value={toAccountId} onChange={event => setToAccountId(event.target.value)} required>{enabledAccounts.filter(account => account.id !== accountId && account.currency === financialAccounts.find(item => item.id === accountId)?.currency).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
              {modalKind === 'expense' && <label className="block"><span className={labelClass}>Expense category</span><select className={inputClass} value={categoryId} onChange={event => setCategoryId(event.target.value)} required>{expenseCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
              {modalKind === 'income' && <label className="block"><span className={labelClass}>Income category</span><select className={inputClass} value={categoryId} onChange={event => setCategoryId(event.target.value)} required>{incomeCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
              <label className="block"><span className={labelClass}>Amount{modalKind === 'adjustment' ? ' (negative to subtract)' : ''}</span><input className={inputClass} type="number" min={modalKind === 'adjustment' ? undefined : 0.01} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
              <label className="block"><span className={labelClass}>Date</span><input className={inputClass} type="date" value={date} onChange={event => setDate(event.target.value)} required /></label>
            </div>
            {modalKind !== 'transfer' && <label className="block"><span className={labelClass}>{modalKind === 'adjustment' ? 'Reconciliation reason' : 'Description'}</span><input className={inputClass} value={description} onChange={event => setDescription(event.target.value)} maxLength={200} required /></label>}
            {modalKind === 'expense' && <label className="block"><span className={labelClass}>Vendor (optional)</span><input className={inputClass} value={vendor} onChange={event => setVendor(event.target.value)} maxLength={100} /></label>}
            {(modalKind === 'expense' || modalKind === 'income' || modalKind === 'transfer') && <label className="block"><span className={labelClass}>Reference (optional)</span><input className={inputClass} value={reference} onChange={event => setReference(event.target.value)} maxLength={100} /></label>}
            <p className="text-xs text-slate-500">Account currency: {financialAccounts.find(item => item.id === accountId)?.currency || currency}. Transfers do not count as income or expenses.</p>
          </>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => setModalKind(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button><button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{modalKind === 'account' ? 'Create account' : modalKind === 'edit-account' ? 'Save changes' : 'Save entry'}</button></div>
        </form>
      </Modal>
    </div>
  );
};
