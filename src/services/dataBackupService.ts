import type {
  Account,
  ActivityLog,
  AppCurrency,
  AppSettings,
  BusinessNotification,
  Customer,
  Invoice,
  Payment,
  Sale,
  Service,
  Subscription,
  FinancialAccount,
  Expense,
  OtherIncome,
  FinancialTransfer,
  FinancialAdjustment,
} from '../types';
import { parseCSV } from '../utils/csvParser';
import { isBusinessNotification } from './localStorageStore';
import { buildCustomerCrmMetrics } from '../utils/customerCrm';
import { getAccountCapacity } from '../utils/resourceManagement';
import { getInvoiceDisplayStatus } from '../utils/invoiceUtils';
import {
  getPaymentSaleAllocation,
  getSaleDueAmount,
  getSaleLineItems,
  getSalePaidAmount,
  getSalePaymentStatus,
  getSalePayments,
} from '../utils/saleUtils';
import {
  createBackupChecksum,
  createBackupSha256,
  verifyBackupChecksum,
  verifyBackupSha256,
} from '../utils/backupIntegrity';

export const DATA_VERSION = 1;
export const BACKUP_APPLICATION_ID = 'xolvemanager';
const REQUIRED_COLLECTIONS = [
  'customers', 'services', 'accounts', 'subscriptions', 'sales',
  'invoices', 'payments', 'activityLogs', 'notifications',
] as const;
type CollectionName = typeof REQUIRED_COLLECTIONS[number];
const FINANCIAL_COLLECTIONS = [
  'financialAccounts', 'expenses', 'otherIncome', 'financialTransfers', 'financialAdjustments', 'dailyClosings',
] as const;
type FinancialCollectionName = typeof FINANCIAL_COLLECTIONS[number];
const OPTIONAL_COLLECTIONS = ['reminders', 'profitabilityCosts', 'financialReconciliations', 'financialPeriods'] as const;
type OptionalCollectionName = typeof OPTIONAL_COLLECTIONS[number];
export type BackupRecords = Record<CollectionName, unknown[]> & Partial<Record<FinancialCollectionName | OptionalCollectionName, unknown[]>>;
export type BackupEnvironment = 'demo' | 'production' | 'mixed' | 'unknown';

export interface BackupDocument {
  applicationId?: string;
  backupVersion: number;
  dataVersion: number;
  appVersion: string;
  exportedAt: string;
  integrityChecksum?: string;
  sha256Checksum?: string;
  environment?: BackupEnvironment;
  categoryManifest?: Record<string, number>;
  business: unknown;
  demoDataManifest?: unknown;
  preferences?: {
    theme?: 'light' | 'dark';
    language?: 'en' | 'bn';
    currency?: 'BDT' | 'USD';
  };
  settings: AppSettings;
  records: BackupRecords;
}

