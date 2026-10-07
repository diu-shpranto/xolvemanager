import type {
  Account,
  ActivityLog,
  AppSettings,
  BusinessNotification,
  Invoice,
  Customer,
  FinancialAccount,
  Expense,
  OtherIncome,
  FinancialTransfer,
  FinancialAdjustment,
  FinancialPeriod,
  FinancialReconciliation,
  DailyClosing,
  Payment,
  ProfitabilityCost,
  Reminder,
  Sale,
  Service,
  Subscription,
} from '../types';

export const STORAGE_KEYS = {
  BUSINESS: 'app_business',
  CUSTOMERS: 'sqp_customers_v2',
  SERVICES: 'sqp_services_v2',
  ACCOUNTS: 'sqp_accounts_v2',
  SUBSCRIPTIONS: 'sqp_subscriptions_v2',
  SALES: 'sqp_sales_v2',
  INVOICES: 'sqp_invoices_v1',
  PAYMENTS: 'sqp_payments_v2',
  LOGS: 'sqp_logs_v2',
  SETTINGS: 'sqp_settings_v2',
  THEME: 'sqp_theme_v2',
  LANG: 'sqp_lang_v2',
  CURRENCY: 'sqp_curr_v2',
  NOTIFICATIONS_READ: 'sqp_notifications_read_v1',
  NOTIFICATIONS: 'sqp_notifications_v2',
  FINANCIAL_ACCOUNTS: 'sqp_financial_accounts_v1',
  EXPENSES: 'sqp_expenses_v1',
  OTHER_INCOME: 'sqp_other_income_v1',
  FINANCIAL_TRANSFERS: 'sqp_financial_transfers_v1',
  FINANCIAL_ADJUSTMENTS: 'sqp_financial_adjustments_v1',
  DAILY_CLOSINGS: 'sqp_daily_closings_v1',
  FINANCIAL_RECONCILIATIONS: 'sqp_financial_reconciliations_v1',
  FINANCIAL_PERIODS: 'sqp_financial_periods_v1',
  REMINDERS: 'sqp_reminders_v1',
  PROFITABILITY_COSTS: 'sqp_profitability_costs_v1',
} as const;

const storageWarnings = new Map<string, string>();

export const getStorageWarnings = (): string[] => [...storageWarnings.values()];

const setStorageWarning = (key: string, message: string): void => {
  storageWarnings.set(key, message);
};

const getStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (error) {
    setStorageWarning('storage', 'Browser storage is unavailable. Changes may not be saved.');
    console.error('Browser storage is unavailable.', error);
    return null;
  }
};

const preserveCorruptValue = (key: string, value: string): void => {
  setStorageWarning(
    `corrupt:${key}`,
    'Some saved data was invalid. A recovery copy was kept and usable records were loaded.'
  );
  const storage = getStorage();
  if (!storage) return;

  try {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    const backupKey = `${key}.corrupt.${(hash >>> 0).toString(16)}`;
    if (storage.getItem(backupKey) !== value) {
      storage.setItem(backupKey, value);
      console.error(`Invalid saved data for "${key}" was preserved as "${backupKey}".`);
    }
  } catch (error) {
    console.error(`Could not preserve invalid saved data for "${key}".`, error);
  }
};

export const readRawValue = (key: string): string | null => {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch (error) {
    setStorageWarning(`read:${key}`, 'Some saved data could not be read from this browser.');
    console.error(`Could not read saved data for "${key}".`, error);
    return null;
  }
};

export const writeRawValue = (key: string, value: string): void => {
  const storage = getStorage();
  if (!storage) {
    setStorageWarning(`write:${key}`, 'Some changes could not be saved in this browser.');
    throw new Error('Browser storage is unavailable.');
  }

  try {
    storage.setItem(key, value);
  } catch (error) {
    setStorageWarning(`write:${key}`, 'Some changes could not be saved in this browser.');
    console.error(`Could not save data for "${key}".`, error);
    throw new Error('Could not save your changes in this browser.');
  }
  storageWarnings.delete(`write:${key}`);
};

