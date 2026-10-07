import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Tv,
  Sparkles,
  Palette,
  Music,
  Briefcase,
  Shield,
  Key,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Archive,
  RotateCcw,
  Loader2,
  DollarSign,
  Calendar,
  Clock,
  CreditCard,
  Receipt,
  Users,
  ExternalLink,
  ArrowUpDown,
  LayoutGrid,
  List,
  FileText,
  ChevronRight,
  Hash,
  Crown,
  Laptop,
  KeyRound,
  MoreHorizontal,
  UserRound,
  ArrowLeft,
  Copy,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import {
  Account,
  Service,
  ServiceCategory,
  DurationUnit,
  AppCurrency,
  ServicePlan,
  ServiceSettings,
  ServiceInvoiceSettings,
  ServiceRenewalMessage,
  ServiceAdvancedSettings,
  Subscription,
} from '../../types';
import { formatAppDate, formatAppDateTime, formatCurrency, getDaysDifference, getSubscriptionStatus, getSubscriptionReminderDays } from '../../utils/dateUtils';
import { createRecordId } from '../../services/localStorageStore';
import { getAccountCapacity, getServiceResourceSummary, isAccountOperational } from '../../utils/resourceManagement';
import { calculatePlanPerformance, calculateSalesFinancialSummary, calculateServicePerformance, getLocalDateString } from '../../utils/reportMetrics';
import { exportServicesCSV } from '../../services/dataBackupService';
import { downloadCSV } from '../../utils/csvParser';

interface ServicesViewProps {
  onOpenNewSaleForService: (serviceId: string) => void;
  onNavigateSection?: (section: string, targetId?: string) => void;
  onNavigateToServiceAccounts?: (serviceId: string) => void;
  onNavigateToServiceSubscriptions?: (serviceId: string) => void;
  onNavigateToServiceCustomers?: (serviceId: string) => void;
  onNavigateToServiceProfiles?: (serviceId: string) => void;
  onAddAccountForService?: (serviceId: string) => void;
  onAddCustomerForService?: (serviceId: string) => void;
  onSelectCustomer?: (customerId: string) => void;
  onViewSubscription?: (subscriptionId: string) => void;
  selectedServiceId?: string | null;
  onClearSelectedService?: () => void;
  createRequest?: number;
  onCreateRequestHandled?: () => void;
}

const CATEGORIES_LIST: ServiceCategory[] = [
  'Streaming',
  'AI Tools',
  'Music',
  'Productivity',
  'Design',
  'Software',
  'VPN',
  'License',
  'Other',
];

const PRESET_ICONS = [
  { name: 'Tv', icon: Tv, label: 'Streaming / TV' },
  { name: 'Sparkles', icon: Sparkles, label: 'AI / Magic' },
  { name: 'Music', icon: Music, label: 'Music / Audio' },
  { name: 'Palette', icon: Palette, label: 'Design / Creative' },
  { name: 'Briefcase', icon: Briefcase, label: 'Productivity / Work' },
  { name: 'Shield', icon: Shield, label: 'VPN / Security' },
  { name: 'Laptop', icon: Laptop, label: 'Software / Tools' },
  { name: 'Key', icon: Key, label: 'License / Keys' },
  { name: 'Layers', icon: Layers, label: 'General / Bundle' },
];

const COLOR_PRESETS = [
  '#10b981', // Emerald
  '#059669', // Dark Emerald
  '#E50914', // Netflix Red
  '#00A8E1', // Prime Blue
  '#1DB954', // Spotify Green
  '#10a37f', // OpenAI Teal
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#0ea5e9', // Sky Blue
  '#6366f1', // Indigo
];

const SERVICE_SETTING_DEFAULTS: ServiceSettings = {
  subscriptionEnabled: true,
  renewalEnabled: true,
  autoCalculateExpiry: true,
  renewalReminderEnabled: true,
  reminderDays: 7,
  usesAccounts: false,
  usesProfiles: false,
  profileCapacity: 1,
  allowAccountSharing: false,
  profileAssignmentRequired: false,
  customerRequired: true,
  emailRequired: false,
  phoneRequired: false,
  allowMultipleActiveSubscriptions: false,
  allowRenewal: true,
  allowEarlyRenewal: false,
};

const INVOICE_SETTING_DEFAULTS: ServiceInvoiceSettings = {
  showLogo: true,
  showDescription: true,
  showPlan: true,
  showSubscriptionPeriod: true,
  showPaymentMethod: true,
  showCustomerPhone: true,
  showCustomerEmail: true,
};

const ADVANCED_SETTING_DEFAULTS: ServiceAdvancedSettings = {
  internalCode: '',
  sortOrder: 0,
  showInNewSale: true,
  showOnDashboard: true,
  allowNewSubscriptions: true,
  allowManualRenewal: true,
  notes: '',
};

const RENEWAL_MESSAGE_DEFAULTS: ServiceRenewalMessage = {
  enabled: false,
  template: 'Hello {customerName}, your {serviceName} subscription has been renewed. Expiry date: {expiryDate}.',
};

const SERVICE_FORM_TABS = [
  'Basic Information',
  'Branding',
  'Plans & Pricing',
  'Subscription Settings',
  'Account & Profile Settings',
  'Customer Settings',
  'Renewal Message',
  'Invoice Settings',
  'Advanced Settings',
] as const;

type ServiceFormTab = typeof SERVICE_FORM_TABS[number];

interface ServicePlanDraft {
  id?: string;
  name: string;
  internalCode?: string;
  price: number | '';
  currency: AppCurrency;
  duration: number | '';
  durationUnit: DurationUnit;
  status: 'active' | 'inactive';
  directCostType?: ServicePlan['directCostType'];
  directCostAmount?: number;
}

function getCategoryIcon(category: ServiceCategory) {
  switch (category) {
    case 'Streaming':
      return Tv;
    case 'AI Tools':
      return Sparkles;
    case 'Design':
      return Palette;
    case 'Music':
      return Music;
    case 'Productivity':
      return Briefcase;
    case 'VPN':
      return Shield;
    case 'Software':
      return Laptop;
    case 'License':
      return Key;
    default:
      return Layers;
  }
}

function getServiceIcon(service: Service) {
  return PRESET_ICONS.find(preset => preset.name === service.iconName)?.icon || getCategoryIcon(service.category);
}

function getCategoryBadgeStyle(category: ServiceCategory) {
  switch (category) {
    case 'Streaming':
      return {
        text: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        border: 'border-rose-200/60 dark:border-rose-800/40',
        dot: 'bg-rose-500',
      };
    case 'AI Tools':
      return {
        text: 'text-teal-700 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/40',
        border: 'border-teal-200/60 dark:border-teal-800/40',
        dot: 'bg-teal-500',
      };
    case 'Design':
      return {
        text: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        border: 'border-purple-200/60 dark:border-purple-800/40',
        dot: 'bg-purple-500',
      };
    case 'Productivity':
      return {
        text: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200/60 dark:border-blue-800/40',
        dot: 'bg-blue-500',
      };
    case 'VPN':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200/60 dark:border-amber-800/40',
        dot: 'bg-amber-500',
      };
    case 'Music':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200/60 dark:border-emerald-800/40',
        dot: 'bg-emerald-500',
      };
    case 'Software':
      return {
        text: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-950/40',
        border: 'border-sky-200/60 dark:border-sky-800/40',
        dot: 'bg-sky-500',
      };
    case 'License':
      return {
        text: 'text-indigo-700 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        border: 'border-indigo-200/60 dark:border-indigo-800/40',
        dot: 'bg-indigo-500',
      };
    default:
      return {
        text: 'text-slate-700 dark:text-slate-300',
        bg: 'bg-slate-100 dark:bg-slate-800/60',
        border: 'border-slate-200/80 dark:border-slate-700/60',
        dot: 'bg-slate-400',
      };
  }
}

function getServiceWebsiteUrl(srv: Service): string {
  if (srv.notes) {
    const urlMatch = srv.notes.match(/https?:\/\/[^\s]+/);
    if (urlMatch) return urlMatch[0];
  }
  const cleanName = srv.name.toLowerCase().trim();
  if (cleanName.includes('netflix')) return 'https://www.netflix.com';
  if (cleanName.includes('spotify')) return 'https://www.spotify.com';
  if (cleanName.includes('chatgpt') || cleanName.includes('openai')) return 'https://chatgpt.com';
  if (cleanName.includes('canva')) return 'https://www.canva.com';
  if (cleanName.includes('youtube')) return 'https://www.youtube.com/premium';
  if (cleanName.includes('prime') || cleanName.includes('amazon')) return 'https://www.primevideo.com';
  if (cleanName.includes('disney')) return 'https://www.disneyplus.com';
  if (cleanName.includes('apple')) return 'https://www.apple.com';
  if (cleanName.includes('nordvpn')) return 'https://nordvpn.com';
  if (cleanName.includes('surfshark')) return 'https://surfshark.com';
  if (cleanName.includes('office') || cleanName.includes('microsoft')) return 'https://www.office.com';
  if (cleanName.includes('midjourney')) return 'https://www.midjourney.com';
  if (cleanName.includes('claude') || cleanName.includes('anthropic')) return 'https://claude.ai';
  if (cleanName.includes('adobe')) return 'https://www.adobe.com';
  return `https://www.google.com/search?q=${encodeURIComponent(srv.name + ' official website')}`;
}

function getServiceCapacity(serviceAccounts: Account[]) {
  return serviceAccounts.reduce(
    (capacity, account) => {
      const accountCapacity = getAccountCapacity(account);
      return {
        total: capacity.total + accountCapacity.capacity,
        assigned: capacity.assigned + accountCapacity.used,
        available: capacity.available + accountCapacity.available,
      };
    },
    { total: 0, assigned: 0, available: 0 }
  );
}

function getServiceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || '?';
}

function getServicePrice(service: Service, selectedCurrency: AppCurrency): number | null {
  const currencyPrice =
    selectedCurrency === 'BDT' ? service.defaultPriceBDT : service.defaultPriceUSD;
  const activePlanPrices = service.planDetails
    ?.filter(plan => plan.status === 'active' && plan.currency === selectedCurrency && Number.isFinite(plan.price))
    .map(plan => plan.price) || [];
  if (activePlanPrices.length) return Math.min(...activePlanPrices);
  if (currencyPrice !== undefined && currencyPrice !== null && Number.isFinite(Number(currencyPrice))) {
    return Number(currencyPrice);
  }
  if (service.defaultPrice !== undefined && (service.currency || 'BDT') === selectedCurrency) {
    return Number.isFinite(Number(service.defaultPrice)) ? Number(service.defaultPrice) : null;
  }
  return null;
}

