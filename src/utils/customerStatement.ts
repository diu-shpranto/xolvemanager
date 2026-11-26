import type {
  AppCurrency,
  Customer,
  FinancialAccount,
  Invoice,
  Payment,
  Sale,
  Service,
  Subscription,
} from '../types';
import { getSaleDueAmount, getCustomerAdvanceCredit, getSaleLineItems } from './saleUtils';
import { calculateSalesFinancialSummary, convertReportCurrency } from './reportMetrics';
import { getSubscriptionStatusForTimeZone } from './dateUtils';

export type CustomerStatementTransactionType =
  | 'invoice'
  | 'discount'
  | 'payment'
  | 'advance_created'
  | 'advance_applied'
  | 'refund';

export type CustomerStatementFilter = 'all' | 'payments' | 'invoices' | 'advances' | 'refunds';

export interface CustomerStatementEntry {
  id: string;
  date: string;
  timestamp: string;
  hasExactTime: boolean;
  reference: string;
  type: CustomerStatementTransactionType;
  description: string;
  invoiceNumber?: string;
  debit: number;
  credit: number;
  memoAmount?: number;
  runningBalance: number;
  paymentMethod?: string;
  account?: string;
  notes?: string;
  verified: boolean;
  saleId?: string;
  invoiceId?: string;
  paymentIds?: string[];
}

export interface CustomerStatementSummary {
  serviceSales: number;
  amountReceived: number;
  totalDue: number;
  availableAdvance: number;
  totalDiscounts: number;
  activeSubscriptions: number;
  overdueInvoices: number;
}

export interface CustomerStatement {
  currency: AppCurrency;
  entries: CustomerStatementEntry[];
  summary: CustomerStatementSummary;
}

export interface BuildCustomerStatementOptions {
  customerId: string;
  currency: AppCurrency;
  sales: Sale[];
  invoices: Invoice[];
  payments: Payment[];
  subscriptions: Subscription[];
  services: Service[];
  accounts: FinancialAccount[];
  today: string;
  timeZone?: string;
  reminderNoticeDays?: number;
  businessId?: string;
}

const minor = (value: number) => Number.isFinite(value) ? Math.round(value * 100) : 0;
const amount = (value: number) => value / 100;
const convert = (value: number, from: AppCurrency, to: AppCurrency) =>
  amount(minor(convertReportCurrency(value, from, to)));
const validTimestamp = (value?: string): value is string =>
  Boolean(value && Number.isFinite(Date.parse(value)));
const dateOnly = (value: string) => value.slice(0, 10);
const eligibleForBusiness = (record: { businessId?: string }, businessId?: string) =>
  !businessId || !record.businessId || record.businessId === businessId;

function paymentCashCredited(payment: Payment, sale?: Sale): number {
  const received = Math.max(0, Number(payment.amount) || 0);
  const explicitAdvance = Math.max(0, Number(payment.advanceCreditAmount) || 0);

  if (payment.allocations !== undefined) {
    const cashAllocated = payment.allocations
      .filter(allocation => allocation.fundingSource !== 'advance_credit')
      .reduce((sum, allocation) => sum + Math.max(0, Number(allocation.amount) || 0), 0);
    return Math.min(received, cashAllocated + explicitAdvance);
  }

  if (sale || payment.invoiceId || explicitAdvance > 0) {
    return Math.min(received, Math.max(0, received - explicitAdvance) + explicitAdvance);
  }

  return 0;
}

function descriptionForSale(sale: Sale, services: Map<string, Service>): string {
  return getSaleLineItems(sale).map(item => {
    const name = item.serviceNameSnapshot || services.get(item.serviceId)?.name || 'Service unavailable';
    return `${name}${item.plan ? ` · ${item.plan}` : ''}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`;
  }).join('; ');
}

