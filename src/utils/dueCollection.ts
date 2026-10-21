import type {
  AppCurrency,
  Customer,
  Invoice,
  Payment,
  Sale,
  Subscription,
} from '../types';
import { resolvePaymentCustomer, resolveSaleCustomer } from './relationships.ts';
import { convertReportCurrency } from './reportMetrics.ts';
import {
  getSaleDueAmount,
  getSalePaidAmount,
} from './saleUtils.ts';

export const customerDueFollowUpStatuses = [
  'follow_up_required',
  'contacted',
  'promise_to_pay',
  'partially_settled',
  'resolved',
] as const;

export type CustomerDueFollowUpStatus = (typeof customerDueFollowUpStatuses)[number];

export interface CustomerDueFollowUp {
  status: CustomerDueFollowUpStatus;
  note?: string;
  updatedAt: string;
}

export type CustomerDueFollowUps = Record<string, CustomerDueFollowUp>;

export interface CustomerDueTransaction {
  sale: Sale;
  invoice?: Invoice;
  charged: number;
  paid: number;
  due: number;
  overdue: number;
}

export interface CustomerDueSummary {
  customer: Customer;
  currency: AppCurrency;
  charged: number;
  paid: number;
  due: number;
  overdue: number;
  earliestOverdueDate?: string;
  lastPaymentDate?: string;
  transactions: CustomerDueTransaction[];
}

export interface DueCollectionSummary {
  customers: CustomerDueSummary[];
  totalOutstanding: number;
  overdueAmount: number;
  partiallyPaidTransactions: number;
  fullyPaidTransactions: number;
  paymentsCollected: number;
}

const validDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export function buildDueCollectionSummary({
  sales,
  payments,
  invoices,
  customers,
  subscriptions,
  currency,
  today,
  dateRange,
}: {
  sales: Sale[];
  payments: Payment[];
  invoices: Invoice[];
  customers: Customer[];
  subscriptions: Subscription[];
  currency: AppCurrency;
  today: string;
  dateRange: { start: string; end: string };
}): DueCollectionSummary {
  const customersById = new Map(customers.map(customer => [customer.id, customer]));
  const invoiceBySaleId = new Map<string, Invoice>();
  invoices.forEach(invoice => {
    if (!invoiceBySaleId.has(invoice.saleId)) invoiceBySaleId.set(invoice.saleId, invoice);
  });
  const salesByCustomerId = new Map<string, Sale[]>();
  const eligibleSales = sales.filter(sale =>
    Number.isFinite(Number(sale.amount))
    && Number(sale.amount) > 0
    && sale.paymentStatus !== 'failed'
    && sale.paymentStatus !== 'refunded'
    && Boolean(resolveSaleCustomer(sale, customers, subscriptions))
  );

  let totalOutstanding = 0;
  let overdueAmount = 0;
  let partiallyPaidTransactions = 0;
  let fullyPaidTransactions = 0;

  eligibleSales.forEach(sale => {
    const customer = resolveSaleCustomer(sale, customers, subscriptions);
    if (!customer) return;
    const customerSales = salesByCustomerId.get(customer.id) || [];
    customerSales.push(sale);
    salesByCustomerId.set(customer.id, customerSales);

    const due = getSaleDueAmount(sale, payments);
    const paid = getSalePaidAmount(sale, payments);
    if (due > 0 && paid > 0) partiallyPaidTransactions += 1;
    if (due === 0) fullyPaidTransactions += 1;
    totalOutstanding += convertReportCurrency(due, sale.currency, currency);
  });

  const summaries = [...salesByCustomerId.entries()].flatMap(([customerId, customerSales]) => {
    const customer = customersById.get(customerId);
    if (!customer) return [];
    const transactions = customerSales.map(sale => {
      const invoice = invoiceBySaleId.get(sale.id);
      const paid = getSalePaidAmount(sale, payments);
      const due = getSaleDueAmount(sale, payments);
      const dueDate = invoice?.customerId === customer.id && validDate(invoice.dueDate)
        ? invoice.dueDate
        : undefined;
      const overdue = due > 0 && dueDate && dueDate < today ? due : 0;
      if (overdue > 0) overdueAmount += convertReportCurrency(overdue, sale.currency, currency);
      return {
        sale,
        invoice,
        charged: Number(sale.amount),
        paid,
        due,
        overdue,
      };
    });
    const openTransactions = transactions.filter(transaction => transaction.due > 0);
    if (!openTransactions.length) return [];
    const customerPayments = payments
      .filter(payment =>
        (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
        && validDate(payment.paymentDate)
        && resolvePaymentCustomer(payment, customers, sales, subscriptions)?.id === customer.id
      )
      .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate));
    const overdueDates = openTransactions
      .map(transaction => transaction.invoice?.customerId === customer.id && validDate(transaction.invoice.dueDate)
        && transaction.invoice.dueDate < today ? transaction.invoice.dueDate : undefined)
      .filter((date): date is string => Boolean(date))
      .sort();
    const totals = transactions.reduce((summary, transaction) => ({
      charged: summary.charged + convertReportCurrency(transaction.charged, transaction.sale.currency, currency),
      paid: summary.paid + convertReportCurrency(transaction.paid, transaction.sale.currency, currency),
      due: summary.due + convertReportCurrency(transaction.due, transaction.sale.currency, currency),
      overdue: summary.overdue + convertReportCurrency(transaction.overdue, transaction.sale.currency, currency),
    }), { charged: 0, paid: 0, due: 0, overdue: 0 });

    return [{
      customer,
      currency,
      ...totals,
      earliestOverdueDate: overdueDates[0],
      lastPaymentDate: customerPayments[0]?.paymentDate,
      transactions: openTransactions,
    }];
  }).sort((left, right) => right.due - left.due);

  const paymentsCollected = payments.reduce((total, payment) => {
    if (!validDate(payment.paymentDate)
      || payment.paymentDate < dateRange.start || payment.paymentDate > dateRange.end) return total;
    if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial') {
      return total + convertReportCurrency(Number(payment.amount) || 0, payment.currency, currency);
    }
    if (payment.paymentStatus === 'refunded') {
      return total - convertReportCurrency(Number(payment.amount) || 0, payment.currency, currency);
    }
    return total;
  }, 0);

  return {
    customers: summaries,
    totalOutstanding,
    overdueAmount,
    partiallyPaidTransactions,
    fullyPaidTransactions,
    paymentsCollected,
  };
}

const dueFollowUpPrefix = 'sqp_due_collection_followups_v1';

export const getCustomerDueFollowUpStorageKey = (businessId: string): string =>
  `${dueFollowUpPrefix}_${encodeURIComponent(businessId || 'local')}`;

const isCustomerDueFollowUp = (value: unknown): value is CustomerDueFollowUp =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && customerDueFollowUpStatuses.includes((value as CustomerDueFollowUp).status)
  && typeof (value as CustomerDueFollowUp).updatedAt === 'string'
  && ((value as CustomerDueFollowUp).note === undefined || typeof (value as CustomerDueFollowUp).note === 'string');

export const isCustomerDueFollowUps = (value: unknown): value is CustomerDueFollowUps =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && Object.values(value).every(isCustomerDueFollowUp);
