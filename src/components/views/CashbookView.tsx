import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ChevronDown, Download, Plus, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { StatCard } from '../common/StatCard';
import { Modal } from '../common/Modal';
import { convertReportCurrency } from '../../utils/reportMetrics';
import { formatAppDate, formatCurrency, getTodayDateString } from '../../utils/dateUtils';
import { getAccountBalance, getAccountLedger, getCashFlowSummary, getFinancialLedger } from '../../utils/financialLedger';
import { normalizePaymentMethods } from '../../utils/paymentMethods';
import { CASHBOOK_KIND_HELPER_LINES, getFirstCashbookFormErrorTarget, type CashbookFormErrorTarget } from '../../utils/cashbookFormHelpers';
import { downloadCSV } from '../../utils/csvParser';
import type { AppCurrency, FinancialAccount, FinancialAccountType } from '../../types';

type EntryKind = 'expense' | 'income' | 'transfer' | 'adjustment';
type ModalKind = EntryKind | 'account' | 'edit-account' | null;
export type CashbookAction = 'expense' | 'income' | 'transfer' | 'account';

interface CashbookViewProps {
  focusAccountId?: string;
  initialAction?: CashbookAction;
  initialCurrency?: AppCurrency;
  onTargetHandled?: () => void;
}

const inputClass = 'control-field w-full px-3 py-2.5 text-sm';
const cashbookFieldClass = (hasError: boolean) => `w-full min-h-11 rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:bg-slate-800 dark:text-white ${hasError ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`;
const cardClass = 'surface-card cashbook-card p-3 sm:p-4';
const FINANCIAL_ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  cash: 'ক্যাশ',
  mobile_banking: 'মোবাইল ব্যাংকিং',
  bank: 'ব্যাংক',
  card: 'কার্ড',
  other: 'অন্যান্য',
};

