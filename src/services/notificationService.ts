import type {
  Account,
  BusinessNotification,
  Customer,
  Invoice,
  NotificationCategory,
  NotificationPriority,
  NotificationSection,
  Payment,
  Sale,
  Service,
  Subscription,
  AppSettings,
} from '../types';
import { createRecordId } from './localStorageStore';
import { getDaysDifference, getSubscriptionReminderDays, formatCurrency } from '../utils/dateUtils';
import { getCustomerDisplayName } from '../utils/relationships';
import { getAccountCapacity, RESOURCE_CAPACITY_THRESHOLDS } from '../utils/resourceManagement';

export interface NotificationData {
  businessId?: string;
  customers: Customer[];
  services: Service[];
  accounts: Account[];
  subscriptions: Subscription[];
  sales: Sale[];
  payments: Payment[];
  invoices: Invoice[];
  settings: AppSettings;
  storageWarning?: string | null;
}

export type NewNotification = Omit<BusinessNotification, 'id' | 'businessId' | 'createdAt' | 'read'> & {
  id?: string;
  businessId?: string;
  createdAt?: string;
  read?: boolean;
};

export const createNotification = (
  notification: NewNotification,
  businessId?: string
): BusinessNotification => ({
  ...notification,
  id: notification.id || createRecordId('notification'),
  ...(businessId || notification.businessId ? { businessId: notification.businessId || businessId } : {}),
  read: notification.read ?? false,
  createdAt: notification.createdAt || new Date().toISOString(),
});

export const isNotificationEnabled = (
  settings: AppSettings,
  category: NotificationCategory,
  priority: NotificationPriority
): boolean => {
  const preferences = settings.notificationPreferences;
  if (preferences?.categories?.[category] === false) return false;
  if (priority === 'success' && preferences?.showSuccess === false) return false;
  if (priority === 'warning' && preferences?.showWarning === false) return false;
  if (priority === 'critical' && preferences?.showCritical === false) return false;
  return true;
};

const buildSystemNotification = (
  data: NotificationData,
  details: Omit<NewNotification, 'id' | 'businessId' | 'read' | 'createdAt'>
): BusinessNotification | null => isNotificationEnabled(data.settings, details.category, details.priority)
  ? createNotification(details, data.businessId)
  : null;

const timeForPayment = (payment: Payment): number =>
  Date.parse(payment.createdAt || payment.paymentDate || '') || 0;

const isRecent = (timestamp: number): boolean =>
  timestamp > 0 && Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;