export interface BackupValidation {
  valid: boolean;
  errors: string[];
  document?: BackupDocument;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const recordId = (item: unknown, key = 'id'): string | undefined =>
  isRecord(item) && typeof item[key] === 'string' && item[key] ? item[key] as string : undefined;
const getIds = (items: unknown[], key = 'id'): Set<string> =>
  new Set(items.map(item => recordId(item, key)).filter((id): id is string => Boolean(id)));
const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = typeof value !== 'number' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
const csv = (headers: string[], rows: unknown[][]): string =>
  [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
const dateIsValid = (value: unknown): boolean =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const dateOnlyIsValid = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const getBackupEnvironment = (records: Record<string, unknown>, demoManifest: unknown): BackupEnvironment => {
  let demoRecords = 0;
  let otherRecords = 0;
  const recordArrays = [...REQUIRED_COLLECTIONS, ...FINANCIAL_COLLECTIONS, ...OPTIONAL_COLLECTIONS]
    .flatMap(name => Array.isArray(records[name]) ? records[name] as unknown[] : []);
  recordArrays.forEach(item => {
    if (!isRecord(item)) return;
    const id = typeof item.id === 'string' ? item.id
      : typeof item.invoiceId === 'string' ? item.invoiceId : '';
    if (!id) return;
    if (id.startsWith('xvm_demo_')) demoRecords += 1;
    else otherRecords += 1;
  });
  if (Array.isArray(records.accounts)) records.accounts.forEach(item => {
    if (!isRecord(item)) return;
    (Array.isArray(item.profiles) ? item.profiles : []).forEach(profile => {
      if (!isRecord(profile) || typeof profile.id !== 'string') return;
      if (profile.id.startsWith('xvm_demo_')) demoRecords += 1;
      else otherRecords += 1;
    });
  });
  if (Array.isArray(records.services)) records.services.forEach(item => {
    if (!isRecord(item)) return;
    const plans = Array.isArray(item.planDetails) ? item.planDetails : [];
    plans.forEach(plan => {
      if (!isRecord(plan) || typeof plan.id !== 'string') return;
      if (plan.id.startsWith('xvm_demo_')) demoRecords += 1;
      else otherRecords += 1;
    });
  });
  if (isRecord(demoManifest) && isRecord(demoManifest.records)) {
    const manifestCount = Object.values(demoManifest.records).reduce<number>((count, ids) =>
      count + (Array.isArray(ids) ? ids.length : 0), 0);
    if (manifestCount > demoRecords) demoRecords = manifestCount;
  }
  if (demoRecords > 0 && otherRecords > 0) return 'mixed';
  if (demoRecords > 0) return 'demo';
  if (otherRecords > 0) return 'production';
  return 'unknown';
};

export async function createVersionedBackup(json: string, appVersion: string): Promise<BackupDocument> {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) throw new Error('The application data could not be read for backup.');
  const records = isRecord(parsed.records) ? parsed.records : null;
  if (!records) throw new Error('The application data collections are missing.');
  const categoryManifest: Record<string, number> = getBackupCounts(records as BackupRecords);
  categoryManifest.profiles = Array.isArray(records.accounts)
    ? records.accounts.reduce((count, account) => count + (
      isRecord(account) && Array.isArray(account.profiles) ? account.profiles.length : 0
    ), 0)
    : 0;
  categoryManifest.plans = Array.isArray(records.services)
    ? records.services.reduce((count, service) => count + (
      isRecord(service) && Array.isArray(service.planDetails)
        ? service.planDetails.length
        : isRecord(service) && Array.isArray(service.plans) ? service.plans.length : 0
    ), 0)
    : 0;
  const document = {
    applicationId: BACKUP_APPLICATION_ID,
    backupVersion: 1,
    dataVersion: DATA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    business: parsed.business ?? null,
    demoDataManifest: parsed.demoDataManifest ?? null,
    preferences: isRecord(parsed.preferences) ? parsed.preferences : {},
    environment: getBackupEnvironment(records, parsed.demoDataManifest),
    categoryManifest,
    settings: parsed.settings,
    records: {
      ...records,
      ...Object.fromEntries(FINANCIAL_COLLECTIONS.map(name => [
        name,
        Array.isArray(records[name]) ? records[name] : [],
      ])),
      ...Object.fromEntries(OPTIONAL_COLLECTIONS.map(name => [
        name,
        Array.isArray(records[name]) ? records[name] : [],
      ])),
    },
  } as BackupDocument;
  document.integrityChecksum = createBackupChecksum(document);
  document.sha256Checksum = await createBackupSha256(document);
  const validation = validateBackup(document);
  if (!validation.valid) throw new Error(validation.errors.slice(0, 3).join(' '));
  return document;
}

export function validateBackup(input: unknown): BackupValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ['Backup must contain a JSON object.'] };
  if (verifyBackupChecksum(input) === 'invalid') {
    errors.push('Backup integrity checksum is invalid. The file may be incomplete or modified.');
  }
  if (input.applicationId !== undefined && input.applicationId !== BACKUP_APPLICATION_ID) {
    errors.push('This backup was created by a different application.');
  }
  if (input.environment !== undefined
    && !['demo', 'production', 'mixed', 'unknown'].includes(String(input.environment))) {
    errors.push('Backup environment metadata is invalid.');
  }
  if (input.sha256Checksum !== undefined
    && (typeof input.sha256Checksum !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(input.sha256Checksum))) {
    errors.push('Backup SHA-256 integrity metadata is invalid.');
  }
  const isLegacyFlatBackup = input.backupVersion === undefined
    && input.schemaVersion === undefined
    && !isRecord(input.records)
    && REQUIRED_COLLECTIONS.some(name => Array.isArray(input[name]));
  const version = input.backupVersion ?? input.schemaVersion;
  if (version !== 1 && !isLegacyFlatBackup) errors.push('Unsupported or missing backup version.');
  if (input.backupVersion !== undefined && input.dataVersion !== DATA_VERSION) {
    errors.push(`Unsupported data version: ${String(input.dataVersion)}.`);
  }
  const records = isRecord(input.records) ? input.records : isLegacyFlatBackup ? input : null;
  if (!records) {
    return {
      valid: false,
      errors: [...errors, 'This file is not a recognized XolveManager backup. Choose a JSON file created with Create Backup.'],
    };
  }
  for (const name of REQUIRED_COLLECTIONS) {
    if (!Array.isArray(records[name])) errors.push(`The ${name} collection is missing or invalid.`);
  }
  FINANCIAL_COLLECTIONS.forEach(name => {
    if (name in records && !Array.isArray(records[name])) errors.push(`The ${name} collection is invalid.`);
  });
  OPTIONAL_COLLECTIONS.forEach(name => {
    if (name in records && !Array.isArray(records[name])) errors.push(`The ${name} collection is invalid.`);
  });
  if (input.categoryManifest !== undefined && !isRecord(input.categoryManifest)) {
    errors.push('Backup category manifest is invalid.');
  }
  if (isRecord(input.categoryManifest) && records) {
    const declared = input.categoryManifest;
    const actual = getBackupCounts(records as BackupRecords);
    actual.profiles = Array.isArray(records.accounts)
      ? records.accounts.reduce((count, account) => count + (
        isRecord(account) && Array.isArray(account.profiles) ? account.profiles.length : 0
      ), 0)
      : 0;
    actual.plans = Array.isArray(records.services)
      ? records.services.reduce((count, service) => count + (
        isRecord(service) && Array.isArray(service.planDetails)
          ? service.planDetails.length
          : isRecord(service) && Array.isArray(service.plans) ? service.plans.length : 0
      ), 0)
      : 0;
    Object.entries(actual).forEach(([name, count]) => {
      if (declared[name] !== count) errors.push(`Backup manifest count for ${name} does not match the included records.`);
    });
    for (const name of ['profiles', 'plans']) {
      if (typeof declared[name] !== 'number' || !Number.isSafeInteger(declared[name]) || declared[name] !== actual[name]) {
        errors.push(`Backup manifest count for ${name} does not match the included records.`);
      }
    }
  }
  if (input.preferences !== undefined && (!isRecord(input.preferences)
    || (input.preferences.theme !== undefined && !['light', 'dark'].includes(String(input.preferences.theme)))
    || (input.preferences.language !== undefined && !['en', 'bn'].includes(String(input.preferences.language)))
    || (input.preferences.currency !== undefined && !['BDT', 'USD'].includes(String(input.preferences.currency))))) {
    errors.push('Backup display preferences are invalid.');
  }
  if (input.demoDataManifest !== undefined && input.demoDataManifest !== null) {
    const manifest = input.demoDataManifest;
    if (!isRecord(manifest) || manifest.version !== 1 || !isRecord(manifest.records)
      || !Array.isArray(manifest.planIds)
      || !Object.values(manifest.records).every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'string'))
      || !manifest.planIds.every(id => typeof id === 'string')) {
      errors.push('Backup demo-data manifest is invalid.');
    }
  }
  if (!isRecord(input.settings)) errors.push('Business settings are missing or invalid.');
  const arrays = Object.fromEntries(REQUIRED_COLLECTIONS.map(name =>
    [name, Array.isArray(records[name]) ? records[name] as unknown[] : []]
  )) as Record<CollectionName, unknown[]>;
  const financialArrays = Object.fromEntries(FINANCIAL_COLLECTIONS.map(name =>
    [name, Array.isArray(records[name]) ? records[name] as unknown[] : []]
  )) as Record<FinancialCollectionName, unknown[]>;
  const optionalArrays = Object.fromEntries(OPTIONAL_COLLECTIONS.map(name =>
    [name, Array.isArray(records[name]) ? records[name] as unknown[] : []]
  )) as Record<OptionalCollectionName, unknown[]>;
  const reminderIds = new Set<string>();
  optionalArrays.reminders.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id
      || typeof item.deterministicKey !== 'string' || !item.deterministicKey
      || typeof item.title !== 'string' || !item.title.trim()
      || typeof item.dueDate !== 'string' || !dateOnlyIsValid(item.dueDate)
      || !['open', 'completed', 'snoozed', 'dismissed'].includes(String(item.status))
      || !['low', 'medium', 'high', 'critical'].includes(String(item.priority))
      || !['renewal_upcoming', 'renewal_today', 'subscription_expired', 'payment_due', 'payment_overdue', 'invoice_due', 'invoice_overdue', 'partial_payment', 'unpaid_sale', 'customer_follow_up', 'daily_closing'].includes(String(item.type))) {
      errors.push(`Reminder row ${index + 1} is invalid.`);
      return;
    }
    if (reminderIds.has(item.id)) errors.push(`Reminders contain duplicate ID "${item.id}".`);
    reminderIds.add(item.id);
  });
  const reconciliationIds = new Set<string>();
  optionalArrays.financialReconciliations.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id
      || typeof item.businessId !== 'string' || !item.businessId
      || typeof item.accountId !== 'string' || !item.accountId
      || !dateOnlyIsValid(item.reconciliationDate)
      || typeof item.systemBalance !== 'number' || !Number.isFinite(item.systemBalance)
      || typeof item.actualBalance !== 'number' || !Number.isFinite(item.actualBalance)
      || typeof item.difference !== 'number' || !Number.isFinite(item.difference)
      || !['matched', 'difference'].includes(String(item.status))
      || !dateIsValid(item.createdAt)) {
      errors.push(`Financial reconciliation row ${index + 1} is invalid.`);
      return;
    }
    if (reconciliationIds.has(item.id)) errors.push(`Financial reconciliations contain duplicate ID "${item.id}".`);
    reconciliationIds.add(item.id);
  });
  const periodIds = new Set<string>();
  optionalArrays.financialPeriods.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id
      || typeof item.businessId !== 'string' || !item.businessId
      || !dateOnlyIsValid(item.startDate) || !dateOnlyIsValid(item.endDate)
      || String(item.startDate) > String(item.endDate)
      || !['open', 'closed'].includes(String(item.status))
      || !dateIsValid(item.createdAt) || !dateIsValid(item.updatedAt)) {
      errors.push(`Financial period row ${index + 1} is invalid.`);
      return;
    }
    if (periodIds.has(item.id)) errors.push(`Financial periods contain duplicate ID "${item.id}".`);
    periodIds.add(item.id);
  });
  const profitabilityCostIds = new Set<string>();
  optionalArrays.profitabilityCosts.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id
      || !['direct', 'shared', 'operating', 'adjustment'].includes(String(item.costType))
      || !['active', 'voided'].includes(String(item.status))
      || typeof item.category !== 'string' || !item.category.trim()
      || typeof item.amount !== 'number' || !Number.isFinite(item.amount)
      || !['BDT', 'USD'].includes(String(item.currency))
      || !dateOnlyIsValid(item.date)
      || !['none', 'equal', 'revenue', 'sales', 'subscriptions', 'manual'].includes(String(item.allocationMethod))
      || typeof item.description !== 'string' || !item.description.trim()
      || !dateIsValid(item.createdAt) || !dateIsValid(item.updatedAt)
      || (item.manualAllocations !== undefined && (!Array.isArray(item.manualAllocations)
        || !item.manualAllocations.every(allocation => isRecord(allocation)
          && typeof allocation.serviceId === 'string'
          && typeof allocation.percentage === 'number' && Number.isFinite(allocation.percentage) && allocation.percentage >= 0)))) {
      errors.push(`Profitability cost row ${index + 1} is invalid.`);
      return;
    }
    if (profitabilityCostIds.has(item.id)) errors.push(`Profitability costs contain duplicate ID "${item.id}".`);
    profitabilityCostIds.add(item.id);
    if (item.costType === 'shared' && item.allocationMethod === 'manual'
      && Math.abs((item.manualAllocations as Array<{percentage: number}>).reduce((sum, allocation) => sum + allocation.percentage, 0) - 100) > 0.001) {
      errors.push(`Profitability cost row ${index + 1} has manual allocations that do not total 100%.`);
    }
  });
  if (isRecord(input.settings) && typeof input.settings.storeName === 'string' &&
    (input.settings.storeName.trim().length < 2 || input.settings.storeName.trim().length > 80)) {
    errors.push('Business settings contain an invalid business name.');
  }
  if (isRecord(input.settings) && input.settings.currency !== undefined &&
    !['BDT', 'USD'].includes(String(input.settings.currency))) errors.push('Business settings contain an invalid currency.');
  arrays.notifications.forEach((item, index) => {
    if (!isBusinessNotification(item)) errors.push(`Notification row ${index + 1} is invalid.`);
  });

  for (const name of ['customers', 'services', 'accounts', 'subscriptions', 'sales', 'invoices', 'payments', 'activityLogs'] as const) {
    const key = name === 'invoices' ? 'invoiceId' : 'id';
    const seen = new Set<string>();
    arrays[name].forEach((item, index) => {
      const id = recordId(item, key);
      if (!id) errors.push(`${name} row ${index + 1} is missing a valid ${key}.`);
      else if (seen.has(id)) errors.push(`${name} contains duplicate ID "${id}".`);
      else seen.add(id);
      if (!isRecord(item)) errors.push(`${name} row ${index + 1} is not a record.`);
    });
  }
  if (isRecord(input.business) && typeof input.business.businessId === 'string') {
    const businessId = input.business.businessId;
    REQUIRED_COLLECTIONS.forEach(name => arrays[name].forEach(item => {
      if (isRecord(item) && typeof item.businessId === 'string' && item.businessId !== businessId) {
        errors.push(`${name} record ${String(item.id ?? '')} belongs to a different business.`);
      }
    }));
    FINANCIAL_COLLECTIONS.forEach(name => financialArrays[name].forEach(item => {
      if (isRecord(item) && typeof item.businessId === 'string' && item.businessId !== businessId) {
        errors.push(`${name} record ${String(item.id ?? '')} belongs to a different business.`);
      }
    }));
  }

  FINANCIAL_COLLECTIONS.forEach(name => {
    const seen = new Set<string>();
    financialArrays[name].forEach((item, index) => {
      const id = recordId(item);
      if (!isRecord(item)) errors.push(`${name} row ${index + 1} is not a record.`);
      else if (!id) errors.push(`${name} row ${index + 1} is missing a valid id.`);
      else if (seen.has(id)) errors.push(`${name} contains duplicate ID "${id}".`);
      else seen.add(id);
    });
  });
  const financialAccountIds = getIds(financialArrays.financialAccounts);
  financialArrays.financialAccounts.forEach(item => {
    if (!isRecord(item)) return;
    if (typeof item.name !== 'string' || !item.name.trim()
      || !['mobile_banking', 'cash', 'bank', 'card', 'other'].includes(String(item.type))
      || !Number.isFinite(Number(item.openingBalance))
      || !dateOnlyIsValid(item.openingBalanceDate)
      || !['BDT', 'USD'].includes(String(item.currency))
      || typeof item.enabled !== 'boolean') {
      errors.push(`Financial account ${String(item.id)} has invalid details.`);
    }
  });
  const categoryIds = (key: 'expenseCategories' | 'incomeCategories'): Set<string> | undefined => {
    if (!isRecord(input.settings) || !isRecord(input.settings.financialPreferences)
      || !(key in input.settings.financialPreferences)) return undefined;
    const categories = input.settings.financialPreferences[key];
    if (!Array.isArray(categories)) {
      errors.push(`Financial ${key} collection is invalid.`);
      return new Set();
    }
    const seen = new Set<string>();
    categories.forEach((category, index) => {
      const id = recordId(category);
      if (!isRecord(category) || !id || typeof category.name !== 'string' || !category.name.trim()
        || typeof category.enabled !== 'boolean') {
        errors.push(`Financial ${key} category ${index + 1} is invalid.`);
      } else if (seen.has(id)) errors.push(`Financial ${key} contains duplicate category ID "${id}".`);
      else seen.add(id);
    });
    return seen;
  };
  const expenseCategoryIds = categoryIds('expenseCategories');
  const incomeCategoryIds = categoryIds('incomeCategories');
  if (isRecord(input.settings) && isRecord(input.settings.financialPreferences)
    && input.settings.financialPreferences.allowNegativeBalances !== undefined
    && typeof input.settings.financialPreferences.allowNegativeBalances !== 'boolean') {
    errors.push('Financial negative-balance preference is invalid.');
  }
  const validateFinancialLink = (collection: FinancialCollectionName, field: string) => {
    financialArrays[collection].forEach(item => {
      if (isRecord(item) && (typeof item[field] !== 'string' || !financialAccountIds.has(item[field] as string))) {
        errors.push(`${collection} record ${String(item.id)} references an unknown financial account.`);
      }
    });
  };
  validateFinancialLink('expenses', 'accountId');
  validateFinancialLink('otherIncome', 'accountId');
  validateFinancialLink('financialAdjustments', 'accountId');
  financialArrays.expenses.forEach(item => {
    if (isRecord(item) && (typeof item.categoryId !== 'string' || (expenseCategoryIds && !expenseCategoryIds.has(item.categoryId)))) {
      errors.push(`Expense ${String(item.id)} references an unknown expense category.`);
    }
  });
  financialArrays.otherIncome.forEach(item => {
    if (isRecord(item) && (typeof item.categoryId !== 'string' || (incomeCategoryIds && !incomeCategoryIds.has(item.categoryId)))) {
      errors.push(`Other income ${String(item.id)} references an unknown income category.`);
    }
  });
  financialArrays.financialTransfers.forEach(item => {
    if (isRecord(item) && (
      !financialAccountIds.has(String(item.fromAccountId))
      || !financialAccountIds.has(String(item.toAccountId))
      || item.fromAccountId === item.toAccountId
    )) errors.push(`Financial transfer ${String(item.id)} has invalid account references.`);
    if (isRecord(item) && financialAccountIds.has(String(item.fromAccountId)) && financialAccountIds.has(String(item.toAccountId))) {
      const from = financialArrays.financialAccounts.find(account => isRecord(account) && account.id === item.fromAccountId);
      const to = financialArrays.financialAccounts.find(account => isRecord(account) && account.id === item.toAccountId);
      if (isRecord(from) && isRecord(to) && (from.currency !== to.currency || item.currency !== from.currency)) {
        errors.push(`Financial transfer ${String(item.id)} uses inconsistent account currencies.`);
      }
    }
  });
  financialArrays.expenses.concat(financialArrays.otherIncome, financialArrays.financialTransfers).forEach(item => {
    if (!isRecord(item)) return;
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Financial record ${String(item.id)} has an invalid amount.`);
    }
    if (!dateOnlyIsValid(item.date)) errors.push(`Financial record ${String(item.id)} has an invalid date.`);
    if (!['BDT', 'USD'].includes(String(item.currency))) errors.push(`Financial record ${String(item.id)} has an invalid currency.`);
    if (item.status !== undefined && !['posted', 'voided'].includes(String(item.status))) {
      errors.push(`Financial record ${String(item.id)} has an invalid status.`);
    }
  });
  financialArrays.financialAdjustments.forEach(item => {
    if (!isRecord(item)) return;
    if (!Number.isFinite(Number(item.amount)) || Number(item.amount) === 0) errors.push(`Financial adjustment ${String(item.id)} has an invalid amount.`);
    if (!dateOnlyIsValid(item.date)) errors.push(`Financial adjustment ${String(item.id)} has an invalid date.`);
    if (!['BDT', 'USD'].includes(String(item.currency))) errors.push(`Financial adjustment ${String(item.id)} has an invalid currency.`);
    if (typeof item.reason !== 'string' || !item.reason.trim()) errors.push(`Financial adjustment ${String(item.id)} has no reason.`);
  });
  financialArrays.dailyClosings.forEach(item => {
    if (!isRecord(item)) return;
    if (!dateOnlyIsValid(item.date) || !['closed', 'reopened'].includes(String(item.status))
      || !['BDT', 'USD'].includes(String(item.currency))
      || !Array.isArray(item.accounts)
      || typeof item.closedAt !== 'string'
      || typeof item.closedBy !== 'string') {
      errors.push(`Daily closing ${String(item.id)} has invalid details.`);
      return;
    }
    [
      'openingBalance', 'totalMoneyIn', 'totalMoneyOut', 'transfersIn', 'transfersOut',
      'adjustmentsNet', 'expectedClosingBalance', 'actualClosingBalance', 'difference',
    ].forEach(field => {
      if (!Number.isFinite(Number(item[field]))) errors.push(`Daily closing ${String(item.id)} has an invalid ${field}.`);
    });
    item.accounts.forEach((account, index) => {
      if (!isRecord(account)
        || typeof account.accountId !== 'string'
        || !financialAccountIds.has(account.accountId)
        || !['BDT', 'USD'].includes(String(account.currency))
        || !Number.isFinite(Number(account.expectedClosingBalance))
        || !Number.isFinite(Number(account.actualClosingBalance))
        || !Number.isFinite(Number(account.difference))) {
        errors.push(`Daily closing ${String(item.id)} account ${index + 1} is invalid.`);
      }
    });
  });
  arrays.payments.forEach(item => {
    if (isRecord(item) && item.financialAccountId !== undefined
      && !financialAccountIds.has(String(item.financialAccountId))) {
      errors.push(`Payment ${String(item.id)} references an unknown financial account.`);
    }
  });
  if (isRecord(input.settings) && isRecord(input.settings.paymentPreferences)
    && Array.isArray(input.settings.paymentPreferences.methods)) {
    input.settings.paymentPreferences.methods.forEach(method => {
      if (isRecord(method) && method.financialAccountId !== undefined
        && !financialAccountIds.has(String(method.financialAccountId))) {
        errors.push(`Payment method ${String(method.id)} references an unknown financial account.`);
      }
    });
  }

  const customers = getIds(arrays.customers);
  arrays.customers.forEach(item => {
    if (!isRecord(item)) return;
    if (typeof item.name !== 'string' || !item.name.trim()) errors.push(`Customer ${String(item.id)} is missing a name.`);
    if (typeof item.phone !== 'string' || typeof item.email !== 'string') errors.push(`Customer ${String(item.id)} has invalid contact fields.`);
    if (item.createdAt !== undefined && !dateIsValid(item.createdAt)) errors.push(`Customer ${String(item.id)} has an invalid creation date.`);
    if (item.tags !== undefined && (!Array.isArray(item.tags) || !item.tags.every(tag => typeof tag === 'string'))) {
      errors.push(`Customer ${String(item.id)} has invalid tags.`);
    }
    if (item.duplicateOfCustomerId !== undefined && typeof item.duplicateOfCustomerId !== 'string') {
      errors.push(`Customer ${String(item.id)} has an invalid duplicate reference.`);
    }
    if (item.preferences !== undefined) {
      if (!isRecord(item.preferences)) errors.push(`Customer ${String(item.id)} has invalid contact preferences.`);
      else {
        const { contactMethod, contactAllowed, language } = item.preferences;
        if (contactMethod !== undefined && !['phone', 'whatsapp', 'email', 'other'].includes(String(contactMethod))) errors.push(`Customer ${String(item.id)} has an invalid contact method.`);
        if (contactAllowed !== undefined && typeof contactAllowed !== 'boolean') errors.push(`Customer ${String(item.id)} has invalid contact permission.`);
        if (language !== undefined && !['en', 'bn'].includes(String(language))) errors.push(`Customer ${String(item.id)} has an invalid preferred language.`);
      }
    }
    if (item.notesHistory !== undefined) {
      if (!Array.isArray(item.notesHistory)) errors.push(`Customer ${String(item.id)} has an invalid notes collection.`);
      else item.notesHistory.forEach((note, noteIndex) => {
        if (!isRecord(note)
          || typeof note.id !== 'string'
          || note.customerId !== item.id
          || typeof note.text !== 'string'
          || !dateIsValid(note.createdAt)
          || !dateIsValid(note.updatedAt)) {
          errors.push(`Customer ${String(item.id)} note ${noteIndex + 1} is invalid.`);
        }
      });
    }
  });
  const services = getIds(arrays.services);
  arrays.services.forEach(item => {
    if (!isRecord(item)) return;
    if (typeof item.name !== 'string' || !item.name.trim()) errors.push(`Service ${String(item.id)} is missing a name.`);
    if (!Array.isArray(item.plans)) errors.push(`Service ${String(item.id)} has an invalid plans collection.`);
    if (item.defaultDurationDays !== undefined && (typeof item.defaultDurationDays !== 'number' || item.defaultDurationDays <= 0)) {
      errors.push(`Service ${String(item.id)} has an invalid default duration.`);
    }
    if (Array.isArray(item.planDetails)) {
      const seenPlans = new Set<string>();
      item.planDetails.forEach(plan => {
        const id = recordId(plan);
        if (!id) errors.push(`Service ${String(item.id)} has a plan without a valid ID.`);
        else if (seenPlans.has(id)) errors.push(`Service ${String(item.id)} has duplicate plan ID "${id}".`);
        else seenPlans.add(id);
        if (isRecord(plan) && (typeof plan.price !== 'number' || !Number.isFinite(plan.price) || plan.price < 0)) {
          errors.push(`Plan ${String(id)} has an invalid price.`);
        }
      });
    }
  });
  const accounts = getIds(arrays.accounts);
  const profiles = new Set<string>();
  const profileAccounts = new Map<string, string>();
  const profilesById = new Map<string, Record<string, unknown>>();
  const accountsById = new Map<string, Record<string, unknown>>();
  arrays.accounts.forEach(account => {
    if (!isRecord(account)) return;
    if (typeof account.id === 'string') accountsById.set(account.id, account);
    if (typeof account.serviceId !== 'string' || !services.has(account.serviceId)) errors.push(`Account ${String(account.id)} references a missing service.`);
    if (typeof account.maxProfiles !== 'number' || !Number.isSafeInteger(account.maxProfiles) || account.maxProfiles < 1) errors.push(`Account ${String(account.id)} has an invalid profile capacity.`);
    if (account.purchaseCost !== undefined
      && (typeof account.purchaseCost !== 'number' || !Number.isFinite(account.purchaseCost) || account.purchaseCost < 0)) {
      errors.push(`Account ${String(account.id)} has an invalid purchase cost.`);
    }
    if (account.purchaseCostCurrency !== undefined && !['BDT', 'USD'].includes(String(account.purchaseCostCurrency))) {
      errors.push(`Account ${String(account.id)} has an invalid purchase cost currency.`);
    }
    if (Array.isArray(account.profiles)) account.profiles.forEach(profile => {
      const id = recordId(profile);
      if (id) {
        if (profiles.has(id)) errors.push(`Duplicate profile ID "${id}".`);
        profiles.add(id);
        profileAccounts.set(id, String(account.id));
        if (isRecord(profile)) profilesById.set(id, profile);
      } else errors.push(`Account ${String(account.id)} contains a profile without a valid ID.`);
      if (isRecord(profile) && profile.accountId && profile.accountId !== account.id) {
        errors.push(`Profile ${String(profile.id)} references a different account.`);
      }
      if (isRecord(profile) && profile.assignedCustomerId && !customers.has(String(profile.assignedCustomerId))) {
        errors.push(`Profile ${String(profile.id)} references a missing customer.`);
      }
      if (isRecord(profile) && profile.status !== undefined && !['Available', 'Assigned', 'Expired', 'Suspended', 'Inactive', 'Disabled'].includes(String(profile.status))) {
        errors.push(`Profile ${String(profile.id)} has an invalid status.`);
      }
    });
  });
  const sales = getIds(arrays.sales);
  const invoices = getIds(arrays.invoices, 'invoiceId');
  const subscriptions = getIds(arrays.subscriptions);
  const serviceHasPlan = (serviceId: unknown, planId: unknown, planName: unknown): boolean => {
    const service = arrays.services.find(item => isRecord(item) && item.id === serviceId);
    if (!isRecord(service)) return false;
    let hasPlanCollection = false;
    if (typeof planId === 'string') {
      if (Array.isArray(service.planDetails)) {
        hasPlanCollection = true;
        if (service.planDetails.some(plan => isRecord(plan) && plan.id === planId)) return true;
      }
      if (Array.isArray(service.planIds)) {
        hasPlanCollection = true;
        if (service.planIds.includes(planId)) return true;
      }
    }
    if (typeof planName === 'string' && planName) {
      if (Array.isArray(service.planDetails) && service.planDetails.some(plan => isRecord(plan) && plan.name === planName)) return true;
      if (Array.isArray(service.plans) && service.plans.includes(planName)) return true;
    }
    return !hasPlanCollection && !(typeof planName === 'string' && planName && Array.isArray(service.plans));
  };
  arrays.accounts.forEach(item => {
    if (isRecord(item) && item.planId && !serviceHasPlan(item.serviceId, item.planId, item.plan)) {
      errors.push(`Account ${String(item.id)} references a missing plan.`);
    }
  });
  arrays.subscriptions.forEach(item => {
    if (!isRecord(item)) return;
    if (!customers.has(String(item.customerId))) errors.push(`Subscription ${String(item.id)} references a missing customer.`);
    if (!services.has(String(item.serviceId))) errors.push(`Subscription ${String(item.id)} references a missing service.`);
    if (item.saleId && !sales.has(String(item.saleId))) errors.push(`Subscription ${String(item.id)} references a missing sale.`);
    if (item.paymentId && !getIds(arrays.payments).has(String(item.paymentId))) errors.push(`Subscription ${String(item.id)} references a missing payment.`);
    if (item.accountId && !accounts.has(String(item.accountId))) errors.push(`Subscription ${String(item.id)} references a missing account.`);
    const linkedAccount = typeof item.accountId === 'string' ? accountsById.get(item.accountId) : undefined;
    if (linkedAccount && linkedAccount.serviceId !== item.serviceId) errors.push(`Subscription ${String(item.id)} uses an account from a different service.`);
    if (linkedAccount && linkedAccount.planId && item.planId && linkedAccount.planId !== item.planId) errors.push(`Subscription ${String(item.id)} uses an account with an incompatible plan.`);
    if (item.profileId && (!profiles.has(String(item.profileId)) || profileAccounts.get(String(item.profileId)) !== item.accountId)) errors.push(`Subscription ${String(item.id)} references a missing or unrelated profile.`);
    const linkedProfile = typeof item.profileId === 'string' ? profilesById.get(item.profileId) : undefined;
    if (linkedProfile?.assignedCustomerId && linkedProfile.assignedCustomerId !== item.customerId) errors.push(`Subscription ${String(item.id)} is linked to a profile assigned to another customer.`);
    if (linkedProfile?.subscriptionId && linkedProfile.subscriptionId !== item.id) errors.push(`Subscription ${String(item.id)} conflicts with its profile assignment link.`);
    if (!serviceHasPlan(item.serviceId, item.planId, item.plan)) errors.push(`Subscription ${String(item.id)} references a missing plan.`);
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) errors.push(`Subscription ${String(item.id)} has an invalid price.`);
    if (!dateIsValid(item.startDate) || !dateIsValid(item.expiryDate)) errors.push(`Subscription ${String(item.id)} has an invalid date.`);
    if (item.status !== undefined && !['active', 'expiring_soon', 'expired', 'cancelled'].includes(String(item.status))) errors.push(`Subscription ${String(item.id)} has an invalid status.`);
    if (!['paid', 'pending', 'partial', 'failed', 'refunded'].includes(String(item.paymentStatus))) errors.push(`Subscription ${String(item.id)} has an invalid payment status.`);
  });
  const profileSubscriptionIds = new Set<string>();
  profilesById.forEach(profile => {
    if (typeof profile.subscriptionId !== 'string') return;
    if (!subscriptions.has(profile.subscriptionId)) errors.push(`Profile ${String(profile.id)} references a missing subscription.`);
    if (profileSubscriptionIds.has(profile.subscriptionId)) errors.push(`Subscription ${profile.subscriptionId} is assigned to more than one profile.`);
    profileSubscriptionIds.add(profile.subscriptionId);
    const linkedSubscription = arrays.subscriptions.find(item => isRecord(item) && item.id === profile.subscriptionId);
    if (isRecord(linkedSubscription) && (
      linkedSubscription.profileId !== profile.id
      || linkedSubscription.accountId !== profile.accountId
      || linkedSubscription.customerId !== profile.assignedCustomerId
    )) errors.push(`Profile ${String(profile.id)} conflicts with its subscription assignment.`);
  });
  arrays.sales.forEach(item => {
    if (!isRecord(item)) return;
    if (!customers.has(String(item.customerId))) errors.push(`Sale ${String(item.id)} references a missing customer.`);
    if (!services.has(String(item.serviceId))) errors.push(`Sale ${String(item.id)} references a missing service.`);
    if (item.subscriptionId && !subscriptions.has(String(item.subscriptionId))) errors.push(`Sale ${String(item.id)} references a missing subscription.`);
    if (item.paymentId && !getIds(arrays.payments).has(String(item.paymentId))) errors.push(`Sale ${String(item.id)} references a missing payment.`);
    if (!serviceHasPlan(item.serviceId, item.planId, item.plan)) errors.push(`Sale ${String(item.id)} references a missing plan.`);
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0) errors.push(`Sale ${String(item.id)} has an invalid amount.`);
    if (item.amountPaid !== undefined && (typeof item.amountPaid !== 'number' || !Number.isFinite(item.amountPaid) || item.amountPaid < 0)) errors.push(`Sale ${String(item.id)} has an invalid paid amount.`);
    if (item.actualCostSnapshot !== undefined
      && (typeof item.actualCostSnapshot !== 'number' || !Number.isFinite(item.actualCostSnapshot) || item.actualCostSnapshot < 0)) {
      errors.push(`Sale ${String(item.id)} has an invalid actual cost snapshot.`);
    }
    if (item.actualCostCurrency !== undefined && !['BDT', 'USD'].includes(String(item.actualCostCurrency))) {
      errors.push(`Sale ${String(item.id)} has an invalid actual cost currency.`);
    }
    if (item.actualCostAllocation !== undefined && !['full_account', 'profile_slot'].includes(String(item.actualCostAllocation))) {
      errors.push(`Sale ${String(item.id)} has an invalid actual cost allocation.`);
    }
    if (!dateIsValid(item.date)) errors.push(`Sale ${String(item.id)} has an invalid date.`);
    if (!['paid', 'pending', 'partial', 'failed', 'refunded'].includes(String(item.paymentStatus))) errors.push(`Sale ${String(item.id)} has an invalid payment status.`);
    if (item.lineItems !== undefined) {
      if (!Array.isArray(item.lineItems) || item.lineItems.length === 0) {
        errors.push(`Sale ${String(item.id)} has an invalid line-item list.`);
      } else {
        let lineAmountMinor = 0;
        const fullAccountIds = new Set<string>();
        const profileAllocationIds = new Set<string>();
        item.lineItems.forEach((line, lineIndex) => {
          const lineLabel = `Sale ${String(item.id)} item ${lineIndex + 1}`;
          if (!isRecord(line)) {
            errors.push(`${lineLabel} is invalid.`);
            return;
          }
          if (!services.has(String(line.serviceId))) errors.push(`${lineLabel} references a missing service.`);
          if (!serviceHasPlan(line.serviceId, line.planId, line.plan)) errors.push(`${lineLabel} references a missing plan.`);
          if (!Number.isSafeInteger(line.quantity) || Number(line.quantity) < 1) errors.push(`${lineLabel} has an invalid quantity.`);
          if (typeof line.unitPrice !== 'number' || !Number.isFinite(line.unitPrice) || line.unitPrice <= 0) errors.push(`${lineLabel} has an invalid unit price.`);
          if (typeof line.subtotal !== 'number' || !Number.isFinite(line.subtotal) || line.subtotal < 0) errors.push(`${lineLabel} has an invalid subtotal.`);
          if (typeof line.discount !== 'number' || !Number.isFinite(line.discount) || line.discount < 0 || line.discount > Number(line.subtotal)) errors.push(`${lineLabel} has an invalid discount.`);
          if (typeof line.amount !== 'number' || !Number.isFinite(line.amount) || line.amount < 0) errors.push(`${lineLabel} has an invalid total.`);
          if (line.currency !== item.currency) errors.push(`${lineLabel} uses a different currency from its sale.`);
          if (!dateIsValid(line.startDate) || !Number.isSafeInteger(line.durationDays) || Number(line.durationDays) < 1) {
            errors.push(`${lineLabel} has an invalid subscription period.`);
          }
          const expectedSubtotal = Math.round(Number(line.unitPrice) * Number(line.quantity) * 100);
          if (Number.isSafeInteger(expectedSubtotal) && Math.abs(expectedSubtotal - Math.round(Number(line.subtotal) * 100)) > 0) {
            errors.push(`${lineLabel} subtotal does not match quantity and unit price.`);
          }
          if (Math.abs(Math.round((Number(line.subtotal) - Number(line.discount)) * 100) - Math.round(Number(line.amount) * 100)) > 0) {
            errors.push(`${lineLabel} total does not match its subtotal and discount.`);
          }
          if (typeof line.amount === 'number' && Number.isFinite(line.amount)) {
            lineAmountMinor += Math.round(line.amount * 100);
          }
          if (!Array.isArray(line.units) || line.units.length !== Number(line.quantity)) {
            errors.push(`${lineLabel} must have one subscription unit for each quantity.`);
            return;
          }
          line.units.forEach(unit => {
            if (!isRecord(unit)) {
              errors.push(`${lineLabel} has an invalid unit allocation.`);
              return;
            }
            const linkedSubscription = arrays.subscriptions.find(candidate =>
              isRecord(candidate) && candidate.id === unit.subscriptionId
            );
            if (!linkedSubscription || !isRecord(linkedSubscription)) {
              errors.push(`${lineLabel} references a missing subscription unit.`);
              return;
            }
            if (linkedSubscription.saleId !== item.id
              || linkedSubscription.customerId !== item.customerId
              || linkedSubscription.serviceId !== line.serviceId
              || linkedSubscription.planId !== line.planId
              || linkedSubscription.startDate !== line.startDate
              || linkedSubscription.durationDays !== line.durationDays
              || linkedSubscription.accountId !== unit.accountId
              || linkedSubscription.profileId !== unit.profileId) {
              errors.push(`${lineLabel} conflicts with its linked subscription.`);
            }
            if (unit.accountId && !accounts.has(String(unit.accountId))) errors.push(`${lineLabel} references a missing account.`);
            if (unit.profileId && (!unit.accountId || !profiles.has(String(unit.profileId))
              || profileAccounts.get(String(unit.profileId)) !== unit.accountId)) {
              errors.push(`${lineLabel} references a missing or unrelated profile.`);
            }
            if (unit.accountId && unit.profileId) {
              const key = `${unit.accountId}:${unit.profileId}`;
              if (profileAllocationIds.has(key)) errors.push(`${lineLabel} allocates a profile more than once.`);
              if (fullAccountIds.has(String(unit.accountId))) errors.push(`${lineLabel} mixes a full account with profile allocations.`);
              profileAllocationIds.add(key);
            } else if (unit.accountId) {
              if (fullAccountIds.has(String(unit.accountId))) errors.push(`${lineLabel} allocates a full account more than once.`);
              if ([...profileAllocationIds].some(key => key.startsWith(`${unit.accountId}:`))) {
                errors.push(`${lineLabel} mixes a full account with profile allocations.`);
              }
              fullAccountIds.add(String(unit.accountId));
            }
            for (const field of ['actualCostSnapshot'] as const) {
              if (unit[field] !== undefined && (typeof unit[field] !== 'number' || !Number.isFinite(unit[field]) || unit[field] < 0)) {
                errors.push(`${lineLabel} has an invalid unit cost snapshot.`);
              }
            }
            if (unit.actualCostCurrency !== undefined && !['BDT', 'USD'].includes(String(unit.actualCostCurrency))) {
              errors.push(`${lineLabel} has an invalid unit cost currency.`);
            }
          });
        });
        const expectedSaleAmount = Math.round((lineAmountMinor - Math.round((Number(item.discount) || 0) * 100)) / 100 * 100);
        if (Number.isFinite(Number(item.amount)) && Math.abs(expectedSaleAmount - Math.round(Number(item.amount) * 100)) > 1) {
          errors.push(`Sale ${String(item.id)} total does not match its line items and discount.`);
        }
      }
    }
  });
  arrays.payments.forEach(item => {
    if (!isRecord(item)) return;
    if (!customers.has(String(item.customerId))) errors.push(`Payment ${String(item.id)} references a missing customer.`);
    if (item.saleId && !sales.has(String(item.saleId))) errors.push(`Payment ${String(item.id)} references a missing sale.`);
    if (item.invoiceId && !invoices.has(String(item.invoiceId))) errors.push(`Payment ${String(item.id)} references a missing invoice.`);
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0) errors.push(`Payment ${String(item.id)} has an invalid amount.`);
    if (item.advanceCreditAmount !== undefined
      && (typeof item.advanceCreditAmount !== 'number' || !Number.isFinite(item.advanceCreditAmount)
        || item.advanceCreditAmount < 0 || item.advanceCreditAmount > (Number(item.amount) || 0))) {
      errors.push(`Payment ${String(item.id)} has an invalid advance credit amount.`);
    }
    for (const collection of ['allocations', 'refundedSaleAllocations'] as const) {
      if (item[collection] === undefined) continue;
      if (!Array.isArray(item[collection])) {
        errors.push(`Payment ${String(item.id)} has invalid ${collection}.`);
        continue;
      }
      for (const allocation of item[collection]) {
        if (!isRecord(allocation)
          || typeof allocation.saleId !== 'string'
          || !sales.has(allocation.saleId)
          || typeof allocation.amount !== 'number'
          || !Number.isFinite(allocation.amount)
          || allocation.amount < 0) {
          errors.push(`Payment ${String(item.id)} has an invalid sale allocation.`);
        }
      }
    }
    if (item.refundedAdvanceCreditAmount !== undefined
      && (typeof item.refundedAdvanceCreditAmount !== 'number'
        || !Number.isFinite(item.refundedAdvanceCreditAmount)
        || item.refundedAdvanceCreditAmount < 0
        || item.refundedAdvanceCreditAmount > (Number(item.amount) || 0))) {
      errors.push(`Payment ${String(item.id)} has an invalid refunded advance credit amount.`);
    }
    if (item.refundOfPaymentId !== undefined
      && (typeof item.refundOfPaymentId !== 'string'
        || !getIds(arrays.payments).has(item.refundOfPaymentId))) {
      errors.push(`Payment ${String(item.id)} references a missing refunded payment.`);
    }
    if (!dateIsValid(item.paymentDate)) errors.push(`Payment ${String(item.id)} has an invalid date.`);
    if (!['paid', 'pending', 'partial', 'failed', 'refunded'].includes(String(item.paymentStatus))) errors.push(`Payment ${String(item.id)} has an invalid status.`);
  });
  arrays.invoices.forEach(item => {
    if (!isRecord(item)) return;
    if (!sales.has(String(item.saleId))) errors.push(`Invoice ${String(item.invoiceId)} references a missing sale.`);
    if (item.subscriptionId && !subscriptions.has(String(item.subscriptionId))) errors.push(`Invoice ${String(item.invoiceId)} references a missing subscription.`);
    if (!customers.has(String(item.customerId))) errors.push(`Invoice ${String(item.invoiceId)} references a missing customer.`);
    if (!services.has(String(item.serviceId))) errors.push(`Invoice ${String(item.invoiceId)} references a missing service.`);
    if (!serviceHasPlan(item.serviceId, item.planId, undefined)) errors.push(`Invoice ${String(item.invoiceId)} references a missing plan.`);
    if (typeof item.totalAmount !== 'number' || !Number.isFinite(item.totalAmount) || item.totalAmount < 0) errors.push(`Invoice ${String(item.invoiceId)} has an invalid total.`);
    if (typeof item.paidAmount !== 'number' || !Number.isFinite(item.paidAmount) || item.paidAmount < 0 ||
      typeof item.dueAmount !== 'number' || !Number.isFinite(item.dueAmount) || item.dueAmount < 0) errors.push(`Invoice ${String(item.invoiceId)} has invalid payment totals.`);
    if (typeof item.paidAmount === 'number' && typeof item.dueAmount === 'number' &&
      Math.abs(item.paidAmount + item.dueAmount - (item.totalAmount as number)) > 0.01) errors.push(`Invoice ${String(item.invoiceId)} has inconsistent payment totals.`);
    if (!dateIsValid(item.invoiceDate)) errors.push(`Invoice ${String(item.invoiceId)} has an invalid date.`);
    if (!['paid', 'pending', 'partial', 'failed', 'refunded'].includes(String(item.paymentStatus))) errors.push(`Invoice ${String(item.invoiceId)} has an invalid status.`);
  });
  arrays.activityLogs.forEach(item => {
    if (!isRecord(item)) return;
    for (const key of ['customerId', 'serviceId', 'planId', 'accountId', 'profileId', 'subscriptionId', 'saleId', 'paymentId', 'invoiceId']) {
      if (item[key] !== undefined && typeof item[key] !== 'string') {
        errors.push(`History item ${String(item.id)} has an invalid ${key}.`);
      }
    }
    if (!dateIsValid(item.timestamp)) errors.push(`History item ${String(item.id)} has an invalid date.`);
  });
  const document = {
    ...input,
    backupVersion: 1,
    dataVersion: input.dataVersion ?? DATA_VERSION,
    appVersion: typeof input.appVersion === 'string' ? input.appVersion : 'Legacy backup',
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
    records,
  } as unknown as BackupDocument;
  return { valid: errors.length === 0, errors: [...new Set(errors)], ...(errors.length === 0 ? { document } : {}) };
}

export async function verifyBackupIntegrity(input: unknown): Promise<string[]> {
  const checksum = await verifyBackupSha256(input);
  if (checksum === 'invalid') return ['Backup SHA-256 checksum is invalid. The file may be incomplete or modified.'];
  if (checksum === 'missing') {
    const legacyChecksum = verifyBackupChecksum(input);
    if (legacyChecksum === 'invalid') return ['Backup integrity checksum is invalid. The file may be incomplete or modified.'];
  }
  return [];
}

export function toImportJSON(document: BackupDocument): string {
  return JSON.stringify({ ...document, schemaVersion: 1 });
}

export function exportCustomersCSV(
  customers: Customer[],
  sales: Sale[],
  payments: Payment[] = [],
  subscriptions: Subscription[] = [],
  invoices: Invoice[] = [],
  activities: ActivityLog[] = [],
  services: Service[] = [],
  currency: AppCurrency = 'BDT'
): string {
  const metrics = buildCustomerCrmMetrics(
    customers, sales, subscriptions, payments, invoices, activities, services, currency
  );
  return csv(
    ['Customer ID', 'Name', 'Customer Type', 'Phone', 'Email', 'Status', 'Tags', 'Active Subscriptions', 'Total Spent', 'Total Paid', 'Total Due', 'First Purchase', 'Last Purchase', 'Created Date'],
    customers.map(customer => {
      const metric = metrics.get(customer.id);
      return [
        customer.id,
        customer.name,
        customer.customerType ?? 'Customer',
        customer.phone,
        customer.email,
        customer.isArchived ? 'archived' : metric?.status.replace('_', ' ') ?? 'inactive',
        customer.tags?.join('; ') ?? '',
        metric?.activeSubscriptions ?? 0,
        metric?.totalSpent ?? 0,
        metric?.totalPaid ?? 0,
        metric?.totalDue ?? 0,
        metric?.firstPurchase ?? '',
        metric?.lastPurchase ?? '',
        customer.createdAt,
      ];
    })
  );
}

export function exportServicesCSV(services: Service[]): string {
  return csv([
    'Service ID', 'Name', 'Category', 'Status', 'Plan Count', 'Created Date',
    'Description', 'Logo URL', 'Accent Color', 'Icon', 'Internal Code',
    'Default Price', 'Default Price BDT', 'Default Price USD', 'Default Duration', 'Duration Unit', 'Currency',
    'Plan IDs JSON', 'Plan Names JSON', 'Plan Details JSON', 'Service Settings JSON',
    'Invoice Settings JSON', 'Renewal Message JSON', 'Advanced Settings JSON', 'Notes', 'Archived',
    'Updated Date',
  ], services.map(service => [
    service.id,
    service.name,
    service.category,
    service.status,
    service.planDetails?.length ?? service.plans.length,
    service.createdAt,
    service.description,
    service.logoUrl,
    service.color,
    service.iconName,
    service.advanced?.internalCode,
    service.defaultPrice,
    service.defaultPriceBDT,
    service.defaultPriceUSD,
    service.defaultDuration ?? service.defaultDurationDays,
    service.durationUnit,
    service.currency,
    JSON.stringify(service.planIds ?? []),
    JSON.stringify(service.plans ?? []),
    JSON.stringify(service.planDetails ?? []),
    JSON.stringify(service.settings ?? {}),
    JSON.stringify(service.invoiceSettings ?? {}),
    JSON.stringify(service.renewalMessage ?? {}),
    JSON.stringify(service.advanced ?? {}),
    service.notes,
    service.isArchived,
    service.updatedAt,
  ]));
}

export function exportAccountsCSV(accounts: Account[], services: Service[]): string {
  return csv(
    ['Account ID', 'Service', 'Plan', 'Username/email', 'Capacity', 'Used', 'Available', 'Status', 'Expiry'],
    accounts.map(account => {
      const capacity = getAccountCapacity(account);
      return [
        account.id,
        services.find(service => service.id === account.serviceId)?.name,
        account.plan,
        account.username || account.email,
        capacity.capacity,
        capacity.used,
        capacity.available,
        account.status,
        account.expiryDate,
      ];
    })
  );
}

export function exportProfilesCSV(
  accounts: Account[],
  customers: Customer[],
  subscriptions: Subscription[],
  services: Service[]
): string {
  return csv(
    ['Profile ID', 'Account', 'Service', 'Customer', 'Subscription', 'Status', 'Start Date', 'Expiry'],
    accounts.flatMap(account => account.profiles.map(profile => [
      profile.id,
      account.name || account.email,
      services.find(service => service.id === account.serviceId)?.name,
      customers.find(customer => customer.id === profile.assignedCustomerId)?.name,
      subscriptions.find(subscription => subscription.id === profile.subscriptionId)?.id,
      profile.status,
      profile.startDate,
      profile.expiryDate,
    ]))
  );
}

export function exportSubscriptionsCSV(subscriptions: Subscription[], customers: Customer[], services: Service[]): string {
  return csv(['Subscription ID', 'Customer', 'Service', 'Plan', 'Start Date', 'Expiry Date', 'Status', 'Price', 'Payment Status'], subscriptions.map(item =>
    [item.id, customers.find(c => c.id === item.customerId)?.name, services.find(s => s.id === item.serviceId)?.name, item.plan, item.startDate, item.expiryDate, item.status, item.price, item.paymentStatus]
  ));
}

export function exportSalesCSV(
  sales: Sale[],
  customers: Customer[],
  services: Service[],
  invoices: Invoice[],
  payments: Payment[] = [],
  subscriptions: Subscription[] = []
): string {
  return csv([
    'Sale ID', 'Invoice Number', 'Sale Date', 'Customer', 'Phone', 'Service',
    'Plan', 'Subscription ID', 'Subscription Period', 'Total', 'Paid', 'Due',
    'Payment Status', 'Payment Method',
  ], sales.map(sale => {
    const invoice = invoices.find(item => item.saleId === sale.id);
    const customer = customers.find(item => item.id === sale.customerId);
    const saleItems = getSaleLineItems(sale);
    const subscription = subscriptions.find(item => item.id === sale.subscriptionId);
    const linkedPayments = getSalePayments(sale, payments);
    const paymentMethods = [...linkedPayments.reduce((groups, payment) => {
      if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return groups;
      const method = payment.paymentMethodName || payment.paymentMethod;
      groups.set(method, (groups.get(method) || 0) + getPaymentSaleAllocation(payment, sale));
      return groups;
    }, new Map<string, number>())].map(([method, amount]) => `${method}: ${amount}`);
    const status = getSalePaymentStatus(sale, payments);
    return [
      sale.id,
      invoice?.invoiceNumber || sale.invoiceNo,
      sale.date,
      customer?.name,
      customer?.phone || customer?.whatsapp,
      saleItems.map(item => `${services.find(candidate => candidate.id === item.serviceId)?.name || 'Service unavailable'} × ${item.quantity}`).join('; '),
      saleItems.map(item => `${item.plan} × ${item.quantity}`).join('; '),
      saleItems.flatMap(item => item.units.map(unit => unit.subscriptionId)).join('; ') || sale.subscriptionId,
      saleItems.flatMap(item => item.units.map(unit => {
        const unitSubscription = subscriptions.find(candidate => candidate.id === unit.subscriptionId);
        return unitSubscription ? `${unitSubscription.startDate} to ${unitSubscription.expiryDate}` : '';
      })).filter(Boolean).join('; ') || (subscription ? `${subscription.startDate} to ${subscription.expiryDate}` : ''),
      sale.amount,
      getSalePaidAmount(sale, payments),
      getSaleDueAmount(sale, payments),
      status,
      paymentMethods.join(', ') || sale.paymentMethod,
    ];
  }));
}

export function exportPaymentsCSV(
  payments: Payment[],
  customers: Customer[],
  invoices: Invoice[],
  sales: Sale[] = [],
  services: Service[] = []
): string {
  return csv(
    ['Payment ID', 'Date', 'Customer', 'Phone', 'Sale ID', 'Invoice Number', 'Service', 'Plan', 'Method ID', 'Method', 'Category', 'Account Label', 'Amount', 'Status', 'Transaction ID'],
    payments.map(item => {
      const sale = sales.find(candidate => candidate.id === item.saleId)
        || sales.find(candidate => invoices.find(invoice => invoice.invoiceId === item.invoiceId)?.saleId === candidate.id)
        || sales.find(candidate => !item.saleId && item.subscriptionId === candidate.subscriptionId && item.customerId === candidate.customerId);
      const invoice = invoices.find(candidate => candidate.invoiceId === item.invoiceId)
        || (sale ? invoices.find(candidate => candidate.saleId === sale.id) : undefined);
      const customer = customers.find(candidate => candidate.id === item.customerId);
      return [
        item.id,
        item.paymentDate,
        customer?.name,
        customer?.phone,
        sale?.id ?? item.saleId,
        invoice?.invoiceNumber ?? item.invoiceId,
        services.find(service => service.id === sale?.serviceId)?.name,
        sale?.plan,
        item.paymentMethodId,
        item.paymentMethodName || item.paymentMethod,
        item.paymentMethodCategory,
        item.paymentAccount,
        item.amount,
        item.paymentStatus,
        item.transactionId,
      ];
    })
  );
}

export function exportInvoicesCSV(
  invoices: Invoice[],
  customers: Customer[],
  services: Service[],
  sales: Sale[],
  payments: Payment[] = [],
  subscriptions: Subscription[] = []
): string {
  return csv([
    'Invoice ID', 'Invoice Number', 'Invoice Date', 'Customer', 'Phone', 'Email',
    'Service', 'Plan', 'Sale ID', 'Subscription ID', 'Period Start', 'Period End',
    'Subtotal', 'Discount', 'Total', 'Paid', 'Due', 'Payment Methods',
    'Transaction IDs', 'Payment History', 'Status',
  ], invoices.map(invoice => {
    const sale = sales.find(item => item.id === invoice.saleId);
    const customer = customers.find(item => item.id === invoice.customerId || item.id === sale?.customerId);
    const service = services.find(item => item.id === invoice.serviceId || item.id === sale?.serviceId);
    const subscription = subscriptions.find(item => item.id === invoice.subscriptionId || item.id === sale?.subscriptionId);
    const linkedPayments = payments.filter(payment =>
      payment.saleId === invoice.saleId || payment.invoiceId === invoice.invoiceId
    ).sort((left, right) => `${left.paymentDate}|${left.createdAt || ''}`.localeCompare(`${right.paymentDate}|${right.createdAt || ''}`));
    const paid = sale ? getSalePaidAmount(sale, payments) : invoice.paidAmount;
    const due = sale ? getSaleDueAmount(sale, payments) : invoice.dueAmount;
    const paymentMethods = [...new Set(linkedPayments.map(payment => payment.paymentMethod))];
    const transactions = [...new Set(linkedPayments.map(payment => payment.transactionId).filter(Boolean))];
    const paymentHistory = linkedPayments.map(payment =>
      `${payment.paymentDate}: ${payment.paymentMethodName || payment.paymentMethod} ${payment.amount} ${payment.currency} (${payment.paymentStatus})`
    );
    const status = sale ? getInvoiceDisplayStatus(sale, payments) : invoice.paymentStatus;
    return [
      invoice.invoiceId,
      invoice.invoiceNumber,
      invoice.invoiceDate,
      customer?.name,
      customer?.phone || customer?.whatsapp,
      customer?.email,
      service?.name,
      sale?.plan,
      invoice.saleId,
      invoice.subscriptionId || sale?.subscriptionId,
      subscription?.startDate,
      subscription?.expiryDate,
      sale?.subtotal ?? (sale ? sale.amount + (sale.discount || 0) : invoice.totalAmount),
      sale?.discount ?? 0,
      sale?.amount ?? invoice.totalAmount,
      paid,
      due,
      paymentMethods.join(', ') || sale?.paymentMethod,
      transactions.join(', ') || sale?.transactionId,
      paymentHistory.join(' | '),
      status,
    ];
  }));
}

export interface CustomerImportRow {
  row: number;
  customer: Pick<Customer, 'name' | 'customerType' | 'phone' | 'email' | 'notes'>;
  reason?: string;
  duplicate?: { name: string };
}

export function previewCustomerCSV(text: string, customers: Customer[]): CustomerImportRow[] {
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '"') continue;
    if (quoted && text[index + 1] === '"') { index += 1; continue; }
    quoted = !quoted;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  const parsed = parseCSV(text);
  const headers = new Map(parsed.headers.map(header => [header.trim().toLowerCase(), header]));
  const value = (row: Record<string, string>, key: string) => row[headers.get(key) ?? '']?.trim() ?? '';
  const seen: Array<{ name: string; phone: string; email: string }> = [];
  return parsed.rows.map((row, index) => {
    const name = value(row, 'name');
    const phone = value(row, 'phone');
    const email = value(row, 'email');
    const customerTypeValue = value(row, 'customer type').toLowerCase();
    const customerType = customerTypeValue
      ? customerTypeValue === 'customer' ? 'Customer'
        : customerTypeValue === 'reseller' ? 'Reseller'
          : undefined
      : 'Customer';
    const normalizedEmail = email.toLowerCase();
    const existing = customers.find(customer =>
      (phone && customer.phone.replace(/\s/g, '') === phone.replace(/\s/g, '')) ||
      (normalizedEmail && customer.email.toLowerCase() === normalizedEmail)
    );
    const importedDuplicate = seen.find(customer =>
      (phone && customer.phone.replace(/\s/g, '') === phone.replace(/\s/g, '')) ||
      (normalizedEmail && customer.email.toLowerCase() === normalizedEmail)
    );
    let reason: string | undefined;
    if (!name) reason = 'Missing customer name.';
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reason = 'Invalid email format.';
    else if (!customerType) reason = 'Invalid customer type. Use Customer or Reseller.';
    if (name) seen.push({ name, phone, email });
    const duplicate = existing ? { name: existing.name } : importedDuplicate ? { name: importedDuplicate.name } : undefined;
    return { row: index + 2, customer: { name, customerType: customerType || 'Customer', phone, email, notes: value(row, 'notes') }, ...(reason ? { reason } : {}), ...(duplicate ? { duplicate } : {}) };
  });
}

export function inspectBackupIntegrity(input: unknown): { checked: number; issues: string[] } {
  const result = validateBackup(input);
  const records = isRecord(input) && isRecord(input.records) ? input.records : null;
  const checked = records ? [...REQUIRED_COLLECTIONS, ...FINANCIAL_COLLECTIONS, ...OPTIONAL_COLLECTIONS].reduce((total, name) =>
    total + (Array.isArray(records[name]) ? records[name].length : 0), 0) : 0;
  return {
    checked,
    issues: result.errors,
  };
}

export type BackupCollectionCounts = Record<CollectionName | FinancialCollectionName | OptionalCollectionName | 'profiles' | 'plans', number>;
export function getBackupCounts(records: BackupRecords): BackupCollectionCounts {
  const collectionCounts = Object.fromEntries([...REQUIRED_COLLECTIONS, ...FINANCIAL_COLLECTIONS, ...OPTIONAL_COLLECTIONS].map(name => [
    name,
    Array.isArray(records[name]) ? records[name].length : 0,
  ])) as Record<CollectionName | FinancialCollectionName | OptionalCollectionName, number>;
  return {
    ...collectionCounts,
    profiles: (records.accounts || []).reduce<number>((count, item) => count + (
      isRecord(item) && Array.isArray(item.profiles) ? item.profiles.length : 0
    ), 0),
    plans: (records.services || []).reduce<number>((count, item) => count + (
      isRecord(item) && Array.isArray(item.planDetails)
        ? item.planDetails.length
        : isRecord(item) && Array.isArray(item.plans) ? item.plans.length : 0
    ), 0),
  };
}

export interface BackupMergePlan {
  records: BackupRecords;
  added: Record<string, number>;
  duplicatesSkipped: Record<string, number>;
  conflicts: Array<{ collection: string; id: string; reason: string }>;
}

const stableRecordJson = (value: unknown, excludedKeys: Set<string> = new Set()): string => {
  const sortValue = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sortValue);
    if (!isRecord(item)) return item;
    return Object.keys(item).sort().reduce<Record<string, unknown>>((sorted, key) => {
      if (!excludedKeys.has(key)) sorted[key] = sortValue(item[key]);
      return sorted;
    }, {});
  };
  return JSON.stringify(sortValue(value));
};

const mergeIdentityKey = (collection: string, item: unknown): string | undefined => {
  if (!isRecord(item)) return undefined;
  if (collection === 'sales' && typeof item.invoiceNo === 'string' && item.invoiceNo.trim()) {
    return `invoice:${item.invoiceNo.trim().toLocaleLowerCase()}`;
  }
  if (collection === 'invoices' && typeof item.invoiceNumber === 'string' && item.invoiceNumber.trim()) {
    return `invoice:${item.invoiceNumber.trim().toLocaleLowerCase()}`;
  }
  if (collection === 'payments') {
    if (typeof item.operationId === 'string' && item.operationId.trim()) return `operation:${item.operationId.trim()}`;
    if (item.paymentStatus === 'refunded' && typeof item.refundOfPaymentId === 'string') {
      return `refund:${stableRecordJson({
        refundOfPaymentId: item.refundOfPaymentId,
        paymentDate: item.paymentDate,
        amount: item.amount,
        currency: item.currency,
        allocations: item.refundedSaleAllocations,
      })}`;
    }
  }
  return undefined;
};

export function planBackupMerge(current: Record<string, unknown[]>, incoming: Record<string, unknown[]>): BackupMergePlan {
  const collectionNames = [...REQUIRED_COLLECTIONS, ...FINANCIAL_COLLECTIONS, ...OPTIONAL_COLLECTIONS];
  const added: Record<string, number> = {};
  const duplicatesSkipped: Record<string, number> = {};
  const conflicts: BackupMergePlan['conflicts'] = [];
  const mergedRecords = {} as BackupRecords;
  const ignoredMetadata = new Set(['createdAt', 'updatedAt', 'businessId']);
  const incomingIdKey = (collection: string) => collection === 'invoices' ? 'invoiceId' : 'id';

  collectionNames.forEach(collection => {
    const existing = Array.isArray(current[collection]) ? [...current[collection]] : [];
    const incomingRecords = Array.isArray(incoming[collection]) ? incoming[collection] : [];
    const byId = new Map(existing.map(item => [recordId(item, incomingIdKey(collection)), item]).filter(
      (entry): entry is [string, unknown] => Boolean(entry[0])
    ));
    const bySemantic = new Map<string, unknown[]>();
    existing.forEach(item => {
      const semanticKey = mergeIdentityKey(collection, item);
      if (semanticKey) bySemantic.set(semanticKey, [...(bySemantic.get(semanticKey) || []), item]);
    });
    let addedCount = 0;
    let duplicateCount = 0;

    incomingRecords.forEach(item => {
      const id = recordId(item, incomingIdKey(collection));
      if (!id) {
        conflicts.push({ collection, id: 'unknown', reason: 'Missing stable record ID.' });
        return;
      }
      const sameId = byId.get(id);
      if (sameId !== undefined) {
        if (stableRecordJson(sameId, ignoredMetadata) === stableRecordJson(item, ignoredMetadata)) {
          duplicateCount += 1;
        } else {
          conflicts.push({ collection, id, reason: 'The same ID has different stored data; the existing record was kept.' });
        }
        return;
      }
      const semanticKey = mergeIdentityKey(collection, item);
      const semanticMatch = semanticKey ? bySemantic.get(semanticKey)?.[0] : undefined;
      if (semanticMatch !== undefined) {
        if (stableRecordJson(semanticMatch, new Set([...ignoredMetadata, 'id', 'invoiceId']))
          === stableRecordJson(item, new Set([...ignoredMetadata, 'id', 'invoiceId']))) {
          duplicateCount += 1;
        } else {
          conflicts.push({ collection, id, reason: 'A transaction with the same invoice or operation reference differs; it was not imported.' });
        }
        return;
      }
      existing.push(item);
      byId.set(id, item);
      if (semanticKey) bySemantic.set(semanticKey, [...(bySemantic.get(semanticKey) || []), item]);
      addedCount += 1;
    });

    mergedRecords[collection as CollectionName] = existing;
    added[collection] = addedCount;
    duplicatesSkipped[collection] = duplicateCount;
  });

  return { records: mergedRecords, added, duplicatesSkipped, conflicts };
}
