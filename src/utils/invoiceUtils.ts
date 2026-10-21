import type { AppSettings, Customer, Invoice, Payment, Sale, Service, Subscription } from '../types';
import { createRecordId } from '../services/localStorageStore.ts';
import { getCustomerDisplayName, getCustomerType } from './relationships.ts';
import {
  getPaymentCashSaleAllocation,
  getSaleDueAmount,
  getSaleLineItems,
  getSalePaidAmount,
  getSalePaymentStatus,
  getSalePayments,
} from './saleUtils.ts';
import type { InvoiceSaleDetails } from './invoiceGenerator';
import { calculateExpiryDate } from './dateUtils.ts';

export function createInvoiceRecord(
  sale: Sale,
  payments: Payment[],
  existing?: Invoice,
  businessId?: string,
  stableId?: string
): Invoice {
  const linkedPayments = getSalePayments(sale, payments).sort((a, b) =>
    `${b.paymentDate}|${b.createdAt || ''}`.localeCompare(`${a.paymentDate}|${a.createdAt || ''}`)
  );
  const now = new Date().toISOString();
  return {
    invoiceId: existing?.invoiceId || stableId || createRecordId('invoice'),
    invoiceNumber: existing?.invoiceNumber || sale.invoiceNo,
    ...(businessId || sale.businessId ? { businessId: sale.businessId || businessId } : {}),
    saleId: sale.id,
    subscriptionId: sale.subscriptionId,
    customerId: sale.customerId,
    serviceId: sale.serviceId,
    planId: sale.planId,
    totalAmount: sale.amount,
    paidAmount: getSalePaidAmount(sale, payments),
    dueAmount: getSaleDueAmount(sale, payments),
    paymentStatus: getSalePaymentStatus(sale, payments),
    paymentMethod: linkedPayments[0]?.paymentMethod || sale.paymentMethod,
    invoiceDate: existing?.invoiceDate || sale.date,
    createdAt: existing?.createdAt || sale.createdAt || now,
    updatedAt: now,
  };
}

