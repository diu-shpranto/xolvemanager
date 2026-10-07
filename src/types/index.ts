export type Language = 'en' | 'bn';
export type AppCurrency = 'BDT' | 'USD';

export type ServiceCategory = 
  | 'Streaming'
  | 'AI Tools'
  | 'Music'
  | 'Productivity'
  | 'Design'
  | 'VPN'
  | 'Software'
  | 'License'
  | 'Other'
  | (string & {});

export interface Customer {
  id: string;
  businessId?: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email: string;
  facebookUrl?: string;
  facebookId?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  isArchived?: boolean;
  status?: 'active' | 'inactive' | 'archived';
  tags?: string[];
  notesHistory?: CustomerNote[];
  preferences?: CustomerPreferences;
  duplicateOfCustomerId?: string;
}

export type WhatsAppTemplateId =
  | 'welcome_customer'
  | 'renewal_reminder'
  | 'renewal_due_today'
  | 'renewal_tomorrow'
  | 'renewal_in_3_days'
  | 'renewal_in_7_days'
  | 'renewal_completed'
  | 'payment_reminder'
  | 'payment_received'
  | 'invoice_ready'
  | 'subscription_activated'
  | 'subscription_expired'
  | 'subscription_details'
  | 'due_payment_reminder'
  | 'custom_message';

