import type {
  Account, ActivityLog, Customer, Invoice, Payment, Reminder, Sale, Service,
  Subscription,
} from '../types';
import type { NavSection } from '../components/navigation/Sidebar';
import { getSubscriptionStatus } from '../utils/dateUtils';

export type SearchEntity =
  | 'customers' | 'services' | 'plans' | 'accounts' | 'profiles'
  | 'subscriptions' | 'sales' | 'payments' | 'invoices' | 'history' | 'reminders';

export interface GlobalSearchResult {
  entity: SearchEntity;
  id: string;
  parentId?: string;
  section: NavSection;
  title: string;
  subtitle: string;
  detail: string;
  score: number;
  fields: string[];
}

export interface SearchData {
  customers: Customer[];
  services: Service[];
  accounts: Account[];
  subscriptions: Subscription[];
  sales: Sale[];
  payments: Payment[];
  invoices: Invoice[];
  activityLogs: ActivityLog[];
  reminders: Reminder[];
}

export interface RecentSearchItem {
  entity: SearchEntity;
  id: string;
  parentId?: string;
  viewedAt: string;
}

const RECENT_STORAGE_KEY = 'sqp_recent_search_items_v1';
const recentStorageKey = (businessId?: string): string => `${RECENT_STORAGE_KEY}_${businessId ?? 'local'}`;
export const normalizeSearchText = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
export const normalizePhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00880')) return `0${digits.slice(5)}`;
  if (digits.startsWith('8801')) return `0${digits.slice(3)}`;
  return digits;
};
export function matchesCustomerSearch(customer: Customer, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const fields = [customer.id, customer.name, customer.phone, customer.whatsapp ?? '', customer.email];
  if (fields.some(field => normalizeSearchText(field).includes(normalizedQuery))) return true;
  const queryDigits = normalizePhoneDigits(query);
  return queryDigits.length >= 3 && fields.some(field => {
    const digits = normalizePhoneDigits(field);
    return digits.length >= 3 && digits.includes(queryDigits);
  });
}
const safe = (value?: string | number | null): string => value === undefined || value === null ? '' : String(value);
const matchScore = (query: string, id: string, title: string, fields: string[], relatedFields: string[] = []): number => {
  const normalizedQuery = normalizeSearchText(query);
  const idValue = normalizeSearchText(id);
  const titleValue = normalizeSearchText(title);
  if (idValue && idValue === normalizedQuery) return 1000;
  if (titleValue && titleValue === normalizedQuery) return 900;
  if (idValue.startsWith(normalizedQuery)) return 800;
  if (titleValue.startsWith(normalizedQuery)) return 700;
  if (fields.some(field => normalizeSearchText(field).includes(normalizedQuery))) return 600;
  if (query.replace(/\D/g, '').length >= 3 && fields.some(field => {
    const digits = normalizePhoneDigits(field);
    return digits.length >= 3 && digits.includes(normalizePhoneDigits(query));
  })) return 600;
  if (relatedFields.some(field => normalizeSearchText(field).includes(normalizedQuery))) return 450;
  return 0;
};

