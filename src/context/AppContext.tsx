import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import {
  Customer,
  Service,
  Account,
  AccountProfile,
  Subscription,
  Sale,
  Invoice,
  Payment,
  ActivityLog,
  AppSettings,
  BusinessNotification,
  PaymentMethod,
  PaymentStatus,
  Language,
  AppCurrency,
  ServicePlan,
  CustomerNote,
  FinancialAccount,
  Expense,
  OtherIncome,
  FinancialTransfer,
  FinancialAdjustment,
  DailyClosing,
  FinancialPeriod,
  FinancialReconciliation,
  Reminder,
  ReminderStatus,
  ProfitabilityCost,
} from '../types';
import {
  initialCustomers,
  initialServices,
  initialAccounts,
  initialSubscriptions,
  initialSales,
  initialPayments,
  initialActivityLogs,
  initialSettings,
} from '../data/mockData';
import {
  calculateExpiryDate,
  getDaysDifference,
  formatCurrency,
  getTodayDateString,
  getDateInTimeZone,
  getSubscriptionStatus,
  generateInvoiceNo,
} from '../utils/dateUtils';
import { getCustomerDisplayName } from '../utils/relationships';
import { getSalePaidAmount } from '../utils/saleUtils';
import { calculateTotalRevenue, convertReportCurrency } from '../utils/reportMetrics';
import { normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../utils/paymentMethods';
import { getAccountBalance, getDailyFinancialSummary, getFinancialLedger } from '../utils/financialLedger';
import { getAccountingLedgerBalance, runFinancialIntegrityCheck } from '../utils/accountingControls';
import { runDataIntegrityCheck } from '../utils/dataIntegrity';
import { createInvoiceRecord } from '../utils/invoiceUtils';
import { translations, TranslationKey } from '../i18n/translations';
import { DEFAULT_INVOICE_BUSINESS_NAME } from '../config/brand';
import {
  clearBusinessName as clearStoredBusinessName,
  createRestoredBusinessRecord,
  getBusinessName,
  getCurrentBusiness,
  setBusinessName as saveBusinessName,
  type CurrentBusiness,
} from '../services/businessStore';
import {
  createRecordId,
  getStorageWarnings,
  getAccounts,
  getCustomers,
  getHistory,
  getFinancialAccounts,
  getExpenses,
  getOtherIncome,
  getFinancialTransfers,
  getFinancialAdjustments,
  getDailyClosings,
  getFinancialPeriods,
  getFinancialReconciliations,
  getReminders,
  getProfitabilityCosts,
  getInvoices,
  getPayments,
  getSales,
  getServices,
  getSettings,
  getSubscriptions,
  readRawValue,
  saveAccounts,
  saveCustomers,
  saveHistory,
  saveFinancialAccounts,
  saveExpenses,
  saveOtherIncome,
  saveFinancialTransfers,
  saveFinancialAdjustments,
  saveDailyClosings,
  saveFinancialPeriods,
  saveFinancialReconciliations,
  saveReminders,
  saveProfitabilityCosts,
  saveInvoices,
  savePayments,
  saveSales,
  saveServices,
  saveSettings,
  getNotifications,
  saveNotifications,
  isBusinessNotification,
  saveSubscriptions,
  STORAGE_KEYS,
  replaceRawValuesAtomically,
  writeRawValue,
} from '../services/localStorageStore';
import {
  createNotification,
  generateSystemNotifications,
  getLiveNotifications,
  getUnreadNotifications,
  isNotificationEnabled,
  reconcileSystemNotifications,
  type NewNotification,
} from '../services/notificationService';
import { createAuditLog, getActivityCategory, sanitizeActivityDescription } from '../services/activityService';
import { getAccountCapacity, isAccountOperational, isSubscriptionCompatibleWithResource } from '../utils/resourceManagement';
import {
  generateReminderCandidates,
  getResolvedReminderSourceKeys,
  getReminderPreferences,
  reconcileReminderCandidates,
  sanitizeReminderText,
  type ReminderCandidate,
} from '../services/reminderEngine';

export interface NewSalePayload {
  customerId: string;
  serviceId: string;
  plan: string;
  planId?: string;
  accountId?: string;
  profileId?: string;
  startDate: string;
  durationDays: number;
  subtotal?: number;
  discount?: number;
  price: number;
  amountPaid?: number;
  paymentNote?: string;
  currency: AppCurrency;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  senderNumber?: string;
  notes?: string;
  renewalOfSubscriptionId?: string;
  operationId?: string;
}

export interface CurrentAdminUser {
  uid: string;
  email: string;
  name: string;
  photoURL?: string | null;
  role: 'super_admin' | 'admin' | 'owner';
  businessId?: string | null;
}

interface AppContextType {
  currentUser: CurrentAdminUser | null;
  currentBusiness: CurrentBusiness | null;
  currentBusinessName: string;
  getBusinessName: () => string;
  setBusinessName: (name: string) => void;
  clearBusinessName: () => void;
  createBusiness: (name: string) => Promise<CurrentBusiness>;

  // Language & i18n
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;

  // Currency
  currency: AppCurrency;
  setCurrency: (cur: AppCurrency) => void;

  // Dark Mode
  isDark: boolean;
  toggleDarkMode: () => void;

  // Data
  customers: Customer[];
  services: Service[];
  accounts: Account[];
  subscriptions: Subscription[];
  sales: Sale[];
  invoices: Invoice[];
  payments: Payment[];
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
  settings: AppSettings;
  notifications: BusinessNotification[];
  unreadNotificationCount: number;
  storageWarning: string | null;

  // Actions - Customers
  customersLoading: boolean;
  customersError: string | null;
  addCustomer: (cust: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  addCustomerNote: (customerId: string, text: string) => CustomerNote;
  updateCustomerNote: (customerId: string, noteId: string, text: string) => void;
  deleteCustomerNote: (customerId: string, noteId: string) => void;
  deleteCustomer: (id: string, forcePermanent?: boolean) => Promise<void>;
  archiveCustomer: (id: string) => Promise<void>;
  restoreCustomer: (id: string) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;

  // Actions - Services
  servicesLoading: boolean;
  servicesError: string | null;
  addService: (srv: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Service>;
  updateService: (id: string, updates: Partial<Service>) => Promise<void>;
  deleteService: (id: string, forcePermanent?: boolean) => Promise<void>;
  archiveService: (id: string) => Promise<void>;
  restoreService: (id: string) => Promise<void>;
  getServiceById: (id: string) => Service | undefined;

  // Actions - Accounts & Profiles
  addAccount: (acc: Omit<Account, 'id' | 'profiles'> & { profiles?: AccountProfile[] }) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  getAccountById: (id: string) => Account | undefined;
  addProfileToAccount: (accountId: string, profileName: string, pin?: string, details?: Pick<AccountProfile, 'startDate' | 'expiryDate' | 'notes'>) => void;
  updateProfile: (accountId: string, profileId: string, updates: Partial<AccountProfile>) => void;
  deleteProfile: (accountId: string, profileId: string) => void;
  assignCustomerToProfile: (accountId: string, profileId: string, customerId?: string, pin?: string, subscriptionId?: string) => void;

  // Actions - Subscriptions
  addSubscription: (sub: Omit<Subscription, 'id' | 'createdAt' | 'expiryDate'> & { expiryDate?: string }) => Subscription;
  updateSubscription: (id: string, updates: Partial<Subscription>, recordActivity?: boolean) => void;
  deleteSubscription: (id: string) => void;
  renewSubscription: (subscriptionId: string, additionalDays: number, price: number, paymentMethod: PaymentMethod, transactionId?: string) => void;

  // Actions - Sales Workflow
  createSale: (payload: NewSalePayload) => { subscription: Subscription; sale: Sale; payment: Payment; invoice: Invoice };
  deleteSale: (id: string) => void;
  recordSalePayment: (
    saleId: string,
    payment: Omit<Payment, 'id' | 'saleId' | 'subscriptionId'> & { operationId?: string }
  ) => Payment;
  ensureInvoiceForSale: (saleId: string) => Invoice;

  // Actions - Payments
  addPayment: (payment: Omit<Payment, 'id'>) => Payment;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => void;

  // Financial ledger
  addFinancialAccount: (account: Omit<FinancialAccount, 'id' | 'createdAt' | 'updatedAt'>) => FinancialAccount;
  updateFinancialAccount: (id: string, updates: Partial<FinancialAccount>) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  addProfitabilityCost: (cost: Omit<ProfitabilityCost, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>) => ProfitabilityCost;
  updateProfitabilityCost: (id: string, updates: Partial<Omit<ProfitabilityCost, 'id' | 'businessId' | 'createdAt'>>) => void;
  deleteProfitabilityCost: (id: string) => void;
  addOtherIncome: (income: Omit<OtherIncome, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => OtherIncome;
  addFinancialTransfer: (transfer: Omit<FinancialTransfer, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => FinancialTransfer;
  addFinancialAdjustment: (adjustment: Omit<FinancialAdjustment, 'id' | 'createdAt'>) => FinancialAdjustment;
  closeFinancialDay: (date: string, actualBalances: Record<string, number>, reason: string, createAdjustments: boolean) => DailyClosing;
  addFinancialReconciliation: (input: Omit<FinancialReconciliation, 'id' | 'businessId' | 'createdAt' | 'systemBalance' | 'difference' | 'status'>) => FinancialReconciliation;
  closeFinancialPeriod: (startDate: string, endDate: string, note: string) => FinancialPeriod;
  reopenFinancialPeriod: (periodId: string, reason: string) => void;
  completeReminder: (reminderId: string) => void;
  snoozeReminder: (reminderId: string, until: string) => void;
  dismissReminder: (reminderId: string) => void;
  reopenReminder: (reminderId: string) => void;
  createManualReminder: (reminder: Omit<ReminderCandidate, 'businessId' | 'deterministicKey' | 'systemGenerated'>) => Reminder;
  refreshReminders: () => void;
  reopenFinancialDay: (date: string) => void;
  isFinancialDateClosed: (date: string) => boolean;

  // Actions - Activity Logs
  logActivity: (log: Omit<ActivityLog, 'id' | 'timestamp' | 'createdAt' | 'businessId' | 'createdBy'>) => void;
  clearActivityLogs: () => void;
  addNotification: (notification: NewNotification) => BusinessNotification;
  markNotificationAsRead: (notificationId: string, read?: boolean) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  getNotificationCount: (unreadOnly?: boolean) => number;
  getUnreadNotifications: () => BusinessNotification[];

  // Settings & Storage
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetToSampleData: () => void;
  clearBusinessData: () => void;
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => boolean;

  // Computed Metrics
  stats: {
    totalCustomers: number;
    activeCount: number;
    expiringSoonCount: number;
    expiredCount: number;
    totalRevenue: number;
    totalAccounts: number;
    totalServices: number;
    activeServices: number;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const normalizeRecordIdentity = <T extends { id: string; businessId?: string }>(
  records: T[],
  prefix: string,
  businessId?: string
): T[] => {
  const usedIds = new Set<string>();
  return records.map(record => {
    const id = typeof record.id === 'string' && record.id.trim() && !usedIds.has(record.id)
      ? record.id
      : createRecordId(prefix);
    usedIds.add(id);
    return {
      ...record,
      id,
      ...(businessId ? { businessId } : {}),
    };
  });
};

const getStablePlanIds = (
  plans: string[],
  previousPlans: string[] = [],
  previousPlanIds: string[] = []
): string[] => {
  const usedIds = new Set<string>();
  return plans.map((plan, index) => {
    const samePositionId = previousPlans[index] === plan ? previousPlanIds[index] : undefined;
    const matchingIndex = previousPlans.findIndex(
      (previousPlan, previousIndex) => previousPlan === plan && !usedIds.has(previousPlanIds[previousIndex])
    );
    const id = samePositionId && !usedIds.has(samePositionId)
      ? samePositionId
      : (matchingIndex >= 0 ? previousPlanIds[matchingIndex] : undefined) || createRecordId('plan');
    usedIds.add(id);
    return id;
  });
};

const normalizeServices = (services: Service[], businessId?: string): Service[] =>
  normalizeRecordIdentity(services, 'service', businessId).map(service => {
    const plans = Array.isArray(service.plans)
      ? service.plans.filter((plan): plan is string => typeof plan === 'string')
      : [];
    const existingPlanIds = Array.isArray(service.planIds) ? service.planIds : [];
    const planIds = getStablePlanIds(plans, plans, existingPlanIds);
    const existingPlanDetails = Array.isArray(service.planDetails) ? service.planDetails : [];
    const planDetails: ServicePlan[] = plans.map((name, index) => {
      const existing = existingPlanDetails.find(plan => plan.id === planIds[index])
        || existingPlanDetails.find(plan => plan.name === name);
      return existing
        ? { ...existing, id: planIds[index], name }
        : {
            id: planIds[index],
            name,
            price: Number(service.defaultPrice) || 0,
            currency: service.currency || 'BDT',
            durationDays: Number(service.defaultDurationDays) || 30,
            status: 'active',
          };
    });
    return { ...service, plans, planIds, planDetails };
  });

const normalizeAccounts = (accounts: Account[], businessId?: string): Account[] => {
  const usedProfileIds = new Set<string>();
  return normalizeRecordIdentity(accounts, 'account', businessId).map(account => {
    const profiles = Array.isArray(account.profiles)
      ? account.profiles.filter(
        (profile): profile is AccountProfile =>
          typeof profile === 'object' && profile !== null && !Array.isArray(profile) &&
          typeof profile.profileName === 'string'
      )
      : [];
    return {
      ...account,
      profiles: profiles.map(profile => {
        const id = typeof profile.id === 'string' && profile.id.trim() && !usedProfileIds.has(profile.id)
          ? profile.id
          : createRecordId('profile');
        usedProfileIds.add(id);
        return {
          ...profile,
          id,
          accountId: account.id,
          ...(businessId ? { businessId } : {}),
        };
      }),
    };
  });
};

const normalizeBusinessData = (
  customers: Customer[],
  services: Service[],
  accounts: Account[],
  subscriptions: Subscription[],
  sales: Sale[],
  payments: Payment[],
  activityLogs: ActivityLog[],
  businessId?: string
) => {
  const normalizedServices = normalizeServices(services, businessId);
  const normalizedAccounts = normalizeAccounts(accounts, businessId);
  const planIdFor = (serviceId: string, planName: string): string | undefined => {
    const service = normalizedServices.find(item => item.id === serviceId);
    const planIndex = service?.plans.indexOf(planName) ?? -1;
    return planIndex >= 0 ? service?.planIds?.[planIndex] : undefined;
  };

  return {
    customers: normalizeRecordIdentity(customers, 'customer', businessId),
    services: normalizedServices,
    accounts: normalizedAccounts.map(account => ({
      ...account,
      planId: planIdFor(account.serviceId, account.plan) || account.planId,
    })),
    subscriptions: normalizeRecordIdentity(subscriptions, 'subscription', businessId).map(subscription => ({
      ...subscription,
      planId: planIdFor(subscription.serviceId, subscription.plan) || subscription.planId,
    })),
    sales: normalizeRecordIdentity(sales, 'sale', businessId).map(sale => ({
      ...sale,
      planId: planIdFor(sale.serviceId, sale.plan) || sale.planId,
    })),
    payments: normalizeRecordIdentity(payments, 'payment', businessId),
    activityLogs: normalizeRecordIdentity(activityLogs, 'activity', businessId),
  };
};

const withBusinessId = <T extends { businessId?: string }>(records: T[], businessId: string): T[] =>
  records.map(record => ({
    ...record,
    businessId,
  }));

const normalizeLegacyBranding = (
  settings: Partial<AppSettings>,
  businessName = initialSettings.storeName
): AppSettings => {
  const hasLegacyBrand = (value?: string) => value?.toLowerCase().includes('shopique') ?? false;

  return {
    ...initialSettings,
    ...settings,
    storeName: hasLegacyBrand(settings.storeName) ? businessName : settings.storeName || initialSettings.storeName,
    tagline: settings.tagline?.toLowerCase().includes('premium digital subscriptions')
      ? ''
      : settings.tagline ?? '',
    adminName: hasLegacyBrand(settings.adminName) ? 'Demo User' : settings.adminName || initialSettings.adminName,
    adminEmail: hasLegacyBrand(settings.adminEmail) ? 'demo@example.com' : settings.adminEmail || initialSettings.adminEmail,
    facebookPageUrl: hasLegacyBrand(settings.facebookPageUrl) ? '' : settings.facebookPageUrl || '',
    whatsappReminderTemplateEN: settings.whatsappReminderTemplateEN?.replaceAll('ShopiQue Prime', '{store_name}')
      ?? initialSettings.whatsappReminderTemplateEN,
    whatsappReminderTemplateBN: settings.whatsappReminderTemplateBN
      ?.replaceAll('শপিক প্রাইম স্টোর (ShopiQue Prime Store)', '{store_name}')
      .replaceAll('শপিক প্রাইম স্টোর টিম', '{store_name}')
      ?? initialSettings.whatsappReminderTemplateBN,
  };
};

const normalizeLegacyActivityLogs = (
  logs: ActivityLog[],
  businessName = initialSettings.storeName,
  accounts: Account[] = []
): ActivityLog[] => {
  const credentialValues = accounts.flatMap(account => [
    account.email,
    account.username || '',
    account.password,
    ...account.profiles.map(profile => profile.pin || ''),
  ]);
  return logs.map(log => {
    const description = sanitizeActivityDescription(
      log.description.replaceAll('ShopiQue Prime Store', businessName),
      credentialValues
    );
    return {
      ...log,
      description: getActivityCategory(log) === 'accounts'
        ? description.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
        : description,
      ...(log.metadata ? {
        metadata: Object.fromEntries(Object.entries(log.metadata)
          .filter(([key]) => !/password|passcode|pin|api.?key|secret|credential|token/i.test(key))
          .map(([key, value]) => [key, typeof value === 'string'
            ? sanitizeActivityDescription(value, credentialValues)
            : value])),
      } : {}),
    };
  });
};

const normalizeInvoices = (
  storedInvoices: Invoice[],
  sales: Sale[],
  payments: Payment[],
  businessId?: string
): Invoice[] => {
  const usedIds = new Set<string>();
  const linkedSaleIds = new Set<string>();
  const invoices = storedInvoices
    .filter(invoice => {
      if (linkedSaleIds.has(invoice.saleId)) return false;
      linkedSaleIds.add(invoice.saleId);
      return true;
    })
    .map(invoice => {
      const invoiceId = invoice.invoiceId && !usedIds.has(invoice.invoiceId)
        ? invoice.invoiceId
        : createRecordId('invoice');
      usedIds.add(invoiceId);
      return {
        ...invoice,
        invoiceId,
        ...(businessId ? { businessId } : {}),
      };
    });

  sales.forEach(sale => {
    if (linkedSaleIds.has(sale.id)) return;
    const invoiceId = `invoice-${sale.id}`;
    const invoice = createInvoiceRecord(sale, payments, undefined, businessId, usedIds.has(invoiceId) ? undefined : invoiceId);
    usedIds.add(invoice.invoiceId);
    linkedSaleIds.add(sale.id);
    invoices.push({ ...invoice, creationLogPending: true });
  });

  return invoices;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = readRawValue(STORAGE_KEYS.THEME);
    if (saved !== null) return saved === 'true';
    return false;
  });

  useEffect(() => {
    try {
      writeRawValue(STORAGE_KEYS.THEME, String(isDark));
    } catch (error) {
      console.error('Could not persist the theme preference.', error);
    }
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleDarkMode = () => setIsDark(previous => {
    const next = !previous;
    setSettings(current => ({
      ...current,
      appearance: { ...current.appearance, theme: next ? 'dark' : 'light' },
    }));
    return next;
  });

  // Language state
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = readRawValue(STORAGE_KEYS.LANG);
    return saved === 'bn' ? 'bn' : 'en';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.setAttribute('data-lang', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      writeRawValue(STORAGE_KEYS.LANG, lang);
    } catch (error) {
      console.error('Could not persist the language preference.', error);
    }
  };

  // Translation helper
  const t = (key: TranslationKey): string => {
    const langDict = translations[language] || translations.en;
    return langDict[key] || translations.en[key] || key;
  };

  // Global Currency state (BDT by default for Bangladeshi market)
  const [currency, setCurrencyState] = useState<AppCurrency>(() => {
    const saved = readRawValue(STORAGE_KEYS.CURRENCY);
    return saved === 'USD' ? 'USD' : 'BDT';
  });

  const setCurrency = (cur: AppCurrency) => {
    setCurrencyState(cur);
    try {
      writeRawValue(STORAGE_KEYS.CURRENCY, cur);
    } catch (error) {
      console.error('Could not persist the currency preference.', error);
    }
  };

  // Auth State
  const [currentBusinessName, setCurrentBusinessName] = useState<string>(() => getBusinessName());
  const [currentBusiness, setCurrentBusiness] = useState<CurrentBusiness | null>(() => getCurrentBusiness());
  const currentUser = useMemo<CurrentAdminUser | null>(() => ({
    uid: 'local-user',
    email: '',
    name: 'Business Owner',
    role: 'owner',
    businessId: currentBusiness?.businessId,
  }), [currentBusiness]);
  const customersLoading = false;
  const customersError: string | null = null;
  const servicesLoading = false;
  const servicesError: string | null = null;

  // Data States
  const [initialBusinessData] = useState(() =>
    normalizeBusinessData(
      getCustomers(),
      getServices(),
      getAccounts(),
      getSubscriptions(),
      getSales(),
      getPayments(),
      getHistory(),
      currentBusiness?.businessId
    )
  );
  const [customers, setCustomers] = useState<Customer[]>(() => {
    return initialBusinessData.customers;
  });

  const [services, setServices] = useState<Service[]>(() => {
    return initialBusinessData.services;
  });

  const [accounts, setAccounts] = useState<Account[]>(() => {
    return initialBusinessData.accounts;
  });

  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    return initialBusinessData.subscriptions;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    return initialBusinessData.sales;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    return initialBusinessData.payments;
  });
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>(() =>
    getFinancialAccounts().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    getExpenses().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const [otherIncome, setOtherIncome] = useState<OtherIncome[]>(() =>
    getOtherIncome().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const [financialTransfers, setFinancialTransfers] = useState<FinancialTransfer[]>(() =>
    getFinancialTransfers().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const [financialAdjustments, setFinancialAdjustments] = useState<FinancialAdjustment[]>(() =>
    getFinancialAdjustments().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>(() =>
    getDailyClosings().filter(item => !currentBusiness?.businessId || item.businessId === currentBusiness.businessId)
  );
  const [financialReconciliations, setFinancialReconciliations] = useState<FinancialReconciliation[]>(() =>
    getFinancialReconciliations().filter(item => !currentBusiness?.businessId || item.businessId === currentBusiness.businessId)
  );
  const [financialPeriods, setFinancialPeriods] = useState<FinancialPeriod[]>(() =>
    getFinancialPeriods().filter(item => !currentBusiness?.businessId || item.businessId === currentBusiness.businessId)
  );
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    getReminders().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const [profitabilityCosts, setProfitabilityCosts] = useState<ProfitabilityCost[]>(() =>
    getProfitabilityCosts().filter(item => !currentBusiness?.businessId || !item.businessId || item.businessId === currentBusiness.businessId)
  );
  const evaluatedReminderKeys = useRef(new Set<string>());

  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    normalizeInvoices(
      getInvoices(),
      initialBusinessData.sales,
      initialBusinessData.payments,
      currentBusiness?.businessId
    )
  );

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    return normalizeLegacyActivityLogs(initialBusinessData.activityLogs, initialSettings.storeName, initialBusinessData.accounts);
  });
  const [notifications, setNotifications] = useState<BusinessNotification[]>(() => getNotifications());
  const loggedInvoiceEntityIds = useRef(
    new Set(
      activityLogs
        .flatMap(log =>
          log.type === 'invoice_generated' && log.entityId
            ? [log.entityId]
            : log.type === 'invoice_created' && log.invoiceId
              ? [log.invoiceId]
              : []
        )
    )
  );

  const [settings, setSettings] = useState<AppSettings>(() => {
    return normalizeLegacyBranding(getSettings() || {});
  });
  const getPaymentMethodSnapshot = (name: string) => {
    const method = normalizePaymentMethods(settings.paymentPreferences?.methods)
      .find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    return {
      paymentMethodId: method?.id,
      paymentMethodName: method?.name || name,
      paymentMethodCategory: method?.category,
      paymentAccount: method?.accountDetails || undefined,
      financialAccountId: method?.financialAccountId
        || financialAccounts.find(account => account.name.toLocaleLowerCase() === (method?.name || name).toLocaleLowerCase())?.id,
    };
  };
  const [storageWarning, setStorageWarning] = useState<string | null>(
    () => getStorageWarnings()[0] || null
  );
  const persistStorage = (save: () => void): boolean => {
    try {
      save();
      setStorageWarning(getStorageWarnings()[0] || null);
      return true;
    } catch (error) {
      console.error('Local data persistence failed.', error);
      setStorageWarning('Some changes could not be saved in this browser.');
      return false;
    }
  };
  const businessSettings = useMemo(
    () => currentBusinessName
      ? { ...settings, businessId: currentBusiness?.businessId, storeName: currentBusinessName }
      : settings,
    [currentBusiness, currentBusinessName, settings]
  );
  const allBusinessNotifications = useMemo(
    () => getLiveNotifications(notifications, currentBusiness?.businessId),
    [notifications, currentBusiness?.businessId]
  );
  const businessNotifications = useMemo(
    () => allBusinessNotifications.filter(notification =>
      isNotificationEnabled(settings, notification.category, notification.priority)
    ),
    [allBusinessNotifications, settings]
  );
  const unreadNotificationCount = useMemo(
    () => businessNotifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0),
    [businessNotifications]
  );

  // Local storage synchronization fallbacks
  useEffect(() => {
    persistStorage(() => saveCustomers(customers));
  }, [customers]);

  useEffect(() => {
    persistStorage(() => saveServices(services));
  }, [services]);

  useEffect(() => {
    persistStorage(() => saveAccounts(accounts));
  }, [accounts]);

  useEffect(() => {
    persistStorage(() => saveSubscriptions(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    persistStorage(() => saveSales(sales));
  }, [sales]);

  useEffect(() => {
    persistStorage(() => savePayments(payments));
  }, [payments]);

  useEffect(() => { persistStorage(() => saveFinancialAccounts(financialAccounts)); }, [financialAccounts]);
  useEffect(() => { persistStorage(() => saveExpenses(expenses)); }, [expenses]);
  useEffect(() => { persistStorage(() => saveOtherIncome(otherIncome)); }, [otherIncome]);
  useEffect(() => { persistStorage(() => saveFinancialTransfers(financialTransfers)); }, [financialTransfers]);
  useEffect(() => { persistStorage(() => saveFinancialAdjustments(financialAdjustments)); }, [financialAdjustments]);
  useEffect(() => { persistStorage(() => saveDailyClosings(dailyClosings)); }, [dailyClosings]);
  useEffect(() => { persistStorage(() => saveFinancialReconciliations(financialReconciliations)); }, [financialReconciliations]);
  useEffect(() => { persistStorage(() => saveFinancialPeriods(financialPeriods)); }, [financialPeriods]);
  useEffect(() => { persistStorage(() => saveReminders(reminders)); }, [reminders]);
  useEffect(() => { persistStorage(() => saveProfitabilityCosts(profitabilityCosts)); }, [profitabilityCosts]);

  useEffect(() => {
    if (!persistStorage(() => saveInvoices(invoices))) return;
    const pendingInvoices = invoices.filter(invoice => invoice.creationLogPending);
    if (pendingInvoices.length === 0) return;

    const newLogs = pendingInvoices.flatMap(invoice => {
      if (loggedInvoiceEntityIds.current.has(invoice.invoiceId)) return [];
      loggedInvoiceEntityIds.current.add(invoice.invoiceId);
      return [createAuditLog({
        type: 'invoice_created',
        title: 'Invoice Created',
        description: `Invoice ${invoice.invoiceNumber} created for sale ${invoice.saleId}.`,
        entityId: invoice.invoiceId,
        entityType: 'invoice',
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        saleId: invoice.saleId,
        customerId: invoice.customerId,
        serviceId: invoice.serviceId,
        subscriptionId: invoice.subscriptionId,
      }, {
        id: createRecordId('activity'),
        businessId: currentBusiness?.businessId,
        createdBy: currentUser?.uid || 'admin',
      })];
    });
    setInvoices(previous => previous.map(invoice =>
      invoice.creationLogPending ? { ...invoice, creationLogPending: undefined } : invoice
    ));
    if (newLogs.length > 0) setActivityLogs(previous => [...newLogs, ...previous]);
  }, [invoices, currentBusiness?.businessId, currentUser?.uid]);

  useEffect(() => {
    setInvoices(previous => {
      let changed = false;
      const next = previous.map(invoice => {
        const sale = sales.find(item => item.id === invoice.saleId);
        if (!sale) return invoice;
        const refreshed = createInvoiceRecord(sale, payments, invoice, currentBusiness?.businessId);
        if (
          refreshed.totalAmount === invoice.totalAmount
          && refreshed.paidAmount === invoice.paidAmount
          && refreshed.dueAmount === invoice.dueAmount
          && refreshed.paymentStatus === invoice.paymentStatus
          && refreshed.paymentMethod === invoice.paymentMethod
          && refreshed.subscriptionId === invoice.subscriptionId
          && refreshed.customerId === invoice.customerId
          && refreshed.serviceId === invoice.serviceId
          && refreshed.planId === invoice.planId
        ) return invoice;
        changed = true;
        return refreshed;
      });
      return changed ? next : previous;
    });
  }, [sales, payments, currentBusiness?.businessId]);

  useEffect(() => {
    setPayments(previous => {
      let changed = false;
      const next = previous.map(payment => {
        if (payment.invoiceId) return payment;
        const linkedSale = payment.saleId
          ? sales.find(sale => sale.id === payment.saleId)
          : undefined;
        const invoice = linkedSale
          ? invoices.find(item => item.saleId === linkedSale.id)
          : undefined;
        if (!invoice) return payment;
        changed = true;
        return { ...payment, invoiceId: invoice.invoiceId };
      });
      return changed ? next : previous;
    });
  }, [invoices, sales]);

  useEffect(() => {
    persistStorage(() => saveHistory(activityLogs));
    activityLogs.forEach(log => {
      if (log.type === 'invoice_generated' && log.entityId) {
        loggedInvoiceEntityIds.current.add(log.entityId);
      }
      if (log.type === 'invoice_created' && log.invoiceId) {
        loggedInvoiceEntityIds.current.add(log.invoiceId);
      }
    });
  }, [activityLogs]);

  useEffect(() => {
    const persistedSettings = Object.fromEntries(
      Object.entries({
        ...settings,
        ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      }).filter(([key]) => key !== 'storeName')
    );
    persistStorage(() => saveSettings(persistedSettings));
  }, [currentBusiness?.businessId, settings]);

  useEffect(() => {
    persistStorage(() => saveNotifications(notifications));
  }, [notifications]);

  useEffect(() => {
    const generated = generateSystemNotifications({
      businessId: currentBusiness?.businessId,
      customers,
      services,
      accounts,
      subscriptions,
      sales,
      payments,
      invoices,
      settings: businessSettings,
      storageWarning,
    });
    setNotifications(previous => {
      const next = reconcileSystemNotifications(previous, generated, currentBusiness?.businessId);
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [
    currentBusiness?.businessId,
    customers,
    services,
    accounts,
    subscriptions,
    sales,
    payments,
    invoices,
    businessSettings,
    storageWarning,
  ]);

  useEffect(() => {
    const interval = settings.automaticBackupReminder ?? 'off';
    if (interval === 'off' || typeof window === 'undefined') return;
    const intervalDays = { daily: 1, weekly: 7, monthly: 30 } as const;
    const businessId = currentBusiness?.businessId ?? 'local';
    try {
      const metadata = JSON.parse(window.localStorage.getItem(`sqp_data_management_v1_${businessId}`) ?? '{}') as Record<string, unknown>;
      const lastBackupAt = typeof metadata.lastBackupAt === 'string' ? metadata.lastBackupAt : '';
      const parsedBackupDate = Date.parse(lastBackupAt);
      const elapsedDays = Number.isFinite(parsedBackupDate)
        ? (Date.now() - parsedBackupDate) / 86400000
        : Number.POSITIVE_INFINITY;
      if (elapsedDays < intervalDays[interval]) return;
      const dedupeKey = `backup-reminder-${businessId}-${interval}-${lastBackupAt || 'never'}`;
      const reminder = createNotification({
        dedupeKey,
        type: 'backup_reminder',
        category: 'system',
        priority: 'info',
        title: 'Backup reminder',
        message: lastBackupAt
          ? `Your last backup was ${Math.floor(elapsedDays)} days ago. Create a new backup?`
          : 'No backup has been recorded yet. Create a business backup to protect your local data.',
        section: 'settings',
      }, businessId);
      setNotifications(previous => previous.some(item => item.dedupeKey === dedupeKey)
        ? previous
        : [...previous, reminder]);
    } catch (error) {
      console.error('Could not check the automatic backup reminder.', error);
    }
  }, [currentBusiness?.businessId, settings.automaticBackupReminder]);

  useEffect(() => {
    if (!currentBusinessName) return;
    setSettings(previous =>
      previous.storeName === currentBusinessName
        ? previous
        : { ...previous, storeName: currentBusinessName }
    );
  }, [currentBusinessName]);

  const setBusinessName = (name: string): void => {
    const business = saveBusinessName(name);
    setCurrentBusinessName(business.name);
    setCurrentBusiness(business);
    setCustomers(previous => withBusinessId(previous, business.businessId));
    setServices(previous => withBusinessId(previous, business.businessId));
    setAccounts(previous => previous.map(account => ({
      ...account,
      businessId: business.businessId,
      profiles: account.profiles.map(profile => ({
        ...profile,
        businessId: business.businessId,
      })),
    })));
    setSubscriptions(previous => withBusinessId(previous, business.businessId));
    setSales(previous => withBusinessId(previous, business.businessId));
    setInvoices(previous => withBusinessId(previous, business.businessId));
    setPayments(previous => withBusinessId(previous, business.businessId));
    setActivityLogs(previous => withBusinessId(previous, business.businessId));
    setSettings(previous => ({ ...previous, storeName: business.name }));
  };

  const clearBusinessName = (): void => {
    clearStoredBusinessName();
    setCurrentBusinessName('');
    setCurrentBusiness(null);
    setSettings(previous => ({ ...previous, storeName: initialSettings.storeName }));
  };

  const createBusiness = async (name: string): Promise<CurrentBusiness> => {
    setBusinessName(name);
    const business = getCurrentBusiness();
    if (!business) throw new Error('The business could not be loaded after saving.');
    return business;
  };

  // Query helpers
  const getCustomerById = (id: string) => customers.find(c => c.id === id);
  const getServiceById = (id: string) => services.find(s => s.id === id);
  const getAccountById = (id: string) => accounts.find(a => a.id === id);
  const getPlanId = (serviceId: string, planName: string) => {
    const service = getServiceById(serviceId);
    const index = service?.plans.indexOf(planName) ?? -1;
    return index >= 0 ? service?.planIds?.[index] : undefined;
  };

  const ensureInvoiceForSale = (saleId: string): Invoice => {
    const existing = invoices.find(invoice => invoice.saleId === saleId);
    if (existing) return existing;

    const sale = sales.find(item => item.id === saleId);
    if (!sale) throw new Error('An invoice cannot be created without a valid sale.');
    if (currentBusiness?.businessId && sale.businessId !== currentBusiness.businessId) {
      throw new Error('This sale does not belong to the current business.');
    }

    const invoice = {
      ...createInvoiceRecord(
        sale,
        payments,
        undefined,
        currentBusiness?.businessId,
        `invoice-${sale.id}`
      ),
      creationLogPending: true,
    };
    setInvoices(previous => previous.some(item => item.saleId === saleId) ? previous : [invoice, ...previous]);
    logActivity({
      type: 'invoice_created',
      title: 'Invoice Created',
      description: `Invoice ${invoice.invoiceNumber} created for sale ${sale.invoiceNo}.`,
      entityType: 'invoice',
      entityId: invoice.invoiceId,
      customerId: invoice.customerId,
      serviceId: invoice.serviceId,
      subscriptionId: invoice.subscriptionId,
      saleId: invoice.saleId,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.totalAmount,
      currency: sale.currency,
      metadata: { totalAmount: invoice.totalAmount, paidAmount: invoice.paidAmount, dueAmount: invoice.dueAmount },
    });
    addNotification({
      dedupeKey: `invoice-created-${invoice.invoiceId}`,
      type: 'invoice_created',
      category: 'invoice',
      priority: 'info',
      title: 'Invoice created',
      message: `Invoice ${invoice.invoiceNumber} was created.`,
      entityType: 'invoice',
      entityId: invoice.invoiceId,
      customerId: invoice.customerId,
      serviceId: invoice.serviceId,
      subscriptionId: invoice.subscriptionId,
      saleId: invoice.saleId,
      invoiceId: invoice.invoiceId,
      section: 'invoices',
    });
    return invoice;
  };

  // Activity logging
  const logActivity = (log: Omit<ActivityLog, 'id' | 'timestamp' | 'createdAt' | 'businessId' | 'createdBy'>) => {
    if (
      log.type === 'invoice_generated' &&
      log.entityId &&
      loggedInvoiceEntityIds.current.has(log.entityId)
    ) {
      return;
    }
    if (log.type === 'invoice_generated' && log.entityId) {
      loggedInvoiceEntityIds.current.add(log.entityId);
    }
    if (log.type === 'invoice_created' && log.invoiceId) {
      if (loggedInvoiceEntityIds.current.has(log.invoiceId)) return;
      loggedInvoiceEntityIds.current.add(log.invoiceId);
    }

    const sourceId = log.entityId;
    const linkedCustomer = customers.find(item => item.id === (log.customerId || sourceId));
    const linkedService = services.find(item => item.id === (log.serviceId || sourceId));
    const linkedAccount = accounts.find(item => item.id === (log.accountId || sourceId));
    const linkedProfile = accounts.flatMap(item => item.profiles.map(profile => ({ account: item, profile })))
      .find(item => item.profile.id === (log.profileId || sourceId));
    const linkedSubscription = subscriptions.find(item => item.id === (log.subscriptionId || sourceId));
    const linkedSale = sales.find(item => item.id === (log.saleId || sourceId));
    const linkedPayment = payments.find(item => item.id === (log.paymentId || sourceId));
    const linkedInvoice = invoices.find(item => item.invoiceId === (log.invoiceId || sourceId));
    const inferredCustomerId = log.customerId
      || linkedCustomer?.id
      || linkedProfile?.profile.assignedCustomerId
      || linkedSubscription?.customerId
      || linkedSale?.customerId
      || linkedPayment?.customerId
      || linkedInvoice?.customerId;
    const enrichedLog = {
      ...log,
      customerId: inferredCustomerId,
      customerName: log.customerName || (inferredCustomerId
        ? getCustomerDisplayName(customers.find(item => item.id === inferredCustomerId))
        : undefined),
      serviceId: log.serviceId || linkedService?.id || linkedAccount?.serviceId || linkedProfile?.account.serviceId
        || linkedSubscription?.serviceId || linkedSale?.serviceId || linkedInvoice?.serviceId,
      accountId: log.accountId || linkedAccount?.id || linkedProfile?.account.id || linkedSubscription?.accountId || linkedSale?.accountId,
      profileId: log.profileId || linkedProfile?.profile.id || linkedSubscription?.profileId || linkedSale?.profileId,
      subscriptionId: log.subscriptionId || linkedSubscription?.id || linkedSale?.subscriptionId
        || linkedPayment?.subscriptionId || linkedInvoice?.subscriptionId,
      saleId: log.saleId || linkedSale?.id || linkedPayment?.saleId || linkedInvoice?.saleId,
      paymentId: log.paymentId || linkedPayment?.id,
      invoiceId: log.invoiceId || linkedInvoice?.invoiceId || linkedPayment?.invoiceId,
      invoiceNumber: log.invoiceNumber || linkedInvoice?.invoiceNumber || linkedSale?.invoiceNo,
      serviceName: log.serviceName || services.find(item =>
        item.id === (log.serviceId || linkedService?.id || linkedSubscription?.serviceId || linkedSale?.serviceId)
      )?.name,
      entityType: log.entityType,
    };
    const newLog = createAuditLog(enrichedLog, {
      id: createRecordId('activity'),
      businessId: currentBusiness?.businessId,
      createdBy: currentUser?.uid || 'admin',
    });
    setActivityLogs(prev => [newLog, ...prev]);
  };

  const addNotification = (details: NewNotification): BusinessNotification => {
    const notification = createNotification({
      ...details,
      ...(!details.expiresAt && details.category !== 'payment' && details.category !== 'invoice'
        ? { expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() }
        : {}),
    }, currentBusiness?.businessId);
    if (!isNotificationEnabled(businessSettings, notification.category, notification.priority)) return notification;
    setNotifications(previous => {
      const existing = notification.dedupeKey
        ? previous.find(item => item.dedupeKey === notification.dedupeKey &&
          (!currentBusiness?.businessId || item.businessId === currentBusiness.businessId))
        : undefined;
      if (existing) {
        return previous.map(item => item.id === existing.id
          ? { ...notification, id: existing.id, createdAt: existing.createdAt, read: existing.read }
          : item);
      }
      return [notification, ...previous];
    });
    return notification;
  };

  const reminderData = {
    businessId: currentBusiness?.businessId,
    customers,
    services,
    subscriptions,
    sales,
    payments,
    invoices,
    dailyClosings,
    expenses,
    settings: businessSettings,
  };
  const refreshReminders = () => {
    const today = getDateInTimeZone(businessSettings.businessProfile?.timeZone);
    const candidates = generateReminderCandidates(reminderData, today);
    const resolvedSourceKeys = getResolvedReminderSourceKeys(reminders, reminderData);
    const result = reconcileReminderCandidates(reminders, candidates, new Date().toISOString(), resolvedSourceKeys, currentBusiness?.businessId);
    if (result.reminders !== reminders) setReminders(result.reminders);
    result.created.forEach(reminder => {
      if (evaluatedReminderKeys.current.has(reminder.deterministicKey)) return;
      evaluatedReminderKeys.current.add(reminder.deterministicKey);
      logActivity({
        type: 'reminder_created',
        category: 'reminders',
        action: 'created',
        entityType: 'reminder',
        entityId: reminder.id,
        customerId: reminder.customerId,
        serviceId: reminder.serviceId,
        subscriptionId: reminder.subscriptionId,
        saleId: reminder.saleId,
        invoiceId: reminder.invoiceId,
        title: 'Smart Reminder Created',
        description: reminder.title,
        metadata: { reminderId: reminder.id, reminderType: reminder.type, sourceEntityId: reminder.sourceEntityId },
      });
      addNotification({
        dedupeKey: `smart-reminder-${reminder.deterministicKey}`,
        type: 'smart_reminder',
        category: reminder.type.startsWith('renewal') || reminder.type === 'subscription_expired' ? 'subscription'
          : reminder.type.includes('invoice') || reminder.type === 'partial_payment' ? 'invoice'
            : reminder.type === 'daily_closing' ? 'system' : 'payment',
        priority: reminder.priority === 'critical' ? 'critical'
          : reminder.priority === 'high' ? 'warning' : 'info',
        title: reminder.title,
        message: reminder.description || reminder.title,
        entityType: reminder.sourceEntityType === 'customer' ? 'customer'
          : reminder.sourceEntityType === 'subscription' ? 'subscription'
            : reminder.sourceEntityType === 'invoice' ? 'invoice'
              : reminder.sourceEntityType === 'sale' ? 'sale' : 'system',
        entityId: reminder.sourceEntityId,
        customerId: reminder.customerId,
        serviceId: reminder.serviceId,
        subscriptionId: reminder.subscriptionId,
        saleId: reminder.saleId,
        invoiceId: reminder.invoiceId,
        section: reminder.type === 'daily_closing' ? 'cashbook'
          : reminder.subscriptionId ? 'subscriptions' : reminder.invoiceId ? 'invoices' : reminder.saleId ? 'sales' : 'dashboard',
      });
    });
    return result.reminders;
  };

  const updateReminderStatus = (
    reminderId: string,
    status: ReminderStatus,
    details: { snoozedUntil?: string; completedAt?: string; dismissedAt?: string } = {}
  ) => {
    const reminder = reminders.find(item => item.id === reminderId);
    if (!reminder) throw new Error('Reminder could not be found.');
    const now = new Date().toISOString();
    setReminders(previous => previous.map(item => item.id === reminderId ? {
      ...item,
      status,
      snoozedUntil: status === 'snoozed' ? details.snoozedUntil : undefined,
      completedAt: status === 'completed' ? details.completedAt || now : undefined,
      dismissedAt: status === 'dismissed' ? details.dismissedAt || now : undefined,
      updatedAt: now,
    } : item));
    const activityType = status === 'completed' ? 'reminder_completed'
      : status === 'snoozed' ? 'reminder_snoozed'
        : status === 'dismissed' ? 'reminder_dismissed' : 'reminder_reopened';
    logActivity({
      type: activityType,
      category: 'reminders',
      action: status === 'completed' ? 'completed' : 'updated',
      entityType: 'reminder',
      entityId: reminder.id,
      customerId: reminder.customerId,
      serviceId: reminder.serviceId,
      subscriptionId: reminder.subscriptionId,
      saleId: reminder.saleId,
      invoiceId: reminder.invoiceId,
      title: `Reminder ${status}`,
      description: reminder.title,
      metadata: { reminderId: reminder.id, reminderType: reminder.type, sourceEntityId: reminder.sourceEntityId },
    });
  };
  const completeReminder = (reminderId: string) => updateReminderStatus(reminderId, 'completed');
  const snoozeReminder = (reminderId: string, until: string) => {
    const timestamp = Date.parse(until);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw new Error('Choose a valid future snooze date and time.');
    }
    updateReminderStatus(reminderId, 'snoozed', { snoozedUntil: new Date(timestamp).toISOString() });
  };
  const dismissReminder = (reminderId: string) => updateReminderStatus(reminderId, 'dismissed');
  const reopenReminder = (reminderId: string) => updateReminderStatus(reminderId, 'open');
  const createManualReminder = (
    details: Omit<ReminderCandidate, 'businessId' | 'deterministicKey' | 'systemGenerated'>
  ): Reminder => {
    if (!details.title.trim()) throw new Error('Enter a reminder title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.dueDate)
      || Number.isNaN(Date.parse(`${details.dueDate}T00:00:00`))) {
      throw new Error('Choose a valid reminder date.');
    }
    const sourceEntityId = details.sourceEntityId || details.customerId || createRecordId('followup');
    const deterministicKey = [
      currentBusiness?.businessId || 'local',
      details.type,
      sourceEntityId,
      details.targetDate || details.dueDate,
      details.stage || details.title.trim().toLocaleLowerCase(),
    ].join(':');
    if (reminders.some(reminder => reminder.deterministicKey === deterministicKey)) {
      throw new Error('A reminder for this item and date already exists.');
    }
    const now = new Date().toISOString();
    const reminder: Reminder = {
      ...details,
      title: sanitizeReminderText(details.title.trim()),
      description: details.description ? sanitizeReminderText(details.description) : undefined,
      id: createRecordId('reminder'),
      reminderId: undefined,
      businessId: currentBusiness?.businessId,
      deterministicKey,
      sourceEntityId,
      status: 'open',
      systemGenerated: false,
      createdAt: now,
      updatedAt: now,
    };
    reminder.reminderId = reminder.id;
    setReminders(previous => [reminder, ...previous]);
    logActivity({
      type: 'reminder_created',
      category: 'reminders',
      action: 'created',
      entityType: 'reminder',
      entityId: reminder.id,
      customerId: reminder.customerId,
      title: 'Follow-up Reminder Created',
      description: reminder.title,
      metadata: { reminderId: reminder.id, reminderType: reminder.type, sourceEntityId },
    });
    return reminder;
  };

  useEffect(() => {
    refreshReminders();
  }, [
    currentBusiness?.businessId,
    customers,
    services,
    subscriptions,
    sales,
    payments,
    invoices,
    dailyClosings,
    reminders,
    expenses,
    businessSettings.reminderPreferences,
    businessSettings.businessProfile?.timeZone,
    reminders,
  ]);

  const markNotificationAsRead = (notificationId: string, read = true) => {
    setNotifications(previous => previous.map(notification =>
      notification.id === notificationId &&
      (!currentBusiness?.businessId || !notification.businessId || notification.businessId === currentBusiness.businessId)
        ? { ...notification, read }
        : notification
    ));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(previous => previous.map(notification =>
      (!currentBusiness?.businessId || !notification.businessId || notification.businessId === currentBusiness.businessId)
        ? { ...notification, read: true }
        : notification
    ));
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(previous => previous.filter(notification =>
      notification.id !== notificationId ||
      Boolean(currentBusiness?.businessId && notification.businessId && notification.businessId !== currentBusiness.businessId)
    ));
  };

  const clearNotifications = () => {
    setNotifications(previous => previous.filter(notification =>
      Boolean(currentBusiness?.businessId && notification.businessId && notification.businessId !== currentBusiness.businessId)
    ));
  };

  const getNotificationCount = (unreadOnly = false): number =>
    unreadOnly ? unreadNotificationCount : businessNotifications.length;
  const getUnreadNotificationsForBusiness = (): BusinessNotification[] =>
    getUnreadNotifications(businessNotifications);

  const clearActivityLogs = () => {
    setActivityLogs([]);
    loggedInvoiceEntityIds.current.clear();
  };

  // Customers
  const assertSafeCustomerNote = (text: string) => {
    const normalized = text.trim();
    const containsCredentialLabel = /\b(password|passcode|pin|api[\s_-]?key|secret|credential|token)\s*[:=]\s*\S+/i.test(normalized);
    const containsStoredCredential = accounts.some(account => {
      const values = [
        account.password,
        account.passwordMasked,
        ...account.profiles.flatMap(profile => [profile.pin, profile.pinMasked]),
      ];
      return values.some(value => Boolean(value && value.length >= 4 && normalized.includes(value)));
    });
    if (containsCredentialLabel || containsStoredCredential) {
      throw new Error('Customer notes cannot contain passwords, PINs, or account credentials.');
    }
  };

  const addCustomer = async (custData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> => {
    if (custData.notes) assertSafeCustomerNote(custData.notes);
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...custData,
      id: createRecordId('customer'),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      createdAt: getTodayDateString(),
      updatedAt: now,
      createdBy: currentUser?.uid || 'admin',
      isArchived: false,
      status: 'active',
    };
    setCustomers(prev => [newCustomer, ...prev.filter(c => c.id !== newCustomer.id)]);
    logActivity({
      type: 'customer_added',
      title: 'Customer Added',
      description: `${newCustomer.name} was registered into ${settings.storeName || DEFAULT_INVOICE_BUSINESS_NAME}.`,
      customerName: newCustomer.name,
      entityId: newCustomer.id,
      customerId: newCustomer.id,
    });
    addNotification({
      dedupeKey: `customer-added-${newCustomer.id}`,
      type: 'customer_added',
      category: 'customer',
      priority: 'success',
      title: 'New customer added',
      message: `${newCustomer.name} was added to your customers.`,
      entityType: 'customer',
      entityId: newCustomer.id,
      customerId: newCustomer.id,
      section: 'customers',
    });
    return newCustomer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<void> => {
    if (typeof updates.notes === 'string') assertSafeCustomerNote(updates.notes);
    const previousCustomer = customers.find(customer => customer.id === id);
    if (!previousCustomer) return;
    const updatedCustomer: Customer = {
      ...previousCustomer,
      ...updates,
      id: previousCustomer.id,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      updatedAt: new Date().toISOString(),
    };
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === id) return updatedCustomer;
        return c;
      })
    );
    if (
      previousCustomer.name !== updatedCustomer.name ||
      previousCustomer.email !== updatedCustomer.email ||
      previousCustomer.phone !== updatedCustomer.phone ||
      previousCustomer.whatsapp !== updatedCustomer.whatsapp ||
      previousCustomer.address !== updatedCustomer.address
    ) {
      addNotification({
        dedupeKey: `customer-updated-${id}-${updatedCustomer.updatedAt}`,
        type: 'customer_updated',
        category: 'customer',
        priority: 'info',
        title: 'Customer information updated',
        message: `${updatedCustomer.name}’s customer information was updated.`,
        entityType: 'customer',
        entityId: id,
        customerId: id,
        section: 'customers',
      });
    }
    const changedFields = (['name', 'phone', 'whatsapp', 'email', 'address', 'notes', 'status', 'tags', 'preferences'] as const)
      .filter(field => previousCustomer[field] !== updatedCustomer[field]);
    if (changedFields.length > 0) {
      logActivity({
        type: 'customer_updated',
        title: previousCustomer.status !== updatedCustomer.status ? 'Customer Status Changed' : 'Customer Updated',
        description: `${updatedCustomer.name}’s information was updated.`,
        customerName: updatedCustomer.name,
        customerId: id,
        entityId: id,
        metadata: {
          changedFields: changedFields.join(', '),
          ...(previousCustomer.name !== updatedCustomer.name ? {
            beforeName: previousCustomer.name,
            afterName: updatedCustomer.name,
          } : {}),
          ...(previousCustomer.phone !== updatedCustomer.phone ? {
            beforePhone: previousCustomer.phone,
            afterPhone: updatedCustomer.phone,
          } : {}),
          ...(previousCustomer.status !== updatedCustomer.status ? {
            beforeStatus: previousCustomer.status || 'active',
            afterStatus: updatedCustomer.status || 'active',
          } : {}),
        },
      });
    }
  };

  const addCustomerNote = (customerId: string, text: string): CustomerNote => {
    const customer = getCustomerById(customerId);
    const normalized = text.trim();
    if (!customer) throw new Error('Customer not found.');
    if (!normalized) throw new Error('A note cannot be empty.');
    assertSafeCustomerNote(normalized);
    const now = new Date().toISOString();
    const note: CustomerNote = {
      id: createRecordId('customer-note'),
      customerId,
      text: normalized,
      createdAt: now,
      updatedAt: now,
    };
    setCustomers(previous => previous.map(item => item.id === customerId
      ? { ...item, notesHistory: [...(item.notesHistory || []), note], updatedAt: now }
      : item));
    logActivity({
      type: 'customer_note_added',
      title: 'Customer Note Added',
      description: `Note added for ${customer.name}: ${normalized}`,
      customerName: customer.name,
      customerId,
      entityId: customerId,
      metadata: { noteId: note.id },
    });
    return note;
  };

  const updateCustomerNote = (customerId: string, noteId: string, text: string) => {
    const customer = getCustomerById(customerId);
    const normalized = text.trim();
    if (!customer) throw new Error('Customer not found.');
    if (!normalized) throw new Error('A note cannot be empty.');
    assertSafeCustomerNote(normalized);
    if (!customer.notesHistory?.some(note => note.id === noteId)) throw new Error('Customer note not found.');
    const now = new Date().toISOString();
    setCustomers(previous => previous.map(item => item.id === customerId
      ? {
          ...item,
          notesHistory: (item.notesHistory || []).map(note => note.id === noteId
            ? { ...note, text: normalized, updatedAt: now }
            : note),
          updatedAt: now,
        }
      : item));
    logActivity({
      type: 'customer_note_updated',
      title: 'Customer Note Updated',
      description: `Note updated for ${customer.name}: ${normalized}`,
      customerName: customer.name,
      customerId,
      entityId: customerId,
      metadata: { noteId },
    });
  };

  const deleteCustomerNote = (customerId: string, noteId: string) => {
    const customer = getCustomerById(customerId);
    if (!customer) throw new Error('Customer not found.');
    if (!customer.notesHistory?.some(note => note.id === noteId)) throw new Error('Customer note not found.');
    const now = new Date().toISOString();
    setCustomers(previous => previous.map(item => item.id === customerId
      ? { ...item, notesHistory: (item.notesHistory || []).filter(note => note.id !== noteId), updatedAt: now }
      : item));
    logActivity({
      type: 'customer_note_deleted',
      title: 'Customer Note Deleted',
      description: `A note for ${customer.name} was deleted.`,
      customerName: customer.name,
      customerId,
      entityId: customerId,
      metadata: { noteId },
    });
  };

  const deleteCustomer = async (id: string, forcePermanent = false): Promise<void> => {
    const cust = getCustomerById(id);
    if (!cust) return;

    // Check if customer has related subscriptions or sales
    const hasRelatedRecords =
      subscriptions.some(s => s.customerId === id) ||
      sales.some(sl => sl.customerId === id) ||
      payments.some(p => p.customerId === id);

    if (hasRelatedRecords && !forcePermanent) {
      await archiveCustomer(id);
      return;
    }

    setCustomers(prev => prev.filter(c => c.id !== id));
    logActivity({
      type: 'customer_added',
      title: 'Customer Removed',
      description: `${cust.name} was permanently removed from database.`,
      customerName: cust.name,
      customerId: cust.id,
      entityId: cust.id,
    });
  };

  const archiveCustomer = async (id: string): Promise<void> => {
    const cust = getCustomerById(id);
    if (!cust) return;
    const updated: Customer = {
      ...cust,
      isArchived: true,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    };
    setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
    logActivity({
      type: 'customer_added',
      title: 'Customer Archived',
      description: `${cust.name} was archived to preserve subscription and sales records.`,
      customerName: cust.name,
      customerId: cust.id,
      entityId: cust.id,
    });
  };

  const restoreCustomer = async (id: string): Promise<void> => {
    const cust = getCustomerById(id);
    if (!cust) return;
    const updated: Customer = {
      ...cust,
      isArchived: false,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
    logActivity({
      type: 'customer_added',
      title: 'Customer Restored',
      description: `${cust.name} was restored from archive.`,
      customerName: cust.name,
      customerId: cust.id,
      entityId: cust.id,
    });
  };

  // Services
  const addService = async (srvData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<Service> => {
    const now = new Date().toISOString();
    const newService: Service = {
      ...srvData,
      id: createRecordId('service'),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      createdBy: currentUser?.uid || 'admin',
      createdAt: now,
      updatedAt: now,
      isArchived: false,
      status: srvData.status || 'active',
      plans: srvData.plans || [],
      planIds: srvData.planIds || [],
      planDetails: srvData.planDetails || [],
    };
    setServices(prev => [...prev.filter(s => s.id !== newService.id), newService]);
    logActivity({
      type: 'service_updated',
      title: 'Service Created',
      description: `Service "${newService.name}" (${newService.category}) was added to the catalog.`,
      serviceName: newService.name,
      entityId: newService.id,
      serviceId: newService.id,
      metadata: { status: newService.status, plansCount: newService.planDetails?.length || 0 },
    });
    (newService.planDetails || []).forEach(plan => logActivity({
      type: 'service_updated',
      title: 'Plan Created',
      description: `Plan "${plan.name}" was added to ${newService.name}.`,
      entityType: 'plan',
      entityId: plan.id,
      serviceId: newService.id,
      planId: plan.id,
      metadata: { price: plan.price, durationDays: plan.durationDays, status: plan.status },
    }));
    return newService;
  };

  const updateService = async (id: string, updates: Partial<Service>): Promise<void> => {
    const previousService = services.find(service => service.id === id);
    if (!previousService) return;
    const now = new Date().toISOString();
    const updatedService: Service = {
      ...previousService,
      ...updates,
      id: previousService.id,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      ...(updates.planDetails ? {
        plans: updates.planDetails.map(plan => plan.name),
        planIds: updates.planDetails.map(plan => plan.id),
        planDetails: updates.planDetails.map(plan => ({ ...plan })),
      } : updates.plans ? {
        planIds: getStablePlanIds(updates.plans, previousService.plans, previousService.planIds || []),
        planDetails: updates.plans.map((name, index) => {
          const planId = getStablePlanIds(updates.plans || [], previousService.plans, previousService.planIds || [])[index];
          const existingPlan = previousService.planDetails?.find(plan => plan.id === planId);
          return existingPlan
            ? { ...existingPlan, name }
            : {
                id: planId,
                name,
                price: Number(previousService.defaultPrice) || 0,
                currency: previousService.currency || 'BDT',
                durationDays: Number(previousService.defaultDurationDays) || 30,
                status: 'active' as const,
              };
        }),
      } : {}),
      updatedAt: now,
    };
    setServices(prev =>
      prev.map(service => service.id === id ? updatedService : service)
    );
    {
      const changedFields = (['name', 'category', 'description', 'logoUrl', 'iconName', 'color', 'status', 'defaultPrice', 'defaultPriceBDT', 'defaultPriceUSD', 'defaultDurationDays', 'settings', 'invoiceSettings', 'renewalMessage', 'advanced', 'notes'] as const)
        .filter(field => JSON.stringify(previousService[field]) !== JSON.stringify(updatedService[field]));
      if (changedFields.length > 0) {
      logActivity({
        type: 'service_updated',
        title: previousService?.status !== updatedService.status
          ? `Service ${updatedService.status === 'active' ? 'Activated' : 'Deactivated'}`
          : 'Service Updated',
        description: `Service "${updatedService.name}" settings updated.`,
        serviceName: updatedService.name,
        entityId: id,
        serviceId: id,
        metadata: {
          changedFields: changedFields.join(', '),
          ...(previousService.defaultPrice !== updatedService.defaultPrice ? {
            beforeDefaultPrice: previousService.defaultPrice ?? null,
            afterDefaultPrice: updatedService.defaultPrice ?? null,
          } : {}),
          ...(previousService.defaultDurationDays !== updatedService.defaultDurationDays ? {
            beforeDurationDays: previousService.defaultDurationDays,
            afterDurationDays: updatedService.defaultDurationDays,
          } : {}),
        },
      });
      }
      const previousPlans = previousService.planDetails || [];
      const nextPlans = updatedService.planDetails || [];
      nextPlans.forEach(plan => {
        const before = previousPlans.find(previous => previous.id === plan.id);
        if (!before) {
          logActivity({
            type: 'service_updated',
            title: 'Plan Created',
            description: `Plan "${plan.name}" was added to ${updatedService.name}.`,
            entityType: 'plan',
            entityId: plan.id,
            serviceId: id,
            planId: plan.id,
            metadata: { price: plan.price, durationDays: plan.durationDays, status: plan.status },
          });
          return;
        }
        const planChanged = JSON.stringify(before) !== JSON.stringify(plan);
        if (planChanged) {
          logActivity({
            type: 'service_updated',
            title: before.status !== plan.status
              ? `Plan ${plan.status === 'active' ? 'Activated' : 'Deactivated'}`
              : 'Plan Updated',
            description: `Plan "${plan.name}" on ${updatedService.name} was updated.`,
            entityType: 'plan',
            entityId: plan.id,
            serviceId: id,
            planId: plan.id,
            metadata: {
              beforeName: before.name,
              afterName: plan.name,
              beforePrice: before.price,
              afterPrice: plan.price,
              beforeDurationDays: before.durationDays,
              afterDurationDays: plan.durationDays,
            },
          });
        }
      });
      previousPlans.filter(plan => !nextPlans.some(next => next.id === plan.id)).forEach(plan => {
        logActivity({
          type: 'service_updated',
          title: 'Plan Deactivated',
          description: `Plan "${plan.name}" was removed from active service plans.`,
          entityType: 'plan',
          entityId: plan.id,
          serviceId: id,
          planId: plan.id,
        });
      });
    }
  };

  const deleteService = async (id: string, forcePermanent = false): Promise<void> => {
    const srv = getServiceById(id);
    if (!srv) return;

    // Check if service has related accounts, subscriptions, or sales
    const hasRelatedRecords =
      accounts.some(a => a.serviceId === id) ||
      subscriptions.some(s => s.serviceId === id) ||
      sales.some(sl => sl.serviceId === id) ||
      invoices.some(invoice => invoice.serviceId === id);

    if (hasRelatedRecords && !forcePermanent) {
      await archiveService(id);
      return;
    }

    setServices(prev => prev.filter(s => s.id !== id));
    logActivity({
      type: 'service_updated',
      title: 'Service Removed',
      description: `Service "${srv.name}" was permanently removed.`,
      serviceName: srv.name,
      entityId: id,
      serviceId: id,
    });
  };

  const archiveService = async (id: string): Promise<void> => {
    const srv = getServiceById(id);
    if (!srv) return;
    const now = new Date().toISOString();
    const updated: Service = {
      ...srv,
      isArchived: true,
      status: 'archived',
      updatedAt: now,
    };
    setServices(prev => prev.map(s => (s.id === id ? updated : s)));
    logActivity({
      type: 'service_updated',
      title: 'Service Archived',
      description: `Service "${srv.name}" was safely archived to protect inventory and order records.`,
      serviceName: srv.name,
      entityId: id,
      serviceId: id,
    });
  };

  const restoreService = async (id: string): Promise<void> => {
    const srv = getServiceById(id);
    if (!srv) return;
    const now = new Date().toISOString();
    const updated: Service = {
      ...srv,
      isArchived: false,
      status: 'active',
      updatedAt: now,
    };
    setServices(prev => prev.map(s => (s.id === id ? updated : s)));
    logActivity({
      type: 'service_updated',
      title: 'Service Restored',
      description: `Service "${srv.name}" was restored to active catalog.`,
      serviceName: srv.name,
      entityId: id,
      serviceId: id,
    });
  };

  // Accounts & Profiles (Sensitive masked storage)
  const addAccount = (
    accData: Omit<Account, 'id' | 'profiles'> & { profiles?: AccountProfile[] }
  ): Account => {
    const service = getServiceById(accData.serviceId);
    if (!service || service.isArchived) throw new Error('Choose an existing service.');
    if (!Number.isInteger(accData.maxProfiles) || accData.maxProfiles <= 0) {
      throw new Error('Account profile capacity must be greater than zero.');
    }
    const planId = accData.planId || getPlanId(accData.serviceId, accData.plan);
    if (planId && !service.planDetails?.some(plan => plan.id === planId && plan.status === 'active')) {
      throw new Error('Choose an active plan belonging to the selected service.');
    }
    if (accData.expiryDate && !Number.isFinite(Date.parse(`${accData.expiryDate}T00:00:00`))) {
      throw new Error('Enter a valid account expiry date.');
    }
    const newId = createRecordId('account');
    const newAccount: Account = {
      ...accData,
      id: newId,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      planId,
      profiles: (accData.profiles || []).map(profile => ({
        ...profile,
        id: createRecordId('profile'),
        accountId: newId,
        ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      })),
      createdBy: currentUser?.uid || 'admin',
      createdAt: getTodayDateString(),
    };
    setAccounts(prev => [newAccount, ...prev]);

    logActivity({
      type: 'account_added',
      title: 'Account Created',
      description: `New ${accData.plan} account added to inventory.`,
      entityId: newId,
      accountId: newId,
      serviceId: newAccount.serviceId,
      planId: newAccount.planId,
      metadata: { status: newAccount.status, profileCount: newAccount.profiles.length },
    });
    return newAccount;
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    const previousAccount = accounts.find(account => account.id === id);
    if (!previousAccount) return;
    const serviceId = updates.serviceId || previousAccount.serviceId;
    const service = getServiceById(serviceId);
    if (!service || service.isArchived) throw new Error('Choose an existing service.');
    const planName = updates.plan ?? previousAccount.plan;
    const planId = updates.planId || getPlanId(serviceId, planName) || (updates.planId === undefined && updates.plan === undefined
      ? previousAccount.planId
      : undefined);
    if (planId && !service.planDetails?.some(plan => plan.id === planId && plan.status === 'active')) {
      throw new Error('Choose an active plan belonging to the selected service.');
    }
    const nextCapacity = updates.maxProfiles ?? previousAccount.maxProfiles;
    if (!Number.isInteger(nextCapacity) || nextCapacity <= 0 || nextCapacity < previousAccount.profiles.length) {
      throw new Error('Capacity must be greater than zero and cannot be lower than the profiles already configured.');
    }
    const linkedSubscriptions = subscriptions.filter(subscription => subscription.accountId === id);
    const changingServiceOrPlan = serviceId !== previousAccount.serviceId
      || planId !== previousAccount.planId
      || planName !== previousAccount.plan;
    if (changingServiceOrPlan && linkedSubscriptions.length > 0) {
      throw new Error('This account is linked to subscriptions. Reassign those subscriptions before changing its service or plan.');
    }
    if (changingServiceOrPlan && previousAccount.profiles.some(profile => profile.status === 'Assigned')) {
      throw new Error('Unassign all customer profiles before changing this account’s service or plan.');
    }
    if (updates.expiryDate && !Number.isFinite(Date.parse(`${updates.expiryDate}T00:00:00`))) {
      throw new Error('Enter a valid account expiry date.');
    }
    const updatedAccount = {
      ...previousAccount,
      ...updates,
      id: previousAccount.id,
      serviceId,
      plan: planName,
      planId,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
    };
    setAccounts(prev =>
      prev.map(a => {
        if (a.id === id) {
          return updatedAccount;
        }
        return a;
      })
    );
    const changedFields = ([
      'serviceId', 'plan', 'planId', 'status', 'purchaseDate', 'expiryDate', 'maxProfiles',
      'name', 'email', 'username', 'password', 'allowProfileSharing',
      'requireCustomerAssignment', 'allowNewAssignment',
    ] as const)
      .filter(field => previousAccount[field] !== updatedAccount[field]);
    if (changedFields.length > 0) {
      logActivity({
        type: 'account_updated',
        title: previousAccount.status !== updatedAccount.status
          ? `Account ${updatedAccount.status === 'Inactive' ? 'Deactivated' : 'Status Changed'}`
          : 'Account Updated',
        description: `Inventory account ${updatedAccount.plan} was updated.`,
        entityId: id,
        accountId: id,
        serviceId: updatedAccount.serviceId,
        planId: updatedAccount.planId,
        metadata: {
          changedFields: changedFields.join(', '),
          beforeStatus: previousAccount.status,
          afterStatus: updatedAccount.status,
          ...(previousAccount.plan !== updatedAccount.plan ? {
            beforePlan: previousAccount.plan,
            afterPlan: updatedAccount.plan,
          } : {}),
        },
      });
    }
  };

  const deleteAccount = (id: string) => {
    const account = accounts.find(item => item.id === id);
    if (!account) return;
    const isInUse = account.profiles.length > 0
      || subscriptions.some(subscription => subscription.accountId === id)
      || sales.some(sale => subscriptions.some(subscription =>
        subscription.id === sale.subscriptionId && subscription.accountId === id
      ));
    if (isInUse) {
      throw new Error('This account is already in use and cannot be deleted.');
    }
    setAccounts(prev => prev.filter(a => a.id !== id));
    logActivity({
      type: 'account_updated',
      title: 'Account Removed',
      description: `Unused ${account.plan} account was removed from inventory.`,
      entityId: id,
      accountId: id,
      serviceId: account.serviceId,
    });
  };

  const addProfileToAccount = (
    accountId: string,
    profileName: string,
    pin?: string,
    details: Pick<AccountProfile, 'startDate' | 'expiryDate' | 'notes'> = {}
  ) => {
    const account = accounts.find(item => item.id === accountId);
    if (!account) throw new Error('Account not found.');
    if (!isAccountOperational(account)) {
      throw new Error('Profiles cannot be added to an inactive account.');
    }
    if (account.profiles.length >= account.maxProfiles) {
      throw new Error('This account has reached its profile limit.');
    }
    if ([details.startDate, details.expiryDate].some(date => date && !Number.isFinite(Date.parse(`${date}T00:00:00`)))) {
      throw new Error('Enter valid profile dates.');
    }
    const newProfile: AccountProfile = {
      id: createRecordId('profile'),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      accountId,
      profileName,
      pin,
      ...details,
      status: 'Available',
      createdBy: currentUser?.uid || 'admin',
      createdAt: getTodayDateString(),
    };
    setAccounts(prev =>
      prev.map(acc => {
        if (acc.id === accountId) {
          const updated = {
            ...acc,
            profiles: [...acc.profiles, newProfile],
          };
          return updated;
        }
        return acc;
      })
    );
    logActivity({
      type: 'profile_created',
      title: 'Profile Created',
      description: `Profile "${profileName}" was added to ${account.plan}.`,
      entityId: newProfile.id,
      accountId,
      profileId: newProfile.id,
      serviceId: account.serviceId,
    });
  };

  const updateProfile = (accountId: string, profileId: string, updates: Partial<AccountProfile>) => {
    const account = accounts.find(item => item.id === accountId);
    const profile = account?.profiles.find(item => item.id === profileId);
    if (!account || !profile) return;
    if ([updates.startDate, updates.expiryDate].some(date => date && !Number.isFinite(Date.parse(`${date}T00:00:00`)))) {
      throw new Error('Enter valid profile dates.');
    }
    if (profile.assignedCustomerId && updates.status && updates.status !== 'Assigned') {
      throw new Error('Unassign this profile before changing its assignment status.');
    }
    const safeUpdates: Partial<AccountProfile> = {
      ...(updates.profileName !== undefined ? { profileName: updates.profileName.trim() } : {}),
      ...(updates.pin !== undefined ? { pin: updates.pin } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.startDate !== undefined ? { startDate: updates.startDate } : {}),
      ...(updates.expiryDate !== undefined ? { expiryDate: updates.expiryDate } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      updatedAt: new Date().toISOString(),
    };
    setAccounts(prev =>
      prev.map(acc => {
        if (acc.id === accountId) {
          const updated = {
            ...acc,
            profiles: acc.profiles.map(p => (p.id === profileId ? {
              ...p,
              ...safeUpdates,
              id: p.id,
              accountId: acc.id,
              ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
            } : p)),
          };
          return updated;
        }
        return acc;
      })
    );
    const profileChanged = (['profileName', 'status', 'pin', 'startDate', 'expiryDate', 'notes'] as const)
      .some(field => safeUpdates[field] !== undefined && safeUpdates[field] !== profile[field]);
    if (profileChanged) {
      logActivity({
        type: 'profile_updated',
        title: 'Profile Updated',
        description: `Profile "${safeUpdates.profileName || profile.profileName}" was updated.`,
        entityId: profileId,
        accountId,
        profileId,
        serviceId: account.serviceId,
      });
    }
  };

  const deleteProfile = (accountId: string, profileId: string) => {
    const profile = accounts.find(account => account.id === accountId)
      ?.profiles.find(item => item.id === profileId);
    if (!profile) return;
    if (profile.assignedCustomerId) {
      throw new Error('This profile is assigned to a customer and cannot be deleted.');
    }
    const isInUse = subscriptions.some(subscription =>
      subscription.accountId === accountId && subscription.profileId === profileId
    ) || sales.some(sale => subscriptions.some(subscription =>
      subscription.id === sale.subscriptionId
      && subscription.accountId === accountId
      && subscription.profileId === profileId
    ));
    if (isInUse) throw new Error('This profile is linked to a subscription and cannot be deleted.');
    setAccounts(prev =>
      prev.map(acc => {
        if (acc.id === accountId) {
          const updated = {
            ...acc,
            profiles: acc.profiles.filter(p => p.id !== profileId),
          };
          return updated;
        }
        return acc;
      })
    );
    logActivity({
      type: 'profile_removed',
      title: 'Profile Removed',
      description: `Profile "${profile.profileName}" was removed from the account.`,
      entityId: profileId,
      accountId,
      profileId,
      serviceId: accounts.find(account => account.id === accountId)?.serviceId,
      customerId: profile.assignedCustomerId,
    });
  };

  const assignCustomerToProfile = (
    accountId: string,
    profileId: string,
    customerId?: string,
    pin?: string,
    subscriptionId?: string
  ) => {
    const account = accounts.find(item => item.id === accountId);
    const profile = account?.profiles.find(item => item.id === profileId);
    if (!account || !profile) return;
    if (customerId && !isAccountOperational(account)) {
      throw new Error('This account is not active.');
    }
    if (customerId && account.allowNewAssignment === false) {
      throw new Error('New profile assignments are disabled for this account.');
    }
    if (customerId && profile.assignedCustomerId && profile.assignedCustomerId !== customerId) {
      throw new Error('This profile is already assigned.');
    }
    if (customerId && profile.status !== 'Available' && profile.assignedCustomerId !== customerId) {
      throw new Error('This profile is not available.');
    }
    if (customerId && getAccountCapacity(account).available <= 0 && !profile.assignedCustomerId) {
      throw new Error('This account has no profile capacity available.');
    }
    if (customerId && !customers.some(customer => customer.id === customerId && !customer.isArchived && customer.status !== 'archived')) {
      throw new Error('The selected customer is not available.');
    }
    const subscription = subscriptionId ? subscriptions.find(item => item.id === subscriptionId) : undefined;
    if (subscriptionId && (!subscription || subscription.customerId !== customerId)) {
      throw new Error('Choose a subscription belonging to the selected customer.');
    }
    if (subscription?.status === 'cancelled') {
      throw new Error('A cancelled subscription cannot be assigned to a profile.');
    }
    if (subscription && profile.subscriptionId && profile.subscriptionId !== subscription.id) {
      throw new Error('This profile is already linked to another subscription.');
    }
    if (subscription && !isSubscriptionCompatibleWithResource(subscription, account, account.serviceId, account.planId)) {
      throw new Error('The selected subscription is not compatible with this account and plan.');
    }
    if (subscription && subscription.accountId && subscription.accountId !== accountId) {
      throw new Error('This subscription is already assigned to another account.');
    }
    if (subscription && subscription.profileId && subscription.profileId !== profileId) {
      throw new Error('This subscription is already assigned to another profile.');
    }
    const customerChanged = profile.assignedCustomerId !== customerId;

    setAccounts(prev =>
      prev.map(acc => {
        if (acc.id === accountId) {
          const updated = {
            ...acc,
            profiles: acc.profiles.map(p => {
              if (p.id === profileId) {
                return {
                  ...p,
                  assignedCustomerId: customerId,
                  subscriptionId: customerId ? subscriptionId ?? p.subscriptionId : undefined,
                  status: (customerId ? 'Assigned' : 'Available') as 'Assigned' | 'Available',
                  pin: pin !== undefined ? pin : p.pin,
                  updatedAt: new Date().toISOString(),
                };
              }
              return p;
            }),
          };
          return updated;
        }
        return acc;
      })
    );

    if (subscription) {
      setSubscriptions(previous => previous.map(item => item.id === subscription.id ? {
        ...item,
        accountId: customerId ? accountId : undefined,
        profileId: customerId ? profileId : undefined,
        updatedAt: new Date().toISOString(),
      } : item));
    } else if (!customerId && profile.subscriptionId) {
      setSubscriptions(previous => previous.map(item => item.id === profile.subscriptionId ? {
        ...item,
        accountId: undefined,
        profileId: undefined,
        updatedAt: new Date().toISOString(),
      } : item));
    }

    if (customerChanged) {
      const changedCustomerId = customerId || profile.assignedCustomerId;
      const customer = changedCustomerId ? getCustomerById(changedCustomerId) : undefined;
      const service = getServiceById(account.serviceId);
      const customerName = getCustomerDisplayName(customer);
      const assigning = Boolean(customerId);
      logActivity({
        type: assigning ? 'profile_assigned' : 'profile_unassigned',
        title: assigning ? 'Profile Assigned' : 'Profile Unassigned',
        description: assigning
          ? `${customerName} assigned to ${service?.name || account.plan} · ${profile.profileName}.`
          : `${customerName} unassigned from ${service?.name || account.plan} · ${profile.profileName}.`,
        customerName,
        serviceName: service?.name,
        entityId: profileId,
        customerId: changedCustomerId,
        serviceId: account.serviceId,
        accountId,
        profileId,
        subscriptionId: subscription?.id || profile.subscriptionId,
        metadata: { profileName: profile.profileName },
      });
      addNotification({
        type: assigning ? 'profile_assigned' : 'profile_unassigned',
        category: 'account',
        priority: 'info',
        title: assigning ? 'Profile assigned' : 'Profile unassigned',
        message: assigning
          ? `${customerName} was assigned to ${service?.name || 'this service'} · ${profile.profileName}.`
          : `${customerName} was removed from ${service?.name || 'this service'} · ${profile.profileName}.`,
        entityType: 'profile',
        entityId: profileId,
        customerId: changedCustomerId,
        serviceId: account.serviceId,
        accountId,
        profileId,
        subscriptionId: subscription?.id || profile.subscriptionId,
        section: 'profiles',
      });
    }
  };

  // Subscriptions
  const addSubscription = (
    subData: Omit<Subscription, 'id' | 'createdAt' | 'expiryDate'> & { expiryDate?: string }
  ): Subscription => {
    const expiryDate = subData.expiryDate || calculateExpiryDate(subData.startDate, subData.durationDays);
    const newSub: Subscription = {
      ...subData,
      id: createRecordId('subscription'),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      planId: getPlanId(subData.serviceId, subData.plan) || subData.planId,
      expiryDate,
      createdAt: getTodayDateString(),
      createdBy: currentUser?.uid || 'admin',
    };
    setSubscriptions(prev => [newSub, ...prev]);

    // Update profile assignment if designated
    if (subData.accountId && subData.profileId) {
      assignCustomerToProfile(subData.accountId, subData.profileId, subData.customerId);
      setAccounts(previous => previous.map(account => account.id === subData.accountId ? {
        ...account,
        profiles: account.profiles.map(profile => profile.id === subData.profileId
          ? { ...profile, subscriptionId: newSub.id }
          : profile),
      } : account));
    }

    const cust = getCustomerById(subData.customerId);
    const srv = getServiceById(subData.serviceId);
    logActivity({
      type: 'subscription_updated',
      title: 'Subscription Created',
      description: `${srv?.name || 'Service'} subscription created for ${getCustomerDisplayName(cust)}.`,
      customerName: getCustomerDisplayName(cust),
      serviceName: srv?.name,
      entityId: newSub.id,
      customerId: newSub.customerId,
      serviceId: newSub.serviceId,
      planId: newSub.planId,
      accountId: newSub.accountId,
      profileId: newSub.profileId,
      subscriptionId: newSub.id,
      saleId: newSub.saleId,
      paymentId: newSub.paymentId,
      amount: newSub.price,
      currency: newSub.currency,
      metadata: { planName: newSub.plan, startDate: newSub.startDate, expiryDate: newSub.expiryDate },
    });
    addNotification({
      dedupeKey: `subscription-created-${newSub.id}`,
      type: 'subscription_created',
      category: 'subscription',
      priority: 'success',
      title: 'Subscription created',
      message: `${srv?.name || 'Service'} subscription created for ${getCustomerDisplayName(cust)}.`,
      entityType: 'subscription',
      entityId: newSub.id,
      customerId: newSub.customerId,
      serviceId: newSub.serviceId,
      subscriptionId: newSub.id,
      saleId: newSub.saleId,
      section: 'subscriptions',
    });

    return newSub;
  };

  const updateSubscription = (id: string, updates: Partial<Subscription>, recordActivity = true) => {
    const previousSubscription = subscriptions.find(subscription => subscription.id === id);
    if (!previousSubscription) return;
    const updatedSubscription = {
      ...previousSubscription,
      ...updates,
      id: previousSubscription.id,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      ...((updates.serviceId || updates.plan) ? {
        planId: getPlanId(updates.serviceId || previousSubscription.serviceId, updates.plan || previousSubscription.plan),
      } : {}),
    };
    if (updates.startDate || updates.durationDays) {
      updatedSubscription.expiryDate = calculateExpiryDate(updatedSubscription.startDate, updatedSubscription.durationDays);
    }
    setSubscriptions(prev =>
      prev.map(s => {
        if (s.id === id) {
          return updatedSubscription;
        }
        return s;
      })
    );
    const changedFields = (['plan', 'serviceId', 'accountId', 'profileId', 'startDate', 'expiryDate', 'durationDays', 'price', 'paymentStatus', 'status'] as const)
      .filter(field => previousSubscription[field] !== updatedSubscription[field]);
    if (recordActivity && changedFields.length > 0) {
      const customer = getCustomerById(updatedSubscription.customerId);
      const service = getServiceById(updatedSubscription.serviceId);
      logActivity({
        type: 'subscription_updated',
        title: updatedSubscription.status === 'cancelled'
          ? 'Subscription Cancelled'
          : updatedSubscription.status === 'expired' && previousSubscription.status !== 'expired'
            ? 'Subscription Expired' : 'Subscription Updated',
        description: `${service?.name || 'Subscription'} for ${getCustomerDisplayName(customer)} was updated.`,
        customerName: getCustomerDisplayName(customer),
        serviceName: service?.name,
        entityId: id,
        customerId: updatedSubscription.customerId,
        serviceId: updatedSubscription.serviceId,
        planId: updatedSubscription.planId,
        accountId: updatedSubscription.accountId,
        profileId: updatedSubscription.profileId,
        subscriptionId: id,
        saleId: updatedSubscription.saleId,
        paymentId: updatedSubscription.paymentId,
        amount: updatedSubscription.price,
        currency: updatedSubscription.currency,
        metadata: {
          changedFields: changedFields.join(', '),
          beforePlan: previousSubscription.plan,
          afterPlan: updatedSubscription.plan,
          beforeExpiryDate: previousSubscription.expiryDate,
          afterExpiryDate: updatedSubscription.expiryDate,
          beforePrice: previousSubscription.price,
          afterPrice: updatedSubscription.price,
          beforePaymentStatus: previousSubscription.paymentStatus,
          afterPaymentStatus: updatedSubscription.paymentStatus,
        },
      });
    }
  };

  const deleteSubscription = (id: string) => {
    const subscription = subscriptions.find(item => item.id === id);
    if (!subscription) return;
    const customer = getCustomerById(subscription.customerId);
    logActivity({
      type: 'subscription_deleted',
      title: 'Subscription Deleted',
      description: `Subscription ${subscription.plan} for ${getCustomerDisplayName(customer)} was deleted.`,
      entityId: id,
      customerId: subscription.customerId,
      subscriptionId: id,
      serviceId: subscription.serviceId,
      amount: subscription.price,
      currency: subscription.currency,
      metadata: {
        ...(subscription.status ? { status: subscription.status } : {}),
        expiryDate: subscription.expiryDate,
      },
    });
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const renewSubscription = (
    subscriptionId: string,
    additionalDays: number,
    price: number,
    paymentMethod: PaymentMethod,
    transactionId?: string
  ) => {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return;
    const configuredMethods = normalizePaymentMethods(settings.paymentPreferences?.methods).filter(method => method.enabled);
    if (!configuredMethods.some(method => method.name === paymentMethod)) {
      throw new Error('This payment method is not active in Settings.');
    }
    if (paymentMethodRequiresTransactionId(paymentMethod, configuredMethods, settings.paymentPreferences?.requireTransactionId)
      && !transactionId?.trim()) {
      throw new Error('A transaction ID is required for this payment method.');
    }
    const normalizedTransactionId = transactionId?.trim().toLocaleLowerCase();
    if (normalizedTransactionId && payments.some(payment =>
      payment.transactionId?.trim().toLocaleLowerCase() === normalizedTransactionId
    )) {
      throw new Error('A payment with this transaction ID already exists. Review the existing payment before continuing.');
    }

    const baseDate =
      new Date(sub.expiryDate).getTime() > new Date().getTime()
        ? sub.expiryDate
        : getTodayDateString();

    const newExpiry = calculateExpiryDate(baseDate, additionalDays);

    updateSubscription(subscriptionId, {
      expiryDate: newExpiry,
      durationDays: sub.durationDays + additionalDays,
      paymentStatus: 'paid',
    }, false);

    // Create a renewal sale record
    const invoiceNo = generateInvoiceNo([
      ...sales.map(sale => sale.invoiceNo),
      ...invoices.map(invoice => invoice.invoiceNumber),
    ], settings.invoicePreferences?.prefix || 'INV-');
    const newSale: Sale = {
      id: createRecordId('sale'),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      subscriptionId: sub.id,
      planId: sub.planId,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      plan: `${sub.plan} (Renewal)`,
      amount: price,
      currency: sub.currency,
      paymentMethod,
      ...getPaymentMethodSnapshot(paymentMethod),
      paymentStatus: 'paid',
      date: getTodayDateString(),
      invoiceNo,
      transactionId,
      notes: `Subscription renewed for ${additionalDays} days.`,
      createdBy: currentUser?.uid || 'admin',
      createdAt: getTodayDateString(),
    };
    setSales(prev => [newSale, ...prev]);

    // Record payment
    const newPayment: Payment = {
      id: createRecordId('payment'),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      customerId: sub.customerId,
      invoiceId: `invoice-${newSale.id}`,
      saleId: newSale.id,
      subscriptionId: sub.id,
      amount: price,
      currency: sub.currency,
      paymentMethod,
      transactionId: transactionId || '',
      paymentDate: getTodayDateString(),
      paymentStatus: 'paid',
      notes: `Renewal payment for ${invoiceNo}`,
      createdBy: currentUser?.uid || 'admin',
      createdAt: getTodayDateString(),
    };
    setPayments(prev => [newPayment, ...prev]);
    const renewalInvoice = {
      ...createInvoiceRecord(
        newSale,
        [newPayment],
        undefined,
        currentBusiness?.businessId,
        newPayment.invoiceId
      ),
      creationLogPending: true,
    };
    setInvoices(previous => [renewalInvoice, ...previous.filter(invoice => invoice.saleId !== newSale.id)]);

    const cust = getCustomerById(sub.customerId);
    const srv = getServiceById(sub.serviceId);
    logActivity({
      type: 'invoice_created',
      title: 'Invoice Created',
      description: `Invoice ${invoiceNo} created for renewal sale ${newSale.id}.`,
      entityType: 'invoice',
      entityId: renewalInvoice.invoiceId,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      invoiceNumber: invoiceNo,
      amount: price,
      currency: sub.currency,
      metadata: { totalAmount: price, paidAmount: price, dueAmount: 0 },
    });
    logActivity({
      type: 'subscription_renewed',
      title: 'Subscription Renewed',
      description: `${srv?.name || 'Service'} renewed for ${getCustomerDisplayName(cust)} (+${additionalDays} days).`,
      customerName: getCustomerDisplayName(cust),
      serviceName: srv?.name || 'Service',
      entityId: sub.id,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      planId: sub.planId,
      accountId: sub.accountId,
      profileId: sub.profileId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      invoiceNumber: invoiceNo,
      amount: price,
      currency: sub.currency,
      metadata: { planName: sub.plan, expiryDate: newExpiry, renewalDays: additionalDays },
    });
    logActivity({
      type: 'sale_created',
      title: 'Renewal Sale Created',
      description: `Renewal sale ${invoiceNo} was recorded for ${getCustomerDisplayName(cust)}.`,
      customerName: getCustomerDisplayName(cust),
      serviceName: srv?.name,
      entityId: newSale.id,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      planId: sub.planId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      invoiceNumber: invoiceNo,
      amount: price,
      currency: sub.currency,
      metadata: { totalAmount: price, paidAmount: price, dueAmount: 0, paymentStatus: 'paid' },
    });
    logActivity({
      type: 'payment_received',
      title: 'Payment Received',
      description: `${formatCurrency(price, sub.currency)} received for renewal ${invoiceNo} from ${getCustomerDisplayName(cust)} via ${paymentMethod}.`,
      customerName: getCustomerDisplayName(cust),
      serviceName: srv?.name,
      entityId: newPayment.id,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      invoiceNumber: invoiceNo,
      amount: price,
      currency: sub.currency,
      metadata: { amount: price, paymentMethod, status: 'paid' },
    });
    logActivity({
      type: 'invoice_paid',
      title: 'Invoice Marked Paid',
      description: `Renewal invoice ${invoiceNo} was paid in full.`,
      customerName: getCustomerDisplayName(cust),
      serviceName: srv?.name,
      entityId: renewalInvoice.invoiceId,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      invoiceNumber: invoiceNo,
      amount: price,
      currency: sub.currency,
      metadata: { totalAmount: price, paidAmount: price, dueAmount: 0 },
    });
    addNotification({
      dedupeKey: `invoice-created-${renewalInvoice.invoiceId}`,
      type: 'invoice_created',
      category: 'invoice',
      priority: 'info',
      title: 'Invoice created',
      message: `Invoice ${invoiceNo} was created for ${getCustomerDisplayName(cust)}.`,
      entityType: 'invoice',
      entityId: renewalInvoice.invoiceId,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      section: 'invoices',
    });
    addNotification({
      dedupeKey: `invoice-paid-${renewalInvoice.invoiceId}`,
      type: 'invoice_payment_completed',
      category: 'invoice',
      priority: 'success',
      title: 'Invoice payment completed',
      message: `Invoice ${invoiceNo} has been paid in full.`,
      entityType: 'invoice',
      entityId: renewalInvoice.invoiceId,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      section: 'invoices',
    });
    addNotification({
      dedupeKey: `renewal-completed-${newSale.id}`,
      type: 'renewal_completed',
      category: 'subscription',
      priority: 'success',
      title: 'Renewal completed',
      message: `${srv?.name || 'Subscription'} renewed for ${getCustomerDisplayName(cust)}.`,
      entityType: 'subscription',
      entityId: sub.id,
      customerId: sub.customerId,
      serviceId: sub.serviceId,
      subscriptionId: sub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: renewalInvoice.invoiceId,
      section: 'subscriptions',
    });
  };

  // Full Sales Workflow
  const createSale = (
    payload: NewSalePayload
  ): { subscription: Subscription; sale: Sale; payment: Payment; invoice: Invoice } => {
    assertFinancialDateOpen(getTodayDateString());
    const customer = customers.find(item => item.id === payload.customerId && !item.isArchived && item.status !== 'archived');
    const service = services.find(item => item.id === payload.serviceId);
    const plan = service?.planDetails?.find(item => item.id === payload.planId && item.status === 'active');
    if (!customer || !service || (payload.planId && (
      service.status !== 'active' || service.isArchived
      || service.settings?.subscriptionEnabled === false
      || service.advanced?.allowNewSubscriptions === false
      || service.advanced?.showInNewSale === false
    ))) {
      throw new Error('The selected customer or service is not available.');
    }
    if (payload.planId && (!plan || plan.name !== payload.plan)) {
      throw new Error('The selected plan is no longer available.');
    }
    const subtotal = Math.round(Number(payload.subtotal ?? payload.price) * 100) / 100;
    const discount = Math.round(Number(payload.discount ?? 0) * 100) / 100;
    const amountPaid = Math.round(Number(payload.amountPaid ?? (payload.paymentStatus === 'paid' ? payload.price : 0)) * 100) / 100;
    if (!Number.isFinite(payload.price) || payload.price <= 0
      || !Number.isFinite(subtotal) || subtotal < 0
      || !Number.isFinite(discount) || discount < 0 || discount > subtotal
      || Math.abs(subtotal - discount - payload.price) > 0.01
      || !Number.isFinite(amountPaid)
      || amountPaid < 0
      || amountPaid > payload.price
      || (payload.paymentStatus === 'failed' && amountPaid > 0)
      || payload.paymentStatus === 'refunded'
      || !Number.isSafeInteger(payload.durationDays) || payload.durationDays < 1
      || !Number.isFinite(Date.parse(`${payload.startDate}T00:00:00`))) {
      throw new Error('The sale amount or subscription period is invalid.');
    }
    const paymentStatus: PaymentStatus = payload.paymentStatus === 'failed'
      ? 'failed'
      : amountPaid >= payload.price
        ? 'paid'
        : amountPaid > 0
          ? 'partial'
          : 'pending';
    if (payload.operationId) {
      const priorSale = sales.find(item => item.operationId === payload.operationId);
      if (priorSale) {
        const priorSubscription = subscriptions.find(item => item.id === priorSale.subscriptionId);
        const priorPayment = payments.find(item => item.id === priorSale.paymentId);
        if (priorSubscription && priorPayment) {
          return {
            subscription: priorSubscription,
            sale: priorSale,
            payment: priorPayment,
            invoice: ensureInvoiceForSale(priorSale.id),
          };
        }
        throw new Error('This sale operation has already been recorded but its linked records are incomplete.');
      }
    }
    const configuredMethods = normalizePaymentMethods(settings.paymentPreferences?.methods).filter(method => method.enabled);
    if (!configuredMethods.some(method => method.name === payload.paymentMethod)) {
      throw new Error('This payment method is not active in Settings.');
    }
    if (paymentMethodRequiresTransactionId(payload.paymentMethod, configuredMethods, settings.paymentPreferences?.requireTransactionId)
      && !payload.transactionId?.trim()) {
      throw new Error('A transaction ID is required for this payment method.');
    }
    const transactionId = payload.transactionId?.trim().toLocaleLowerCase();
    if (transactionId && payments.some(payment => payment.transactionId?.trim().toLocaleLowerCase() === transactionId)) {
      throw new Error('A payment with this transaction ID already exists. Review the existing payment before continuing.');
    }
    if (payload.renewalOfSubscriptionId) {
      const source = subscriptions.find(item => item.id === payload.renewalOfSubscriptionId);
      if (!source || source.customerId !== payload.customerId || source.serviceId !== payload.serviceId || source.status === 'cancelled') {
        throw new Error('The subscription being renewed is no longer available.');
      }
    }
    const profileRequired = Boolean(service.settings?.usesProfiles || service.settings?.profileAssignmentRequired);
    if (payload.planId && (service.settings?.usesAccounts || profileRequired) && !payload.accountId) {
      throw new Error('An account is required for this service.');
    }
    const account = payload.accountId ? accounts.find(item =>
      item.id === payload.accountId
      && item.serviceId === service.id
      && (!payload.planId || !item.planId || item.planId === payload.planId)
      && isAccountOperational(item)
    ) : undefined;
    if (payload.accountId && !account) {
      throw new Error('The selected account is no longer available.');
    }
    if (account && account.allowNewAssignment === false && !payload.renewalOfSubscriptionId) {
      throw new Error('New assignments are disabled for the selected account.');
    }
    const profile = account && payload.profileId
      ? account.profiles?.find(item => item.id === payload.profileId
        && (item.status === 'Available' && !item.assignedCustomerId
          || item.assignedCustomerId === payload.customerId)
        && (!item.expiryDate || getDaysDifference(item.expiryDate) >= 0))
      : undefined;
    if (payload.planId && profileRequired && !profile) {
      throw new Error('An available profile is required for this service.');
    }
    if (payload.accountId && account && profileRequired && getAccountCapacity(account).available <= 0
      && !account.profiles.some(item => item.id === payload.profileId && item.assignedCustomerId === payload.customerId)) {
      throw new Error('The selected account has no profile capacity available.');
    }
    if (payload.profileId && !profile) {
      throw new Error('The selected profile is no longer available.');
    }
    if (profile?.assignedCustomerId && profile.status === 'Assigned') {
      const renewingSameAssignment = Boolean(payload.renewalOfSubscriptionId
        && profile.assignedCustomerId === payload.customerId
        && (profile.subscriptionId === payload.renewalOfSubscriptionId
          || (!profile.subscriptionId && subscriptions.some(subscription =>
            subscription.id === payload.renewalOfSubscriptionId
            && subscription.accountId === payload.accountId
            && subscription.profileId === payload.profileId
            && subscription.customerId === payload.customerId
          ))));
      if (!renewingSameAssignment) throw new Error('This profile is already assigned to an active subscription.');
    }

    const invoiceNo = generateInvoiceNo([
      ...sales.map(sale => sale.invoiceNo),
      ...invoices.map(invoice => invoice.invoiceNumber),
    ], settings.invoicePreferences?.prefix || 'INV-');
    const expiryDate = calculateExpiryDate(payload.startDate, payload.durationDays);
    const saleId = createRecordId('sale');
    const subscriptionId = createRecordId('subscription');
    const paymentId = createRecordId('payment');

    // 1. Create Subscription
    const newSub: Subscription = {
      id: subscriptionId,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      saleId,
      paymentId,
      renewedFromSubscriptionId: payload.renewalOfSubscriptionId,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      accountId: payload.accountId,
      profileId: payload.profileId,
      planId: payload.planId || getPlanId(payload.serviceId, payload.plan),
      plan: payload.plan,
      startDate: payload.startDate,
      durationDays: payload.durationDays,
      expiryDate,
      price: payload.price,
      currency: payload.currency,
      paymentStatus,
      notes: payload.notes,
      createdAt: getTodayDateString(),
      createdBy: currentUser?.uid || 'admin',
    };

    // 2. Create Sale
    const newSale: Sale = {
      id: saleId,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      subscriptionId: newSub.id,
      renewalOfSubscriptionId: payload.renewalOfSubscriptionId,
      operationId: payload.operationId,
      paymentId,
      planId: newSub.planId,
      accountId: payload.accountId,
      profileId: payload.profileId,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      plan: payload.plan,
      amount: payload.price,
      subtotal,
      discount,
      amountPaid,
      currency: payload.currency,
      paymentMethod: payload.paymentMethod,
      ...getPaymentMethodSnapshot(payload.paymentMethod),
      paymentStatus,
      date: getTodayDateString(),
      invoiceNo,
      transactionId: payload.transactionId || '',
      senderNumber: payload.senderNumber || '',
      notes: payload.notes || '',
      createdBy: currentUser?.uid || 'admin',
      createdAt: new Date().toISOString(),
    };

    // 3. Create Payment
    const invoiceId = `invoice-${newSale.id}`;
    const newPayment: Payment = {
      id: paymentId,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      customerId: payload.customerId,
      invoiceId,
      saleId: newSale.id,
      subscriptionId: newSub.id,
      amount: amountPaid,
      currency: payload.currency,
      paymentMethod: payload.paymentMethod,
      transactionId: payload.transactionId || '',
      senderNumber: payload.senderNumber || '',
      paymentDate: getTodayDateString(),
      paymentStatus,
      notes: payload.paymentNote || `Sale payment: ${invoiceNo}`,
      createdBy: currentUser?.uid || 'admin',
      createdAt: new Date().toISOString(),
    };

    // Update state
    setSubscriptions(prev => [newSub, ...prev]);
    setSales(prev => [newSale, ...prev]);
    setPayments(prev => [newPayment, ...prev]);
    const newInvoice = {
      ...createInvoiceRecord(
      newSale,
      [newPayment],
      undefined,
      currentBusiness?.businessId,
      invoiceId
      ),
      creationLogPending: true,
    };
    setInvoices(previous => [newInvoice, ...previous.filter(invoice => invoice.saleId !== newSale.id)]);
    logActivity({
      type: 'invoice_created',
      title: 'Invoice Created',
      description: `Invoice ${invoiceNo} created for sale ${newSale.id}.`,
      entityType: 'invoice',
      entityId: newInvoice.invoiceId,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      subscriptionId: newSub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: newInvoice.invoiceId,
      invoiceNumber: invoiceNo,
      amount: payload.price,
      currency: payload.currency,
      metadata: { totalAmount: payload.price, paidAmount: amountPaid, dueAmount: payload.price - amountPaid },
    });


    // Update profile assignment if selected
    if (payload.accountId && payload.profileId) {
      assignCustomerToProfile(payload.accountId, payload.profileId, payload.customerId);
      setAccounts(previous => previous.map(account => account.id === payload.accountId ? {
        ...account,
        profiles: account.profiles.map(profile => profile.id === payload.profileId
          ? { ...profile, subscriptionId: newSub.id }
          : profile),
      } : account));
    }

    const cust = getCustomerById(payload.customerId);
    const srv = getServiceById(payload.serviceId);

    if (payload.renewalOfSubscriptionId) {
      logActivity({
        type: 'subscription_renewed',
        title: 'Subscription Renewed',
        description: `Renewal ${invoiceNo} recorded for ${getCustomerDisplayName(cust)} (${srv?.name || 'Service'}) - total ${formatCurrency(payload.price, payload.currency)}.`,
        customerName: getCustomerDisplayName(cust),
        serviceName: srv?.name || 'Service',
        entityId: payload.renewalOfSubscriptionId,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        planId: newSub.planId,
        accountId: payload.accountId,
        profileId: payload.profileId,
        subscriptionId: payload.renewalOfSubscriptionId,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        invoiceNumber: invoiceNo,
        amount: payload.price,
        currency: payload.currency,
        metadata: { totalAmount: payload.price, paidAmount: amountPaid, dueAmount: payload.price - amountPaid, paymentStatus },
      });
    } else {
      logActivity({
        type: 'sale_created',
        title: 'Sale Created',
        description: `Sale ${invoiceNo} recorded for ${getCustomerDisplayName(cust)} (${srv?.name || 'Service'}) - total ${formatCurrency(payload.price, payload.currency)}.`,
        customerName: getCustomerDisplayName(cust),
        serviceName: srv?.name || 'Service',
        entityId: newSale.id,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        planId: newSub.planId,
        accountId: payload.accountId,
        profileId: payload.profileId,
        subscriptionId: newSub.id,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        invoiceNumber: invoiceNo,
        amount: payload.price,
        currency: payload.currency,
        metadata: { totalAmount: payload.price, paidAmount: amountPaid, dueAmount: payload.price - amountPaid, paymentStatus },
      });
      logActivity({
        type: 'subscription_created',
        title: 'Subscription Created',
        description: `Subscription for ${srv?.name || 'Service'} created for ${getCustomerDisplayName(cust)} from sale ${invoiceNo}.`,
        customerName: getCustomerDisplayName(cust),
        serviceName: srv?.name || 'Service',
        entityId: newSub.id,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        planId: newSub.planId,
        accountId: payload.accountId,
        profileId: payload.profileId,
        subscriptionId: newSub.id,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        invoiceNumber: invoiceNo,
        amount: payload.price,
        currency: payload.currency,
        metadata: { planName: payload.plan, startDate: newSub.startDate, expiryDate: newSub.expiryDate },
      });
    }
    if (amountPaid > 0 || paymentStatus === 'failed' || paymentStatus === 'pending') {
      logActivity({
        type: paymentStatus === 'paid' ? 'payment_received' : 'payment_recorded',
        title: paymentStatus === 'failed' ? 'Payment Failed'
          : paymentStatus === 'partial' ? 'Payment Partially Received'
            : paymentStatus === 'paid' ? 'Payment Received' : 'Payment Created',
        description: paymentStatus === 'pending'
          ? `A payment record was created for sale ${invoiceNo} for ${getCustomerDisplayName(cust)}.`
          : `${formatCurrency(amountPaid, payload.currency)} recorded for sale ${invoiceNo} from ${getCustomerDisplayName(cust)} via ${payload.paymentMethod}.`,
        customerName: getCustomerDisplayName(cust),
        serviceName: srv?.name || 'Service',
        entityId: newPayment.id,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        planId: newSub.planId,
        accountId: payload.accountId,
        profileId: payload.profileId,
        subscriptionId: newSub.id,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        invoiceNumber: invoiceNo,
        amount: amountPaid,
        currency: payload.currency,
        metadata: { amount: amountPaid, paymentMethod: payload.paymentMethod, status: paymentStatus },
      });
    }
    if (paymentStatus === 'paid') {
      logActivity({
        type: 'sale_completed',
        title: 'Sale Completed',
        description: `Sale ${invoiceNo} was paid in full by ${getCustomerDisplayName(cust)}.`,
        customerName: getCustomerDisplayName(cust),
        serviceName: srv?.name,
        entityId: newSale.id,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        planId: newSub.planId,
        subscriptionId: newSub.id,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        invoiceNumber: invoiceNo,
        amount: payload.price,
        currency: payload.currency,
        metadata: { totalAmount: payload.price, paidAmount: amountPaid, dueAmount: 0, paymentStatus },
      });
      logActivity({
        type: 'invoice_paid',
        title: 'Invoice Marked Paid',
        description: `Invoice ${invoiceNo} was paid in full.`,
        customerName: getCustomerDisplayName(cust),
        serviceName: srv?.name,
        entityId: newInvoice.invoiceId,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        planId: newSub.planId,
        subscriptionId: newSub.id,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        invoiceNumber: invoiceNo,
        amount: payload.price,
        currency: payload.currency,
        metadata: { totalAmount: payload.price, paidAmount: amountPaid, dueAmount: 0 },
      });
    }
    addNotification({
      dedupeKey: `sale-created-${newSale.id}`,
      type: 'sale_created',
      category: 'payment',
      priority: 'success',
      title: payload.renewalOfSubscriptionId ? 'Renewal sale recorded' : 'New sale recorded',
      message: `${invoiceNo} recorded for ${getCustomerDisplayName(cust)}.`,
      entityType: 'sale',
      entityId: newSale.id,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      subscriptionId: newSub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: newInvoice.invoiceId,
      section: 'sales',
    });
    addNotification({
      dedupeKey: `invoice-created-${newInvoice.invoiceId}`,
      type: 'invoice_created',
      category: 'invoice',
      priority: 'info',
      title: 'Invoice created',
      message: `Invoice ${invoiceNo} was created for ${getCustomerDisplayName(cust)}.`,
      entityType: 'invoice',
      entityId: newInvoice.invoiceId,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      subscriptionId: newSub.id,
      saleId: newSale.id,
      paymentId: newPayment.id,
      invoiceId: newInvoice.invoiceId,
      section: 'invoices',
    });
    if (paymentStatus === 'paid') {
      addNotification({
        dedupeKey: `invoice-paid-${newInvoice.invoiceId}`,
        type: 'invoice_payment_completed',
        category: 'invoice',
        priority: 'success',
        title: 'Invoice payment completed',
        message: `Invoice ${invoiceNo} has been paid in full.`,
        entityType: 'invoice',
        entityId: newInvoice.invoiceId,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        subscriptionId: newSub.id,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        section: 'invoices',
      });
    }
    if (payload.renewalOfSubscriptionId) {
      addNotification({
        dedupeKey: `renewal-completed-${newSale.id}`,
        type: 'renewal_completed',
        category: 'subscription',
        priority: 'success',
        title: 'Renewal completed',
        message: `${srv?.name || 'Subscription'} renewed for ${getCustomerDisplayName(cust)}.`,
        entityType: 'subscription',
        entityId: payload.renewalOfSubscriptionId,
        customerId: payload.customerId,
        serviceId: payload.serviceId,
        subscriptionId: payload.renewalOfSubscriptionId,
        saleId: newSale.id,
        paymentId: newPayment.id,
        invoiceId: newInvoice.invoiceId,
        section: 'subscriptions',
      });
    }

    return { subscription: newSub, sale: newSale, payment: newPayment, invoice: newInvoice };
  };

  const deleteSale = (id: string) => {
    const sale = sales.find(item => item.id === id);
    if (!sale) return;
    const customer = getCustomerById(sale.customerId);
    const invoice = invoices.find(item => item.saleId === id);
    logActivity({
      type: 'sale_deleted',
      title: 'Sale Deleted',
      description: `Sale ${sale.invoiceNo} for ${getCustomerDisplayName(customer)} was deleted.`,
      entityId: id,
      customerId: sale.customerId,
      subscriptionId: sale.subscriptionId,
      saleId: id,
      paymentId: sale.paymentId,
      invoiceId: invoice?.invoiceId,
      invoiceNumber: invoice?.invoiceNumber || sale.invoiceNo,
      amount: sale.amount,
      currency: sale.currency,
      metadata: { paymentStatus: sale.paymentStatus, plan: sale.plan },
    });
    setSales(prev => prev.filter(s => s.id !== id));
  };

  const recordSalePayment = (
    saleId: string,
    paymentData: Omit<Payment, 'id' | 'saleId' | 'subscriptionId'> & { operationId?: string }
  ): Payment => {
    const duplicate = paymentData.operationId
      ? payments.find(payment => payment.operationId === paymentData.operationId)
      : undefined;
    if (duplicate) {
      if (
        duplicate.saleId !== saleId
        || duplicate.customerId !== paymentData.customerId
        || duplicate.currency !== paymentData.currency
      ) {
        throw new Error('This payment operation is already linked to another sale.');
      }
      return duplicate;
    }

    const transactionId = paymentData.transactionId?.trim().toLocaleLowerCase();
    if (transactionId && payments.some(payment =>
      payment.transactionId?.trim().toLocaleLowerCase() === transactionId
    )) {
      throw new Error('A payment with this transaction ID already exists. Review the existing payment before continuing.');
    }

    const sale = sales.find(item => item.id === saleId);
    if (!sale) throw new Error('The sale could not be found.');
    if (currentBusiness?.businessId && sale.businessId !== currentBusiness.businessId) {
      throw new Error('This sale does not belong to the current business.');
    }
    if (sale.paymentStatus === 'refunded') throw new Error('Payments cannot be added to a refunded sale.');
    if (!customers.some(customer => customer.id === sale.customerId)) {
      throw new Error('The customer linked to this sale could not be found.');
    }
    const allowedMethods = normalizePaymentMethods(settings.paymentPreferences?.methods).filter(method => method.enabled);
    if (!allowedMethods.some(method => method.name === paymentData.paymentMethod)) {
      throw new Error('This payment method is not active in Settings.');
    }
    if (paymentMethodRequiresTransactionId(paymentData.paymentMethod, allowedMethods, settings.paymentPreferences?.requireTransactionId) && !paymentData.transactionId?.trim()) {
      throw new Error('A transaction ID is required by payment settings.');
    }
    const [paymentYear, paymentMonth, paymentDay] = paymentData.paymentDate.split('-').map(Number);
    const parsedPaymentDate = new Date(paymentYear, paymentMonth - 1, paymentDay);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentData.paymentDate)
      || !Number.isFinite(parsedPaymentDate.getTime())
      || parsedPaymentDate.getFullYear() !== paymentYear
      || parsedPaymentDate.getMonth() !== paymentMonth - 1
      || parsedPaymentDate.getDate() !== paymentDay
      || paymentData.paymentDate > getTodayDateString()) {
      throw new Error('Choose a valid payment date that is not in the future.');
    }
    assertFinancialDateOpen(paymentData.paymentDate);
    if (paymentData.customerId !== sale.customerId || paymentData.currency !== sale.currency) {
      throw new Error('Payment customer and currency must match the sale.');
    }
    if (!['paid', 'pending', 'failed'].includes(paymentData.paymentStatus)) {
      throw new Error('Choose received, pending, or failed for a new payment attempt.');
    }

    const amount = Math.round(Number(paymentData.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Enter a valid payment amount greater than zero.');
    }
    const recordedPaid = getSalePaidAmount(sale, payments);
    const due = Math.round(Math.max(0, sale.amount - recordedPaid) * 100) / 100;
    if (amount > due) throw new Error('Payment amount cannot exceed the outstanding balance.');

    const invoice = ensureInvoiceForSale(saleId);
    const newPayment: Payment = {
      ...paymentData,
      ...getPaymentMethodSnapshot(paymentData.paymentMethod),
      id: createRecordId('payment'),
      saleId,
      subscriptionId: sale.subscriptionId,
      invoiceId: invoice.invoiceId,
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      createdBy: currentUser?.uid || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const amountPaid = Math.round((recordedPaid + amount) * 100) / 100;
    const paymentStatus: PaymentStatus = paymentData.paymentStatus === 'paid'
      ? amountPaid >= sale.amount ? 'paid' : 'partial'
      : recordedPaid >= sale.amount ? 'paid' : recordedPaid > 0 ? 'partial' : 'pending';
    const recognizedPaid = paymentData.paymentStatus === 'paid' ? amountPaid : recordedPaid;
    const recognizedDue = Math.max(0, sale.amount - recognizedPaid);

    setPayments(previous => [newPayment, ...previous]);
    setSales(previous => previous.map(item => item.id === saleId
      ? {
        ...item,
        ...(paymentData.paymentStatus === 'paid' ? { amountPaid } : {}),
        paymentStatus,
        updatedAt: new Date().toISOString(),
      }
      : item
    ));
    if (sale.subscriptionId) {
      setSubscriptions(previous => previous.map(subscription => subscription.id === sale.subscriptionId
        ? { ...subscription, paymentStatus, updatedAt: new Date().toISOString() }
        : subscription
      ));
    }

    const customer = getCustomerById(sale.customerId);
    const paymentWasReceived = paymentData.paymentStatus === 'paid';
    logActivity({
      type: paymentWasReceived ? 'payment_received' : 'payment_recorded',
      title: paymentWasReceived
        ? paymentStatus === 'paid' ? 'Payment Received' : 'Payment Partially Received'
        : paymentData.paymentStatus === 'failed' ? 'Payment Failed' : 'Payment Pending',
      description: `${formatCurrency(amount, sale.currency)} ${paymentWasReceived ? 'received' : `recorded as ${paymentData.paymentStatus}`} for sale ${sale.invoiceNo} from ${getCustomerDisplayName(customer)} via ${newPayment.paymentMethodName || newPayment.paymentMethod}.`,
      customerName: getCustomerDisplayName(customer),
      entityId: sale.id,
      customerId: sale.customerId,
      serviceId: sale.serviceId,
      planId: sale.planId,
      accountId: sale.accountId,
      profileId: sale.profileId,
      subscriptionId: sale.subscriptionId,
      saleId: sale.id,
      paymentId: newPayment.id,
      invoiceId: newPayment.invoiceId,
      invoiceNumber: sale.invoiceNo,
      amount,
      currency: sale.currency,
      metadata: {
        amount,
        totalAmount: sale.amount,
        paidAmount: recognizedPaid,
        dueAmount: recognizedDue,
        paymentMethod: newPayment.paymentMethodName || newPayment.paymentMethod,
        status: paymentStatus,
      },
    });
    if (paymentWasReceived) {
      addNotification({
        dedupeKey: `payment-received-${newPayment.id}`,
        type: 'payment_received',
        category: 'payment',
        priority: 'success',
        title: 'Payment received',
        message: `${formatCurrency(amount, sale.currency)} via ${newPayment.paymentMethodName || newPayment.paymentMethod} received from ${getCustomerDisplayName(customer)}.`,
        entityType: 'payment',
        entityId: newPayment.id,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: newPayment.invoiceId,
        section: 'payments',
      });
    } else if (paymentData.paymentStatus === 'failed') {
      addNotification({
        dedupeKey: `payment-failed-${newPayment.id}`,
        type: 'payment_failed',
        category: 'payment',
        priority: 'critical',
        title: 'Payment failed',
        message: `Payment attempt via ${newPayment.paymentMethodName || newPayment.paymentMethod} for ${sale.invoiceNo} from ${getCustomerDisplayName(customer)} failed.`,
        entityType: 'payment',
        entityId: newPayment.id,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: newPayment.invoiceId,
        section: 'payments',
      });
    } else {
      addNotification({
        dedupeKey: `payment-pending-${newPayment.id}`,
        type: 'payment_pending',
        category: 'payment',
        priority: 'warning',
        title: 'Payment pending verification',
        message: `Payment via ${newPayment.paymentMethodName || newPayment.paymentMethod} for ${sale.invoiceNo} is awaiting verification.`,
        entityType: 'payment',
        entityId: newPayment.id,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: newPayment.invoiceId,
        section: 'payments',
      });
    }
    if (paymentStatus !== 'paid') {
      logActivity({
        type: 'invoice_due',
        title: 'Invoice Marked Due',
        description: `Invoice ${sale.invoiceNo} still has an outstanding balance.`,
        entityType: 'invoice',
        entityId: newPayment.invoiceId,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: newPayment.invoiceId,
        invoiceNumber: sale.invoiceNo,
        amount: sale.amount,
        currency: sale.currency,
        metadata: { totalAmount: sale.amount, paidAmount: recognizedPaid, dueAmount: recognizedDue },
      });
      addNotification({
        dedupeKey: `payment-due-${newPayment.id}`,
        type: 'payment_due',
        category: 'invoice',
        priority: 'warning',
        title: 'Outstanding invoice balance',
        message: `${getCustomerDisplayName(customer)} still has ${formatCurrency(recognizedDue, sale.currency)} due on ${sale.invoiceNo}.`,
        entityType: 'invoice',
        entityId: newPayment.invoiceId,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: newPayment.invoiceId,
        section: 'invoices',
      });
    }
    if (paymentStatus === 'paid') {
      const linkedInvoice = invoices.find(invoice => invoice.saleId === saleId);
      logActivity({
        type: 'sale_completed',
        title: 'Sale Completed',
        description: `Sale ${sale.invoiceNo} was paid in full by ${getCustomerDisplayName(customer)}.`,
        customerName: getCustomerDisplayName(customer),
        entityId: sale.id,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        planId: sale.planId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: linkedInvoice?.invoiceId || newPayment.invoiceId,
        invoiceNumber: sale.invoiceNo,
        amount: sale.amount,
        currency: sale.currency,
        metadata: { totalAmount: sale.amount, paidAmount: amountPaid, dueAmount: 0, paymentStatus },
      });
      logActivity({
        type: 'invoice_paid',
        title: 'Invoice Marked Paid',
        description: `Invoice ${sale.invoiceNo} was paid in full.`,
        customerName: getCustomerDisplayName(customer),
        entityId: linkedInvoice?.invoiceId || newPayment.invoiceId || `invoice-${sale.id}`,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId: sale.id,
        paymentId: newPayment.id,
        invoiceId: linkedInvoice?.invoiceId || newPayment.invoiceId,
        invoiceNumber: sale.invoiceNo,
        amount: sale.amount,
        currency: sale.currency,
        metadata: { totalAmount: sale.amount, paidAmount: amountPaid, dueAmount: 0 },
      });
      addNotification({
        dedupeKey: `invoice-paid-${linkedInvoice?.invoiceId || saleId}`,
        type: 'invoice_payment_completed',
        category: 'invoice',
        priority: 'success',
        title: 'Invoice payment completed',
        message: `Invoice ${sale.invoiceNo} has been paid in full.`,
        entityType: 'invoice',
        entityId: linkedInvoice?.invoiceId || `invoice-${saleId}`,
        customerId: sale.customerId,
        serviceId: sale.serviceId,
        subscriptionId: sale.subscriptionId,
        saleId,
        paymentId: newPayment.id,
        invoiceId: linkedInvoice?.invoiceId || `invoice-${saleId}`,
        section: 'invoices',
      });
    }
    return newPayment;
  };

  // Payments actions
  const addPayment = (paymentData: Omit<Payment, 'id'>): Payment => {
    assertFinancialDateOpen(paymentData.paymentDate);
    const newPayment: Payment = {
      ...paymentData,
      ...getPaymentMethodSnapshot(paymentData.paymentMethod),
      id: createRecordId('payment'),
      ...(paymentData.saleId && !paymentData.invoiceId
        ? { invoiceId: invoices.find(invoice => invoice.saleId === paymentData.saleId)?.invoiceId }
        : {}),
      ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
      createdBy: currentUser?.uid || 'admin',
      createdAt: paymentData.paymentDate || getTodayDateString(),
    };
    setPayments(prev => [newPayment, ...prev]);
    const customer = getCustomerById(newPayment.customerId);
    const actionText = newPayment.paymentStatus === 'paid'
      ? 'received'
      : `recorded as ${newPayment.paymentStatus}`;
    logActivity({
      type: 'payment_recorded',
      title: newPayment.paymentStatus === 'paid' ? 'Payment Received'
        : newPayment.paymentStatus === 'partial' ? 'Payment Partially Received'
          : newPayment.paymentStatus === 'failed' ? 'Payment Failed' : 'Payment Created',
      description: `${formatCurrency(newPayment.amount, newPayment.currency)} ${actionText} from ${getCustomerDisplayName(customer)} via ${newPayment.paymentMethodName || newPayment.paymentMethod}.`,
      customerName: getCustomerDisplayName(customer),
      entityId: newPayment.id,
      customerId: newPayment.customerId,
      subscriptionId: newPayment.subscriptionId,
      saleId: newPayment.saleId,
      paymentId: newPayment.id,
      invoiceId: newPayment.invoiceId,
      invoiceNumber: sales.find(sale => sale.id === newPayment.saleId)?.invoiceNo,
      amount: newPayment.amount,
      currency: newPayment.currency,
      metadata: {
        amount: newPayment.amount,
        paymentMethod: newPayment.paymentMethodName || newPayment.paymentMethod,
        ...(newPayment.paymentMethodId ? { paymentMethodId: newPayment.paymentMethodId } : {}),
        status: newPayment.paymentStatus,
      },
    });
    if (newPayment.invoiceId) {
      logActivity({
        type: newPayment.paymentStatus === 'paid' ? 'invoice_paid' : 'invoice_due',
        title: newPayment.paymentStatus === 'paid' ? 'Invoice Marked Paid' : 'Invoice Marked Due',
        description: newPayment.paymentStatus === 'paid'
          ? `Invoice ${newPayment.invoiceId} payment was received in full.`
          : `Invoice ${newPayment.invoiceId} has an outstanding balance.`,
        entityType: 'invoice',
        entityId: newPayment.invoiceId,
        customerId: newPayment.customerId,
        serviceId: sales.find(sale => sale.id === newPayment.saleId)?.serviceId,
        subscriptionId: newPayment.subscriptionId,
        saleId: newPayment.saleId,
        paymentId: newPayment.id,
        invoiceId: newPayment.invoiceId,
        amount: newPayment.amount,
        currency: newPayment.currency,
        metadata: { paymentStatus: newPayment.paymentStatus },
      });
    }
    return newPayment;
  };

  const updatePayment = (id: string, updates: Partial<Payment>) => {
    const previousPayment = payments.find(payment => payment.id === id);
    if (!previousPayment) return;
    const financialFields: (keyof Payment)[] = [
      'amount', 'currency', 'paymentMethod', 'transactionId', 'paymentDate',
      'paymentMethodId', 'paymentMethodName', 'paymentMethodCategory', 'paymentAccount',
      'paymentStatus', 'customerId', 'saleId', 'subscriptionId', 'invoiceId',
    ];
    if (financialFields.some(field => updates[field] !== undefined && updates[field] !== previousPayment[field])) {
      throw new Error('Historical payment values cannot be edited. Use a supported reversal workflow instead.');
    }
    const updatedPayment = { ...previousPayment, ...updates, id: previousPayment.id };
    setPayments(prev =>
      prev.map(p => {
        if (p.id === id) {
          const scopedUpdated = {
            ...updatedPayment,
            ...(currentBusiness?.businessId ? { businessId: currentBusiness.businessId } : {}),
          };
          return scopedUpdated;
        }
        return p;
      })
    );
    const customer = getCustomerById(updatedPayment.customerId);
    if (previousPayment.amount !== updatedPayment.amount || previousPayment.paymentStatus !== updatedPayment.paymentStatus
      || previousPayment.paymentMethod !== updatedPayment.paymentMethod || previousPayment.paymentDate !== updatedPayment.paymentDate) {
      logActivity({
        type: 'payment_updated',
        title: updatedPayment.paymentStatus === 'failed' ? 'Payment Failed'
          : previousPayment.paymentStatus !== updatedPayment.paymentStatus ? 'Payment Status Changed' : 'Payment Updated',
        description: `Payment for ${getCustomerDisplayName(customer)} was updated.`,
        entityId: id,
        customerId: updatedPayment.customerId,
        subscriptionId: updatedPayment.subscriptionId,
        saleId: updatedPayment.saleId,
        paymentId: id,
        invoiceId: updatedPayment.invoiceId,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        metadata: {
          beforeAmount: previousPayment.amount,
          afterAmount: updatedPayment.amount,
          beforeStatus: previousPayment.paymentStatus,
          afterStatus: updatedPayment.paymentStatus,
          paymentMethod: updatedPayment.paymentMethodName || updatedPayment.paymentMethod,
        },
      });
      if (previousPayment.paymentStatus !== updatedPayment.paymentStatus && updatedPayment.invoiceId) {
        logActivity({
          type: updatedPayment.paymentStatus === 'paid' ? 'invoice_paid' : 'invoice_due',
          title: updatedPayment.paymentStatus === 'paid' ? 'Invoice Marked Paid' : 'Invoice Marked Due',
          description: updatedPayment.paymentStatus === 'paid'
            ? `Invoice ${updatedPayment.invoiceId} was marked paid.`
            : `Invoice ${updatedPayment.invoiceId} has an outstanding balance.`,
          entityType: 'invoice',
          entityId: updatedPayment.invoiceId,
          customerId: updatedPayment.customerId,
          subscriptionId: updatedPayment.subscriptionId,
          saleId: updatedPayment.saleId,
          paymentId: id,
          invoiceId: updatedPayment.invoiceId,
          amount: updatedPayment.amount,
          currency: updatedPayment.currency,
          metadata: { beforeStatus: previousPayment.paymentStatus, afterStatus: updatedPayment.paymentStatus },
        });
      }
    }
  };

  const deletePayment = (id: string) => {
    const payment = payments.find(item => item.id === id);
    if (!payment) return;
    throw new Error('Payment history cannot be deleted. Refund and reversal workflows are not available.');
  };

  const getFinancialRecords = () => ({
    accounts: financialAccounts,
    payments,
    expenses,
    income: otherIncome,
    transfers: financialTransfers,
    adjustments: financialAdjustments,
    paymentMethods: normalizePaymentMethods(settings.paymentPreferences?.methods),
    expenseCategories: settings.financialPreferences?.expenseCategories || [],
    incomeCategories: settings.financialPreferences?.incomeCategories || [],
    sales,
    invoices,
    subscriptions,
    customers,
  });
  const assertValidFinancialDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(parsed.getTime())
      || parsed.getFullYear() !== year
      || parsed.getMonth() !== month - 1
      || parsed.getDate() !== day) throw new Error('Enter a valid financial transaction date.');
  };
  const isFinancialDateClosed = (date: string) =>
    Boolean(currentBusiness?.businessId && dailyClosings.some(closing =>
      closing.businessId === currentBusiness.businessId && closing.date === date && closing.status === 'closed'
    ));
  const assertFinancialDateOpen = (date: string) => {
    if (isFinancialDateClosed(date)) {
      throw new Error('This financial date is closed. Reopen the day before changing its transactions.');
    }
    if (financialPeriods.some(period => period.businessId === currentBusiness?.businessId
      && period.status === 'closed' && date >= period.startDate && date <= period.endDate)) {
      throw new Error('This financial period is closed. Reopen the period before posting historical transactions.');
    }
  };
  const assertFinancialAmount = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
  };
  const requireFinancialAccount = (accountId: string, allowDisabled = false) => {
    const account = financialAccounts.find(item => item.id === accountId
      && (!currentBusiness?.businessId || item.businessId === currentBusiness.businessId)
      && (allowDisabled || item.enabled));
    if (!account) throw new Error('Select an active financial account belonging to this business.');
    return account;
  };
  const assertFinancialCurrency = (recordCurrency: AppCurrency, account: FinancialAccount) => {
    if (recordCurrency !== account.currency) {
      throw new Error(`This entry must use the selected account's currency (${account.currency}).`);
    }
  };
  const currentFinancialBalance = (account: FinancialAccount) => {
    const ledger = getFinancialLedger(getFinancialRecords(), account.id);
    return getAccountBalance(account, ledger, account.currency);
  };
  const addFinancialAccount = (accountData: Omit<FinancialAccount, 'id' | 'createdAt' | 'updatedAt'>): FinancialAccount => {
    const name = accountData.name.trim();
    assertValidFinancialDate(accountData.openingBalanceDate);
    assertFinancialDateOpen(accountData.openingBalanceDate);
    if (!name) throw new Error('Enter a financial account name.');
    if (accountData.currency !== 'BDT' && accountData.currency !== 'USD') throw new Error('Select a supported account currency.');
    if (!Number.isFinite(accountData.openingBalance)) throw new Error('Enter a valid opening balance.');
    if (financialAccounts.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('A financial account with that name already exists.');
    }
    const now = new Date().toISOString();
    const account: FinancialAccount = {
      ...accountData,
      id: createRecordId('financial-account'),
      businessId: currentBusiness?.businessId,
      name,
      createdAt: now,
      updatedAt: now,
    };
    setFinancialAccounts(previous => [...previous, account]);
    logActivity({
      type: 'financial_account_added',
      title: 'Financial Account Added',
      description: `${account.name} was added as a financial account.`,
      entityType: 'financial_account',
      entityId: account.id,
      financialAccountId: account.id,
      metadata: { accountType: account.type },
    });
    return account;
  };
  const updateFinancialAccount = (id: string, updates: Partial<FinancialAccount>) => {
    const previous = requireFinancialAccount(id, true);
    if (updates.name !== undefined && !updates.name.trim()) throw new Error('Enter a financial account name.');
    if (updates.openingBalance !== undefined && !Number.isFinite(updates.openingBalance)) throw new Error('Enter a valid opening balance.');
    if (updates.openingBalanceDate !== undefined) assertValidFinancialDate(updates.openingBalanceDate);
    const openingChanged = (updates.openingBalance !== undefined && updates.openingBalance !== previous.openingBalance)
      || (updates.openingBalanceDate !== undefined && updates.openingBalanceDate !== previous.openingBalanceDate);
    if (openingChanged && dailyClosings.some(closing =>
      closing.businessId === currentBusiness?.businessId && closing.status === 'closed'
    )) {
      throw new Error('Opening balances cannot be changed while financial days remain closed. Reopen affected days first.');
    }
    if (updates.currency !== undefined && updates.currency !== 'BDT' && updates.currency !== 'USD') {
      throw new Error('Select a supported account currency.');
    }
    if (updates.currency && updates.currency !== previous.currency) {
      const hasFinancialHistory = payments.some(payment => payment.financialAccountId === id)
        || normalizePaymentMethods(settings.paymentPreferences?.methods).some(method => method.financialAccountId === id)
        || expenses.some(item => item.accountId === id)
        || otherIncome.some(item => item.accountId === id)
        || financialTransfers.some(item => item.fromAccountId === id || item.toAccountId === id)
        || financialAdjustments.some(item => item.accountId === id);
      if (hasFinancialHistory) throw new Error('An account currency cannot change after financial activity has been recorded.');
    }
    if (updates.name && financialAccounts.some(item => item.id !== id && item.name.toLocaleLowerCase() === updates.name!.trim().toLocaleLowerCase())) {
      throw new Error('A financial account with that name already exists.');
    }
    const next = { ...previous, ...updates, name: updates.name?.trim() || previous.name, id, updatedAt: new Date().toISOString() };
    setFinancialAccounts(records => records.map(item => item.id === id ? next : item));
    logActivity({
      type: openingChanged ? 'opening_balance_changed' : 'financial_account_updated',
      title: openingChanged ? 'Opening Balance Changed' : 'Financial Account Updated',
      description: openingChanged
        ? `Opening balance for ${next.name} was changed. This change is recorded separately from income.`
        : `${next.name} financial account details were updated.`,
      entityType: 'financial_account',
      entityId: id,
      financialAccountId: id,
      metadata: {
        ...(updates.openingBalance !== undefined ? { openingBalance: updates.openingBalance } : {}),
        ...(updates.openingBalanceDate ? { openingBalanceDate: updates.openingBalanceDate } : {}),
      },
    });
  };
  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Expense => {
    const account = requireFinancialAccount(expenseData.accountId);
    assertFinancialCurrency(expenseData.currency, account);
    assertFinancialAmount(expenseData.amount);
    assertValidFinancialDate(expenseData.date);
    assertFinancialDateOpen(expenseData.date);
    if (!settings.financialPreferences?.expenseCategories?.some(category => category.id === expenseData.categoryId && category.enabled)) {
      throw new Error('Choose an active expense category in Settings.');
    }
    if (!settings.financialPreferences?.allowNegativeBalances
      && expenseData.amount * (expenseData.currency === account.currency ? 1 : expenseData.currency === 'USD' ? 120 : 1 / 120) > currentFinancialBalance(account)) {
      throw new Error('This expense exceeds the account balance. Enable negative balances in Settings if this is intentional.');
    }
    const now = new Date().toISOString();
    const expense: Expense = {
      ...expenseData,
      id: createRecordId('expense'),
      businessId: currentBusiness?.businessId,
      description: expenseData.description.trim(),
      status: 'posted',
      createdAt: now,
      updatedAt: now,
    };
    if (!expense.description) throw new Error('Enter an expense description.');
    setExpenses(previous => [expense, ...previous]);
    logActivity({
      type: 'expense_added',
      title: 'Expense Added',
      description: `${formatCurrency(expense.amount, expense.currency)} expense recorded from ${account.name}: ${expense.description}.`,
      entityType: 'expense',
      entityId: expense.id,
      financialAccountId: account.id,
      amount: expense.amount,
      currency: expense.currency,
      metadata: { categoryId: expense.categoryId },
    });
    return expense;
  };
  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const previous = expenses.find(item => item.id === id && (!currentBusiness?.businessId || item.businessId === currentBusiness.businessId));
    if (!previous) throw new Error('Expense could not be found for this business.');
    const account = requireFinancialAccount(updates.accountId || previous.accountId);
    const amount = updates.amount ?? previous.amount;
    assertFinancialAmount(amount);
    assertFinancialCurrency(updates.currency || previous.currency, account);
    if (updates.date) assertValidFinancialDate(updates.date);
    assertFinancialDateOpen(previous.date);
    assertFinancialDateOpen(updates.date || previous.date);
    const categoryId = updates.categoryId || previous.categoryId;
    if (!settings.financialPreferences?.expenseCategories?.some(category => category.id === categoryId)) throw new Error('Choose an existing expense category.');
    if (!settings.financialPreferences?.allowNegativeBalances) {
      const priorAmountInAccountCurrency = previous.amount * (previous.currency === account.currency ? 1 : previous.currency === 'USD' ? 120 : 1 / 120);
      const nextAmountInAccountCurrency = amount * ((updates.currency || previous.currency) === account.currency ? 1 : (updates.currency || previous.currency) === 'USD' ? 120 : 1 / 120);
      if (nextAmountInAccountCurrency > currentFinancialBalance(account) + priorAmountInAccountCurrency) {
        throw new Error('This expense exceeds the account balance.');
      }
    }
    const next = { ...previous, ...updates, id, accountId: account.id, updatedAt: new Date().toISOString() };
    setExpenses(records => records.map(item => item.id === id ? next : item));
    logActivity({
      type: 'expense_updated',
      title: next.status === 'voided' ? 'Expense Reversed' : 'Expense Updated',
      description: `Expense ${id} for ${account.name} was ${next.status === 'voided' ? 'voided' : 'updated'}.`,
      entityType: 'expense',
      entityId: id,
      financialAccountId: account.id,
      amount: next.amount,
      currency: next.currency,
    });
  };
  const validateProfitabilityCost = (
    cost: Pick<ProfitabilityCost, 'costType' | 'category' | 'amount' | 'currency' | 'date' | 'serviceId' | 'planId' | 'subscriptionId' | 'saleId' | 'customerId' | 'expenseId' | 'allocationMethod' | 'manualAllocations' | 'description'>,
    excludingId?: string
  ) => {
    if (!Number.isFinite(cost.amount) || (cost.costType === 'adjustment' ? cost.amount === 0 : cost.amount < 0)) {
      throw new Error('Enter a valid non-zero cost amount.');
    }
    assertValidFinancialDate(cost.date);
    if (!cost.category.trim() || !cost.description.trim()) throw new Error('Enter a cost category and description.');
    if (cost.serviceId && !services.some(service => service.id === cost.serviceId)) throw new Error('Choose a service in this business.');
    if (cost.planId && !services.some(service => service.planDetails?.some(plan => plan.id === cost.planId))) throw new Error('Choose a plan in this business.');
    if (cost.customerId && !customers.some(customer => customer.id === cost.customerId)) throw new Error('Choose a customer in this business.');
    if (cost.subscriptionId && !subscriptions.some(subscription => subscription.id === cost.subscriptionId)) throw new Error('Choose a subscription in this business.');
    if (cost.saleId && !sales.some(sale => sale.id === cost.saleId)) throw new Error('Choose a sale in this business.');
    if (cost.expenseId) {
      const expense = expenses.find(item => item.id === cost.expenseId && item.status === 'posted');
      if (!expense) throw new Error('Choose a posted expense from this business.');
      if (expense.amount !== cost.amount || expense.currency !== cost.currency || expense.date !== cost.date) {
        throw new Error('A cost linked to an expense must use the expense amount, currency, and date.');
      }
      if (profitabilityCosts.some(item => item.id !== excludingId && item.expenseId === cost.expenseId && item.status === 'active')) {
        throw new Error('This expense is already linked to an active profitability cost.');
      }
    }
    if (cost.allocationMethod === 'manual') {
      const allocations = cost.manualAllocations || [];
      if (Math.abs(allocations.reduce((total, item) => total + item.percentage, 0) - 100) > 0.001) {
        throw new Error('Manual allocation percentages must total 100%.');
      }
      if (allocations.some(item => !Number.isFinite(item.percentage) || item.percentage < 0 || !services.some(service => service.id === item.serviceId))) {
        throw new Error('Manual allocations must use valid business services and non-negative percentages.');
      }
    }
    if (cost.costType === 'shared' && cost.serviceId) throw new Error('Shared costs must be allocated across services, not linked to one service.');
  };
  const addProfitabilityCost = (
    costData: Omit<ProfitabilityCost, 'id' | 'businessId' | 'createdAt' | 'updatedAt' | 'status'>
  ): ProfitabilityCost => {
    validateProfitabilityCost(costData);
    const now = new Date().toISOString();
    const cost: ProfitabilityCost = {
      ...costData,
      id: createRecordId('profitability-cost'),
      businessId: currentBusiness?.businessId,
      category: costData.category.trim(),
      description: costData.description.trim(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    setProfitabilityCosts(previous => [cost, ...previous]);
    logActivity({
      type: 'profitability_cost_added',
      category: 'financials',
      action: 'created',
      entityType: 'adjustment',
      entityId: cost.id,
      title: 'Profitability Cost Added',
      description: `${formatCurrency(cost.amount, cost.currency)} ${cost.costType.replace('_', ' ')} cost recorded: ${cost.description}. This classification does not create a cashbook transaction.`,
      amount: cost.amount,
      currency: cost.currency,
    });
    return cost;
  };
  const updateProfitabilityCost = (
    id: string,
    updates: Partial<Omit<ProfitabilityCost, 'id' | 'businessId' | 'createdAt'>>
  ) => {
    const previous = profitabilityCosts.find(item => item.id === id && (!currentBusiness?.businessId || item.businessId === currentBusiness.businessId));
    if (!previous) throw new Error('Profitability cost could not be found for this business.');
    const next = { ...previous, ...updates, id, businessId: previous.businessId, createdAt: previous.createdAt, updatedAt: new Date().toISOString() };
    validateProfitabilityCost(next, id);
    setProfitabilityCosts(records => records.map(item => item.id === id ? next : item));
    logActivity({
      type: 'profitability_cost_updated',
      category: 'financials',
      action: 'updated',
      entityType: 'adjustment',
      entityId: id,
      title: 'Profitability Cost Updated',
      description: `Profitability cost ${id} was updated.`,
      amount: next.amount,
      currency: next.currency,
    });
  };
  const deleteProfitabilityCost = (id: string) => {
    const cost = profitabilityCosts.find(item => item.id === id && item.status === 'active'
      && (!currentBusiness?.businessId || item.businessId === currentBusiness.businessId));
    if (!cost) throw new Error('Active profitability cost could not be found for this business.');
    setProfitabilityCosts(records => records.map(item => item.id === id
      ? { ...item, status: 'voided', updatedAt: new Date().toISOString() }
      : item));
    logActivity({
      type: 'profitability_cost_deleted',
      category: 'financials',
      action: 'deleted',
      entityType: 'adjustment',
      entityId: id,
      title: 'Profitability Cost Voided',
      description: `Profitability cost ${id} was voided. Its history is retained; no cashbook transaction was changed.`,
    });
  };
  const addOtherIncome = (incomeData: Omit<OtherIncome, 'id' | 'createdAt' | 'updatedAt' | 'status'>): OtherIncome => {
    const account = requireFinancialAccount(incomeData.accountId);
    assertFinancialCurrency(incomeData.currency, account);
    assertFinancialAmount(incomeData.amount);
    assertValidFinancialDate(incomeData.date);
    assertFinancialDateOpen(incomeData.date);
    if (!incomeData.description.trim()) throw new Error('Enter an income description.');
    if (!settings.financialPreferences?.incomeCategories?.some(category => category.id === incomeData.categoryId && category.enabled)) {
      throw new Error('Choose an active income category in Settings.');
    }
    const now = new Date().toISOString();
    const income: OtherIncome = { ...incomeData, id: createRecordId('income'), businessId: currentBusiness?.businessId, status: 'posted', description: incomeData.description.trim(), createdAt: now, updatedAt: now };
    setOtherIncome(previous => [income, ...previous]);
    logActivity({
      type: 'income_added',
      title: 'Other Income Added',
      description: `${formatCurrency(income.amount, income.currency)} other income recorded to ${account.name}: ${income.description}.`,
      entityType: 'income',
      entityId: income.id,
      financialAccountId: account.id,
      amount: income.amount,
      currency: income.currency,
      metadata: { categoryId: income.categoryId },
    });
    return income;
  };
  const addFinancialTransfer = (transferData: Omit<FinancialTransfer, 'id' | 'createdAt' | 'updatedAt' | 'status'>): FinancialTransfer => {
    const from = requireFinancialAccount(transferData.fromAccountId);
    const to = requireFinancialAccount(transferData.toAccountId);
    if (from.id === to.id) throw new Error('Choose two different accounts for a transfer.');
    if (from.currency !== to.currency || transferData.currency !== from.currency) {
      throw new Error('Transfers currently require both accounts and the transfer amount to use the same currency.');
    }
    assertFinancialAmount(transferData.amount);
    assertValidFinancialDate(transferData.date);
    assertFinancialDateOpen(transferData.date);
    const amountInSourceCurrency = transferData.amount * (transferData.currency === from.currency ? 1 : transferData.currency === 'USD' ? 120 : 1 / 120);
    if (!settings.financialPreferences?.allowNegativeBalances && amountInSourceCurrency > currentFinancialBalance(from)) {
      throw new Error('The source account does not have enough available balance.');
    }
    const now = new Date().toISOString();
    const transfer: FinancialTransfer = { ...transferData, id: createRecordId('transfer'), businessId: currentBusiness?.businessId, status: 'posted', createdAt: now, updatedAt: now };
    setFinancialTransfers(previous => [transfer, ...previous]);
    logActivity({
      type: 'transfer_created',
      title: 'Financial Transfer Created',
      description: `${formatCurrency(transfer.amount, transfer.currency)} transferred from ${from.name} to ${to.name}.`,
      entityType: 'transfer',
      entityId: transfer.id,
      financialAccountId: from.id,
      amount: transfer.amount,
      currency: transfer.currency,
      metadata: { fromAccountId: from.id, toAccountId: to.id },
    });
    return transfer;
  };
  const addFinancialAdjustment = (adjustmentData: Omit<FinancialAdjustment, 'id' | 'createdAt'>): FinancialAdjustment => {
    const account = requireFinancialAccount(adjustmentData.accountId);
    assertFinancialCurrency(adjustmentData.currency, account);
    if (!Number.isFinite(adjustmentData.amount) || adjustmentData.amount === 0) throw new Error('Enter a non-zero adjustment amount.');
    if (!adjustmentData.reason.trim()) throw new Error('Enter a reason for the balance adjustment.');
    assertValidFinancialDate(adjustmentData.date);
    assertFinancialDateOpen(adjustmentData.date);
    if (!settings.financialPreferences?.allowNegativeBalances && currentFinancialBalance(account) + adjustmentData.amount < 0) {
      throw new Error('This adjustment would make the account balance negative.');
    }
    const adjustment: FinancialAdjustment = { ...adjustmentData, id: createRecordId('adjustment'), businessId: currentBusiness?.businessId, reason: adjustmentData.reason.trim(), createdAt: new Date().toISOString() };
    setFinancialAdjustments(previous => [adjustment, ...previous]);
    logActivity({
      type: 'adjustment_created',
      title: 'Balance Adjustment Created',
      description: `${formatCurrency(Math.abs(adjustment.amount), adjustment.currency)} ${adjustment.amount > 0 ? 'added to' : 'removed from'} ${account.name}: ${adjustment.reason}.`,
      entityType: 'adjustment',
      entityId: adjustment.id,
      financialAccountId: account.id,
      amount: adjustment.amount,
      currency: adjustment.currency,
    });
    return adjustment;
  };
  const closeFinancialDay = (
    date: string,
    actualBalances: Record<string, number>,
    reason: string,
    createAdjustments: boolean
  ): DailyClosing => {
    assertValidFinancialDate(date);
    assertFinancialDateOpen(date);
    if (!currentBusiness?.businessId) throw new Error('A current business is required to close a financial day.');
    if (financialAccounts.length === 0) throw new Error('Add a financial account before closing a day.');
    const summary = getDailyFinancialSummary(
      financialAccounts,
      getFinancialLedger(getFinancialRecords()),
      date,
      currency
    );
    const accounts = summary.accounts.map(account => {
      const actual = actualBalances[account.accountId];
      if (!Number.isFinite(actual)) throw new Error(`Enter the actual closing balance for ${account.accountName}.`);
      return {
        ...account,
        actualClosingBalance: actual,
        difference: Math.round((actual - account.expectedClosingBalance) * 100) / 100,
      };
    });
    const hasDifference = accounts.some(account => Math.abs(account.difference) >= 0.005);
    if (hasDifference && !reason.trim()) throw new Error('Enter a reason for the closing difference before closing the day.');
    const now = new Date().toISOString();
    const prior = dailyClosings.find(closing =>
      closing.businessId === currentBusiness.businessId && closing.date === date
    );
    if (createAdjustments && hasDifference) {
      accounts.filter(account => Math.abs(account.difference) >= 0.005).forEach(account => {
        addFinancialAdjustment({
          accountId: account.accountId,
          amount: account.difference,
          currency: account.currency,
          reason: `Daily closing adjustment: ${reason.trim()}`,
          date,
        });
      });
    }
    const actualClosingBalance = accounts.reduce(
      (total, account) => total + convertReportCurrency(account.actualClosingBalance, account.currency, currency), 0
    );
    const closing: DailyClosing = {
      id: prior?.id || createRecordId('daily-closing'),
      businessId: currentBusiness.businessId,
      date,
      currency,
      status: 'closed',
      openingBalance: summary.openingBalance,
      totalMoneyIn: summary.totalMoneyIn,
      totalMoneyOut: summary.totalMoneyOut,
      transfersIn: summary.transfersIn,
      transfersOut: summary.transfersOut,
      adjustmentsNet: summary.adjustmentsNet,
      expectedClosingBalance: summary.expectedClosingBalance,
      actualClosingBalance,
      difference: Math.round((actualClosingBalance - summary.expectedClosingBalance) * 100) / 100,
      accounts,
      paymentMethods: summary.paymentMethods,
      expensesByAccount: summary.expensesByAccount,
      ...(hasDifference ? { closingReason: reason.trim() } : {}),
      closedAt: now,
      closedBy: 'Local user',
      ...(prior?.reopenedAt ? { reopenedAt: prior.reopenedAt } : {}),
      createdAt: prior?.createdAt || now,
      updatedAt: now,
    };
    setDailyClosings(previous => [
      closing,
      ...previous.filter(item => !(item.businessId === closing.businessId && item.date === date)),
    ]);
    logActivity({
      type: 'day_closed',
      title: 'Financial Day Closed',
      description: `${date} was closed with an expected balance of ${formatCurrency(closing.expectedClosingBalance, currency)} and an actual balance of ${formatCurrency(closing.actualClosingBalance, currency)}.`,
      entityType: 'daily_closing',
      entityId: closing.id,
      amount: closing.difference,
      currency,
      metadata: { date, difference: closing.difference, adjustmentsCreated: createAdjustments && hasDifference },
    });
    addNotification({
      dedupeKey: `daily-closing-${date}`,
      type: hasDifference ? 'daily_closing_difference' : 'daily_closing_completed',
      category: 'account',
      priority: hasDifference ? 'warning' : 'success',
      title: hasDifference ? 'Daily Closing Difference' : 'Daily Closing Complete',
      message: `${date}: expected ${formatCurrency(closing.expectedClosingBalance, currency)}, actual ${formatCurrency(closing.actualClosingBalance, currency)}, difference ${formatCurrency(closing.difference, currency)}.`,
      entityType: 'account',
      entityId: closing.id,
      section: 'cashbook',
    });
    return closing;
  };
  const addFinancialReconciliation = (
    input: Omit<FinancialReconciliation, 'id' | 'businessId' | 'createdAt' | 'systemBalance' | 'difference' | 'status'>
  ): FinancialReconciliation => {
    if (!currentBusiness?.businessId) throw new Error('A current business is required to reconcile an account.');
    const account = requireFinancialAccount(input.accountId, true);
    assertValidFinancialDate(input.reconciliationDate);
    if (!Number.isFinite(input.actualBalance)) throw new Error('Enter a valid actual account balance.');
    const ledger = getFinancialLedger(getFinancialRecords(), account.id);
    const systemBalance = getAccountingLedgerBalance(account, ledger, input.reconciliationDate);
    const difference = Math.round((input.actualBalance - systemBalance) * 100) / 100;
    const now = new Date().toISOString();
    const reconciliation: FinancialReconciliation = {
      ...input,
      id: createRecordId('reconciliation'),
      businessId: currentBusiness.businessId,
      systemBalance,
      difference,
      status: Math.abs(difference) < 0.005 ? 'matched' : 'difference',
      note: input.note?.trim() || undefined,
      createdAt: now,
    };
    setFinancialReconciliations(previous => [reconciliation, ...previous]);
    logActivity({
      type: 'account_reconciled',
      title: 'Financial Account Reconciled',
      description: `${account.name} reconciled on ${input.reconciliationDate}: system ${formatCurrency(systemBalance, account.currency)}, actual ${formatCurrency(input.actualBalance, account.currency)}, difference ${formatCurrency(difference, account.currency)}.`,
      entityType: 'financial_account',
      entityId: account.id,
      financialAccountId: account.id,
      amount: difference,
      currency: account.currency,
      metadata: { reconciliationId: reconciliation.id, status: reconciliation.status },
    });
    addNotification({
      dedupeKey: `financial-reconciliation-${account.id}`,
      type: reconciliation.status === 'matched' ? 'account_reconciled' : 'reconciliation_difference',
      category: 'account',
      priority: reconciliation.status === 'matched' ? 'success' : 'warning',
      title: reconciliation.status === 'matched' ? 'Account Reconciled' : 'Reconciliation Difference',
      message: `${account.name}: ${formatCurrency(difference, account.currency)} difference on ${input.reconciliationDate}.`,
      entityType: 'account',
      entityId: account.id,
      accountId: account.id,
      section: 'cashbook',
    });
    return reconciliation;
  };
  const closeFinancialPeriod = (startDate: string, endDate: string, note: string): FinancialPeriod => {
    if (!currentBusiness?.businessId) throw new Error('A current business is required to close a financial period.');
    assertValidFinancialDate(startDate);
    assertValidFinancialDate(endDate);
    if (startDate > endDate) throw new Error('Period start date must be on or before its end date.');
    const existing = financialPeriods.find(period =>
      period.businessId === currentBusiness.businessId && period.startDate === startDate
    );
    if (existing?.status === 'closed' && existing.endDate >= endDate) throw new Error('This financial period is already closed.');
    const overlap = financialPeriods.some(period =>
      period.id !== existing?.id && period.businessId === currentBusiness.businessId && period.status === 'closed'
      && startDate <= period.endDate && endDate >= period.startDate
    );
    if (overlap) throw new Error('This period overlaps another closed financial period.');
    const integrityIssues = runFinancialIntegrityCheck({
      businessId: currentBusiness.businessId,
      accounts: financialAccounts,
      payments,
      expenses,
      income: otherIncome,
      transfers: financialTransfers,
      adjustments: financialAdjustments,
      paymentMethods: normalizePaymentMethods(settings.paymentPreferences?.methods),
      sales,
      invoices,
      subscriptions,
      customers,
      services,
      dailyClosings,
      reconciliations: financialReconciliations,
      periods: financialPeriods,
    });
    const errors = integrityIssues.filter(issue => issue.severity === 'ERROR');
    if (errors.length) {
      throw new Error(`Financial period cannot be closed while ${errors.length} integrity error${errors.length === 1 ? '' : 's'} remain. Review Financial Control first.`);
    }
    const latestByAccount = new Map<string, FinancialReconciliation>();
    financialReconciliations.filter(item =>
      item.businessId === currentBusiness.businessId && item.reconciliationDate <= endDate
    ).sort((left, right) => left.reconciliationDate.localeCompare(right.reconciliationDate))
      .forEach(item => latestByAccount.set(item.accountId, item));
    if ([...latestByAccount.values()].some(item => item.status === 'difference')) {
      throw new Error('Financial period cannot be closed while account reconciliation differences remain unresolved.');
    }
    const now = new Date().toISOString();
    const period: FinancialPeriod = {
      ...(existing || {}),
      id: existing?.id || createRecordId('financial-period'),
      businessId: currentBusiness.businessId,
      startDate,
      endDate,
      status: 'closed',
      closedAt: now,
      ...(existing?.reopenedAt ? { reopenedAt: existing.reopenedAt } : {}),
      ...(existing?.reopenReason ? { reopenReason: existing.reopenReason } : {}),
      closeNote: note.trim() || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    setFinancialPeriods(previous => [period, ...previous.filter(item => item.id !== period.id)]);
    logActivity({
      type: 'period_closed',
      title: 'Financial Period Closed',
      description: `${startDate} – ${endDate} was closed.${period.closeNote ? ` Note: ${period.closeNote}` : ''}`,
      entityType: 'data',
      entityId: period.id,
      metadata: { startDate, endDate },
    });
    addNotification({
      dedupeKey: `financial-period-${period.id}`,
      type: 'financial_period_closed',
      category: 'system',
      priority: 'info',
      title: 'Financial Period Closed',
      message: `${startDate} – ${endDate} has been closed.`,
      entityType: 'system',
      entityId: period.id,
      section: 'cashbook',
    });
    return period;
  };
  const reopenFinancialPeriod = (periodId: string, reason: string) => {
    if (!reason.trim()) throw new Error('Enter a reason before reopening a financial period.');
    const period = financialPeriods.find(item =>
      item.id === periodId && item.businessId === currentBusiness?.businessId && item.status === 'closed'
    );
    if (!period) throw new Error('This closed financial period could not be found.');
    const reopenedAt = new Date().toISOString();
    setFinancialPeriods(previous => previous.map(item => item.id === period.id
      ? { ...item, status: 'open', reopenedAt, reopenReason: reason.trim(), updatedAt: reopenedAt }
      : item
    ));
    logActivity({
      type: 'period_reopened',
      title: 'Financial Period Reopened',
      description: `${period.startDate} – ${period.endDate} was reopened. Reason: ${reason.trim()}`,
      entityType: 'data',
      entityId: period.id,
      metadata: { startDate: period.startDate, endDate: period.endDate, reason: reason.trim() },
    });
    addNotification({
      dedupeKey: `financial-period-${period.id}`,
      type: 'financial_period_reopened',
      category: 'system',
      priority: 'warning',
      title: 'Financial Period Reopened',
      message: `${period.startDate} – ${period.endDate} was reopened. Reason: ${reason.trim()}`,
      entityType: 'system',
      entityId: period.id,
      section: 'cashbook',
    });
  };
  const reopenFinancialDay = (date: string) => {
    const closing = dailyClosings.find(item =>
      item.businessId === currentBusiness?.businessId && item.date === date && item.status === 'closed'
    );
    if (!closing) throw new Error('This day is not currently closed.');
    const reopenedAt = new Date().toISOString();
    setDailyClosings(previous => previous.map(item => item.id === closing.id
      ? { ...item, status: 'reopened', reopenedAt, updatedAt: reopenedAt }
      : item
    ));
    logActivity({
      type: 'day_reopened',
      title: 'Financial Day Reopened',
      description: `${date} was reopened for controlled financial corrections.`,
      entityType: 'daily_closing',
      entityId: closing.id,
      metadata: { date },
    });
  };

  // Settings
  const updateSettings = async (updates: Partial<AppSettings>) => {
    let normalizedUpdates = updates;
    if (typeof updates.storeName === 'string') {
      setBusinessName(updates.storeName);
      normalizedUpdates = { ...updates, storeName: updates.storeName.trim() };
    }

    const updatedSettings = { ...settings, ...normalizedUpdates };
    setSettings(updatedSettings);
    const trackedKeys = ['storeName', 'tagline', 'currency', 'reminderNoticeDays', 'reminderPreferences', 'contactPhone', 'whatsappNumber', 'whatsappPreferences', 'invoicePreferences', 'paymentPreferences', 'financialPreferences', 'subscriptionDefaults', 'serviceDefaults', 'appearance', 'notificationPreferences', 'automaticBackupReminder'] as const;
    const changedKeys = trackedKeys.filter(key =>
      JSON.stringify(settings[key]) !== JSON.stringify(updatedSettings[key])
    );
    if (changedKeys.length > 0) {
      logActivity({
        type: 'business_settings_updated',
        title: changedKeys.includes('storeName') ? 'Business Name Changed' : 'Business Settings Changed',
        description: `Business settings were updated (${changedKeys.join(', ')}).`,
        entityType: 'business',
        entityId: currentBusiness?.businessId || 'business',
        metadata: {
          changedFields: changedKeys.join(', '),
          ...(changedKeys.includes('storeName') ? {
            beforeName: settings.storeName,
            afterName: updatedSettings.storeName,
          } : {}),
        },
      });
    }
    if (JSON.stringify(settings.whatsappPreferences?.templates) !== JSON.stringify(updatedSettings.whatsappPreferences?.templates)) {
      logActivity({
        type: 'whatsapp_template_updated',
        category: 'system',
        action: 'updated',
        entityType: 'business',
        entityId: currentBusiness?.businessId || 'business',
        title: 'WhatsApp Template Updated',
        description: 'WhatsApp message templates were updated.',
      });
    }
    if (JSON.stringify(settings.reminderPreferences) !== JSON.stringify(updatedSettings.reminderPreferences)) {
      logActivity({
        type: 'reminder_settings_updated',
        category: 'reminders',
        action: 'updated',
        entityType: 'business',
        entityId: currentBusiness?.businessId || 'business',
        title: 'Reminder Settings Updated',
        description: 'Smart reminder preferences were updated.',
      });
    }
    if (updates.currency) {
      setCurrency(updates.currency);
    }
    if (updates.language) {
      setLanguage(updates.language);
    }
  };

  const resetToSampleData = () => {
    const sampleData = normalizeBusinessData(
      initialCustomers,
      initialServices,
      initialAccounts,
      initialSubscriptions,
      initialSales,
      initialPayments,
      initialActivityLogs,
      currentBusiness?.businessId
    );
    setCustomers(sampleData.customers);
    setServices(sampleData.services);
    setAccounts(sampleData.accounts);
    setSubscriptions(sampleData.subscriptions);
    setSales(sampleData.sales);
    setPayments(sampleData.payments);
    setFinancialAccounts([]);
    setExpenses([]);
    setOtherIncome([]);
    setFinancialTransfers([]);
    setFinancialAdjustments([]);
    setDailyClosings([]);
    setFinancialReconciliations([]);
    setFinancialPeriods([]);
    setReminders([]);
    setProfitabilityCosts([]);
    setInvoices(normalizeInvoices([], sampleData.sales, sampleData.payments, currentBusiness?.businessId));
    setActivityLogs(sampleData.activityLogs);
    setSettings({
      ...initialSettings,
      storeName: currentBusinessName || initialSettings.storeName,
    });
    setCurrency(initialSettings.currency);
    setLanguage(initialSettings.language);
  };

  const clearBusinessData = () => {
    setCustomers([]);
    setServices([]);
    setAccounts([]);
    setSubscriptions([]);
    setSales([]);
    setInvoices([]);
    setPayments([]);
    setFinancialAccounts([]);
    setExpenses([]);
    setOtherIncome([]);
    setFinancialTransfers([]);
    setFinancialAdjustments([]);
    setDailyClosings([]);
    setFinancialReconciliations([]);
    setFinancialPeriods([]);
    setReminders([]);
    setProfitabilityCosts([]);
    setActivityLogs([]);
    clearNotifications();
    logActivity({
      type: 'data_cleared',
      title: 'Business Data Cleared',
      description: 'Business records were cleared after the requested safety backup.',
      entityType: 'data',
      entityId: currentBusiness?.businessId || 'business',
      metadata: {
        recordsCleared: customers.length + services.length + accounts.length + subscriptions.length + sales.length
          + invoices.length + payments.length + financialAccounts.length + expenses.length + otherIncome.length
          + financialTransfers.length + financialAdjustments.length + financialReconciliations.length
          + financialPeriods.length + profitabilityCosts.length,
      },
    });
  };

  const exportDataJSON = (): string => {
    const data = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      business: currentBusiness,
      records: {
        customers,
        services,
        accounts,
        subscriptions,
        sales,
        invoices,
        payments,
        financialAccounts,
        expenses,
        otherIncome,
        financialTransfers,
        financialAdjustments,
        dailyClosings,
        financialReconciliations,
        financialPeriods,
        reminders,
        profitabilityCosts,
        activityLogs,
        notifications: allBusinessNotifications,
      },
      settings: businessSettings,
    };
    return JSON.stringify(data, null, 2);
  };

  const importDataJSON = (jsonStr: string): boolean => {
    try {
      const parsed: unknown = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
      const data = parsed as Record<string, unknown>;
      if ('schemaVersion' in data && data.schemaVersion !== 1) return false;
      const recordsValue = data.records;
      if ('schemaVersion' in data && (
        typeof recordsValue !== 'object' || recordsValue === null || Array.isArray(recordsValue)
      )) return false;
      const records = (recordsValue && typeof recordsValue === 'object' && !Array.isArray(recordsValue))
        ? recordsValue as Record<string, unknown>
        : data;
      const collectionKeys = [
        'customers',
        'services',
        'accounts',
        'subscriptions',
        'sales',
        'invoices',
        'payments',
        'activityLogs',
      ];
      if ('schemaVersion' in data && !Array.isArray(records.notifications)) return false;
      if ('schemaVersion' in data && collectionKeys.some(key => !Array.isArray(records[key]))) return false;
      if (collectionKeys.some(key => key in records && !Array.isArray(records[key]))) return false;
      if ('reminders' in records && !Array.isArray(records.reminders)) return false;
      if ('profitabilityCosts' in records && !Array.isArray(records.profitabilityCosts)) return false;
      if ('notifications' in records && (
        !Array.isArray(records.notifications) ||
        !(records.notifications as unknown[]).every(isBusinessNotification)
      )) return false;
      const idKeyFor = (key: string) => key === 'invoices' ? 'invoiceId' : 'id';
      if (collectionKeys.some(key =>
        key in records && (records[key] as unknown[]).some(item =>
          typeof item !== 'object' || item === null || Array.isArray(item) ||
          ('schemaVersion' in data && typeof (item as Record<string, unknown>)[idKeyFor(key)] !== 'string')
        )
      )) return false;
      if ('settings' in data && (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings))) {
        return false;
      }

      const importedSettings = data.settings as Partial<AppSettings> | undefined;
      if (importedSettings && (
        (importedSettings.storeName !== undefined && typeof importedSettings.storeName !== 'string') ||
        (importedSettings.currency !== undefined && importedSettings.currency !== 'BDT' && importedSettings.currency !== 'USD') ||
        (importedSettings.language !== undefined && importedSettings.language !== 'en' && importedSettings.language !== 'bn') ||
        (importedSettings.reminderNoticeDays !== undefined && !Number.isFinite(importedSettings.reminderNoticeDays))
      )) return false;
      const importedName = importedSettings?.storeName ||
        (typeof data.store === 'string' ? data.store : '') ||
        (typeof data.business === 'object' && data.business !== null && 'name' in data.business &&
          typeof data.business.name === 'string' ? data.business.name : '');
      const normalizedImportedName = importedName.trim();
      if (
        normalizedImportedName &&
        (normalizedImportedName.length < 2 || normalizedImportedName.length > 80)
      ) {
        return false;
      }

      const business = normalizedImportedName
        ? createRestoredBusinessRecord(data.business, normalizedImportedName)
        : currentBusiness;
      const imported = normalizeBusinessData(
        Array.isArray(records.customers) ? records.customers as Customer[] : customers,
        Array.isArray(records.services) ? records.services as Service[] : services,
        Array.isArray(records.accounts) ? records.accounts as Account[] : accounts,
        Array.isArray(records.subscriptions) ? records.subscriptions as Subscription[] : subscriptions,
        Array.isArray(records.sales) ? records.sales as Sale[] : sales,
        Array.isArray(records.payments) ? records.payments as Payment[] : payments,
        Array.isArray(records.activityLogs) ? records.activityLogs as ActivityLog[] : activityLogs,
        business?.businessId
      );
      const importedInvoices = Array.isArray(records.invoices) ? records.invoices as Invoice[] : invoices;
      const restoredInvoices = normalizeInvoices(
        importedInvoices,
        imported.sales,
        imported.payments,
        business?.businessId
      );
      const restoredLogs = normalizeLegacyActivityLogs(imported.activityLogs, initialSettings.storeName, imported.accounts);
      const restoreLog = createAuditLog({
        type: 'backup_restored',
        title: 'Backup Restored',
        description: 'Business data was restored from a validated backup.',
        entityType: 'data',
        entityId: business?.businessId || 'business',
        metadata: { importedActivityCount: restoredLogs.length },
      }, {
        id: createRecordId('activity'),
        businessId: business?.businessId,
        createdBy: currentUser?.uid || 'admin',
      });
      const logsWithRestore = [restoreLog, ...restoredLogs];
      const importedNotifications = Array.isArray(records.notifications)
        ? records.notifications as BusinessNotification[]
        : [];
      const importedFinancialAccounts = (Array.isArray(records.financialAccounts) ? records.financialAccounts : []) as FinancialAccount[];
      const importedExpenses = (Array.isArray(records.expenses) ? records.expenses : []) as Expense[];
      const importedOtherIncome = (Array.isArray(records.otherIncome) ? records.otherIncome : []) as OtherIncome[];
      const importedFinancialTransfers = (Array.isArray(records.financialTransfers) ? records.financialTransfers : []) as FinancialTransfer[];
      const importedFinancialAdjustments = (Array.isArray(records.financialAdjustments) ? records.financialAdjustments : []) as FinancialAdjustment[];
      const importedDailyClosings = (Array.isArray(records.dailyClosings) ? records.dailyClosings : []) as DailyClosing[];
      const importedFinancialReconciliations = (Array.isArray(records.financialReconciliations) ? records.financialReconciliations : []) as FinancialReconciliation[];
      const importedFinancialPeriods = (Array.isArray(records.financialPeriods) ? records.financialPeriods : []) as FinancialPeriod[];
      const importedReminders = (Array.isArray(records.reminders) ? records.reminders : []) as Reminder[];
      const importedProfitabilityCosts = (Array.isArray(records.profitabilityCosts) ? records.profitabilityCosts : []) as ProfitabilityCost[];
      const restoredNotifications = [
        ...notifications.filter(notification =>
          Boolean(currentBusiness?.businessId && notification.businessId && notification.businessId !== currentBusiness.businessId)
        ),
        ...importedNotifications.map(notification => ({
          ...notification,
          ...(business?.businessId ? { businessId: business.businessId } : {}),
        })),
      ];
      const restoredSettings = importedSettings
        ? normalizeLegacyBranding(importedSettings)
        : settings;
      const committedSettings = business
        ? { ...restoredSettings, businessId: business.businessId, storeName: business.name }
        : restoredSettings;
      const restoreIntegrity = runDataIntegrityCheck({
        businessId: business?.businessId,
        customers: imported.customers,
        services: imported.services,
        serviceAccounts: imported.accounts,
        subscriptions: imported.subscriptions,
        sales: imported.sales,
        payments: imported.payments,
        invoices: restoredInvoices,
        financialAccounts: importedFinancialAccounts,
        expenses: importedExpenses,
        otherIncome: importedOtherIncome,
        financialTransfers: importedFinancialTransfers,
        financialAdjustments: importedFinancialAdjustments,
        dailyClosings: importedDailyClosings,
        financialReconciliations: importedFinancialReconciliations,
        financialPeriods: importedFinancialPeriods,
        reminders: importedReminders,
        profitabilityCosts: importedProfitabilityCosts,
        activityLogs: logsWithRestore,
        notifications: restoredNotifications,
        settings: committedSettings,
      }, { cacheResult: false });
      if (restoreIntegrity.errors.length) {
        console.error(`Backup restore was stopped because ${restoreIntegrity.errors.length} critical integrity issue(s) were found.`,
          restoreIntegrity.errors.map(issue => `${issue.entityType}${issue.entityId ? ` ${issue.entityId}` : ''}: ${issue.message}`));
        return false;
      }

      replaceRawValuesAtomically({
        ...(business ? { [STORAGE_KEYS.BUSINESS]: JSON.stringify(business) } : {}),
        [STORAGE_KEYS.CUSTOMERS]: JSON.stringify(imported.customers),
        [STORAGE_KEYS.SERVICES]: JSON.stringify(imported.services),
        [STORAGE_KEYS.ACCOUNTS]: JSON.stringify(imported.accounts),
        [STORAGE_KEYS.SUBSCRIPTIONS]: JSON.stringify(imported.subscriptions),
        [STORAGE_KEYS.SALES]: JSON.stringify(imported.sales),
        [STORAGE_KEYS.PAYMENTS]: JSON.stringify(imported.payments),
        [STORAGE_KEYS.INVOICES]: JSON.stringify(restoredInvoices),
        [STORAGE_KEYS.LOGS]: JSON.stringify(logsWithRestore),
        [STORAGE_KEYS.NOTIFICATIONS]: JSON.stringify(restoredNotifications),
        [STORAGE_KEYS.FINANCIAL_ACCOUNTS]: JSON.stringify(importedFinancialAccounts),
        [STORAGE_KEYS.EXPENSES]: JSON.stringify(importedExpenses),
        [STORAGE_KEYS.OTHER_INCOME]: JSON.stringify(importedOtherIncome),
        [STORAGE_KEYS.FINANCIAL_TRANSFERS]: JSON.stringify(importedFinancialTransfers),
        [STORAGE_KEYS.FINANCIAL_ADJUSTMENTS]: JSON.stringify(importedFinancialAdjustments),
        [STORAGE_KEYS.DAILY_CLOSINGS]: JSON.stringify(importedDailyClosings),
        [STORAGE_KEYS.FINANCIAL_RECONCILIATIONS]: JSON.stringify(importedFinancialReconciliations),
        [STORAGE_KEYS.FINANCIAL_PERIODS]: JSON.stringify(importedFinancialPeriods),
        [STORAGE_KEYS.REMINDERS]: JSON.stringify(importedReminders),
        [STORAGE_KEYS.PROFITABILITY_COSTS]: JSON.stringify(importedProfitabilityCosts),
        [STORAGE_KEYS.SETTINGS]: JSON.stringify(committedSettings),
      });

      if (business && normalizedImportedName) {
        setCurrentBusiness(business);
        setCurrentBusinessName(business.name);
      }
      setCustomers(imported.customers);
      setServices(imported.services);
      setAccounts(imported.accounts);
      setSubscriptions(imported.subscriptions);
      setSales(imported.sales);
      setPayments(imported.payments);
      setFinancialAccounts(importedFinancialAccounts);
      setExpenses(importedExpenses);
      setOtherIncome(importedOtherIncome);
      setFinancialTransfers(importedFinancialTransfers);
      setFinancialAdjustments(importedFinancialAdjustments);
      setDailyClosings(importedDailyClosings);
      setFinancialReconciliations(importedFinancialReconciliations);
      setFinancialPeriods(importedFinancialPeriods);
      setReminders(importedReminders);
      setProfitabilityCosts(importedProfitabilityCosts);
      setInvoices(restoredInvoices);
      setActivityLogs(logsWithRestore);
      setNotifications(restoredNotifications);
      setSettings(committedSettings);
      return true;
    } catch (error) {
      console.error('Business backup restore failed before completion.', error);
      return false;
    }
  };

  // Metrics computation
  const stats = useMemo(() => {
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    const serviceById = new Map(services.map(service => [service.id, service]));

    subscriptions.forEach(sub => {
      const status = getSubscriptionStatus(sub, serviceById.get(sub.serviceId), settings.reminderNoticeDays);
      if (status === 'active') active++;
      else if (status === 'expiring_soon') expiringSoon++;
      else if (status === 'expired') expired++;
    });

    const totalRev = calculateTotalRevenue(sales, currency);

    return {
      totalCustomers: customers.filter(c => !c.isArchived && c.status !== 'archived').length,
      activeCount: active,
      expiringSoonCount: expiringSoon,
      expiredCount: expired,
      totalRevenue: Math.round(totalRev * 100) / 100,
      totalAccounts: accounts.length,
      totalServices: services.filter(s => !s.isArchived).length,
      activeServices: services.filter(s => !s.isArchived && s.status === 'active').length,
    };
  }, [customers, subscriptions, sales, settings.reminderNoticeDays, currency, accounts.length, services]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentBusiness,
        currentBusinessName,
        getBusinessName,
        setBusinessName,
        clearBusinessName,
        createBusiness,
        customersLoading,
        customersError,
        servicesLoading,
        servicesError,
        language,
        setLanguage,
        t,
        currency,
        setCurrency,
        isDark,
        toggleDarkMode,
        customers,
        services,
        accounts,
        subscriptions,
        sales,
        invoices,
        payments,
        financialAccounts,
        expenses,
        otherIncome,
        financialTransfers,
        financialAdjustments,
        dailyClosings,
        financialReconciliations,
        financialPeriods,
        reminders,
        profitabilityCosts,
        activityLogs,
        settings: businessSettings,
        notifications: businessNotifications,
        unreadNotificationCount,
        storageWarning,
        addCustomer,
        updateCustomer,
        addCustomerNote,
        updateCustomerNote,
        deleteCustomerNote,
        deleteCustomer,
        archiveCustomer,
        restoreCustomer,
        getCustomerById,
        addService,
        updateService,
        deleteService,
        archiveService,
        restoreService,
        getServiceById,
        addAccount,
        updateAccount,
        deleteAccount,
        getAccountById,
        addProfileToAccount,
        updateProfile,
        deleteProfile,
        assignCustomerToProfile,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        renewSubscription,
        createSale,
        deleteSale,
        recordSalePayment,
        ensureInvoiceForSale,
        addPayment,
        updatePayment,
        deletePayment,
        addFinancialAccount,
        updateFinancialAccount,
        addExpense,
        updateExpense,
        addProfitabilityCost,
        updateProfitabilityCost,
        deleteProfitabilityCost,
        addOtherIncome,
        addFinancialTransfer,
        addFinancialAdjustment,
        closeFinancialDay,
        addFinancialReconciliation,
        closeFinancialPeriod,
        reopenFinancialPeriod,
        reopenFinancialDay,
        isFinancialDateClosed,
        completeReminder,
        snoozeReminder,
        dismissReminder,
        reopenReminder,
        createManualReminder,
        refreshReminders,
        logActivity,
        clearActivityLogs,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearNotifications,
        getNotificationCount,
        getUnreadNotifications: getUnreadNotificationsForBusiness,
        updateSettings,
        resetToSampleData,
        clearBusinessData,
        exportDataJSON,
        importDataJSON,
        stats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
