import type {
  AppSettings,
  Customer,
  DailyClosing,
  Invoice,
  Payment,
  Reminder,
  ReminderPriority,
  ReminderPreferences,
  ReminderType,
  Sale,
  Service,
  Subscription,
} from '../types';
import { getSaleDueAmount, getSalePaidAmount } from '../utils/saleUtils';
import { getDaysDifferenceInTimeZone } from '../utils/dateUtils';
import { createRecordId } from './localStorageStore';

export interface ReminderEngineData {
  businessId?: string;
  customers: Customer[];
  services: Service[];
  subscriptions: Subscription[];
  sales: Sale[];
  payments: Payment[];
  invoices: Invoice[];
  dailyClosings: DailyClosing[];
  expenses: Array<{ date: string; status?: string; businessId?: string }>;
  settings: AppSettings;
}

export interface ReminderCandidate extends Omit<Reminder, 'id' | 'reminderId' | 'status' | 'createdAt' | 'updatedAt'> {}

export const sanitizeReminderText = (value: string): string =>
  value
    .replace(/\b(password|passcode|pin|credential|secret|login|access.?code)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .replace(/\{[^}]*?(?:password|passcode|pin|credential|secret|login|access.?code)[^}]*?\}/gi, '[redacted]');

export const DEFAULT_REMINDER_PREFERENCES: Required<ReminderPreferences> = {
  enabled: true,
  subscriptionDays: [30, 14, 7, 3, 1, 0],
  paymentOverdueDays: [0, 1, 3, 7, 14, 30],
  invoiceOverdueDays: [0, 1, 3, 7, 14, 30],
  dailyClosingEnabled: true,
};

export function getReminderPreferences(settings: AppSettings): Required<ReminderPreferences> {
  const saved = settings.reminderPreferences;
  const safeDays = (values: number[] | undefined, defaults: number[]) =>
    [...new Set((values || defaults).filter(value => Number.isInteger(value) && value >= 0))]
      .sort((left, right) => right - left);
  return {
    enabled: saved?.enabled !== false,
    subscriptionDays: safeDays(saved?.subscriptionDays, DEFAULT_REMINDER_PREFERENCES.subscriptionDays),
    paymentOverdueDays: safeDays(saved?.paymentOverdueDays, DEFAULT_REMINDER_PREFERENCES.paymentOverdueDays),
    invoiceOverdueDays: safeDays(saved?.invoiceOverdueDays, DEFAULT_REMINDER_PREFERENCES.invoiceOverdueDays),
    dailyClosingEnabled: saved?.dailyClosingEnabled !== false,
  };
}

const parseDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
};

const forBusiness = <T extends { businessId?: string }>(records: T[], businessId?: string): T[] =>
  businessId ? records.filter(record => !record.businessId || record.businessId === businessId) : records;
const reminderSourceKey = (businessId: string | undefined, sourceEntityType: string, sourceEntityId: string): string =>
  `${businessId || 'local'}:${sourceEntityType}:${sourceEntityId}`;

const pickStage = (daysElapsed: number, stages: number[]): number | undefined =>
  stages.find(stage => daysElapsed >= stage);

const priorityForPayment = (daysOverdue: number): ReminderPriority =>
  daysOverdue >= 30 ? 'critical' : daysOverdue >= 7 ? 'high' : daysOverdue >= 0 ? 'medium' : 'low';

const priorityForRenewal = (daysRemaining: number): ReminderPriority =>
  daysRemaining < 0 ? 'high' : daysRemaining <= 1 ? 'medium' : daysRemaining <= 7 ? 'medium' : 'low';

const makeCandidate = (
  data: ReminderEngineData,
  details: Omit<ReminderCandidate, 'businessId' | 'deterministicKey' | 'systemGenerated'>
): ReminderCandidate => ({
  ...details,
  title: sanitizeReminderText(details.title),
  description: details.description ? sanitizeReminderText(details.description) : undefined,
  businessId: data.businessId,
  deterministicKey: [
    data.businessId || 'local',
    details.type,
    details.sourceEntityId,
    details.targetDate || details.dueDate,
    details.stage || 'default',
  ].join(':'),
  systemGenerated: true,
});