export function buildSearchIndex(data: SearchData): GlobalSearchResult[] {
  const customers = new Map(data.customers.map(item => [item.id, item]));
  const services = new Map(data.services.map(item => [item.id, item]));
  const accounts = new Map(data.accounts.map(item => [item.id, item]));
  const salesById = new Map(data.sales.map(item => [item.id, item]));
  const salesBySubscriptionAndCustomer = new Map<string, Sale>();
  data.sales.forEach(item => {
    const key = `${item.subscriptionId ?? ''}:${item.customerId}`;
    if (!salesBySubscriptionAndCustomer.has(key)) salesBySubscriptionAndCustomer.set(key, item);
  });
  const invoicesById = new Map(data.invoices.map(invoice => [invoice.invoiceId, invoice]));
  const invoicesBySale = new Map(data.invoices.map(invoice => [invoice.saleId, invoice]));
  const sensitiveCredentialValues = [...new Set(data.accounts.flatMap(account => [
    account.password, account.passwordMasked ?? '', ...account.profiles.flatMap(profile => [profile.pin ?? '', profile.pinMasked ?? '']),
  ]).filter(value => value.length > 0))].sort((left, right) => right.length - left.length);
  const credentialPattern = sensitiveCredentialValues.length
    ? new RegExp(sensitiveCredentialValues.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')
    : null;
  const sanitizeHistoryText = (value: string): string => {
    const structurallyRedacted = value.replace(/\b(password|pin)\s*[:=]\s*\S+/gi, '$1: [redacted]');
    return credentialPattern ? structurallyRedacted.replace(credentialPattern, '[redacted]') : structurallyRedacted;
  };
  const results: GlobalSearchResult[] = [];
  const push = (result: Omit<GlobalSearchResult, 'score'>, query?: string, relatedFields: string[] = []) => {
    const score = query ? matchScore(query, result.id, result.title, result.fields, relatedFields) : 0;
    if (!query || score > 0) results.push({ ...result, score });
  };

  data.customers.forEach(item => push({
    entity: 'customers', id: item.id, section: 'customers', title: item.name,
    subtitle: item.phone, detail: item.email, fields: [item.id, item.name, item.phone, item.whatsapp ?? '', item.email],
  }));
  data.services.forEach(item => {
    const related = [item.name];
    push({
      entity: 'services', id: item.id, section: 'services', title: item.name,
      subtitle: item.category, detail: item.description ?? '', fields: [item.id, item.name, item.description ?? '', item.category, item.advanced?.internalCode ?? ''],
    });
    const namedPlans = item.planDetails?.length
      ? item.planDetails.map((plan, position) => ({ id: plan.id || item.planIds?.[position] || `${item.id}:${plan.name}`, name: plan.name, internalCode: plan.internalCode ?? '', durationDays: plan.durationDays, price: plan.price, currency: plan.currency }))
      : item.plans.map((name, position) => ({ id: item.planIds?.[position] || `${item.id}:${name}`, name, internalCode: '', durationDays: item.defaultDurationDays, price: item.defaultPrice ?? item.defaultPriceBDT ?? 0, currency: item.currency ?? 'BDT' as const }));
    namedPlans.forEach(plan => push({
      entity: 'plans', id: plan.id, parentId: item.id, section: 'services',
      title: plan.name, subtitle: item.name, detail: `${plan.durationDays} days · ${plan.price} ${plan.currency}`,
      fields: [plan.id, plan.name, plan.internalCode],
    }, undefined, [...related, item.advanced?.internalCode ?? '']));
  });
  data.accounts.forEach(item => {
    const service = services.get(item.serviceId);
    const related = [service?.name ?? '', item.plan];
    push({
      entity: 'accounts', id: item.id, section: 'accounts', title: item.name || item.email,
      subtitle: `${service?.name ?? 'Service'} · ${item.plan}`, detail: item.status,
      fields: [item.id, item.name ?? '', item.email, item.username ?? '', item.planId ?? '', service?.name ?? '', item.plan],
    });
    item.profiles.forEach(profile => {
      const customer = profile.assignedCustomerId ? customers.get(profile.assignedCustomerId) : undefined;
      push({
        entity: 'profiles', id: profile.id, parentId: item.id, section: 'accounts',
        title: profile.profileName, subtitle: customer?.name ?? item.email,
        detail: profile.status, fields: [profile.id, profile.profileName],
      }, undefined, [...related, customer?.name ?? '']);
    });
  });
  data.subscriptions.forEach(item => {
    const customer = customers.get(item.customerId);
    const service = services.get(item.serviceId);
    const account = item.accountId ? accounts.get(item.accountId) : undefined;
    const profile = account?.profiles.find(candidate => candidate.id === item.profileId);
    const status = getSubscriptionStatus(item, service);
    push({
      entity: 'subscriptions', id: item.id, section: 'subscriptions',
      title: customer?.name ?? 'Unknown customer',
      subtitle: `${service?.name ?? 'Service'} · ${item.plan}`,
      detail: `${status.replace('_', ' ')} · Expires ${item.expiryDate}`,
      fields: [
        item.id, item.plan, item.startDate, item.expiryDate, status, item.paymentStatus,
        customer?.name ?? '', customer?.phone ?? '', customer?.whatsapp ?? '', customer?.email ?? '',
        service?.name ?? '', account?.name ?? '', account?.email ?? '', profile?.profileName ?? '',
      ],
    });
  });
  data.sales.forEach(item => {
    const customer = customers.get(item.customerId);
    const service = services.get(item.serviceId);
    const invoice = invoicesBySale.get(item.id);
    push({
      entity: 'sales', id: item.id, section: 'sales',
      title: item.invoiceNo || item.id, subtitle: customer?.name ?? 'Unknown customer',
      detail: `${item.date} · ${item.amount} ${item.currency} · ${item.paymentStatus}`,
      fields: [item.id, item.invoiceNo, item.plan, item.date, item.paymentStatus],
    }, undefined, [customer?.name ?? '', service?.name ?? '', invoice?.invoiceNumber ?? '']);
  });
  data.payments.forEach(item => {
    const invoice = item.invoiceId ? invoicesById.get(item.invoiceId) : undefined;
    const sale = (item.saleId ? salesById.get(item.saleId) : undefined)
      || (invoice ? salesById.get(invoice.saleId) : undefined)
      || (item.subscriptionId ? salesBySubscriptionAndCustomer.get(`${item.subscriptionId}:${item.customerId ?? ''}`) : undefined);
    const customer = customers.get(item.customerId || sale?.customerId || '');
    const relatedInvoice = invoice || (sale ? invoicesBySale.get(sale.id) : undefined);
    const service = sale ? services.get(sale.serviceId) : undefined;
    push({
      entity: 'payments', id: item.id, section: 'payments',
      title: item.id, subtitle: customer?.name ?? 'Unknown customer',
      detail: `${service?.name ?? 'Payment'}${sale?.plan ? ` · ${sale.plan}` : ''} · ${relatedInvoice?.invoiceNumber ?? sale?.invoiceNo ?? 'No invoice'} · ${item.paymentDate} · ${item.amount} ${item.currency} · ${item.paymentStatus}`,
      fields: [
        item.id, item.transactionId ?? '', item.paymentDate, item.paymentStatus,
        item.paymentMethod, item.saleId ?? '', item.invoiceId ?? '',
        customer?.name ?? '', customer?.phone ?? '', customer?.whatsapp ?? '', customer?.email ?? '',
        relatedInvoice?.invoiceNumber ?? '', sale?.id ?? '', sale?.invoiceNo ?? '',
        service?.name ?? '', sale?.plan ?? '',
      ],
    }, undefined, [customer?.name ?? '', customer?.phone ?? '', customer?.email ?? '', relatedInvoice?.invoiceNumber ?? '', item.saleId ?? '', service?.name ?? '', sale?.plan ?? '']);
  });
  data.invoices.forEach(item => {
    const customer = customers.get(item.customerId);
    const service = services.get(item.serviceId);
    const sale = salesById.get(item.saleId);
    push({
      entity: 'invoices', id: item.invoiceId, section: 'invoices',
      title: item.invoiceNumber, subtitle: customer?.name ?? 'Unknown customer',
      detail: `${item.invoiceDate} · ${item.totalAmount} · ${item.paymentStatus}`,
      fields: [item.invoiceId, item.invoiceNumber, item.invoiceDate, item.paymentStatus, sale?.plan ?? ''],
    }, undefined, [customer?.name ?? '', service?.name ?? '']);
  });
  data.activityLogs.forEach(item => {
    const safeDescription = sanitizeHistoryText(item.description);
    push({
      entity: 'history', id: item.id, section: 'history',
      title: item.title, subtitle: safeDescription,
      detail: item.timestamp, fields: [item.id, item.type, item.title, safeDescription, item.entityId ?? '', item.invoiceNumber ?? '', item.customerName ?? '', item.serviceName ?? ''],
    }, undefined, [item.customerName ?? '', item.serviceName ?? '']);
  });
  data.reminders.forEach(item => {
    const customer = item.customerId ? customers.get(item.customerId) : undefined;
    const service = item.serviceId ? services.get(item.serviceId) : undefined;
    push({
      entity: 'reminders', id: item.id, section: 'reminders',
      title: item.title,
      subtitle: customer?.name ?? 'Business reminder',
      detail: `${item.type.replaceAll('_', ' ')} · ${item.dueDate} · ${item.status}`,
      fields: [item.id, item.title, item.description ?? '', item.type, item.sourceEntityId, item.stage ?? ''],
    }, undefined, [customer?.name ?? '', service?.name ?? '', item.invoiceId ?? '', item.saleId ?? '']);
  });

  return results;
}

interface NormalizedSearchRecord {
  id: string;
  title: string;
  fields: string[];
  relatedFields: string[];
  phoneFields?: string[];
}

const normalizedSearchRecords = new WeakMap<GlobalSearchResult, NormalizedSearchRecord>();

function getNormalizedSearchRecord(item: GlobalSearchResult): NormalizedSearchRecord {
  const cached = normalizedSearchRecords.get(item);
  if (cached) return cached;
  const normalized: NormalizedSearchRecord = {
    id: normalizeSearchText(item.id),
    title: normalizeSearchText(item.title),
    fields: item.fields.map(normalizeSearchText),
    relatedFields: [item.subtitle, item.detail].map(normalizeSearchText),
  };
  normalizedSearchRecords.set(item, normalized);
  return normalized;
}

function scoreNormalizedSearchRecord(
  query: string,
  normalizedQuery: string,
  queryDigits: string,
  searchPhoneDigits: boolean,
  item: GlobalSearchResult,
): number {
  const record = getNormalizedSearchRecord(item);
  if (record.id && record.id === normalizedQuery) return 1000;
  if (record.title && record.title === normalizedQuery) return 900;
  if (record.id.startsWith(normalizedQuery)) return 800;
  if (record.title.startsWith(normalizedQuery)) return 700;
  if (record.fields.some(field => field.includes(normalizedQuery))) return 600;
  if (searchPhoneDigits) {
    record.phoneFields ??= item.fields.map(normalizePhoneDigits);
    if (record.phoneFields.some(field => field.length >= 3 && field.includes(queryDigits))) return 600;
  }
  if (record.relatedFields.some(field => field.includes(normalizedQuery))) return 450;
  return 0;
}

export function searchRecords(index: GlobalSearchResult[], query: string): GlobalSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const queryDigits = normalizePhoneDigits(query);
  const searchPhoneDigits = query.replace(/\D/g, '').length >= 3;
  return index.flatMap(item => {
    const score = scoreNormalizedSearchRecord(query, normalizedQuery, queryDigits, searchPhoneDigits, item);
    return score > 0 ? [{ ...item, score }] : [];
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function getRecentSearchItems(businessId?: string): RecentSearchItem[] {
  try {
    const raw = window.localStorage.getItem(recentStorageKey(businessId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RecentSearchItem =>
      typeof item === 'object' && item !== null &&
      ['customers', 'services', 'plans', 'accounts', 'profiles', 'subscriptions', 'sales', 'payments', 'invoices', 'history', 'reminders'].includes((item as RecentSearchItem).entity) &&
      typeof (item as RecentSearchItem).id === 'string' &&
      typeof (item as RecentSearchItem).viewedAt === 'string'
    ).slice(0, 20);
  } catch (error) {
    console.error('Could not load recently viewed search items.', error);
    return [];
  }
}

export function recordRecentSearchItem(
  result: Pick<GlobalSearchResult, 'entity' | 'id' | 'parentId'>,
  businessId?: string
): void {
  try {
    const next: RecentSearchItem[] = [
      { ...result, viewedAt: new Date().toISOString() },
      ...getRecentSearchItems(businessId).filter(item => item.entity !== result.entity || item.id !== result.id),
    ].slice(0, 20);
    window.localStorage.setItem(recentStorageKey(businessId), JSON.stringify(next));
  } catch (error) {
    console.error('Could not save recently viewed search item.', error);
  }
}

export function resolveRecentSearchItems(index: GlobalSearchResult[], recents: RecentSearchItem[]): GlobalSearchResult[] {
  const byKey = new Map(index.map(item => [`${item.entity}:${item.id}`, item]));
  return recents.flatMap(recent => {
    const item = byKey.get(`${recent.entity}:${recent.id}`);
    return item ? [item] : [];
  });
}

export const SEARCH_ENTITY_LABELS: Record<SearchEntity, string> = {
  customers: 'Customers', services: 'Services', plans: 'Plans', accounts: 'Accounts',
  profiles: 'Profiles', subscriptions: 'Subscriptions', sales: 'Sales',
  payments: 'Payments', invoices: 'Invoices', history: 'History',
  reminders: 'Reminders',
};

export const SEARCH_ENTITY_ORDER: SearchEntity[] = [
  'customers', 'services', 'plans', 'accounts', 'profiles',
  'subscriptions', 'sales', 'payments', 'invoices', 'history', 'reminders',
];