export function buildCustomerStatement({
  customerId,
  currency,
  sales,
  invoices,
  payments,
  subscriptions,
  services,
  accounts,
  today,
  timeZone,
  reminderNoticeDays = 7,
  businessId,
}: BuildCustomerStatementOptions): CustomerStatement {
  const customerSales = sales.filter(sale =>
    sale.customerId === customerId && eligibleForBusiness(sale, businessId)
  );
  const customerInvoices = invoices.filter(invoice =>
    invoice.customerId === customerId && eligibleForBusiness(invoice, businessId)
  );
  const customerPayments = payments.filter(payment =>
    payment.customerId === customerId && eligibleForBusiness(payment, businessId)
  );
  const customerSubscriptions = subscriptions.filter(subscription =>
    subscription.customerId === customerId && eligibleForBusiness(subscription, businessId)
  );
  const saleById = new Map(customerSales.map(sale => [sale.id, sale]));
  const invoiceById = new Map(customerInvoices.map(invoice => [invoice.invoiceId, invoice]));
  const invoiceBySaleId = new Map(customerInvoices.map(invoice => [invoice.saleId, invoice]));
  const serviceById = new Map(services.map(service => [service.id, service]));
  const accountById = new Map(accounts.map(account => [account.id, account.name]));
  const eventRows: Array<CustomerStatementEntry & { sortTime: number; sortRank: number }> = [];
  const add = (
    entry: Omit<CustomerStatementEntry, 'runningBalance'> & { runningBalance?: number },
    sortRank: number
  ) => {
    const parsedTime = Date.parse(entry.timestamp);
    if (!Number.isFinite(parsedTime)) return;
    eventRows.push({ ...entry, runningBalance: 0, sortTime: parsedTime, sortRank });
  };

  customerSales.forEach(sale => {
    if (sale.paymentStatus === 'voided') return;
    const invoice = invoiceBySaleId.get(sale.id);
    if (invoice?.paymentStatus === 'voided') return;
    const timestamp = validTimestamp(sale.createdAt) ? sale.createdAt : sale.date;
    const discount = Math.max(0, Number(sale.discount) || 0);
    const grossCharge = Math.max(0, Number(sale.amount) || 0) + discount;
    add({
      id: `invoice:${sale.id}`,
      date: sale.date,
      timestamp,
      hasExactTime: validTimestamp(sale.createdAt),
      reference: invoice?.invoiceNumber || sale.invoiceNo,
      type: 'invoice',
      description: descriptionForSale(sale, serviceById),
      invoiceNumber: invoice?.invoiceNumber || sale.invoiceNo,
      debit: convert(grossCharge, sale.currency, currency),
      credit: 0,
      runningBalance: 0,
      verified: Boolean(invoice || sale.invoiceNo),
      saleId: sale.id,
      invoiceId: invoice?.invoiceId,
    }, 0);
    if (discount > 0) {
      add({
        id: `discount:${sale.id}`,
        date: sale.date,
        timestamp,
        hasExactTime: validTimestamp(sale.createdAt),
        reference: invoice?.invoiceNumber || sale.invoiceNo,
        type: 'discount',
        description: `Discount on ${invoice?.invoiceNumber || sale.invoiceNo}`,
        invoiceNumber: invoice?.invoiceNumber || sale.invoiceNo,
        debit: 0,
        credit: convert(discount, sale.currency, currency),
        runningBalance: 0,
        verified: Boolean(invoice || sale.invoiceNo),
        saleId: sale.id,
        invoiceId: invoice?.invoiceId,
      }, 1);
    }
  });

  customerInvoices.forEach(invoice => {
    if (saleById.has(invoice.saleId) || invoice.paymentStatus === 'voided') return;
    const timestamp = validTimestamp(invoice.createdAt) ? invoice.createdAt : invoice.invoiceDate;
    add({
      id: `invoice-unverified:${invoice.invoiceId}`,
      date: invoice.invoiceDate,
      timestamp,
      hasExactTime: validTimestamp(invoice.createdAt),
      reference: invoice.invoiceNumber,
      type: 'invoice',
      description: 'Invoice linked sale is unavailable; amount excluded because currency cannot be verified.',
      invoiceNumber: invoice.invoiceNumber,
      debit: 0,
      credit: 0,
      runningBalance: 0,
      verified: false,
      notes: 'The invoice record does not store a currency and its linked sale is missing.',
      invoiceId: invoice.invoiceId,
    }, 0);
  });

  customerPayments.forEach(payment => {
    const sale = saleById.get(payment.saleId || '')
      || saleById.get(invoiceById.get(payment.invoiceId || '')?.saleId || '')
      || saleById.get(payment.allocations?.find(item => item.fundingSource !== 'advance_credit')?.saleId || '');
    const invoice = invoiceById.get(payment.invoiceId || '')
      || (sale ? invoiceBySaleId.get(sale.id) : undefined);
    const account = payment.financialAccountId
      ? accountById.get(payment.financialAccountId)
      : undefined;
    const paymentDate = payment.paymentDate;
    const timestamp = validTimestamp(payment.createdAt) ? payment.createdAt : paymentDate;
    const hasExactTime = validTimestamp(payment.createdAt);
    const invoiceNumber = invoice?.invoiceNumber || sale?.invoiceNo;
    const reference = payment.transactionId?.trim() || payment.id;
    const notes = payment.notes;

    if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial') {
      const received = Math.max(0, Number(payment.amount) || 0);
      const credited = paymentCashCredited(payment, sale);
      const unallocated = Math.max(0, received - credited);
      add({
        id: `payment:${payment.id}`,
        date: paymentDate,
        timestamp,
        hasExactTime,
        reference,
        type: 'payment',
        description: payment.paymentStatus === 'partial' ? 'Partial payment received' : 'Payment received',
        invoiceNumber,
        debit: 0,
        credit: convert(credited, payment.currency, currency),
        runningBalance: 0,
        paymentMethod: payment.paymentMethodName || payment.paymentMethod,
        account: account || payment.paymentAccount || undefined,
        notes: unallocated > 0
          ? [notes, `${unallocated.toFixed(2)} ${payment.currency} has no recorded allocation and is excluded from the balance.`].filter(Boolean).join(' · ')
          : notes,
        verified: Boolean(payment.allocations !== undefined || sale || invoice || payment.advanceCreditAmount),
        saleId: sale?.id,
        invoiceId: invoice?.invoiceId,
        paymentIds: [payment.id],
      }, 2);

      const advanceCreated = Math.max(0, Number(payment.advanceCreditAmount) || 0);
      if (advanceCreated > 0) {
        add({
          id: `advance-created:${payment.id}`,
          date: paymentDate,
          timestamp,
          hasExactTime,
          reference,
          type: 'advance_created',
          description: 'Advance payment saved from this receipt; counted in the payment above.',
          invoiceNumber,
          debit: 0,
          credit: 0,
          memoAmount: convert(advanceCreated, payment.currency, currency),
          runningBalance: 0,
          paymentMethod: payment.paymentMethodName || payment.paymentMethod,
          account: account || payment.paymentAccount || undefined,
          notes,
          verified: true,
          saleId: sale?.id,
          invoiceId: invoice?.invoiceId,
          paymentIds: [payment.id],
        }, 3);
      }
    } else if (payment.paymentStatus === 'refunded') {
      const originalExists = customerPayments.some(item => item.id === payment.refundOfPaymentId);
      add({
        id: `refund:${payment.id}`,
        date: paymentDate,
        timestamp,
        hasExactTime,
        reference,
        type: 'refund',
        description: 'Payment refunded',
        invoiceNumber,
        debit: convert(Math.max(0, Number(payment.amount) || 0), payment.currency, currency),
        credit: 0,
        runningBalance: 0,
        paymentMethod: payment.paymentMethodName || payment.paymentMethod,
        account: account || payment.paymentAccount || undefined,
        notes,
        verified: Boolean(payment.refundOfPaymentId && originalExists),
        saleId: sale?.id,
        invoiceId: invoice?.invoiceId,
        paymentIds: [payment.id, ...(payment.refundOfPaymentId ? [payment.refundOfPaymentId] : [])],
      }, 4);
    }
  });

  const applications = new Map<string, {
    amount: number;
    timestamp: string;
    date: string;
    paymentIds: Set<string>;
    saleIds: Set<string>;
    invoiceIds: Set<string>;
  }>();
  customerPayments.forEach(payment => {
    (payment.allocations || []).forEach((allocation, index) => {
      if (allocation.fundingSource !== 'advance_credit') return;
      const applicationId = allocation.advanceApplicationId || allocation.id || `${payment.id}:${index}`;
      const application = applications.get(applicationId) || {
        amount: 0,
        timestamp: validTimestamp(allocation.createdAt)
          ? allocation.createdAt
          : validTimestamp(payment.createdAt) ? payment.createdAt : payment.paymentDate,
        date: validTimestamp(allocation.createdAt)
          ? dateOnly(allocation.createdAt)
          : payment.paymentDate,
        paymentIds: new Set<string>(),
        saleIds: new Set<string>(),
        invoiceIds: new Set<string>(),
      };
      application.amount += Math.max(0, Number(allocation.amount) || 0);
      application.paymentIds.add(payment.id);
      application.saleIds.add(allocation.saleId);
      if (allocation.invoiceId) application.invoiceIds.add(allocation.invoiceId);
      applications.set(applicationId, application);
    });
  });
  applications.forEach((application, applicationId) => {
    const saleId = [...application.saleIds][0];
    const sale = saleById.get(saleId);
    const invoiceId = [...application.invoiceIds][0] || (sale ? invoiceBySaleId.get(sale.id)?.invoiceId : undefined);
    const invoice = invoiceId ? invoiceById.get(invoiceId) : undefined;
    const sourcePaymentIds = [...application.paymentIds];
    const sourcePayments = sourcePaymentIds.map(id => customerPayments.find(payment => payment.id === id)).filter(
      (payment): payment is Payment => Boolean(payment)
    );
    const sourceCurrency = sale?.currency || sourcePayments[0]?.currency || currency;
    const appliedAmount = convert(application.amount, sourceCurrency, currency);
    add({
      id: `advance-applied:${applicationId}`,
      date: application.date,
      timestamp: application.timestamp,
      hasExactTime: application.timestamp.includes('T'),
      reference: applicationId,
      type: 'advance_applied',
      description: 'Earlier advance payment used for an invoice; no new cash received.',
      invoiceNumber: invoice?.invoiceNumber || sale?.invoiceNo,
      debit: appliedAmount,
      credit: appliedAmount,
      runningBalance: 0,
      paymentMethod: 'Advance payment',
      account: 'Customer advance',
      verified: Boolean(sale && sourcePaymentIds.length),
      saleId,
      invoiceId: invoice?.invoiceId,
      paymentIds: sourcePaymentIds,
    }, 3);
  });

  const sortedEvents = eventRows.sort((left, right) =>
    left.sortTime - right.sortTime
      || left.sortRank - right.sortRank
      || left.reference.localeCompare(right.reference)
      || left.id.localeCompare(right.id)
  );
  let runningMinor = 0;
  const entries = sortedEvents.map(({ sortTime: _sortTime, sortRank: _sortRank, ...entry }) => {
    runningMinor += minor(entry.debit) - minor(entry.credit);
    return { ...entry, runningBalance: amount(runningMinor) };
  });

  const validSales = customerSales.filter(sale =>
    sale.paymentStatus !== 'voided'
    && sale.paymentStatus !== 'failed'
    && sale.paymentStatus !== 'refunded'
    && Number.isFinite(Number(sale.amount))
  );
  const salesSummary = calculateSalesFinancialSummary(validSales, customerPayments, currency);
  const statusForTimeZone = getSubscriptionStatusForTimeZone(timeZone);
  // Evaluate subscription status against the statement's `today` (noon UTC keeps
  // the date stable across time zones) instead of the real clock, so a statement
  // for a past date reports the status as of that date.
  const todayDate = new Date(`${today}T12:00:00.000Z`);
  const activeSubscriptions = customerSubscriptions.filter(subscription =>
    statusForTimeZone(subscription, serviceById.get(subscription.serviceId), reminderNoticeDays, todayDate) === 'active'
  ).length;
  const overdueInvoices = customerInvoices.filter(invoice => {
    if (invoice.paymentStatus === 'voided') return false;
    const sale = saleById.get(invoice.saleId);
    const due = sale ? getSaleDueAmount(sale, customerPayments) : Math.max(0, invoice.dueAmount);
    const dueDate = invoice.dueDate || sale?.expectedPaymentDate;
    return due > 0 && Boolean(dueDate && dueDate < today);
  }).length;
  const totalDiscounts = validSales.reduce(
    (total, sale) => total + convert(Math.max(0, Number(sale.discount) || 0), sale.currency, currency),
    0
  );
  const amountReceived = customerPayments
    .filter(payment => payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
    .reduce((total, payment) => total + convert(Math.max(0, Number(payment.amount) || 0), payment.currency, currency), 0);

  return {
    currency,
    entries,
    summary: {
      serviceSales: salesSummary.revenue,
      amountReceived,
      totalDue: salesSummary.due,
      availableAdvance: convert(getCustomerAdvanceCredit(customerPayments, customerId, currency), currency, currency),
      totalDiscounts,
      activeSubscriptions,
      overdueInvoices,
    },
  };
}

