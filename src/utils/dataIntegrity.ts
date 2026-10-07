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
  OtherIncome,
  Payment,
  ProfitabilityCost,
  Reminder,
  Sale,
  Service,
  Subscription,
} from '../types';
import { normalizePaymentMethods } from './paymentMethods';
import { getAccountBalance, getFinancialLedger, getTotalBusinessBalance } from './financialLedger';
import { runFinancialIntegrityCheck, type FinancialIntegrityIssue } from './accountingControls';

export type DataIntegritySeverity = 'ERROR' | 'WARNING' | 'INFO';
export type DataIntegrityCategory =
  | 'STRUCTURE' | 'IDS' | 'RELATIONSHIPS' | 'FINANCIAL_DATA' | 'DATES'
  | 'DUPLICATES' | 'BUSINESS_CONTEXT' | 'DERIVED_VALUES' | 'STORAGE'
  | 'MIGRATION_VERSION' | 'BACKUP_COMPATIBILITY' | 'AUDIT_HISTORY' | 'RESOURCES';

export interface DataIntegrityIssue {
  severity: DataIntegritySeverity;
  category: DataIntegrityCategory;
  entityType: string;
  entityId?: string;
  message: string;
  suggestedFix?: string;
  canAutoRepair: boolean;
}

export interface DataIntegrityAccountBalance {
  accountId: string;
  accountName: string;
  currency: FinancialAccount['currency'];
  calculatedBalance: number;
  businessTotalBalance: number;
}

export interface DataIntegritySummary {
  recordsChecked: number;
  errors: number;
  warnings: number;
  info: number;
  categoryCounts: Partial<Record<DataIntegrityCategory, number>>;
  accountBalances: DataIntegrityAccountBalance[];
  businessBalance: number;
}

export interface DataIntegrityResult {
  businessId?: string;
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  errors: DataIntegrityIssue[];
  warnings: DataIntegrityIssue[];
  info: DataIntegrityIssue[];
  summary: DataIntegritySummary;
  checkedAt: string;
}

let lastDataIntegrityResult: DataIntegrityResult | null = null;

export function getLastDataIntegrityResult(): DataIntegrityResult | null {
  return lastDataIntegrityResult;
}

export interface DataIntegrityRecords {
  businessId?: string;
  customers: Customer[];
  services: Service[];
  serviceAccounts: Account[];
  subscriptions: Subscription[];
  sales: Sale[];
  payments: Payment[];
  invoices: Invoice[];
  financialAccounts: FinancialAccount[];
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
  settings: AppSettings;
  storageWarnings?: string[];
}

interface Collection {
  entityType: string;
  category: DataIntegrityCategory;
  records: Array<{ id?: string; businessId?: string }>;
}

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const normalizedKey = (value?: string): string => value?.trim().toLocaleLowerCase() || '';
const isFiniteAmount = (value: number): boolean => Number.isFinite(value);

