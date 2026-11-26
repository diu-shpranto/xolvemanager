/**
 * Local (localStorage) → Supabase row mapping.
 *
 * Every cloud row keeps the local record's identity in `local_id` and the
 * full original record in `data` (jsonb), plus scalar columns for the fields
 * the app filters on. The cloud `id` is a fresh uuid — local ids are
 * arbitrary strings (e.g. "customer-1", invoice numbers), so upserts use the
 * (user_id, local_id) unique key, never the local id itself.
 *
 * All mappers are pure functions (no network, no window) except
 * collectLocalSnapshot, which reads the localStorage store and therefore
 * returns an empty snapshot outside the browser.
 */
import type {
  Account,
  ActivityLog,
  AppSettings,
  BusinessNotification,
  Customer,
  DailyClosing,
  Expense,
  FinancialAccount,
  FinancialAdjustment,
  FinancialPeriod,
  FinancialReconciliation,
  FinancialTransfer,
  Invoice,
  OrderQuotation,
  OtherIncome,
  Payment,
  ProfitabilityCost,
  Reminder,
  Sale,
  Service,
  Subscription,
} from '../../types';
import {
  STORAGE_KEYS,
  getAccounts,
  getCustomers,
  getDailyClosings,
  getExpenses,
  getFinancialAccounts,
  getFinancialAdjustments,
  getFinancialPeriods,
  getFinancialReconciliations,
  getFinancialTransfers,
  getHistory,
  getInvoices,
  getNotifications,
  getOrders,
  getOtherIncome,
  getPayments,
  getProfitabilityCosts,
  getReminders,
  getSales,
  getServices,
  getSettings,
  getSubscriptions,
  readRawValue,
} from '../localStorageStore';

