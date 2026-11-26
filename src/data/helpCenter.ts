import type { NavSection } from '../components/navigation/Sidebar';
import type { Language } from '../types';
import { helpArticlesBn } from '../i18n/helpCenterBn';

export const helpCategories = [
  'Getting Started',
  'Customer Management',
  'Service Management',
  'Sales & Invoices',
  'Payments & Due Collection',
  'Accounts',
  'Reports',
  'Backup & Restore',
  'Settings & Privacy',
] as const;

export type HelpCategory = (typeof helpCategories)[number];

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  title: string;
  introduction: string;
  steps: string[];
  keywords: string[];
  destination?: NavSection;
  destinationLabel?: string;
  externalHref?: string;
  related: string[];
  note?: string;
  problem?: string;
  nextAction?: string;
}

export const helpArticles: HelpArticle[] = [
  {
    id: 'getting-started',
    category: 'Getting Started',
    title: 'Get started with your workspace',
    introduction: 'Set up the records you need for your first sale.',
    steps: [
      'Open the Dashboard and use the Getting started checklist to see customer, service, and sale setup progress.',
      'Add a customer with a name and phone number.',
      'Create a service and at least one active plan with a price, currency, and duration.',
      'Record a sale using the customer and active service plan.',
      'Create a receiving account in Money when you are ready to record money received.',
    ],
    keywords: ['first time', 'setup', 'onboarding', 'dashboard', 'workspace', 'production'],
    destination: 'dashboard',
    destinationLabel: 'Open Dashboard',
    related: ['customer-create', 'service-create', 'sales-create', 'receiving-account'],
    note: 'Invoices are connected to sales. Payment collection requires an active receiving account in the payment currency.',
  },
  {
    id: 'customer-create',
    category: 'Customer Management',
    title: 'Add a customer',
    introduction: 'Customer records keep contact details and related sales, payments, subscriptions, and invoices together.',
    steps: [
      'Open Customers and choose Add Customer.',
      'Enter the customer’s full name and phone number. Both are required; the name must contain at least two characters and the phone number at least six digits.',
      'Fill in other available contact details if needed, then save the customer.',
      'Use search and the status filters to find active or archived customers later.',
    ],
    keywords: ['customer', 'client', 'name', 'phone', 'contact', 'add', 'create'],
    destination: 'customers',
    destinationLabel: 'Open Customers',
    related: ['getting-started', 'sales-create', 'trouble-no-customers'],
  },
  {
    id: 'service-create',
    category: 'Service Management',
    title: 'Create a service and plan',
    introduction: 'Services describe what you sell. An active plan provides the price, currency, and duration used when recording a sale.',
    steps: [
      'Open Services and choose Add Service.',
      'Complete the service details and save the service.',
      'Open the service and add a plan. Give the plan a name, a positive price, a currency, and a duration.',
      'Keep the service and plan active if they should be selectable for new sales.',
      'Review service settings for customer, account, or profile requirements before selling the plan.',
    ],
    keywords: ['service', 'plan', 'price', 'duration', 'currency', 'active', 'catalog'],
    destination: 'services',
    destinationLabel: 'Open Services',
    related: ['getting-started', 'sales-create', 'trouble-no-services'],
  },
  {
    id: 'sales-create',
    category: 'Sales & Invoices',
    title: 'Record a sale',
    introduction: 'A sale connects a customer with service plan details and can create linked subscription, payment, and invoice records.',
    steps: [
      'Open Sales and choose New Sale.',
      'Select a customer and an active service and plan.',
      'Complete the sale details, such as subscription dates and any account or profile assignment required by that service.',
      'Review the total, discounts, payment status, and payment details shown in the form.',
      'Confirm the sale only after reviewing the information.',
    ],
    keywords: ['sale', 'sales', 'new sale', 'purchase', 'subscription', 'invoice'],
    destination: 'sales',
    destinationLabel: 'Open Sales',
    related: ['customer-create', 'service-create', 'invoice-create', 'payment-partial'],
    note: 'An inventory account used to fulfill a service is different from a Money receiving account used to track received funds.',
  },
  {
    id: 'invoice-create',
    category: 'Sales & Invoices',
    title: 'Create or review an invoice',
    introduction: 'Invoices are linked to sales. You can review sale-linked invoices or create an invoice for an existing sale.',
    steps: [
      'Open Invoices.',
      'If an invoice already exists, use search or filters to locate it and open its details.',
      'To create one for an existing sale, choose Create Invoice for Sale and select an available sale.',
      'If no sale is available, record a sale first; invoices are not created independently of sales.',
    ],
    keywords: ['invoice', 'receipt', 'bill', 'create invoice', 'sale'],
    destination: 'invoices',
    destinationLabel: 'Open Invoices',
    related: ['sales-create', 'due-collection'],
  },
  {
    id: 'payment-partial',
    category: 'Payments & Due Collection',
    title: 'Record a partial payment',
    introduction: 'A received payment can be allocated to outstanding sale balances. The preview shows what remains due and any advance created.',
    steps: [
      'Open Payments and choose Collect payment.',
      'Choose the customer and select the outstanding bill or bills to receive payment against.',
      'Enter the amount received, payment date, and active payment method.',
      'Choose an active receiving account in the same currency as the collection.',
      'Review the allocation summary, including Paid toward selected bills, Advance payment added, and Selected due left.',
      'Record the payment after checking the details.',
    ],
    keywords: ['payment', 'partial', 'part payment', 'collect', 'due', 'balance', 'receiving account'],
    destination: 'payments',
    destinationLabel: 'Open Payments',
    related: ['due-collection', 'advance-credit', 'receiving-account', 'trouble-invalid-amount'],
  },
  {
    id: 'advance-credit',
    category: 'Payments & Due Collection',
    title: 'Record or apply advance credit',
    introduction: 'An unallocated receipt is recorded as customer advance credit. Existing advance credit can later be applied to an eligible sale.',
    steps: [
      'To record an unallocated receipt, open Payments and choose Record Advance.',
      'Choose the customer and currency, then enter the amount received, date, and payment method.',
      'Choose the active receiving account for that currency and record the advance.',
      'To use existing credit, open the payment action for applying advance, choose the customer and currency, then select an eligible sale.',
      'Enter an amount within the displayed maximum and review the remaining advance before applying it.',
    ],
    keywords: ['advance', 'credit', 'unallocated', 'apply advance', 'prepayment'],
    destination: 'payments',
    destinationLabel: 'Open Payments',
    related: ['payment-partial', 'due-collection', 'receiving-account'],
    note: 'Applying an advance uses previously recorded money; it does not record a new receipt.',
  },
  {
    id: 'due-collection',
    category: 'Payments & Due Collection',
    title: 'Collect due payments',
    introduction: 'Use the collection workspace to find customer balances and record money against one or more outstanding bills.',
    steps: [
      'Open Payments and select the Collect Payments tab.',
      'Review the customers and outstanding bills shown; search or filter the list if needed.',
      'Choose Collect payment for the customer, then select the bill or bills being paid.',
      'Enter the amount and payment details, select a matching active receiving account, and review the allocation preview.',
      'Record the payment. The preview distinguishes money received, amounts applied, advance credit, and remaining selected due.',
    ],
    keywords: ['due', 'collect payment', 'collection', 'outstanding', 'unpaid', 'balance'],
    destination: 'payments',
    destinationLabel: 'Open Payments',
    related: ['payment-partial', 'advance-credit', 'invoice-create'],
  },
  {
    id: 'renewals-manage',
    category: 'Customer Management',
    title: 'Review and manage renewals',
    introduction: 'Subscriptions show their dates and status, and the app provides renewal actions for eligible records.',
    steps: [
      'Open Subscriptions and use search, status, or expiry filters to locate a subscription.',
      'Open the subscription to review its customer, service, plan, start date, expiry date, and status.',
      'Use the available renewal action to begin the renewal workflow and review the sale details before confirming.',
      'Use Dashboard reminders or Smart Reminders to review upcoming or overdue follow-ups.',
    ],
    keywords: ['renew', 'renewal', 'subscription', 'expiry', 'expired', 'reminder'],
    destination: 'subscriptions',
    destinationLabel: 'Open Subscriptions',
    related: ['sales-create', 'customer-create'],
  },
  {
    id: 'receiving-account',
    category: 'Accounts',
    title: 'Create a payment receiving account',
    introduction: 'Money accounts track balances and received funds. They are separate from service inventory accounts in the Accounts section.',
    steps: [
      'Open Money from the main navigation.',
      'Choose Add account.',
      'Enter an account name, choose its type and currency, and set its opening balance and date.',
      'Save the account. New accounts are created enabled and can be used for matching-currency payment collections.',
      'When recording a payment, select an enabled receiving account in the payment currency.',
    ],
    keywords: ['receiving account', 'money account', 'cashbook', 'bank', 'wallet', 'payment account', 'currency'],
    destination: 'cashbook',
    destinationLabel: 'Open Money',
    related: ['payment-partial', 'trouble-no-receiving-account', 'service-accounts'],
  },
  {
    id: 'service-accounts',
    category: 'Accounts',
    title: 'Manage service accounts and profiles',
    introduction: 'The Accounts and Profiles sections manage service inventory used to fulfill subscriptions; these are not money-receiving accounts.',
    steps: [
      'Open Accounts to review service account status and capacity.',
      'Open Profiles to manage profile slots associated with supported accounts.',
      'Check the selected service settings to see whether an account or profile is required.',
      'During a sale, assign available inventory when the service configuration calls for it.',
    ],
    keywords: ['service account', 'inventory', 'profiles', 'capacity', 'assignment', 'account'],
    destination: 'accounts',
    destinationLabel: 'Open Accounts',
    related: ['sales-create', 'receiving-account'],
    note: 'Payment receiving accounts are managed separately in Money.',
  },
  {
    id: 'reports-review',
    category: 'Reports',
    title: 'Review business reports',
    introduction: 'Reports summarize records already in the workspace; they do not create or change financial records.',
    steps: [
      'Open Reports and choose the report area you want to review.',
      'Set the available date range and filters for the records you need.',
      'Check the currency and current business context before comparing values.',
      'Open linked records from report rows when you need to verify a detail.',
    ],
    keywords: ['reports', 'analytics', 'date range', 'revenue', 'sales', 'payments'],
    destination: 'reports',
    destinationLabel: 'Open Reports',
    related: ['getting-started', 'backup-restore'],
  },
  {
    id: 'backup-restore',
    category: 'Backup & Restore',
    title: 'Back up or restore workspace data',
    introduction: 'Settings provides a downloadable JSON backup and a validated restore flow. Keep a backup copy outside this browser.',
    steps: [
      'Open Settings and select Data & Storage.',
      'To back up, use the JSON export action and save the downloaded file somewhere secure outside the browser profile.',
      'To restore, choose the backup file and review the validation preview, integrity information, record counts, and merge or replace mode.',
      'Confirm only after checking the preview. The app creates a safety backup before applying a restore.',
      'Keep the resulting backup private; it may contain sensitive business and service-account data.',
    ],
    keywords: ['backup', 'restore', 'export', 'json', 'import', 'merge', 'replace', 'storage'],
    destination: 'settings',
    destinationLabel: 'Open Settings',
    related: ['settings-privacy', 'trouble-restore'],
  },
  {
    id: 'settings-privacy',
    category: 'Settings & Privacy',
    title: 'Understand settings and local data',
    introduction: 'Business records are stored in browser LocalStorage for this browser profile. They are not automatically synchronized across devices.',
    steps: [
      'Open Settings to review business profile, payment preferences, notifications, and other available settings.',
      'Open Data & Storage to export or restore a backup and review storage information.',
      'Keep a separate backup before changing devices, browser profiles, or clearing browser data.',
      'Protect this device and browser profile. Local sign-in is not server-side authentication or a security boundary.',
      'Read the Privacy & Data Notice for details about local storage, external requests, and deletion.',
    ],
    keywords: ['privacy', 'local-first', 'localstorage', 'data', 'settings', 'browser', 'security', 'sync'],
    destination: 'settings',
    destinationLabel: 'Open Settings',
    externalHref: '/legal/privacy',
    related: ['backup-restore', 'getting-started'],
    note: 'Records remain on this device and browser profile.',
  },
  {
    id: 'trouble-no-customers',
    category: 'Customer Management',
    title: 'No customers are available',
    introduction: 'Sales and payment collection need a customer record, and archived customers may not be selectable.',
    steps: [
      'Open Customers and check whether search text or status filters are hiding records.',
      'If there are no customers yet, choose Add Customer and provide the required name and phone.',
      'If a customer is archived, restore the record when appropriate before using it in a new workflow.',
    ],
    keywords: ['troubleshoot', 'customer missing', 'empty', 'no customers', 'not found'],
    destination: 'customers',
    destinationLabel: 'Open Customers',
    related: ['customer-create', 'sales-create'],
    problem: 'The current workspace may not have a customer, the customer may be archived, or a filter/search may hide it.',
    nextAction: 'Check the workspace and filters, then add or restore the intended customer. Do not create a duplicate until you have searched existing records.',
  },
  {
    id: 'trouble-no-services',
    category: 'Service Management',
    title: 'No services or plans are available',
    introduction: 'New sales require an applicable active service and plan.',
    steps: [
      'Open Services and clear search and status filters.',
      'Check that the service and its plan are active.',
      'If no plan exists, open the service and add a plan with a positive price, currency, and duration.',
      'Return to the sale workflow and confirm the plan is eligible for the selected currency.',
    ],
    keywords: ['troubleshoot', 'service missing', 'no services', 'plans', 'inactive', 'empty'],
    destination: 'services',
    destinationLabel: 'Open Services',
    related: ['service-create', 'sales-create'],
    problem: 'No service may exist, or the service/plan may be inactive or filtered out.',
    nextAction: 'Create or activate a service plan and check its currency; then retry the sale.',
  },
  {
    id: 'trouble-no-receiving-account',
    category: 'Accounts',
    title: 'No receiving account is available',
    introduction: 'A payment can only be recorded when an enabled receiving account matches the collection currency.',
    steps: [
      'Check the currency selected in the payment collection form.',
      'Open Money and confirm an account in that currency exists and is enabled.',
      'If needed, choose Add account, set its currency, and save it.',
      'Return to the payment form and select the new account.',
    ],
    keywords: ['troubleshoot', 'receiving account', 'no account', 'currency', 'inactive', 'payment'],
    destination: 'cashbook',
    destinationLabel: 'Open Money',
    related: ['receiving-account', 'payment-partial'],
    problem: 'The workspace has no enabled financial account in the selected payment currency, or the selected account became inactive.',
    nextAction: 'Create or activate a receiving account in the required currency. The app does not create one automatically.',
  },
  {
    id: 'trouble-invalid-amount',
    category: 'Payments & Due Collection',
    title: 'A payment amount is rejected',
    introduction: 'Payment amounts must parse as a valid positive amount and must satisfy the selected workflow’s limits.',
    steps: [
      'Enter a number greater than zero; payment entry accepts no more than two decimal places.',
      'Check the selected currency and remove currency symbols or other text from the amount field.',
      'When applying advance credit, keep the amount within the displayed maximum.',
      'Review the selected bill balance and any inline validation before recording.',
    ],
    keywords: ['troubleshoot', 'invalid amount', 'amount', 'payment rejected', 'decimal', 'limit'],
    destination: 'payments',
    destinationLabel: 'Open Payments',
    related: ['payment-partial', 'advance-credit'],
    problem: 'The amount may be blank, zero, malformed, too precise, or above the available advance/balance limit for the selected action.',
    nextAction: 'Correct the amount using the displayed currency and limits. If the error remains, verify the selected customer, bill, and available advance.',
  },
  {
    id: 'trouble-missing-information',
    category: 'Getting Started',
    title: 'A form says required information is missing',
    introduction: 'Required fields are marked in the form, and validation messages explain what needs attention.',
    steps: [
      'Read the inline message next to the field marked as invalid.',
      'For a customer, check that the full name and phone number are present and valid.',
      'For a payment, check customer, positive amount, date, payment method, and receiving account.',
      'Some payment methods require a transaction ID when that rule is enabled in payment settings.',
      'For a sale or service plan, check the selected active customer/service/plan and any required dates or assignments.',
    ],
    keywords: ['troubleshoot', 'required', 'missing', 'validation', 'form error', 'transaction id'],
    related: ['customer-create', 'service-create', 'sales-create', 'payment-partial'],
    problem: 'One or more required fields or configured business rules have not been satisfied.',
    nextAction: 'Use the field-level message to locate the missing value, correct it, and submit again.',
  },
  {
    id: 'trouble-restore',
    category: 'Backup & Restore',
    title: 'A backup cannot be restored',
    introduction: 'Restore validates the selected file and reports issues before making changes.',
    steps: [
      'Confirm you selected an XolveManager JSON backup file and that the download is complete.',
      'Review each validation or integrity message in the preview; do not confirm a file that fails validation.',
      'If the backup is damaged or incomplete, choose another known-good backup copy.',
      'Before applying a valid restore, review record counts and whether merge or replace mode matches your intention.',
      'Contact the configured support channel only if it is available; redact customer and financial data from any shared evidence.',
    ],
    keywords: ['troubleshoot', 'backup error', 'restore failed', 'invalid file', 'integrity', 'json'],
    destination: 'settings',
    destinationLabel: 'Open Settings',
    related: ['backup-restore', 'settings-privacy'],
    problem: 'The file may be invalid, incomplete, incompatible, or fail its integrity checks.',
    nextAction: 'Do not bypass validation or clear browser storage. Use a valid backup and review the preview before confirming.',
  },
];