export function runDataIntegrityCheck(
  records: DataIntegrityRecords,
  options: { cacheResult?: boolean } = {},
): DataIntegrityResult {
  const issues: DataIntegrityIssue[] = [];
  const collections: Collection[] = [
    { entityType: 'customer', category: 'IDS', records: records.customers },
    { entityType: 'service', category: 'IDS', records: records.services },
    { entityType: 'account', category: 'IDS', records: records.serviceAccounts },
    { entityType: 'subscription', category: 'IDS', records: records.subscriptions },
    { entityType: 'sale', category: 'IDS', records: records.sales },
    { entityType: 'payment', category: 'IDS', records: records.payments },
    { entityType: 'invoice', category: 'IDS', records: records.invoices.map(item => ({ id: item.invoiceId, businessId: item.businessId })) },
    { entityType: 'financial_account', category: 'IDS', records: records.financialAccounts },
    { entityType: 'expense', category: 'IDS', records: records.expenses },
    { entityType: 'income', category: 'IDS', records: records.otherIncome },
    { entityType: 'transfer', category: 'IDS', records: records.financialTransfers },
    { entityType: 'adjustment', category: 'IDS', records: records.financialAdjustments },
    { entityType: 'daily_closing', category: 'IDS', records: records.dailyClosings },
    { entityType: 'reconciliation', category: 'IDS', records: records.financialReconciliations },
    { entityType: 'financial_period', category: 'IDS', records: records.financialPeriods },
    { entityType: 'reminder', category: 'IDS', records: records.reminders },
    { entityType: 'profitability_cost', category: 'IDS', records: records.profitabilityCosts },
    { entityType: 'activity', category: 'AUDIT_HISTORY', records: records.activityLogs },
    { entityType: 'notification', category: 'IDS', records: records.notifications },
  ];
  const addIssue = (
    severity: DataIntegritySeverity,
    category: DataIntegrityCategory,
    entityType: string,
    entityId: string | undefined,
    message: string,
    suggestedFix?: string,
  ) => issues.push({ severity, category, entityType, entityId, message, suggestedFix, canAutoRepair: false });
  const scoped = <T extends { businessId?: string }>(items: T[]): T[] =>
    records.businessId ? items.filter(item => !item.businessId || item.businessId === records.businessId) : items;

  let recordsChecked = 0;
  collections.forEach(collection => {
    const seen = new Set<string>();
    let legacyScopeCount = 0;
    collection.records.forEach((record, index) => {
      recordsChecked += 1;
      if (!record || typeof record !== 'object') {
        addIssue('ERROR', 'STRUCTURE', collection.entityType, undefined, `${collection.entityType} row ${index + 1} is not a valid record.`);
        return;
      }
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      if (!id) {
        addIssue('ERROR', 'IDS', collection.entityType, undefined, `${collection.entityType} is missing a stable ID.`);
      } else if (seen.has(id)) {
        addIssue('ERROR', 'IDS', collection.entityType, id, `Duplicate ${collection.entityType} ID "${id}" was found.`);
      } else {
        seen.add(id);
      }
      if (records.businessId && record.businessId && record.businessId !== records.businessId) {
        addIssue('ERROR', 'BUSINESS_CONTEXT', collection.entityType, id || undefined, 'Record belongs to a different business.', 'Review the business association before changing this record.');
      }
      if (records.businessId && !record.businessId) legacyScopeCount += 1;
    });
    if (legacyScopeCount) {
      addIssue('INFO', 'BUSINESS_CONTEXT', collection.entityType, undefined,
        `${legacyScopeCount} legacy ${collection.entityType} record${legacyScopeCount === 1 ? '' : 's'} have no business ID and remain readable.`);
    }
  });

  const customers = scoped(records.customers);
  const services = scoped(records.services);
  const serviceAccounts = scoped(records.serviceAccounts);
  const subscriptions = scoped(records.subscriptions);
  const sales = scoped(records.sales);
  const payments = scoped(records.payments);
  const invoices = scoped(records.invoices);
  const financialAccounts = scoped(records.financialAccounts);
  const expenses = scoped(records.expenses);
  const otherIncome = scoped(records.otherIncome);
  const financialTransfers = scoped(records.financialTransfers);
  const financialAdjustments = scoped(records.financialAdjustments);
  const dailyClosings = scoped(records.dailyClosings);
  const financialReconciliations = scoped(records.financialReconciliations);
  const financialPeriods = scoped(records.financialPeriods);
  const reminders = scoped(records.reminders);
  const profitabilityCosts = scoped(records.profitabilityCosts);
  const expensesById = new Map(expenses.map(item => [item.id, item]));
  const activityLogs = scoped(records.activityLogs);
  const notifications = scoped(records.notifications);
  const customersById = new Map(customers.map(item => [item.id, item]));
  const servicesById = new Map(services.map(item => [item.id, item]));
  const serviceAccountsById = new Map(serviceAccounts.map(item => [item.id, item]));
  const subscriptionsById = new Map(subscriptions.map(item => [item.id, item]));
  const salesById = new Map(sales.map(item => [item.id, item]));
  const paymentsById = new Map(payments.map(item => [item.id, item]));
  const invoicesById = new Map(invoices.map(item => [item.invoiceId, item]));
  const financialAccountIds = new Set(financialAccounts.map(item => item.id));
  const profileAccountById = new Map<string, string>();

  const reportDuplicate = (collection: string, field: string, value: string, entityId: string) =>
    addIssue('WARNING', 'DUPLICATES', collection, entityId, `Duplicate ${field} "${value}" was found.`, 'Review both records and preserve the correct business history.');
  const checkUniqueValues = <T extends { id: string }>(
    items: T[],
    keySelector: (item: T) => string,
    field: string,
    entityType: string,
  ) => {
    const firstByValue = new Map<string, string>();
    items.forEach(item => {
      const key = keySelector(item);
      if (!key) return;
      const existingId = firstByValue.get(key);
      if (existingId) reportDuplicate(entityType, field, key, item.id);
      else firstByValue.set(key, item.id);
    });
  };
  checkUniqueValues(customers, item => normalizedKey(item.phone), 'phone', 'customer');
  checkUniqueValues(customers, item => normalizedKey(item.email), 'email', 'customer');
  checkUniqueValues(invoices.map(item => ({ id: item.invoiceId, invoiceNumber: item.invoiceNumber })),
    item => normalizedKey(item.invoiceNumber), 'invoice number', 'invoice');
  checkUniqueValues(sales, item => normalizedKey(item.operationId), 'sale operation ID', 'sale');
  checkUniqueValues(financialTransfers, item => normalizedKey(item.reference), 'transfer reference', 'transfer');

  customers.forEach(customer => {
    if (!customer.name?.trim() || !customer.createdAt) {
      addIssue('ERROR', 'STRUCTURE', 'customer', customer.id, 'Customer name or creation date is missing.');
    }
    if (customer.duplicateOfCustomerId && !customersById.has(customer.duplicateOfCustomerId)) {
      addIssue('WARNING', 'RELATIONSHIPS', 'customer', customer.id, 'Customer duplicate marker references a missing customer.');
    }
  });
  const plansForService = (service: Service, planId?: string, planName?: string): boolean => {
    if (planId) return Boolean(service.planDetails?.some(plan => plan.id === planId) || service.planIds?.includes(planId));
    if (planName) return Boolean(service.plans.includes(planName) || service.planDetails?.some(plan => plan.name === planName));
    return false;
  };
  services.forEach(service => {
    const planIds = new Set<string>();
    service.planDetails?.forEach(plan => {
      if (!plan.id) return;
      if (planIds.has(plan.id)) addIssue('ERROR', 'IDS', 'plan', plan.id, `Plan ID is duplicated within service "${service.name}".`);
      planIds.add(plan.id);
      if (!isFiniteAmount(plan.price) || plan.price < 0) addIssue('ERROR', 'FINANCIAL_DATA', 'plan', plan.id, 'Plan price must be a finite, non-negative amount.');
    });
  });
  serviceAccounts.forEach(account => {
    const service = servicesById.get(account.serviceId);
    if (!service) addIssue('ERROR', 'RELATIONSHIPS', 'account', account.id, 'Service account refers to a missing service.');
    else if (account.planId && !plansForService(service, account.planId, account.plan)) {
      addIssue('WARNING', 'RELATIONSHIPS', 'account', account.id, 'Service account plan is not present in its linked service.');
    }
    if (!Number.isInteger(account.maxProfiles) || account.maxProfiles < 0) {
      addIssue('ERROR', 'RESOURCES', 'account', account.id, 'Account profile capacity must be a non-negative whole number.');
    }
    const profileIds = new Set<string>();
    let assignedProfiles = 0;
    (Array.isArray(account.profiles) ? account.profiles : []).forEach(profile => {
      if (!profile.id || profileIds.has(profile.id)) addIssue('ERROR', 'IDS', 'profile', profile.id, 'Profile ID is missing or duplicated within its account.');
      const previousAccountId = profileAccountById.get(profile.id);
      if (profile.id && previousAccountId && previousAccountId !== account.id) {
        addIssue('ERROR', 'IDS', 'profile', profile.id, `Profile ID is also used by account ${previousAccountId}.`);
      }
      if (profile.id) profileAccountById.set(profile.id, account.id);
      recordsChecked += 1;
      if (profile.accountId !== account.id) addIssue('ERROR', 'RELATIONSHIPS', 'profile', profile.id, 'Profile account relationship does not match its parent account.');
      if (profile.status === 'Assigned') assignedProfiles += 1;
      if (profile.assignedCustomerId && !customersById.has(profile.assignedCustomerId)) {
        addIssue('WARNING', 'RELATIONSHIPS', 'profile', profile.id, 'Profile is assigned to a customer that no longer exists.');
      }
      if (profile.subscriptionId && !subscriptionsById.has(profile.subscriptionId)) {
        addIssue('WARNING', 'RELATIONSHIPS', 'profile', profile.id, 'Profile references a missing subscription.');
      }
    });
    if (assignedProfiles > account.maxProfiles) addIssue('ERROR', 'RESOURCES', 'account', account.id, `Account has ${assignedProfiles} assigned profiles but its capacity is ${account.maxProfiles}.`);
  });

  subscriptions.forEach(subscription => {
    if (!customersById.has(subscription.customerId)) addIssue('ERROR', 'RELATIONSHIPS', 'subscription', subscription.id, 'Subscription refers to a missing customer.');
    const service = servicesById.get(subscription.serviceId);
    if (!service) addIssue('ERROR', 'RELATIONSHIPS', 'subscription', subscription.id, 'Subscription refers to a missing service.');
    else if (!plansForService(service, subscription.planId, subscription.plan)) {
      addIssue('WARNING', 'RELATIONSHIPS', 'subscription', subscription.id, 'Subscription plan is not present in its linked service.');
    }
    if (subscription.accountId && !serviceAccountsById.has(subscription.accountId)) {
      addIssue('ERROR', 'RELATIONSHIPS', 'subscription', subscription.id, 'Subscription refers to a missing service account.');
    }
    const profile = subscription.profileId && subscription.accountId
      ? serviceAccountsById.get(subscription.accountId)?.profiles.find(item => item.id === subscription.profileId)
      : undefined;
    if (subscription.profileId && !profile) addIssue('ERROR', 'RELATIONSHIPS', 'subscription', subscription.id, 'Subscription profile is missing from its linked service account.');
    if (subscription.startDate && subscription.expiryDate && subscription.expiryDate < subscription.startDate) {
      addIssue('ERROR', 'DATES', 'subscription', subscription.id, 'Subscription expiry date is before its start date.');
    }
    if (!isValidDateOnly(subscription.startDate) || !isValidDateOnly(subscription.expiryDate)) {
      addIssue('ERROR', 'DATES', 'subscription', subscription.id, 'Subscription start or expiry date is invalid.');
    }
  });
  sales.forEach(sale => {
    if (!customersById.has(sale.customerId)) addIssue('ERROR', 'RELATIONSHIPS', 'sale', sale.id, 'Sale refers to a missing customer.');
    const service = servicesById.get(sale.serviceId);
    if (!service) addIssue('ERROR', 'RELATIONSHIPS', 'sale', sale.id, 'Sale refers to a missing service.');
    else if (!plansForService(service, sale.planId, sale.plan)) addIssue('WARNING', 'RELATIONSHIPS', 'sale', sale.id, 'Sale plan is not present in its linked service.');
    if (!isValidDateOnly(sale.date)) addIssue('ERROR', 'DATES', 'sale', sale.id, 'Sale date is invalid.');
  });
  invoices.forEach(invoice => {
    const sale = salesById.get(invoice.saleId);
    if (!sale) addIssue('ERROR', 'RELATIONSHIPS', 'invoice', invoice.invoiceId, 'Invoice refers to a missing sale.');
    else if (invoice.customerId !== sale.customerId) addIssue('ERROR', 'RELATIONSHIPS', 'invoice', invoice.invoiceId, 'Invoice customer does not match its linked sale.');
    if (!isValidDateOnly(invoice.invoiceDate)) addIssue('ERROR', 'DATES', 'invoice', invoice.invoiceId, 'Invoice date is invalid.');
  });
  otherIncome.forEach(income => {
    if (!financialAccountIds.has(income.accountId)) addIssue('ERROR', 'RELATIONSHIPS', 'income', income.id, 'Other income refers to a missing financial account.');
    if (!isFiniteAmount(income.amount) || income.amount <= 0) addIssue('ERROR', 'FINANCIAL_DATA', 'income', income.id, 'Other income amount must be a finite positive amount.');
    if (!isValidDateOnly(income.date)) addIssue('ERROR', 'DATES', 'income', income.id, 'Other income date is invalid.');
  });
  reminders.forEach(reminder => {
    if (reminder.customerId && !customersById.has(reminder.customerId)) addIssue('WARNING', 'RELATIONSHIPS', 'reminder', reminder.id, 'Reminder refers to a missing customer.');
    if (reminder.serviceId && !servicesById.has(reminder.serviceId)) addIssue('WARNING', 'RELATIONSHIPS', 'reminder', reminder.id, 'Reminder refers to a missing service.');
    if (reminder.saleId && !salesById.has(reminder.saleId)) addIssue('WARNING', 'RELATIONSHIPS', 'reminder', reminder.id, 'Reminder refers to a missing sale.');
  });
  profitabilityCosts.forEach(cost => {
    if (cost.serviceId && !servicesById.has(cost.serviceId)) addIssue('WARNING', 'RELATIONSHIPS', 'profitability_cost', cost.id, 'Profitability cost refers to a missing service.');
    if (cost.saleId && !salesById.has(cost.saleId)) addIssue('WARNING', 'RELATIONSHIPS', 'profitability_cost', cost.id, 'Profitability cost refers to a missing sale.');
    if (cost.customerId && !customersById.has(cost.customerId)) addIssue('WARNING', 'RELATIONSHIPS', 'profitability_cost', cost.id, 'Profitability cost refers to a missing customer.');
    if (cost.subscriptionId && !subscriptionsById.has(cost.subscriptionId)) addIssue('WARNING', 'RELATIONSHIPS', 'profitability_cost', cost.id, 'Profitability cost refers to a missing subscription.');
    if (cost.expenseId && !expensesById.has(cost.expenseId)) addIssue('WARNING', 'RELATIONSHIPS', 'profitability_cost', cost.id, 'Profitability cost refers to a missing expense.');
  });
  activityLogs.forEach(activity => {
    if (!activity.title?.trim() || !activity.timestamp || !Number.isFinite(Date.parse(activity.timestamp))) {
      addIssue('WARNING', 'AUDIT_HISTORY', 'activity', activity.id, 'Activity history entry is missing a title or has an invalid timestamp.');
    }
    if (activity.customerId && !customersById.has(activity.customerId)) addIssue('WARNING', 'AUDIT_HISTORY', 'activity', activity.id, 'Activity history references a missing customer.');
    if (activity.saleId && !salesById.has(activity.saleId)) addIssue('WARNING', 'AUDIT_HISTORY', 'activity', activity.id, 'Activity history references a missing sale.');
    if (activity.paymentId && !paymentsById.has(activity.paymentId)) addIssue('WARNING', 'AUDIT_HISTORY', 'activity', activity.id, 'Activity history references a missing payment.');
    if (activity.invoiceId && !invoicesById.has(activity.invoiceId)) addIssue('WARNING', 'AUDIT_HISTORY', 'activity', activity.id, 'Activity history references a missing invoice.');
  });
  notifications.forEach(notification => {
    if (!notification.title?.trim() || !notification.message?.trim() || !Number.isFinite(Date.parse(notification.createdAt))) {
      addIssue('WARNING', 'STRUCTURE', 'notification', notification.id, 'Notification is missing required text or has an invalid creation date.');
    }
    if (notification.customerId && !customersById.has(notification.customerId)) addIssue('WARNING', 'RELATIONSHIPS', 'notification', notification.id, 'Notification refers to a missing customer.');
    if (notification.saleId && !salesById.has(notification.saleId)) addIssue('WARNING', 'RELATIONSHIPS', 'notification', notification.id, 'Notification refers to a missing sale.');
    if (notification.paymentId && !paymentsById.has(notification.paymentId)) addIssue('WARNING', 'RELATIONSHIPS', 'notification', notification.id, 'Notification refers to a missing payment.');
    if (notification.invoiceId && !invoicesById.has(notification.invoiceId)) addIssue('WARNING', 'RELATIONSHIPS', 'notification', notification.id, 'Notification refers to a missing invoice.');
  });

  const methods = normalizePaymentMethods(records.settings.paymentPreferences?.methods);
  const financialIssues: FinancialIntegrityIssue[] = runFinancialIntegrityCheck({
    businessId: records.businessId,
    accounts: financialAccounts,
    payments,
    expenses,
    income: otherIncome,
    transfers: financialTransfers,
    adjustments: financialAdjustments,
    paymentMethods: methods,
    sales,
    invoices,
    subscriptions,
    customers,
    services,
    dailyClosings,
    reconciliations: financialReconciliations,
    periods: financialPeriods,
  });
  financialIssues.forEach(issue => {
    if (issue.type === 'duplicate_record_id') return;
    const category: DataIntegrityCategory = issue.type === 'invoice_payment_totals'
      || issue.type === 'invalid_daily_closing' || issue.type === 'incomplete_daily_closing'
      ? 'DERIVED_VALUES'
      : issue.type.includes('date') || issue.type.includes('period')
        ? 'DATES'
        : issue.type.includes('business') ? 'BUSINESS_CONTEXT'
        : issue.type.includes('invoice') || issue.type.includes('payment') || issue.type.includes('expense')
          || issue.type.includes('amount') || issue.type.includes('account') || issue.type.includes('transfer')
          || issue.type.includes('reconciliation') || issue.type.includes('ledger') || issue.type.includes('daily_closing')
          ? 'FINANCIAL_DATA' : 'RELATIONSHIPS';
    addIssue(issue.severity, category, issue.entityType || 'financial_record', issue.entityId, issue.message, issue.suggestedFix);
  });

  const overlappingPeriods = [...financialPeriods].sort((left, right) => left.startDate.localeCompare(right.startDate));
  for (let index = 1; index < overlappingPeriods.length; index += 1) {
    const previous = overlappingPeriods[index - 1];
    const current = overlappingPeriods[index];
    if (previous.businessId === current.businessId && current.startDate <= previous.endDate) {
      addIssue('ERROR', 'DATES', 'financial_period', current.id, `Financial period overlaps period ${previous.id}.`);
    }
  }
  const financialRecords = {
    accounts: financialAccounts,
    payments,
    expenses,
    income: otherIncome,
    transfers: financialTransfers,
    adjustments: financialAdjustments,
    paymentMethods: methods,
    expenseCategories: records.settings.financialPreferences?.expenseCategories || [],
    incomeCategories: records.settings.financialPreferences?.incomeCategories || [],
    sales,
    invoices,
    customers,
  };
  const ledger = getFinancialLedger(financialRecords);
  const businessBalance = getTotalBusinessBalance(financialAccounts, ledger, records.settings.currency);
  const ledgerByAccountId = new Map<string, typeof ledger>();
  ledger.forEach(entry => {
    const entries = ledgerByAccountId.get(entry.accountId) || [];
    entries.push(entry);
    ledgerByAccountId.set(entry.accountId, entries);
  });
  const accountBalances = financialAccounts.map(account => {
    const amount = getAccountBalance(account, ledgerByAccountId.get(account.id) || [], account.currency);
    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      calculatedBalance: amount,
      businessTotalBalance: businessBalance,
    };
  });
  (records.storageWarnings || []).forEach(warning => {
    addIssue('WARNING', 'STORAGE', 'browser_storage', undefined, warning, 'Create a safety backup and review the preserved recovery copy before making changes.');
  });
  addIssue('INFO', 'MIGRATION_VERSION', 'application', undefined, 'Current versioned local storage collections are in use; no separate migration status is available for existing records.');
  addIssue('INFO', 'BACKUP_COMPATIBILITY', 'backup', undefined, 'The existing restore flow validates backup versions and uses atomic rollback; no backup file is validated during this check.');

  const errors = issues.filter(issue => issue.severity === 'ERROR');
  const warnings = issues.filter(issue => issue.severity === 'WARNING');
  const info = issues.filter(issue => issue.severity === 'INFO');
  const categoryCounts: DataIntegritySummary['categoryCounts'] = {};
  issues.forEach(issue => { categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1; });
  const result: DataIntegrityResult = {
    businessId: records.businessId,
    status: errors.length ? 'ERROR' : warnings.length ? 'WARNING' : 'HEALTHY',
    errors,
    warnings,
    info,
    summary: {
      recordsChecked,
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
      categoryCounts,
      accountBalances,
      businessBalance,
    },
    checkedAt: new Date().toISOString(),
  };
  if (options.cacheResult !== false) lastDataIntegrityResult = result;
  return result;
}
