import type {
  AppCurrency,
  Customer,
  Expense,
  FinancialAccount,
  FinancialAdjustment,
  FinancialCategory,
  FinancialTransfer,
  OtherIncome,
  Payment,
  PaymentMethodConfig,
  Sale,
  Invoice,
  Subscription,
} from '../types';
import { convertReportCurrency, isWithinDateBounds } from './reportMetrics';

export type FinancialEntryType = 'payment' | 'income' | 'expense' | 'refund' | 'transfer' | 'opening_balance' | 'adjustment';
export type FinancialDirection = 'in' | 'out' | 'transfer';

export interface FinancialLedgerEntry {
  id: string;
  date: string;
  reference: string;
  type: FinancialEntryType;
  direction: FinancialDirection;
  description: string;
  accountId: string;
  amount: number;
  currency: AppCurrency;
  categoryName: string;
  customerName?: string;
  saleId?: string;
  invoiceNumber?: string;
  paymentId?: string;
  expenseId?: string;
  transferId?: string;
  createdAt?: string;
  runningBalance?: number;
}

export interface FinancialRecords {
  accounts: FinancialAccount[];
  payments: Payment[];
  expenses: Expense[];
  income: OtherIncome[];
  transfers: FinancialTransfer[];
  adjustments: FinancialAdjustment[];
  paymentMethods: PaymentMethodConfig[];
  expenseCategories: FinancialCategory[];
  incomeCategories: FinancialCategory[];
  sales?: Sale[];
  invoices?: Invoice[];
  subscriptions?: Subscription[];
  customers?: Customer[];
}

export interface AccountDailySummary {
  accountId: string;
  accountName: string;
  currency: AppCurrency;
  openingBalance: number;
  moneyIn: number;
  moneyOut: number;
  transferIn: number;
  transferOut: number;
  adjustmentNet: number;
  expectedClosingBalance: number;
}

export interface DailyFinancialSummary {
  date: string;
  currency: AppCurrency;
  openingBalance: number;
  totalMoneyIn: number;
  totalMoneyOut: number;
  transfersIn: number;
  transfersOut: number;
  adjustmentsNet: number;
  expectedClosingBalance: number;
  accounts: AccountDailySummary[];
  paymentMethods: Array<{ name: string; amount: number }>;
  expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
}

export interface FinancialAccountPeriodSummary extends AccountDailySummary {
  closingBalance: number;
  transactionCount: number;
}

const RECEIVED_PAYMENT_STATUSES = new Set(['paid', 'partial']);
const posted = (status: string | undefined) => status === undefined || status === 'posted';

const resolvePaymentAccount = (payment: Payment, records: FinancialRecords): string =>
  payment.financialAccountId
  || records.paymentMethods.find(method =>
    method.id === payment.paymentMethodId
    || method.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
  )?.financialAccountId
  || records.accounts.find(account =>
    account.name.toLocaleLowerCase() === (payment.paymentMethodName || payment.paymentMethod).toLocaleLowerCase()
  )?.id
  || '';

const categoryName = (categories: FinancialCategory[], id: string): string =>
  categories.find(category => category.id === id)?.name || 'Uncategorized';

