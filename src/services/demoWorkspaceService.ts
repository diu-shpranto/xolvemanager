import { initialSettings } from '../data/mockData';
import type { DemoDataSnapshot } from './demoDataService';
import {
  buildDemoData,
  DEMO_BUSINESS_NAME as DEMO_STORE_NAME,
  discoverDemoDataManifest,
  getDemoDataManifestKey,
  isValidDemoDataManifest,
  manifestHasDemoData,
} from './demoDataService';
import {
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
  getActiveDataEnvironment,
  readRawValue,
  replaceRawValuesAtomically,
  STORAGE_KEYS,
} from './localStorageStore';

export const DEMO_BUSINESS_ID = 'xvm_demo_business';
export const DEMO_BUSINESS_NAME = DEMO_STORE_NAME;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const LEGACY_DEMO_BUSINESS_NAMES = new Set([
  'XolveManager Demo',
  'ShopiQue Prime',
  'ShopiQue Prime Store',
]);

const getDemoSnapshot = (): DemoDataSnapshot => ({
  customers: getCustomers(),
  services: getServices(),
  accounts: getAccounts(),
  subscriptions: getSubscriptions(),
  sales: getSales(),
  orders: getOrders(),
  payments: getPayments(),
  invoices: getInvoices(),
  financialAccounts: getFinancialAccounts(),
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
  settings: { ...initialSettings, ...(getSettings() || {}) },
});