export const replaceRawValuesAtomically = (values: Record<string, string | null>): void => {
  const storage = getStorage();
  if (!storage) throw new Error('Browser storage is unavailable.');
  const previous = new Map<string, string | null>();
  try {
    Object.keys(values).forEach(key => previous.set(key, storage.getItem(key)));
    Object.entries(values).forEach(([key, value]) => {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    });
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    previous.forEach((value, key) => {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    });
    console.error('Replacing local data failed; rollback was attempted.', error, rollbackErrors);
    if (rollbackErrors.length) {
      throw new Error('Restore failed and browser storage could not fully roll back. Keep the safety backup and reload the application.');
    }
    throw new Error('Restore failed. Previous browser data was restored.');
  }
  Object.keys(values).forEach(key => storageWarnings.delete(`write:${key}`));
}

export const removeStoredValue = (key: string): void => {
  try {
    getStorage()?.removeItem(key);
  } catch (error) {
    setStorageWarning(`remove:${key}`, 'Some saved data could not be cleared from this browser.');
    console.error(`Could not remove saved data for "${key}".`, error);
    throw new Error('Could not clear saved data from this browser.');
  }
};

export const readJsonValue = <T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T
): T => {
  const rawValue = readRawValue(key);
  if (rawValue === null) return fallback;

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (isValid(parsed)) return parsed;
    preserveCorruptValue(key, rawValue);
  } catch (error) {
    console.error(`Invalid JSON was found for "${key}".`, error);
    preserveCorruptValue(key, rawValue);
  }

  return fallback;
};

export const writeJsonValue = (key: string, value: unknown): void => {
  writeRawValue(key, JSON.stringify(value));
};

