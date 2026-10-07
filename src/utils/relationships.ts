import type { ActivityLog, Customer, Payment, Sale, Subscription } from '../types';

export const CUSTOMER_UNAVAILABLE = 'Customer unavailable';

export function getCustomerDisplayName(customer?: Customer): string {
  return typeof customer?.name === 'string' && customer.name.trim()
    ? customer.name.trim()
    : CUSTOMER_UNAVAILABLE;
}

export function resolveSubscriptionCustomer(
  subscription: Subscription,
  customers: Customer[]
): Customer | undefined {
  return subscription.customerId
    ? customers.find(item => item.id === subscription.customerId)
    : undefined;
}

export function resolveSaleCustomer(
  sale: Sale,
  customers: Customer[],
  subscriptions: Subscription[]
): Customer | undefined {
  const subscription = sale.subscriptionId
    ? subscriptions.find(item => item.id === sale.subscriptionId)
    : undefined;
  if (sale.customerId && subscription?.customerId && sale.customerId !== subscription.customerId) {
    return undefined;
  }

  const customerId = sale.customerId || subscription?.customerId;
  return customerId ? customers.find(item => item.id === customerId) : undefined;
}

export function resolvePaymentCustomer(
  payment: Payment,
  customers: Customer[],
  sales: Sale[],
  subscriptions: Subscription[]
): Customer | undefined {
  const sale = payment.saleId ? sales.find(item => item.id === payment.saleId) : undefined;
  const subscription = payment.subscriptionId
    ? subscriptions.find(item => item.id === payment.subscriptionId)
    : undefined;
  const saleSubscription = sale?.subscriptionId
    ? subscriptions.find(item => item.id === sale.subscriptionId)
    : undefined;
  const relatedCustomerIds = [
    sale?.customerId,
    saleSubscription?.customerId,
    subscription?.customerId,
  ].filter((id): id is string => Boolean(id));
  const relatedCustomerId = relatedCustomerIds[0];
  const hasConflictingRelatedIds = relatedCustomerIds.some(id => id !== relatedCustomerId);

  if (hasConflictingRelatedIds) return undefined;
  if (payment.customerId && relatedCustomerId && payment.customerId !== relatedCustomerId) {
    return undefined;
  }

  const customerId = payment.customerId || relatedCustomerId;
  return customerId ? customers.find(item => item.id === customerId) : undefined;
}

export function resolveActivityCustomerName(
  log: ActivityLog,
  customers: Customer[],
  sales: Sale[],
  subscriptions: Subscription[],
  payments: Payment[]
): string | undefined {
  let relatedCustomer: Customer | undefined;
  let linkedCustomerRecord = false;
  const entityId = log.entityId;

  if (entityId && log.type === 'customer_added') {
    linkedCustomerRecord = true;
    relatedCustomer = customers.find(customer => customer.id === entityId);
  } else if (entityId && log.type.startsWith('subscription_')) {
    const subscription = subscriptions.find(item => item.id === entityId);
    linkedCustomerRecord = Boolean(subscription);
    relatedCustomer = subscription
      ? resolveSubscriptionCustomer(subscription, customers)
      : undefined;
  } else if (entityId && log.type === 'payment_received') {
    const sale = sales.find(item => item.id === entityId);
    const payment = payments.find(item => item.id === entityId);
    linkedCustomerRecord = Boolean(sale || payment);
    relatedCustomer = sale
      ? resolveSaleCustomer(sale, customers, subscriptions)
      : payment
        ? resolvePaymentCustomer(payment, customers, sales, subscriptions)
        : undefined;
  }

  if (relatedCustomer) return getCustomerDisplayName(relatedCustomer);
  if (linkedCustomerRecord) return CUSTOMER_UNAVAILABLE;

  const savedName = log.customerName?.trim();
  if (savedName && !/^(customer|unknown|customer unavailable|customer record missing(?:\s|$))/i.test(savedName)) {
    return savedName;
  }

  const hasCustomerContext =
    Boolean(log.customerName) ||
    log.type === 'payment_received' ||
    log.type.startsWith('subscription_') ||
    log.type === 'profile_assigned' ||
    log.type === 'profile_unassigned' ||
    log.type === 'customer_added';

  return hasCustomerContext ? CUSTOMER_UNAVAILABLE : undefined;
}