export const getHelpArticle = (id: string | null | undefined): HelpArticle | undefined =>
  id ? helpArticles.find(article => article.id === id) : undefined;

export const getLocalizedHelpArticle = (
  article: HelpArticle,
  language: Language
): HelpArticle => {
  if (language !== 'bn') return article;
  const translation = helpArticlesBn[article.id];
  return translation ? { ...article, ...translation } : article;
};

const searchableText = (article: HelpArticle): string => [
  article.category,
  article.title,
  article.introduction,
  ...article.steps,
  ...article.keywords,
  article.problem || '',
  article.nextAction || '',
].join(' ').toLocaleLowerCase();

export const searchHelpArticles = (
  query: string,
  category: HelpCategory | 'All' = 'All',
  language: Language = 'en'
): HelpArticle[] => {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return helpArticles
    .filter(article => category === 'All' || article.category === category)
    .map(article => {
      const localizedArticle = getLocalizedHelpArticle(article, language);
      const title = localizedArticle.title.toLocaleLowerCase();
      const body = `${searchableText(localizedArticle)} ${searchableText(article)}`;
      const score = terms.reduce((total, term) =>
        total + (title.includes(term) ? 4 : body.includes(term) ? 1 : 0), 0);
      return { article, score };
    })
    .filter(result => terms.length === 0 || result.score === terms.length || result.score > 0)
    .sort((left, right) => right.score - left.score || left.article.title.localeCompare(right.article.title))
    .map(result => result.article);
};

const contextualArticleIds: Partial<Record<NavSection, string>> = {
  dashboard: 'getting-started',
  customers: 'customer-create',
  services: 'service-create',
  accounts: 'receiving-account',
  profiles: 'service-accounts',
  sales: 'sales-create',
  invoices: 'invoice-create',
  payments: 'payment-partial',
  cashbook: 'receiving-account',
  'financial-control': 'reports-review',
  'data-integrity': 'backup-restore',
  expenses: 'receiving-account',
  'daily-closing': 'receiving-account',
  reports: 'reports-review',
  profitability: 'reports-review',
  subscriptions: 'renewals-manage',
  reminders: 'renewals-manage',
  settings: 'settings-privacy',
};

export const getContextualHelpArticle = (section: NavSection): string =>
  contextualArticleIds[section] || 'getting-started';