export function getFinancialLedger(records: FinancialRecords, accountId?: string): FinancialLedgerEntry[] {
  const entries: FinancialLedgerEntry[] = [];
  const accounts = new Map(records.accounts.map(account => [account.id, account]));
  const saleById = new Map((records.sales || []).map(sale => [sale.id, sale]));
  const invoiceById = new Map((records.invoices || []).map(invoice => [invoice.invoiceId, invoice]));
  const customersById = new Map((records.customers || []).map(customer => [customer.id, customer.name]));

  records.accounts.forEach(account => {
    if (account.openingBalance !== 0) entries.push({
      id: `opening-${account.id}`,
      date: account.openingBalanceDate,
      reference: 'Opening Balance',
      type: 'opening_balance',
      direction: account.openingBalance >= 0 ? 'in' : 'out',
      description: `${account.name} opening balance`,
      accountId: account.id,
      amount: Math.abs(account.openingBalance),
      currency: account.currency,
      categoryName: 'Opening Balance',
      createdAt: account.createdAt,
    });
  });

  records.payments.forEach(payment => {
    const accountIdForPayment = resolvePaymentAccount(payment, records);
    if (!accountIdForPayment || !accounts.has(accountIdForPayment)) return;
    const sale = payment.saleId ? saleById.get(payment.saleId) : undefined;
    const invoice = payment.invoiceId ? invoiceById.get(payment.invoiceId) : undefined;
    const customerName = customersById.get(sale?.customerId || payment.customerId);
    if (!RECEIVED_PAYMENT_STATUSES.has(payment.paymentStatus) && payment.paymentStatus !== 'refunded') return;
    entries.push({
      id: `payment-${payment.id}`,
      date: payment.paymentDate,
      reference: payment.transactionId || payment.id,
      type: payment.paymentStatus === 'refunded' ? 'refund' : 'payment',
      direction: payment.paymentStatus === 'refunded' ? 'out' : 'in',
      description: payment.paymentMethodName || payment.paymentMethod,
      accountId: accountIdForPayment,
      amount: Number(payment.amount) || 0,
      currency: payment.currency,
      categoryName: payment.paymentStatus === 'refunded' ? 'Refund' : 'Sale Payment',
      customerName,
      saleId: sale?.id || payment.saleId,
      invoiceNumber: invoice?.invoiceNumber || sale?.invoiceNo,
      paymentId: payment.id,
      createdAt: payment.createdAt,
    });
  });

  records.income.filter(item => posted(item.status)).forEach(item => entries.push({
    id: `income-${item.id}`,
    date: item.date,
    reference: item.reference || item.id,
    type: 'income',
    direction: 'in',
    description: item.description,
    accountId: item.accountId,
    amount: Number(item.amount) || 0,
    currency: item.currency,
    categoryName: categoryName(records.incomeCategories, item.categoryId),
    createdAt: item.createdAt,
  }));
  records.expenses.filter(item => posted(item.status)).forEach(item => entries.push({
    id: `expense-${item.id}`,
    date: item.date,
    reference: item.reference || item.id,
    type: 'expense',
    direction: 'out',
    description: item.description,
    accountId: item.accountId,
    amount: Number(item.amount) || 0,
    currency: item.currency,
    categoryName: categoryName(records.expenseCategories, item.categoryId),
    expenseId: item.id,
    createdAt: item.createdAt,
  }));
  records.transfers.filter(item => posted(item.status)).forEach(item => {
    if (accountId && accountId !== item.fromAccountId && accountId !== item.toAccountId) return;
    entries.push({
      id: `transfer-${item.id}`,
      date: item.date,
      reference: item.reference || item.id,
      type: 'transfer',
      direction: 'transfer',
      description: `${accounts.get(item.fromAccountId)?.name || 'Account'} → ${accounts.get(item.toAccountId)?.name || 'Account'}`,
      accountId: item.fromAccountId,
      amount: Number(item.amount) || 0,
      currency: item.currency,
      categoryName: 'Transfer',
      transferId: item.id,
      createdAt: item.createdAt,
    });
    entries.push({
      id: `transfer-in-${item.id}`,
      date: item.date,
      reference: item.reference || item.id,
      type: 'transfer',
      direction: 'in',
      description: `Transfer from ${accounts.get(item.fromAccountId)?.name || 'Account'}`,
      accountId: item.toAccountId,
      amount: Number(item.amount) || 0,
      currency: item.currency,
      categoryName: 'Transfer',
      transferId: item.id,
      createdAt: item.createdAt,
    });
  });
  records.adjustments.filter(item => item.status !== 'voided').forEach(item => entries.push({
    id: `adjustment-${item.id}`,
    date: item.date,
    reference: item.reference || item.id,
    type: 'adjustment',
    direction: item.amount >= 0 ? 'in' : 'out',
    description: item.reason,
    accountId: item.accountId,
    amount: Math.abs(Number(item.amount) || 0),
    currency: item.currency,
    categoryName: 'Adjustment',
    createdAt: item.createdAt,
  }));

  const filtered = entries.filter(entry => !accountId || entry.accountId === accountId);
  return filtered.sort((left, right) =>
    left.date.localeCompare(right.date)
    || (left.type === 'opening_balance' ? -1 : right.type === 'opening_balance' ? 1 : 0)
    || (left.createdAt || '').localeCompare(right.createdAt || '')
    || left.id.localeCompare(right.id)
  );
}

export function getAccountBalance(
  account: FinancialAccount,
  ledger: FinancialLedgerEntry[],
  currency: AppCurrency = account.currency
): number {
  return ledger.reduce((balance, entry) => {
    if (entry.accountId !== account.id || entry.date < account.openingBalanceDate || entry.type === 'opening_balance') return balance;
    const amount = convertReportCurrency(entry.amount, entry.currency, currency);
    if (entry.direction === 'in') return balance + amount;
    if (entry.direction === 'out') return balance - amount;
    if (entry.type === 'transfer') return balance - amount;
    return balance;
  }, convertReportCurrency(account.openingBalance, account.currency, currency));
}