function isCurrentSubscription(subscription: Subscription, service?: Service, defaultReminderDays = 7): boolean {
  const status = getSubscriptionStatus(subscription, service, defaultReminderDays);
  return status === 'active' || status === 'expiring_soon';
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  onOpenNewSaleForService,
  onNavigateSection,
  onNavigateToServiceAccounts,
  onNavigateToServiceSubscriptions,
  onNavigateToServiceCustomers,
  onNavigateToServiceProfiles,
  onAddAccountForService,
  onAddCustomerForService,
  onSelectCustomer,
  onViewSubscription,
  selectedServiceId,
  onClearSelectedService,
  createRequest,
  onCreateRequestHandled,
}) => {
  const {
    services,
    servicesLoading,
    servicesError,
    accounts,
    subscriptions,
    sales,
    invoices,
    payments,
    activityLogs,
    customers,
    addService,
    updateService,
    deleteService,
    archiveService,
    restoreService,
    currency,
    settings,
    t,
    language,
  } = useApp();
  const { showToast } = useToast();

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'has_active' | 'none_active'>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'has_active' | 'none_active'>('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'accounts' | 'profiles' | 'none'>('all');
  const [sortBy, setSortBy] = useState<
    'name_asc' | 'name_desc' | 'popular' | 'accounts' | 'price_low' | 'price_high' | 'newest' | 'recently_updated' | 'revenue' | 'plans'
  >('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [openServiceActionsId, setOpenServiceActionsId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim().toLocaleLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [detailedServiceId, setDetailedServiceId] = useState<string | null>(selectedServiceId || null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [planEditing, setPlanEditing] = useState<ServicePlan | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planInternalCode, setPlanInternalCode] = useState('');
  const [planPrice, setPlanPrice] = useState<number | ''>('');
  const [planDuration, setPlanDuration] = useState<number | ''>(30);
  const [planDurationUnit, setPlanDurationUnit] = useState<DurationUnit>('Days');
  const [planCurrency, setPlanCurrency] = useState<AppCurrency>('BDT');
  const [planStatus, setPlanStatus] = useState<'active' | 'inactive'>('active');
  const [planDescription, setPlanDescription] = useState('');
  const [planDirectCostType, setPlanDirectCostType] = useState<NonNullable<ServicePlan['directCostType']>>('none');
  const [planDirectCostAmount, setPlanDirectCostAmount] = useState<number | ''>('');
  const [planProfileCapacity, setPlanProfileCapacity] = useState<number | ''>('');
  const [planAccountCapacity, setPlanAccountCapacity] = useState<number | ''>('');
  const [planRenewalEnabled, setPlanRenewalEnabled] = useState(true);
  const [planReminderEnabled, setPlanReminderEnabled] = useState(true);
  const [planReminderDays, setPlanReminderDays] = useState(7);
  const [planSortOrder, setPlanSortOrder] = useState(0);
  const [planFormError, setPlanFormError] = useState('');
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [planStatusFilter, setPlanStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [planSortBy, setPlanSortBy] = useState<'name' | 'price' | 'duration' | 'popularity' | 'revenue'>('name');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<'all' | 'active' | 'ending' | 'expired'>('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form Fields State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ServiceCategory>('Streaming');
  const [formDescription, setFormDescription] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);
  const [formIconName, setFormIconName] = useState('Tv');
  const [formColor, setFormColor] = useState('#10b981');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formSettings, setFormSettings] = useState<ServiceSettings>(SERVICE_SETTING_DEFAULTS);
  const [formInvoiceSettings, setFormInvoiceSettings] = useState<ServiceInvoiceSettings>(INVOICE_SETTING_DEFAULTS);
  const [formRenewalMessage, setFormRenewalMessage] = useState<ServiceRenewalMessage>(RENEWAL_MESSAGE_DEFAULTS);
  const [formAdvanced, setFormAdvanced] = useState<ServiceAdvancedSettings>(ADVANCED_SETTING_DEFAULTS);
  const [formPlans, setFormPlans] = useState<ServicePlan[]>([]);
  const [formDefaultDirectCostType, setFormDefaultDirectCostType] = useState<NonNullable<Service['defaultDirectCostType']>>('none');
  const [formDefaultDirectCostAmount, setFormDefaultDirectCostAmount] = useState<number | ''>('');
  const [formPlanDraft, setFormPlanDraft] = useState<ServicePlanDraft | null>(null);
  const [formTab, setFormTab] = useState<ServiceFormTab>('Basic Information');
  const [formDuplicate, setFormDuplicate] = useState<Service | null>(null);

  useEffect(() => {
    if (!createRequest) return;
    openAddModal();
    onCreateRequestHandled?.();
  }, [createRequest, onCreateRequestHandled]);

  // Form Validation & Submission
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open Add Service
  const openAddModal = () => {
    setFormName('');
    setFormCategory('Other');
    setFormDescription('');
    setFormLogoUrl('');
    setLogoPreviewFailed(false);
    setFormIconName('Tv');
    setFormColor('#10b981');
    setFormStatus('active');
    setFormSettings({
      ...SERVICE_SETTING_DEFAULTS,
      allowEarlyRenewal: settings.subscriptionDefaults?.allowEarlyRenewal ?? SERVICE_SETTING_DEFAULTS.allowEarlyRenewal,
    });
    setFormInvoiceSettings(INVOICE_SETTING_DEFAULTS);
    setFormRenewalMessage(RENEWAL_MESSAGE_DEFAULTS);
    setFormAdvanced(ADVANCED_SETTING_DEFAULTS);
    setFormPlans([]);
    setFormDefaultDirectCostType('none');
    setFormDefaultDirectCostAmount('');
    setFormPlanDraft(null);
    setFormTab('Basic Information');
    setFormDuplicate(null);
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Service
  const openEditModal = (srv: Service) => {
    setEditingService(srv);
    setFormName(srv.name);
    setFormCategory(srv.category);
    setFormDescription(srv.description || '');
    setFormLogoUrl(srv.logoUrl || '');
    setLogoPreviewFailed(false);
    setFormIconName(srv.iconName || 'Tv');
    setFormColor(srv.color || '#10b981');
    setFormStatus(srv.status === 'inactive' ? 'inactive' : 'active');
    setFormSettings({ ...SERVICE_SETTING_DEFAULTS, ...srv.settings });
    setFormInvoiceSettings({ ...INVOICE_SETTING_DEFAULTS, ...srv.invoiceSettings });
    setFormRenewalMessage({ ...RENEWAL_MESSAGE_DEFAULTS, ...srv.renewalMessage });
    setFormAdvanced({ ...ADVANCED_SETTING_DEFAULTS, ...srv.advanced });
    setFormPlans((srv.planDetails || []).map(plan => ({
      ...plan,
      duration: plan.duration ?? plan.durationDays,
      durationUnit: plan.durationUnit || 'Days',
    })));
    setFormDefaultDirectCostType(srv.defaultDirectCostType || 'none');
    setFormDefaultDirectCostAmount(srv.defaultDirectCostAmount ?? '');
    setFormPlanDraft(null);
    setFormTab('Basic Information');
    setFormDuplicate(null);
    setFormErrors({});
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formName.trim()) {
      errors.name = language === 'bn' ? 'সার্ভিসের নাম লিখুন।' : 'Please enter the service name.';
    } else if (formName.trim().length < 2) {
      errors.name = language === 'bn' ? 'নাম কমপক্ষে ২ অক্ষরের হতে হবে' : 'Please enter a service name with at least 2 characters.';
    } else if (formName.trim().length > 80) {
      errors.name = 'Service name must be 80 characters or fewer.';
    }
    if (formDescription.length > 500) {
      errors.description = 'Description must be 500 characters or fewer.';
    }
    if (formLogoUrl.trim()) {
      if (!isValidHttpUrl(formLogoUrl.trim())) {
        errors.logoUrl = 'Enter a valid image URL beginning with http:// or https://.';
      }
    }
    if (formSettings.renewalReminderEnabled
      && (!Number.isInteger(formSettings.reminderDays) || formSettings.reminderDays < 1)) {
      errors.reminderDays = 'Reminder days must be a positive whole number.';
    }
    if (formSettings.usesProfiles
      && (!Number.isInteger(formSettings.profileCapacity) || formSettings.profileCapacity < 1)) {
      errors.profileCapacity = 'Profile capacity must be at least 1 when profiles are enabled.';
    }
    if (formPlans.some(plan => !Number.isFinite(plan.price) || plan.price <= 0
      || !Number.isFinite(plan.durationDays) || plan.durationDays <= 0)) {
      errors.plans = 'Each plan must have a positive price and duration.';
    }
    if (formDefaultDirectCostType !== 'none' &&
      (formDefaultDirectCostAmount === '' || !Number.isFinite(Number(formDefaultDirectCostAmount)) || Number(formDefaultDirectCostAmount) < 0)) {
      errors.plans = 'Enter a valid non-negative service default cost.';
    }
    if (formPlans.some(plan => plan.directCostType && plan.directCostType !== 'none'
      && (!Number.isFinite(plan.directCostAmount) || Number(plan.directCostAmount) < 0))) {
      errors.plans = 'Each plan cost override must be a valid non-negative amount.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveService = async (createAnyway = false) => {
    if (isSubmitting) return;
    if (formPlanDraft) {
      setFormTab('Plans & Pricing');
      setFormErrors(previous => ({ ...previous, planDraft: 'Save or cancel the plan before saving this service.' }));
      return;
    }
    if (!validateForm()) {
      if (!formName.trim() || formName.trim().length < 2 || formName.trim().length > 80) setFormTab('Basic Information');
      else if (formDescription.length > 500) setFormTab('Basic Information');
      else if (formLogoUrl.trim() && !isValidHttpUrl(formLogoUrl.trim())) setFormTab('Branding');
      else if (formSettings.usesProfiles
        && (!Number.isInteger(formSettings.profileCapacity) || formSettings.profileCapacity < 1)) setFormTab('Account & Profile Settings');
      else if (formPlans.some(plan => !Number.isFinite(plan.price) || plan.price <= 0 || !Number.isFinite(plan.durationDays) || plan.durationDays <= 0)) setFormTab('Plans & Pricing');
      else if (formSettings.renewalReminderEnabled
        && (!Number.isInteger(formSettings.reminderDays) || formSettings.reminderDays < 1)) setFormTab('Subscription Settings');
      return;
    }

    const duplicate = services.find(service =>
      service.id !== editingService?.id
      && !service.isArchived
      && service.status !== 'archived'
      && service.name.trim().toLocaleLowerCase() === formName.trim().toLocaleLowerCase()
    );
    if (duplicate && !createAnyway) {
      setFormDuplicate(duplicate);
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingService) {
        await updateService(editingService.id, {
          name: formName.trim(),
          category: formCategory || 'Other',
          description: formDescription.trim(),
          logoUrl: formLogoUrl.trim() || undefined,
          iconName: formIconName,
          color: formColor,
          status: formStatus,
          settings: formSettings,
          invoiceSettings: formInvoiceSettings,
          renewalMessage: formRenewalMessage,
          advanced: formAdvanced,
          planDetails: formPlans,
          defaultDirectCostType: formDefaultDirectCostType,
          defaultDirectCostAmount: formDefaultDirectCostType === 'none' || formDefaultDirectCostAmount === '' ? undefined : Number(formDefaultDirectCostAmount),
        });
        showToast(
          language === 'bn'
            ? 'সার্ভিস সফলভাবে আপডেট করা হয়েছে!'
            : 'Service updated successfully!',
          'success'
        );
        setEditingService(null);
      } else {
        await addService({
          name: formName.trim(),
          category: formCategory || 'Other',
          description: formDescription.trim(),
          logoUrl: formLogoUrl.trim() || undefined,
          iconName: formIconName,
          color: formColor,
          defaultDuration: 30,
          durationUnit: 'Days',
          defaultDurationDays: 30,
          defaultPrice: 0,
          defaultPriceBDT: 0,
          defaultPriceUSD: 0,
          currency,
          status: formStatus,
          planDetails: formPlans,
          defaultDirectCostType: formDefaultDirectCostType,
          defaultDirectCostAmount: formDefaultDirectCostType === 'none' || formDefaultDirectCostAmount === '' ? undefined : Number(formDefaultDirectCostAmount),
          plans: formPlans.map(plan => plan.name),
          planIds: formPlans.map(plan => plan.id),
          settings: formSettings,
          invoiceSettings: formInvoiceSettings,
          renewalMessage: formRenewalMessage,
          advanced: formAdvanced,
        });
        showToast(
          language === 'bn'
            ? 'নতুন সার্ভিস সফলভাবে যোগ করা হয়েছে!'
            : 'Service created successfully.',
          'success'
        );
        setIsAddModalOpen(false);
      }
    } catch (err: unknown) {
      console.error('Service save failed:', err);
      showToast('Unable to save service. Please check your connection and try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveService = (event: React.FormEvent) => {
    event.preventDefault();
    void saveService();
  };

  const saveFormPlan = () => {
    if (!formPlanDraft) return;
    if (!formPlanDraft.name.trim()) {
      setFormErrors(previous => ({ ...previous, planDraft: 'Please enter the plan name.' }));
      return;
    }
    if (formPlanDraft.price === '' || !Number.isFinite(Number(formPlanDraft.price)) || Number(formPlanDraft.price) <= 0) {
      setFormErrors(previous => ({ ...previous, planDraft: 'Enter a valid positive price.' }));
      return;
    }
    if (formPlanDraft.duration === '' || !Number.isSafeInteger(Number(formPlanDraft.duration)) || Number(formPlanDraft.duration) <= 0) {
      setFormErrors(previous => ({ ...previous, planDraft: 'Enter a valid positive duration.' }));
      return;
    }
    if (formPlanDraft.directCostType && formPlanDraft.directCostType !== 'none'
      && (!Number.isFinite(Number(formPlanDraft.directCostAmount)) || Number(formPlanDraft.directCostAmount) < 0)) {
      setFormErrors(previous => ({ ...previous, planDraft: 'Enter a valid non-negative direct cost.' }));
      return;
    }
    const durationMultipliers: Record<DurationUnit, number> = { Days: 1, Weeks: 7, Months: 30, Years: 365 };
    const plan: ServicePlan = {
      id: formPlanDraft.id || createRecordId('plan'),
      name: formPlanDraft.name.trim(),
      internalCode: formPlanDraft.internalCode?.trim() || undefined,
      price: Number(formPlanDraft.price),
      currency: formPlanDraft.currency,
      duration: Number(formPlanDraft.duration),
      durationUnit: formPlanDraft.durationUnit,
      durationDays: Number(formPlanDraft.duration) * durationMultipliers[formPlanDraft.durationUnit],
      status: formPlanDraft.status,
      directCostType: formPlanDraft.directCostType || undefined,
      directCostAmount: formPlanDraft.directCostType && formPlanDraft.directCostType !== 'none'
        ? formPlanDraft.directCostAmount
        : undefined,
    };
    if (formPlans.some(existing => existing.id !== plan.id && existing.name.trim().toLowerCase() === plan.name.toLowerCase())) {
      setFormErrors(previous => ({ ...previous, planDraft: 'A plan with this name already exists.' }));
      return;
    }
    setFormPlans(previous => formPlanDraft.id
      ? previous.map(existing => existing.id === formPlanDraft.id ? plan : existing)
      : [...previous, plan]
    );
    setFormPlanDraft(null);
    setFormErrors(previous => ({ ...previous, planDraft: '', plans: '' }));
  };

  // Safe Deletion & Archival Handler
  const handleConfirmDelete = async (forcePermanent: boolean) => {
    if (!serviceToDelete) return;
    try {
      await deleteService(serviceToDelete.id, forcePermanent);
      showToast(
        forcePermanent
          ? language === 'bn'
            ? 'সার্ভিস স্থায়ীভাবে মুছে ফেলা হয়েছে।'
            : 'Service permanently deleted.'
          : language === 'bn'
          ? 'সার্ভিস সফলভাবে আর্কাইভে পাঠানো হয়েছে।'
          : 'Service safely archived to protect past records.',
        'info'
      );
      if (detailedServiceId === serviceToDelete.id) {
        setDetailedServiceId(null);
      }
      setServiceToDelete(null);
    } catch (err: unknown) {
      console.error('Service delete or archive failed:', err);
      showToast('Unable to delete or archive service. Please try again.', 'error');
    }
  };

  // Restore Service
  const handleRestore = async (id: string, srvName: string) => {
    try {
      await restoreService(id);
      showToast(
        language === 'bn'
          ? `"${srvName}" সক্রিয় ক্যাটালগে রিস্টোর করা হয়েছে!`
          : `"${srvName}" restored to active services catalog!`,
        'success'
      );
    } catch (err: unknown) {
      console.error('Service restore failed:', err);
      showToast('Unable to restore service. Please try again.', 'error');
    }
  };

  const openAddPlan = () => {
    setPlanEditing(null);
    setPlanName('');
    setPlanInternalCode('');
    setPlanPrice('');
    setPlanDuration(30);
    setPlanDurationUnit('Days');
    setPlanCurrency(currency);
    setPlanStatus('active');
    setPlanDescription('');
    setPlanDirectCostType('none');
    setPlanDirectCostAmount('');
    setPlanProfileCapacity('');
    setPlanAccountCapacity('');
    setPlanRenewalEnabled(detailedService?.settings?.renewalEnabled ?? true);
    setPlanReminderEnabled(detailedService?.settings?.renewalReminderEnabled ?? true);
    setPlanReminderDays(detailedService?.settings?.reminderDays ?? 7);
    setPlanSortOrder((detailedService?.planDetails || []).length);
    setPlanFormError('');
    setIsPlanModalOpen(true);
  };

  const openEditPlan = (plan: ServicePlan, duplicate = false) => {
    setPlanEditing(duplicate ? null : plan);
    setPlanName(duplicate ? `${plan.name} Copy` : plan.name);
    setPlanInternalCode(duplicate ? '' : plan.internalCode || '');
    setPlanPrice(plan.price);
    setPlanDuration(plan.duration ?? plan.durationDays);
    setPlanDurationUnit(plan.durationUnit || 'Days');
    setPlanCurrency(plan.currency);
    setPlanStatus(duplicate ? 'active' : plan.status);
    setPlanDescription(plan.description || '');
    setPlanDirectCostType(plan.directCostType || 'none');
    setPlanDirectCostAmount(plan.directCostAmount ?? '');
    setPlanProfileCapacity(plan.profileCapacity ?? '');
    setPlanAccountCapacity(plan.accountCapacity ?? '');
    setPlanRenewalEnabled(plan.renewalEnabled ?? detailedService?.settings?.renewalEnabled ?? true);
    setPlanReminderEnabled(plan.renewalReminderEnabled ?? detailedService?.settings?.renewalReminderEnabled ?? true);
    setPlanReminderDays(plan.reminderDays ?? detailedService?.settings?.reminderDays ?? 7);
    setPlanSortOrder(duplicate ? (detailedService?.planDetails || []).length : plan.sortOrder ?? 0);
    setPlanFormError('');
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailedService) return;
    if (!planName.trim()) {
      setPlanFormError('Please enter the plan name.');
      return;
    }
    if (planName.trim().length > 80) {
      setPlanFormError('Plan name must be 80 characters or fewer.');
      return;
    }
    if (planPrice === '' || !Number.isFinite(Number(planPrice)) || Number(planPrice) <= 0) {
      setPlanFormError('Enter a valid positive price.');
      return;
    }
    if (planDuration === '' || !Number.isSafeInteger(Number(planDuration)) || Number(planDuration) <= 0) {
      setPlanFormError('Enter a valid positive duration.');
      return;
    }
    if (planDescription.length > 500) {
      setPlanFormError('Plan description must be 500 characters or fewer.');
      return;
    }
    if (!Number.isSafeInteger(planSortOrder) || planSortOrder < 0) {
      setPlanFormError('Sort order must be a non-negative whole number.');
      return;
    }
    if (detailedService.settings?.usesProfiles && planProfileCapacity !== ''
      && (!Number.isSafeInteger(Number(planProfileCapacity)) || Number(planProfileCapacity) < 1)) {
      setPlanFormError('Profile capacity must be a positive whole number.');
      return;
    }
    if (detailedService.settings?.usesAccounts && planAccountCapacity !== ''
      && (!Number.isSafeInteger(Number(planAccountCapacity)) || Number(planAccountCapacity) < 1)) {
      setPlanFormError('Account capacity must be a positive whole number.');
      return;
    }
    if (planReminderEnabled && (!Number.isSafeInteger(planReminderDays) || planReminderDays < 1)) {
      setPlanFormError('Reminder days must be a positive whole number.');
      return;
    }
    if (planDirectCostType !== 'none'
      && (planDirectCostAmount === '' || !Number.isFinite(Number(planDirectCostAmount)) || Number(planDirectCostAmount) < 0)) {
      setPlanFormError('Enter a valid non-negative direct cost.');
      return;
    }

    const currentPlans = detailedService.planDetails || [];
    const durationMultipliers: Record<DurationUnit, number> = { Days: 1, Weeks: 7, Months: 30, Years: 365 };
    const nextPlan: ServicePlan = {
      id: planEditing?.id || createRecordId('plan'),
      name: planName.trim(),
      internalCode: planInternalCode.trim() || undefined,
      price: Number(planPrice),
      currency: planCurrency,
      duration: Number(planDuration),
      durationUnit: planDurationUnit,
      durationDays: Number(planDuration) * durationMultipliers[planDurationUnit],
      status: planStatus,
      description: planDescription.trim() || undefined,
      profileCapacity: planProfileCapacity === '' ? undefined : Number(planProfileCapacity),
      accountCapacity: planAccountCapacity === '' ? undefined : Number(planAccountCapacity),
      renewalEnabled: planRenewalEnabled,
      renewalReminderEnabled: planReminderEnabled,
      reminderDays: planReminderEnabled ? planReminderDays : undefined,
      sortOrder: planSortOrder,
      directCostType: planDirectCostType,
      directCostAmount: planDirectCostType === 'none' || planDirectCostAmount === '' ? undefined : Number(planDirectCostAmount),
    };

    const duplicateName = currentPlans.some(plan =>
      plan.id !== nextPlan.id && plan.name.trim().toLowerCase() === nextPlan.name.toLowerCase()
    );
    if (duplicateName) {
      setPlanFormError('A plan with this name already exists.');
      return;
    }
    try {
      const nextPlans = planEditing
        ? currentPlans.map(plan => plan.id === planEditing.id ? nextPlan : plan)
        : [...currentPlans, nextPlan];
      await updateService(detailedService.id, { planDetails: nextPlans });
      setIsPlanModalOpen(false);
      setPlanEditing(null);
      showToast(planEditing ? 'Plan updated successfully.' : 'Plan added successfully.', 'success');
    } catch (error) {
      console.error('Could not save service plan.', error);
      showToast('Could not save the plan. Please try again.', 'error');
    }
  };

  const handleDeletePlan = async (plan: ServicePlan) => {
    if (!detailedService) return;
    const isInUse = subscriptions.some(subscription =>
      subscription.serviceId === detailedService.id && subscription.planId === plan.id
    ) || sales.some(sale => sale.serviceId === detailedService.id && sale.planId === plan.id)
      || accounts.some(account => account.serviceId === detailedService.id && account.planId === plan.id)
      || invoices.some(invoice => invoice.serviceId === detailedService.id && invoice.planId === plan.id);
    if (isInUse) {
      showToast('This plan is already in use. You can deactivate it instead.', 'info');
      return;
    }
    if (!window.confirm(`Delete the unused plan "${plan.name}"?`)) return;
    try {
      const nextPlans = (detailedService.planDetails || []).filter(item => item.id !== plan.id);
      await updateService(detailedService.id, { planDetails: nextPlans });
      showToast('Plan deleted.', 'success');
    } catch (error) {
      console.error('Could not delete service plan.', error);
      showToast('Could not delete the plan. Please try again.', 'error');
    }
  };

  const togglePlanStatus = async (plan: ServicePlan) => {
    if (!detailedService) return;
    try {
      const planDetails = (detailedService.planDetails || []).map(item =>
        item.id === plan.id ? { ...item, status: item.status === 'active' ? 'inactive' as const : 'active' as const } : item
      );
      await updateService(detailedService.id, { planDetails });
      showToast(`Plan ${plan.status === 'active' ? 'deactivated' : 'activated'}.`, 'success');
    } catch (error) {
      console.error('Could not update service plan status.', error);
      showToast('Could not update the plan. Please try again.', 'error');
    }
  };

  const toggleServiceStatus = async (service: Service) => {
    if (service.status === 'active' && !window.confirm(
      `Deactivate ${service.name}?\n\nInactive services cannot be selected for new sales, but existing subscriptions and historical records will remain available.`
    )) return;
    try {
      await updateService(service.id, { status: service.status === 'active' ? 'inactive' : 'active' });
      showToast(`Service ${service.status === 'active' ? 'deactivated' : 'activated'}.`, 'success');
    } catch (error) {
      console.error('Could not update service status.', error);
      showToast('Could not update the service. Please try again.', 'error');
    }
  };

  const duplicateService = async (service: Service) => {
    const name = window.prompt('New service name', `${service.name} Copy`)?.trim();
    if (!name) return;
    if (name.length < 2 || name.length > 80) {
      showToast('Service name must be between 2 and 80 characters.', 'error');
      return;
    }
    if (services.some(item => !item.isArchived && item.status !== 'archived' && item.name.trim().toLowerCase() === name.toLowerCase())) {
      showToast('A service with this name already exists.', 'error');
      return;
    }
    try {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...configuration } = service;
      const planDetails = (service.planDetails || []).map(plan => ({ ...plan, id: createRecordId('plan') }));
      await addService({
        ...configuration,
        name,
        status: 'active',
        isArchived: false,
        planDetails,
        plans: planDetails.map(plan => plan.name),
        planIds: planDetails.map(plan => plan.id),
      });
      showToast(`Service "${name}" duplicated without its history or resources.`, 'success');
    } catch (error) {
      console.error('Could not duplicate service.', error);
      showToast('Could not duplicate the service. Please try again.', 'error');
    }
  };

  const servicePerformance = useMemo(
    () => calculateServicePerformance(sales, subscriptions, payments, services, currency, subscription =>
      isCurrentSubscription(subscription, services.find(service => service.id === subscription.serviceId), settings.reminderNoticeDays)
    ),
    [sales, subscriptions, payments, services, currency, settings.reminderNoticeDays]
  );
  const servicePerformanceById = useMemo(
    () => new Map(servicePerformance.map(metric => [metric.serviceId, metric])),
    [servicePerformance]
  );
  const planPerformance = useMemo(
    () => calculatePlanPerformance(sales, subscriptions, payments, services, currency, subscription =>
      isCurrentSubscription(subscription, services.find(service => service.id === subscription.serviceId), settings.reminderNoticeDays)
    ),
    [sales, subscriptions, payments, services, currency, settings.reminderNoticeDays]
  );
  const planPerformanceById = useMemo(
    () => new Map(planPerformance.map(metric => [`${metric.serviceId}::${metric.planId}`, metric])),
    [planPerformance]
  );
  const serviceResourcesById = useMemo(
    () => new Map(getServiceResourceSummary(services, accounts).map(summary => [summary.serviceId, summary])),
    [services, accounts]
  );

  // Filter & Sort Pipeline
  const filteredServices = useMemo(() => {
    return services
      .filter(srv => {
        // Status filter
        if (srv.isArchived || srv.status === 'archived') return false;
        if (statusFilter === 'active' && srv.status !== 'active') return false;
        if (statusFilter === 'inactive' && srv.status !== 'inactive') return false;

        // Search query filter
        const q = debouncedSearchQuery;
        if (q) {
          const matchName = srv.name.toLowerCase().includes(q);
          const matchId = srv.id.toLowerCase().includes(q);
          const matchDescription = srv.description?.toLowerCase().includes(q) || false;
          const matchInternalCode = srv.advanced?.internalCode?.toLowerCase().includes(q) || false;
          const matchPlan = srv.planDetails?.some(plan => plan.name.toLowerCase().includes(q))
            || srv.plans?.some(plan => plan.toLowerCase().includes(q))
            || srv.planDetails?.some(plan => plan.internalCode?.toLowerCase().includes(q))
            || false;
          if (!matchName && !matchId && !matchDescription && !matchInternalCode && !matchPlan) return false;
        }

        const activePlans = (srv.planDetails || []).filter(plan => plan.status === 'active');
        if (planFilter === 'has_active' && activePlans.length === 0) return false;
        if (planFilter === 'none_active' && activePlans.length > 0) return false;
        const activeSubscriptions = servicePerformanceById.get(srv.id)?.activeSubscriptions || 0;
        if (subscriptionFilter === 'has_active' && activeSubscriptions === 0) return false;
        if (subscriptionFilter === 'none_active' && activeSubscriptions > 0) return false;
        if (resourceFilter === 'accounts' && srv.settings?.usesAccounts !== true) return false;
        if (resourceFilter === 'profiles' && srv.settings?.usesProfiles !== true) return false;
        if (resourceFilter === 'none' && (srv.settings?.usesAccounts === true || srv.settings?.usesProfiles === true)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'popular') return (servicePerformanceById.get(b.id)?.activeSubscriptions || 0) - (servicePerformanceById.get(a.id)?.activeSubscriptions || 0);
        if (sortBy === 'accounts') return (serviceResourcesById.get(b.id)?.accountCount || 0) - (serviceResourcesById.get(a.id)?.accountCount || 0);
        if (sortBy === 'revenue') return (servicePerformanceById.get(b.id)?.revenue || 0) - (servicePerformanceById.get(a.id)?.revenue || 0);
        if (sortBy === 'plans') return (b.planDetails?.length || b.plans?.length || 0) - (a.planDetails?.length || a.plans?.length || 0);
        if (sortBy === 'recently_updated') return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        if (sortBy === 'price_low') {
          const aPrice = getServicePrice(a, currency);
          const bPrice = getServicePrice(b, currency);
          if (aPrice === null) return bPrice === null ? 0 : 1;
          if (bPrice === null) return -1;
          return aPrice - bPrice;
        }
        if (sortBy === 'price_high') {
          const aPrice = getServicePrice(a, currency);
          const bPrice = getServicePrice(b, currency);
          if (aPrice === null) return bPrice === null ? 0 : 1;
          if (bPrice === null) return -1;
          return bPrice - aPrice;
        }
        // Newest
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [services, debouncedSearchQuery, statusFilter, planFilter, subscriptionFilter, resourceFilter, sortBy, servicePerformanceById, serviceResourcesById, currency]);

  // Selected Service for Details Modal
  const detailedService = services.find(s => s.id === detailedServiceId);
  const detailedAccounts = detailedService
    ? accounts.filter(a => a.serviceId === detailedService.id)
    : [];
  const detailedSubs = detailedService
    ? subscriptions.filter(s => s.serviceId === detailedService.id)
    : [];
  const detailedSales = detailedService
    ? sales.filter(s => s.serviceId === detailedService.id)
    : [];

  const activeDetailedSubs = detailedSubs.filter(s => isCurrentSubscription(s, detailedService || undefined, settings.reminderNoticeDays));
  const detailedPlans = (detailedService?.planDetails || []).filter(plan => {
    const query = planSearchQuery.trim().toLowerCase();
    return (!query || plan.name.toLowerCase().includes(query) || plan.description?.toLowerCase().includes(query) || plan.internalCode?.toLowerCase().includes(query))
      && (planStatusFilter === 'all' || plan.status === planStatusFilter);
  }).sort((a, b) => {
    if (planSortBy === 'price') return b.price - a.price;
    if (planSortBy === 'duration') return (b.durationDays || b.duration || 0) - (a.durationDays || a.duration || 0);
    if (planSortBy === 'popularity') return (planPerformanceById.get(`${detailedServiceId}::${b.id}`)?.activeSubscriptions || 0)
      - (planPerformanceById.get(`${detailedServiceId}::${a.id}`)?.activeSubscriptions || 0);
    if (planSortBy === 'revenue') return (planPerformanceById.get(`${detailedServiceId}::${b.id}`)?.revenue || 0)
      - (planPerformanceById.get(`${detailedServiceId}::${a.id}`)?.revenue || 0);
    return a.name.localeCompare(b.name);
  });
  const planCapacityById = new Map((detailedService?.planDetails || []).map(plan => {
    const planAccounts = detailedAccounts.filter(account =>
      account.planId === plan.id || (!account.planId && account.plan === plan.name)
    );
    return [plan.id, {
      accounts: planAccounts.length,
      activeAccounts: planAccounts.filter(account => isAccountOperational(account)).length,
      capacity: getServiceCapacity(planAccounts),
    }] as const;
  }));
  const filteredDetailedSubs = detailedSubs.filter(subscription => {
    const category = subscription.status === 'cancelled' || subscription.status === 'expired' || getDaysDifference(subscription.expiryDate) < 0
      ? 'expired'
      : getDaysDifference(subscription.expiryDate) <= 7 ? 'ending' : 'active';
    return subscriptionStatusFilter === 'all' || category === subscriptionStatusFilter;
  });
  const filteredDetailedAccounts = detailedAccounts.filter(account => {
    const active = isAccountOperational(account);
    return accountStatusFilter === 'all' || (accountStatusFilter === 'active' ? active : !active);
  });

  const detailedCapacity = getServiceCapacity(detailedAccounts);
  const detailedPerformance = detailedService ? servicePerformanceById.get(detailedService.id) : undefined;
  const detailedCustomers = detailedService
    ? customers.filter(customer => detailedSubs.some(subscription => subscription.customerId === customer.id)
      || detailedSales.some(sale => sale.customerId === customer.id))
    : [];
  const detailedActiveCustomerCount = detailedService
    ? new Set(activeDetailedSubs.map(subscription => subscription.customerId)).size
    : 0;
  const currentMonthPrefix = getLocalDateString(new Date()).slice(0, 7);
  const detailedNewCustomerCount = detailedCustomers.filter(customer =>
    customer.createdAt.startsWith(currentMonthPrefix)
  ).length;
  const detailedRenewalCustomerCount = detailedService
    ? new Set([
      ...detailedSales.filter(sale => sale.renewalOfSubscriptionId).map(sale => sale.customerId),
      ...detailedSubs.filter(subscription => (subscription.renewalHistory?.length || 0) > 0).map(subscription => subscription.customerId),
    ].filter(Boolean)).size
    : 0;
  const detailedEndingSoon = detailedSubs.filter(subscription =>
    getSubscriptionStatus(subscription, detailedService, settings.reminderNoticeDays) === 'expiring_soon'
  ).length;
  const detailedExpiredCount = detailedSubs.filter(subscription =>
    getSubscriptionStatus(subscription, detailedService, settings.reminderNoticeDays) === 'expired'
  ).length;
  const detailedActivity = detailedService
    ? activityLogs.filter(item => item.serviceId === detailedService.id || item.entityId === detailedService.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6)
    : [];
  const catalogServices = services.filter(service => !service.isArchived && service.status !== 'archived');
  const summary = useMemo(() => {
    const activeServices = catalogServices.filter(service => service.status === 'active');
    const activePlans = catalogServices.flatMap(service => service.planDetails || [])
      .filter(plan => plan.status === 'active').length;
    const monthlyFinancials = calculateSalesFinancialSummary(
      sales.filter(sale => sale.date.startsWith(currentMonthPrefix)),
      payments,
      currency
    );
    return {
      totalServices: catalogServices.length,
      activeServices: activeServices.length,
      totalPlans: catalogServices.reduce((total, service) => total + (service.planDetails?.length || service.plans?.length || 0), 0),
      activePlans,
      activeSubscriptions: catalogServices.reduce((total, service) => total + (servicePerformanceById.get(service.id)?.activeSubscriptions || 0), 0),
      monthlyRevenue: monthlyFinancials.revenue,
    };
  }, [catalogServices, servicePerformanceById, sales, payments, currency, currentMonthPrefix]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {!detailedService && (
        <div className="space-y-5">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0 ring-1 ring-emerald-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <span>{language === 'bn' ? 'সার্ভিস' : 'Services'}</span>
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'ডিজিটাল সাবস্ক্রিপশন ক্যাটালগ, অ্যাকাউন্ট পুল ইনভেন্টরি ও মূল্য তালিকা ব্যবস্থাপনা।'
              : 'Manage services, plans, pricing, subscriptions and resources.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => downloadCSV('services.csv', exportServicesCSV(catalogServices))}
            disabled={catalogServices.length === 0}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm shadow-emerald-600/25 hover:shadow-emerald-600/35 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('addService')}</span>
          </button>
        </div>
      </div>

      {!servicesLoading && !servicesError && (
        <section aria-label="Service catalog summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Total Services', value: summary.totalServices, icon: Layers },
            { label: 'Active Services', value: summary.activeServices, icon: CheckCircle2 },
            { label: 'Total Plans', value: summary.totalPlans, icon: FileText },
            { label: 'Active Plans', value: summary.activePlans, icon: CheckCircle2 },
            { label: 'Active Subscriptions', value: summary.activeSubscriptions, icon: CreditCard },
            { label: 'Monthly Revenue', value: summary.monthlyRevenue, icon: DollarSign, currency: true },
          ].map(({ label, value, icon: SummaryIcon, currency: isCurrency }) => (
            <div
              key={label}
              className="min-w-0 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-[#111726]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {label}
                </span>
                <SummaryIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
              <div className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 dark:text-white">{isCurrency ? formatCurrency(value, currency) : value}</div>
            </div>
          ))}
        </section>
      )}

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'সার্ভিস খুঁজুন...' : 'Search name, ID, description or code...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search services by name, ID, description, plan or internal code"
            className="w-full h-10 pl-9.5 pr-9 bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters & View Toggles with matching h-10 */}
        <div className="flex flex-wrap items-center gap-2 pb-1 sm:pb-0">
          {/* Status Dropdown */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              aria-label="Filter services by status"
              onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="h-10 shrink-0 px-3 bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="all">{language === 'bn' ? 'সব সার্ভিস' : 'All Services'}</option>
              <option value="active">{language === 'bn' ? 'সক্রিয়' : 'Active'}</option>
              <option value="inactive">{language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'}</option>
            </select>
          </div>

          <select aria-label="Filter services by active plans" value={planFilter} onChange={event => setPlanFilter(event.target.value as typeof planFilter)} className="h-10 max-w-full rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-300">
            <option value="all">All plans</option><option value="has_active">Has active plans</option><option value="none_active">No active plans</option>
          </select>
          <select aria-label="Filter services by active subscriptions" value={subscriptionFilter} onChange={event => setSubscriptionFilter(event.target.value as typeof subscriptionFilter)} className="h-10 max-w-full rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-300">
            <option value="all">All subscriptions</option><option value="has_active">Has active subscriptions</option><option value="none_active">No active subscriptions</option>
          </select>
          <select aria-label="Filter services by resource type" value={resourceFilter} onChange={event => setResourceFilter(event.target.value as typeof resourceFilter)} className="h-10 max-w-full rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 dark:border-slate-800 dark:bg-[#111726] dark:text-slate-300">
            <option value="all">All resources</option><option value="accounts">Uses accounts</option><option value="profiles">Uses profiles</option><option value="none">No resource assignment</option>
          </select>

          {/* Sort By Dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              aria-label="Sort services"
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="h-10 shrink-0 px-3 bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="popular">
                {language === 'bn' ? 'জনপ্রিয় (সাবস্ক্রিপশন)' : 'Most Subscriptions'}
              </option>
              <option value="accounts">
                {language === 'bn' ? 'অ্যাকাউন্ট পুল' : 'Most Accounts'}
              </option>
              <option value="revenue">Highest Revenue</option>
              <option value="plans">Most Plans</option>
              <option value="name_asc">
                {language === 'bn' ? 'নাম (A-Z)' : 'Name (A to Z)'}
              </option>
              <option value="name_desc">
                {language === 'bn' ? 'নাম (Z-A)' : 'Name (Z to A)'}
              </option>
              <option value="recently_updated">Recently Updated</option>
              <option value="price_low">
                {language === 'bn' ? 'মূল্য (কম থেকে বেশি)' : 'Price: Low to High'}
              </option>
              <option value="price_high">
                {language === 'bn' ? 'মূল্য (বেশি থেকে কম)' : 'Price: High to Low'}
              </option>
              <option value="newest">
                {language === 'bn' ? 'নতুন যোগকৃত' : 'Newest Added'}
              </option>
            </select>
          </div>

          {/* View Mode Toggle (Grid vs Table) */}
          <div className="h-10 shrink-0 flex items-center p-0.5 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`h-full px-2.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`hidden sm:flex h-full px-2.5 rounded-md transition-all cursor-pointer items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. ERROR BANNER */}
      {servicesError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{servicesError}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-rose-600 text-white rounded-md font-semibold text-xs hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. MAIN CONTENT CONTAINER */}
      {servicesLoading && services.length === 0 ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-5 bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/3" />
                </div>
              </div>
              <div className="h-10 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
              <div className="h-8 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        /* Empty State */
        <div className="py-9 text-center text-slate-400 bg-white dark:bg-[#111726] rounded-xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Layers className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                {searchQuery ? 'No matching services found.' : 'No services yet.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'Try another search.' : 'Add your first service to get started.'}
              </p>
            </div>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={openAddModal}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Service</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5 sm:gap-5">
          {filteredServices.map(srv => {
            const isArchivedService = srv.isArchived || srv.status === 'archived';
            const plans = srv.planDetails?.map(plan => plan.name) || srv.plans || [];
            const activePlanCount = srv.planDetails?.filter(plan => plan.status === 'active').length || 0;
            const metrics = servicePerformanceById.get(srv.id);
            const resources = serviceResourcesById.get(srv.id);
            return (
              <div
                key={srv.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-200/80 border-t-2 bg-white p-4 shadow-2xs transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-xs dark:border-slate-800/90 dark:bg-[#111726] dark:hover:border-slate-700"
                style={{ borderTopColor: srv.color || '#10b981' }}
              >
                <div className="space-y-3">
                  {/* HEADER: Icon + Service Name + Category + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ring-1 ring-black/5 dark:ring-white/10 ${srv.logoUrl ? 'text-white' : 'border bg-slate-50 text-slate-900 dark:bg-slate-100 dark:text-slate-900'}`}
                        style={srv.logoUrl ? { backgroundColor: srv.color || '#10b981' } : { borderColor: srv.color || '#cbd5e1' }}
                      >
                        {srv.logoUrl ? (
                          <img
                            src={srv.logoUrl}
                            alt={srv.name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span aria-hidden="true" className="text-base font-bold">{getServiceInitials(srv.name)}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-[17px]">
                          <button type="button" onClick={() => setDetailedServiceId(srv.id)} className="max-w-full truncate text-left transition-colors hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:text-emerald-400" aria-label={`View ${srv.name} service details`}>
                            {srv.name}
                          </button>
                        </h3>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                          {srv.advanced?.internalCode ? `Code ${srv.advanced.internalCode}` : `ID ${srv.id}`}
                          <span> · {srv.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isArchivedService ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                          Archived
                        </span>
                      ) : srv.status === 'active' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{t('status_active')}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
                          {language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* DESCRIPTION (2 lines max, tooltip on hover) */}
                  {srv.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {srv.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 border-y border-slate-100 py-3 dark:border-slate-800">
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Plans</p><p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{plans.length} <span className="text-[10px] font-normal text-slate-500">({activePlanCount} active)</span></p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Active subscriptions</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{metrics?.activeSubscriptions || 0}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Accounts</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{resources?.accountCount || 0} <span className="text-[10px] font-normal text-slate-500">({resources?.activeAccounts || 0} active)</span></p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Profiles</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{resources?.usedProfiles || 0}/{resources?.profileCapacity || 0} <span className="text-[10px] font-normal text-slate-500">used</span></p></div>
                    <div className="col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Revenue</p><p className="mt-0.5 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(metrics?.revenue || 0, currency)}</p><p className="text-[10px] text-slate-500">Paid {formatCurrency(metrics?.paid || 0, currency)} · Due {formatCurrency(metrics?.due || 0, currency)}</p></div>
                  </div>
                </div>

                {/* CARD FOOTER: Actions */}
                <div
                  className="relative mt-4 pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80"
                >
                  <button type="button" onClick={() => setDetailedServiceId(srv.id)} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800">View Details</button>
                  {srv.status === 'active'
                    && srv.planDetails?.some(plan => plan.status === 'active')
                    && srv.settings?.subscriptionEnabled !== false
                    && srv.advanced?.allowNewSubscriptions !== false
                    && srv.advanced?.showInNewSale !== false && (
                    <button
                      onClick={() => onOpenNewSaleForService(srv.id)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>New Sale</span>
                    </button>
                  )}
                  {srv.status === 'active' && (!srv.planDetails || !activePlanCount) && <button type="button" onClick={() => { setDetailedServiceId(srv.id); window.setTimeout(() => document.getElementById('service-detail-plans')?.scrollIntoView({ behavior: 'smooth' }), 0); }} className="rounded-md px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/40">No active plans · Manage Plans</button>}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenServiceActionsId(openServiceActionsId === srv.id ? null : srv.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                      aria-label={`Actions for ${srv.name}`}
                      aria-expanded={openServiceActionsId === srv.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openServiceActionsId === srv.id && (
                      <div role="menu" className="absolute right-0 top-10 z-20 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        {!isArchivedService && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenServiceActionsId(null);
                              openEditModal(srv);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Edit
                          </button>
                        )}
                        <button type="button" onClick={() => { setOpenServiceActionsId(null); setDetailedServiceId(srv.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><FileText className="h-3.5 w-3.5" /> Plans</button>
                        <button type="button" onClick={() => { setOpenServiceActionsId(null); onNavigateToServiceAccounts ? onNavigateToServiceAccounts(srv.id) : onNavigateSection?.('accounts'); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Users className="h-3.5 w-3.5" /> Accounts</button>
                        <button type="button" onClick={() => { setOpenServiceActionsId(null); void duplicateService(srv); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Duplicate service</button>
                        {!isArchivedService && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenServiceActionsId(null);
                              void toggleServiceStatus(srv);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> {srv.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setOpenServiceActionsId(null);
                            const url = getServiceWebsiteUrl(srv);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open website
                        </button>
                        {isArchivedService ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenServiceActionsId(null);
                              void handleRestore(srv.id, srv.name);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore service
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenServiceActionsId(null);
                              setServiceToDelete(srv);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete service
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* PREMIUM TABLE VIEW */
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">{language === 'bn' ? 'সার্ভিস' : 'SERVICE'}</th>
                  <th className="py-3 px-5">{language === 'bn' ? 'ক্যাটাগরি' : 'CATEGORY'}</th>
                  <th className="py-3 px-5">{language === 'bn' ? 'মূল্য ও মেয়াদ' : 'PRICE & DURATION'}</th>
                  <th className="py-3 px-5">{language === 'bn' ? 'ইনভেন্টরি পুল' : 'ACCOUNTS POOL'}</th>
                  <th className="py-3 px-5">{language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন' : 'ACTIVE SUBS'}</th>
                  <th className="py-3 px-5">{language === 'bn' ? 'স্ট্যাটাস' : 'STATUS'}</th>
                  <th className="py-3 px-5 text-right">{language === 'bn' ? 'অ্যাকশন' : 'ACTIONS'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {filteredServices.map(srv => {
                  const Icon = getServiceIcon(srv);
                  const catStyle = getCategoryBadgeStyle(srv.category);
                  const isArchivedService = srv.isArchived || srv.status === 'archived';
                  const resourceMetrics = serviceResourcesById.get(srv.id);
                  const activeCount = servicePerformanceById.get(srv.id)?.activeSubscriptions || 0;
                  const capacity = {
                    assigned: resourceMetrics?.usedProfiles || 0,
                    total: resourceMetrics?.profileCapacity || 0,
                    available: resourceMetrics?.availableProfiles || 0,
                  };
                  const price = getServicePrice(srv, currency);
                  const displayDuration =
                    srv.defaultDuration || srv.defaultDurationDays
                      ? `${srv.defaultDuration || srv.defaultDurationDays} ${srv.durationUnit || 'Days'}`
                      : null;

                  const capacityTone =
                    capacity.total === 0
                      ? { text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' }
                      : capacity.available === 0
                      ? { text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' }
                      : capacity.available <= 1
                      ? { text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' }
                      : { text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' };

                  return (
                    <tr
                      key={srv.id}
                      onClick={() => setDetailedServiceId(srv.id)}
                      className="h-16 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Service Cell */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${srv.logoUrl ? 'text-white' : 'border bg-slate-50 text-slate-900 dark:bg-slate-100 dark:text-slate-900'}`}
                            style={srv.logoUrl ? { backgroundColor: srv.color || '#10b981' } : { borderColor: srv.color || '#cbd5e1' }}
                          >
                            {srv.logoUrl ? (
                              <img src={srv.logoUrl} alt={srv.name} className="w-full h-full object-cover" />
                            ) : (
                              <span aria-hidden="true" className="text-sm font-bold">{srv.name.trim().charAt(0).toUpperCase() || '?'}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-sm">
                              {srv.name}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">{srv.category}</div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${catStyle.bg} ${catStyle.text} ${catStyle.border} border font-semibold text-[11px]`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                          <span>{srv.category}</span>
                        </span>
                      </td>

                      {/* Price & Duration */}
                      <td className="py-3.5 px-5">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {price === null ? '—' : formatCurrency(price, currency)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {displayDuration || '—'}
                        </div>
                      </td>

                      {/* Inventory Pool */}
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {resourceMetrics?.accountCount || 0} accounts · {capacity.assigned}/{capacity.total}
                        </span>
                        <div className={`text-[11px] ${capacityTone.text} font-mono flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${capacityTone.dot}`} />
                          <span>{capacity.available} available</span>
                        </div>
                      </td>

                      {/* Active Subs */}
                      <td className="py-3.5 px-5">
                        {activeCount > 0 ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>
                              {activeCount} {language === 'bn' ? 'সক্রিয়' : 'Active'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">0 active</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isArchivedService
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                              : srv.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80'
                          }`}
                        >
                          {isArchivedService ? 'Archived' : srv.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {/* Website */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              const url = getServiceWebsiteUrl(srv);
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer transition-colors"
                            title={language === 'bn' ? 'সার্ভিস ওয়েবসাইট খুলুন' : 'Open service website'}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenNewSaleForService(srv.id)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md cursor-pointer"
                            title={t('newSale')}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {isArchivedService ? (
                            <button
                              onClick={() => handleRestore(srv.id, srv.name)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md cursor-pointer"
                              title="Restore Service"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openEditModal(srv)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                              title={t('edit')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setServiceToDelete(srv)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md cursor-pointer"
                            title="Delete / Archive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </div>
      )}

      {/* 5. SERVICE DETAILS PAGE */}
      {detailedService && (
        <div className="space-y-6 text-xs">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setDetailedServiceId(null);
                  if (onClearSelectedService) onClearSelectedService();
                }}
                className="mt-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Services
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="max-w-full truncate text-2xl font-bold text-slate-900 dark:text-white">{detailedService.name}</h1>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${detailedService.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{detailedService.status === 'active' ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{detailedService.advanced?.internalCode ? `Code ${detailedService.advanced.internalCode} · ` : ''}Service details, plans, subscriptions, accounts, and sales.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-xs">
            {/* Header info banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs overflow-hidden"
                  style={{ backgroundColor: detailedService.color || '#10b981' }}
                >
                  {detailedService.logoUrl ? (
                    <img src={detailedService.logoUrl} alt={detailedService.name} className="w-full h-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="text-lg font-bold">{detailedService.name.trim().charAt(0).toUpperCase() || '?'}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {detailedService.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        detailedService.isArchived || detailedService.status === 'archived'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          : detailedService.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {detailedService.isArchived || detailedService.status === 'archived'
                        ? 'Archived'
                        : detailedService.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {detailedService.description && <p className="mt-1 max-w-2xl text-xs text-slate-600 dark:text-slate-300">{detailedService.description}</p>}
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Category: {detailedService.category}</span>
                    {detailedService.createdAt && (
                      <span className="font-mono text-slate-400">
                        · Added: {formatAppDate(detailedService.createdAt, language)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {detailedService.status === 'active'
                  && detailedService.planDetails?.some(plan => plan.status === 'active')
                  && detailedService.settings?.subscriptionEnabled !== false
                  && detailedService.advanced?.allowNewSubscriptions !== false
                  && detailedService.advanced?.showInNewSale !== false
                  && (
                    <button
                      onClick={() => {
                        onOpenNewSaleForService(detailedService.id);
                        setDetailedServiceId(null);
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('newSale')}</span>
                    </button>
                  )}

                <button type="button" onClick={() => onAddAccountForService ? onAddAccountForService(detailedService.id) : onNavigateToServiceAccounts ? onNavigateToServiceAccounts(detailedService.id) : onNavigateSection?.('accounts')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"><Plus className="h-3.5 w-3.5" />Add Account</button>
                <button type="button" onClick={() => onNavigateToServiceAccounts ? onNavigateToServiceAccounts(detailedService.id) : onNavigateSection?.('accounts')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"><Users className="h-3.5 w-3.5" />Manage Accounts</button>
                <button type="button" onClick={() => onAddCustomerForService ? onAddCustomerForService(detailedService.id) : onNavigateToServiceCustomers ? onNavigateToServiceCustomers(detailedService.id) : onNavigateSection?.('customers')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"><UserRound className="h-3.5 w-3.5" />Add Customer</button>
                <button
                  onClick={() => openEditModal(detailedService)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="Edit Service"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Service
                </button>
                <button
                  type="button"
                  onClick={openAddPlan}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Plan
                </button>
                <button type="button" onClick={() => void duplicateService(detailedService)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"><Copy className="h-3.5 w-3.5" />Duplicate</button>
                <button type="button" onClick={() => void toggleServiceStatus(detailedService)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">{detailedService.status === 'active' ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>

            {detailedService.status === 'inactive' && (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Inactive services cannot be selected for new sales, but existing subscriptions and historical records remain available.
              </div>
            )}

            {/* Quick KPI stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Total Plans</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{detailedService.planDetails?.length || detailedService.plans?.length || 0}</div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Active Plans</div>
                <div className="mt-0.5 text-lg font-bold text-emerald-600">{detailedService.planDetails?.filter(plan => plan.status === 'active').length || 0}</div>
              </div>
              <button type="button" onClick={() => onNavigateToServiceSubscriptions ? onNavigateToServiceSubscriptions(detailedService.id) : onNavigateSection?.('subscriptions')} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Active Subscriptions
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {detailedPerformance?.activeSubscriptions || 0}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">Ending soon {detailedEndingSoon} · Expired {detailedExpiredCount}</div>
              </button>

              <button type="button" onClick={() => onNavigateToServiceAccounts ? onNavigateToServiceAccounts(detailedService.id) : onNavigateSection?.('accounts')} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Total Accounts
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {detailedAccounts.length}
                </div>
              </button>
              <button type="button" onClick={() => onNavigateToServiceProfiles ? onNavigateToServiceProfiles(detailedService.id) : onNavigateSection?.('profiles')} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Available Profiles
                  </div>
                <div className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {detailedCapacity.available}
                </div>
                </button>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Total Sales
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {detailedSales.length}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Revenue
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  {formatCurrency(detailedPerformance?.revenue || 0, currency)}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">Paid {formatCurrency(detailedPerformance?.paid || 0, currency)} · Due {formatCurrency(detailedPerformance?.due || 0, currency)}</div>
              </div>
              <button type="button" onClick={() => onNavigateToServiceCustomers ? onNavigateToServiceCustomers(detailedService.id) : onNavigateSection?.('customers')} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Customers</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{detailedActiveCustomerCount} <span className="text-xs font-normal text-slate-500">active / {detailedCustomers.length} total</span></div>
              </button>
              <button type="button" onClick={() => onNavigateToServiceCustomers ? onNavigateToServiceCustomers(detailedService.id) : onNavigateSection?.('customers')} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">New customers this month</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{detailedNewCustomerCount}</div>
              </button>
              <button type="button" onClick={() => onNavigateToServiceCustomers ? onNavigateToServiceCustomers(detailedService.id) : onNavigateSection?.('customers')} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Renewal customers</div>
                <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{detailedRenewalCustomerCount}</div>
              </button>
            </div>

            <nav aria-label="Service detail sections" className="sticky top-0 z-10 -mx-2 flex gap-1 overflow-x-auto border-y border-slate-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              {[
                ['service-detail-information', 'Service Information'],
                ['service-detail-plans', 'Plans & Pricing'],
                ['service-detail-subscriptions', 'Subscriptions'],
                ['service-detail-accounts', 'Accounts'],
                ['service-detail-sales', 'Sales'],
                ['service-detail-settings', 'Settings'],
                ['service-detail-activity', 'Activity'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  {label}
                </button>
              ))}
            </nav>

            <section id="service-detail-information" className="scroll-mt-16 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Service Information</h3>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-[11px] text-slate-500">Service Name</dt><dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">{detailedService.name}</dd></div>
                <div><dt className="text-[11px] text-slate-500">Description</dt><dd className="mt-0.5 text-slate-700 dark:text-slate-300">{detailedService.description?.trim() || '—'}</dd></div>
                <div><dt className="text-[11px] text-slate-500">Status</dt><dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">{detailedService.status === 'active' ? 'Active' : detailedService.status === 'archived' ? 'Archived' : 'Inactive'}</dd></div>
                {detailedService.createdAt && <div><dt className="text-[11px] text-slate-500">Created Date</dt><dd className="mt-0.5 text-slate-700 dark:text-slate-300">{formatAppDateTime(detailedService.createdAt, language)}</dd></div>}
                {detailedService.updatedAt && <div><dt className="text-[11px] text-slate-500">Last Updated</dt><dd className="mt-0.5 text-slate-700 dark:text-slate-300">{formatAppDateTime(detailedService.updatedAt, language)}</dd></div>}
                {detailedService.logoUrl && <div className="flex items-center gap-2"><img src={detailedService.logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" /><span className="text-[11px] text-slate-500">Service logo</span></div>}
                {detailedService.color && <div className="flex items-center gap-2"><span className="h-5 w-5 rounded border border-slate-200" style={{ backgroundColor: detailedService.color }} /><span className="text-[11px] text-slate-500">Accent color {detailedService.color}</span></div>}
              </dl>
            </section>

            <section id="service-detail-plans" className="scroll-mt-16 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Plans & Pricing</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Edit plans without changing existing subscriptions.</p>
                </div>
                <button
                  type="button"
                  onClick={openAddPlan}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Plan
                </button>
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
                <label className="relative block"><span className="sr-only">Search plans</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={planSearchQuery} onChange={event => setPlanSearchQuery(event.target.value)} placeholder="Search plans..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
                <select aria-label="Plan status filter" value={planStatusFilter} onChange={event => setPlanStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="all">All Plans</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                <select aria-label="Sort plans" value={planSortBy} onChange={event => setPlanSortBy(event.target.value as typeof planSortBy)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="name">Name</option><option value="price">Price</option><option value="duration">Duration</option><option value="popularity">Popularity</option><option value="revenue">Revenue</option></select>
              </div>
              {(detailedService.planDetails || []).length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-900/50">
                  <p>No plans yet.</p>
                  <p className="mt-1">Add a plan to start selling this service.</p>
                </div>
              ) : detailedPlans.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-900/50">No plans match this search or filter.</div>
              ) : (
                <div className="space-y-2">
                  {detailedPlans.map(plan => (
                    <div
                      key={plan.id}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200/80 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">{plan.name}<span className={`rounded-full px-2 py-0.5 text-[10px] ${plan.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{plan.status === 'active' ? 'Active' : 'Inactive'}</span></div>
                        <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(plan.price, plan.currency)} <span className="text-xs font-normal text-slate-500">/ {plan.duration ?? plan.durationDays} {plan.durationUnit || 'Days'}</span>
                        </div>
                        {plan.description && <p className="mt-1 text-xs text-slate-500">{plan.description}</p>}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">{planPerformanceById.get(`${detailedService.id}::${plan.id}`)?.activeSubscriptions || 0} active subscriptions</span>
                          <span>Revenue {formatCurrency(planPerformanceById.get(`${detailedService.id}::${plan.id}`)?.revenue || 0, currency)}</span>
                          {plan.profileCapacity !== undefined && <span>Profile capacity {plan.profileCapacity}</span>}
                          {plan.accountCapacity !== undefined && <span>Account capacity {plan.accountCapacity}</span>}
                        </div>
                        {(() => {
                          const resources = planCapacityById.get(plan.id);
                          if (!resources) return null;
                          return (
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {resources.accounts} accounts ({resources.activeAccounts} active) · {resources.capacity.assigned}/{resources.capacity.total} profiles used · {resources.capacity.available} available
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPlan(plan)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => openEditPlan(plan, true)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">Duplicate</button>
                        <button
                          type="button"
                          onClick={() => void togglePlanStatus(plan)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          {plan.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" onClick={() => void handleDeletePlan(plan)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {(detailedService.description || detailedService.notes) && (
              <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                {detailedService.description && <p>{detailedService.description}</p>}
                {detailedService.notes && <p className="border-t border-slate-100 pt-2 dark:border-slate-700">{detailedService.notes}</p>}
              </div>
            )}

            {/* Related Accounts Section */}
            <div id="service-detail-accounts" className="scroll-mt-16">
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Accounts ({detailedAccounts.length})</span>
                <select aria-label="Account status filter" value={accountStatusFilter} onChange={event => setAccountStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium normal-case dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
              </div>
              {detailedAccounts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No inventory accounts linked to this service yet. Add accounts in Accounts section.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredDetailedAccounts.map(acc => {
                    const totalProfiles = acc.profiles?.length || 0;
                    const accountCapacity = getServiceCapacity([acc]);
                    const usedProfiles = acc.profiles?.filter(profile => profile.status === 'Assigned').length || 0;
                    const isAccountActive = !['Inactive', 'Suspended', 'Expired'].includes(acc.status);
                    return (
                      <div
                        key={acc.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {acc.email}
                          </div>
                          <div className="text-slate-500 text-[11px]">{acc.plan || '—'} · {totalProfiles} profiles · {usedProfiles} used · {accountCapacity.available} available</div>
                          <div className={`mt-1 font-semibold ${isAccountActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>{isAccountActive ? 'Active' : 'Inactive'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => onNavigateSection?.('accounts', acc.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                            View Account
                          </button>
                          <span className="self-center font-mono text-[11px] text-slate-500">
                            {usedProfiles}/{totalProfiles} used
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {detailedAccounts.length > 0 && filteredDetailedAccounts.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/40">No accounts match this filter.</p>}
            </div>

            {/* Current subscriptions link customers by stored customerId. */}
            <div id="service-detail-subscriptions" className="scroll-mt-16">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                <span>Subscriptions ({detailedSubs.length})</span>
                <select aria-label="Subscription status filter" value={subscriptionStatusFilter} onChange={event => setSubscriptionStatusFilter(event.target.value as 'all' | 'active' | 'ending' | 'expired')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium normal-case dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="all">All</option><option value="active">Active</option><option value="ending">Ending Soon</option><option value="expired">Expired</option></select>
              </div>
              {filteredDetailedSubs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No subscriptions yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredDetailedSubs.map(subscription => {
                    const customer = customers.find(item => item.id === subscription.customerId);
                    const account = detailedAccounts.find(item => item.id === subscription.accountId);
                    const profile = account?.profiles?.find(item => item.id === subscription.profileId);
                    const daysLeft = getDaysDifference(subscription.expiryDate);
                    const statusLabel = subscription.status === 'cancelled'
                      ? 'Cancelled'
                      : subscription.status === 'expired' || daysLeft < 0 ? 'Expired' : daysLeft <= 7 ? 'Ending Soon' : 'Active';
                    return (
                      <div
                        key={subscription.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900 dark:text-white">{customer?.name || 'Customer unavailable'}</span>{customer && <button type="button" onClick={() => onSelectCustomer?.(customer.id)} className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">View Customer</button>}</div>
                          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {subscription.plan}
                            {account ? ` · ${account.email}` : ''}
                            {profile ? ` · ${profile.profileName}` : ''}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">Start: {formatAppDate(subscription.startDate, language)} · End: {formatAppDate(subscription.expiryDate, language)}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                          <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {formatCurrency(subscription.price, subscription.currency)}
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusLabel === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : statusLabel === 'Ending Soon' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{statusLabel}</span>
                          <button type="button" onClick={() => onViewSubscription ? onViewSubscription(subscription.id) : onNavigateSection?.('subscriptions', subscription.id)} className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">View</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Sales History */}
            <div id="service-detail-sales" className="scroll-mt-16">
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Sales ({detailedSales.length})</span>
                <button type="button" onClick={() => onNavigateSection?.('sales')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700">View Sales</button>
              </div>
              {detailedSales.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No sales processed for this service yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {detailedSales.slice().sort((a, b) => b.date.localeCompare(a.date)).map(sl => {
                    const cust = customers.find(c => c.id === sl.customerId);
                    return (
                      <div
                        key={sl.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <button type="button" onClick={() => cust && onSelectCustomer?.(cust.id)} className="font-semibold text-slate-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400">{cust?.name || 'Customer unavailable'}</button>
                          <div className="text-slate-600 dark:text-slate-300">{sl.plan}</div>
                          <div className="text-slate-400 text-[11px] font-mono">
                            {sl.invoiceNo} · {formatAppDate(sl.date, language)} · {sl.paymentStatus}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(sl.amount, sl.currency)}</div>
                          <button type="button" onClick={() => onNavigateSection?.('sales', sl.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">View Sale</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <section id="service-detail-settings" className="scroll-mt-16 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Service Settings</h3><button type="button" onClick={() => { openEditModal(detailedService); setFormTab('Subscription Settings'); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">Edit Settings</button></div>
              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <h4 className="mb-3 font-semibold text-slate-900 dark:text-white">Subscription & Renewal Settings</h4>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <dt className="text-slate-500">Subscription Enabled</dt><dd className="text-right font-medium">{detailedService.settings?.subscriptionEnabled === false ? 'No' : 'Yes'}</dd>
                    <dt className="text-slate-500">Renewal Enabled</dt><dd className="text-right font-medium">{detailedService.settings?.renewalEnabled === false ? 'No' : 'Yes'}</dd>
                    <dt className="text-slate-500">Auto-calculate expiry</dt><dd className="text-right font-medium">{detailedService.settings?.autoCalculateExpiry === false ? 'No' : 'Yes'}</dd>
                    <dt className="text-slate-500">Renewal Reminder</dt><dd className="text-right font-medium">{detailedService.settings?.renewalReminderEnabled === false ? 'Disabled' : `${detailedService.settings?.reminderDays || 7} days before expiry`}</dd>
                    <dt className="text-slate-500">Allow Early Renewal</dt><dd className="text-right font-medium">{detailedService.settings?.allowEarlyRenewal ? 'Yes' : 'No'}</dd>
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900 dark:text-white">Customer Settings</h4><button type="button" onClick={() => { openEditModal(detailedService); setFormTab('Customer Settings'); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Edit</button></div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <dt className="text-slate-500">Customer required</dt><dd className="text-right font-medium">{detailedService.settings?.customerRequired === false ? 'No' : 'Yes'}</dd>
                    <dt className="text-slate-500">Email required</dt><dd className="text-right font-medium">{detailedService.settings?.emailRequired ? 'Yes' : 'No'}</dd>
                    <dt className="text-slate-500">Phone required</dt><dd className="text-right font-medium">{detailedService.settings?.phoneRequired ? 'Yes' : 'No'}</dd>
                    <dt className="text-slate-500">Multiple active subscriptions</dt><dd className="text-right font-medium">{detailedService.settings?.allowMultipleActiveSubscriptions ? 'Allowed' : 'Not allowed'}</dd>
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900 dark:text-white">Account & Profile Settings</h4><button type="button" onClick={() => { openEditModal(detailedService); setFormTab('Account & Profile Settings'); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Edit</button></div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <dt className="text-slate-500">Uses accounts</dt><dd className="text-right font-medium">{detailedService.settings?.usesAccounts ? 'Yes' : 'No'}</dd>
                    <dt className="text-slate-500">Uses profiles</dt><dd className="text-right font-medium">{detailedService.settings?.usesProfiles ? 'Yes' : 'No'}</dd>
                    <dt className="text-slate-500">Profile required</dt><dd className="text-right font-medium">{detailedService.settings?.profileAssignmentRequired ? 'Yes' : 'No'}</dd>
                    <dt className="text-slate-500">Profile capacity</dt><dd className="text-right font-medium">{detailedService.settings?.profileCapacity ?? '—'}</dd>
                    <dt className="text-slate-500">Account sharing</dt><dd className="text-right font-medium">{detailedService.settings?.allowAccountSharing ? 'Allowed' : 'Not allowed'}</dd>
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900 dark:text-white">Renewal Message</h4><button type="button" onClick={() => { openEditModal(detailedService); setFormTab('Renewal Message'); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Edit Message</button></div>
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Status: {detailedService.renewalMessage?.enabled ? 'Enabled' : 'Disabled'}</p>
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{detailedService.renewalMessage?.template?.trim() || 'No renewal message template configured.'}</p>
                  {detailedService.renewalMessage?.template && <p className="mt-2 break-words text-[11px] text-slate-500">Variables: {[...new Set(detailedService.renewalMessage.template.match(/\{[a-zA-Z]+\}/g) || [])].join(', ') || 'None'}</p>}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900 dark:text-white">Invoice Settings</h4><button type="button" onClick={() => { openEditModal(detailedService); setFormTab('Invoice Settings'); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Edit Invoice Settings</button></div>
                  <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {([
                      ['showLogo', 'Logo'], ['showDescription', 'Service Description'], ['showPlan', 'Plan'],
                      ['showSubscriptionPeriod', 'Subscription Period'], ['showPaymentMethod', 'Payment Method'],
                      ['showCustomerPhone', 'Customer Phone'], ['showCustomerEmail', 'Customer Email'],
                    ] as const).map(([key, label]) => <li key={key} className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className={`h-2 w-2 rounded-full ${detailedService.invoiceSettings?.[key] === false ? 'bg-slate-300' : 'bg-emerald-500'}`} />{label}: {detailedService.invoiceSettings?.[key] === false ? 'Off' : 'On'}</li>)}
                  </ul>
                  <p className="mt-3 text-[11px] text-slate-500">Passwords and profile PINs are never included on invoices.</p>
                </section>
                <details className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                  <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">Advanced Settings</summary>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><dt className="text-slate-500">Display on New Sale</dt><dd className="text-right">{detailedService.advanced?.showInNewSale === false ? 'No' : 'Yes'}</dd><dt className="text-slate-500">Display on Dashboard</dt><dd className="text-right">{detailedService.advanced?.showOnDashboard === false ? 'No' : 'Yes'}</dd><dt className="text-slate-500">Allow New Subscriptions</dt><dd className="text-right">{detailedService.advanced?.allowNewSubscriptions === false ? 'No' : 'Yes'}</dd><dt className="text-slate-500">Allow Manual Renewal</dt><dd className="text-right">{detailedService.advanced?.allowManualRenewal === false ? 'No' : 'Yes'}</dd>{detailedService.advanced?.internalCode && <><dt className="text-slate-500">Internal Code</dt><dd className="text-right">{detailedService.advanced.internalCode}</dd></>}{detailedService.advanced?.notes && <><dt className="text-slate-500">Notes</dt><dd className="col-span-2 whitespace-pre-wrap">{detailedService.advanced.notes}</dd></>}</dl>
                  <button type="button" onClick={() => { openEditModal(detailedService); setFormTab('Advanced Settings'); }} className="mt-3 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Edit Advanced Settings</button>
                </details>
              </div>
            </section>

            <section id="service-detail-activity" className="scroll-mt-16 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Service Activity</h3>
                <span className="text-[11px] text-slate-500">Recent audit history</span>
              </div>
              {detailedActivity.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-900/50">No service activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {detailedActivity.map(item => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{item.title}</p><p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">{item.description}</p></div>
                      <time className="shrink-0 text-[10px] text-slate-400">{formatAppDateTime(item.timestamp, language)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* 6. ADD / EDIT SERVICE MODAL */}
      {(isAddModalOpen || editingService) && (
        <Modal
          isOpen={isAddModalOpen || !!editingService}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingService(null);
            setFormErrors({});
          }}
          title={
            editingService
              ? language === 'bn'
                ? 'সার্ভিস সম্পাদনা করুন'
                : 'Edit Service'
              : language === 'bn'
              ? 'নতুন সার্ভিস যোগ করুন'
              : 'Add Service'
          }
          maxWidth="4xl"
        >
          <form onSubmit={handleSaveService} className="space-y-5 text-sm">
            <nav aria-label="Service configuration sections" className="-mx-2 flex gap-1 overflow-x-auto border-b border-slate-200 px-2 pb-2 dark:border-slate-800">
              {SERVICE_FORM_TABS.map(tab => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setFormTab(tab)}
                  aria-current={formTab === tab ? 'step' : undefined}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${formTab === tab ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {tab}
                </button>
              ))}
            </nav>

            {formTab === 'Basic Information' && (
              <section className="space-y-4" aria-labelledby="service-basic-title">
                <div>
                  <h4 id="service-basic-title" className="text-base font-bold text-slate-900 dark:text-white">Basic Information</h4>
                  <p className="mt-1 text-xs text-slate-500">Set the name, category, description, and availability of this service.</p>
                </div>
                <label className="block space-y-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Service Name *</span>
                  <input
                    value={formName}
                    onChange={event => {
                      setFormName(event.target.value);
                      setFormDuplicate(null);
                      setFormErrors(previous => ({ ...previous, name: '' }));
                    }}
                    maxLength={80}
                    placeholder="Enter service name"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {formErrors.name && <span role="alert" className="block text-xs text-rose-600">{formErrors.name}</span>}
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Category</span>
                    <select value={formCategory} onChange={event => setFormCategory(event.target.value as ServiceCategory)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      {CATEGORIES_LIST.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Status</span>
                    <select value={formStatus} onChange={event => setFormStatus(event.target.value as 'active' | 'inactive')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Description <span className="font-normal text-slate-400">Optional · up to 500 characters</span></span>
                  <textarea rows={4} maxLength={500} value={formDescription} onChange={event => setFormDescription(event.target.value)} placeholder="Describe what this service includes" className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  <span className="text-xs text-slate-400">{formDescription.length}/500</span>
                  {formErrors.description && <span role="alert" className="block text-xs text-rose-600">{formErrors.description}</span>}
                </label>
              </section>
            )}

            {formTab === 'Branding' && (
              <section className="space-y-4">
                <div><h4 className="text-base font-bold text-slate-900 dark:text-white">Branding</h4><p className="mt-1 text-xs text-slate-500">Customize how the service appears in your workspace.</p></div>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl font-bold text-white" style={{ backgroundColor: formColor }}>
                    {formLogoUrl && !logoPreviewFailed && !formErrors.logoUrl ? <img src={formLogoUrl} alt={`${formName || 'Service'} logo preview`} className="h-full w-full object-cover" onError={() => setLogoPreviewFailed(true)} /> : (formName.trim().charAt(0).toUpperCase() || '?')}
                  </div>
                  <p className="text-xs text-slate-500">Preview. Without a logo, the service’s first letter appears.</p>
                </div>
                <label className="block space-y-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Logo Image URL</span>
                  <input type="url" value={formLogoUrl} onChange={event => { setFormLogoUrl(event.target.value); setLogoPreviewFailed(false); setFormErrors(previous => ({ ...previous, logoUrl: '' })); }} placeholder="https://example.com/logo.png" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  {formErrors.logoUrl && <span role="alert" className="block text-xs text-rose-600">{formErrors.logoUrl}</span>}
                </label>
                <div className="space-y-2">
                  <span className="block font-semibold text-slate-700 dark:text-slate-300">Accent Color</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map(color => <button key={color} type="button" aria-label={`Select ${color} accent`} aria-pressed={formColor.toLowerCase() === color.toLowerCase()} onClick={() => setFormColor(color)} className={`h-9 w-9 rounded-lg border border-slate-200 ${formColor.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`} style={{ backgroundColor: color }} />)}
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">Custom Color<input type="color" value={formColor} onChange={event => setFormColor(event.target.value)} className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0" /></label>
                  </div>
                </div>
              </section>
            )}

            {formTab === 'Plans & Pricing' && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Plans & Pricing</h4><p className="mt-1 text-xs text-slate-500">Add one or more sale plans. Plans can also be added later.</p></div><button type="button" onClick={() => { setFormPlanDraft({ name: '', price: '', currency, duration: settings.serviceDefaults?.durationDays ?? 30, durationUnit: 'Days', status: 'active' }); setFormErrors(previous => ({ ...previous, planDraft: '' })); }} className="rounded-lg bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500">+ Add Plan</button></div>
                <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-2">
                  <label className="block space-y-1"><span className="text-xs font-semibold">Service default direct cost</span><select aria-label="Service default direct cost type" value={formDefaultDirectCostType} onChange={event => setFormDefaultDirectCostType(event.target.value as NonNullable<Service['defaultDirectCostType']>)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="none">None</option><option value="fixed_per_sale">Fixed per sale</option><option value="fixed_per_cycle">Fixed per cycle</option><option value="percentage_of_sale">Percentage of sale</option></select></label>
                  {formDefaultDirectCostType !== 'none' && <label className="block space-y-1"><span className="text-xs font-semibold">{formDefaultDirectCostType === 'percentage_of_sale' ? 'Cost percentage (%)' : 'Cost amount'}</span><input aria-label="Service default direct cost amount" type="number" min="0" step="any" value={formDefaultDirectCostAmount} onChange={event => setFormDefaultDirectCostAmount(event.target.value === '' ? '' : Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>}
                  <p className="text-[11px] text-slate-500 sm:col-span-2">Expected cost only. A plan can override this; actual cost records are tracked separately in Profitability.</p>
                </div>
                {formErrors.plans && <p role="alert" className="text-xs text-rose-600">{formErrors.plans}</p>}
                {formPlans.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">No plans yet. Add plans now or later from service details.</div> : <div className="space-y-2">{formPlans.map(plan => <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white">{plan.name}</p><p className="text-xs text-slate-500">{formatCurrency(plan.price, plan.currency)} · {plan.duration || plan.durationDays} {plan.durationUnit || 'Days'} · {plan.status === 'active' ? 'Active' : 'Inactive'}</p></div><div className="flex gap-2"><button type="button" onClick={() => setFormPlanDraft({ ...plan, duration: plan.duration ?? plan.durationDays, durationUnit: plan.durationUnit || 'Days' })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Edit</button><button type="button" onClick={() => setFormPlans(previous => previous.map(item => item.id === plan.id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">{plan.status === 'active' ? 'Deactivate' : 'Activate'}</button></div></div>)}</div>}
                {formPlanDraft && <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><h5 className="font-semibold text-slate-900 dark:text-white">{formPlanDraft.id ? 'Edit Plan' : 'Add Plan'}</h5><label className="block space-y-1"><span className="text-xs font-medium">Plan Name *</span><input autoFocus maxLength={80} value={formPlanDraft.name} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, name: event.target.value } : previous)} placeholder="Enter plan name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1"><span className="text-xs font-medium">Price *</span><input type="number" min="0.01" step="any" value={formPlanDraft.price} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, price: event.target.value === '' ? '' : Number(event.target.value) } : previous)} placeholder="Enter price" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label><label className="block space-y-1"><span className="text-xs font-medium">Currency</span><select value={formPlanDraft.currency} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, currency: event.target.value as AppCurrency } : previous)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value={currency}>{currency} (Business currency)</option><option value={currency === 'BDT' ? 'USD' : 'BDT'}>{currency === 'BDT' ? 'USD' : 'BDT'}</option></select></label><label className="block space-y-1"><span className="text-xs font-medium">Duration *</span><input type="number" min="1" step="1" value={formPlanDraft.duration} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, duration: event.target.value === '' ? '' : Number(event.target.value) } : previous)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label><label className="block space-y-1"><span className="text-xs font-medium">Duration Unit</span><select value={formPlanDraft.durationUnit} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, durationUnit: event.target.value as DurationUnit } : previous)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{(['Days', 'Weeks', 'Months', 'Years'] as const).map(unit => <option key={unit}>{unit}</option>)}</select></label><label className="block space-y-1"><span className="text-xs font-medium">Status</span><select value={formPlanDraft.status} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, status: event.target.value as 'active' | 'inactive' } : previous)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1"><span className="text-xs font-medium">Plan direct cost override</span><select aria-label="Plan direct cost override type" value={formPlanDraft.directCostType || ''} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, directCostType: event.target.value ? event.target.value as NonNullable<ServicePlan['directCostType']> : undefined } : previous)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Use service default</option><option value="none">No expected cost</option><option value="fixed_per_sale">Fixed per sale</option><option value="fixed_per_cycle">Fixed per cycle</option><option value="percentage_of_sale">Percentage of sale</option></select></label>{formPlanDraft.directCostType && formPlanDraft.directCostType !== 'none' && <label className="block space-y-1"><span className="text-xs font-medium">{formPlanDraft.directCostType === 'percentage_of_sale' ? 'Cost percentage (%)' : 'Cost amount'}</span><input aria-label="Plan direct cost amount" type="number" min="0" step="any" value={formPlanDraft.directCostAmount ?? ''} onChange={event => setFormPlanDraft(previous => previous ? { ...previous, directCostAmount: event.target.value === '' ? undefined : Number(event.target.value) } : previous)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>}</div>{formErrors.planDraft && <p role="alert" className="text-xs text-rose-600">{formErrors.planDraft}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setFormPlanDraft(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="button" onClick={saveFormPlan} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Save Plan</button></div></div>}
              </section>
            )}

            {formTab === 'Subscription Settings' && (
              <section className="space-y-4"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Subscription Settings</h4><p className="mt-1 text-xs text-slate-500">Define expiry and renewal behavior for this service.</p></div>
                {([
                  ['subscriptionEnabled', 'Subscription Enabled'],
                  ['renewalEnabled', 'Renewal Enabled'],
                  ['autoCalculateExpiry', 'Auto-calculate expiry date'],
                  ['renewalReminderEnabled', 'Enable renewal reminder'],
                ] as const).map(([key, label]) => <label key={key} className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span className="text-sm text-slate-700 dark:text-slate-300">{label}</span><input type="checkbox" checked={formSettings[key]} onChange={event => setFormSettings(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label>)}
                {formSettings.renewalReminderEnabled && <label className="block max-w-xs space-y-1.5"><span className="font-medium">Reminder days before expiry</span><select value={formSettings.reminderDays} onChange={event => setFormSettings(previous => ({ ...previous, reminderDays: Number(event.target.value) }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{[3, 5, 7, 14, 30].map(days => <option key={days} value={days}>{days} days</option>)}</select>{formErrors.reminderDays && <span role="alert" className="text-xs text-rose-600">{formErrors.reminderDays}</span>}</label>}
              </section>
            )}

            {formTab === 'Account & Profile Settings' && (
              <section className="space-y-4"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Account & Profile Settings</h4><p className="mt-1 text-xs text-slate-500">Choose whether sales for this service use managed accounts and profiles.</p></div>
                <label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>Uses Accounts</span><input type="checkbox" checked={formSettings.usesAccounts} onChange={event => setFormSettings(previous => ({ ...previous, usesAccounts: event.target.checked, usesProfiles: event.target.checked ? previous.usesProfiles : false }))} className="h-4 w-4 accent-emerald-600" /></label>
                {formSettings.usesAccounts && <><label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>Uses Profiles</span><input type="checkbox" checked={formSettings.usesProfiles} onChange={event => setFormSettings(previous => ({ ...previous, usesProfiles: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label>{formSettings.usesProfiles && <label className="block max-w-xs space-y-1.5"><span>Default Profiles Per Account *</span><input type="number" min="1" step="1" value={formSettings.profileCapacity} onChange={event => setFormSettings(previous => ({ ...previous, profileCapacity: event.target.value === '' ? 0 : Number(event.target.value) }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />{formErrors.profileCapacity && <span role="alert" className="text-xs text-rose-600">{formErrors.profileCapacity}</span>}</label>}<label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>Allow Account Sharing</span><input type="checkbox" checked={formSettings.allowAccountSharing} onChange={event => setFormSettings(previous => ({ ...previous, allowAccountSharing: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label><label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>Profile Assignment Required</span><input type="checkbox" checked={formSettings.profileAssignmentRequired} onChange={event => setFormSettings(previous => ({ ...previous, profileAssignmentRequired: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label></>}
              </section>
            )}

            {formTab === 'Customer Settings' && (
              <section className="space-y-4"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Customer Settings</h4><p className="mt-1 text-xs text-slate-500">Control customer details and subscription rules.</p></div>
                {([
                  ['customerRequired', 'Customer Required'],
                  ['emailRequired', 'Email Required'],
                  ['phoneRequired', 'Phone Required'],
                  ['allowMultipleActiveSubscriptions', 'Allow Multiple Active Subscriptions'],
                  ['allowRenewal', 'Allow Renewal'],
                  ['allowEarlyRenewal', 'Allow Early Renewal'],
                ] as const).map(([key, label]) => <label key={key} className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>{label}</span><input type="checkbox" checked={formSettings[key]} onChange={event => setFormSettings(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label>)}
              </section>
            )}

            {formTab === 'Renewal Message' && (
              <section className="space-y-4"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Renewal Message</h4><p className="mt-1 text-xs text-slate-500">Set an optional reusable message for renewals.</p></div>
                <label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>Enable Renewal Message</span><input type="checkbox" checked={formRenewalMessage.enabled} onChange={event => setFormRenewalMessage(previous => ({ ...previous, enabled: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label>
                {formRenewalMessage.enabled && <><label className="block space-y-1.5"><span className="font-semibold">Message Template</span><textarea rows={6} value={formRenewalMessage.template} onChange={event => setFormRenewalMessage(previous => ({ ...previous, template: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="mb-2 font-semibold">Available Variables</p><p className="break-words text-xs leading-6 text-slate-500">{['customerName', 'customerPhone', 'customerEmail', 'serviceName', 'planName', 'startDate', 'expiryDate', 'invoiceNumber', 'amount', 'currency'].map(variable => `{${variable}}`).join('  ')}</p></div></>}
              </section>
            )}

            {formTab === 'Invoice Settings' && (
              <section className="space-y-4"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Invoice Settings</h4><p className="mt-1 text-xs text-slate-500">Select which non-sensitive service and customer details may appear on invoices.</p></div>
                {([
                  ['showLogo', 'Show Service Logo'],
                  ['showDescription', 'Show Service Description'],
                  ['showPlan', 'Show Plan Name'],
                  ['showSubscriptionPeriod', 'Show Subscription Period'],
                  ['showPaymentMethod', 'Show Payment Method'],
                  ['showCustomerPhone', 'Show Customer Phone'],
                  ['showCustomerEmail', 'Show Customer Email'],
                ] as const).map(([key, label]) => <label key={key} className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>{label}</span><input type="checkbox" checked={formInvoiceSettings[key]} onChange={event => setFormInvoiceSettings(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label>)}
                <p className="text-xs text-slate-500">Account passwords and profile PINs are never included in service or invoice settings.</p>
              </section>
            )}

            {formTab === 'Advanced Settings' && (
              <section className="space-y-4"><div><h4 className="text-base font-bold text-slate-900 dark:text-white">Advanced Settings</h4><p className="mt-1 text-xs text-slate-500">Optional display and internal workflow settings.</p></div>
                <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><summary className="cursor-pointer font-semibold">Show advanced options</summary><div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5"><span>Internal Service Code</span><input value={formAdvanced.internalCode} onChange={event => setFormAdvanced(previous => ({ ...previous, internalCode: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><label className="block space-y-1.5"><span>Sort Order</span><input type="number" value={formAdvanced.sortOrder} onChange={event => setFormAdvanced(previous => ({ ...previous, sortOrder: Number(event.target.value) }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label></div>
                  {([
                    ['showInNewSale', 'Display on New Sale'],
                    ['showOnDashboard', 'Display on Dashboard'],
                    ['allowNewSubscriptions', 'Allow New Subscriptions'],
                    ['allowManualRenewal', 'Allow Manual Renewal'],
                  ] as const).map(([key, label]) => <label key={key} className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 px-3.5 dark:border-slate-800"><span>{label}</span><input type="checkbox" checked={formAdvanced[key]} onChange={event => setFormAdvanced(previous => ({ ...previous, [key]: event.target.checked }))} className="h-4 w-4 accent-emerald-600" /></label>)}
                  <label className="block space-y-1.5"><span>Notes</span><textarea rows={3} value={formAdvanced.notes} onChange={event => setFormAdvanced(previous => ({ ...previous, notes: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
                </div></details>
              </section>
            )}

            {formDuplicate && <div role="alert" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>A service with this name already exists.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setDetailedServiceId(formDuplicate.id); setFormDuplicate(null); setIsAddModalOpen(false); setEditingService(null); }} className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-semibold">View Existing</button><button type="button" onClick={() => { setFormDuplicate(null); void saveService(true); }} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white">{editingService ? 'Save Anyway' : 'Create Anyway'}</button></div></div>}

            <div className="sticky bottom-0 -mx-6 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-900/95">
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingService(null); setFormErrors({}); setFormDuplicate(null); }} className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('cancel')}</button>
              <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}<span>{isSubmitting ? 'Saving...' : 'Save Service'}</span></button>
            </div>
          </form>
        </Modal>
      )}

      {isPlanModalOpen && detailedService && (
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          title={planEditing ? 'Edit Plan' : 'Add Plan'}
          maxWidth="md"
        >
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Plan Name *</label>
              <input
                autoFocus
                value={planName}
                onChange={event => setPlanName(event.target.value)}
                maxLength={80}
                placeholder="Enter plan name"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Internal Code</span><input value={planInternalCode} onChange={event => setPlanInternalCode(event.target.value)} maxLength={80} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Price *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={planPrice}
                    onChange={event => setPlanPrice(event.target.value === '' ? '' : Number(event.target.value))}
                    placeholder="Enter price"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    aria-label="Currency"
                    value={planCurrency}
                    onChange={event => setPlanCurrency(event.target.value as AppCurrency)}
                    className="rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="BDT">BDT</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_130px] gap-2">
                <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Duration *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={planDuration}
                  onChange={event => setPlanDuration(event.target.value === '' ? '' : Number(event.target.value))}
                  placeholder="Enter duration"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                </div>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Unit</span><select value={planDurationUnit} onChange={event => setPlanDurationUnit(event.target.value as DurationUnit)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">{(['Days', 'Weeks', 'Months', 'Years'] as const).map(unit => <option key={unit}>{unit}</option>)}</select></label>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select
                value={planStatus}
                onChange={event => setPlanStatus(event.target.value as 'active' | 'inactive')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea rows={3} maxLength={500} value={planDescription} onChange={event => setPlanDescription(event.target.value)} placeholder="Describe this plan (optional)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <p className="mt-1 text-right text-xs text-slate-400">{planDescription.length}/500</p>
            </div>
            <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Expected direct cost override</span><select aria-label="Plan direct cost override type" value={planDirectCostType} onChange={event => setPlanDirectCostType(event.target.value as NonNullable<ServicePlan['directCostType']>)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="none">No expected cost</option><option value="fixed_per_sale">Fixed per sale</option><option value="fixed_per_cycle">Fixed per cycle</option><option value="percentage_of_sale">Percentage of sale</option></select></label>
              {planDirectCostType !== 'none' && <label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{planDirectCostType === 'percentage_of_sale' ? 'Cost percentage (%)' : 'Cost amount'}</span><input aria-label="Plan direct cost amount" type="number" min="0" step="any" value={planDirectCostAmount} onChange={event => setPlanDirectCostAmount(event.target.value === '' ? '' : Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>}
              <p className="text-xs text-slate-500 sm:col-span-2">Overrides the service default cost for this plan. This is an estimate, separate from actual costs.</p>
            </div>
            {(detailedService.settings?.usesProfiles || detailedService.settings?.usesAccounts) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {detailedService.settings.usesProfiles && <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Profiles per account</span><input type="number" min="1" step="1" value={planProfileCapacity} onChange={event => setPlanProfileCapacity(event.target.value === '' ? '' : Number(event.target.value))} placeholder={`${detailedService.settings.profileCapacity || 1}`} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>}
                {detailedService.settings.usesAccounts && <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Account capacity (optional)</span><input type="number" min="1" step="1" value={planAccountCapacity} onChange={event => setPlanAccountCapacity(event.target.value === '' ? '' : Number(event.target.value))} placeholder="No plan-specific limit" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>}
              </div>
            )}
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Renewal Settings</p>
              <label className="flex min-h-10 items-center justify-between gap-3"><span>Renewal Enabled</span><input type="checkbox" checked={planRenewalEnabled} onChange={event => setPlanRenewalEnabled(event.target.checked)} className="h-4 w-4 accent-emerald-600" /></label>
              {planRenewalEnabled && <label className="flex min-h-10 items-center justify-between gap-3"><span>Renewal Reminder</span><input type="checkbox" checked={planReminderEnabled} onChange={event => setPlanReminderEnabled(event.target.checked)} className="h-4 w-4 accent-emerald-600" /></label>}
              {planRenewalEnabled && planReminderEnabled && <label className="block max-w-xs space-y-1.5"><span>Reminder days before expiry</span><select value={planReminderDays} onChange={event => setPlanReminderDays(Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{[3, 5, 7, 14, 30].map(days => <option key={days} value={days}>{days} days</option>)}</select></label>}
            </div>
            <label className="block max-w-xs space-y-1.5"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sort Order</span><input type="number" value={planSortOrder} onChange={event => setPlanSortOrder(Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            {planFormError && <p role="alert" className="text-sm text-rose-600">{planFormError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                Save Plan
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. SAFE DELETION / ARCHIVAL CONFIRMATION DIALOG */}
      {serviceToDelete && (
        <Modal
          isOpen={!!serviceToDelete}
          onClose={() => setServiceToDelete(null)}
          title="Delete Service"
          maxWidth="md"
        >
          {(() => {
            const relAccs = accounts.filter(a => a.serviceId === serviceToDelete.id);
            const relSubs = subscriptions.filter(s => s.serviceId === serviceToDelete.id);
            const relSales = sales.filter(s => s.serviceId === serviceToDelete.id);
            const relInvoices = invoices.filter(invoice => invoice.serviceId === serviceToDelete.id);
            const hasHistory = relAccs.length > 0 || relSubs.length > 0 || relSales.length > 0 || relInvoices.length > 0;

            return (
              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      {serviceToDelete.name} ({serviceToDelete.category})
                    </p>
                    {hasHistory ? (
                      <p className="leading-relaxed">
                        {language === 'bn'
                          ? `এই সার্ভিসের সাথে ${relAccs.length} টি অ্যাকাউন্ট ইনভেন্টরি, ${relSubs.length} টি সাবস্ক্রিপশন এবং ${relSales.length} টি বিক্রয় রেকর্ড যুক্ত রয়েছে। দোকানের হিসেব সুরক্ষিত রাখতে সার্ভিসটিকে স্থায়ীভাবে মুছে ফেলার পরিবর্তে নিরাপদে আর্কাইভ করা হবে।`
                          : 'This service is already in use, so it cannot be deleted. You can deactivate it instead.'}
                      </p>
                    ) : (
                      <p className="leading-relaxed">
                        {language === 'bn'
                          ? 'এই সার্ভিসের সাথে কোনো অ্যাকাউন্ট, সাবস্ক্রিপশন বা বিক্রয় রেকর্ড যুক্ত নেই। আপনি কি নিশ্চিত যে আপনি এটি ফায়ারস্টোর থেকে স্থায়ীভাবে মুছে ফেলতে চান?'
                          : 'Are you sure you want to delete this service?'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setServiceToDelete(null)}
                    className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    {t('cancel')}
                  </button>

                  {hasHistory ? (
                    <button
                      type="button"
                      onClick={() => {
                        void toggleServiceStatus(serviceToDelete);
                        setServiceToDelete(null);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Deactivate instead</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(true)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'স্থায়ীভাবে মুছে ফেলুন' : 'Permanently Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
