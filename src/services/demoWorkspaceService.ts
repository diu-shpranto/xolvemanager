import { initialSettings } from '../data/mockData';
import type { DemoDataSnapshot } from './demoDataService';
import {
  buildDemoData,
  getDemoDataManifestKey,
  isValidDemoDataManifest,
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
  getOtherIncome,
  getPayments,
  getProfitabilityCosts,
  getReminders,
  getSales,
  getServices,
  getSettings,
  getSubscriptions,
  readRawValue,
  replaceRawValuesAtomically,
  STORAGE_KEYS,
} from './localStorageStore';

export const DEMO_BUSINESS_ID = 'xvm_demo_business';
export const DEMO_BUSINESS_NAME = 'XolveManager Demo';

const getDemoSnapshot = (): DemoDataSnapshot => ({
  customers: getCustomers(),
  services: getServices(),
  accounts: getAccounts(),
  subscriptions: getSubscriptions(),
  sales: getSales(),
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
    return;
  }

  const current = getDemoSnapshot();
  const hasExistingRecords = Object.entries(current)
    .some(([key, value]) => key !== 'settings' && Array.isArray(value) && value.length > 0);
  if (hasExistingRecords || readRawValue(STORAGE_KEYS.BUSINESS) !== null) {
    throw new Error('The demo workspace contains data without a valid manifest. Existing records were left unchanged.');
  }

  const business = {
    businessId: DEMO_BUSINESS_ID,
    name: DEMO_BUSINESS_NAME,
    ownerId: 'xvm_demo_owner',
    createdAt: new Date().toISOString(),
  };
  const { snapshot, manifest } = buildDemoData(current, DEMO_BUSINESS_ID);
  const records: Record<string, string | null> = {
    [STORAGE_KEYS.BUSINESS]: JSON.stringify(business),
    [STORAGE_KEYS.CUSTOMERS]: JSON.stringify(snapshot.customers),
    [STORAGE_KEYS.SERVICES]: JSON.stringify(snapshot.services),
    [STORAGE_KEYS.ACCOUNTS]: JSON.stringify(snapshot.accounts),
    [STORAGE_KEYS.SUBSCRIPTIONS]: JSON.stringify(snapshot.subscriptions),
    [STORAGE_KEYS.SALES]: JSON.stringify(snapshot.sales),
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