export function getAccountBalanceAtDate(
  account: FinancialAccount,
  ledger: FinancialLedgerEntry[],
  date: string,
  currency: AppCurrency
): number {
  if (date < account.openingBalanceDate) return 0;
  return ledger.reduce((balance, entry) => {
    if (entry.accountId !== account.id || entry.date < account.openingBalanceDate
      || entry.date > date || entry.type === 'opening_balance') return balance;
    const amount = convertReportCurrency(entry.amount, entry.currency, currency);
    if (entry.direction === 'in') return balance + amount;
    if (entry.direction === 'out' || entry.type === 'transfer') return balance - amount;
    return balance;
  }, convertReportCurrency(account.openingBalance, account.currency, currency));
}

export function getDailyFinancialSummary(
  accounts: FinancialAccount[],
  ledger: FinancialLedgerEntry[],
  date: string,
  currency: AppCurrency
): DailyFinancialSummary {
  const dayEntries = ledger.filter(entry => entry.date === date && entry.type !== 'opening_balance');
  const accountSummaries = accounts.map(account => {
    const rows = dayEntries.filter(entry => entry.accountId === account.id);
    const amount = (entry: FinancialLedgerEntry) => convertReportCurrency(entry.amount, entry.currency, account.currency);
    const moneyIn = rows
      .filter(entry => entry.direction === 'in' && entry.type !== 'transfer' && entry.type !== 'adjustment')
      .reduce((total, entry) => total + amount(entry), 0);
    const moneyOut = rows
      .filter(entry => entry.direction === 'out' && entry.type !== 'adjustment')
      .reduce((total, entry) => total + amount(entry), 0);
    const transferIn = rows
      .filter(entry => entry.type === 'transfer' && entry.direction === 'in')
      .reduce((total, entry) => total + amount(entry), 0);
    const transferOut = rows
      .filter(entry => entry.type === 'transfer' && entry.direction === 'transfer')
      .reduce((total, entry) => total + amount(entry), 0);
    const adjustmentNet = rows
      .filter(entry => entry.type === 'adjustment')
      .reduce((total, entry) => total + (entry.direction === 'in' ? amount(entry) : -amount(entry)), 0);
    const openingBalance = getAccountBalanceAtDate(account, ledger, addDateDays(date, -1), account.currency);
    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      openingBalance,
      moneyIn,
      moneyOut,
      transferIn,
      transferOut,
      adjustmentNet,
      expectedClosingBalance: openingBalance + moneyIn - moneyOut + transferIn - transferOut + adjustmentNet,
    };
  });
  const toCurrency = (value: number, from: AppCurrency) => convertReportCurrency(value, from, currency);
  const sumBy = (selector: (account: AccountDailySummary) => number) =>
    accountSummaries.reduce((total, account) => total + toCurrency(selector(account), account.currency), 0);
  const methodTotals = new Map<string, number>();
  dayEntries.filter(entry => entry.type === 'payment').forEach(entry => {
    const method = entry.description || 'Payment';
    methodTotals.set(method, (methodTotals.get(method) || 0) + toCurrency(entry.amount, entry.currency));
  });
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const expenseTotals = new Map<string, number>();
  dayEntries.filter(entry => entry.type === 'expense').forEach(entry => {
    const account = accountMap.get(entry.accountId);
    if (!account) return;
    expenseTotals.set(account.id, (expenseTotals.get(account.id) || 0) + toCurrency(entry.amount, entry.currency));
  });
  const openingBalance = accountSummaries.reduce(
    (total, account) => total + toCurrency(account.openingBalance, account.currency), 0
  );
  const totalMoneyIn = sumBy(account => account.moneyIn);
  const totalMoneyOut = sumBy(account => account.moneyOut);
  const transfersIn = sumBy(account => account.transferIn);
  const transfersOut = sumBy(account => account.transferOut);
  const adjustmentsNet = sumBy(account => account.adjustmentNet);
  return {
    date,
    currency,
    openingBalance,
    totalMoneyIn,
    totalMoneyOut,
    transfersIn,
    transfersOut,
    adjustmentsNet,
    expectedClosingBalance: openingBalance + totalMoneyIn - totalMoneyOut + adjustmentsNet,
    accounts: accountSummaries,
    paymentMethods: [...methodTotals.entries()].map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount),
    expensesByAccount: [...expenseTotals.entries()].map(([accountId, amount]) => ({
      accountId,
      accountName: accountMap.get(accountId)?.name || 'Account unavailable',
      amount,
    })).sort((left, right) => right.amount - left.amount),
  };
}