export interface WhatsAppTemplate {
  templateId: WhatsAppTemplateId;
  name: string;
  type: WhatsAppTemplateId;
  message: string;
  enabled: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPreferences {
  contactMethod?: 'phone' | 'whatsapp' | 'email' | 'other';
  contactAllowed?: boolean;
  language?: 'en' | 'bn';
}

export type DurationUnit = 'Days' | 'Weeks' | 'Months' | 'Years';

export interface ServicePlan {
  id: string;
  name: string;
  internalCode?: string;
  price: number;
  currency: AppCurrency;
  durationDays: number;
  duration?: number;
  durationUnit?: DurationUnit;
  status: 'active' | 'inactive';
  description?: string;
  profileCapacity?: number;
  accountCapacity?: number;
  renewalEnabled?: boolean;
  renewalReminderEnabled?: boolean;
  reminderDays?: number;
  sortOrder?: number;
  directCostType?: 'none' | 'fixed_per_sale' | 'fixed_per_cycle' | 'percentage_of_sale';
  directCostAmount?: number;
}

export interface ServiceSettings {
  subscriptionEnabled: boolean;
  renewalEnabled: boolean;
  autoCalculateExpiry: boolean;
  renewalReminderEnabled: boolean;
  reminderDays: number;
  usesAccounts: boolean;
  usesProfiles: boolean;
  profileCapacity: number;
  allowAccountSharing: boolean;
  profileAssignmentRequired: boolean;
  customerRequired: boolean;
  emailRequired: boolean;
  phoneRequired: boolean;
  allowMultipleActiveSubscriptions: boolean;
  allowRenewal: boolean;
  allowEarlyRenewal: boolean;
}

export interface ServiceInvoiceSettings {
  showLogo: boolean;
  showDescription: boolean;
  showPlan: boolean;
  showSubscriptionPeriod: boolean;
  showPaymentMethod: boolean;
  showCustomerPhone: boolean;
  showCustomerEmail: boolean;
}

export interface ServiceRenewalMessage {
  enabled: boolean;
  template: string;
}

export interface ServiceAdvancedSettings {
  internalCode: string;
  sortOrder: number;
  showInNewSale: boolean;
  showOnDashboard: boolean;
  allowNewSubscriptions: boolean;
  allowManualRenewal: boolean;
  notes: string;
}

export interface Service {
  id: string;
  businessId?: string;
  name: string;
  category: ServiceCategory;
  description?: string;
  logoUrl?: string;
  iconName?: string;
  color?: string;
  defaultDuration?: number;
  durationUnit?: DurationUnit;
  defaultDurationDays: number;
  defaultPriceBDT?: number;
  defaultPriceUSD?: number;
  defaultPrice?: number;
  currency?: AppCurrency;
  status: 'active' | 'inactive' | 'archived';
  isArchived?: boolean;
  plans: string[];
  planIds?: string[];
  planDetails?: ServicePlan[];
  defaultDirectCostType?: 'none' | 'fixed_per_sale' | 'fixed_per_cycle' | 'percentage_of_sale';
  defaultDirectCostAmount?: number;
  settings?: Partial<ServiceSettings>;
  invoiceSettings?: Partial<ServiceInvoiceSettings>;
  renewalMessage?: Partial<ServiceRenewalMessage>;
  advanced?: Partial<ServiceAdvancedSettings>;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProfileStatus = 'Available' | 'Assigned' | 'Expired' | 'Suspended' | 'Inactive' | 'Disabled';

export interface AccountProfile {
  id: string;
  businessId?: string;
  accountId: string;
  profileName: string;
  pin?: string;
  pinMasked?: string;
  assignedCustomerId?: string;
  subscriptionId?: string;
  status: ProfileStatus;
  startDate?: string;
  expiryDate?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AccountStatus = 'Available' | 'Assigned' | 'Full' | 'Expired' | 'Suspended' | 'Inactive';

export interface Account {
  id: string;
  businessId?: string;
  serviceId: string;
  planId?: string;
  email: string;
  username?: string;
  password: string; // visually masked in UI
  passwordMasked?: string; // prototype security masked representation
  isEncrypted?: boolean; // credential encryption indicator
  encryptionScheme?: 'masked_demo' | 'kms_aes_gcm';
  plan: string;
  status: AccountStatus;
  name?: string;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
  maxProfiles: number;
  profiles: AccountProfile[];
  allowProfileSharing?: boolean;
  requireCustomerAssignment?: boolean;
  allowNewAssignment?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'failed' | 'refunded';

export interface SubscriptionRenewalRecord {
  id: string;
  renewalDate: string;
  previousEndDate: string;
  newStartDate: string;
  newEndDate: string;
  plan: string;
  planId?: string;
  amount: number;
  amountPaid: number;
  amountDue: number;
  currency?: AppCurrency;
  paymentStatus: PaymentStatus;
  saleId: string;
  paymentId: string;
  subscriptionId: string;
}

export interface Subscription {
  id: string;
  businessId?: string;
  saleId?: string;
  paymentId?: string;
  renewedFromSubscriptionId?: string;
  renewalHistory?: SubscriptionRenewalRecord[];
  customerId: string;
  serviceId: string;
  accountId?: string;
  profileId?: string;
  planId?: string;
  plan: string;
  startDate: string; // YYYY-MM-DD
  durationDays: number;
  expiryDate: string; // YYYY-MM-DD (calculated: startDate + durationDays)
  price: number;
  currency: AppCurrency;
  paymentStatus: PaymentStatus;
  status?: SubscriptionStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

export type PaymentMethod =
  | 'bKash'
  | 'Nagad'
  | 'Rocket'
  | 'Bank'
  | 'Cash'
  | 'Card'
  | 'Other'
  | (string & {});

export type PaymentMethodCategory = 'mobile_banking' | 'bank' | 'cash' | 'card' | 'other';

export interface PaymentMethodConfig {
  id: string;
  name: string;
  category: PaymentMethodCategory;
  enabled: boolean;
  sortOrder: number;
  isDefault?: boolean;
  requireTransactionId?: boolean;
  accountDetails?: string;
  financialAccountId?: string;
}

export type FinancialAccountType = 'mobile_banking' | 'cash' | 'bank' | 'card' | 'other';
export type FinancialRecordStatus = 'posted' | 'voided';

export interface FinancialAccount {
  id: string;
  businessId?: string;
  name: string;
  type: FinancialAccountType;
  identifier?: string;
  currency: AppCurrency;
  openingBalance: number;
  openingBalanceDate: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
}

export interface Expense {
  id: string;
  businessId?: string;
  accountId: string;
  categoryId: string;
  amount: number;
  currency: AppCurrency;
  date: string;
  description: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  status: FinancialRecordStatus;
  profitabilityCostType?: ProfitabilityCostType;
  profitabilityServiceId?: string;
  profitabilityPlanId?: string;
  profitabilityCustomerId?: string;
  profitabilitySubscriptionId?: string;
  profitabilityAllocationMethod?: ProfitabilityAllocationMethod;
  profitabilityManualAllocations?: ProfitabilityManualAllocation[];
  createdAt: string;
  updatedAt: string;
}

export type ProfitabilityCostType = 'direct' | 'shared' | 'operating' | 'adjustment';
export type ProfitabilityAllocationMethod = 'none' | 'equal' | 'revenue' | 'sales' | 'subscriptions' | 'manual';

export interface ProfitabilityManualAllocation {
  serviceId: string;
  percentage: number;
}

export interface ProfitabilityCost {
  id: string;
  businessId?: string;
  costType: ProfitabilityCostType;
  status: 'active' | 'voided';
  category: string;
  amount: number;
  currency: AppCurrency;
  date: string;
  serviceId?: string;
  planId?: string;
  subscriptionId?: string;
  saleId?: string;
  customerId?: string;
  expenseId?: string;
  allocationMethod: ProfitabilityAllocationMethod;
  manualAllocations?: ProfitabilityManualAllocation[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface OtherIncome {
  id: string;
  businessId?: string;
  accountId: string;
  categoryId: string;
  amount: number;
  currency: AppCurrency;
  date: string;
  description: string;
  reference?: string;
  notes?: string;
  status: FinancialRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTransfer {
  id: string;
  businessId?: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: AppCurrency;
  date: string;
  reference?: string;
  note?: string;
  status: FinancialRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAdjustment {
  id: string;
  businessId?: string;
  accountId: string;
  amount: number;
  currency: AppCurrency;
  reason: string;
  date: string;
  reference?: string;
  note?: string;
  status?: FinancialRecordStatus;
  createdAt: string;
}

export type ReconciliationStatus = 'matched' | 'difference';

export interface FinancialReconciliation {
  id: string;
  businessId: string;
  accountId: string;
  reconciliationDate: string;
  systemBalance: number;
  actualBalance: number;
  difference: number;
  status: ReconciliationStatus;
  note?: string;
  createdAt: string;
}

export type FinancialPeriodStatus = 'open' | 'closed';

export interface FinancialPeriod {
  id: string;
  businessId: string;
  startDate: string;
  endDate: string;
  status: FinancialPeriodStatus;
  closedAt?: string;
  reopenedAt?: string;
  closeNote?: string;
  reopenReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyClosingAccount {
  accountId: string;
  accountName: string;
  currency: AppCurrency;
  openingBalance: number;
  moneyIn: number;
  moneyOut: number;
  transferIn: number;
  transferOut: number;
  adjustmentNet: number;
  expectedClosingBalance: number;
  actualClosingBalance: number;
  difference: number;
}

export interface DailyClosing {
  id: string;
  businessId: string;
  date: string;
  currency: AppCurrency;
  status: 'closed' | 'reopened';
  openingBalance: number;
  totalMoneyIn: number;
  totalMoneyOut: number;
  transfersIn: number;
  transfersOut: number;
  adjustmentsNet: number;
  expectedClosingBalance: number;
  actualClosingBalance: number;
  difference: number;
  accounts: DailyClosingAccount[];
  paymentMethods: Array<{ name: string; amount: number }>;
  expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  closingReason?: string;
  closedAt: string;
  closedBy: string;
  reopenedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderType =
  | 'renewal_upcoming'
  | 'renewal_today'
  | 'subscription_expired'
  | 'payment_due'
  | 'payment_overdue'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'partial_payment'
  | 'unpaid_sale'
  | 'customer_follow_up'
  | 'daily_closing';

export type ReminderStatus = 'open' | 'completed' | 'snoozed' | 'dismissed';
export type ReminderPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReminderSourceEntityType = 'customer' | 'subscription' | 'sale' | 'payment' | 'invoice' | 'daily_closing' | 'other';

export interface Reminder {
  id: string;
  reminderId?: string;
  businessId?: string;
  deterministicKey: string;
  type: ReminderType;
  status: ReminderStatus;
  priority: ReminderPriority;
  title: string;
  description?: string;
  customerId?: string;
  serviceId?: string;
  planId?: string;
  subscriptionId?: string;
  saleId?: string;
  paymentId?: string;
  invoiceId?: string;
  sourceEntityType: ReminderSourceEntityType;
  sourceEntityId: string;
  dueDate: string;
  targetDate?: string;
  stage?: string;
  amount?: number;
  currency?: AppCurrency;
  snoozedUntil?: string;
  completedAt?: string;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
  systemGenerated?: boolean;
}

export interface ReminderPreferences {
  enabled?: boolean;
  subscriptionDays?: number[];
  paymentOverdueDays?: number[];
  invoiceOverdueDays?: number[];
  dailyClosingEnabled?: boolean;
}

export interface Sale {
  id: string;
  businessId?: string;
  subscriptionId?: string;
  renewalOfSubscriptionId?: string;
  operationId?: string;
  paymentId?: string;
  planId?: string;
  accountId?: string;
  profileId?: string;
  customerId: string;
  serviceId: string;
  plan: string;
  amount: number;
  subtotal?: number;
  discount?: number;
  amountPaid?: number;
  currency: AppCurrency;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  date: string; // YYYY-MM-DD
  invoiceNo: string;
  transactionId?: string; // TrxID
  senderNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  businessId?: string;
  saleId: string;
  subscriptionId?: string;
  customerId: string;
  serviceId: string;
  planId?: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  invoiceDate: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  creationLogPending?: boolean;
}

export interface Payment {
  id: string;
  businessId?: string;
  operationId?: string;
  customerId: string;
  invoiceId?: string;
  saleId?: string;
  subscriptionId?: string;
  amount: number;
  currency: AppCurrency;
  paymentMethod: PaymentMethod;
  paymentMethodId?: string;
  paymentMethodName?: string;
  paymentMethodCategory?: PaymentMethodCategory;
  paymentAccount?: string;
  financialAccountId?: string;
  transactionId?: string; // TrxID for bKash/Nagad/Rocket
  senderNumber?: string;
  paymentDate: string; // YYYY-MM-DD
  paymentStatus: PaymentStatus;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ActivityType = 
  | 'financial_account_added'
  | 'financial_account_updated'
  | 'account_reconciled'
  | 'period_closed'
  | 'period_reopened'
  | 'day_closed'
  | 'day_reopened'
  | 'opening_balance_changed'
  | 'income_added'
  | 'expense_added'
  | 'expense_updated'
  | 'transfer_created'
  | 'adjustment_created'
  | 'refund_created'
  | 'sale_created'
  | 'subscription_created'
  | 'subscription_renewed'
  | 'subscription_expired'
  | 'payment_received'
  | 'payment_recorded'
  | 'invoice_created'
  | 'invoice_generated'
  | 'profile_assigned'
  | 'profile_unassigned'
  | 'account_added'
  | 'customer_added'
  | 'service_added'
  | 'service_updated'
  | 'service_removed'
  | 'customer_updated'
  | 'business_settings_updated'
  | 'backup_created'
  | 'backup_restored'
  | 'data_imported'
  | 'data_exported'
  | 'data_cleared'
  | 'account_updated'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'payment_updated'
  | 'payment_failed'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_removed'
  | 'invoice_updated'
  | 'invoice_paid'
  | 'invoice_due'
  | 'sale_completed'
  | 'sale_deleted'
  | 'payment_deleted'
  | 'subscription_deleted'
  | 'customer_note_added'
  | 'customer_note_updated'
  | 'customer_note_deleted'
  | 'whatsapp_opened'
  | 'whatsapp_template_updated'
  | 'reminder_created'
  | 'reminder_completed'
  | 'reminder_snoozed'
  | 'reminder_dismissed'
  | 'reminder_reopened'
  | 'reminder_settings_updated'
  | 'profitability_cost_added'
  | 'profitability_cost_updated'
  | 'profitability_cost_deleted';

export interface ActivityLog {
  id: string;
  businessId?: string;
  type: ActivityType;
  category?: ActivityCategory;
  action?: ActivityAction;
  entityType?: ActivityEntityType;
  title: string;
  description: string;
  timestamp: string;
  entityId?: string;
  customerId?: string;
  serviceId?: string;
  planId?: string;
  accountId?: string;
  financialAccountId?: string;
  profileId?: string;
  subscriptionId?: string;
  saleId?: string;
  paymentId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  serviceName?: string;
  amount?: number;
  currency?: AppCurrency;
  metadata?: Record<string, string | number | boolean | null>;
  createdBy?: string;
  createdAt?: string;
}

export type ActivityCategory =
  | 'customers'
  | 'services'
  | 'plans'
  | 'accounts'
  | 'profiles'
  | 'subscriptions'
  | 'sales'
  | 'payments'
  | 'invoices'
  | 'financials'
  | 'reminders'
  | 'business'
  | 'data'
  | 'system';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'completed'
  | 'renewed'
  | 'paid'
  | 'failed'
  | 'assigned'
  | 'unassigned'
  | 'expired'
  | 'deactivated'
  | 'deleted'
  | 'cleared'
  | 'other';

export type ActivityEntityType =
  | 'customer'
  | 'service'
  | 'plan'
  | 'account'
  | 'profile'
  | 'subscription'
  | 'sale'
  | 'payment'
  | 'invoice'
  | 'financial_account'
  | 'expense'
  | 'income'
  | 'transfer'
  | 'adjustment'
  | 'daily_closing'
  | 'reminder'
  | 'business'
  | 'data'
  | 'system';

export interface AppSettings {
  businessId?: string;
  storeName: string;
  invoiceLogoUrl?: string;
  invoiceLogoDataUrl?: string;
  tagline: string;
  currency: AppCurrency;
  language: Language;
  adminEmail: string;
  adminName: string;
  reminderNoticeDays: number; // e.g. 3, 7, 15
  contactPhone: string;
  whatsappNumber: string;
  facebookPageUrl: string;
  whatsappReminderTemplateEN: string;
  whatsappReminderTemplateBN: string;
  whatsappPreferences?: {
    countryCode?: string;
    displayName?: string;
    defaultLanguage?: Language;
    enabled?: boolean;
    showButtons?: boolean;
    defaultFooter?: string;
    templates?: WhatsAppTemplate[];
  };
  businessProfile?: {
    description?: string;
    address?: string;
    website?: string;
    timeZone?: string;
  };
  invoicePreferences?: {
    prefix?: string;
    footer?: string;
    showBusinessAddress?: boolean;
    showCustomerPhone?: boolean;
    showPaymentMethod?: boolean;
    showTransactionId?: boolean;
  };
  paymentPreferences?: {
    methods?: Array<string | PaymentMethodConfig>;
    defaultMethodId?: string;
    requireTransactionId?: boolean;
  };
  financialPreferences?: {
    expenseCategories?: FinancialCategory[];
    incomeCategories?: FinancialCategory[];
    allowNegativeBalances?: boolean;
  };
  subscriptionDefaults?: {
    durationDays?: number;
    allowEarlyRenewal?: boolean;
  };
  serviceDefaults?: {
    durationDays?: number;
  };
  appearance?: {
    theme?: 'light' | 'dark';
  };
  notificationPreferences?: {
    categories?: Partial<Record<NotificationCategory, boolean>>;
    showSuccess?: boolean;
    showWarning?: boolean;
    showCritical?: boolean;
  };
  automaticBackupReminder?: 'off' | 'daily' | 'weekly' | 'monthly';
  reminderPreferences?: ReminderPreferences;
  profitabilityPreferences?: {
    lowMarginWarningPercent?: number;
  };
}

export type NotificationCategory =
  | 'customer'
  | 'subscription'
  | 'payment'
  | 'invoice'
  | 'account'
  | 'service'
  | 'system';

export type NotificationPriority = 'info' | 'success' | 'warning' | 'critical';

export type NotificationSection =
  | 'dashboard' | 'customers' | 'services' | 'accounts' | 'profiles'
  | 'subscriptions' | 'sales' | 'payments' | 'invoices' | 'history'
  | 'reports' | 'settings' | 'notifications' | 'cashbook';

export interface BusinessNotification {
  id: string;
  businessId?: string;
  dedupeKey?: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityType?: NotificationCategory | 'sale' | 'profile';
  entityId?: string;
  customerId?: string;
  serviceId?: string;
  subscriptionId?: string;
  saleId?: string;
  paymentId?: string;
  invoiceId?: string;
  accountId?: string;
  profileId?: string;
  section: NotificationSection;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}
