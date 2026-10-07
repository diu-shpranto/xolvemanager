import type {
  ActivityAction,
  ActivityCategory,
  ActivityEntityType,
  ActivityLog,
} from '../types';

type ActivityInput = Omit<ActivityLog, 'id' | 'timestamp' | 'createdAt' | 'businessId' | 'createdBy'>;

const sensitiveKeyPattern = /password|passcode|pin|api.?key|secret|credential|token/i;
const sensitiveTextPattern = /\b(password|passcode|pin|api[\s_-]?key|secret|credential|token)\s*[:=]\s*([^\s,;]+)/gi;

export const normalizeActivitySearch = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function sanitizeActivityDescription(description: string, sensitiveValues: string[] = []): string {
  return sensitiveValues.filter(value => value.length >= 3)
    .reduce((safe, value) => safe.split(value).join('[redacted]'), description)
    .replace(sensitiveTextPattern, '$1: [redacted]');
}

export function getActivityCategory(log: Pick<ActivityLog, 'category' | 'type' | 'title'>): ActivityCategory {
  if (log.category) return log.category;
  const value = `${log.type} ${log.title}`.toLowerCase();
  if (value.includes('financial') || value.includes('cashbook') || value.includes('expense') || value.includes('income')
    || value.includes('transfer') || value.includes('adjustment') || value.includes('refund')) return 'financials';
  if (value.includes('customer')) return 'customers';
  if (value.includes('plan')) return 'plans';
  if (value.includes('profile')) return 'profiles';
  if (value.includes('account')) return 'accounts';
  if (value.includes('service')) return 'services';
  if (value.includes('subscription') || value.includes('renewal')) return 'subscriptions';
  if (value.includes('sale')) return 'sales';
  if (value.includes('payment')) return 'payments';
  if (value.includes('invoice')) return 'invoices';
  if (value.includes('reminder')) return 'reminders';
  if (value.includes('backup') || value.includes('restore') || value.includes('import') || value.includes('export') || value.includes('data')) return 'data';
  if (value.includes('business') || value.includes('setting')) return 'business';
  return 'system';
}

export function getActivityAction(log: Pick<ActivityLog, 'action' | 'type' | 'title'>): ActivityAction {
  if (log.action) return log.action;
  const value = `${log.type} ${log.title}`.toLowerCase();
  if (value.includes('deactivat') || value.includes('archiv')) return 'deactivated';
  if (value.includes('unassign')) return 'unassigned';
  if (value.includes('assign')) return 'assigned';
  if (value.includes('renew')) return 'renewed';
  if (value.includes('paid') || value.includes('received')) return 'paid';
  if (value.includes('fail')) return 'failed';
  if (value.includes('expir')) return 'expired';
  if (value.includes('complet')) return 'completed';
  if (value.includes('clear') || value.includes('removed') || value.includes('deleted')) return 'deleted';
  if (value.includes('updated') || value.includes('changed') || value.includes('edited') || value.includes('cancelled')) return 'updated';
  if (value.includes('created') || value.includes('added') || value.includes('generated')) return 'created';
  return 'other';
}

export function getActivityEntityType(log: Pick<ActivityLog, 'entityType' | 'category' | 'type' | 'title'>): ActivityEntityType {
  if (log.entityType) return log.entityType;
  const category = getActivityCategory(log);
  return category === 'customers' ? 'customer'
    : category === 'services' ? 'service'
      : category === 'plans' ? 'plan'
        : category === 'accounts' ? 'account'
          : category === 'profiles' ? 'profile'
            : category === 'subscriptions' ? 'subscription'
              : category === 'sales' ? 'sale'
                : category === 'payments' ? 'payment'
                  : category === 'invoices' ? 'invoice'
                    : category === 'reminders' ? 'reminder'
                      : category === 'business' ? 'business'
                        : category === 'data' ? 'data' : 'system';
}

function safeMetadata(metadata?: ActivityLog['metadata']): ActivityLog['metadata'] {
  if (!metadata) return undefined;
  return Object.fromEntries(Object.entries(metadata)
    .filter(([key]) => !sensitiveKeyPattern.test(key))
    .map(([key, value]) => [key, typeof value === 'string' ? sanitizeActivityDescription(value) : value]));
}

export function createAuditLog(
  input: ActivityInput,
  identity: { id: string; timestamp?: string; businessId?: string; createdBy?: string }
): ActivityLog {
  const timestamp = identity.timestamp || new Date().toISOString();
  return {
    ...input,
    id: identity.id,
    ...(identity.businessId ? { businessId: identity.businessId } : {}),
    category: getActivityCategory(input),
    action: getActivityAction(input),
    entityType: getActivityEntityType(input),
    description: sanitizeActivityDescription(input.description),
    ...(input.metadata ? { metadata: safeMetadata(input.metadata) } : {}),
    timestamp,
    ...(identity.createdBy ? { createdBy: identity.createdBy } : {}),
    createdAt: timestamp,
  };
}

export type ActivityDateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'custom';

export interface ActivityFilters {
  query?: string;
  category?: ActivityCategory | 'all';
  action?: ActivityAction | 'all';
  entityType?: ActivityEntityType | 'all';
  date?: ActivityDateFilter;
  customStart?: string;
  customEnd?: string;
}

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function dateMatches(timestamp: string, filters: ActivityFilters, now: Date): boolean {
  if (!filters.date || filters.date === 'all') return true;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return false;
  const today = startOfDay(now);
  const candidate = startOfDay(date);
  if (filters.date === 'today') return candidate.getTime() === today.getTime();
  if (filters.date === 'yesterday') return candidate.getTime() === today.getTime() - 86400000;
  if (filters.date === 'week') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return candidate >= monday && candidate <= today;
  }
  if (filters.date === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (filters.date === 'last-month') {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getFullYear() === previousMonth.getFullYear() && date.getMonth() === previousMonth.getMonth();
  }
  const start = filters.customStart ? startOfDay(new Date(`${filters.customStart}T00:00:00`)) : undefined;
  const end = filters.customEnd ? startOfDay(new Date(`${filters.customEnd}T00:00:00`)) : undefined;
  return (!start || candidate >= start) && (!end || candidate <= end);
}

export function searchActivities(
  logs: ActivityLog[],
  searchableValues: (log: ActivityLog) => string[] = () => [],
  query = ''
): ActivityLog[] {
  const normalizedQuery = normalizeActivitySearch(query);
  if (!normalizedQuery) return [...logs];
  const terms = normalizedQuery.split(' ');
  return logs.filter(log => {
    const searchable = normalizeActivitySearch([
      log.title,
      log.description,
      log.customerName || '',
      log.serviceName || '',
      log.invoiceNumber || '',
      log.entityId || '',
      log.customerId || '',
      log.serviceId || '',
      log.planId || '',
      log.accountId || '',
      log.profileId || '',
      log.subscriptionId || '',
      log.saleId || '',
      log.paymentId || '',
      log.invoiceId || '',
      ...searchableValues(log),
    ].join(' '));
    return terms.every(term => searchable.includes(term));
  });
}

export function filterActivities(
  logs: ActivityLog[],
  filters: ActivityFilters,
  now = new Date()
): ActivityLog[] {
  return logs.filter(log =>
    (!filters.category || filters.category === 'all' || getActivityCategory(log) === filters.category)
    && (!filters.action || filters.action === 'all' || getActivityAction(log) === filters.action)
    && (!filters.entityType || filters.entityType === 'all' || getActivityEntityType(log) === filters.entityType)
    && dateMatches(log.timestamp, filters, now)
  );
}