export function getFinancialAccountPeriodSummary(
  accounts: FinancialAccount[],
  ledger: FinancialLedgerEntry[],
  range: { start: string; end: string },
  currency: AppCurrency
): FinancialAccountPeriodSummary[] {
  return accounts.map(account => {
    const entries = ledger.filter(entry =>
      entry.accountId === account.id
      && entry.type !== 'opening_balance'
      && entry.date >= range.start
      && entry.date <= range.end
    );
    const amount = (entry: FinancialLedgerEntry) => convertReportCurrency(entry.amount, entry.currency, account.currency);
    const moneyIn = entries
      .filter(entry => entry.direction === 'in' && entry.type !== 'transfer' && entry.type !== 'adjustment')
      .reduce((total, entry) => total + amount(entry), 0);
    const moneyOut = entries
      .filter(entry => entry.direction === 'out' && entry.type !== 'adjustment')
      .reduce((total, entry) => total + amount(entry), 0);
    const transferIn = entries
      .filter(entry => entry.type === 'transfer' && entry.direction === 'in')
      .reduce((total, entry) => total + amount(entry), 0);
    const transferOut = entries
      .filter(entry => entry.type === 'transfer' && entry.direction === 'transfer')
      .reduce((total, entry) => total + amount(entry), 0);
    const adjustmentNet = entries
      .filter(entry => entry.type === 'adjustment')
      .reduce((total, entry) => total + (entry.direction === 'in' ? amount(entry) : -amount(entry)), 0);
    const openingBalance = getAccountBalanceAtDate(account, ledger, addDateDays(range.start, -1), account.currency);
    const closingBalance = getAccountBalanceAtDate(account, ledger, range.end, account.currency);
    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      openingBalance,
      moneyIn,
      moneyOut,
      transferIn,
      transferOut,
      adjustmentNet,
      expectedClosingBalance: openingBalance + moneyIn - moneyOut + transferIn - transferOut + adjustmentNet,
      closingBalance,
      transactionCount: entries.length,
    };
  }).map(summary => ({
    ...summary,
    currency,
    openingBalance: convertReportCurrency(summary.openingBalance, summary.currency, currency),
    moneyIn: convertReportCurrency(summary.moneyIn, summary.currency, currency),
    moneyOut: convertReportCurrency(summary.moneyOut, summary.currency, currency),
    transferIn: convertReportCurrency(summary.transferIn, summary.currency, currency),
    transferOut: convertReportCurrency(summary.transferOut, summary.currency, currency),
    adjustmentNet: convertReportCurrency(summary.adjustmentNet, summary.currency, currency),
    expectedClosingBalance: convertReportCurrency(summary.expectedClosingBalance, summary.currency, currency),
    closingBalance: convertReportCurrency(summary.closingBalance, summary.currency, currency),
  }));
}

export function getExpectedClosingBalance(summary: DailyFinancialSummary): number {
  return summary.expectedClosingBalance;
}

export function getClosingDifference(expected: number, actual: number): number {
  return actual - expected;
}

export function getClosingStatus(difference: number): 'matched' | 'difference' {
  return Math.abs(difference) < 0.005 ? 'matched' : 'difference';
}

function addDateDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + amount);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

export function getAccountLedger(
  account: FinancialAccount,
  ledger: FinancialLedgerEntry[],
  currency: AppCurrency = account.currency,
  range?: { start: string; end: string }
): FinancialLedgerEntry[] {
  const accountEntries = getFinancialLedgerForAccount(account, ledger);
  let balance = convertReportCurrency(account.openingBalance, account.currency, currency);
  const withBalances = accountEntries.map(entry => {
    const amount = convertReportCurrency(entry.amount, entry.currency, currency);
    if (entry.date >= account.openingBalanceDate && entry.type !== 'opening_balance') {
      if (entry.direction === 'in') balance += amount;
      else if (entry.direction === 'out') balance -= amount;
      else if (entry.type === 'transfer') balance -= amount;
    }
    return {
      ...entry,
      amount,
      currency,
      ...(entry.date < account.openingBalanceDate ? {} : { runningBalance: balance }),
    };
  });
  return withBalances.filter(entry => !range || isWithinDateBounds(entry.date, range));
}