export const updateJsonValue = <T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
  update: (previous: T) => T
): T => {
  const nextValue = update(readJsonValue(key, fallback, isValid));
  writeJsonValue(key, nextValue);
  return nextValue;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isDateOnly = (value: unknown): value is string => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isCustomerCrmDataValid = (record: Record<string, unknown>): boolean => {
  if (record.tags !== undefined && (!Array.isArray(record.tags) || !record.tags.every(isString))) return false;
  if (record.duplicateOfCustomerId !== undefined && !isString(record.duplicateOfCustomerId)) return false;
  if (record.preferences !== undefined) {
    if (!isObjectRecord(record.preferences)) return false;
    const { contactMethod, contactAllowed, language } = record.preferences;
    if (contactMethod !== undefined && !['phone', 'whatsapp', 'email', 'other'].includes(String(contactMethod))) return false;
    if (contactAllowed !== undefined && typeof contactAllowed !== 'boolean') return false;
    if (language !== undefined && !['en', 'bn'].includes(String(language))) return false;
  }
  if (record.notesHistory !== undefined) {
    if (!Array.isArray(record.notesHistory)) return false;
    if (!record.notesHistory.every(note =>
      isObjectRecord(note)
      && isString(note.id)
      && isString(record.id)
      && note.customerId === record.id
      && isString(note.text)
      && isString(note.createdAt)
      && isString(note.updatedAt)
    )) return false;
  }
  return true;
};

const collectionValidators: Record<string, (record: Record<string, unknown>) => boolean> = {
  [STORAGE_KEYS.CUSTOMERS]: record =>
    isString(record.name)
    && isString(record.phone)
    && isString(record.email)
    && isCustomerCrmDataValid(record),
  [STORAGE_KEYS.SERVICES]: record =>
    isString(record.name) &&
    isString(record.category) &&
    isNumber(record.defaultDurationDays) &&
    Array.isArray(record.plans),
  [STORAGE_KEYS.ACCOUNTS]: record =>
    isString(record.serviceId) &&
    isString(record.email) &&
    isString(record.password) &&
    isString(record.plan) &&
    Array.isArray(record.profiles),
  [STORAGE_KEYS.SUBSCRIPTIONS]: record =>
    isString(record.customerId) &&
    isString(record.serviceId) &&
    isString(record.plan) &&
    isString(record.startDate) &&
    isString(record.expiryDate) &&
    isNumber(record.durationDays) &&
    isNumber(record.price),
  [STORAGE_KEYS.SALES]: record =>
    isString(record.customerId) &&
    isString(record.serviceId) &&
    isString(record.plan) &&
    isString(record.date) &&
    isString(record.invoiceNo) &&
    isNumber(record.amount),
  [STORAGE_KEYS.INVOICES]: record =>
    isString(record.invoiceId) &&
    isString(record.invoiceNumber) &&
    isString(record.saleId) &&
    isString(record.customerId) &&
    isString(record.serviceId) &&
    isNumber(record.totalAmount) &&
    isNumber(record.paidAmount) &&
    isNumber(record.dueAmount) &&
    isString(record.paymentStatus) &&
    isString(record.paymentMethod) &&
    isString(record.invoiceDate) &&
    isString(record.createdAt) &&
    isString(record.updatedAt),
  [STORAGE_KEYS.PAYMENTS]: record =>
    isString(record.customerId) &&
    isString(record.paymentDate) &&
    isNumber(record.amount),
  [STORAGE_KEYS.LOGS]: record =>
    isString(record.type) &&
    isString(record.title) &&
    isString(record.description) &&
    isString(record.timestamp),
  [STORAGE_KEYS.DAILY_CLOSINGS]: record =>
    isString(record.id) &&
    isString(record.businessId) &&
    isString(record.date) &&
    isString(record.status) &&
    Array.isArray(record.accounts) &&
    isNumber(record.expectedClosingBalance) &&
    isNumber(record.actualClosingBalance),
  [STORAGE_KEYS.FINANCIAL_RECONCILIATIONS]: record =>
    isString(record.id) && isString(record.businessId) && isString(record.accountId)
    && isDateOnly(record.reconciliationDate) && isNumber(record.systemBalance)
    && isNumber(record.actualBalance) && isNumber(record.difference)
    && ['matched', 'difference'].includes(String(record.status))
    && isString(record.createdAt),
  [STORAGE_KEYS.FINANCIAL_PERIODS]: record =>
    isString(record.id) && isString(record.businessId)
    && isDateOnly(record.startDate) && isDateOnly(record.endDate)
    && record.startDate <= record.endDate
    && ['open', 'closed'].includes(String(record.status))
    && isString(record.createdAt) && isString(record.updatedAt),
  [STORAGE_KEYS.REMINDERS]: record =>
    isString(record.id)
    && isString(record.deterministicKey)
    && ['renewal_upcoming', 'renewal_today', 'subscription_expired', 'payment_due', 'payment_overdue', 'invoice_due', 'invoice_overdue', 'partial_payment', 'unpaid_sale', 'customer_follow_up', 'daily_closing'].includes(String(record.type))
    && ['open', 'completed', 'snoozed', 'dismissed'].includes(String(record.status))
    && ['low', 'medium', 'high', 'critical'].includes(String(record.priority))
    && isString(record.title)
    && ['customer', 'subscription', 'sale', 'payment', 'invoice', 'daily_closing', 'other'].includes(String(record.sourceEntityType))
    && isString(record.sourceEntityId)
    && isDateOnly(record.dueDate)
    && isString(record.createdAt)
    && isString(record.updatedAt)
    && (record.amount === undefined || isNumber(record.amount))
    && (record.businessId === undefined || isString(record.businessId))
    && (record.systemGenerated === undefined || typeof record.systemGenerated === 'boolean'),
  [STORAGE_KEYS.PROFITABILITY_COSTS]: record =>
    isString(record.id)
    && ['direct', 'shared', 'operating', 'adjustment'].includes(String(record.costType))
    && ['active', 'voided'].includes(String(record.status))
    && isString(record.category)
    && isNumber(record.amount)
    && isString(record.currency)
    && isDateOnly(record.date)
    && ['none', 'equal', 'revenue', 'sales', 'subscriptions', 'manual'].includes(String(record.allocationMethod))
    && isString(record.description)
    && isString(record.createdAt)
    && isString(record.updatedAt)
    && (record.manualAllocations === undefined || (Array.isArray(record.manualAllocations)
      && record.manualAllocations.every(allocation => isObjectRecord(allocation)
        && isString(allocation.serviceId) && isNumber(allocation.percentage))))
};

const readCollection = <T>(key: string): T[] => {
  const rawValue = readRawValue(key);
  if (rawValue === null) return [];

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      preserveCorruptValue(key, rawValue);
      return [];
    }

    const validate = collectionValidators[key] || (() => true);
    const validRecords = parsed.filter(
      (record): record is Record<string, unknown> => isObjectRecord(record) && validate(record)
    ) as T[];
    if (validRecords.length !== parsed.length) {
      preserveCorruptValue(key, rawValue);
      console.error(`Invalid records in "${key}" were excluded from the loaded collection.`);
    }
    return validRecords;
  } catch (error) {
    console.error(`Invalid JSON was found for "${key}".`, error);
    preserveCorruptValue(key, rawValue);
    return [];
  }
};