export const initializeDemoWorkspace = (): void => {
  if (getActiveDataEnvironment() !== 'demo') {
    throw new Error('Demo data can only be initialized in Demo Mode.');
  }

  const current = getDemoSnapshot();
  const savedBusiness = readRawValue(STORAGE_KEYS.BUSINESS);
  const migrateLegacyDemoName = (): void => {
    if (savedBusiness === null) return;

    let parsedBusiness: unknown;
    try {
      parsedBusiness = JSON.parse(savedBusiness);
    } catch (error) {
      console.error('The saved Demo business profile is invalid.', error);
      throw new Error('Demo data could not be initialized because the saved Demo business profile is invalid.');
    }
    if (!isRecord(parsedBusiness)) {
      throw new Error('Demo data could not be initialized because the saved Demo business profile is invalid.');
    }
    if (typeof parsedBusiness.name !== 'string'
      || !LEGACY_DEMO_BUSINESS_NAMES.has(parsedBusiness.name.trim())) return;

    const savedSettings = readRawValue(STORAGE_KEYS.SETTINGS);
    let parsedSettings: Record<string, unknown> = {};
    if (savedSettings !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(savedSettings);
      } catch (error) {
        console.error('The saved Demo settings are invalid.', error);
        throw new Error('Demo data could not be initialized because the saved Demo settings are invalid.');
      }
      if (!isRecord(parsed)) {
        throw new Error('Demo data could not be initialized because the saved Demo settings are invalid.');
      }
      parsedSettings = parsed;
    }
    replaceRawValuesAtomically({
      [STORAGE_KEYS.BUSINESS]: JSON.stringify({
        ...parsedBusiness,
        businessId: DEMO_BUSINESS_ID,
        name: DEMO_BUSINESS_NAME,
      }),
      [STORAGE_KEYS.SETTINGS]: JSON.stringify({
        ...parsedSettings,
        storeName: DEMO_BUSINESS_NAME,
      }),
    });
  };
  const hasExistingBusinessRecords = Object.entries(current)
    .some(([key, value]) => !['settings', 'activityLogs', 'notifications'].includes(key)
      && Array.isArray(value) && value.length > 0);
  const manifestKey = getDemoDataManifestKey(DEMO_BUSINESS_ID);
  const savedManifest = readRawValue(manifestKey);
  if (savedManifest !== null) {
    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(savedManifest);
    } catch (error) {
      console.error('The saved demo data manifest is invalid.', error);
      throw new Error('Demo data could not be verified. Existing demo records were left unchanged.');
    }
    if (!isValidDemoDataManifest(parsedManifest) || parsedManifest.businessId !== DEMO_BUSINESS_ID) {
      throw new Error('Demo data could not be verified. Existing demo records were left unchanged.');
    }
    if (manifestHasDemoData(parsedManifest) && hasExistingBusinessRecords) {
      migrateLegacyDemoName();
      return;
    }
  }

  if (hasExistingBusinessRecords) {
    const recoveredManifest = discoverDemoDataManifest(current, DEMO_BUSINESS_ID);
    if (savedManifest === null && manifestHasDemoData(recoveredManifest)) {
      replaceRawValuesAtomically({
        [manifestKey]: JSON.stringify(recoveredManifest),
      });
    }
    migrateLegacyDemoName();
    return;
  }

  let business: Record<string, unknown> = {
    businessId: DEMO_BUSINESS_ID,
    name: DEMO_BUSINESS_NAME,
    ownerId: 'xvm_demo_owner',
    createdAt: new Date().toISOString(),
  };
  if (savedBusiness !== null) {
    let parsedBusiness: unknown;
    try {
      parsedBusiness = JSON.parse(savedBusiness);
    } catch (error) {
      console.error('The saved Demo business profile is invalid.', error);
      throw new Error('Demo data could not be initialized because the saved Demo business profile is invalid.');
    }
    if (!isRecord(parsedBusiness)) {
      throw new Error('Demo data could not be initialized because the saved Demo business profile is invalid.');
    }
    business = {
      ...parsedBusiness,
      businessId: DEMO_BUSINESS_ID,
      name: typeof parsedBusiness.name === 'string'
        && LEGACY_DEMO_BUSINESS_NAMES.has(parsedBusiness.name.trim())
        ? DEMO_BUSINESS_NAME
        : parsedBusiness.name,
    };
  }

  const { snapshot, manifest } = buildDemoData(current, DEMO_BUSINESS_ID);
  const records: Record<string, string | null> = {
    [STORAGE_KEYS.BUSINESS]: JSON.stringify(business),
    [STORAGE_KEYS.CUSTOMERS]: JSON.stringify(snapshot.customers),
    [STORAGE_KEYS.SERVICES]: JSON.stringify(snapshot.services),
    [STORAGE_KEYS.ACCOUNTS]: JSON.stringify(snapshot.accounts),
    [STORAGE_KEYS.SUBSCRIPTIONS]: JSON.stringify(snapshot.subscriptions),
    [STORAGE_KEYS.SALES]: JSON.stringify(snapshot.sales),
    [STORAGE_KEYS.ORDERS]: JSON.stringify(snapshot.orders),
    [STORAGE_KEYS.INVOICES]: JSON.stringify(snapshot.invoices),
    [STORAGE_KEYS.PAYMENTS]: JSON.stringify(snapshot.payments),
    [STORAGE_KEYS.LOGS]: JSON.stringify(snapshot.activityLogs),
    [STORAGE_KEYS.SETTINGS]: JSON.stringify(snapshot.settings),
    [STORAGE_KEYS.NOTIFICATIONS]: JSON.stringify(snapshot.notifications),
    [STORAGE_KEYS.FINANCIAL_ACCOUNTS]: JSON.stringify(snapshot.financialAccounts),
    [STORAGE_KEYS.EXPENSES]: JSON.stringify(snapshot.expenses),
    [STORAGE_KEYS.OTHER_INCOME]: JSON.stringify(snapshot.otherIncome),
    [STORAGE_KEYS.FINANCIAL_TRANSFERS]: JSON.stringify(snapshot.financialTransfers),
    [STORAGE_KEYS.FINANCIAL_ADJUSTMENTS]: JSON.stringify(snapshot.financialAdjustments),
    [STORAGE_KEYS.DAILY_CLOSINGS]: JSON.stringify(snapshot.dailyClosings),
    [STORAGE_KEYS.FINANCIAL_RECONCILIATIONS]: JSON.stringify(snapshot.financialReconciliations),
    [STORAGE_KEYS.FINANCIAL_PERIODS]: JSON.stringify(snapshot.financialPeriods),
    [STORAGE_KEYS.REMINDERS]: JSON.stringify(snapshot.reminders),
    [STORAGE_KEYS.PROFITABILITY_COSTS]: JSON.stringify(snapshot.profitabilityCosts),
    [manifestKey]: JSON.stringify(manifest),
  };
  replaceRawValuesAtomically(records);
};
