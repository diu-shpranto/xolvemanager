import type {
  AppCurrency,
  Customer,
  DailyClosing,
  Expense,
  FinancialAccount,
  FinancialAdjustment,
  FinancialPeriod,
  FinancialReconciliation,
  FinancialTransfer,
  Invoice,
  OtherIncome,
  Payment,
  PaymentMethodConfig,
  Sale,
  Service,
  Subscription,
} from '../types';
import { convertReportCurrency } from './reportMetrics';
import { getSaleDueAmount, getSalePaidAmount, getSalePaymentStatus } from './saleUtils';
import { getAccountBalanceAtDate, getFinancialLedger, type FinancialLedgerEntry } from './financialLedger';

export interface ReceivableRow {
  saleId: string;
  customerId: string;
  customerName: string;
  invoiceNumber?: string;
  date: string;
  dueDate: string;
  total: number;
  paid: number;
  due: number;
  currency: AppCurrency;
  status: 'pending' | 'partial' | 'overdue';
  ageDays: number;
}

export interface ReceivableAging {
  total: number;
  current: number;
  days1To7: number;
  days8To30: number;
  days31To60: number;
  days61To90: number;
  over90Days: number;
  rows: ReceivableRow[];
}

export interface FinancialIntegrityIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  type: string;
  entityType?: string;
  entityId?: string;
  message: string;
  suggestedFix?: string;
}