const saveCollection = <T>(key: string, records: T[]): void => writeJsonValue(key, records);

export const getCustomers = (): Customer[] => readCollection<Customer>(STORAGE_KEYS.CUSTOMERS);
export const saveCustomers = (records: Customer[]): void => saveCollection(STORAGE_KEYS.CUSTOMERS, records);
export const getServices = (): Service[] => readCollection<Service>(STORAGE_KEYS.SERVICES);
export const saveServices = (records: Service[]): void => saveCollection(STORAGE_KEYS.SERVICES, records);
export const getAccounts = (): Account[] => readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
export const saveAccounts = (records: Account[]): void => saveCollection(STORAGE_KEYS.ACCOUNTS, records);
export const getSubscriptions = (): Subscription[] => readCollection<Subscription>(STORAGE_KEYS.SUBSCRIPTIONS);
export const saveSubscriptions = (records: Subscription[]): void => saveCollection(STORAGE_KEYS.SUBSCRIPTIONS, records);
export const getSales = (): Sale[] => readCollection<Sale>(STORAGE_KEYS.SALES);
export const saveSales = (records: Sale[]): void => saveCollection(STORAGE_KEYS.SALES, records);
export const getInvoices = (): Invoice[] => readCollection<Invoice>(STORAGE_KEYS.INVOICES);
export const saveInvoices = (records: Invoice[]): void => saveCollection(STORAGE_KEYS.INVOICES, records);
export const getPayments = (): Payment[] => readCollection<Payment>(STORAGE_KEYS.PAYMENTS);
export const savePayments = (records: Payment[]): void => saveCollection(STORAGE_KEYS.PAYMENTS, records);
export const getHistory = (): ActivityLog[] => readCollection<ActivityLog>(STORAGE_KEYS.LOGS);
export const saveHistory = (records: ActivityLog[]): void => saveCollection(STORAGE_KEYS.LOGS, records);
export const getFinancialAccounts = (): FinancialAccount[] => readCollection<FinancialAccount>(STORAGE_KEYS.FINANCIAL_ACCOUNTS);
export const saveFinancialAccounts = (records: FinancialAccount[]): void => saveCollection(STORAGE_KEYS.FINANCIAL_ACCOUNTS, records);
export const getExpenses = (): Expense[] => readCollection<Expense>(STORAGE_KEYS.EXPENSES);
export const saveExpenses = (records: Expense[]): void => saveCollection(STORAGE_KEYS.EXPENSES, records);
export const getOtherIncome = (): OtherIncome[] => readCollection<OtherIncome>(STORAGE_KEYS.OTHER_INCOME);
export const saveOtherIncome = (records: OtherIncome[]): void => saveCollection(STORAGE_KEYS.OTHER_INCOME, records);
export const getFinancialTransfers = (): FinancialTransfer[] => readCollection<FinancialTransfer>(STORAGE_KEYS.FINANCIAL_TRANSFERS);
export const saveFinancialTransfers = (records: FinancialTransfer[]): void => saveCollection(STORAGE_KEYS.FINANCIAL_TRANSFERS, records);
export const getFinancialAdjustments = (): FinancialAdjustment[] => readCollection<FinancialAdjustment>(STORAGE_KEYS.FINANCIAL_ADJUSTMENTS);
export const saveFinancialAdjustments = (records: FinancialAdjustment[]): void => saveCollection(STORAGE_KEYS.FINANCIAL_ADJUSTMENTS, records);
export const getDailyClosings = (): DailyClosing[] => readCollection<DailyClosing>(STORAGE_KEYS.DAILY_CLOSINGS);
export const saveDailyClosings = (records: DailyClosing[]): void => saveCollection(STORAGE_KEYS.DAILY_CLOSINGS, records);
export const getFinancialReconciliations = (): FinancialReconciliation[] => readCollection<FinancialReconciliation>(STORAGE_KEYS.FINANCIAL_RECONCILIATIONS);
export const saveFinancialReconciliations = (records: FinancialReconciliation[]): void => saveCollection(STORAGE_KEYS.FINANCIAL_RECONCILIATIONS, records);
export const getFinancialPeriods = (): FinancialPeriod[] => readCollection<FinancialPeriod>(STORAGE_KEYS.FINANCIAL_PERIODS);
export const saveFinancialPeriods = (records: FinancialPeriod[]): void => saveCollection(STORAGE_KEYS.FINANCIAL_PERIODS, records);
export const getReminders = (): Reminder[] => readCollection<Reminder>(STORAGE_KEYS.REMINDERS);
export const saveReminders = (records: Reminder[]): void => saveCollection(STORAGE_KEYS.REMINDERS, records);
export const getProfitabilityCosts = (): ProfitabilityCost[] => readCollection<ProfitabilityCost>(STORAGE_KEYS.PROFITABILITY_COSTS);
export const saveProfitabilityCosts = (records: ProfitabilityCost[]): void => saveCollection(STORAGE_KEYS.PROFITABILITY_COSTS, records);