export function generateReminderCandidates(
  data: ReminderEngineData,
  today: string
): ReminderCandidate[] {
  const preferences = getReminderPreferences(data.settings);
  if (!preferences.enabled || !parseDate(today)) return [];
  const scopedData: ReminderEngineData = {
    ...data,
    customers: forBusiness(data.customers, data.businessId),
    services: forBusiness(data.services, data.businessId),
    subscriptions: forBusiness(data.subscriptions, data.businessId),
    sales: forBusiness(data.sales, data.businessId),
    payments: forBusiness(data.payments, data.businessId),
    invoices: forBusiness(data.invoices, data.businessId),
    dailyClosings: forBusiness(data.dailyClosings, data.businessId),
    expenses: forBusiness(data.expenses, data.businessId),
  };
  const candidates: ReminderCandidate[] = [];
  const customersById = new Map(scopedData.customers.map(customer => [customer.id, customer]));
  const servicesById = new Map(scopedData.services.map(service => [service.id, service]));
  const invoicesBySaleId = new Map(scopedData.invoices.map(invoice => [invoice.saleId, invoice]));

  scopedData.subscriptions.forEach(subscription => {
    if (subscription.status === 'cancelled' || subscription.cancelledAt || !parseDate(subscription.expiryDate)) return;
    const daysRemaining = getDaysDifferenceInTimeZone(subscription.expiryDate, data.settings.businessProfile?.timeZone);
    const service = servicesById.get(subscription.serviceId);
    const customerName = customersById.get(subscription.customerId)?.name || 'Customer';
    const serviceName = service?.name || 'subscription';
    const common = {
      customerId: subscription.customerId,
      serviceId: subscription.serviceId,
      planId: subscription.planId,
      subscriptionId: subscription.id,
      sourceEntityType: 'subscription' as const,
      sourceEntityId: subscription.id,
      targetDate: subscription.expiryDate,
      amount: subscription.price,
      currency: subscription.currency,
    };
    if (daysRemaining < 0) {
      candidates.push(makeCandidate(data, {
        ...common,
        type: 'subscription_expired',
        priority: priorityForRenewal(daysRemaining),
        title: `${serviceName} ${subscription.plan} subscription expired`,
        description: `${customerName}’s subscription expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago.`,
        dueDate: subscription.expiryDate,
        stage: 'AFTER_EXPIRY',
      }));
      return;
    }
    if (daysRemaining === 0) {
      candidates.push(makeCandidate(data, {
        ...common,
        type: 'renewal_today',
        priority: 'high',
        title: `${serviceName} ${subscription.plan} renewal is due today`,
        description: `${customerName}’s subscription expires today.`,
        dueDate: today,
        stage: 'EXPIRY_DAY',
      }));
      return;
    }
    const stage = preferences.subscriptionDays.find(days => days > 0 && daysRemaining <= days);
    if (stage === undefined) return;
    candidates.push(makeCandidate(data, {
      ...common,
      type: 'renewal_upcoming',
      priority: priorityForRenewal(daysRemaining),
      title: `${serviceName} ${subscription.plan} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      description: `${customerName}’s subscription expires on ${subscription.expiryDate}.`,
      dueDate: today,
      stage: `${stage}_DAYS`,
    }));
  });

  scopedData.invoices.forEach(invoice => {
    if (invoice.dueAmount <= 0 || !parseDate(invoice.invoiceDate)) return;
    const daysOverdue = Math.max(0, -getDaysDifferenceInTimeZone(invoice.invoiceDate, data.settings.businessProfile?.timeZone));
    const stage = pickStage(daysOverdue, preferences.invoiceOverdueDays);
    if (stage === undefined) return;
    const overdue = daysOverdue > 0;
    const partiallyPaid = invoice.paidAmount > 0;
    const customerName = customersById.get(invoice.customerId)?.name || 'Customer';
    const serviceName = servicesById.get(invoice.serviceId)?.name || 'service';
    const type: ReminderType = overdue ? 'invoice_overdue' : partiallyPaid ? 'partial_payment' : 'invoice_due';
    candidates.push(makeCandidate(data, {
      type,
      priority: priorityForPayment(daysOverdue),
      title: overdue ? `Invoice ${invoice.invoiceNumber} is overdue`
        : partiallyPaid ? `Partial payment for invoice ${invoice.invoiceNumber}`
          : `Invoice ${invoice.invoiceNumber} is due`,
      description: `${customerName} · ${serviceName} · outstanding ${invoice.dueAmount.toLocaleString()}.`,
      customerId: invoice.customerId,
      serviceId: invoice.serviceId,
      planId: invoice.planId,
      subscriptionId: invoice.subscriptionId,
      saleId: invoice.saleId,
      invoiceId: invoice.invoiceId,
      sourceEntityType: 'invoice',
      sourceEntityId: invoice.invoiceId,
      dueDate: invoice.invoiceDate,
      targetDate: invoice.invoiceDate,
      stage: `${stage}${overdue ? '_DAYS_OVERDUE' : '_DUE'}`,
      amount: invoice.dueAmount,
      currency: scopedData.sales.find(sale => sale.id === invoice.saleId)?.currency || data.settings.currency,
    }));
  });

  scopedData.sales.forEach(sale => {
    if (invoicesBySaleId.has(sale.id) || sale.paymentStatus === 'refunded' || !parseDate(sale.date)) return;
    const due = getSaleDueAmount(sale, scopedData.payments);
    if (due <= 0) return;
    const daysOverdue = Math.max(0, -getDaysDifferenceInTimeZone(sale.date, data.settings.businessProfile?.timeZone));
    const stage = pickStage(daysOverdue, preferences.paymentOverdueDays);
    if (stage === undefined) return;
    const paid = getSalePaidAmount(sale, scopedData.payments);
    const type: ReminderType = daysOverdue > 0 ? 'payment_overdue' : paid > 0 ? 'partial_payment' : 'unpaid_sale';
    const customerName = customersById.get(sale.customerId)?.name || 'Customer';
    const serviceName = servicesById.get(sale.serviceId)?.name || 'service';
    candidates.push(makeCandidate(data, {
      type,
      priority: priorityForPayment(daysOverdue),
      title: daysOverdue > 0 ? `Payment overdue for ${sale.invoiceNo}`
        : paid > 0 ? `Partial payment for ${sale.invoiceNo}` : `Payment pending for ${sale.invoiceNo}`,
      description: `${customerName} · ${serviceName} · outstanding ${due.toLocaleString()}.`,
      customerId: sale.customerId,
      serviceId: sale.serviceId,
      planId: sale.planId,
      subscriptionId: sale.subscriptionId,
      saleId: sale.id,
      sourceEntityType: 'sale',
      sourceEntityId: sale.id,
      dueDate: sale.date,
      targetDate: sale.date,
      stage: `${stage}${daysOverdue > 0 ? '_DAYS_OVERDUE' : '_DUE'}`,
      amount: due,
      currency: sale.currency,
    }));
  });

  if (preferences.dailyClosingEnabled) {
    const dayHasActivity = scopedData.sales.some(sale => sale.date === today)
      || scopedData.payments.some(payment => payment.paymentDate === today && payment.paymentStatus !== 'failed')
      || scopedData.expenses.some(expense => expense.date === today && expense.status !== 'voided');
    const alreadyClosed = scopedData.dailyClosings.some(closing =>
      closing.date === today && closing.status === 'closed'
      && (!data.businessId || closing.businessId === data.businessId)
    );
    if (dayHasActivity && !alreadyClosed) {
      candidates.push(makeCandidate(data, {
        type: 'daily_closing',
        priority: 'critical',
        title: `Daily closing is not completed for ${today}`,
        description: 'Review today’s recorded business activity and close the day.',
        sourceEntityType: 'daily_closing',
        sourceEntityId: today,
        dueDate: today,
        targetDate: today,
        stage: 'BUSINESS_DAY',
      }));
    }
  }

  return candidates;
}

export function reconcileReminderCandidates(
  existing: Reminder[],
  candidates: ReminderCandidate[],
  now = new Date().toISOString(),
  resolvedSourceKeys: Set<string> = new Set(),
  businessId?: string
): { reminders: Reminder[]; created: Reminder[] } {
  const byKey = new Map(existing.map(reminder => [reminder.deterministicKey, reminder]));
  const created: Reminder[] = [];
  let next = existing;
  const resolved = existing.filter(reminder => reminder.systemGenerated
    && reminder.status !== 'completed'
    && reminder.status !== 'dismissed'
    && (!reminder.businessId || !businessId || reminder.businessId === businessId)
    && resolvedSourceKeys.has(reminderSourceKey(reminder.businessId || businessId, reminder.sourceEntityType, reminder.sourceEntityId)));
  if (resolved.length) {
    const resolvedIds = new Set(resolved.map(reminder => reminder.id));
    next = existing.map(reminder => resolvedIds.has(reminder.id)
      ? { ...reminder, status: 'completed', completedAt: now, updatedAt: now }
      : reminder);
  }
  candidates.forEach(candidate => {
    const previous = byKey.get(candidate.deterministicKey);
    const isSameEventFamily = (reminder: Reminder) => {
      if (reminder.sourceEntityType !== candidate.sourceEntityType
        || reminder.sourceEntityId !== candidate.sourceEntityId
        || reminder.businessId !== candidate.businessId
        || reminder.status === 'completed' || reminder.status === 'dismissed') return false;
      const renewal = reminder.type.startsWith('renewal') || reminder.type === 'subscription_expired';
      const candidateRenewal = candidate.type.startsWith('renewal') || candidate.type === 'subscription_expired';
      const payment = ['payment_due', 'payment_overdue', 'invoice_due', 'invoice_overdue', 'partial_payment', 'unpaid_sale'].includes(reminder.type);
      const candidatePayment = ['payment_due', 'payment_overdue', 'invoice_due', 'invoice_overdue', 'partial_payment', 'unpaid_sale'].includes(candidate.type);
      return (renewal && candidateRenewal) || (payment && candidatePayment);
    };
    const superseded = next.filter(reminder => reminder.systemGenerated
      && reminder.deterministicKey !== candidate.deterministicKey
      && isSameEventFamily(reminder));
    if (superseded.length) {
      if (next === existing) next = [...existing];
      const supersededIds = new Set(superseded.map(reminder => reminder.id));
      next = next.map(reminder => supersededIds.has(reminder.id)
        ? { ...reminder, status: 'completed', completedAt: now, updatedAt: now }
        : reminder);
    }
    if (previous) {
      const snoozeElapsed = previous.status === 'snoozed'
        && (!previous.snoozedUntil || Date.parse(previous.snoozedUntil) <= Date.parse(now));
      if (snoozeElapsed) {
        const reopened = { ...previous, status: 'open' as const, snoozedUntil: undefined, updatedAt: now };
        if (next === existing) next = [...existing];
        const index = next.findIndex(item => item.id === previous.id);
        if (index >= 0) next[index] = reopened;
      }
      return;
    }
      const reminderId = createRecordId('reminder');
      const reminder: Reminder = {
        ...candidate,
        id: reminderId,
        reminderId,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
    created.push(reminder);
      if (next === existing) next = [...existing];
      next.unshift(reminder);
  });
  return { reminders: next, created };
}

export function getResolvedReminderSourceKeys(
  existing: Reminder[],
  data: Pick<ReminderEngineData, 'businessId' | 'subscriptions' | 'sales' | 'payments' | 'invoices' | 'dailyClosings'>
): Set<string> {
  const resolved = new Set<string>();
  const subscriptions = forBusiness(data.subscriptions, data.businessId);
  const sales = forBusiness(data.sales, data.businessId);
  const invoices = forBusiness(data.invoices, data.businessId);
  const dailyClosings = forBusiness(data.dailyClosings, data.businessId);
  existing.forEach(reminder => {
    if (!reminder.systemGenerated || reminder.status === 'completed' || reminder.status === 'dismissed') return;
    if (reminder.businessId && data.businessId && reminder.businessId !== data.businessId) return;
    if (reminder.sourceEntityType === 'subscription') {
      const subscription = subscriptions.find(item => item.id === reminder.sourceEntityId);
      if (!subscription || subscription.status === 'cancelled' || subscription.cancelledAt
        || (reminder.targetDate && subscription.expiryDate !== reminder.targetDate)) {
        resolved.add(reminderSourceKey(data.businessId || reminder.businessId, 'subscription', reminder.sourceEntityId));
      }
    } else if (reminder.sourceEntityType === 'sale') {
      const sale = sales.find(item => item.id === reminder.sourceEntityId);
      if (!sale || sale.paymentStatus === 'refunded' || getSaleDueAmount(sale, data.payments) <= 0) {
        resolved.add(reminderSourceKey(data.businessId || reminder.businessId, 'sale', reminder.sourceEntityId));
      }
    } else if (reminder.sourceEntityType === 'invoice') {
      const invoice = invoices.find(item => item.invoiceId === reminder.sourceEntityId);
      if (!invoice || invoice.dueAmount <= 0) resolved.add(reminderSourceKey(data.businessId || reminder.businessId, 'invoice', reminder.sourceEntityId));
    } else if (reminder.sourceEntityType === 'daily_closing') {
      const closing = dailyClosings.find(item => item.date === reminder.sourceEntityId && item.status === 'closed');
      if (closing) resolved.add(reminderSourceKey(data.businessId || reminder.businessId, 'daily_closing', reminder.sourceEntityId));
    }
  });
  return resolved;
}

export const getOpenReminders = (reminders: Reminder[]): Reminder[] =>
  reminders.filter(reminder => reminder.status === 'open' || reminder.status === 'snoozed');
export const getTodayReminders = (reminders: Reminder[], today: string): Reminder[] =>
  getOpenReminders(reminders).filter(reminder => reminder.dueDate === today);
export const getUpcomingReminders = (reminders: Reminder[], today: string): Reminder[] =>
  getOpenReminders(reminders).filter(reminder => reminder.dueDate > today);
export const getOverdueReminders = (reminders: Reminder[], today: string): Reminder[] =>
  getOpenReminders(reminders).filter(reminder => reminder.dueDate < today);
export const getSnoozedReminders = (reminders: Reminder[]): Reminder[] =>
  reminders.filter(reminder => reminder.status === 'snoozed');
export const getReminderPriorityOrder = (priority: ReminderPriority): number =>
  ({ critical: 0, high: 1, medium: 2, low: 3 })[priority];