export interface CloudRow {
  id: string;
  user_id: string;
  local_id: string;
  business_id: string | null;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export const newCloudId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const baseRow = (userId: string, localId: string, record: unknown): CloudRow => ({
  id: newCloudId(),
  user_id: userId,
  local_id: localId,
  business_id:
    typeof record === 'object' && record !== null && typeof (record as { businessId?: unknown }).businessId === 'string'
      ? (record as { businessId: string }).businessId
      : null,
  data: (record ?? {}) as Record<string, unknown>,
});

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const numOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const mapCustomer = (userId: string, record: Customer): CloudRow => ({
  ...baseRow(userId, record.id, record),
  name: record.name,
  phone: record.phone,
  email: record.email,
  status: record.status ?? (record.isArchived ? 'archived' : 'active'),
  is_archived: Boolean(record.isArchived),
});

export const mapService = (userId: string, record: Service): CloudRow => ({
  ...baseRow(userId, record.id, record),
  name: record.name,
  category: record.category,
  status: record.status,
  default_duration_days: record.defaultDurationDays,
  currency: record.currency ?? null,
  plan_details: record.planDetails ?? [],
});

export const mapAccount = (userId: string, record: Account): CloudRow => ({
  ...baseRow(userId, record.id, record),
  service_id: record.serviceId,
  email: record.email,
  plan: record.plan,
  status: record.status,
  profiles: record.profiles ?? [],
});

export const mapFinancialAccount = (userId: string, record: FinancialAccount): CloudRow => ({
  ...baseRow(userId, record.id, record),
  name: record.name,
  type: record.type,
  currency: record.currency,
  opening_balance: record.openingBalance,
  enabled: record.enabled,
});

export const mapSubscription = (userId: string, record: Subscription): CloudRow => ({
  ...baseRow(userId, record.id, record),
  customer_id: record.customerId,
  service_id: record.serviceId,
  plan: record.plan,
  start_date: record.startDate,
  expiry_date: record.expiryDate,
  price: record.price,
  currency: record.currency,
  payment_status: record.paymentStatus,
  status: record.status ?? null,
  renewal_history: record.renewalHistory ?? [],
});

export const mapSale = (userId: string, record: Sale): CloudRow => ({
  ...baseRow(userId, record.id, record),
  customer_id: record.customerId,
  service_id: record.serviceId,
  plan: record.plan,
  amount: record.amount,
  currency: record.currency,
  payment_status: record.paymentStatus,
  date: record.date,
  invoice_no: record.invoiceNo,
  line_items: record.lineItems ?? [],
});

export const mapInvoice = (userId: string, record: Invoice): CloudRow => ({
  ...baseRow(userId, record.invoiceId, record),
  customer_id: record.customerId,
  sale_id: record.saleId,
  total_amount: record.totalAmount,
  paid_amount: record.paidAmount,
  due_amount: record.dueAmount,
  payment_status: record.paymentStatus,
  invoice_date: record.invoiceDate,
});

export const mapPayment = (userId: string, record: Payment): CloudRow => ({
  ...baseRow(userId, record.id, record),
  customer_id: record.customerId,
  amount: record.amount,
  currency: record.currency,
  payment_method: record.paymentMethod,
  payment_date: record.paymentDate,
  payment_status: record.paymentStatus,
  allocations: record.allocations ?? [],
});

export const mapExpense = (userId: string, record: Expense): CloudRow => ({
  ...baseRow(userId, record.id, record),
  account_id: record.accountId,
  category_id: record.categoryId,
  amount: record.amount,
  currency: record.currency,
  date: record.date,
  status: record.status,
});

export const mapOtherIncome = (userId: string, record: OtherIncome): CloudRow => ({
  ...baseRow(userId, record.id, record),
  account_id: record.accountId,
  category_id: record.categoryId,
  amount: record.amount,
  currency: record.currency,
  date: record.date,
  status: record.status,
});

export const mapFinancialTransfer = (userId: string, record: FinancialTransfer): CloudRow => ({
  ...baseRow(userId, record.id, record),
  from_account_id: record.fromAccountId,
  to_account_id: record.toAccountId,
  amount: record.amount,
  currency: record.currency,
  date: record.date,
  status: record.status,
});

export const mapFinancialAdjustment = (userId: string, record: FinancialAdjustment): CloudRow => ({
  ...baseRow(userId, record.id, record),
  account_id: record.accountId,
  amount: record.amount,
  currency: record.currency,
  date: record.date,
  reason: record.reason,
});

export const mapDailyClosing = (userId: string, record: DailyClosing): CloudRow => ({
  ...baseRow(userId, record.id, record),
  date: record.date,
  currency: record.currency,
  status: record.status,
  expected_closing_balance: record.expectedClosingBalance,
  actual_closing_balance: record.actualClosingBalance,
  accounts: record.accounts ?? [],
});

export const mapFinancialReconciliation = (userId: string, record: FinancialReconciliation): CloudRow => ({
  ...baseRow(userId, record.id, record),
  account_id: record.accountId,
  reconciliation_date: record.reconciliationDate,
  system_balance: record.systemBalance,
  actual_balance: record.actualBalance,
  difference: record.difference,
  status: record.status,
});

export const mapFinancialPeriod = (userId: string, record: FinancialPeriod): CloudRow => ({
  ...baseRow(userId, record.id, record),
  start_date: record.startDate,
  end_date: record.endDate,
  status: record.status,
});

export const mapReminder = (userId: string, record: Reminder): CloudRow => ({
  ...baseRow(userId, record.id, record),
  type: record.type,
  status: record.status,
  priority: record.priority,
  due_date: record.dueDate,
  title: record.title,
});

export const mapProfitabilityCost = (userId: string, record: ProfitabilityCost): CloudRow => ({
  ...baseRow(userId, record.id, record),
  cost_type: record.costType,
  status: record.status,
  category: record.category,
  amount: record.amount,
  currency: record.currency,
  date: record.date,
});

export const mapActivityLog = (userId: string, record: ActivityLog): CloudRow => ({
  ...baseRow(userId, record.id, record),
  type: record.type,
  title: record.title,
  timestamp: record.timestamp,
});

export const mapNotification = (userId: string, record: BusinessNotification): CloudRow => ({
  ...baseRow(userId, record.id, record),
  type: record.type,
  category: record.category,
  priority: record.priority,
  section: record.section,
  read: record.read,
});

export const mapOrder = (userId: string, record: OrderQuotation): CloudRow => ({
  ...baseRow(userId, record.id, record),
  reference: record.reference,
  customer_id: record.customerId,
  status: record.status,
  currency: record.currency,
  total: record.total,
});

export const mapBusinessProfile = (
  userId: string,
  settings: Partial<AppSettings> | null,
  business: Record<string, unknown> | null
): CloudRow | null => {
  if (!settings && !business) return null;
  const merged = { ...(business ?? {}), ...(settings ?? {}) } as Record<string, unknown>;
  return {
    ...baseRow(userId, 'business-profile', merged),
    store_name: textOrNull(merged.storeName),
    tagline: textOrNull(merged.tagline),
    currency: textOrNull(merged.currency),
    language: textOrNull(merged.language),
    admin_email: textOrNull(merged.adminEmail),
    admin_name: textOrNull(merged.adminName),
    contact_phone: textOrNull(merged.contactPhone),
    whatsapp_number: textOrNull(merged.whatsappNumber),
    facebook_page_url: textOrNull(merged.facebookPageUrl),
    reminder_notice_days: numOrNull(merged.reminderNoticeDays),
    settings: (settings ?? {}) as Record<string, unknown>,
  };
};

export interface LocalSnapshot {
  business: Record<string, unknown> | null;
  settings: Partial<AppSettings> | null;
  customers: Customer[];
  services: Service[];
  accounts: Account[];
  financialAccounts: FinancialAccount[];
  subscriptions: Subscription[];
  sales: Sale[];
  orders: OrderQuotation[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  otherIncome: OtherIncome[];
  financialTransfers: FinancialTransfer[];
  financialAdjustments: FinancialAdjustment[];
  dailyClosings: DailyClosing[];
  financialReconciliations: FinancialReconciliation[];
  financialPeriods: FinancialPeriod[];
  reminders: Reminder[];
  profitabilityCosts: ProfitabilityCost[];
  activityLogs: ActivityLog[];
  notifications: BusinessNotification[];
}

export const emptySnapshot = (): LocalSnapshot => ({
  business: null,
  settings: null,
  customers: [],
  services: [],
  accounts: [],
  financialAccounts: [],
  subscriptions: [],
  sales: [],
  orders: [],
  invoices: [],
  payments: [],
  expenses: [],
  otherIncome: [],
  financialTransfers: [],
  financialAdjustments: [],
  dailyClosings: [],
  financialReconciliations: [],
  financialPeriods: [],
  reminders: [],
  profitabilityCosts: [],
  activityLogs: [],
  notifications: [],
});

const readBusinessRecord = (): Record<string, unknown> | null => {
  const raw = readRawValue(STORAGE_KEYS.BUSINESS);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * Reads every local collection (production environment only — demo data is
 * never uploaded). Returns an empty snapshot outside the browser.
 */
export const collectLocalSnapshot = (): LocalSnapshot => {
  if (typeof window === 'undefined') return emptySnapshot();
  return {
    business: readBusinessRecord(),
    settings: getSettings(),
    customers: getCustomers(),
    services: getServices(),
    accounts: getAccounts(),
    financialAccounts: getFinancialAccounts(),
    subscriptions: getSubscriptions(),
    sales: getSales(),
    orders: getOrders(),
    invoices: getInvoices(),
    payments: getPayments(),
    expenses: getExpenses(),
    otherIncome: getOtherIncome(),
    financialTransfers: getFinancialTransfers(),
    financialAdjustments: getFinancialAdjustments(),
    dailyClosings: getDailyClosings(),
    financialReconciliations: getFinancialReconciliations(),
    financialPeriods: getFinancialPeriods(),
    reminders: getReminders(),
    profitabilityCosts: getProfitabilityCosts(),
    activityLogs: getHistory(),
    notifications: getNotifications(),
  };
};

export const countSnapshotRecords = (snapshot: LocalSnapshot): number =>
  snapshot.customers.length
  + snapshot.services.length
  + snapshot.accounts.length
  + snapshot.financialAccounts.length
  + snapshot.subscriptions.length
  + snapshot.sales.length
  + snapshot.orders.length
  + snapshot.invoices.length
  + snapshot.payments.length
  + snapshot.expenses.length
  + snapshot.otherIncome.length
  + snapshot.financialTransfers.length
  + snapshot.financialAdjustments.length
  + snapshot.dailyClosings.length
  + snapshot.financialReconciliations.length
  + snapshot.financialPeriods.length
  + snapshot.reminders.length
  + snapshot.profitabilityCosts.length
  + snapshot.activityLogs.length
  + snapshot.notifications.length
  + (snapshot.settings || snapshot.business ? 1 : 0);

/** Table name → mapper, in upload order (parents before children). */
export const CLOUD_TABLES = [
  'business_profiles',
  'customers',
  'services',
  'accounts',
  'financial_accounts',
  'subscriptions',
  'sales',
  'orders',
  'invoices',
  'payments',
  'expenses',
  'other_income',
  'financial_transfers',
  'financial_adjustments',
  'daily_closings',
  'financial_reconciliations',
  'financial_periods',
  'reminders',
  'profitability_costs',
  'activity_logs',
  'notifications',
] as const;

export type CloudTableName = (typeof CLOUD_TABLES)[number];

export const snapshotRowsForTable = (
  table: CloudTableName,
  userId: string,
  snapshot: LocalSnapshot
): CloudRow[] => {
  switch (table) {
    case 'business_profiles': {
      const row = mapBusinessProfile(userId, snapshot.settings, snapshot.business);
      return row ? [row] : [];
    }
    case 'customers': return snapshot.customers.map(record => mapCustomer(userId, record));
    case 'services': return snapshot.services.map(record => mapService(userId, record));
    case 'accounts': return snapshot.accounts.map(record => mapAccount(userId, record));
    case 'financial_accounts': return snapshot.financialAccounts.map(record => mapFinancialAccount(userId, record));
    case 'subscriptions': return snapshot.subscriptions.map(record => mapSubscription(userId, record));
    case 'sales': return snapshot.sales.map(record => mapSale(userId, record));
    case 'orders': return snapshot.orders.map(record => mapOrder(userId, record));
    case 'invoices': return snapshot.invoices.map(record => mapInvoice(userId, record));
    case 'payments': return snapshot.payments.map(record => mapPayment(userId, record));
    case 'expenses': return snapshot.expenses.map(record => mapExpense(userId, record));
    case 'other_income': return snapshot.otherIncome.map(record => mapOtherIncome(userId, record));
    case 'financial_transfers': return snapshot.financialTransfers.map(record => mapFinancialTransfer(userId, record));
    case 'financial_adjustments': return snapshot.financialAdjustments.map(record => mapFinancialAdjustment(userId, record));
    case 'daily_closings': return snapshot.dailyClosings.map(record => mapDailyClosing(userId, record));
    case 'financial_reconciliations': return snapshot.financialReconciliations.map(record => mapFinancialReconciliation(userId, record));
    case 'financial_periods': return snapshot.financialPeriods.map(record => mapFinancialPeriod(userId, record));
    case 'reminders': return snapshot.reminders.map(record => mapReminder(userId, record));
    case 'profitability_costs': return snapshot.profitabilityCosts.map(record => mapProfitabilityCost(userId, record));
    case 'activity_logs': return snapshot.activityLogs.map(record => mapActivityLog(userId, record));
    case 'notifications': return snapshot.notifications.map(record => mapNotification(userId, record));
    default: return [];
  }
};