export interface CustomerStatementPeriod {
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  entries: CustomerStatementEntry[];
}

export function getCustomerStatementPeriod(
  entries: CustomerStatementEntry[],
  startDate = '',
  endDate = ''
): CustomerStatementPeriod {
  const periodEntries = entries.filter(entry =>
    (!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate)
  );
  const openingBalance = startDate
    ? [...entries].filter(entry => entry.date < startDate).at(-1)?.runningBalance || 0
    : 0;
  const beforeEnd = endDate
    ? [...entries].filter(entry => entry.date <= endDate)
    : entries;
  const closingBalance = beforeEnd.at(-1)?.runningBalance || openingBalance;
  return {
    openingBalance,
    debitTotal: periodEntries.reduce((total, entry) => total + entry.debit, 0),
    creditTotal: periodEntries.reduce((total, entry) => total + entry.credit, 0),
    closingBalance,
    entries: periodEntries,
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] || character);

export interface CustomerStatementPrintData {
  customer: Customer;
  businessName: string;
  currency: AppCurrency;
  generatedAt: string;
  dateRange: string;
  openingBalance: string;
  debitTotal: string;
  creditTotal: string;
  closingBalance: string;
  outstandingDue: string;
  availableAdvance: string;
  entries: CustomerStatementEntry[];
  filterLabel?: string;
}

