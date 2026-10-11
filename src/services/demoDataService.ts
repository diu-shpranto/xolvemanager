import type {
  Account,
  AccountProfile,
  ActivityLog,
  AppCurrency,
  AppSettings,
  BusinessNotification,
  Customer,
  DailyClosing,
  Expense,
  FinancialAccount,
  FinancialAdjustment,
  FinancialCategory,
  FinancialPeriod,
  FinancialReconciliation,
  FinancialTransfer,
  Invoice,
  OtherIncome,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ProfitabilityCost,
  Reminder,
  Sale,
  Service,
  ServicePlan,
  Subscription,
} from '../types';
import { createInvoiceRecord } from '../utils/invoiceUtils';
import { calculateExpiryDate } from '../utils/dateUtils';
import { getDailyFinancialSummary, getFinancialLedger } from '../utils/financialLedger';

export const DEMO_DATA_ID_PREFIX = 'xvm_demo_';
export const DEMO_DATA_MANIFEST_KEY_PREFIX = 'xvm_demo_data_manifest_v1_';

export interface DemoDataManifest {
  version: 1;
  businessId?: string;
  installedAt: string;
  records: Record<string, string[]>;
  planIds: string[];
}

export interface DemoDataSnapshot {
  customers: Customer[];
  services: Service[];
  accounts: Account[];
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
}

export type DemoDataCounts = Record<string, number>;

export interface DemoDataBuildResult {
  snapshot: DemoDataSnapshot;
  manifest: DemoDataManifest;
}

export interface DemoDataPreview {
  counts: DemoDataCounts;
  description: string;
}

const planDefinitions = [
  {
    slug: 'netflix',
    name: 'Netflix',
    aliases: ['netflix'],
    color: '#E50914',
    description: 'Netflix streaming subscription',
    plans: [
      ['1 Month', 30, 450, 285],
      ['3 Months', 90, 1200, 760],
      ['6 Months', 180, 2200, 1390],
      ['1 Year', 365, 4200, 2650],
    ],
  },
  {
    slug: 'prime-video',
    name: 'Prime Video',
    aliases: ['prime video', 'amazon prime video'],
    color: '#00A8E1',
    description: 'Prime Video streaming subscription',
    plans: [
      ['1 Month', 30, 300, 190],
      ['3 Months', 90, 800, 510],
      ['1 Year', 365, 3000, 1900],
    ],
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    aliases: ['youtube premium'],
    color: '#FF0000',
    description: 'Ad-free YouTube and YouTube Music',
    plans: [
      ['1 Month', 30, 200, 125],
      ['3 Months', 90, 550, 350],
      ['1 Year', 365, 2000, 1275],
    ],
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    aliases: ['spotify'],
    color: '#1DB954',
    description: 'Spotify Premium music subscription',
    plans: [
      ['1 Month', 30, 180, 110],
      ['3 Months', 90, 500, 310],
      ['1 Year', 365, 1800, 1120],
    ],
  },
  {
    slug: 'disney-plus',
    name: 'Disney+',
    aliases: ['disney+', 'disney plus'],
    color: '#113CCF',
    description: 'Disney+ entertainment subscription',
    plans: [
      ['1 Month', 30, 350, 220],
      ['3 Months', 90, 950, 600],
      ['1 Year', 365, 3600, 2280],
    ],
  },
  {
    slug: 'amazon-prime',
    name: 'Amazon Prime',
    aliases: ['amazon prime'],
    color: '#146EB4',
    description: 'Amazon Prime membership subscription',
    plans: [
      ['1 Month', 30, 500, 320],
      ['3 Months', 90, 1400, 890],
      ['1 Year', 365, 5000, 3200],
    ],
  },
] as const;

const demoNames = [
  'Rahim Ahmed', 'Karim Hasan', 'Nusrat Jahan', 'Sadia Islam', 'Tanvir Hossain',
  'Fahim Rahman', 'Mehedi Hasan', 'Tania Akter', 'Arif Chowdhury', 'Jannatul Ferdous',
  'Saif Ahmed', 'Mahin Islam', 'Rafiul Hasan', 'Mim Akter', 'Shakil Ahmed',
  'Nabila Akter', 'Hasan Mahmud', 'Farzana Islam', 'Imran Kabir', 'Samiha Noor',
];

const expenseCategoryDefinitions = [
  ['internet', 'Internet'],
  ['electricity', 'Electricity'],
  ['office', 'Office'],
  ['software', 'Software'],
  ['marketing', 'Marketing'],
  ['transportation', 'Transportation'],
  ['miscellaneous', 'Miscellaneous'],
] as const;

const incomeCategoryDefinitions = [
  ['other-income', 'Other Income'],
  ['commission', 'Commission'],
] as const;

const paymentMethods: PaymentMethod[] = ['Cash', 'bKash', 'Nagad', 'Bank', 'Card'];

const demoId = (kind: string, key: string): string =>
  `${DEMO_DATA_ID_PREFIX}${kind}_${key.replace(/[^a-z0-9]+/gi, '_').toLocaleLowerCase()}`;