export function buildInvoiceSaleDetails(
  invoice: Invoice,
  sale: Sale,
  customer: Customer | undefined,
  service: Service | undefined,
  payments: Payment[],
  settings: AppSettings,
  subscription?: Subscription,
  services: Service[] = [],
  subscriptions: Subscription[] = []
): InvoiceSaleDetails {
  const linkedPayments = getSalePayments(sale, payments).sort((a, b) =>
    `${b.paymentDate}|${b.createdAt || ''}`.localeCompare(`${a.paymentDate}|${a.createdAt || ''}`)
  );
  const plan = service?.planDetails?.find(item => item.id === (invoice.planId || sale.planId))
    || service?.planDetails?.find(item => item.name === sale.plan);
  const planName = plan?.name || (service?.plans.includes(sale.plan) ? sale.plan : undefined);
  const durationDays = subscription?.durationDays || plan?.durationDays;
  const durationUnit = plan?.durationUnit?.toLowerCase();
  const displayDurationUnit = durationUnit && durationDays === 1
    ? durationUnit.replace(/s$/, '')
    : durationUnit;
  const durationLabel = plan?.duration && plan.durationUnit
    ? `${plan.duration} ${plan.duration === 1 ? plan.durationUnit.toLowerCase().replace(/s$/, '') : durationUnit}`
    : durationDays
      ? `${durationDays} ${displayDurationUnit || (durationDays === 1 ? 'day' : 'days')}`
      : undefined;
  const lineItems = getSaleLineItems(sale).map(item => {
    const itemService = services.find(candidate => candidate.id === item.serviceId)
      || (service?.id === item.serviceId ? service : undefined);
    const itemPlan = itemService?.planDetails?.find(candidate => candidate.id === item.planId);
    const itemSubscription = subscriptions.find(candidate =>
      candidate.id === item.units[0]?.subscriptionId
    );
    return {
      serviceName: item.serviceNameSnapshot || itemService?.name || 'Service unavailable',
      planName: item.plan,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      discount: item.discount,
      total: item.amount,
      currency: item.currency,
      startDate: itemSubscription?.startDate || item.startDate || undefined,
      expiryDate: itemSubscription?.expiryDate
        || (item.startDate && item.durationDays
          ? calculateExpiryDate(item.startDate, item.durationDays)
          : undefined),
      durationDays: itemSubscription?.durationDays || item.durationDays || itemPlan?.durationDays,
    };
  });
  const receivedPayments = linkedPayments.filter(payment =>
    (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
    && getPaymentCashSaleAllocation(payment, sale) > 0
  );
  const amountReceived = receivedPayments.reduce(
    (total, payment) => total + getPaymentCashSaleAllocation(payment, sale),
    0
  );
  const paymentMethods = [...new Set(receivedPayments.map(payment => payment.paymentMethodName || payment.paymentMethod))];
  const paymentMethodBreakdown = [...receivedPayments.reduce((groups, payment) => {
    const methodName = payment.paymentMethodName || payment.paymentMethod;
    const current = groups.get(methodName) || { methodName, amount: 0 };
    current.amount += getPaymentCashSaleAllocation(payment, sale);
    groups.set(methodName, current);
    return groups;
  }, new Map<string, { methodName: string; amount: number }>()).values()];
  if (paymentMethods.length === 0 && linkedPayments.length === 0 && getSalePaidAmount(sale, payments) > 0 && sale.paymentMethod) {
    paymentMethods.push(sale.paymentMethod);
  }
  return {
    saleId: sale.id,
    invoiceId: invoice.invoiceId,
    subscriptionId: invoice.subscriptionId || sale.subscriptionId,
    invoiceNo: invoice.invoiceNumber,
    customerId: invoice.customerId,
    date: invoice.invoiceDate || sale.date,
    customerName: getCustomerDisplayName(customer),
    customerType: getCustomerType(customer),
    customerPhone: customer?.phone || customer?.whatsapp,
    customerEmail: customer?.email,
    serviceName: service?.name || 'Service unavailable',
    lineItems,
    planName: planName || 'Plan information unavailable',
    durationLabel,
    durationDays,
    startDate: subscription?.startDate,
    expiryDate: subscription?.expiryDate,
    amount: sale.amount,
    amountPaid: getSalePaidAmount(sale, payments),
    amountReceived,
    advanceCreditApplied: Math.max(0, getSalePaidAmount(sale, payments) - amountReceived),
    amountDue: getSaleDueAmount(sale, payments),
    subtotal: sale.subtotal ?? sale.amount + (sale.discount || 0),
    discount: sale.discount || 0,
    currency: sale.currency,
    paymentMethod: paymentMethods.join(', ') || 'Not specified',
    paymentMethodBreakdown,
    paymentStatus: getSalePaymentStatus(sale, payments),
    paymentDate: receivedPayments[0]?.paymentDate,
    transactionId: receivedPayments[0]?.transactionId || sale.transactionId,
    paymentHistory: receivedPayments.map(payment => ({
      id: payment.id,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethodName || payment.paymentMethod,
      amount: getPaymentCashSaleAllocation(payment, sale),
      currency: payment.currency,
      paymentStatus: payment.paymentStatus,
      transactionId: payment.transactionId,
    })),
    senderNumber: receivedPayments[0]?.senderNumber || sale.senderNumber,
    storeName: settings.storeName || 'Your Business',
    tagline: settings.tagline,
    contactPhone: settings.contactPhone,
    adminEmail: settings.adminEmail,
    businessAddress: settings.invoicePreferences?.showBusinessAddress === false
      ? undefined
      : settings.businessProfile?.address,
    invoiceFooter: settings.invoicePreferences?.footer,
    notes: sale.notes,
    whatsappNumber: settings.whatsappNumber || settings.contactPhone || undefined,
    invoiceLogoUrl: settings.invoiceLogoDataUrl || settings.invoiceLogoUrl,
    serviceDescription: service?.description,
    serviceLogoUrl: service?.logoUrl,
    invoiceSettings: {
      ...service?.invoiceSettings,
      showCustomerPhone: service?.invoiceSettings?.showCustomerPhone !== false
        && settings.invoicePreferences?.showCustomerPhone !== false,
      showPaymentMethod: service?.invoiceSettings?.showPaymentMethod !== false
        && settings.invoicePreferences?.showPaymentMethod !== false,
      showTransactionId: settings.invoicePreferences?.showTransactionId,
    },
  };
}

export function getInvoiceById(invoices: Invoice[], invoiceId: string): Invoice | undefined {
  return invoices.find(invoice => invoice.invoiceId === invoiceId);
}

export function getInvoiceByNumber(invoices: Invoice[], invoiceNumber: string): Invoice | undefined {
  const normalizedNumber = invoiceNumber.trim().toLocaleLowerCase();
  return invoices.find(invoice => invoice.invoiceNumber.toLocaleLowerCase() === normalizedNumber);
}

export function getInvoiceForSale(invoices: Invoice[], saleId: string): Invoice | undefined {
  return invoices.find(invoice => invoice.saleId === saleId);
}

export function getInvoicesForCustomer(invoices: Invoice[], customerId: string): Invoice[] {
  return invoices
    .filter(invoice => invoice.customerId === customerId)
    .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate));
}

export function getInvoiceForSubscription(invoices: Invoice[], subscriptionId: string): Invoice | undefined {
  return invoices.find(invoice => invoice.subscriptionId === subscriptionId);
}

export type InvoiceDisplayStatus = 'paid' | 'partial' | 'due' | 'pending' | 'refunded';

export function getInvoiceDisplayStatus(sale: Sale, payments: Payment[]): InvoiceDisplayStatus {
  const status = getSalePaymentStatus(sale, payments);
  if (status === 'paid' || status === 'partial' || status === 'refunded') return status;
  const hasPendingAttempt = getSalePayments(sale, payments)
    .some(payment => payment.paymentStatus === 'pending');
  return hasPendingAttempt ? 'pending' : 'due';
}

export function getOutstandingAgingDays(referenceDate: string, today = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return 0;
  const [year, month, day] = referenceDate.split('-').map(Number);
  const referenceTimestamp = Date.UTC(year, month - 1, day);
  const reference = new Date(referenceTimestamp);
  if (reference.getUTCFullYear() !== year || reference.getUTCMonth() !== month - 1 || reference.getUTCDate() !== day) return 0;
  const currentTimestamp = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((currentTimestamp - referenceTimestamp) / 86_400_000));
}

export function getOutstandingAgingBucket(days: number): '0–7 days' | '8–30 days' | '31–60 days' | '60+ days' {
  if (days <= 7) return '0–7 days';
  if (days <= 30) return '8–30 days';
  if (days <= 60) return '31–60 days';
  return '60+ days';
}
