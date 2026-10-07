import type {
  ActivityLog,
  AppCurrency,
  Customer,
  Invoice,
  Payment,
  Sale,
  Service,
  Subscription,
} from '../types';
import { getSubscriptionStatus } from './dateUtils';
import { calculateSalesFinancialSummary, convertReportCurrency } from './reportMetrics';

export const CUSTOMER_CRM_THRESHOLDS = {
  recentActivityDays: 30,
  inactiveAfterDays: 90,
  recentlyExpiredDays: 30,
} as const;

export type CustomerCrmStatus = 'active' | 'at_risk' | 'inactive';
export type CustomerRiskLevel = 'low' | 'medium' | 'high';
export type CustomerCrmQuickFilter = CustomerCrmStatus | 'new' | 'due' | 'renewals';

export function isCustomerNew(createdAt: string, now = new Date()): boolean {
  const dateValue = createdAt.slice(0, 10);
  const created = new Date(`${dateValue}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(created.getTime())) return false;
  const ageDays = Math.floor((today.getTime() - created.getTime()) / 86400000);
  return ageDays >= 0 && ageDays <= CUSTOMER_CRM_THRESHOLDS.recentActivityDays;
}

export interface CustomerCrmMetrics {
  status: CustomerCrmStatus;
  riskLevel: CustomerRiskLevel;
  activeSubscriptions: number;
  renewalsDue: number;
  salesCount: number;
  totalSpent: number;
  totalPaid: number;
  totalDue: number;
  renewals: number;
  averageSale: number;
  firstPurchase?: string;
  lastPurchase?: string;
  lastActivity?: string;
  nextRenewal?: string;
  hasFailedPayment: boolean;
  hasRecentActivity: boolean;
  serviceIds: Set<string>;
}

const isSuccessfulPayment = (payment: Payment): boolean =>
  payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial';

const validSales = (sales: Sale[]): Sale[] => sales.filter(sale =>
  sale && Number.isFinite(Number(sale.amount))
  && sale.paymentStatus !== 'failed'
  && sale.paymentStatus !== 'refunded'
);

function timestampValue(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildCustomerCrmMetrics(
  customers: Customer[],
  sales: Sale[],
  subscriptions: Subscription[],
  payments: Payment[],
  invoices: Invoice[],
  activities: ActivityLog[],
  services: Service[],
  currency: AppCurrency,
  now = new Date(),
  reminderNoticeDays = 7
): Map<string, CustomerCrmMetrics> {
  const subscriptionById = new Map(subscriptions.map(item => [item.id, item]));
  const saleById = new Map(sales.map(item => [item.id, item]));
  const invoiceById = new Map(invoices.map(item => [item.invoiceId, item]));
  const salesByCustomer = new Map<string, Sale[]>();
  const paymentsByCustomer = new Map<string, Payment[]>();
  const subscriptionsByCustomer = new Map<string, Subscription[]>();
  const activitiesByCustomer = new Map<string, ActivityLog[]>();
  const serviceById = new Map(services.map(item => [item.id, item]));
  const today = now.toISOString().slice(0, 10);

  const append = <T,>(map: Map<string, T[]>, key: string | undefined, value: T) => {
    if (!key) return;
    const rows = map.get(key) || [];
    rows.push(value);
    map.set(key, rows);
  };

  sales.forEach(sale => {
    append(salesByCustomer, sale.customerId || subscriptionById.get(sale.subscriptionId || '')?.customerId, sale);
  });
  subscriptions.forEach(subscription => append(subscriptionsByCustomer, subscription.customerId, subscription));
  payments.forEach(payment => {
    const sale = payment.saleId
      ? saleById.get(payment.saleId)
      : payment.invoiceId ? saleById.get(invoiceById.get(payment.invoiceId)?.saleId || '') : undefined;
    const subscription = subscriptionById.get(payment.subscriptionId || sale?.subscriptionId || '');
    const saleCustomerId = sale?.customerId || subscriptionById.get(sale?.subscriptionId || '')?.customerId;
    const relatedIds = [payment.customerId, saleCustomerId, subscription?.customerId].filter(
      (id): id is string => Boolean(id)
    );
    if (new Set(relatedIds).size <= 1) {
      append(paymentsByCustomer, relatedIds[0], payment);
    }
  });
  activities.forEach(activity => append(activitiesByCustomer, activity.customerId, activity));

  const metrics = new Map<string, CustomerCrmMetrics>();
  customers.forEach(customer => {
    const customerSales = validSales(salesByCustomer.get(customer.id) || []);
    const customerPayments = paymentsByCustomer.get(customer.id) || [];
    const customerSubscriptions = subscriptionsByCustomer.get(customer.id) || [];
    const customerActivities = activitiesByCustomer.get(customer.id) || [];
    const financialSales = customerSales.map(sale => sale.customerId ? sale : { ...sale, customerId: customer.id });
    const financialPayments = customerPayments.map(payment =>
      payment.customerId ? payment : { ...payment, customerId: customer.id }
    );
    const summary = calculateSalesFinancialSummary(financialSales, financialPayments, currency);
    const saleIds = new Set(customerSales.map(sale => sale.id));
    const standalonePaid = customerPayments
      .filter(payment => {
        if (!isSuccessfulPayment(payment)) return false;
        const invoiceSale = payment.invoiceId ? invoiceById.get(payment.invoiceId)?.saleId : undefined;
        const linkedSale = (payment.saleId ? saleById.get(payment.saleId) : undefined)
          || (invoiceSale ? saleById.get(invoiceSale) : undefined)
          || customerSales.find(sale =>
            (Boolean(payment.subscriptionId) && sale.subscriptionId === payment.subscriptionId)
            || sale.paymentId === payment.id
          );
        return !linkedSale || !saleIds.has(linkedSale.id);
      })
      .reduce((sum, payment) => sum + convertReportCurrency(Number(payment.amount) || 0, payment.currency, currency), 0);
    const subscriptionStates = customerSubscriptions
      .map(subscription => {
        const status = getSubscriptionStatus(
          subscription,
          serviceById.get(subscription.serviceId),
          reminderNoticeDays
        );
        return { subscription, status };
      });
    const activeSubscriptions = subscriptionStates.filter(item => item.status === 'active').length;
    const renewalsDue = subscriptionStates.filter(item =>
      item.status === 'expiring_soon' || item.status === 'expired'
    ).length;
    const recentlyExpired = subscriptionStates.some(item => {
      const expiry = new Date(`${item.subscription.expiryDate}T00:00:00`);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.ceil((expiry.getTime() - todayStart.getTime()) / 86400000);
      return item.status === 'expired' && days >= -CUSTOMER_CRM_THRESHOLDS.recentlyExpiredDays;
    });
    const nextRenewal = subscriptionStates
      .filter(item => item.status !== 'expired' && item.subscription.expiryDate >= today)
      .map(item => item.subscription.expiryDate)
      .sort()[0];
    const hasFailedPayment = customerPayments.some(payment => payment.paymentStatus === 'failed')
      || (salesByCustomer.get(customer.id) || []).some(sale => sale.paymentStatus === 'failed');
    const sortedPurchaseDates = customerSales.map(sale => sale.date).filter(Boolean).sort();
    const lastPurchase = sortedPurchaseDates[sortedPurchaseDates.length - 1];
    const firstPurchase = customerSales.map(sale => sale.date).filter(Boolean).sort()[0];
    const lastActivityTimestamp = Math.max(
      timestampValue(customer.createdAt),
      timestampValue(customer.updatedAt),
      ...customerActivities.map(item => timestampValue(item.timestamp)),
      ...customerSales.map(item => timestampValue(item.date)),
      ...customerPayments.map(item => timestampValue(item.paymentDate)),
      ...customerSubscriptions.map(item => timestampValue(item.updatedAt || item.createdAt))
    );
    const lastActivity = lastActivityTimestamp ? new Date(lastActivityTimestamp).toISOString() : undefined;
    const daysSinceActivity = lastActivityTimestamp
      ? Math.max(0, Math.floor((now.getTime() - lastActivityTimestamp) / 86400000))
      : Number.POSITIVE_INFINITY;
    const hasRecentActivity = daysSinceActivity <= CUSTOMER_CRM_THRESHOLDS.recentActivityDays;
    const hasDue = summary.due > 0;
    const riskLevel: CustomerRiskLevel = hasDue || hasFailedPayment || recentlyExpired
      ? 'high'
      : renewalsDue > 0 || (customerSales.length > 0 && !hasRecentActivity)
        ? 'medium' : 'low';
    const status: CustomerCrmStatus = riskLevel === 'high' || riskLevel === 'medium'
      ? 'at_risk'
      : activeSubscriptions > 0 || hasRecentActivity
        ? 'active'
        : daysSinceActivity >= CUSTOMER_CRM_THRESHOLDS.inactiveAfterDays
          ? 'inactive' : 'active';
    const serviceIds = new Set([
      ...customerSales.map(item => item.serviceId),
      ...customerSubscriptions.map(item => item.serviceId),
    ]);

    metrics.set(customer.id, {
      status,
      riskLevel,
      activeSubscriptions,
      renewalsDue,
      salesCount: summary.salesCount,
      totalSpent: summary.revenue,
      totalPaid: summary.paid + standalonePaid,
      totalDue: summary.due,
      renewals: customerSales.filter(sale => Boolean(sale.renewalOfSubscriptionId)).length,
      averageSale: summary.salesCount ? summary.revenue / summary.salesCount : 0,
      firstPurchase,
      lastPurchase,
      lastActivity,
      nextRenewal,
      hasFailedPayment,
      hasRecentActivity,
      serviceIds,
    });
  });
  return metrics;
}