export const getSettings = (): Partial<AppSettings> | null =>
  readJsonValue<Partial<AppSettings> | null>(
    STORAGE_KEYS.SETTINGS,
    null,
    (value): value is Partial<AppSettings> | null => value === null || isObjectRecord(value)
  );

export const saveSettings = (settings: Partial<AppSettings>): void =>
  writeJsonValue(STORAGE_KEYS.SETTINGS, settings);

export const isBusinessNotification = (value: unknown): value is BusinessNotification => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const notification = value as BusinessNotification;
  return typeof notification.id === 'string' && notification.id.length > 0 &&
    typeof notification.type === 'string' &&
    ['customer', 'subscription', 'payment', 'invoice', 'account', 'service', 'system'].includes(notification.category) &&
    ['info', 'success', 'warning', 'critical'].includes(notification.priority) &&
    typeof notification.title === 'string' &&
    typeof notification.message === 'string' &&
    ['dashboard', 'customers', 'services', 'accounts', 'profiles', 'subscriptions', 'sales', 'payments', 'invoices', 'history', 'reports', 'settings', 'notifications', 'cashbook'].includes(notification.section) &&
    typeof notification.read === 'boolean' &&
    typeof notification.createdAt === 'string' && Number.isFinite(Date.parse(notification.createdAt));
};

export const getNotifications = (): BusinessNotification[] =>
  readJsonValue<BusinessNotification[]>(
    STORAGE_KEYS.NOTIFICATIONS,
    [],
    (value): value is BusinessNotification[] =>
      Array.isArray(value) && value.every(isBusinessNotification)
  );

export const saveNotifications = (notifications: BusinessNotification[]): void =>
  writeJsonValue(STORAGE_KEYS.NOTIFICATIONS, notifications);

export const createRecordId = (prefix: string): string => {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
};
