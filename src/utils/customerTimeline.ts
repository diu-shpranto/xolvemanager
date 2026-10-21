import type {
  ActivityLog,
  AppCurrency,
  Invoice,
  Payment,
  Sale,
  Service,
  Subscription,
} from '../types';
import { getSubscriptionStatus } from './dateUtils.ts';
import { getSalePaymentStatus } from './saleUtils.ts';

export type CustomerTimelineType = 'sale' | 'payment' | 'subscription' | 'refund' | 'invoice';

export interface CustomerTimelineEvent {
  id: string;
  type: CustomerTimelineType;
  recordId: string;
  timestamp: string;
  title: string;
  description: string;
  amount?: number;
  currency?: AppCurrency;
  status?: string;
}

interface BuildCustomerTimelineOptions {
  sales: Sale[];
  payments: Payment[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  activities: ActivityLog[];
  services: Service[];
  reminderNoticeDays?: number;
  timeZone?: string;
}

export function buildCustomerTimeline({
  sales,
  payments,
  subscriptions,
  invoices,
  activities,
  services,
  reminderNoticeDays = 7,
  timeZone,
}: BuildCustomerTimelineOptions): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [];
  const serviceById = new Map(services.map(service => [service.id, service]));
  const addEvent = (event: CustomerTimelineEvent) => {
    if (Number.isFinite(Date.parse(event.timestamp))) events.push(event);
  };
  const getDescription = (serviceId?: string, plan?: string) => [
    serviceById.get(serviceId || '')?.name,
    plan,
  ].filter((value): value is string => Boolean(value?.trim())).join(' · ');

  sales.forEach(sale => {
    addEvent({
      id: `sale:${sale.id}`,
      type: 'sale',
      recordId: sale.id,
      timestamp: sale.createdAt || sale.date,
      title: 'Sale recorded',
      description: getDescription(sale.serviceId, sale.plan) || sale.invoiceNo || 'Sale',
      amount: sale.amount,
      currency: sale.currency,
      status: getSalePaymentStatus(sale, payments),
    });
    const completionActivity = activities.find(activity =>
      activity.type === 'sale_completed'
      && (activity.saleId === sale.id || (activity.entityType === 'sale' && activity.entityId === sale.id))
    );
    if (completionActivity) {
      addEvent({
        id: `sale-completed:${completionActivity.id}`,
        type: 'sale',
        recordId: sale.id,
        timestamp: completionActivity.timestamp,
        title: completionActivity.title || 'Sale completed',
        description: getDescription(sale.serviceId, sale.plan) || sale.invoiceNo || 'Sale',
        amount: sale.amount,
        currency: sale.currency,
        status: 'Completed',
      });
    }
  });

  payments.forEach(payment => {
    const isRefund = payment.paymentStatus === 'refunded' && Boolean(payment.refundOfPaymentId);
    const relatedPayment = isRefund
      ? payments.find(item => item.id === payment.refundOfPaymentId)
      : payment;
    const relatedSale = relatedPayment?.saleId
      ? sales.find(sale => sale.id === relatedPayment.saleId)
      : undefined;
    const relatedSubscription = relatedPayment?.subscriptionId
      ? subscriptions.find(subscription => subscription.id === relatedPayment.subscriptionId)
      : undefined;
    const relatedInvoice = relatedPayment?.invoiceId
      ? invoices.find(invoice => invoice.invoiceId === relatedPayment.invoiceId)
      : undefined;
    const serviceId = relatedSale?.serviceId || relatedSubscription?.serviceId || relatedInvoice?.serviceId;
    const plan = relatedSale?.plan || relatedSubscription?.plan || relatedInvoice?.planId;
    addEvent({
      id: `${isRefund ? 'refund' : 'payment'}:${payment.id}`,
      type: isRefund ? 'refund' : 'payment',
      recordId: payment.id,
      timestamp: payment.createdAt || payment.paymentDate,
      title: isRefund
        ? 'Refund recorded'
        : payment.paymentStatus === 'failed'
          ? 'Payment failed'
          : payment.paymentStatus === 'pending'
            ? 'Payment pending'
            : 'Payment received',
      description: getDescription(serviceId, plan)
        || (isRefund ? 'Payment refund' : payment.paymentMethodName || payment.paymentMethod || 'Payment'),
      amount: isRefund ? -Math.abs(payment.amount) : payment.amount,
      currency: payment.currency,
      status: payment.paymentStatus,
    });
  });