export interface AccountingRecords {
  businessId?: string;
  accounts: FinancialAccount[];
  payments: Payment[];
  expenses: Expense[];
  income: OtherIncome[];
  transfers: FinancialTransfer[];
  adjustments: FinancialAdjustment[];
  paymentMethods: PaymentMethodConfig[];
  sales: Sale[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  customers: Customer[];
  services: Service[];
  dailyClosings: DailyClosing[];
  reconciliations: FinancialReconciliation[];
  periods: FinancialPeriod[];
}

const toBusinessDay = (value: string): number => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const lowerBound = (sortedValues: string[], value: string): number => {
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedValues[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
};

export function getReceivableAging(
  records: Pick<AccountingRecords, 'sales' | 'payments' | 'invoices' | 'customers'>,
  asOfDate: string,
  currency: AppCurrency
): ReceivableAging {
  const customersById = new Map(records.customers.map(customer => [customer.id, customer.name]));
  const invoiceBySaleId = new Map(records.invoices.map(invoice => [invoice.saleId, invoice]));
  const asOfPayments = records.payments.filter(payment => payment.paymentDate <= asOfDate);
  const rows: ReceivableRow[] = records.sales.filter(sale => sale.date <= asOfDate).flatMap(sale => {
    if (sale.paymentStatus === 'failed' || sale.paymentStatus === 'refunded') return [];
    const due = getSaleDueAmount(sale, asOfPayments);
    if (due <= 0) return [];
    const invoice = invoiceBySaleId.get(sale.id);
    const dueDate = invoice?.dueDate || sale.date;
    const ageDays = Math.max(0, Math.floor((toBusinessDay(asOfDate) - toBusinessDay(dueDate)) / 86400000));
    const paymentStatus = getSalePaymentStatus(sale, asOfPayments);
    const status: ReceivableRow['status'] = ageDays > 0 ? 'overdue' : paymentStatus === 'partial' ? 'partial' : 'pending';
    return [{
      saleId: sale.id,
      customerId: sale.customerId,
      customerName: customersById.get(sale.customerId) || 'Customer unavailable',
      invoiceNumber: invoice?.invoiceNumber || sale.invoiceNo,
      date: sale.date,
      dueDate,
      total: convertReportCurrency(sale.amount, sale.currency, currency),
      paid: convertReportCurrency(getSalePaidAmount(sale, asOfPayments), sale.currency, currency),
      due: convertReportCurrency(due, sale.currency, currency),
      currency,
      status,
      ageDays,
    }];
  }).sort((left, right) => right.ageDays - left.ageDays || right.due - left.due);
  return rows.reduce<ReceivableAging>((summary, row) => {
    summary.total += row.due;
    if (row.ageDays === 0) summary.current += row.due;
    else if (row.ageDays <= 7) summary.days1To7 += row.due;
    else if (row.ageDays <= 30) summary.days8To30 += row.due;
    else if (row.ageDays <= 60) summary.days31To60 += row.due;
    else if (row.ageDays <= 90) summary.days61To90 += row.due;
    else summary.over90Days += row.due;
    summary.rows.push(row);
    return summary;
  }, { total: 0, current: 0, days1To7: 0, days8To30: 0, days31To60: 0, days61To90: 0, over90Days: 0, rows: [] });
}

export function runFinancialIntegrityCheck(records: AccountingRecords): FinancialIntegrityIssue[] {
  const issues: FinancialIntegrityIssue[] = [];
  const sales = new Map(records.sales.map(sale => [sale.id, sale]));
  const customers = new Set(records.customers.map(customer => customer.id));
  const services = new Set(records.services.map(service => service.id));
  const accounts = new Map(records.accounts.map(account => [account.id, account]));
  const accountRecords = {
    accounts: records.accounts,
    payments: records.payments,
    expenses: records.expenses,
    income: records.income,
    transfers: records.transfers,
    adjustments: records.adjustments,
    paymentMethods: records.paymentMethods,
    expenseCategories: [],
    incomeCategories: [],
    sales: records.sales,
    invoices: records.invoices,
    customers: records.customers,
  };
  const ledger = getFinancialLedger(accountRecords);
  const invoiceToSaleId = new Map(records.invoices.map(invoice => [invoice.invoiceId, invoice.saleId]));
  const invoicesBySaleId = new Map(records.invoices.map(invoice => [invoice.saleId, invoice]));
  const paymentsBySaleId = new Map<string, Payment[]>();
  const paymentsBySubscriptionId = new Map<string, Payment[]>();
  const paymentMovementIds = new Set(ledger.flatMap(entry => entry.paymentId ? [entry.paymentId] : []));
  const expenseMovementIds = new Set(ledger.flatMap(entry => entry.expenseId ? [entry.expenseId] : []));
  records.payments.forEach(payment => {
    const saleId = payment.saleId || invoiceToSaleId.get(payment.invoiceId || '');
    if (saleId) {
      const linked = paymentsBySaleId.get(saleId) || [];
      linked.push(payment);
      paymentsBySaleId.set(saleId, linked);
    }
    if (payment.subscriptionId) {
      const linked = paymentsBySubscriptionId.get(payment.subscriptionId) || [];
      linked.push(payment);
      paymentsBySubscriptionId.set(payment.subscriptionId, linked);
    }
  });
  const entityCollections: Array<[string, Array<{ id: string; businessId?: string }>]> = [
    ['financial_account', records.accounts],
    ['payment', records.payments],
    ['expense', records.expenses],
    ['transfer', records.transfers],
    ['adjustment', records.adjustments],
  ];
  entityCollections.forEach(([entityType, collection]) => {
    const seen = new Set<string>();
    collection.forEach(record => {
      if (seen.has(record.id)) issues.push({ severity: 'ERROR', type: 'duplicate_record_id', entityType, entityId: record.id, message: `Duplicate ${entityType} ID detected.` });
      seen.add(record.id);
      if (records.businessId && record.businessId !== records.businessId) {
        issues.push({
          severity: record.businessId ? 'ERROR' : 'INFO',
          type: 'business_scope',
          entityType,
          entityId: record.id,
          message: record.businessId ? 'Record belongs to a different business.' : 'Legacy record has no business ID.',
          suggestedFix: record.businessId ? 'Keep this record in its original business and restore the correct scope.' : 'Legacy records remain readable; associate the record with this business during a normal update.',
        });
      }
    });
  });
  const checkAmount = (amount: number, entityType: string, entityId: string) => {
    if (!Number.isFinite(amount) || amount < 0) {
      issues.push({ severity: 'ERROR', type: 'invalid_amount', entityType, entityId, message: `${entityType} amount is invalid.`, suggestedFix: 'Review and correct the record using its normal edit or void workflow.' });
    }
  };
  records.accounts.forEach(account => {
    if (!Number.isFinite(account.openingBalance)) issues.push({ severity: 'ERROR', type: 'invalid_amount', entityType: 'financial_account', entityId: account.id, message: 'Account opening balance is not a finite amount.' });
    if (!isValidDateOnly(account.openingBalanceDate)) issues.push({ severity: 'ERROR', type: 'invalid_date', entityType: 'financial_account', entityId: account.id, message: 'Account opening balance date is invalid.' });
  });

  records.payments.forEach(payment => {
    const linkedSaleId = payment.saleId && sales.has(payment.saleId)
      ? payment.saleId : invoiceToSaleId.get(payment.invoiceId || '');
    if (!linkedSaleId || !sales.has(linkedSaleId)) {
      issues.push({ severity: 'ERROR', type: 'orphaned_payment', entityType: 'payment', entityId: payment.id, message: 'Payment is not linked to an existing sale.', suggestedFix: 'Review the payment and attach it to the correct sale or void it.' });
    }
    if (!customers.has(payment.customerId)) {
      issues.push({ severity: 'ERROR', type: 'missing_customer', entityType: 'payment', entityId: payment.id, message: 'Payment customer does not exist.' });
    }
    checkAmount(payment.amount, 'payment', payment.id);
    if (payment.amount === 0) issues.push({ severity: 'ERROR', type: 'invalid_amount', entityType: 'payment', entityId: payment.id, message: 'Payment amount must be greater than zero.' });
    if (!isValidDateOnly(payment.paymentDate)) issues.push({ severity: 'ERROR', type: 'invalid_date', entityType: 'payment', entityId: payment.id, message: 'Payment date is invalid.' });
    const method = records.paymentMethods.find(item => item.id === payment.paymentMethodId);
    if (method?.requireTransactionId && !payment.transactionId?.trim()) {
      issues.push({ severity: 'WARNING', type: 'missing_transaction_id', entityType: 'payment', entityId: payment.id, message: 'Payment method requires a transaction ID but this payment has none.' });
    }
    if (payment.financialAccountId && !accounts.has(payment.financialAccountId)) {
      issues.push({ severity: 'ERROR', type: 'missing_account', entityType: 'payment', entityId: payment.id, message: 'Payment refers to a missing financial account.' });
    }
    if (!payment.paymentMethod && !payment.paymentMethodId) {
      issues.push({ severity: 'ERROR', type: 'missing_payment_method', entityType: 'payment', entityId: payment.id, message: 'Payment is missing its payment method.' });
    }
    if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial') {
      const paymentLedgerEntry = paymentMovementIds.has(payment.id);
      if (!paymentLedgerEntry) issues.push({ severity: 'WARNING', type: 'missing_payment_movement', entityType: 'payment', entityId: payment.id, message: 'Received payment has no account ledger movement.', suggestedFix: 'Assign a financial account and verify whether this receipt was recorded.' });
    }
  });

  const transactionsById = new Map<string, Payment>();
  const operationsById = new Map<string, Payment>();
  records.payments.forEach(payment => {
    if (payment.operationId) {
      const existingOperation = operationsById.get(payment.operationId);
      if (existingOperation) issues.push({ severity: 'ERROR', type: 'duplicate_payment_posting', entityType: 'payment', entityId: payment.id, message: `Payment operation was already recorded as ${existingOperation.id}.` });
      else operationsById.set(payment.operationId, payment);
    }
    const transactionId = payment.transactionId?.trim().toLocaleLowerCase();
    if (!transactionId) return;
    const first = transactionsById.get(transactionId);
    if (first) issues.push({ severity: 'ERROR', type: 'duplicate_transaction_id', entityType: 'payment', entityId: payment.id, message: `Transaction ID is duplicated by payment ${first.id}.` });
    else transactionsById.set(transactionId, payment);
  });

  records.sales.forEach(sale => {
    const linkedPayments = paymentsBySaleId.get(sale.id) || [];
    const matchingPayments = linkedPayments.filter(payment =>
      payment.customerId === sale.customerId && payment.currency === sale.currency
    );
    const postedPayments = matchingPayments.filter(payment =>
      payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial'
    );
    const rawPaid = postedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    if (rawPaid > sale.amount + 0.005) {
      issues.push({ severity: 'ERROR', type: 'payment_exceeds_sale', entityType: 'sale', entityId: sale.id, message: 'Effective payments exceed the sale total.' });
    }
    if (sale.amount < 0 || !Number.isFinite(sale.amount)) checkAmount(sale.amount, 'sale', sale.id);
    const invoice = invoicesBySaleId.get(sale.id);
    if (invoice) {
      const salePayments = sale.subscriptionId
        ? [...new Map([
          ...matchingPayments,
          ...(paymentsBySubscriptionId.get(sale.subscriptionId) || []),
        ].map(payment => [payment.id, payment])).values()]
        : matchingPayments;
      const paid = getSalePaidAmount(sale, salePayments);
      const due = getSaleDueAmount(sale, salePayments);
      if (Math.abs(invoice.paidAmount - paid) > 0.01 || Math.abs(invoice.dueAmount - due) > 0.01) {
        issues.push({ severity: 'WARNING', type: 'invoice_payment_totals', entityType: 'invoice', entityId: invoice.invoiceId, message: 'Invoice paid or due totals differ from the linked sale payment calculation.' });
      }
    }
  });
  records.expenses.forEach(expense => {
    checkAmount(expense.amount, 'expense', expense.id);
    if (expense.amount === 0) issues.push({ severity: 'ERROR', type: 'invalid_amount', entityType: 'expense', entityId: expense.id, message: 'Expense amount must be greater than zero.' });
    if (!isValidDateOnly(expense.date)) issues.push({ severity: 'ERROR', type: 'invalid_date', entityType: 'expense', entityId: expense.id, message: 'Expense date is invalid.' });
    if (!accounts.has(expense.accountId)) issues.push({ severity: 'ERROR', type: 'missing_account', entityType: 'expense', entityId: expense.id, message: 'Expense refers to a missing financial account.' });
    if (expense.status === 'posted' && !expenseMovementIds.has(expense.id)) {
      issues.push({ severity: 'WARNING', type: 'missing_expense_movement', entityType: 'expense', entityId: expense.id, message: 'Posted expense has no account ledger movement.' });
    }
  });
  records.invoices.forEach(invoice => {
    if (!sales.has(invoice.saleId)) issues.push({ severity: 'ERROR', type: 'orphaned_invoice', entityType: 'invoice', entityId: invoice.invoiceId, message: 'Invoice is not linked to an existing sale.' });
  });
  records.subscriptions.forEach(subscription => {
    if (!customers.has(subscription.customerId) || !services.has(subscription.serviceId)) {
      issues.push({ severity: 'ERROR', type: 'orphaned_subscription', entityType: 'subscription', entityId: subscription.id, message: 'Subscription has a missing customer or service relationship.' });
    }
  });
  records.transfers.forEach(transfer => {
    checkAmount(transfer.amount, 'transfer', transfer.id);
    if (transfer.amount === 0) issues.push({ severity: 'ERROR', type: 'invalid_amount', entityType: 'transfer', entityId: transfer.id, message: 'Transfer amount must be greater than zero.' });
    if (!isValidDateOnly(transfer.date)) issues.push({ severity: 'ERROR', type: 'invalid_date', entityType: 'transfer', entityId: transfer.id, message: 'Transfer date is invalid.' });
    if (transfer.fromAccountId === transfer.toAccountId) issues.push({ severity: 'ERROR', type: 'invalid_transfer', entityType: 'transfer', entityId: transfer.id, message: 'Transfer source and destination accounts are the same.' });
    if (!accounts.has(transfer.fromAccountId) || !accounts.has(transfer.toAccountId)) issues.push({ severity: 'ERROR', type: 'missing_transfer_account', entityType: 'transfer', entityId: transfer.id, message: 'Transfer refers to a missing account.' });
  });
  records.adjustments.forEach(adjustment => {
    if (!Number.isFinite(adjustment.amount) || adjustment.amount === 0) issues.push({ severity: 'ERROR', type: 'invalid_amount', entityType: 'adjustment', entityId: adjustment.id, message: 'Financial adjustment amount must be non-zero.' });
    if (!accounts.has(adjustment.accountId)) issues.push({ severity: 'ERROR', type: 'missing_account', entityType: 'adjustment', entityId: adjustment.id, message: 'Adjustment refers to a missing financial account.' });
    if (!isValidDateOnly(adjustment.date)) issues.push({ severity: 'ERROR', type: 'invalid_date', entityType: 'adjustment', entityId: adjustment.id, message: 'Adjustment date is invalid.' });
  });
  records.invoices.forEach(invoice => {
    checkAmount(invoice.totalAmount, 'invoice', invoice.invoiceId);
    if (!isValidDateOnly(invoice.invoiceDate) || (invoice.dueDate && !isValidDateOnly(invoice.dueDate))) {
      issues.push({ severity: 'ERROR', type: 'invalid_date', entityType: 'invoice', entityId: invoice.invoiceId, message: 'Invoice date or due date is invalid.' });
    }
  });
  records.reconciliations.forEach(reconciliation => {
    if (!isValidDateOnly(reconciliation.reconciliationDate)) issues.push({ severity: 'ERROR', type: 'invalid_reconciliation', entityType: 'reconciliation', entityId: reconciliation.id, message: 'Reconciliation date is invalid.' });
    if (!accounts.has(reconciliation.accountId)) issues.push({ severity: 'ERROR', type: 'invalid_reconciliation', entityType: 'reconciliation', entityId: reconciliation.id, message: 'Reconciliation refers to a missing financial account.' });
    if (Math.abs((reconciliation.actualBalance - reconciliation.systemBalance) - reconciliation.difference) > 0.01) {
      issues.push({ severity: 'ERROR', type: 'invalid_reconciliation', entityType: 'reconciliation', entityId: reconciliation.id, message: 'Reconciliation difference does not match actual minus system balance.' });
    }
  });
  const movementDates = [...new Set(ledger
    .filter(entry => entry.paymentId || entry.expenseId || entry.transferId)
    .map(entry => entry.date))].sort();
  const dailyClosingMovementDates = [...new Set(ledger
    .filter(entry => entry.type !== 'opening_balance' && entry.type !== 'transfer')
    .map(entry => entry.date))].sort();
  const closeDatesByBusiness = new Map<string, Set<string>>();
  records.dailyClosings.forEach(closing => {
    if (closing.status !== 'closed') return;
    const dates = closeDatesByBusiness.get(closing.businessId) || new Set<string>();
    dates.add(closing.date);
    closeDatesByBusiness.set(closing.businessId, dates);
  });
  const paymentsByDate = [...records.payments].sort((left, right) => left.paymentDate.localeCompare(right.paymentDate));
  const expensesByDate = [...records.expenses].sort((left, right) => left.date.localeCompare(right.date));
  const paymentDates = paymentsByDate.map(payment => payment.paymentDate);
  const expenseDates = expensesByDate.map(expense => expense.date);
  const hasLateChanges = (startDate: string, endDate: string): boolean => {
    const paymentIndex = lowerBound(paymentDates, startDate);
    for (let index = paymentIndex; index < paymentsByDate.length && paymentsByDate[index].paymentDate <= endDate; index += 1) {
      const payment = paymentsByDate[index];
      if (payment.createdAt && payment.createdAt.slice(0, 10) > endDate) return true;
    }
    const expenseIndex = lowerBound(expenseDates, startDate);
    for (let index = expenseIndex; index < expensesByDate.length && expensesByDate[index].date <= endDate; index += 1) {
      if (expensesByDate[index].updatedAt.slice(0, 10) > endDate) return true;
    }
    return false;
  };
  const hasDateInRange = (dates: string[], startDate: string, endDate: string): boolean => {
    const index = lowerBound(dates, startDate);
    return index < dates.length && dates[index] <= endDate;
  };
  records.periods.forEach(period => {
    if (period.startDate > period.endDate) issues.push({ severity: 'ERROR', type: 'invalid_period', entityType: 'financial_period', entityId: period.id, message: 'Financial period start date is after its end date.' });
    const periodHasMovements = period.status === 'closed'
      && hasDateInRange(movementDates, period.startDate, period.endDate);
    if (periodHasMovements && hasLateChanges(period.startDate, period.endDate)) {
      issues.push({
        severity: 'WARNING',
        type: 'transaction_in_closed_period',
        entityType: 'financial_period',
        entityId: period.id,
        message: 'A financial record was changed after its accounting period had been closed.',
      });
    }
    if (period.status === 'closed') {
      const closeDates = closeDatesByBusiness.get(period.businessId) || new Set<string>();
      const movementIndex = lowerBound(dailyClosingMovementDates, period.startDate);
      for (let index = movementIndex; index < dailyClosingMovementDates.length
        && dailyClosingMovementDates[index] <= period.endDate; index += 1) {
        const date = dailyClosingMovementDates[index];
        if (!closeDates.has(date)) issues.push({
          severity: 'WARNING',
          type: 'incomplete_daily_closing',
          entityType: 'financial_period',
          entityId: period.id,
          message: `Financial day ${date} has movements but no daily closing.`,
          suggestedFix: 'Review and close the day before period review.',
        });
      }
    }
  });
  const ledgerIds = new Set<string>();
  ledger.forEach(entry => {
    if (ledgerIds.has(entry.id)) issues.push({ severity: 'ERROR', type: 'duplicate_ledger_entry', entityType: 'ledger', entityId: entry.id, message: 'Duplicate ledger movement ID detected.' });
    ledgerIds.add(entry.id);
  });
  records.dailyClosings.forEach(closing => {
    if (!isValidDateOnly(closing.date)) issues.push({ severity: 'ERROR', type: 'invalid_daily_closing', entityType: 'daily_closing', entityId: closing.id, message: 'Daily closing date is invalid.' });
    const expectedDifference = closing.actualClosingBalance - closing.expectedClosingBalance;
    if (Math.abs(expectedDifference - closing.difference) > 0.01) {
      issues.push({ severity: 'ERROR', type: 'invalid_daily_closing', entityType: 'daily_closing', entityId: closing.id, message: 'Daily closing difference does not match actual minus expected balance.' });
    }
    closing.accounts.forEach(account => {
      if (Math.abs((account.actualClosingBalance - account.expectedClosingBalance) - account.difference) > 0.01
        || !accounts.has(account.accountId)) {
        issues.push({ severity: 'ERROR', type: 'invalid_daily_closing', entityType: 'daily_closing', entityId: closing.id, message: `Daily closing account entry is invalid for ${account.accountName}.` });
      }
    });
  });
  const seenOpenings = new Set<string>();
  records.accounts.forEach(account => {
    const key = `${account.id}:${account.openingBalanceDate}`;
    if (seenOpenings.has(key)) issues.push({ severity: 'ERROR', type: 'duplicate_opening_balance', entityType: 'financial_account', entityId: account.id, message: 'Duplicate opening balance account/date detected.' });
    seenOpenings.add(key);
  });
  return issues;
}

export function getAccountingLedgerBalance(
  account: FinancialAccount,
  ledger: FinancialLedgerEntry[],
  date?: string
): number {
  return getAccountBalanceAtDate(account, ledger, date || '9999-12-31', account.currency);
}