export const generateSystemNotifications = (data: NotificationData): BusinessNotification[] => {
  const generated: BusinessNotification[] = [];
  const customersById = new Map(data.customers.map(customer => [customer.id, customer]));
  const servicesById = new Map(data.services.map(service => [service.id, service]));
  const invoicesById = new Map(data.invoices.map(invoice => [invoice.invoiceId, invoice]));
  const subscriptionsByServiceId = new Map<string, Subscription[]>();
  data.subscriptions.forEach(subscription => {
    const serviceSubscriptions = subscriptionsByServiceId.get(subscription.serviceId) || [];
    serviceSubscriptions.push(subscription);
    subscriptionsByServiceId.set(subscription.serviceId, serviceSubscriptions);
  });
  const append = (notification: BusinessNotification | null) => {
    if (notification) generated.push(notification);
  };

  data.subscriptions.forEach(subscription => {
    if (subscription.status === 'cancelled') return;
    const reminderDays = getSubscriptionReminderDays(
      servicesById.get(subscription.serviceId),
      subscription.planId,
      data.settings.reminderNoticeDays
    );
    const days = getDaysDifference(subscription.expiryDate);
    if (days < 0) {
      if (days < -90) return;
      const notification = buildSystemNotification(data, {
        dedupeKey: `subscription-expired-${subscription.id}-${subscription.expiryDate}`,
        type: 'subscription_expired',
        category: 'subscription',
        priority: 'critical',
        title: 'Subscription expired',
        message: `${getCustomerDisplayName(customersById.get(subscription.customerId))}’s ${servicesById.get(subscription.serviceId)?.name || 'subscription'} expired.`,
        entityType: 'subscription',
        entityId: subscription.id,
        customerId: subscription.customerId,
        serviceId: subscription.serviceId,
        subscriptionId: subscription.id,
        section: 'subscriptions',
        expiresAt: new Date(new Date(`${subscription.expiryDate}T23:59:59`).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      append(notification);
      return;
    }
    if (days > reminderDays || reminderDays <= 0) return;
    const dueNow = days === 0;
    const tomorrow = days === 1;
    const threshold = Math.max(1, reminderDays);
    append(buildSystemNotification(data, {
      dedupeKey: `subscription-expiring-${subscription.id}-${subscription.expiryDate}-${threshold}`,
      type: dueNow ? 'renewal_due' : 'subscription_expiring',
      category: 'subscription',
      priority: dueNow || tomorrow ? 'critical' : 'warning',
      title: dueNow ? 'Renewal due today' : tomorrow ? 'Subscription expires tomorrow' : 'Subscription expiring soon',
      message: `${getCustomerDisplayName(customersById.get(subscription.customerId))}’s ${servicesById.get(subscription.serviceId)?.name || 'subscription'} ${dueNow ? 'expires today' : `expires in ${days} ${days === 1 ? 'day' : 'days'}`}.`,
      entityType: 'subscription',
      entityId: subscription.id,
      customerId: subscription.customerId,
      serviceId: subscription.serviceId,
      subscriptionId: subscription.id,
      section: 'subscriptions',
      expiresAt: new Date(new Date(`${subscription.expiryDate}T23:59:59`).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  });

  const salesById = new Map(data.sales.map(sale => [sale.id, sale]));
  data.payments.forEach(payment => {
    const customer = customersById.get(payment.customerId);
    const sale = payment.saleId ? salesById.get(payment.saleId) : undefined;
    const invoice = payment.invoiceId ? invoicesById.get(payment.invoiceId) : undefined;
    const invoiceNumber = invoice?.invoiceNumber || sale?.invoiceNo;
    if (payment.paymentStatus === 'failed') {
      append(buildSystemNotification(data, {
        dedupeKey: `payment-failed-${payment.id}`,
        type: 'payment_failed',
        category: 'payment',
        priority: 'critical',
        title: 'Payment failed',
        message: `Payment failed${invoiceNumber ? ` for invoice ${invoiceNumber}` : ` from ${getCustomerDisplayName(customer)}`}.`,
        entityType: 'payment',
        entityId: payment.id,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId,
        saleId: payment.saleId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        section: 'payments',
      }));
      return;
    }
    if (payment.paymentStatus === 'pending') {
      append(buildSystemNotification(data, {
        dedupeKey: `payment-pending-${payment.id}`,
        type: 'payment_pending',
        category: 'payment',
        priority: 'warning',
        title: 'Payment pending',
        message: `A payment of ${formatCurrency(payment.amount, payment.currency)} from ${getCustomerDisplayName(customer)} is pending.`,
        entityType: 'payment',
        entityId: payment.id,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId,
        saleId: payment.saleId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        section: 'payments',
      }));
      return;
    }
    if (payment.paymentStatus === 'partial' && isRecent(timeForPayment(payment))) {
      const outstanding = invoice?.dueAmount ?? Math.max(0, (sale?.amount || 0) - (sale?.amountPaid ?? payment.amount));
      append(buildSystemNotification(data, {
        dedupeKey: `payment-partial-${payment.id}`,
        type: 'payment_partial',
        category: 'payment',
        priority: 'warning',
        title: 'Partial payment',
        message: `${getCustomerDisplayName(customer)} has an outstanding balance of ${formatCurrency(outstanding, payment.currency)}.`,
        entityType: 'payment',
        entityId: payment.id,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId,
        saleId: payment.saleId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        section: 'payments',
      }));
    } else if (payment.paymentStatus === 'paid' && isRecent(timeForPayment(payment))) {
      append(buildSystemNotification(data, {
        dedupeKey: `payment-received-${payment.id}`,
        type: 'payment_received',
        category: 'payment',
        priority: 'success',
        title: 'Payment received',
        message: `${formatCurrency(payment.amount, payment.currency)} received from ${getCustomerDisplayName(customer)}.`,
        entityType: 'payment',
        entityId: payment.id,
        customerId: payment.customerId,
        subscriptionId: payment.subscriptionId,
        saleId: payment.saleId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        section: 'payments',
      }));
    }
  });

  data.invoices.forEach(invoice => {
    if (invoice.dueAmount <= 0) return;
    const customer = customersById.get(invoice.customerId);
    const currency = salesById.get(invoice.saleId)?.currency || 'BDT';
    append(buildSystemNotification(data, {
      dedupeKey: `invoice-due-${invoice.invoiceId}`,
      type: 'invoice_due',
      category: 'invoice',
      priority: 'warning',
      title: 'Invoice has a due amount',
      message: `Invoice ${invoice.invoiceNumber} has ${formatCurrency(invoice.dueAmount, currency)} due from ${getCustomerDisplayName(customer)}.`,
      entityType: 'invoice',
      entityId: invoice.invoiceId,
      customerId: invoice.customerId,
      serviceId: invoice.serviceId,
      subscriptionId: invoice.subscriptionId,
      saleId: invoice.saleId,
      invoiceId: invoice.invoiceId,
      section: 'invoices',
    }));
  });

  data.accounts.forEach(account => {
    const capacity = getAccountCapacity(account);
    if (capacity.capacity <= 0 || capacity.utilization < RESOURCE_CAPACITY_THRESHOLDS.almostFull) return;
    const service = servicesById.get(account.serviceId);
    const full = capacity.status === 'Full';
    const priority: NotificationPriority = full ? 'critical'
      : capacity.utilization >= RESOURCE_CAPACITY_THRESHOLDS.highCapacity ? 'warning' : 'info';
    append(buildSystemNotification(data, {
      dedupeKey: `account-capacity-${account.id}-${capacity.status}-${capacity.capacity}-${capacity.used}`,
      type: full ? 'account_capacity_full' : 'account_capacity_low',
      category: 'account',
      priority,
      title: full ? 'Account profile capacity full' : 'Account profile capacity low',
      message: full
        ? `${account.name || service?.name || 'Service'} ${full ? 'has no profiles available' : 'is full'}.`
        : `${account.name || service?.name || 'Service'} is ${Math.round(capacity.utilization * 100)}% full and has ${capacity.available} ${capacity.available === 1 ? 'profile' : 'profiles'} available.`,
      entityType: 'account',
      entityId: account.id,
      serviceId: account.serviceId,
      accountId: account.id,
      section: 'accounts',
    }));
  });

  data.accounts.forEach(account => {
    const accountDays = account.expiryDate ? getDaysDifference(account.expiryDate) : null;
    if (accountDays !== null && accountDays <= RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays) {
      const expired = accountDays < 0;
      append(buildSystemNotification(data, {
        dedupeKey: `account-expiry-${account.id}-${account.expiryDate}`,
        type: expired ? 'account_expired' : 'account_expiring',
        category: 'account',
        priority: expired ? 'critical' : accountDays <= 1 ? 'warning' : 'info',
        title: expired ? 'Account expired' : 'Account expiring soon',
        message: `${account.name || servicesById.get(account.serviceId)?.name || 'Account'} ${expired ? 'has expired' : accountDays === 0 ? 'expires today' : `expires in ${accountDays} days`}.`,
        entityType: 'account',
        entityId: account.id,
        serviceId: account.serviceId,
        accountId: account.id,
        section: 'accounts',
      }));
    }
    account.profiles.forEach(profile => {
      if (!profile.assignedCustomerId || !profile.expiryDate) return;
      const days = getDaysDifference(profile.expiryDate);
      if (days > RESOURCE_CAPACITY_THRESHOLDS.expiringSoonDays) return;
      const expired = days < 0;
      append(buildSystemNotification(data, {
        dedupeKey: `profile-expiry-${profile.id}-${profile.expiryDate}`,
        type: expired ? 'profile_expired' : 'profile_expiring',
        category: 'account',
        priority: expired ? 'critical' : days <= 1 ? 'warning' : 'info',
        title: expired ? 'Assigned profile expired' : 'Assigned profile expiring soon',
        message: `${getCustomerDisplayName(customersById.get(profile.assignedCustomerId))}’s assigned profile ${profile.profileName} ${expired ? 'has expired' : days === 0 ? 'expires today' : `expires in ${days} days`}.`,
        entityType: 'profile',
        entityId: profile.id,
        customerId: profile.assignedCustomerId,
        serviceId: account.serviceId,
        accountId: account.id,
        profileId: profile.id,
        subscriptionId: profile.subscriptionId,
        section: 'profiles',
      }));
    });
  });

  data.accounts.forEach(account => {
    if (account.status !== 'Inactive') return;
    append(buildSystemNotification(data, {
      dedupeKey: `account-inactive-${account.id}`,
      type: 'account_inactive',
      category: 'account',
      priority: 'warning',
      title: 'Account inactive',
      message: `${servicesById.get(account.serviceId)?.name || 'Service'} ${account.plan || 'account'} is inactive.`,
      entityType: 'account',
      entityId: account.id,
      serviceId: account.serviceId,
      accountId: account.id,
      section: 'accounts',
    }));
  });

  data.accounts.forEach(account => {
    const service = servicesById.get(account.serviceId);
    account.profiles.forEach(profile => {
      if (profile.status !== 'Disabled') return;
      append(buildSystemNotification(data, {
        dedupeKey: `profile-unavailable-${profile.id}`,
        type: 'profile_unavailable',
        category: 'account',
        priority: 'warning',
        title: 'Profile unavailable',
        message: `${profile.profileName} on ${service?.name || 'this service'} is unavailable.`,
        entityType: 'profile',
        entityId: profile.id,
        serviceId: account.serviceId,
        accountId: account.id,
        profileId: profile.id,
        section: 'profiles',
      }));
    });
  });

  data.services.forEach(service => {
    if (service.isArchived) return;
    const expiringThisWeek = (subscriptionsByServiceId.get(service.id) || []).filter(subscription => {
      const daysUntilExpiry = getDaysDifference(subscription.expiryDate);
      return subscription.status !== 'cancelled'
        && subscription.status !== 'expired'
        && daysUntilExpiry >= 0
        && daysUntilExpiry <= 7;
    }).length;
    if (expiringThisWeek > 0) {
      const today = new Date();
      const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
      const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      append(buildSystemNotification(data, {
        dedupeKey: `service-expiring-week-${service.id}-${weekKey}`,
        type: 'service_subscriptions_expiring',
        category: 'service',
        priority: 'warning',
        title: 'Subscriptions expiring this week',
        message: `${service.name} has ${expiringThisWeek} ${expiringThisWeek === 1 ? 'subscription' : 'subscriptions'} expiring this week.`,
        entityType: 'service',
        entityId: service.id,
        serviceId: service.id,
        section: 'subscriptions',
      }));
    }
    if (service.status === 'inactive') {
      append(buildSystemNotification(data, {
        dedupeKey: `service-inactive-${service.id}`,
        type: 'service_inactive',
        category: 'service',
        priority: 'warning',
        title: 'Service inactive',
        message: `${service.name} is inactive and cannot be used for new sales.`,
        entityType: 'service',
        entityId: service.id,
        serviceId: service.id,
        section: 'services',
      }));
    } else if (!service.planDetails?.some(plan => plan.status === 'active')) {
      append(buildSystemNotification(data, {
        dedupeKey: `service-no-active-plans-${service.id}`,
        type: 'service_no_active_plans',
        category: 'service',
        priority: 'warning',
        title: 'Service has no active plans',
        message: `${service.name} has no active plans available for new sales.`,
        entityType: 'service',
        entityId: service.id,
        serviceId: service.id,
        section: 'services',
      }));
    }
    if (
      (service.settings?.usesProfiles && !service.settings?.usesAccounts) ||
      (service.settings?.profileAssignmentRequired && !service.settings?.usesProfiles)
    ) {
      append(buildSystemNotification(data, {
        dedupeKey: `service-config-issue-${service.id}`,
        type: 'service_configuration_issue',
        category: 'service',
        priority: 'warning',
        title: 'Service configuration issue',
        message: `${service.name} has profile settings that need an account configuration review.`,
        entityType: 'service',
        entityId: service.id,
        serviceId: service.id,
        section: 'services',
      }));
    }
    service.planDetails?.forEach(plan => {
      if (plan.status !== 'inactive') return;
      append(buildSystemNotification(data, {
        dedupeKey: `service-plan-inactive-${service.id}-${plan.id}`,
        type: 'plan_inactive',
        category: 'service',
        priority: 'info',
        title: 'Plan inactive',
        message: `${plan.name} for ${service.name} is inactive and cannot be selected for new sales.`,
        entityType: 'service',
        entityId: service.id,
        serviceId: service.id,
        section: 'services',
      }));
    });
  });

  if (data.storageWarning) {
    append(buildSystemNotification(data, {
      dedupeKey: `system-data-warning-${data.storageWarning}`,
      type: 'data_warning',
      category: 'system',
      priority: 'warning',
      title: 'Data warning',
      message: data.storageWarning,
      section: 'settings',
    }));
  }
  return generated;
};

const MANAGED_PREFIXES = [
  'subscription-expiring-', 'subscription-expired-', 'payment-failed-', 'payment-pending-',
  'payment-partial-', 'payment-received-', 'invoice-due-', 'account-capacity-',
  'account-inactive-', 'service-inactive-', 'service-no-active-plans-', 'system-data-warning-',
  'profile-unavailable-', 'service-plan-inactive-',
  'service-config-issue-', 'service-expiring-week-',
];

export const reconcileSystemNotifications = (
  existing: BusinessNotification[],
  generated: BusinessNotification[],
  businessId?: string
): BusinessNotification[] => {
  const generatedByKey = new Map(
    generated.filter(item => item.dedupeKey).map(item => [item.dedupeKey!, item])
  );
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const reconciled = existing.map(item => {
    if (businessId && item.businessId && item.businessId !== businessId) return item;
    const key = item.dedupeKey;
    if (!key || !MANAGED_PREFIXES.some(prefix => key.startsWith(prefix))) return item;
    const current = generatedByKey.get(key);
    if (current) {
      seen.add(key);
      return { ...current, id: item.id, createdAt: item.createdAt, read: item.read };
    }
    if (item.expiresAt === undefined || Date.parse(item.expiresAt) > Date.now()) {
      return { ...item, read: true, expiresAt: now };
    }
    return item;
  });
  generatedByKey.forEach((item, key) => {
    if (!seen.has(key) && !reconciled.some(existingItem => existingItem.dedupeKey === key)) reconciled.unshift(item);
  });
  return reconciled.filter(notification => {
    if (!notification.expiresAt || Date.parse(notification.expiresAt) > Date.now()) return true;
    if (notification.category === 'payment' || notification.category === 'invoice') return true;
    return Date.now() - Date.parse(notification.expiresAt) < 90 * 24 * 60 * 60 * 1000;
  });
};

export const getNotificationSection = (notification: BusinessNotification): NotificationSection =>
  notification.section;

export const getLiveNotifications = (notifications: BusinessNotification[], businessId?: string): BusinessNotification[] =>
  notifications.filter(item => (!businessId || !item.businessId || item.businessId === businessId));

export const getUnreadNotifications = (notifications: BusinessNotification[]): BusinessNotification[] =>
  notifications.filter(notification => !notification.read);

export const createBusinessEventNotification = (
  businessId: string | undefined,
  category: NotificationCategory,
  priority: NotificationPriority,
  type: string,
  title: string,
  message: string,
  section: NotificationSection,
  links: Partial<Pick<BusinessNotification,
    'entityType' | 'entityId' | 'customerId' | 'serviceId' | 'subscriptionId' | 'saleId' | 'paymentId' | 'invoiceId' | 'accountId' | 'profileId'
  >> = {},
  dedupeKey?: string
): BusinessNotification =>
  createNotification({
    ...(dedupeKey ? { dedupeKey } : {}),
    type,
    category,
    priority,
    title,
    message,
    section,
    ...links,
  }, businessId);

export const notifyPaymentReceived = (
  businessId: string | undefined,
  payment: Payment,
  customerName: string,
  invoiceNumber?: string
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'payment',
  'success',
  'payment_received',
  'Payment received',
  `${formatCurrency(payment.amount, payment.currency)} received from ${customerName}${invoiceNumber ? ` for invoice ${invoiceNumber}` : ''}.`,
  'payments',
  {
    entityType: 'payment',
    entityId: payment.id,
    customerId: payment.customerId,
    paymentId: payment.id,
    saleId: payment.saleId,
    subscriptionId: payment.subscriptionId,
    invoiceId: payment.invoiceId,
  },
  `payment-received-${payment.id}`
);

export const notifyPaymentFailed = (
  businessId: string | undefined,
  payment: Payment,
  invoiceNumber?: string
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'payment',
  'critical',
  'payment_failed',
  'Payment failed',
  `Payment failed${invoiceNumber ? ` for invoice ${invoiceNumber}` : ''}.`,
  'payments',
  {
    entityType: 'payment',
    entityId: payment.id,
    customerId: payment.customerId,
    paymentId: payment.id,
    saleId: payment.saleId,
    subscriptionId: payment.subscriptionId,
    invoiceId: payment.invoiceId,
  },
  `payment-failed-${payment.id}`
);

export const notifySubscriptionExpiring = (
  businessId: string | undefined,
  subscription: Subscription,
  customerName: string,
  serviceName: string,
  reminderThreshold: number,
  daysRemaining: number
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'subscription',
  daysRemaining <= 1 ? 'critical' : 'warning',
  'subscription_expiring',
  daysRemaining === 0 ? 'Renewal due today' : daysRemaining === 1 ? 'Subscription expires tomorrow' : 'Subscription expiring soon',
  `${customerName}’s ${serviceName} ${daysRemaining === 0 ? 'expires today' : `expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}.`,
  'subscriptions',
  {
    entityType: 'subscription',
    entityId: subscription.id,
    customerId: subscription.customerId,
    serviceId: subscription.serviceId,
    subscriptionId: subscription.id,
  },
  `subscription-expiring-${subscription.id}-${subscription.expiryDate}-${Math.max(1, reminderThreshold)}`
);

export const notifySubscriptionExpired = (
  businessId: string | undefined,
  subscription: Subscription,
  customerName: string,
  serviceName: string
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'subscription',
  'critical',
  'subscription_expired',
  'Subscription expired',
  `${customerName}’s ${serviceName} subscription expired.`,
  'subscriptions',
  {
    entityType: 'subscription',
    entityId: subscription.id,
    customerId: subscription.customerId,
    serviceId: subscription.serviceId,
    subscriptionId: subscription.id,
  },
  `subscription-expired-${subscription.id}-${subscription.expiryDate}`
);

export const notifyRenewalCompleted = (
  businessId: string | undefined,
  subscription: Subscription,
  customerName: string,
  serviceName: string,
  saleId: string,
  paymentId: string,
  invoiceId?: string
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'subscription',
  'success',
  'renewal_completed',
  'Renewal completed',
  `${serviceName} renewed for ${customerName}.`,
  'subscriptions',
  {
    entityType: 'subscription',
    entityId: subscription.id,
    customerId: subscription.customerId,
    serviceId: subscription.serviceId,
    subscriptionId: subscription.id,
    saleId,
    paymentId,
    invoiceId,
  },
  `renewal-completed-${saleId}`
);

export const notifyInvoiceDue = (
  businessId: string | undefined,
  invoice: Invoice,
  customerName: string,
  currency: Payment['currency']
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'invoice',
  'warning',
  'invoice_due',
  'Invoice has a due amount',
  `Invoice ${invoice.invoiceNumber} has ${formatCurrency(invoice.dueAmount, currency)} due from ${customerName}.`,
  'invoices',
  {
    entityType: 'invoice',
    entityId: invoice.invoiceId,
    customerId: invoice.customerId,
    serviceId: invoice.serviceId,
    subscriptionId: invoice.subscriptionId,
    saleId: invoice.saleId,
    invoiceId: invoice.invoiceId,
  },
  `invoice-due-${invoice.invoiceId}`
);

export const notifyAccountCapacity = (
  businessId: string | undefined,
  account: Account,
  serviceName: string,
  used: number,
  capacity: number
): BusinessNotification => {
  const full = capacity > 0 && used >= capacity;
  const ratio = capacity > 0 ? used / capacity : 0;
  const priority: NotificationPriority = full ? 'critical' : ratio >= 0.9 ? 'warning' : 'info';
  const remaining = Math.max(0, capacity - used);
  return createBusinessEventNotification(
    businessId,
    'account',
    priority,
    full ? 'account_capacity_full' : 'account_capacity_low',
    full ? 'Account profile capacity full' : 'Account profile capacity low',
    full
      ? `${serviceName} ${account.plan || 'account'} is full.`
      : `${serviceName} ${account.plan || 'account'} has ${remaining} ${remaining === 1 ? 'profile' : 'profiles'} available.`,
    'accounts',
    { entityType: 'account', entityId: account.id, serviceId: account.serviceId, accountId: account.id },
    `account-capacity-${account.id}-${full ? 'full' : priority}-${capacity}-${used}`
  );
};

export const notifySystemEvent = (
  businessId: string | undefined,
  type: string,
  title: string,
  message: string,
  priority: NotificationPriority = 'info'
): BusinessNotification => createBusinessEventNotification(
  businessId,
  'system',
  priority,
  type,
  title,
  message,
  'settings'
);