  subscriptions.forEach(subscription => {
    const description = getDescription(subscription.serviceId, subscription.plan)
      || subscription.plan
      || 'Subscription';
    addEvent({
      id: `subscription-created:${subscription.id}`,
      type: 'subscription',
      recordId: subscription.id,
      timestamp: subscription.createdAt,
      title: 'Subscription activated',
      description,
      amount: subscription.price,
      currency: subscription.currency,
    });
    (subscription.renewalHistory || []).forEach(renewal => addEvent({
      id: `subscription-renewal:${subscription.id}:${renewal.id}`,
      type: 'subscription',
      recordId: subscription.id,
      timestamp: renewal.renewalDate,
      title: 'Subscription renewed',
      description: getDescription(subscription.serviceId, renewal.plan) || renewal.plan,
      amount: renewal.amount,
      currency: renewal.currency || subscription.currency,
      status: renewal.paymentStatus,
    }));

    if (subscription.status === 'cancelled' || subscription.cancelledAt) {
      const cancelledActivity = activities.find(activity =>
        activity.type === 'subscription_cancelled'
        && (activity.subscriptionId === subscription.id || activity.entityId === subscription.id)
      );
      const timestamp = subscription.cancelledAt || cancelledActivity?.timestamp;
      if (timestamp) addEvent({
        id: `subscription-cancelled:${subscription.id}`,
        type: 'subscription',
        recordId: subscription.id,
        timestamp,
        title: 'Subscription cancelled',
        description,
        status: 'Cancelled',
      });
    } else if (
      getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), reminderNoticeDays, timeZone) === 'expired'
    ) {
      const expiredActivity = activities.find(activity =>
        activity.type === 'subscription_expired'
        && (activity.subscriptionId === subscription.id || activity.entityId === subscription.id)
      );
      addEvent({
        id: `subscription-expired:${subscription.id}`,
        type: 'subscription',
        recordId: subscription.id,
        timestamp: expiredActivity?.timestamp || subscription.expiryDate,
        title: 'Subscription expired',
        description,
        status: 'Expired',
      });
    }
  });

  invoices.forEach(invoice => {
    const sale = sales.find(item => item.id === invoice.saleId);
    addEvent({
      id: `invoice:${invoice.invoiceId}`,
      type: 'invoice',
      recordId: invoice.invoiceId,
      timestamp: invoice.createdAt || invoice.invoiceDate,
      title: 'Invoice created',
      description: getDescription(invoice.serviceId, sale?.plan || invoice.planId)
        || invoice.invoiceNumber,
      amount: sale ? invoice.totalAmount : undefined,
      currency: sale?.currency,
      status: invoice.paymentStatus,
    });
    if (invoice.updatedAt && Date.parse(invoice.updatedAt) > Date.parse(invoice.createdAt || invoice.invoiceDate)) {
      addEvent({
        id: `invoice-updated:${invoice.invoiceId}:${invoice.updatedAt}`,
        type: 'invoice',
        recordId: invoice.invoiceId,
        timestamp: invoice.updatedAt,
        title: 'Invoice updated',
        description: getDescription(invoice.serviceId, sale?.plan || invoice.planId)
          || invoice.invoiceNumber,
        amount: sale ? invoice.totalAmount : undefined,
        currency: sale?.currency,
        status: invoice.paymentStatus,
      });
    }
  });

  return events.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}