export function renderCustomerStatementHtml(data: CustomerStatementPrintData): string {
  const rows = data.entries.map(entry => `<tr>
    <td>${escapeHtml(entry.date)}<br><small>${escapeHtml(entry.hasExactTime ? entry.timestamp : 'Time not recorded')}</small></td>
    <td>${escapeHtml(entry.reference)}${entry.verified ? '' : '<br><strong>Unverified</strong>'}</td>
    <td>${escapeHtml(entry.type.replaceAll('_', ' '))}</td>
    <td>${escapeHtml(entry.description)}${entry.invoiceNumber ? `<br><small>${escapeHtml(entry.invoiceNumber)}</small>` : ''}</td>
    <td class="amount">${escapeHtml(formatStatementCurrency(entry.debit, data.currency))}</td>
    <td class="amount">${escapeHtml(formatStatementCurrency(entry.credit, data.currency))}</td>
    <td class="amount">${escapeHtml(formatStatementCurrency(entry.runningBalance, data.currency))}</td>
    <td>${escapeHtml(entry.paymentMethod || '—')}<br>${escapeHtml(entry.account || '—')}</td>
  </tr>`).join('');
  const emptyRow = '<tr><td colspan="8">No payments or invoices yet.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Account statement</title><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;color:#1f2937;font:12px/1.5 Arial,sans-serif}.header{border-bottom:3px solid #6d28d9;padding-bottom:14px}.brand{color:#6d28d9;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h1{margin:5px 0;font-size:24px}.muted,small{color:#64748b;font-size:10px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.card{border:1px solid #e2e8f0;border-radius:8px;padding:10px}.label{display:block;color:#64748b;font-size:10px}.value{font-size:14px;font-weight:700}.balance{margin:8px 0;padding:10px;background:#f5f3ff;border-radius:8px}.balance span{margin-right:20px}.filters{color:#64748b;font-size:10px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:12px;font-size:9px}th,td{border-bottom:1px solid #e2e8f0;padding:6px 5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f8fafc;color:#475569}td.amount{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}@media print{@page{size:landscape;margin:10mm}body{padding:0}.card{break-inside:avoid}}
  </style></head><body><header class="header"><div class="brand">XolveManager · Account statement</div><h1>${escapeHtml(data.businessName)}</h1><p>${escapeHtml(data.customer.name)} · ${escapeHtml(data.customer.phone || 'No phone')} · ${escapeHtml(data.customer.email || 'No email')}</p><p class="muted">Made ${escapeHtml(data.generatedAt)} · Dates: ${escapeHtml(data.dateRange)} · Currency: ${escapeHtml(data.currency)}</p></header>
    <section class="summary"><div class="card"><span class="label">Added to amount due</span><strong class="value">${escapeHtml(data.debitTotal)}</strong></div><div class="card"><span class="label">Paid or reduced</span><strong class="value">${escapeHtml(data.creditTotal)}</strong></div><div class="card"><span class="label">Amount still due</span><strong class="value">${escapeHtml(data.outstandingDue)}</strong></div><div class="card"><span class="label">Advance payment</span><strong class="value">${escapeHtml(data.availableAdvance)}</strong></div><div class="card"><span class="label">Balance before dates</span><strong class="value">${escapeHtml(data.openingBalance)}</strong></div><div class="card"><span class="label">Balance at end</span><strong class="value">${escapeHtml(data.closingBalance)}</strong></div></section>
    <p class="filters">A positive balance means the customer owes money. A negative balance means the customer has an advance payment. Totals include all activity in these dates.</p>
    ${data.filterLabel ? `<p class="filters">Showing: ${escapeHtml(data.filterLabel)}.</p>` : ''}
    <table><thead><tr><th>Date and time</th><th>Reference</th><th>Type</th><th>Details</th><th>Added to due</th><th>Paid or reduced</th><th>Balance</th><th>Payment / account</th></tr></thead><tbody>${rows || emptyRow}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`;
}

function formatStatementCurrency(value: number, currency: AppCurrency): string {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