function getFinancialLedgerForAccount(account: FinancialAccount, allEntries: FinancialLedgerEntry[]): FinancialLedgerEntry[] {
  const rows = allEntries.filter(entry => entry.accountId === account.id);
  return rows.sort((left, right) =>
    left.date.localeCompare(right.date)
    || (left.type === 'opening_balance' ? -1 : right.type === 'opening_balance' ? 1 : 0)
    || (left.createdAt || '').localeCompare(right.createdAt || '')
    || left.id.localeCompare(right.id)
  );
}

export function getTotalBusinessBalance(accounts: FinancialAccount[], ledger: FinancialLedgerEntry[], currency: AppCurrency): number {
  return accounts.reduce((total, account) => total + getAccountBalance(account, ledger, currency), 0);
}

export interface ExpenseSummary {
  total: number;
  count: number;
  categories: Array<{ name: string; total: number; count: number }>;
}

export function getExpenseSummary(
  ledger: FinancialLedgerEntry[],
  currency: AppCurrency,
  range?: { start: string; end: string }
): ExpenseSummary {
  const categoryTotals = new Map<string, { name: string; total: number; count: number }>();
  const expenses = ledger.filter(entry =>
    entry.type === 'expense' && (!range || isWithinDateBounds(entry.date, range))
  );
  expenses.forEach(entry => {
    const category = categoryTotals.get(entry.categoryName) || { name: entry.categoryName, total: 0, count: 0 };
    category.total += convertReportCurrency(entry.amount, entry.currency, currency);
    category.count += 1;
    categoryTotals.set(entry.categoryName, category);
  });
  return {
    total: expenses.reduce((total, entry) => total + convertReportCurrency(entry.amount, entry.currency, currency), 0),
    count: expenses.length,
    categories: [...categoryTotals.values()].sort((left, right) => right.total - left.total),
  };
}

export function getCashFlowSummary(ledger: FinancialLedgerEntry[], currency: AppCurrency, range?: { start: string; end: string }) {
  const matching = ledger.filter(entry => !range || isWithinDateBounds(entry.date, range));
  const moneyIn = matching.filter(entry =>
    entry.direction === 'in' && entry.type !== 'transfer' && entry.type !== 'opening_balance' && entry.type !== 'adjustment'
  )
    .reduce((total, entry) => total + convertReportCurrency(entry.amount, entry.currency, currency), 0);
  const moneyOut = matching.filter(entry =>
    entry.direction === 'out' && entry.type !== 'adjustment' && entry.type !== 'opening_balance'
  )
    .reduce((total, entry) => total + convertReportCurrency(entry.amount, entry.currency, currency), 0);
  const adjustmentNet = matching.filter(entry => entry.type === 'adjustment')
    .reduce((total, entry) => total + (entry.direction === 'in' ? 1 : -1) * convertReportCurrency(entry.amount, entry.currency, currency), 0);
  return { moneyIn, moneyOut, netCashFlow: moneyIn - moneyOut + adjustmentNet };
}

export function getCashFlowTrend(
  ledger: FinancialLedgerEntry[],
  currency: AppCurrency,
  range: { start: string; end: string },
  grouping: 'daily' | 'weekly' | 'monthly'
): Array<{ key: string; moneyIn: number; moneyOut: number; netCashFlow: number }> {
  const groups = new Map<string, FinancialLedgerEntry[]>();
  ledger.filter(entry => entry.type !== 'opening_balance' && isWithinDateBounds(entry.date, range)).forEach(entry => {
    const date = new Date(`${entry.date}T00:00:00`);
    if (!Number.isFinite(date.getTime())) return;
    if (grouping === 'weekly') date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = grouping === 'monthly'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, entries]) => ({
    key,
    ...getCashFlowSummary(entries, currency),
  }));
}

export function getAccountChange(ledger: FinancialLedgerEntry[], accountId: string, currency: AppCurrency, start: string, end: string): number {
  return ledger.filter(entry => entry.accountId === accountId && entry.type !== 'opening_balance' && isWithinDateBounds(entry.date, { start, end }))
    .reduce((total, entry) => total
      + (entry.direction === 'in' ? 1 : entry.direction === 'out' || entry.type === 'transfer' ? -1 : 0)
      * convertReportCurrency(entry.amount, entry.currency, currency), 0);
}

export function getLedgerCustomerLabel(entry: FinancialLedgerEntry): string {
  return entry.customerName || '';
}