const dateOffset = (base: string, offset: number): string => {
  const date = new Date(`${base}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dayTimestamp = (date: string): string => `${date}T12:00:00.000Z`;
const normalize = (value: string): string => value.trim().toLocaleLowerCase().replace(/[^a-z0-9+]+/g, ' ');
const isDemoId = (id: string | undefined): boolean => Boolean(id?.startsWith(DEMO_DATA_ID_PREFIX));
const scoped = <T extends object>(value: T, businessId?: string): T & { businessId?: string } =>
  businessId ? { ...value, businessId } : value;

const makeUniqueId = (base: string, used: Set<string>): string => {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

const makeUniqueValue = (base: string, used: Set<string>): string => {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate.toLocaleLowerCase());
  return candidate;
};

const emptyIds = (): Record<string, string[]> => ({
  customers: [],
  services: [],
  planIds: [],
  accounts: [],
  profiles: [],
  subscriptions: [],
  sales: [],
  payments: [],
  invoices: [],
  financialAccounts: [],
  expenses: [],
  otherIncome: [],
  financialTransfers: [],
  dailyClosings: [],
  financialReconciliations: [],
  reminders: [],
  profitabilityCosts: [],
  activityLogs: [],
  notifications: [],
  expenseCategories: [],
  incomeCategories: [],
});

export const getDemoDataManifestKey = (businessId?: string): string =>
  `${DEMO_DATA_MANIFEST_KEY_PREFIX}${businessId || 'local'}`;

export const getDemoDataPreview = (): DemoDataPreview => ({
  counts: {
    customers: 20,
    services: 6,
    plans: 19,
    accounts: 8,
    profiles: 24,
    sales: 40,
    payments: 40,
    subscriptions: 40,
    invoices: 40,
    expenses: 20,
    financialAccounts: 5,
    transfers: 4,
    dailyClosings: 3,
    reminders: 10,
    communications: 15,
    notifications: 6,
  },
  description: 'Realistic, linked records for local development and UI testing.',
});

export const getDemoDataCounts = (snapshot: DemoDataSnapshot): DemoDataCounts => {
  const demoServiceIds = new Set([
    ...snapshot.services.filter(item => isDemoId(item.id)).map(item => item.id),
    ...snapshot.sales.filter(item => isDemoId(item.id)).map(item => item.serviceId),
  ]);
  const planCount = snapshot.services.reduce((total, service) =>
    total + (service.planDetails || []).filter(plan => isDemoId(plan.id)).length, 0);
  const profileCount = snapshot.accounts.reduce((total, account) =>
    total + (account.profiles || []).filter(profile => isDemoId(profile.id)).length, 0);
  return {
    customers: snapshot.customers.filter(item => isDemoId(item.id)).length,
    services: demoServiceIds.size,
    plans: planCount,
    accounts: snapshot.accounts.filter(item => isDemoId(item.id)).length,
    profiles: profileCount,
    subscriptions: snapshot.subscriptions.filter(item => isDemoId(item.id)).length,
    sales: snapshot.sales.filter(item => isDemoId(item.id)).length,
    payments: snapshot.payments.filter(item => isDemoId(item.id)).length,
    invoices: snapshot.invoices.filter(item => isDemoId(item.invoiceId)).length,
    financialAccounts: snapshot.financialAccounts.filter(item => isDemoId(item.id)).length,
    expenses: snapshot.expenses.filter(item => isDemoId(item.id)).length,
    otherIncome: snapshot.otherIncome.filter(item => isDemoId(item.id)).length,
    transfers: snapshot.financialTransfers.filter(item => isDemoId(item.id)).length,
    dailyClosings: snapshot.dailyClosings.filter(item => isDemoId(item.id)).length,
    reconciliations: snapshot.financialReconciliations.filter(item => isDemoId(item.id)).length,
    reminders: snapshot.reminders.filter(item => isDemoId(item.id)).length,
    profitabilityCosts: snapshot.profitabilityCosts.filter(item => isDemoId(item.id)).length,
    communications: snapshot.activityLogs.filter(item => item.type === 'demo_communication_recorded').length,
    activityLogs: snapshot.activityLogs.filter(item => isDemoId(item.id)).length,
    notifications: snapshot.notifications.filter(item => isDemoId(item.id)).length,
  };
};

export const getDemoDataStatus = (counts: DemoDataCounts): 'Not installed' | 'Installed' | 'Partially installed' => {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 'Not installed';
  return counts.customers >= 20 && counts.services >= 6 && counts.sales >= 40
    && counts.subscriptions >= 40 && counts.expenses >= 20
    ? 'Installed'
    : 'Partially installed';
};

export const buildDemoData = (
  current: DemoDataSnapshot,
  businessId?: string,
  now = new Date(),
): DemoDataBuildResult => {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currency: AppCurrency = current.settings.currency || 'BDT';
  const nowIso = now.toISOString();
  const ids = emptyIds();
  const used = {
    customers: new Set(current.customers.map(item => item.id)),
    services: new Set(current.services.map(item => item.id)),
    accounts: new Set(current.accounts.map(item => item.id)),
    profiles: new Set(current.accounts.flatMap(account => account.profiles.map(profile => profile.id))),
    subscriptions: new Set(current.subscriptions.map(item => item.id)),
    sales: new Set(current.sales.map(item => item.id)),
    payments: new Set(current.payments.map(item => item.id)),
    invoices: new Set(current.invoices.map(item => item.invoiceId)),
    financialAccounts: new Set(current.financialAccounts.map(item => item.id)),
    expenses: new Set(current.expenses.map(item => item.id)),
    otherIncome: new Set(current.otherIncome.map(item => item.id)),
    financialTransfers: new Set(current.financialTransfers.map(item => item.id)),
    dailyClosings: new Set(current.dailyClosings.map(item => item.id)),
    financialReconciliations: new Set(current.financialReconciliations.map(item => item.id)),
    reminders: new Set(current.reminders.map(item => item.id)),
    profitabilityCosts: new Set(current.profitabilityCosts.map(item => item.id)),
    activityLogs: new Set(current.activityLogs.map(item => item.id)),
    notifications: new Set(current.notifications.map(item => item.id)),
  };
  const invoiceNumbers = new Set([
    ...current.sales.map(item => item.invoiceNo.toLocaleLowerCase()),
    ...current.invoices.map(item => item.invoiceNumber.toLocaleLowerCase()),
  ]);
  const transactions = new Set(current.payments.map(item => item.transactionId?.toLocaleLowerCase() || '').filter(Boolean));

  const customers: Customer[] = demoNames.map((name, index) => {
    const id = makeUniqueId(demoId('customer', String(index + 1).padStart(3, '0')), used.customers);
    ids.customers.push(id);
    const emailName = name.toLocaleLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '');
    return scoped({
      id,
      name,
      phone: `+880 1000 ${String(index + 1).padStart(6, '0')}`,
      whatsapp: `+880 1000 ${String(index + 1).padStart(6, '0')}`,
      email: `${emailName}.${String(index + 1).padStart(2, '0')}@example.com`,
      address: `Demo address ${index + 1}, Dhaka, Bangladesh`,
      notes: '[DEMO DATA] Synthetic customer record for local development only.',
      tags: ['demo'],
      createdAt: dateOffset(today, -120 + index * 4),
      status: 'active' as const,
    }, businessId);
  });

  const addedServices: Service[] = [];
  const selectedPlans = new Map<string, ServicePlan[]>();
  const serviceForSlug = new Map<string, Service>();
  const allServices = [...current.services];
  planDefinitions.forEach(definition => {
    let service = allServices.find(candidate =>
      definition.aliases.some(alias => {
        const normalizedName = normalize(candidate.name);
        const normalizedAlias = normalize(alias);
        if (definition.slug === 'amazon-prime') return normalizedName === normalizedAlias || normalizedName === 'amazon prime shopping';
        return normalizedName === normalizedAlias || normalizedName.startsWith(`${normalizedAlias} `);
      })
    );
    if (!service) {
      const serviceId = makeUniqueId(demoId('service', definition.slug), used.services);
      service = scoped({
        id: serviceId,
        name: definition.name,
        category: 'Streaming',
        description: definition.description,
        defaultDurationDays: 30,
        defaultPrice: currency === 'BDT' ? definition.plans[0][2] : Number((definition.plans[0][2] / 120).toFixed(2)),
        defaultPriceBDT: definition.plans[0][2],
        defaultPriceUSD: Number((definition.plans[0][2] / 120).toFixed(2)),
        currency,
        status: 'active',
        plans: [],
        planIds: [],
        planDetails: [],
        color: definition.color,
        notes: '[DEMO DATA] Synthetic service record for local development only.',
        createdAt: nowIso,
        updatedAt: nowIso,
        settings: { subscriptionEnabled: true, renewalEnabled: true, usesAccounts: false, usesProfiles: false },
      }, businessId);
      addedServices.push(service);
      ids.services.push(serviceId);
    }

    const planDetails = [...(service.planDetails || [])];
    const planNames = [...service.plans];
    const planIds = [...(service.planIds || [])];
    const resolvedPlans: ServicePlan[] = [];
    definition.plans.forEach(([planName, durationDays, bdtPrice, bdtCost], planIndex) => {
      const existing = planDetails.find(item => normalize(item.name) === normalize(planName));
      if (existing) {
        if (existing.status === 'active') resolvedPlans.push(existing);
        return;
      }
      if (planNames.some(name => normalize(name) === normalize(planName))) {
        const existingIndex = planNames.findIndex(name => normalize(name) === normalize(planName));
        const existingId = planIds[existingIndex];
        const foundPlan = planDetails.find(item => item.id === existingId);
        if (foundPlan?.status === 'active') resolvedPlans.push(foundPlan);
        return;
      }
      const planId = makeUniqueId(demoId('plan', `${definition.slug}_${planName}`), new Set([
        ...planDetails.map(item => item.id),
        ...planIds,
      ]));
      const plan: ServicePlan = {
        id: planId,
        name: planName,
        price: currency === 'BDT' ? bdtPrice : Number((bdtPrice / 120).toFixed(2)),
        currency,
        durationDays,
        duration: planIndex === 3 && definition.slug === 'netflix' ? 1
          : durationDays === 365 ? 1 : Math.round(durationDays / 30),
        durationUnit: durationDays === 365 ? 'Years' : 'Months',
        status: 'active',
        description: `${planName} ${definition.name} demo plan.`,
        directCostType: 'fixed_per_cycle',
        directCostAmount: currency === 'BDT' ? bdtCost : Number((bdtCost / 120).toFixed(2)),
        sortOrder: planIndex + 1,
      };
      planDetails.push(plan);
      planNames.push(planName);
      planIds.push(planId);
      ids.planIds.push(planId);
      resolvedPlans.push(plan);
    });
    service = { ...service, plans: planNames, planIds, planDetails };
    if (!ids.services.includes(service.id)) {
      const index = allServices.findIndex(item => item.id === service!.id);
      if (index >= 0) allServices[index] = service;
    }
    serviceForSlug.set(definition.slug, service);
    selectedPlans.set(definition.slug, resolvedPlans.length
      ? resolvedPlans
      : planDetails.filter(item => item.status === 'active'));
  });
  const services = [
    ...allServices.filter(item => !addedServices.some(added => added.id === item.id)),
    ...addedServices.map(added => {
      const updated = serviceForSlug.get(planDefinitions.find(definition => demoId('service', definition.slug) === added.id)?.slug || '');
      return updated || added;
    }),
  ];
  planDefinitions.forEach(definition => {
    if (!selectedPlans.get(definition.slug)?.length) {
      throw new Error(`No active plan is available for demo service ${definition.name}.`);
    }
  });

  const financialAccountDefinitions = [
    ['cash', 'Demo Cash', 'cash', 45000],
    ['bkash', 'Demo bKash Wallet', 'mobile_banking', 35000],
    ['nagad', 'Demo Nagad Wallet', 'mobile_banking', 30000],
    ['bank', 'Demo Bank Account', 'bank', 60000],
    ['card', 'Demo Card Settlement', 'card', 25000],
  ] as const;
  const financialAccounts: FinancialAccount[] = financialAccountDefinitions.map(([slug, name, type, openingBalance], index) => {
    const id = makeUniqueId(demoId('financial_account', slug), used.financialAccounts);
    ids.financialAccounts.push(id);
    return scoped({
      id,
      name,
      type,
      identifier: `DEMO-${slug.toUpperCase()}`,
      currency,
      openingBalance: currency === 'BDT' ? openingBalance : Number((openingBalance / 120).toFixed(2)),
      openingBalanceDate: dateOffset(today, -120),
      enabled: true,
      sortOrder: index + 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, businessId);
  });

  const accountDefinitions = [
    ['netflix', 0], ['netflix', 1], ['prime-video', 0], ['youtube-premium', 0],
    ['spotify', 0], ['disney-plus', 0], ['amazon-prime', 0], ['amazon-prime', 1],
  ] as const;
  const profilesForAccounts = new Map<string, AccountProfile[]>();
  const accounts: Account[] = accountDefinitions.map(([slug, accountIndex]) => {
    const service = serviceForSlug.get(slug);
    if (!service) throw new Error(`Demo account service ${slug} could not be found.`);
    const id = makeUniqueId(demoId('account', `${slug}_${String(accountIndex + 1).padStart(2, '0')}`), used.accounts);
    const profileCount = 3;
    const profiles = Array.from({ length: profileCount }, (_, profileIndex) => {
      const profileId = makeUniqueId(demoId('profile', `${slug}_${accountIndex + 1}_${profileIndex + 1}`), used.profiles);
      ids.profiles.push(profileId);
      return scoped({
        id: profileId,
        accountId: id,
        profileName: `Profile ${profileIndex + 1}`,
        status: 'Available' as const,
        notes: '[DEMO DATA] Sample profile; no real credentials are stored.',
      }, businessId);
    });
    ids.accounts.push(id);
    profilesForAccounts.set(id, profiles);
    const defaultPlan = selectedPlans.get(slug)?.[0];
    return scoped({
      id,
      serviceId: service.id,
      email: `${slug.replace(/-/g, '.')}.demo${String(accountIndex + 1).padStart(2, '0')}@example.com`,
      username: `${slug.replace(/-/g, '.')}.demo${String(accountIndex + 1).padStart(2, '0')}`,
      password: 'Demo@12345',
      plan: defaultPlan?.name || 'Demo access',
      status: 'Available' as const,
      name: `${service.name} Demo Account ${accountIndex + 1}`,
      purchaseDate: dateOffset(today, -90),
      expiryDate: dateOffset(today, 275),
      maxProfiles: profileCount,
      profiles,
      notes: '[DEMO DATA] Safe placeholder account. Demo@12345 is not a real service credential.',
      createdAt: nowIso,
      updatedAt: nowIso,
    }, businessId);
  });
  const accountProfiles = new Map(accounts.map(account => [account.id, [...(account.profiles || [])]]));

  const expenseCategories = [...(current.settings.financialPreferences?.expenseCategories || [])];
  const incomeCategories = [...(current.settings.financialPreferences?.incomeCategories || [])];
  const categoryFor = (
    definitions: ReadonlyArray<readonly [string, string]>,
    existing: FinancialCategory[],
    type: 'expense' | 'income',
  ): FinancialCategory[] => definitions.map(([slug, name], index) => {
    const found = existing.find(item => normalize(item.name) === normalize(name));
    if (found) return found;
    const id = demoId(`${type}_category`, slug);
    const category = { id, name, enabled: true, sortOrder: existing.length + index + 1 };
    ids[type === 'expense' ? 'expenseCategories' : 'incomeCategories'].push(id);
    return category;
  });
  const addedExpenseCategories = categoryFor(expenseCategoryDefinitions, expenseCategories, 'expense');
  const addedIncomeCategories = categoryFor(incomeCategoryDefinitions, incomeCategories, 'income');
  const nextSettings: AppSettings = {
    ...current.settings,
    financialPreferences: {
      ...current.settings.financialPreferences,
      expenseCategories: [...expenseCategories, ...addedExpenseCategories.filter(category => !expenseCategories.some(existing => existing.id === category.id))],
      incomeCategories: [...incomeCategories, ...addedIncomeCategories.filter(category => !incomeCategories.some(existing => existing.id === category.id))],
    },
  };

  const subscriptions: Subscription[] = [];
  const sales: Sale[] = [];
  const payments: Payment[] = [];
  const invoices: Invoice[] = [];
  const serviceEntries = planDefinitions.map(definition => ({
    definition,
    service: serviceForSlug.get(definition.slug)!,
    plans: selectedPlans.get(definition.slug)!,
  }));
  const profilesByService = new Map<string, Array<{ account: Account; profile: AccountProfile }>>();
  accounts.forEach(account => {
    const linked = profilesByService.get(account.serviceId) || [];
    account.profiles.forEach(profile => linked.push({ account, profile }));
    profilesByService.set(account.serviceId, linked);
  });
  const usedInvoiceNo = invoiceNumbers;

  for (let index = 0; index < 40; index += 1) {
    const entry = serviceEntries[index % serviceEntries.length];
    const plan = entry.plans[Math.floor(index / serviceEntries.length) % entry.plans.length];
    const customer = customers[index % customers.length];
    const accountProfile = profilesByService.get(entry.service.id)?.shift();
    const saleId = makeUniqueId(demoId('sale', String(index + 1).padStart(3, '0')), used.sales);
    const subscriptionId = makeUniqueId(demoId('subscription', String(index + 1).padStart(3, '0')), used.subscriptions);
    const paymentId = makeUniqueId(demoId('payment', String(index + 1).padStart(3, '0')), used.payments);
    const invoiceId = makeUniqueId(demoId('invoice', String(index + 1).padStart(3, '0')), used.invoices);
    const invoiceNo = makeUniqueValue(
      `DEMO-INV-${today.slice(0, 4)}-${String(index + 1).padStart(4, '0')}`,
      usedInvoiceNo,
    );
    const statusIndex = index % 10;
    const paymentStatus: PaymentStatus = statusIndex === 5 || statusIndex === 9
      ? 'partial'
      : statusIndex === 6 ? 'pending'
        : statusIndex === 8 ? 'failed' : 'paid';
    const price = plan.price;
    const discount = index % 4 === 0 ? Number((price * 0.05).toFixed(currency === 'BDT' ? 0 : 2)) : 0;
    const total = Math.max(1, price - discount);
    const amountPaid = paymentStatus === 'paid'
      ? total
      : paymentStatus === 'partial'
        ? Number((total * (index % 2 ? 0.4 : 0.65)).toFixed(currency === 'BDT' ? 0 : 2))
        : 0;
    let startOffset: number;
    if (index < 10) startOffset = -Math.max(1, plan.durationDays - (10 + (index % 20)));
    else if (index < 22) startOffset = -Math.max(1, plan.durationDays - (1 + (index % 7)));
    else if (index < 32) startOffset = -plan.durationDays - (1 + (index % 20));
    else if (index < 36) startOffset = 2 + (index % 8);
    else startOffset = -Math.max(1, plan.durationDays - 20);
    const startDate = dateOffset(today, startOffset);
    const expiryDate = calculateExpiryDate(startDate, plan.durationDays);
    const derivedStatus = index >= 36
      ? 'cancelled'
      : expiryDate < today
        ? 'expired'
        : expiryDate <= dateOffset(today, 7)
          ? 'expiring_soon'
          : 'active';
    const saleDate = startDate > today ? today : startDate;
    const createdAt = dayTimestamp(saleDate);
    const selectedMethod = paymentMethods[index % paymentMethods.length];
    const financialAccount = financialAccounts[index % financialAccounts.length];
    let linkedAccount: Account | undefined;
    let linkedProfile: AccountProfile | undefined;
    if (accountProfile && accountProfile.account.serviceId === entry.service.id) {
      linkedAccount = accountProfile.account;
      linkedProfile = accountProfile.profile;
    }
    const sale: Sale = scoped({
      id: saleId,
      subscriptionId,
      paymentId,
      ...(linkedAccount ? { accountId: linkedAccount.id, profileId: linkedProfile?.id } : {}),
      planId: plan.id,
      customerId: customer.id,
      serviceId: entry.service.id,
      plan: plan.name,
      subtotal: price,
      discount,
      amount: total,
      amountPaid,
      currency: plan.currency,
      paymentMethod: selectedMethod,
      paymentStatus,
      date: saleDate,
      invoiceNo,
      transactionId: paymentStatus === 'pending' || paymentStatus === 'failed'
        ? undefined
        : makeUniqueValue(`DEMO-TRX-${String(index + 1).padStart(4, '0')}`, transactions),
      senderNumber: customer.phone.replace(/\D/g, ''),
      notes: '[DEMO DATA] Historical sample sale for testing only.',
      operationId: demoId('operation', String(index + 1).padStart(3, '0')),
      createdAt,
    }, businessId);
    const subscription: Subscription = scoped({
      id: subscriptionId,
      saleId,
      paymentId,
      customerId: customer.id,
      serviceId: entry.service.id,
      ...(linkedAccount ? { accountId: linkedAccount.id, profileId: linkedProfile?.id } : {}),
      planId: plan.id,
      plan: plan.name,
      startDate,
      durationDays: plan.durationDays,
      expiryDate,
      price: total,
      currency: plan.currency,
      paymentStatus,
      status: derivedStatus,
      ...(derivedStatus === 'cancelled' ? {
        cancelledAt: nowIso,
        cancelledBy: 'demo-data',
        cancellationReason: 'Sample cancellation for UI testing.',
      } : {}),
      notes: '[DEMO DATA] Generated for local testing; no service access was provisioned.',
      createdAt,
    }, businessId);
    const payment: Payment = scoped({
      id: paymentId,
      customerId: customer.id,
      invoiceId,
      saleId,
      subscriptionId,
      amount: paymentStatus === 'paid' || paymentStatus === 'partial' ? amountPaid : total,
      currency: plan.currency,
      paymentMethod: selectedMethod,
      paymentMethodName: selectedMethod,
      financialAccountId: financialAccount.id,
      paymentDate: saleDate,
      paymentStatus,
      transactionId: sale.transactionId,
      senderNumber: sale.senderNumber,
      notes: '[DEMO DATA] Sample payment; no real money moved.',
      createdAt,
    }, businessId);
    const invoice = createInvoiceRecord(sale, [payment], undefined, businessId, invoiceId);
    invoice.invoiceNumber = invoiceNo;
    invoice.updatedAt = nowIso;
    invoice.creationLogPending = false;
    ids.sales.push(saleId);
    ids.subscriptions.push(subscriptionId);
    ids.payments.push(paymentId);
    ids.invoices.push(invoiceId);
    sales.push(sale);
    subscriptions.push(subscription);
    payments.push(payment);
    invoices.push(invoice);
    if (linkedAccount && linkedProfile) {
      const accountProfilesForUpdate = accountProfiles.get(linkedAccount.id) || [];
      const profileIndex = accountProfilesForUpdate.findIndex(profile => profile.id === linkedProfile.id);
      if (profileIndex >= 0) {
        accountProfilesForUpdate[profileIndex] = {
          ...accountProfilesForUpdate[profileIndex],
          assignedCustomerId: customer.id,
          subscriptionId,
          status: expiryDate < today ? 'Expired' : 'Assigned',
          startDate,
          expiryDate,
        };
        accountProfiles.set(linkedAccount.id, accountProfilesForUpdate);
      }
    }
  }

  const finalAccounts = accounts.map(account => {
    const profiles = accountProfiles.get(account.id) || account.profiles;
    return {
      ...account,
      profiles,
      status: profiles.some(profile => profile.status === 'Assigned') ? 'Assigned' as const : 'Available' as const,
    };
  });
  const finalServices = services.map(service => serviceForSlug.get(
    planDefinitions.find(definition => serviceForSlug.get(definition.slug)?.id === service.id)?.slug || ''
  ) || service);

  const categoryByName = new Map(addedExpenseCategories.map(category => [category.name, category.id]));
  const demoExpenses: Expense[] = Array.from({ length: 20 }, (_, index) => {
    const account = financialAccounts[index % financialAccounts.length];
    const [categorySlug, categoryName] = expenseCategoryDefinitions[index % expenseCategoryDefinitions.length];
    const id = makeUniqueId(demoId('expense', String(index + 1).padStart(3, '0')), used.expenses);
    ids.expenses.push(id);
    return scoped({
      id,
      accountId: account.id,
      categoryId: categoryByName.get(categoryName)!,
      amount: currency === 'BDT'
        ? 650 + ((index * 487) % 4200)
        : Number(((650 + ((index * 487) % 4200)) / 120).toFixed(2)),
      currency,
      date: dateOffset(today, -(index * 4) % 86),
      description: `${categoryName} operating expense (${categorySlug})`,
      vendor: `${categoryName} Demo Vendor`,
      reference: demoId('expense_reference', String(index + 1).padStart(3, '0')),
      notes: '[DEMO DATA] Sample expense; no real payment was made.',
      status: 'posted' as const,
      profitabilityCostType: 'operating' as const,
      profitabilityAllocationMethod: 'revenue' as const,
      createdAt: dayTimestamp(dateOffset(today, -(index * 4) % 86)),
      updatedAt: nowIso,
    }, businessId);
  });
  const demoIncome: OtherIncome[] = Array.from({ length: 6 }, (_, index) => {
    const id = makeUniqueId(demoId('income', String(index + 1).padStart(3, '0')), used.otherIncome);
    ids.otherIncome.push(id);
    return scoped({
      id,
      accountId: financialAccounts[(index + 1) % financialAccounts.length].id,
      categoryId: addedIncomeCategories[index % addedIncomeCategories.length].id,
      amount: currency === 'BDT' ? 900 + index * 375 : Number(((900 + index * 375) / 120).toFixed(2)),
      currency,
      date: dateOffset(today, -(index * 11) % 78),
      description: index % 2 ? 'Demo referral commission' : 'Demo partner income',
      reference: demoId('income_reference', String(index + 1)),
      notes: '[DEMO DATA] Sample income; no real funds were received.',
      status: 'posted' as const,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, businessId);
  });
  const demoTransfers: FinancialTransfer[] = Array.from({ length: 4 }, (_, index) => {
    const id = makeUniqueId(demoId('transfer', String(index + 1).padStart(3, '0')), used.financialTransfers);
    ids.financialTransfers.push(id);
    return scoped({
      id,
      fromAccountId: financialAccounts[index % financialAccounts.length].id,
      toAccountId: financialAccounts[(index + 1) % financialAccounts.length].id,
      amount: currency === 'BDT' ? 1200 + index * 425 : Number(((1200 + index * 425) / 120).toFixed(2)),
      currency,
      date: dateOffset(today, -(index * 8) % 50),
      reference: demoId('transfer_reference', String(index + 1)),
      note: '[DEMO DATA] Internal account transfer; does not create business income.',
      status: 'posted' as const,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, businessId);
  });

  const demoClosingDates: string[] = [];
  const demoClosingIds: string[] = [];
  const usedClosingIds = new Set(used.dailyClosings);
  const existingClosingDates = new Set(current.dailyClosings.map(item => item.date));
  for (let offset = 15; demoClosingDates.length < 3 && offset < 100; offset += 1) {
    const date = dateOffset(today, -offset);
    if (existingClosingDates.has(date)) continue;
    demoClosingDates.push(date);
    demoClosingIds.push(makeUniqueId(demoId('daily_closing', date), usedClosingIds));
  }

  const demoReminders: Reminder[] = Array.from({ length: 10 }, (_, index) => {
    const saleIndex = (index * 3) % sales.length;
    const sale = sales[saleIndex];
    const subscription = subscriptions[saleIndex];
    const invoice = invoices[saleIndex];
    const type: Reminder['type'] = index % 5 === 0 ? 'payment_due'
      : index % 5 === 1 ? 'invoice_due'
        : index % 5 === 2 ? 'customer_follow_up'
          : index % 5 === 3 ? 'renewal_upcoming' : 'daily_closing';
    const sourceEntityType: Reminder['sourceEntityType'] = type === 'payment_due' ? 'sale'
      : type === 'invoice_due' ? 'invoice'
        : type === 'renewal_upcoming' ? 'subscription'
          : type === 'customer_follow_up' ? 'customer' : 'daily_closing';
    const sourceEntityId = type === 'payment_due' ? sale.id
      : type === 'invoice_due' ? invoice.invoiceId
        : type === 'renewal_upcoming' ? subscription.id
          : type === 'customer_follow_up' ? sale.customerId
            : demoClosingIds.length > 0 ? demoClosingIds[index % demoClosingIds.length]
              : current.dailyClosings[0]?.id || demoId('daily_closing', String(index + 1));
    const id = makeUniqueId(demoId('reminder', String(index + 1).padStart(3, '0')), used.reminders);
    ids.reminders.push(id);
    const status: Reminder['status'] = index % 5 === 0 ? 'open'
      : index % 5 === 1 ? 'snoozed'
        : index % 5 === 2 ? 'completed'
          : index % 5 === 3 ? 'dismissed' : 'open';
    return scoped({
      id,
      reminderId: id,
      deterministicKey: demoId('reminder_key', String(index + 1).padStart(3, '0')),
      type,
      status,
      priority: index % 4 === 0 ? 'high' : index % 3 === 0 ? 'low' : 'medium',
      title: `[DEMO] ${type.replace(/_/g, ' ')}`,
      description: 'Sample reminder for interface testing. No message was sent.',
      customerId: sale.customerId,
      serviceId: sale.serviceId,
      planId: sale.planId,
      ...(type === 'renewal_upcoming' ? { subscriptionId: subscription.id } : {}),
      ...(type === 'invoice_due' ? { invoiceId: invoice.invoiceId } : {}),
      ...(type === 'payment_due' ? { saleId: sale.id } : {}),
      sourceEntityType,
      sourceEntityId,
      dueDate: dateOffset(today, index % 2 ? 3 + index : -1),
      targetDate: dateOffset(today, 3 + index),
      stage: 'demo',
      amount: invoice.dueAmount,
      currency: sale.currency,
      ...(status === 'snoozed' ? { snoozedUntil: dateOffset(today, 2) + 'T09:00:00.000Z' } : {}),
      ...(status === 'completed' ? { completedAt: nowIso } : {}),
      ...(status === 'dismissed' ? { dismissedAt: nowIso } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      systemGenerated: false,
    }, businessId);
  });

  const demoActivityLogs: ActivityLog[] = [];
  const addActivity = (index: number, type: ActivityLog['type'], title: string, description: string, sale?: Sale) => {
    const id = makeUniqueId(demoId('activity', String(index + 1).padStart(3, '0')), used.activityLogs);
    ids.activityLogs.push(id);
    demoActivityLogs.push(scoped({
      id,
      type,
      category: type === 'demo_communication_recorded' ? 'system' : 'sales',
      action: 'created',
      entityType: sale ? 'sale' : 'system',
      title: `[DEMO] ${title}`,
      description,
      timestamp: dayTimestamp(sale?.date || today),
      entityId: sale?.id,
      customerId: sale?.customerId,
      serviceId: sale?.serviceId,
      planId: sale?.planId,
      subscriptionId: sale?.subscriptionId,
      saleId: sale?.id,
      invoiceId: sale ? invoices.find(invoice => invoice.saleId === sale.id)?.invoiceId : undefined,
      customerName: sale ? customers.find(customer => customer.id === sale.customerId)?.name : undefined,
      serviceName: sale ? services.find(service => service.id === sale.serviceId)?.name : undefined,
      amount: sale?.amount,
      currency: sale?.currency,
      metadata: { source: 'demo', seededHistory: true, delivered: false },
      createdAt: dayTimestamp(sale?.date || today),
    }, businessId));
  };
  [
    ['customer_added', 'Demo customer created', 'Synthetic customer profile added for demo purposes.'],
    ['service_added', 'Demo service catalog prepared', 'Sample digital service catalog is available for testing.'],
    ['subscription_created', 'Demo subscription activated', 'A sample subscription record is available for UI testing.'],
    ['sale_created', 'Demo sale recorded', 'A sample sale record was added; no real transaction occurred.'],
    ['payment_recorded', 'Demo payment recorded', 'A sample payment record was added; no funds moved.'],
    ['invoice_created', 'Demo invoice prepared', 'A sample invoice record was created for testing.'],
  ].forEach(([type, title, description], index) =>
    addActivity(index, type as ActivityLog['type'], title, description, sales[index])
  );
  for (let index = 0; index < 15; index += 1) {
    const sale = sales[(index * 2) % sales.length];
    addActivity(
      6 + index,
      'demo_communication_recorded',
      ['Welcome message preview', 'Renewal reminder preview', 'Payment follow-up preview', 'Invoice message preview', 'Customer follow-up preview'][index % 5],
      'Demo communication scenario recorded locally for UI testing. Message was not sent or delivered.',
      sale,
    );
  }

  const demoNotifications: BusinessNotification[] = Array.from({ length: 6 }, (_, index) => {
    const sale = sales[index * 5];
    const invoice = invoices[index * 5];
    const subscription = subscriptions[index * 5];
    const id = makeUniqueId(demoId('notification', String(index + 1).padStart(3, '0')), used.notifications);
    ids.notifications.push(id);
    const category: BusinessNotification['category'] = index % 3 === 0 ? 'subscription'
      : index % 3 === 1 ? 'payment' : 'invoice';
    return scoped({
      id,
      dedupeKey: demoId('notification_key', String(index + 1)),
      type: 'demo_sample',
      category,
      priority: index % 2 ? 'info' : 'warning',
      title: `[DEMO] ${index % 3 === 0 ? 'Renewal opportunity' : index % 3 === 1 ? 'Payment follow-up' : 'Invoice due'}`,
      message: 'Sample notification for local testing; no external action was performed.',
      entityType: category,
      entityId: category === 'invoice' ? invoice.invoiceId : category === 'subscription' ? subscription.id : sale.id,
      customerId: sale.customerId,
      serviceId: sale.serviceId,
      subscriptionId: subscription.id,
      saleId: sale.id,
      invoiceId: invoice.invoiceId,
      section: category === 'invoice' ? 'invoices' : category === 'subscription' ? 'subscriptions' : 'payments',
      read: index % 2 === 1,
      createdAt: nowIso,
      expiresAt: dateOffset(today, 30) + 'T23:59:59.000Z',
    }, businessId);
  });

  const demoProfitabilityCosts: ProfitabilityCost[] = [];
  const records: DemoDataSnapshot = {
    customers: [...current.customers, ...customers],
    services: finalServices,
    accounts: [...current.accounts, ...finalAccounts],
    subscriptions: [...current.subscriptions, ...subscriptions],
    sales: [...current.sales, ...sales],
    payments: [...current.payments, ...payments],
    invoices: [...current.invoices, ...invoices],
    financialAccounts: [...current.financialAccounts, ...financialAccounts],
    expenses: [...current.expenses, ...demoExpenses],
    otherIncome: [...current.otherIncome, ...demoIncome],
    financialTransfers: [...current.financialTransfers, ...demoTransfers],
    financialAdjustments: current.financialAdjustments,
    dailyClosings: current.dailyClosings,
    financialReconciliations: current.financialReconciliations,
    financialPeriods: current.financialPeriods,
    reminders: [...current.reminders, ...demoReminders],
    profitabilityCosts: [...current.profitabilityCosts, ...demoProfitabilityCosts],
    activityLogs: [...current.activityLogs, ...demoActivityLogs],
    notifications: [...current.notifications, ...demoNotifications],
    settings: nextSettings,
  };

  const methodConfigs = (nextSettings.paymentPreferences?.methods || []).filter(
    (method): method is import('../types').PaymentMethodConfig => typeof method === 'object' && method !== null
  );
  const ledger = getFinancialLedger({
    accounts: records.financialAccounts,
    payments: records.payments,
    expenses: records.expenses,
    income: records.otherIncome,
    transfers: records.financialTransfers,
    adjustments: records.financialAdjustments,
    paymentMethods: methodConfigs,
    expenseCategories: nextSettings.financialPreferences?.expenseCategories || [],
    incomeCategories: nextSettings.financialPreferences?.incomeCategories || [],
    sales: records.sales,
    invoices: records.invoices,
    subscriptions: records.subscriptions,
    customers: records.customers,
  });
  const dailyClosings: DailyClosing[] = [];
  const financialReconciliations: FinancialReconciliation[] = [];
  for (let closingIndex = 0; closingIndex < demoClosingDates.length; closingIndex += 1) {
    const date = demoClosingDates[closingIndex];
    const summary = getDailyFinancialSummary(records.financialAccounts, ledger, date, currency);
    const id = demoClosingIds[closingIndex];
    ids.dailyClosings.push(id);
    dailyClosings.push(scoped({
      id,
      businessId: businessId || 'local-business',
      date,
      currency,
      status: 'reopened' as const,
      openingBalance: summary.openingBalance,
      totalMoneyIn: summary.totalMoneyIn,
      totalMoneyOut: summary.totalMoneyOut,
      transfersIn: summary.transfersIn,
      transfersOut: summary.transfersOut,
      adjustmentsNet: summary.adjustmentsNet,
      expectedClosingBalance: summary.expectedClosingBalance,
      actualClosingBalance: summary.expectedClosingBalance,
      difference: 0,
      accounts: summary.accounts.map(item => ({
        ...item,
        actualClosingBalance: item.expectedClosingBalance,
        difference: 0,
      })),
      paymentMethods: summary.paymentMethods,
      expensesByAccount: summary.expensesByAccount,
      closingReason: 'Demo sample day reopened for safe testing.',
      closedAt: dayTimestamp(date),
      closedBy: 'demo-data',
      reopenedAt: nowIso,
      createdAt: dayTimestamp(date),
      updatedAt: nowIso,
    }, businessId));
    for (const accountSummary of summary.accounts) {
      const reconcileId = makeUniqueId(demoId('reconciliation', `${date}_${accountSummary.accountId}`), used.financialReconciliations);
      ids.financialReconciliations.push(reconcileId);
      financialReconciliations.push({
        id: reconcileId,
        businessId: businessId || 'local-business',
        accountId: accountSummary.accountId,
        reconciliationDate: date,
        systemBalance: accountSummary.expectedClosingBalance,
        actualBalance: accountSummary.expectedClosingBalance,
        difference: 0,
        status: 'matched',
        note: '[DEMO DATA] Sample reconciliation; actual funds were not verified.',
        createdAt: nowIso,
      });
    }
  }
  records.dailyClosings = [...records.dailyClosings, ...dailyClosings];
  records.financialReconciliations = [...records.financialReconciliations, ...financialReconciliations];

  const manifest: DemoDataManifest = {
    version: 1,
    ...(businessId ? { businessId } : {}),
    installedAt: nowIso,
    records: ids,
    planIds: [...ids.planIds],
  };
  return { snapshot: records, manifest };
};

export const isValidDemoDataManifest = (value: unknown): value is DemoDataManifest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const manifest = value as Partial<DemoDataManifest>;
  return manifest.version === 1
    && typeof manifest.installedAt === 'string'
    && typeof manifest.records === 'object'
    && manifest.records !== null
    && !Array.isArray(manifest.records)
    && Object.values(manifest.records).every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'string'))
    && Array.isArray(manifest.planIds)
    && manifest.planIds.every(id => typeof id === 'string');
};

export const discoverDemoDataManifest = (
  snapshot: DemoDataSnapshot,
  businessId?: string,
): DemoDataManifest => {
  const records = emptyIds();
  snapshot.customers.filter(item => isDemoId(item.id)).forEach(item => records.customers.push(item.id));
  snapshot.services.filter(item => isDemoId(item.id)).forEach(item => records.services.push(item.id));
  snapshot.services.flatMap(item => item.planDetails || []).filter(item => isDemoId(item.id)).forEach(item => records.planIds.push(item.id));
  snapshot.accounts.filter(item => isDemoId(item.id)).forEach(item => records.accounts.push(item.id));
  snapshot.accounts.flatMap(item => item.profiles).filter(item => isDemoId(item.id)).forEach(item => records.profiles.push(item.id));
  snapshot.subscriptions.filter(item => isDemoId(item.id)).forEach(item => records.subscriptions.push(item.id));
  snapshot.sales.filter(item => isDemoId(item.id)).forEach(item => records.sales.push(item.id));
  snapshot.payments.filter(item => isDemoId(item.id)).forEach(item => records.payments.push(item.id));
  snapshot.invoices.filter(item => isDemoId(item.invoiceId)).forEach(item => records.invoices.push(item.invoiceId));
  snapshot.financialAccounts.filter(item => isDemoId(item.id)).forEach(item => records.financialAccounts.push(item.id));
  snapshot.expenses.filter(item => isDemoId(item.id)).forEach(item => records.expenses.push(item.id));
  snapshot.otherIncome.filter(item => isDemoId(item.id)).forEach(item => records.otherIncome.push(item.id));
  snapshot.financialTransfers.filter(item => isDemoId(item.id)).forEach(item => records.financialTransfers.push(item.id));
  snapshot.dailyClosings.filter(item => isDemoId(item.id)).forEach(item => records.dailyClosings.push(item.id));
  snapshot.financialReconciliations.filter(item => isDemoId(item.id)).forEach(item => records.financialReconciliations.push(item.id));
  snapshot.reminders.filter(item => isDemoId(item.id)).forEach(item => records.reminders.push(item.id));
  snapshot.profitabilityCosts.filter(item => isDemoId(item.id)).forEach(item => records.profitabilityCosts.push(item.id));
  snapshot.activityLogs.filter(item => isDemoId(item.id)).forEach(item => records.activityLogs.push(item.id));
  snapshot.notifications.filter(item => isDemoId(item.id)).forEach(item => records.notifications.push(item.id));
  snapshot.settings.financialPreferences?.expenseCategories
    ?.filter(item => isDemoId(item.id)).forEach(item => records.expenseCategories.push(item.id));
  snapshot.settings.financialPreferences?.incomeCategories
    ?.filter(item => isDemoId(item.id)).forEach(item => records.incomeCategories.push(item.id));
  return {
    version: 1,
    ...(businessId ? { businessId } : {}),
    installedAt: new Date().toISOString(),
    records,
    planIds: records.planIds,
  };
};

export const manifestHasDemoData = (manifest: DemoDataManifest | null): boolean =>
  Boolean(manifest && Object.values(manifest.records).some(ids => ids.length > 0));

export const findExternalDemoReferences = (
  snapshot: DemoDataSnapshot,
  manifest: DemoDataManifest,
): string[] => {
  const records = manifest.records;
  const ids = (name: string) => new Set(records[name] || []);
  const demoCustomers = ids('customers');
  const demoServices = ids('services');
  const demoAccounts = ids('accounts');
  const demoProfiles = ids('profiles');
  const demoSubscriptions = ids('subscriptions');
  const demoSales = ids('sales');
  const demoPayments = ids('payments');
  const demoInvoices = ids('invoices');
  const demoFinancialAccounts = ids('financialAccounts');
  const demoExpenses = ids('expenses');
  const demoIncome = ids('otherIncome');
  const demoTransfers = ids('financialTransfers');
  const demoDailyClosings = ids('dailyClosings');
  const demoReconciliations = ids('financialReconciliations');
  const demoPlans = new Set(manifest.planIds);
  const referenced = new Set<string>();
  const mark = (condition: boolean, label: string) => { if (condition) referenced.add(label); };

  snapshot.subscriptions.filter(item => !demoSubscriptions.has(item.id)).forEach(item => {
    mark(demoCustomers.has(item.customerId), 'customer');
    mark(demoServices.has(item.serviceId), 'service');
    mark(Boolean(item.accountId && demoAccounts.has(item.accountId)), 'account');
    mark(Boolean(item.profileId && demoProfiles.has(item.profileId)), 'profile');
    mark(Boolean(item.saleId && demoSales.has(item.saleId)), 'sale');
    mark(Boolean(item.paymentId && demoPayments.has(item.paymentId)), 'payment');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
    mark(Boolean(item.renewedFromSubscriptionId && demoSubscriptions.has(item.renewedFromSubscriptionId)), 'subscription');
    item.renewalHistory?.forEach(renewal => {
      mark(demoSales.has(renewal.saleId), 'sale');
      mark(demoPayments.has(renewal.paymentId), 'payment');
      mark(demoSubscriptions.has(renewal.subscriptionId), 'subscription');
      mark(Boolean(renewal.planId && demoPlans.has(renewal.planId)), 'plan');
    });
  });
  snapshot.sales.filter(item => !demoSales.has(item.id)).forEach(item => {
    mark(demoCustomers.has(item.customerId), 'customer');
    mark(demoServices.has(item.serviceId), 'service');
    mark(Boolean(item.accountId && demoAccounts.has(item.accountId)), 'account');
    mark(Boolean(item.profileId && demoProfiles.has(item.profileId)), 'profile');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.paymentId && demoPayments.has(item.paymentId)), 'payment');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
    mark(Boolean(item.renewalOfSubscriptionId && demoSubscriptions.has(item.renewalOfSubscriptionId)), 'subscription');
  });
  snapshot.payments.filter(item => !demoPayments.has(item.id)).forEach(item => {
    mark(demoCustomers.has(item.customerId), 'customer');
    mark(Boolean(item.saleId && demoSales.has(item.saleId)), 'sale');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.invoiceId && demoInvoices.has(item.invoiceId)), 'invoice');
    mark(Boolean(item.financialAccountId && demoFinancialAccounts.has(item.financialAccountId)), 'financial account');
  });
  snapshot.invoices.filter(item => !demoInvoices.has(item.invoiceId)).forEach(item => {
    mark(demoCustomers.has(item.customerId), 'customer');
    mark(demoServices.has(item.serviceId), 'service');
    mark(demoSales.has(item.saleId), 'sale');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
  });
  snapshot.accounts.filter(item => !demoAccounts.has(item.id)).forEach(item => {
    mark(demoServices.has(item.serviceId), 'service');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
    item.profiles.forEach(profile => {
      mark(Boolean(profile.assignedCustomerId && demoCustomers.has(profile.assignedCustomerId)), 'customer');
      mark(Boolean(profile.subscriptionId && demoSubscriptions.has(profile.subscriptionId)), 'subscription');
      mark(Boolean(profile.accountId && demoAccounts.has(profile.accountId)), 'account');
      mark(demoProfiles.has(profile.id), 'profile');
    });
  });
  snapshot.expenses.filter(item => !demoExpenses.has(item.id)).forEach(item => {
    mark(demoFinancialAccounts.has(item.accountId), 'financial account');
    mark(Boolean(item.profitabilityServiceId && demoServices.has(item.profitabilityServiceId)), 'service');
    mark(Boolean(item.profitabilityPlanId && demoPlans.has(item.profitabilityPlanId)), 'plan');
    mark(Boolean(item.categoryId && ids('expenseCategories').has(item.categoryId)), 'expense category');
  });
  snapshot.otherIncome.filter(item => !demoIncome.has(item.id)).forEach(item =>
  {
    mark(demoFinancialAccounts.has(item.accountId), 'financial account');
    mark(ids('incomeCategories').has(item.categoryId), 'income category');
  });
  snapshot.financialTransfers.filter(item => !demoTransfers.has(item.id)).forEach(item => {
    mark(demoFinancialAccounts.has(item.fromAccountId), 'financial account');
    mark(demoFinancialAccounts.has(item.toAccountId), 'financial account');
  });
  snapshot.financialAdjustments.forEach(item => mark(demoFinancialAccounts.has(item.accountId), 'financial account'));
  snapshot.dailyClosings.filter(item => !demoDailyClosings.has(item.id)).forEach(item =>
    item.accounts.forEach(account => mark(demoFinancialAccounts.has(account.accountId), 'financial account'))
  );
  snapshot.financialReconciliations.filter(item => !demoReconciliations.has(item.id)).forEach(item =>
    mark(demoFinancialAccounts.has(item.accountId), 'financial account')
  );
  snapshot.reminders.filter(item => !ids('reminders').has(item.id) && !item.systemGenerated).forEach(item => {
    mark(Boolean(item.customerId && demoCustomers.has(item.customerId)), 'customer');
    mark(Boolean(item.serviceId && demoServices.has(item.serviceId)), 'service');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.saleId && demoSales.has(item.saleId)), 'sale');
    mark(Boolean(item.invoiceId && demoInvoices.has(item.invoiceId)), 'invoice');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
    mark(Boolean(item.sourceEntityId && (
      demoDailyClosings.has(item.sourceEntityId) || demoReconciliations.has(item.sourceEntityId)
      || demoCustomers.has(item.sourceEntityId) || demoServices.has(item.sourceEntityId)
      || demoAccounts.has(item.sourceEntityId) || demoProfiles.has(item.sourceEntityId)
      || demoSubscriptions.has(item.sourceEntityId) || demoSales.has(item.sourceEntityId)
      || demoPayments.has(item.sourceEntityId) || demoInvoices.has(item.sourceEntityId)
    )), 'demo record');
  });
  snapshot.profitabilityCosts.filter(item => !ids('profitabilityCosts').has(item.id)).forEach(item => {
    mark(Boolean(item.serviceId && demoServices.has(item.serviceId)), 'service');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.saleId && demoSales.has(item.saleId)), 'sale');
    mark(Boolean(item.customerId && demoCustomers.has(item.customerId)), 'customer');
    mark(Boolean(item.expenseId && demoExpenses.has(item.expenseId)), 'expense');
    item.manualAllocations?.forEach(allocation => mark(demoServices.has(allocation.serviceId), 'service'));
  });
  snapshot.activityLogs.filter(item => !ids('activityLogs').has(item.id)).forEach(item => {
    mark(Boolean(item.customerId && demoCustomers.has(item.customerId)), 'customer');
    mark(Boolean(item.serviceId && demoServices.has(item.serviceId)), 'service');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.saleId && demoSales.has(item.saleId)), 'sale');
    mark(Boolean(item.paymentId && demoPayments.has(item.paymentId)), 'payment');
    mark(Boolean(item.invoiceId && demoInvoices.has(item.invoiceId)), 'invoice');
    mark(Boolean(item.planId && demoPlans.has(item.planId)), 'plan');
    mark(Boolean(item.accountId && demoAccounts.has(item.accountId)), 'account');
    mark(Boolean(item.financialAccountId && demoFinancialAccounts.has(item.financialAccountId)), 'financial account');
    mark(Boolean(item.profileId && demoProfiles.has(item.profileId)), 'profile');
    mark(Boolean(item.entityId && (
      demoCustomers.has(item.entityId) || demoServices.has(item.entityId) || demoPlans.has(item.entityId)
      || demoAccounts.has(item.entityId) || demoProfiles.has(item.entityId)
      || demoSubscriptions.has(item.entityId) || demoSales.has(item.entityId)
      || demoPayments.has(item.entityId) || demoInvoices.has(item.entityId)
      || demoFinancialAccounts.has(item.entityId) || demoExpenses.has(item.entityId)
      || demoIncome.has(item.entityId) || demoTransfers.has(item.entityId)
      || demoDailyClosings.has(item.entityId) || demoReconciliations.has(item.entityId)
    )), 'demo record');
  });
  snapshot.notifications.filter(item =>
    !ids('notifications').has(item.id)
    && !['subscription-expiring-', 'subscription-expired-', 'payment-failed-', 'payment-pending-',
      'payment-partial-', 'payment-received-', 'invoice-due-', 'account-capacity-', 'account-inactive-',
      'service-inactive-', 'service-no-active-plans-', 'system-data-warning-', 'profile-unavailable-',
      'service-plan-inactive-', 'service-config-issue-', 'service-expiring-week-']
      .some(prefix => item.dedupeKey?.startsWith(prefix))
  ).forEach(item => {
    mark(Boolean(item.customerId && demoCustomers.has(item.customerId)), 'customer');
    mark(Boolean(item.serviceId && demoServices.has(item.serviceId)), 'service');
    mark(Boolean(item.subscriptionId && demoSubscriptions.has(item.subscriptionId)), 'subscription');
    mark(Boolean(item.saleId && demoSales.has(item.saleId)), 'sale');
    mark(Boolean(item.paymentId && demoPayments.has(item.paymentId)), 'payment');
    mark(Boolean(item.invoiceId && demoInvoices.has(item.invoiceId)), 'invoice');
    mark(Boolean(item.accountId && demoAccounts.has(item.accountId)), 'account');
  });
  const paymentMethods = snapshot.settings.paymentPreferences?.methods;
  if (Array.isArray(paymentMethods)) {
    paymentMethods.forEach(method => {
      if (typeof method === 'object' && method !== null && 'financialAccountId' in method) {
        mark(
          typeof method.financialAccountId === 'string' && demoFinancialAccounts.has(method.financialAccountId),
          'financial account'
        );
      }
    });
  }
  return [...referenced];
};

export const removeDemoDataFromSnapshot = (
  snapshot: DemoDataSnapshot,
  manifest: DemoDataManifest,
): DemoDataSnapshot => {
  const ids = (name: string) => new Set(manifest.records[name] || []);
  const customers = ids('customers');
  const services = ids('services');
  const accounts = ids('accounts');
  const profiles = ids('profiles');
  const subscriptions = ids('subscriptions');
  const sales = ids('sales');
  const payments = ids('payments');
  const invoices = ids('invoices');
  const financialAccounts = ids('financialAccounts');
  const expenses = ids('expenses');
  const income = ids('otherIncome');
  const transfers = ids('financialTransfers');
  const closings = ids('dailyClosings');
  const reconciliations = ids('financialReconciliations');
  const reminders = ids('reminders');
  const costs = ids('profitabilityCosts');
  const activities = ids('activityLogs');
  const notifications = ids('notifications');
  const expenseCategories = ids('expenseCategories');
  const incomeCategories = ids('incomeCategories');
  const planIds = new Set(manifest.planIds);
  const referencesDemoEntity = (item: {
    customerId?: string;
    serviceId?: string;
    planId?: string;
    accountId?: string;
    profileId?: string;
    subscriptionId?: string;
    saleId?: string;
    paymentId?: string;
    invoiceId?: string;
    sourceEntityId?: string;
    financialAccountId?: string;
  }): boolean => Boolean(
    (item.customerId && customers.has(item.customerId))
    || (item.serviceId && services.has(item.serviceId))
    || (item.planId && planIds.has(item.planId))
    || (item.accountId && accounts.has(item.accountId))
    || (item.profileId && profiles.has(item.profileId))
    || (item.subscriptionId && subscriptions.has(item.subscriptionId))
    || (item.saleId && sales.has(item.saleId))
    || (item.paymentId && payments.has(item.paymentId))
    || (item.invoiceId && invoices.has(item.invoiceId))
    || (item.sourceEntityId && (
      closings.has(item.sourceEntityId) || reconciliations.has(item.sourceEntityId)
      || customers.has(item.sourceEntityId) || services.has(item.sourceEntityId)
      || accounts.has(item.sourceEntityId) || profiles.has(item.sourceEntityId)
      || subscriptions.has(item.sourceEntityId) || sales.has(item.sourceEntityId)
      || payments.has(item.sourceEntityId) || invoices.has(item.sourceEntityId)
      || financialAccounts.has(item.sourceEntityId) || expenses.has(item.sourceEntityId)
      || income.has(item.sourceEntityId) || transfers.has(item.sourceEntityId)
    ))
    || (item.financialAccountId && financialAccounts.has(item.financialAccountId))
  );
  const nextServices = snapshot.services
    .filter(item => !services.has(item.id))
    .map(service => {
      const removedPlanNames = new Set((service.planDetails || [])
        .filter(plan => planIds.has(plan.id))
        .map(plan => plan.name));
      const keptPlans = (service.planDetails || []).filter(plan => !planIds.has(plan.id));
      return {
        ...service,
        planDetails: keptPlans,
        plans: service.plans.filter(name => !removedPlanNames.has(name)),
        planIds: (service.planIds || []).filter(id => !planIds.has(id)),
      };
    });
  const remainingExpenses = snapshot.expenses.filter(item => !expenses.has(item.id));
  const remainingIncome = snapshot.otherIncome.filter(item => !income.has(item.id));
  const remainingReconciliations = snapshot.financialReconciliations.filter(item => !reconciliations.has(item.id));
  const referencedFinancialAccounts = new Set([
    ...snapshot.payments.filter(item => !payments.has(item.id)).map(item => item.financialAccountId || ''),
    ...remainingExpenses.map(item => item.accountId),
    ...remainingIncome.map(item => item.accountId),
    ...snapshot.financialTransfers.filter(item => !transfers.has(item.id)).flatMap(item => [item.fromAccountId, item.toAccountId]),
    ...snapshot.financialAdjustments.map(item => item.accountId),
    ...remainingReconciliations.map(item => item.accountId),
    ...(snapshot.settings.paymentPreferences?.methods || [])
      .filter((method): method is import('../types').PaymentMethodConfig =>
        typeof method === 'object' && method !== null
      )
      .map(method => method.financialAccountId || ''),
  ]);
  const preservedSettings: AppSettings = {
    ...snapshot.settings,
    financialPreferences: {
      ...snapshot.settings.financialPreferences,
      expenseCategories: snapshot.settings.financialPreferences?.expenseCategories?.filter(item =>
        !expenseCategories.has(item.id)
        || remainingExpenses.some(expense => expense.categoryId === item.id)
      ),
      incomeCategories: snapshot.settings.financialPreferences?.incomeCategories?.filter(item =>
        !incomeCategories.has(item.id)
        || remainingIncome.some(incomeRecord => incomeRecord.categoryId === item.id)
      ),
    },
  };
  const retainedProfileIds = new Set(snapshot.accounts
    .filter(account => !accounts.has(account.id))
    .flatMap(account => account.profiles.map(profile => profile.id)));
  const nextAccounts = snapshot.accounts
    .filter(item => !accounts.has(item.id))
    .map(account => ({
      ...account,
      profiles: account.profiles.filter(profile => !profiles.has(profile.id) || retainedProfileIds.has(profile.id)),
    }));
  return {
    ...snapshot,
    customers: snapshot.customers.filter(item => !customers.has(item.id)),
    services: nextServices,
    accounts: nextAccounts,
    subscriptions: snapshot.subscriptions.filter(item => !subscriptions.has(item.id)),
    sales: snapshot.sales.filter(item => !sales.has(item.id)),
    payments: snapshot.payments.filter(item => !payments.has(item.id)),
    invoices: snapshot.invoices.filter(item => !invoices.has(item.invoiceId)),
    financialAccounts: snapshot.financialAccounts.filter(item => !financialAccounts.has(item.id) || referencedFinancialAccounts.has(item.id)),
    expenses: remainingExpenses,
    otherIncome: remainingIncome,
    financialTransfers: snapshot.financialTransfers.filter(item => !transfers.has(item.id)),
    dailyClosings: snapshot.dailyClosings.filter(item => !closings.has(item.id)),
    financialReconciliations: remainingReconciliations,
    reminders: snapshot.reminders.filter(item => !reminders.has(item.id) && !referencesDemoEntity(item)),
    profitabilityCosts: snapshot.profitabilityCosts.filter(item => !costs.has(item.id)),
    activityLogs: snapshot.activityLogs.filter(item => !activities.has(item.id)),
    notifications: snapshot.notifications.filter(item => !notifications.has(item.id) && !referencesDemoEntity(item)),
    settings: preservedSettings,
  };
};