const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const CashbookView: React.FC<CashbookViewProps> = ({ focusAccountId, initialAction, initialCurrency, onTargetHandled }) => {
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const accountNameRef = useRef<HTMLInputElement>(null);
  const openingBalanceRef = useRef<HTMLInputElement>(null);
  const openingBalanceDateRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLSelectElement>(null);
  const toAccountRef = useRef<HTMLSelectElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

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
    && Number.isFinite(Number(payment.amount))
    && Number(payment.amount) > 0
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
  const periodHint = fromDate || toDate ? 'Selected period' : 'All time';
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

  const closeEntryModal = () => {
    setModalKind(null);
    setFormErrors({});
    setAdvancedOpen(false);
  };

  const openModal = (kind: ModalKind) => {
    setModalKind(kind);
    setFormErrors({});
    setAdvancedOpen(false);
    setEditingAccountId('');
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
    setAccountName('');
    setAccountType('cash');
    setAccountIdentifier('');
    setOpeningBalance('0');
    setOpeningBalanceDate(today);
  };

  useEffect(() => {
    if (focusAccountId && financialAccounts.some(account => account.id === focusAccountId)) {
      setSelectedAccountId(focusAccountId);
      onTargetHandled?.();
    }
  }, [focusAccountId, financialAccounts, onTargetHandled]);

  useEffect(() => {
    if (!initialAction) return;
    if (initialAction === 'account' && initialCurrency) setAccountCurrency(initialCurrency);
    openModal(initialAction);
    onTargetHandled?.();
  }, [initialAction, initialCurrency]);

  const openEditAccount = (account: FinancialAccount) => {
    setEditingAccountId(account.id);
    setAccountName(account.name);
    setAccountIdentifier(account.identifier || '');
    setFormErrors({});
    setAdvancedOpen(false);
    setModalKind('edit-account');
  };

  // Live preview: the chosen money account and its balance as typed.
  const chosenAccount = financialAccounts.find(item => item.id === accountId);
  const destinationAccount = financialAccounts.find(item => item.id === toAccountId);
  const editingAccount = modalKind === 'edit-account'
    ? financialAccounts.find(item => item.id === editingAccountId)
    : undefined;
  const chosenBalance = useMemo(() => chosenAccount
    ? getAccountBalance(chosenAccount, getFinancialLedger(financialRecords, chosenAccount.id), chosenAccount.currency)
    : null, [chosenAccount, financialRecords]);
  const destinationBalance = useMemo(() => destinationAccount
    ? getAccountBalance(destinationAccount, getFinancialLedger(financialRecords, destinationAccount.id), destinationAccount.currency)
    : null, [destinationAccount, financialRecords]);
  const parsedAmount = Number(amount);
  const hasValidAmount = amount.trim() !== '' && Number.isFinite(parsedAmount);
  const resultingBalance = chosenBalance !== null && hasValidAmount
    ? chosenBalance + (modalKind === 'expense' || modalKind === 'transfer' ? -parsedAmount : parsedAmount)
    : null;
  const destinationResultingBalance = destinationBalance !== null && hasValidAmount && modalKind === 'transfer'
    ? destinationBalance + parsedAmount
    : null;

  const getErrorTarget = (): CashbookFormErrorTarget | null => {
    if (!modalKind) return null;
    return getFirstCashbookFormErrorTarget({
      kind: modalKind,
      accountName,
      openingBalance,
      openingBalanceDate,
      hasAccount: Boolean(chosenAccount),
      hasDestination: Boolean(destinationAccount),
      sameCurrency: !destinationAccount || !chosenAccount || destinationAccount.currency === chosenAccount.currency,
      categoryId,
      amount,
      date,
      description,
    });
  };

  const validateCashbookForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const target = getErrorTarget();
    if (!target || !modalKind) return errors;
    if (target === 'accountName') {
      errors.accountName = 'টাকার অ্যাকাউন্ট (ওয়ালেট)-এর নাম দিন।';
    } else if (target === 'openingBalance') {
      errors.openingBalance = 'শুরুর ব্যালেন্স সঠিক সংখ্যায় দিন।';
    } else if (target === 'openingBalanceDate') {
      errors.openingBalanceDate = 'শুরুর ব্যালেন্সের তারিখ সঠিকভাবে দিন।';
    } else if (target === 'account') {
      errors.account = enabledAccounts.length === 0
        ? 'আগে একটি টাকার অ্যাকাউন্ট (ওয়ালেট) যোগ করুন।'
        : 'টাকার অ্যাকাউন্ট (ওয়ালেট) বাছুন।';
    } else if (target === 'toAccount') {
      errors.toAccount = !destinationAccount
        ? 'কোন টাকার অ্যাকাউন্টে (ওয়ালেটে) যাবে তা বাছুন।'
        : 'ট্রান্সফার করতে দুই টাকার অ্যাকাউন্টের (ওয়ালেটের) মুদ্রা একই হতে হবে।';
    } else if (target === 'category') {
      errors.category = modalKind === 'expense' ? 'খরচের খাত বাছুন।' : 'ইনকামের খাত বাছুন।';
    } else if (target === 'amount') {
      errors.amount = modalKind === 'adjustment'
        ? 'টাকার পরিমাণ সঠিক সংখ্যায় দিন।'
        : 'টাকার পরিমাণ সঠিকভাবে দিন (০-এর বেশি)।';
    } else if (target === 'date') {
      errors.date = 'তারিখ সঠিকভাবে দিন।';
    } else if (target === 'description') {
      errors.description = modalKind === 'adjustment' ? 'সমন্বয়ের কারণ লিখুন।' : 'বিবরণ লিখুন।';
    }
    return errors;
  };

  const jumpToFirstCashbookFormError = () => {
    const target = getErrorTarget();
    const ref = target === 'accountName' ? accountNameRef.current
      : target === 'openingBalance' ? openingBalanceRef.current
      : target === 'openingBalanceDate' ? openingBalanceDateRef.current
      : target === 'account' ? accountRef.current
      : target === 'toAccount' ? toAccountRef.current
      : target === 'category' ? categoryRef.current
      : target === 'amount' ? amountRef.current
      : target === 'date' ? dateRef.current
      : target === 'description' ? descriptionRef.current
      : null;
    ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ref?.focus({ preventScroll: true });
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const cashbookErrors = validateCashbookForm();
    if (Object.keys(cashbookErrors).length > 0) {
      setFormErrors(cashbookErrors);
      jumpToFirstCashbookFormError();
      return;
    }
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
      setFormErrors({});
      setAdvancedOpen(false);
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
  const activeCategoryName = modalKind === 'expense'
    ? expenseCategories.find(item => item.id === categoryId)?.name
    : modalKind === 'income'
      ? incomeCategories.find(item => item.id === categoryId)?.name
      : undefined;
  const previewTitle = modalKind === 'account'
    ? accountName.trim() || 'টাকার অ্যাকাউন্ট (ওয়ালেট)'
    : modalKind === 'edit-account'
      ? accountName.trim() || editingAccount?.name || 'টাকার অ্যাকাউন্ট (ওয়ালেট)'
      : hasValidAmount
        ? formatCurrency(parsedAmount, chosenAccount?.currency || currency)
        : 'টাকার পরিমাণ';
  const previewParts: string[] = [];
  if (modalKind === 'account') {
    previewParts.push(FINANCIAL_ACCOUNT_TYPE_LABELS[accountType], accountCurrency);
    if (openingBalance.trim() !== '' && Number.isFinite(Number(openingBalance))) {
      previewParts.push(`শুরুর ব্যালেন্স ${formatCurrency(Number(openingBalance), accountCurrency)}`);
    }
  } else if (modalKind === 'edit-account') {
    if (editingAccount) {
      previewParts.push(FINANCIAL_ACCOUNT_TYPE_LABELS[editingAccount.type], editingAccount.currency);
    }
    if (accountIdentifier.trim()) previewParts.push(accountIdentifier.trim());
  } else if (modalKind === 'transfer') {
    previewParts.push(`${chosenAccount?.name || '—'} → ${destinationAccount?.name || '—'}`);
    if (resultingBalance !== null && chosenAccount) {
      previewParts.push(`ব্যালেন্স হবে: ${formatCurrency(resultingBalance, chosenAccount.currency)}`);
    }
    if (destinationResultingBalance !== null && destinationAccount) {
      previewParts.push(`গন্তব্যের ব্যালেন্স হবে: ${formatCurrency(destinationResultingBalance, destinationAccount.currency)}`);
    }
  } else {
    if (chosenAccount) previewParts.push(chosenAccount.name);
    if (activeCategoryName) previewParts.push(activeCategoryName);
    if (resultingBalance !== null && chosenAccount) {
      previewParts.push(`ব্যালেন্স হবে: ${formatCurrency(resultingBalance, chosenAccount.currency)}`);
    }
  }
  const previewSubtitle = previewParts.join(' · ');
  const modalTitle = modalKind === 'account' ? 'টাকার অ্যাকাউন্ট (ওয়ালেট) যোগ করুন'
    : modalKind === 'edit-account' ? 'টাকার অ্যাকাউন্ট (ওয়ালেট) সম্পাদনা'
    : modalKind === 'expense' ? 'খরচ লিখুন'
    : modalKind === 'income' ? 'ইনকাম লিখুন'
    : modalKind === 'transfer' ? 'ট্রান্সফার করুন'
    : 'ব্যালেন্স সমন্বয় করুন';
  const submitLabel = modalKind === 'account' ? 'টাকার অ্যাকাউন্ট (ওয়ালেট) তৈরি করুন'
    : modalKind === 'edit-account' ? 'পরিবর্তন সংরক্ষণ করুন'
    : modalKind === 'expense' ? 'খরচ সংরক্ষণ করুন'
    : modalKind === 'income' ? 'ইনকাম সংরক্ষণ করুন'
    : modalKind === 'transfer' ? 'ট্রান্সফার সংরক্ষণ করুন'
    : 'সমন্বয় সংরক্ষণ করুন';

  return (
    <div data-section="cashbook" className="cashbook-view finance-responsive-page section-layout-shell customer-list-page mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-3 pb-10 sm:gap-4 sm:px-6 sm:py-6 lg:px-8">
      <header className="finance-responsive-header customer-page-header cashbook-page-header cashbook-page-header--v2 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-nowrap sm:gap-4 sm:pb-4">
        <div className="customer-heading flex min-w-0 flex-1 items-start gap-3">
          <div className="customer-page-icon cashbook-page-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 sm:h-11 sm:w-11">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="customer-page-eyebrow mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Payments &amp; Money</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Cashbook</h1>
            <p className="mt-0.5 max-w-[28rem] text-sm leading-5 text-slate-600 dark:text-slate-400">Track account balances, money in &amp; out.</p>
          </div>
        </div>
        <div className="finance-responsive-actions customer-header-actions cashbook-header-actions flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={exportLedger} aria-label="Export cashbook CSV" title="Export CSV" className="cashbook-header-action inline-flex h-11 min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-0 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto sm:px-3"><Download size={16} /><span className="hidden sm:inline">Export CSV</span></button>
          <button type="button" onClick={() => openModal('account')} aria-label="Add financial account" title="Add account" className="cashbook-header-action inline-flex h-11 min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-0 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto sm:px-3"><Plus size={16} /><span className="hidden sm:inline">Add account</span></button>
          <button type="button" onClick={() => openModal('expense')} disabled={!enabledAccounts.length} aria-label="Record expense" title="Record expense" className="customer-primary-action cashbook-header-action inline-flex h-11 min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-lg bg-violet-700 px-0 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3"><Plus size={16} /><span className="hidden sm:inline">Record expense</span></button>
        </div>
      </header>

      {unresolvedPayments.length > 0 && (
        <div className="cashbook-unresolved-banner rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {unresolvedPayments.length} received payment{unresolvedPayments.length === 1 ? '' : 's'} are not assigned to a financial account. Map payment methods under Settings → Payments to include them in balances.
        </div>
      )}

      <section className="cashbook-summary-grid grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" aria-label="Cashbook summary">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total balance"
          value={formatCurrency(totalBalance, currency)}
          hint={`Shown in ${currency}`}
          tone="violet"
          valueTone="violet"
          valueClassName="text-xl sm:text-2xl"
        />
        <StatCard
          icon={<ArrowDownLeft className="h-5 w-5" />}
          label="Money in"
          value={formatCurrency(flow.moneyIn, currency)}
          hint={periodHint}
          tone="emerald"
          valueTone="emerald"
          valueClassName="text-xl sm:text-2xl"
        />
        <StatCard
          icon={<ArrowDownRight className="h-5 w-5" />}
          label="Money out"
          value={formatCurrency(flow.moneyOut, currency)}
          hint={periodHint}
          tone="rose"
          valueTone="rose"
          valueClassName="text-xl sm:text-2xl"
        />
        <StatCard
          icon={<ArrowLeftRight className="h-5 w-5" />}
          label="Money in minus out"
          value={formatCurrency(flow.netCashFlow, currency)}
          hint={periodHint}
          tone="violet"
          valueTone={flow.netCashFlow >= 0 ? 'emerald' : 'rose'}
          valueClassName="text-xl sm:text-2xl"
        />
      </section>

      <section className="cashbook-account-grid grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4" aria-label="Financial accounts">
        {financialAccounts.map(account => {
          const balance = getAccountBalance(account, getFinancialLedger(financialRecords, account.id), currency);
          return (
          <div key={account.id} className={`cashbook-account-card ${cardClass} transition ${selectedAccountId === account.id ? 'is-selected border-violet-500 ring-2 ring-violet-500/20' : ''}`}>
            <button type="button" aria-pressed={selectedAccountId === account.id} onClick={() => setSelectedAccountId(selectedAccountId === account.id ? 'all' : account.id)} className="w-full text-left">
              <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="cashbook-account-icon"><Wallet size={17} /></span><span className="cashbook-account-name truncate font-semibold text-slate-900 dark:text-white">{account.name}</span></div><span className="cashbook-account-type shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800">{account.type.replace('_', ' ')}</span></div>
              <div className="cashbook-account-balance mt-3 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(balance, currency)}</div>
              <div className="cashbook-account-meta mt-1 text-xs text-slate-500">{account.identifier || account.currency}{account.enabled ? '' : ' · Disabled'}</div>
            </button>
            <div className="cashbook-account-actions mt-3 flex gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <button type="button" onClick={() => openEditAccount(account)} className="cashbook-account-edit min-h-9 rounded-lg px-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40">Edit</button>
              <button type="button" onClick={() => updateFinancialAccount(account.id, { enabled: !account.enabled })} className="cashbook-account-toggle min-h-9 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800">{account.enabled ? 'Disable' : 'Enable'}</button>
            </div>
          </div>
          );
        })}
        {financialAccounts.length === 0 && <div className="cashbook-empty-account flex min-w-0 items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:col-span-2 xl:col-span-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Wallet size={18} /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">No financial accounts yet</p><p className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">Add an account with its opening balance to start tracking cash flow.</p></div><button type="button" onClick={() => openModal('account')} className="customer-primary-action inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-600"><Plus size={14} /> Add</button></div>}
      </section>

      <section className={`${cardClass} cashbook-ledger-section cashbook-ledger-card`}>
        <div className="cashbook-section-head mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="cashbook-section-title text-lg font-bold tracking-tight text-slate-950 dark:text-white">{activeAccount ? `${activeAccount.name} ledger` : 'Business ledger'}</h2><span className="cashbook-count-pill rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{scopedLedger.length} entries</span></div><p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">Only recorded payments and adjustments change balances; sale totals are excluded.</p></div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => openModal('income')} disabled={!enabledAccounts.length} className="cashbook-ledger-action min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Add income</button>
            <button type="button" onClick={() => openModal('transfer')} disabled={enabledAccounts.length < 2} className="cashbook-ledger-action min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Transfer</button>
            <button type="button" onClick={() => openModal('adjustment')} disabled={!enabledAccounts.length} className="cashbook-ledger-action min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Reconcile</button>
          </div>
        </div>
        <div className="cashbook-ledger-filters cashbook-filter-dock mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-900/60 sm:grid-cols-4 lg:grid-cols-[1.15fr_0.8fr_0.8fr_1.25fr]">
          <select aria-label="Filter by financial account" className={inputClass} value={selectedAccountId} onChange={event => setSelectedAccountId(event.target.value)}><option value="all">All accounts</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
          <input className={inputClass} type="date" aria-label="From date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
          <input className={inputClass} type="date" aria-label="To date" value={toDate} onChange={event => setToDate(event.target.value)} />
          <input className={inputClass} type="search" aria-label="Search ledger" placeholder="Search entries..." value={search} onChange={event => setSearch(event.target.value)} />
          {(selectedAccountId !== 'all' || fromDate || toDate || search) && <button type="button" onClick={() => { setSelectedAccountId('all'); setFromDate(''); setToDate(''); setSearch(''); }} className="cashbook-clear-filters col-span-2 min-h-9 justify-self-start rounded-lg px-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-950/50 sm:col-span-4">Clear filters</button>}
        </div>
        <div className="cashbook-ledger-desktop hidden overflow-x-auto md:block">
          <table className="cashbook-table w-full min-w-[850px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Account</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Balance</th></tr></thead>
            <tbody>
              {scopedLedger.map(entry => {
                const isIn = entry.direction === 'in';
                const amountDisplay = convertReportCurrency(entry.amount, entry.currency, currency);
                return <tr key={entry.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70">
                  <td className="cashbook-cell-date whitespace-nowrap px-3 py-3 text-slate-500">{formatAppDate(entry.date)}</td>
                  <td className="px-3 py-3"><div className="font-medium text-slate-900 dark:text-white">{entry.description || entry.categoryName}</div><div className="text-xs text-slate-500">{entry.reference} · {entry.categoryName}{entry.customerName ? ` · ${entry.customerName}` : ''}</div></td>
                  <td className="px-3 py-3"><span className={`cashbook-type-chip cashbook-type-chip--${entry.type}`}>{entry.type.replace('_', ' ')}</span></td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{financialAccounts.find(account => account.id === entry.accountId)?.name || '—'}</td>
                  <td className={`cashbook-amount cashbook-amount--${entry.direction} whitespace-nowrap px-3 py-3 text-right font-semibold ${entry.direction === 'transfer' ? 'text-sky-600' : isIn ? 'text-emerald-600' : 'text-rose-600'}`}>{entry.direction === 'transfer' ? '' : isIn ? '+' : '−'}{formatCurrency(amountDisplay, currency)}</td>
                  <td className="cashbook-cell-balance whitespace-nowrap px-3 py-3 text-right text-slate-700 dark:text-slate-200">{entry.runningBalance === undefined ? '—' : formatCurrency(entry.runningBalance, currency)}</td>
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
            return <article key={entry.id} className={`cashbook-entry cashbook-entry--${entry.direction} rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900`}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{entry.description || entry.categoryName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{formatAppDate(entry.date)} · {entry.categoryName}{entry.customerName ? ` · ${entry.customerName}` : ''}</p>
                </div>
                <p className={`cashbook-entry-amount shrink-0 text-sm font-bold tabular-nums ${entry.direction === 'transfer' ? 'text-sky-600' : isIn ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{entry.direction === 'transfer' ? '' : isIn ? '+' : '−'}{formatCurrency(amountDisplay, currency)}</p>
              </div>
              <div className="cashbook-entry-meta mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span><span className={`cashbook-type-chip cashbook-type-chip--${entry.type}`}>{entry.type.replace('_', ' ')}</span> · {accountName}</span>
                <span>Balance: {entry.runningBalance === undefined ? '—' : formatCurrency(entry.runningBalance, currency)}</span>
              </div>
              {entry.reference && <p className="mt-1 truncate text-[10px] text-slate-400">Ref: {entry.reference}</p>}
            </article>;
          })}
          {scopedLedger.length === 0 && <div className="cashbook-empty-state rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No cashbook entries match these filters.</div>}
        </div>
      </section>

      <section className={`${cardClass} cashbook-flow-section cashbook-flow-card`}>
        <div className="cashbook-section-head mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="cashbook-section-title text-lg font-bold text-slate-900 dark:text-white">{flowGrouping === 'daily' ? 'Daily' : 'Monthly'} cash flow</h2><p className="mt-1 text-xs text-slate-500">Transfers and opening balances are excluded.</p></div>
          <select className={`${inputClass} cashbook-flow-select`} value={flowGrouping} onChange={event => setFlowGrouping(event.target.value as 'daily' | 'monthly')} aria-label="Cash flow grouping"><option value="daily">Daily</option><option value="monthly">Monthly</option></select>
        </div>
        <div className="cashbook-flow-desktop hidden overflow-x-auto md:block">
          <table className="cashbook-table w-full min-w-[600px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800"><th className="px-3 py-3">Period</th><th className="px-3 py-3 text-right">Money in</th><th className="px-3 py-3 text-right">Money out</th><th className="px-3 py-3 text-right">Net flow</th></tr></thead>
            <tbody>{flowRows.map(row => <tr key={row.period} className="border-b border-slate-50 last:border-0 dark:border-slate-800/70"><td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">{row.period}</td><td className="cashbook-amount cashbook-amount--in px-3 py-3 text-right text-emerald-600">{formatCurrency(row.moneyIn, currency)}</td><td className="cashbook-amount cashbook-amount--out px-3 py-3 text-right text-rose-600">{formatCurrency(row.moneyOut, currency)}</td><td className={`cashbook-amount px-3 py-3 text-right font-semibold ${row.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(row.netCashFlow, currency)}</td></tr>)}
            {flowRows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">No cash flow for this period.</td></tr>}</tbody>
          </table>
        </div>
        <div className="cashbook-flow-mobile space-y-2 md:hidden">
          {flowRows.map(row => <article key={row.period} className="cashbook-flow-row rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-950 dark:border-slate-800 dark:text-white">{row.period}</div>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div><p className="text-slate-500">Money in</p><p className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(row.moneyIn, currency)}</p></div>
              <div><p className="text-slate-500">Money out</p><p className="mt-1 font-semibold tabular-nums text-rose-700 dark:text-rose-300">{formatCurrency(row.moneyOut, currency)}</p></div>
              <div><p className="text-slate-500">Net flow</p><p className={`mt-1 font-semibold tabular-nums ${row.netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{formatCurrency(row.netCashFlow, currency)}</p></div>
            </div>
          </article>)}
          {flowRows.length === 0 && <div className="cashbook-empty-state rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No cash flow for this period.</div>}
        </div>
      </section>

      <Modal isOpen={showEntryModal} onClose={closeEntryModal} title={modalTitle} subtitle="এই হিসাবটি স্থানীয়ভাবে সংরক্ষিত হয় এবং ব্যাকআপে অন্তর্ভুক্ত থাকে।" maxWidth="lg" footer={(
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={closeEntryModal} className="cashbook-modal-cancel min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">বাতিল</button>
          <button type="submit" form="cashbook-entry-form" className="cashbook-modal-submit min-h-11 rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-600">{submitLabel}</button>
        </div>
      )}>
        <form id="cashbook-entry-form" onSubmit={handleCreate} noValidate className="cashbook-entry-form space-y-5 text-sm">
          {modalKind && <p className="rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2.5 text-xs leading-6 text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">{CASHBOOK_KIND_HELPER_LINES[modalKind]}</p>}

          {/* Live preview — updates as you type */}
          <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-violet-900 dark:bg-violet-950/20">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white" aria-hidden="true">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900 dark:text-white">{previewTitle}</p>
              {previewSubtitle && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{previewSubtitle}</p>}
            </div>
          </div>

          {modalKind === 'account' || modalKind === 'edit-account' ? <>
            {/* 1. Money account name */}
            <section aria-labelledby="cashbook-account-name-title" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">১</span>
                <h3 id="cashbook-account-name-title" className="text-base font-bold text-slate-900 dark:text-white">টাকার অ্যাকাউন্টের (ওয়ালেটের) নাম <span className="text-rose-500">*</span></h3>
              </div>
              <input
                ref={accountNameRef}
                id="cashbook-account-name"
                value={accountName}
                onChange={event => { setAccountName(event.target.value); if (formErrors.accountName) setFormErrors(previous => ({ ...previous, accountName: '' })); }}
                maxLength={80}
                placeholder="যেমন: বিকাশ পার্সোনাল, ক্যাশ ড্রয়ার"
                aria-invalid={Boolean(formErrors.accountName)}
                className={cashbookFieldClass(Boolean(formErrors.accountName))}
              />
              {formErrors.accountName && <span role="alert" className="block text-xs text-rose-600">{formErrors.accountName}</span>}
            </section>

            {modalKind === 'account' && <>
              {/* 2. Type & currency */}
              <section aria-labelledby="cashbook-account-type-title" className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">২</span>
                  <h3 id="cashbook-account-type-title" className="text-base font-bold text-slate-900 dark:text-white">ধরন ও মুদ্রা</h3>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">ধরন</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="ধরন">
                    {(Object.keys(FINANCIAL_ACCOUNT_TYPE_LABELS) as FinancialAccountType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={accountType === type}
                        onClick={() => setAccountType(type)}
                        className={`min-h-10 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${accountType === type ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
                      >
                        {FINANCIAL_ACCOUNT_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">মুদ্রা</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="মুদ্রা">
                    {(['BDT', 'USD'] as const).map(code => (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={accountCurrency === code}
                        onClick={() => setAccountCurrency(code)}
                        className={`min-h-10 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${accountCurrency === code ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* 3. Opening balance */}
              <section aria-labelledby="cashbook-opening-balance-title" className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">৩</span>
                  <h3 id="cashbook-opening-balance-title" className="text-base font-bold text-slate-900 dark:text-white">শুরুর ব্যালেন্স</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cashbook-opening-balance" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">শুরুর ব্যালেন্স <span className="text-rose-500">*</span></label>
                    <input
                      ref={openingBalanceRef}
                      id="cashbook-opening-balance"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={openingBalance}
                      onChange={event => { setOpeningBalance(event.target.value); if (formErrors.openingBalance) setFormErrors(previous => ({ ...previous, openingBalance: '' })); }}
                      aria-invalid={Boolean(formErrors.openingBalance)}
                      className={cashbookFieldClass(Boolean(formErrors.openingBalance))}
                    />
                    {formErrors.openingBalance && <span role="alert" className="mt-1.5 block text-xs text-rose-600">{formErrors.openingBalance}</span>}
                  </div>
                  <div>
                    <label htmlFor="cashbook-opening-balance-date" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">কোন তারিখের ব্যালেন্স <span className="text-rose-500">*</span></label>
                    <input
                      ref={openingBalanceDateRef}
                      id="cashbook-opening-balance-date"
                      type="date"
                      value={openingBalanceDate}
                      onChange={event => { setOpeningBalanceDate(event.target.value); if (formErrors.openingBalanceDate) setFormErrors(previous => ({ ...previous, openingBalanceDate: '' })); }}
                      aria-invalid={Boolean(formErrors.openingBalanceDate)}
                      className={cashbookFieldClass(Boolean(formErrors.openingBalanceDate))}
                    />
                    {formErrors.openingBalanceDate && <span role="alert" className="mt-1.5 block text-xs text-rose-600">{formErrors.openingBalanceDate}</span>}
                  </div>
                </div>
              </section>
            </>}

            {/* Advanced settings (collapsed, optional) */}
            <section aria-labelledby="cashbook-advanced-title" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAdvancedOpen(previous => !previous)}
                aria-expanded={advancedOpen}
                className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left dark:bg-slate-800/60"
              >
                <span id="cashbook-advanced-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">আরও সেটিংস (ঐচ্ছিক)</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-4 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div>
                    <label htmlFor="cashbook-account-identifier" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">রেফারেন্স <span className="font-normal text-slate-400">ঐচ্ছিক</span></label>
                    <input
                      id="cashbook-account-identifier"
                      value={accountIdentifier}
                      onChange={event => setAccountIdentifier(event.target.value)}
                      maxLength={100}
                      placeholder="যেমন: বিকাশ নম্বর বা ব্যাংক হিসাব নম্বর"
                      className={cashbookFieldClass(false)}
                    />
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">চেনার জন্য — যেমন বিকাশ নম্বর বা ব্যাংক হিসাব নম্বর।</p>
                  </div>
                  {modalKind === 'edit-account' && editingAccount && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">শুরুর তথ্য</p>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <dt className="text-slate-500">ধরন</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{FINANCIAL_ACCOUNT_TYPE_LABELS[editingAccount.type]}</dd>
                        <dt className="text-slate-500">মুদ্রা</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{editingAccount.currency}</dd>
                        <dt className="text-slate-500">শুরুর ব্যালেন্স</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(editingAccount.openingBalance, editingAccount.currency)}</dd>
                        <dt className="text-slate-500">শুরুর তারিখ</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{formatAppDate(editingAccount.openingBalanceDate)}</dd>
                      </dl>
                      <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">ধরন, মুদ্রা ও শুরুর ব্যালেন্স বদলানো যায় না — এগুলো এই টাকার অ্যাকাউন্টের (ওয়ালেটের) শুরুর তথ্য।</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </> : <>
            {/* 1. Money account */}
            <section aria-labelledby="cashbook-entry-account-title" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">১</span>
                <h3 id="cashbook-entry-account-title" className="text-base font-bold text-slate-900 dark:text-white">{modalKind === 'transfer' ? 'কোন টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে' : 'টাকার অ্যাকাউন্ট (ওয়ালেট)'} <span className="text-rose-500">*</span></h3>
              </div>
              <select
                ref={accountRef}
                id="cashbook-account"
                value={accountId}
                onChange={event => { const next = event.target.value; setAccountId(next); const chosen = financialAccounts.find(item => item.id === next); if (chosen) { setAccountCurrency(chosen.currency); const destination = enabledAccounts.find(item => item.id !== next && item.currency === chosen.currency); if (destination) setToAccountId(destination.id); } if (formErrors.account) setFormErrors(previous => ({ ...previous, account: '' })); }}
                aria-invalid={Boolean(formErrors.account)}
                className={cashbookFieldClass(Boolean(formErrors.account))}
              >
                <option value="" disabled>টাকার অ্যাকাউন্ট (ওয়ালেট) বাছুন</option>
                {enabledAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
              </select>
              {formErrors.account && <span role="alert" className="block text-xs text-rose-600">{formErrors.account}</span>}
            </section>

            {modalKind === 'transfer' && (
              <section aria-labelledby="cashbook-entry-to-account-title" className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">২</span>
                  <h3 id="cashbook-entry-to-account-title" className="text-base font-bold text-slate-900 dark:text-white">কোন টাকার অ্যাকাউন্টে (ওয়ালেটে) যাবে <span className="text-rose-500">*</span></h3>
                </div>
                <select
                  ref={toAccountRef}
                  id="cashbook-to-account"
                  value={toAccountId}
                  onChange={event => { setToAccountId(event.target.value); if (formErrors.toAccount) setFormErrors(previous => ({ ...previous, toAccount: '' })); }}
                  aria-invalid={Boolean(formErrors.toAccount)}
                  className={cashbookFieldClass(Boolean(formErrors.toAccount))}
                >
                  <option value="" disabled>টাকার অ্যাকাউন্ট (ওয়ালেট) বাছুন</option>
                  {enabledAccounts.filter(account => account.id !== accountId && account.currency === financialAccounts.find(item => item.id === accountId)?.currency).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                {formErrors.toAccount && <span role="alert" className="block text-xs text-rose-600">{formErrors.toAccount}</span>}
                <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">দুই টাকার অ্যাকাউন্টের (ওয়ালেটের) মুদ্রা একই হতে হবে।</p>
              </section>
            )}

            {(modalKind === 'expense' || modalKind === 'income') && (
              <section aria-labelledby="cashbook-entry-category-title" className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">২</span>
                  <h3 id="cashbook-entry-category-title" className="text-base font-bold text-slate-900 dark:text-white">{modalKind === 'expense' ? 'খরচের খাত' : 'ইনকামের খাত'} <span className="text-rose-500">*</span></h3>
                </div>
                <select
                  ref={categoryRef}
                  id="cashbook-category"
                  value={categoryId}
                  onChange={event => { setCategoryId(event.target.value); if (formErrors.category) setFormErrors(previous => ({ ...previous, category: '' })); }}
                  aria-invalid={Boolean(formErrors.category)}
                  className={cashbookFieldClass(Boolean(formErrors.category))}
                >
                  <option value="" disabled>খাত বাছুন</option>
                  {(modalKind === 'expense' ? expenseCategories : incomeCategories).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {formErrors.category && <span role="alert" className="block text-xs text-rose-600">{formErrors.category}</span>}
              </section>
            )}

            {/* Amount & date */}
            <section aria-labelledby="cashbook-entry-amount-title" className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{modalKind === 'transfer' ? '৩' : modalKind === 'adjustment' ? '২' : '৩'}</span>
                <h3 id="cashbook-entry-amount-title" className="text-base font-bold text-slate-900 dark:text-white">টাকার পরিমাণ ও তারিখ <span className="text-rose-500">*</span></h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="cashbook-amount" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">টাকার পরিমাণ <span className="text-rose-500">*</span></label>
                  <input
                    ref={amountRef}
                    id="cashbook-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={amount}
                    onChange={event => { setAmount(event.target.value); if (formErrors.amount) setFormErrors(previous => ({ ...previous, amount: '' })); }}
                    placeholder="৫০০"
                    aria-invalid={Boolean(formErrors.amount)}
                    className={cashbookFieldClass(Boolean(formErrors.amount))}
                  />
                  {formErrors.amount && <span role="alert" className="mt-1.5 block text-xs text-rose-600">{formErrors.amount}</span>}
                  {modalKind === 'adjustment' && <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">বাদ দিতে মাইনাস (-) দিয়ে লিখুন, যেমন -৫০০।</p>}
                </div>
                <div>
                  <label htmlFor="cashbook-date" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">তারিখ <span className="text-rose-500">*</span></label>
                  <input
                    ref={dateRef}
                    id="cashbook-date"
                    type="date"
                    value={date}
                    onChange={event => { setDate(event.target.value); if (formErrors.date) setFormErrors(previous => ({ ...previous, date: '' })); }}
                    aria-invalid={Boolean(formErrors.date)}
                    className={cashbookFieldClass(Boolean(formErrors.date))}
                  />
                  {formErrors.date && <span role="alert" className="mt-1.5 block text-xs text-rose-600">{formErrors.date}</span>}
                </div>
              </div>
            </section>

            {modalKind !== 'transfer' && (
              <section aria-labelledby="cashbook-entry-description-title" className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">৪</span>
                  <h3 id="cashbook-entry-description-title" className="text-base font-bold text-slate-900 dark:text-white">{modalKind === 'adjustment' ? 'সমন্বয়ের কারণ' : 'বিবরণ'} <span className="text-rose-500">*</span></h3>
                </div>
                <input
                  ref={descriptionRef}
                  id="cashbook-description"
                  value={description}
                  onChange={event => { setDescription(event.target.value); if (formErrors.description) setFormErrors(previous => ({ ...previous, description: '' })); }}
                  maxLength={200}
                  placeholder={modalKind === 'adjustment' ? 'কেন ব্যালেন্স মেলাতে হচ্ছে?' : modalKind === 'expense' ? 'কিসের খরচ? যেমন: দোকান ভাড়া' : 'কিসের ইনকাম? যেমন: কমিশন'}
                  aria-invalid={Boolean(formErrors.description)}
                  className={cashbookFieldClass(Boolean(formErrors.description))}
                />
                {formErrors.description && <span role="alert" className="block text-xs text-rose-600">{formErrors.description}</span>}
              </section>
            )}

            {/* Advanced settings (collapsed, optional) */}
            <section aria-labelledby="cashbook-advanced-title" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAdvancedOpen(previous => !previous)}
                aria-expanded={advancedOpen}
                className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left dark:bg-slate-800/60"
              >
                <span id="cashbook-advanced-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">আরও সেটিংস (ঐচ্ছিক)</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-4 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  {modalKind === 'expense' && (
                    <div>
                      <label htmlFor="cashbook-vendor" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">বিক্রেতা <span className="font-normal text-slate-400">ঐচ্ছিক</span></label>
                      <input
                        id="cashbook-vendor"
                        value={vendor}
                        onChange={event => setVendor(event.target.value)}
                        maxLength={100}
                        placeholder="যেমন: দোকানের নাম"
                        className={cashbookFieldClass(false)}
                      />
                    </div>
                  )}
                  {(modalKind === 'expense' || modalKind === 'income' || modalKind === 'transfer') && (
                    <div>
                      <label htmlFor="cashbook-reference" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">রেফারেন্স <span className="font-normal text-slate-400">ঐচ্ছিক</span></label>
                      <input
                        id="cashbook-reference"
                        value={reference}
                        onChange={event => setReference(event.target.value)}
                        maxLength={100}
                        placeholder="রসিদ বা বিল নম্বর"
                        className={cashbookFieldClass(false)}
                      />
                    </div>
                  )}
                  {modalKind === 'transfer' && (
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">ট্রান্সফার আয়-ব্যয়ের হিসাবে ধরা হয় না — শুধু টাকা এক টাকার অ্যাকাউন্ট (ওয়ালেট) থেকে আরেকটায় যায়।</p>
                  )}
                  {modalKind === 'adjustment' && (
                    <div className="space-y-1.5">
                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">সমন্বয় শুধু এই টাকার অ্যাকাউন্টের (ওয়ালেটের) ব্যালেন্স বদলায় — আয়-ব্যয়ের হিসাবে ধরা হয় না।</p>
                      {chosenAccount && chosenBalance !== null && <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">বর্তমান ব্যালেন্স: {formatCurrency(chosenBalance, chosenAccount.currency)}</p>}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>}
        </form>
      </Modal>
    </div>
  );
};
