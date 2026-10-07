import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Calendar,
  DollarSign,
  Plus,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  MessageCircle,
  Phone,
  Mail,
  Lock,
  Unlock,
  User,
  Tv,
  Sparkles,
  Layers,
  ShieldCheck,
  Check,
  X,
  Zap,
  Edit3,
  Trash2,
  XCircle,
  FileText,
  TrendingUp,
  Receipt,
  UserCheck,
  History,
  Activity,
  Hash,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import {
  Subscription,
  SubscriptionStatus,
  PaymentMethod,
  PaymentStatus,
  AppCurrency,
  Customer,
  Service,
  Account,
  AccountProfile,
} from '../../types';
import {
  formatAppDate,
  formatAppDateTime,
  formatCurrency,
  getExpiryBadgeInfo,
  getSubscriptionStatus,
  calculateExpiryDate,
  getDaysDifference,
  getTodayDateString,
  getSubscriptionReminderDays,
} from '../../utils/dateUtils';
import { getCustomerDisplayName, resolveSubscriptionCustomer } from '../../utils/relationships';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { getExpiryWhatsAppTemplateId } from '../../utils/whatsappService';
import { createRecordId } from '../../services/localStorageStore';
import { InvoiceSaleDetails } from '../../utils/invoiceGenerator';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { getSaleDueAmount, getSalePaidAmount, getSalePaymentStatus } from '../../utils/saleUtils';
import { getDefaultPaymentMethod, normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../../utils/paymentMethods';
import { getAccountCapacity, getAvailableProfiles, isAccountOperational } from '../../utils/resourceManagement';
import { normalizePhoneDigits, normalizeSearchText } from '../../services/globalSearch';
import { downloadCSV } from '../../utils/csvParser';

interface SubscriptionsViewProps {
  onOpenNewSale: (customerId?: string, serviceId?: string) => void;
  serviceFilterId?: string;
  renewTargetSub?: Subscription | null;
  onClearRenewTarget?: () => void;
  onNavigateSection?: (section: string, targetId?: string) => void;
  focusSubscriptionId?: string;
  onFocusedSubscriptionHandled?: () => void;
  onAddPaymentForCustomer?: (customerId: string) => void;
}

type QuickExpiryFilter = 'all' | 'today' | '3days' | '7days' | '15days' | 'expired';

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  onOpenNewSale,
  serviceFilterId,
  renewTargetSub,
  onClearRenewTarget,
  onNavigateSection,
  focusSubscriptionId,
  onFocusedSubscriptionHandled,
  onAddPaymentForCustomer,
}) => {
  const {
    subscriptions,
    customers,
    services,
    accounts,
    sales,
    payments,
    invoices,
    activityLogs,
    reminders,
    completeReminder,
    snoozeReminder,
    updateSubscription,
    createSale,
    assignCustomerToProfile,
    logActivity,
    settings,
    ensureInvoiceForSale,
    currency,
    t,
    language,
    currentUser,
  } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'cancelled'>('all');
  const [quickExpiry, setQuickExpiry] = useState<QuickExpiryFilter>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'pending' | 'partial' | 'failed' | 'due'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'BDT' | 'USD'>('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [dateFilterField, setDateFilterField] = useState<'startDate' | 'expiryDate'>('expiryDate');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'assigned' | 'unassigned' | 'expiring'>('all');
  const [sortBy, setSortBy] = useState<'expiring' | 'newest' | 'oldest' | 'renewed' | 'highest' | 'lowest' | 'customer' | 'service'>('expiring');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  useEffect(() => {
    if (serviceFilterId) setServiceFilter(serviceFilterId);
  }, [serviceFilterId]);

  // Selected Subscription State (defaults to renew target if passed, else first sub)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(renewTargetSub?.id || null);

  // Mobile Navigation (List vs Detail)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Security credentials reveal state (masked by default)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<InvoiceSaleDetails | null>(null);

  // Dropdown menus
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Drawers & Modals
  const [isRenewDrawerOpen, setIsRenewDrawerOpen] = useState<boolean>(false);
  const [renewDuration, setRenewDuration] = useState<number>(30);
  const [renewPrice, setRenewPrice] = useState<number>(350);
  const [renewCurrency, setRenewCurrency] = useState<AppCurrency>(currency);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<PaymentMethod>('bKash');
  const [renewTrxId, setRenewTrxId] = useState<string>('');
  const [renewPlanId, setRenewPlanId] = useState('');
  const [renewAccountId, setRenewAccountId] = useState('');
  const [renewProfileId, setRenewProfileId] = useState('');
  const [renewStartDate, setRenewStartDate] = useState(getTodayDateString());
  const [renewDiscount, setRenewDiscount] = useState(0);
  const [renewPaymentStatus, setRenewPaymentStatus] = useState<PaymentStatus>('paid');
  const [renewAmountPaid, setRenewAmountPaid] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);
  const renewalOperationId = useRef('');

  const [isNewSubDrawerOpen, setIsNewSubDrawerOpen] = useState<boolean>(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState<boolean>(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState<boolean>(false);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [cancellationDate, setCancellationDate] = useState(getTodayDateString());
  const [isChangeProfileDrawerOpen, setIsChangeProfileDrawerOpen] = useState<boolean>(false);

  // Safe Edit Form State
  const [editPlan, setEditPlan] = useState<string>('');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number>(30);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCurrency, setEditCurrency] = useState<AppCurrency>(currency);
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('paid');
  const [editNotes, setEditNotes] = useState<string>('');

  // + New Subscription Form State (Progressive Disclosure)
  const [newSubCustomerId, setNewSubCustomerId] = useState<string>('');
  const [newSubServiceId, setNewSubServiceId] = useState<string>('');
  const [newSubPlan, setNewSubPlan] = useState<string>('');
  const [newSubAccountId, setNewSubAccountId] = useState<string>('');
  const [newSubProfileId, setNewSubProfileId] = useState<string>('');
  const [newSubDuration, setNewSubDuration] = useState<number>(30);
  const [newSubStartDate, setNewSubStartDate] = useState<string>(getTodayDateString());
  const [newSubPrice, setNewSubPrice] = useState<number>(350);
  const [newSubCurrency, setNewSubCurrency] = useState<AppCurrency>(currency);
  const [newSubPaymentMethod, setNewSubPaymentMethod] = useState<PaymentMethod>('bKash');
  const [newSubPaymentStatus, setNewSubPaymentStatus] = useState<PaymentStatus>('paid');
  const [newSubTrxId, setNewSubTrxId] = useState<string>('');
  const [newSubNotes, setNewSubNotes] = useState<string>('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 180);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  // Handle outside click for "More" menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // When renewTargetSub changes from outside (e.g. Dashboard shortcut)
  useEffect(() => {
    if (renewTargetSub) {
      setSelectedSubId(renewTargetSub.id);
      openRenewDrawer(renewTargetSub);
      setMobileView('detail');
    }
  }, [renewTargetSub]);

  useEffect(() => {
    if (focusSubscriptionId && subscriptions.some(sub => sub.id === focusSubscriptionId)) {
      setSelectedSubId(focusSubscriptionId);
      setMobileView('detail');
      onFocusedSubscriptionHandled?.();
    }
  }, [focusSubscriptionId, subscriptions, onFocusedSubscriptionHandled]);

  // Mask credentials helper
  const copyToClipboard = (text: string, keyName: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast(`${label} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const subscriptionRows = useMemo(() => {
    const customerById = new Map(customers.map(customer => [customer.id, customer]));
    const serviceById = new Map(services.map(service => [service.id, service]));
    const accountById = new Map(accounts.map(account => [account.id, account]));
    const saleBySubscriptionId = new Map<string, typeof sales[number]>();
    const saleById = new Map(sales.map(sale => [sale.id, sale]));
    sales.forEach(sale => {
      if (sale.subscriptionId) saleBySubscriptionId.set(sale.subscriptionId, sale);
    });
    const paymentBySaleId = new Map<string, typeof payments>();
    const paymentBySubscriptionId = new Map<string, typeof payments>();
    payments.forEach(payment => {
      if (payment.saleId) {
        const related = paymentBySaleId.get(payment.saleId) || [];
        related.push(payment);
        paymentBySaleId.set(payment.saleId, related);
      } else if (payment.subscriptionId) {
        const related = paymentBySubscriptionId.get(payment.subscriptionId) || [];
        related.push(payment);
        paymentBySubscriptionId.set(payment.subscriptionId, related);
      }
    });
    const statusRows = subscriptions.map(subscription => {
      const customer = customerById.get(subscription.customerId);
      const service = serviceById.get(subscription.serviceId);
      const account = subscription.accountId ? accountById.get(subscription.accountId) : undefined;
      const profile = account?.profiles.find(item => item.id === subscription.profileId);
      const sale = (subscription.saleId ? saleById.get(subscription.saleId) : undefined)
        || saleBySubscriptionId.get(subscription.id);
      const relatedPayments = sale
        ? [...(paymentBySaleId.get(sale.id) || []), ...(paymentBySubscriptionId.get(subscription.id) || [])]
        : [];
      const paymentStatus = sale
        ? getSalePaymentStatus(sale, relatedPayments)
        : subscription.paymentStatus;
      const paid = sale ? getSalePaidAmount(sale, relatedPayments)
        : paymentStatus === 'paid' ? subscription.price : 0;
      const due = sale ? getSaleDueAmount(sale, relatedPayments)
        : Math.max(0, subscription.price - paid);
      const status = getSubscriptionStatus(
        subscription,
        service,
        settings.reminderNoticeDays
      );
      return { subscription, customer, service, account, profile, sale, paymentStatus, paid, due, status };
    });
    const query = normalizeSearchText(debouncedSearchQuery);
    const queryDigits = normalizePhoneDigits(debouncedSearchQuery);

    return statusRows.filter(row => {
      const { subscription: sub, customer, service, account, profile, status } = row;
      const daysDiff = getDaysDifference(sub.expiryDate);
      const reminderDays = getSubscriptionReminderDays(service, sub.planId, settings.reminderNoticeDays);
      const textFields = [
        sub.id, customer?.name || '', customer?.phone || '', customer?.whatsapp || '',
        customer?.email || '', service?.name || '', sub.plan, account?.name || '',
        account?.email || '', profile?.profileName || '',
      ];
      const matchesText = !query || textFields.some(value => normalizeSearchText(value).includes(query))
        || (queryDigits.length >= 3 && [customer?.phone, customer?.whatsapp].some(value =>
          value && normalizePhoneDigits(value).includes(queryDigits)));
      const matchesQuickExpiry = quickExpiry === 'all'
        || (quickExpiry === 'today' && status !== 'cancelled' && daysDiff === 0)
        || (quickExpiry === '3days' && status !== 'cancelled' && daysDiff >= 0 && daysDiff <= 3)
        || (quickExpiry === '7days' && status !== 'cancelled' && daysDiff >= 0 && daysDiff <= 7)
        || (quickExpiry === '15days' && status !== 'cancelled' && daysDiff >= 0 && daysDiff <= 15)
        || (quickExpiry === 'expired' && status === 'expired');
      const matchesResource = resourceFilter === 'all'
        || (resourceFilter === 'assigned' && Boolean(sub.accountId || sub.profileId))
        || (resourceFilter === 'unassigned' && !sub.accountId && !sub.profileId)
        || (resourceFilter === 'expiring' && Boolean(
          (account?.expiryDate && getDaysDifference(account.expiryDate) >= 0 && getDaysDifference(account.expiryDate) <= reminderDays)
          || (profile?.expiryDate && getDaysDifference(profile.expiryDate) >= 0 && getDaysDifference(profile.expiryDate) <= reminderDays)
        ));
      const paymentMatches = paymentStatusFilter === 'all'
        || row.paymentStatus === paymentStatusFilter
        || (paymentStatusFilter === 'due' && row.due > 0 && row.paymentStatus !== 'failed');
      const filterDate = sub[dateFilterField];
      return (!query || matchesText)
        && (statusFilter === 'all' || status === statusFilter)
        && matchesQuickExpiry
        && (serviceFilter === 'all' || sub.serviceId === serviceFilter)
        && (planFilter === 'all' || sub.planId === planFilter)
        && paymentMatches
        && (currencyFilter === 'all' || sub.currency === currencyFilter)
        && (customerFilter === 'all' || sub.customerId === customerFilter)
        && matchesResource
        && (!startDateFilter || filterDate >= startDateFilter)
        && (!endDateFilter || filterDate <= endDateFilter);
    }).sort((left, right) => {
      const a = left.subscription;
      const b = right.subscription;
      if (sortBy === 'newest') return (b.createdAt || b.startDate).localeCompare(a.createdAt || a.startDate);
      if (sortBy === 'oldest') return (a.createdAt || a.startDate).localeCompare(b.createdAt || b.startDate);
      if (sortBy === 'renewed') return (b.createdAt || '').localeCompare(a.createdAt || '');
      if (sortBy === 'highest') return (right.sale?.amount ?? b.price) - (left.sale?.amount ?? a.price);
      if (sortBy === 'lowest') return (left.sale?.amount ?? a.price) - (right.sale?.amount ?? b.price);
      if (sortBy === 'customer') return (left.customer?.name || '').localeCompare(right.customer?.name || '');
      if (sortBy === 'service') return (left.service?.name || '').localeCompare(right.service?.name || '');
      const statusRank: Record<SubscriptionStatus, number> = { expiring_soon: 0, active: 1, expired: 2, cancelled: 3 };
      const rankDifference = statusRank[left.status] - statusRank[right.status];
      if (rankDifference) return rankDifference;
      const daysDifference = getDaysDifference(a.expiryDate) - getDaysDifference(b.expiryDate);
      return left.status === 'expired' ? -daysDifference : daysDifference;
    });
  }, [
    subscriptions, customers, services, accounts, sales, payments, debouncedSearchQuery,
    statusFilter, quickExpiry, serviceFilter, planFilter, paymentStatusFilter, currencyFilter,
    startDateFilter, endDateFilter, dateFilterField, customerFilter, resourceFilter, sortBy,
    settings.reminderNoticeDays,
  ]);
  const subscriptionRowById = useMemo(() => new Map(subscriptionRows.map(row => [row.subscription.id, row])), [subscriptionRows]);
  const filteredSubscriptions = useMemo(() => subscriptionRows.map(row => row.subscription), [subscriptionRows]);
  const visibleSubscriptions = useMemo(
    () => filteredSubscriptions.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredSubscriptions, currentPage]
  );
  const totalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchQuery, statusFilter, quickExpiry, serviceFilter, planFilter,
    paymentStatusFilter, currencyFilter, startDateFilter, endDateFilter,
    dateFilterField, customerFilter, resourceFilter, sortBy,
  ]);

  // Keep selectedSub valid or fallback to first
  useEffect(() => {
    if (filteredSubscriptions.length > 0) {
      if (!selectedSubId || !filteredSubscriptions.some(s => s.id === selectedSubId)) {
        setSelectedSubId(filteredSubscriptions[0].id);
      }
    } else {
      setSelectedSubId(null);
    }
  }, [filteredSubscriptions, selectedSubId]);

  // Selected subscription entity resolution
  const selectedSub = useMemo(() => {
    return subscriptions.find(s => s.id === selectedSubId) || null;
  }, [subscriptions, selectedSubId]);

  const selectedCustomer = useMemo(() => {
    if (!selectedSub) return null;
    return resolveSubscriptionCustomer(selectedSub, customers) || null;
  }, [selectedSub, customers]);

  const selectedService = useMemo(() => {
    if (!selectedSub) return null;
    return services.find(s => s.id === selectedSub.serviceId) || null;
  }, [selectedSub, services]);
  const selectedRequiresResource = Boolean(
    selectedService?.settings?.usesAccounts
    || selectedService?.settings?.usesProfiles
    || selectedService?.settings?.profileAssignmentRequired
  );

  const selectedAccount = useMemo(() => {
    if (!selectedSub || !selectedSub.accountId) return null;
    return accounts.find(a => a.id === selectedSub.accountId) || null;
  }, [selectedSub, accounts]);

  const selectedProfile = useMemo(() => {
    if (!selectedAccount || !selectedSub?.profileId) return null;
    return selectedAccount.profiles?.find(p => p.id === selectedSub.profileId) || null;
  }, [selectedAccount, selectedSub]);

  const selectedPayment = useMemo(() => {
    if (!selectedSub) return null;
    const linkedSaleIds = new Set(
      sales
        .filter(sale => sale.subscriptionId === selectedSub.id)
        .map(sale => sale.id)
    );
    return payments.find(payment =>
      payment.subscriptionId === selectedSub.id &&
      (!payment.customerId || payment.customerId === selectedSub.customerId)
    ) || payments.find(payment =>
      Boolean(payment.saleId && linkedSaleIds.has(payment.saleId)) &&
      (!payment.customerId || payment.customerId === selectedSub.customerId)
    ) || null;
  }, [selectedSub, payments, sales]);

  const selectedSale = useMemo(() => {
    if (!selectedSub) return null;
    return sales.find(sale => sale.id === selectedSub.saleId)
      || sales.find(sale => sale.subscriptionId === selectedSub.id)
      || null;
  }, [selectedSub, sales]);

  const selectedInvoice = useMemo(() => {
    if (!selectedSub) return null;
    return invoices.find(invoice => invoice.saleId === selectedSale?.id)
      || invoices.find(invoice => invoice.subscriptionId === selectedSub.id)
      || null;
  }, [invoices, selectedSale, selectedSub]);
  const selectedPaymentSummary = useMemo(() => {
    if (!selectedSub) return { total: 0, paid: 0, due: 0, status: 'pending' as PaymentStatus };
    if (!selectedSale) {
      const paid = selectedSub.paymentStatus === 'paid' ? selectedSub.price : 0;
      return {
        total: selectedSub.price,
        paid,
        due: Math.max(0, selectedSub.price - paid),
        status: selectedSub.paymentStatus,
      };
    }
    return {
      total: selectedSale.amount,
      paid: getSalePaidAmount(selectedSale, payments),
      due: getSaleDueAmount(selectedSale, payments),
      status: getSalePaymentStatus(selectedSale, payments),
    };
  }, [selectedSub, selectedSale, payments]);

  const handleOpenSelectedInvoice = () => {
    if (!selectedSale || !selectedSub) {
      showToast('This subscription does not have a linked sale invoice.', 'info');
      return;
    }
    const invoice = invoices.find(item => item.saleId === selectedSale.id)
      || invoices.find(item => item.subscriptionId === selectedSub.id)
      || ensureInvoiceForSale(selectedSale.id);
    setSelectedInvoiceData(buildInvoiceSaleDetails(
      invoice,
      selectedSale,
      customers.find(customer => customer.id === invoice.customerId),
      services.find(service => service.id === invoice.serviceId),
      payments,
      settings,
      selectedSub
    ));
  };

  const renewalHistoryRows = useMemo(() => {
    if (!selectedSub) return [];
    return subscriptions.flatMap(subscription => subscription.renewalHistory || [])
      .filter(renewal => renewal.subscriptionId === selectedSub.id)
      .sort((left, right) => right.renewalDate.localeCompare(left.renewalDate));
  }, [selectedSub, subscriptions]);

  // Activity logs associated with this subscription or customer/service relationship
  const subscriptionTimeline = useMemo(() => {
    if (!selectedSub) return [];
    return activityLogs
      .filter(log => log.subscriptionId === selectedSub.id || log.entityId === selectedSub.id)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, 8);
  }, [selectedSub, activityLogs]);

  // Dynamic status for selected subscription
  const selectedSubStatus = useMemo(() => {
    if (!selectedSub) return 'active';
    return getSubscriptionStatus(selectedSub, selectedService || undefined, settings.reminderNoticeDays);
  }, [selectedSub, selectedService, settings.reminderNoticeDays]);

  const selectedSubBadge = useMemo(() => {
    if (!selectedSub) return null;
    if (selectedSubStatus === 'cancelled') {
      return {
        status: 'cancelled' as const,
        label: language === 'bn' ? 'বাতিলকৃত' : 'Cancelled',
        shortLabel: language === 'bn' ? 'বাতিল' : 'Cancelled',
        colorClass: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        dotClass: 'bg-slate-400',
      };
    }
    return getExpiryBadgeInfo(
      selectedSub.expiryDate,
      language,
      getSubscriptionReminderDays(selectedService || undefined, selectedSub.planId, settings.reminderNoticeDays)
    );
  }, [selectedSub, selectedService, language, settings.reminderNoticeDays]);

  // Live Auto-calculated New Expiry Date for Renewal Drawer
  const previewNewExpiryDate = useMemo(() => {
    if (!selectedSub) return '';
    const baseDate =
      getDaysDifference(selectedSub.expiryDate) >= 0
        ? calculateExpiryDate(selectedSub.expiryDate, 1)
        : getTodayDateString();
    return calculateExpiryDate(renewStartDate || baseDate, Number(renewDuration) || 30);
  }, [selectedSub, renewDuration, renewStartDate]);

  const renewalPlanOptions = selectedService?.planDetails?.filter(plan => plan.status === 'active') || [];
  const renewalRequiresProfile = selectedService?.settings?.usesProfiles === true
    || selectedService?.settings?.profileAssignmentRequired === true;
  const renewalAccountOptions = accounts.filter(account =>
    account.serviceId === selectedSub?.serviceId
    && (!account.planId || account.planId === renewPlanId)
    && isAccountOperational(account)
    && (account.id === selectedSub?.accountId
      || (!renewalRequiresProfile || (getAccountCapacity(account).available > 0
        && getAvailableProfiles([account], selectedSub?.serviceId, renewPlanId).length > 0)))
  );
  const renewalSelectedAccount = renewalAccountOptions.find(account => account.id === renewAccountId);
  const renewalProfileOptions = renewalSelectedAccount?.profiles.filter(profile =>
    (profile.status === 'Available' && !profile.assignedCustomerId
      || profile.id === selectedSub?.profileId && profile.assignedCustomerId === selectedSub?.customerId)
    && (!profile.expiryDate || getDaysDifference(profile.expiryDate) >= 0)
  ) || [];
  const renewalSelectedPlan = renewalPlanOptions.find(plan => plan.id === renewPlanId);
  const renewalPaymentMethodConfigs = normalizePaymentMethods(settings.paymentPreferences?.methods);
  const renewalPaymentMethods: PaymentMethod[] = renewalPaymentMethodConfigs.filter(method => method.enabled).map(method => method.name as PaymentMethod);
  const renewalCurrentProfile = accounts.find(account => account.id === selectedSub?.accountId)
    ?.profiles.find(profile => profile.id === selectedSub?.profileId);
  const renewalCurrentFulfillmentUnavailable = Boolean(selectedSub?.accountId && (
    !accounts.some(account => account.id === selectedSub.accountId && isAccountOperational(account))
    || (selectedSub.profileId && !renewalCurrentProfile)
    || (renewalCurrentProfile && renewalCurrentProfile.status !== 'Available' && renewalCurrentProfile.assignedCustomerId !== selectedSub.customerId)
    || (renewalCurrentProfile?.expiryDate && getDaysDifference(renewalCurrentProfile.expiryDate) < 0)
  ));
  const renewalCurrentProfileUnavailable = Boolean(selectedSub?.profileId && (
    !renewalCurrentProfile
    || (renewalCurrentProfile.status !== 'Available' && renewalCurrentProfile.assignedCustomerId !== selectedSub.customerId)
    || (renewalCurrentProfile.expiryDate && getDaysDifference(renewalCurrentProfile.expiryDate) < 0)
  ));
  const renewalTotal = Math.max(0, Number(renewPrice || 0) - Number(renewDiscount || 0));
  const renewalPaid = renewPaymentStatus === 'paid'
    ? renewalTotal
    : renewPaymentStatus === 'partial'
      ? Number(renewAmountPaid || 0)
      : 0;
  const renewalDue = Math.max(0, renewalTotal - renewalPaid);

  // Open Renewal Drawer
  const openRenewDrawer = (sub: Subscription) => {
    setSelectedSubId(sub.id);
    const service = services.find(item => item.id === sub.serviceId);
    const plan = service?.planDetails?.find(item => item.id === sub.planId)
      || service?.planDetails?.find(item => item.name === sub.plan && item.status === 'active');
    const nextStartDate = getDaysDifference(sub.expiryDate) >= 0
      ? calculateExpiryDate(sub.expiryDate, 1)
      : getTodayDateString();
    const account = accounts.find(item => item.id === sub.accountId);
    const profile = account?.profiles.find(item => item.id === sub.profileId);
    const currentInventoryAvailable = Boolean(account
      && isAccountOperational(account)
      && profile
      && (profile.status === 'Available' || profile.assignedCustomerId === sub.customerId)
      && (!profile.expiryDate || getDaysDifference(profile.expiryDate) >= 0));
    setRenewPlanId(plan?.id || '');
    setRenewDuration(plan?.durationDays || sub.durationDays || 30);
    setRenewPrice(plan?.price ?? sub.price ?? 0);
    setRenewCurrency(plan?.currency || sub.currency || currency);
    setRenewAccountId(currentInventoryAvailable ? account?.id || '' : '');
    setRenewProfileId(currentInventoryAvailable ? profile?.id || '' : '');
    setRenewStartDate(nextStartDate);
    setRenewDiscount(0);
    setRenewPaymentMethod((getDefaultPaymentMethod(renewalPaymentMethodConfigs, settings.paymentPreferences?.defaultMethodId) || 'bKash') as PaymentMethod);
    setRenewTrxId('');
    setRenewPaymentStatus('paid');
    setRenewAmountPaid('');
    renewalOperationId.current = createRecordId('renewal-operation');
    setIsRenewDrawerOpen(true);
    setIsMoreMenuOpen(false);
  };

  // Execute Renewal
  const handleExecuteRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || isRenewing) return;
    const service = services.find(item => item.id === selectedSub.serviceId);
    const customer = customers.find(item => item.id === selectedSub.customerId);
    const selectedPlan = service?.planDetails?.find(item => item.id === renewPlanId && item.status === 'active');
    const chosenAccount = accounts.find(item => item.id === renewAccountId
      && item.serviceId === selectedSub.serviceId
      && isAccountOperational(item)
      && (item.id === selectedSub.accountId || getAccountCapacity(item).available > 0));
    const chosenProfile = chosenAccount?.profiles.find(item => item.id === renewProfileId
      && (item.status === 'Available' && !item.assignedCustomerId
        || item.id === selectedSub.profileId && item.assignedCustomerId === selectedSub.customerId)
      && (!item.expiryDate || getDaysDifference(item.expiryDate) >= 0));
    const requiresAccount = service?.settings?.usesAccounts === true
      || service?.settings?.usesProfiles === true
      || service?.settings?.profileAssignmentRequired === true;
    const requiresProfile = service?.settings?.usesProfiles === true || service?.settings?.profileAssignmentRequired === true;
    const subtotal = Number(renewPrice);
    const total = Math.max(0, subtotal - Number(renewDiscount || 0));
    const amountPaid = renewPaymentStatus === 'paid' ? total
      : renewPaymentStatus === 'partial' ? Number(renewAmountPaid || 0) : 0;

    if (!service || !customer || getSubscriptionStatus(selectedSub, service, settings.reminderNoticeDays) === 'cancelled'
      || service.status !== 'active' || service.isArchived
      || service.settings?.subscriptionEnabled === false
      || service.settings?.renewalEnabled === false || service.settings?.allowRenewal === false
      || !selectedPlan
      || Number(renewDuration) !== selectedPlan.durationDays
      || Number(renewPrice) !== selectedPlan.price
      || renewCurrency !== selectedPlan.currency
      || !renewalOperationId.current
      || !Number.isSafeInteger(renewDuration) || renewDuration < 1
      || !Number.isFinite(subtotal) || subtotal <= 0
      || !Number.isFinite(renewDiscount) || renewDiscount < 0 || renewDiscount >= subtotal
      || total <= 0 || !renewStartDate || !Number.isFinite(Date.parse(`${renewStartDate}T00:00:00`))
      || (requiresAccount && !chosenAccount)
      || (requiresProfile && !chosenProfile)
      || (renewAccountId && !chosenAccount)
      || (renewProfileId && !chosenProfile)
      || (renewPaymentStatus === 'partial' && !(amountPaid > 0 && amountPaid < total))
      || renewPaymentStatus === 'failed'
      || !renewalPaymentMethods.includes(renewPaymentMethod)
      || (paymentMethodRequiresTransactionId(renewPaymentMethod, renewalPaymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) && !renewTrxId.trim())
      || amountPaid > total) {
      showToast('Renewal could not be completed. Check the plan, account, profile, dates, and payment details.', 'error');
      return;
    }

    setIsRenewing(true);
    try {
      const renewal = createSale({
        customerId: selectedSub.customerId,
        serviceId: selectedSub.serviceId,
        plan: selectedPlan?.name || selectedSub.plan,
        planId: selectedPlan?.id,
        accountId: renewAccountId || undefined,
        profileId: renewProfileId || undefined,
        startDate: renewStartDate,
        durationDays: Number(renewDuration),
        subtotal,
        discount: Number(renewDiscount),
        price: total,
        amountPaid,
        currency: renewCurrency,
        paymentMethod: renewPaymentMethod,
        paymentStatus: renewPaymentStatus,
        transactionId: renewTrxId.trim() || undefined,
        renewalOfSubscriptionId: selectedSub.id,
        operationId: renewalOperationId.current,
      });
      let previousProfileReleaseFailed = false;
      if (selectedSub.accountId && selectedSub.profileId
        && (selectedSub.accountId !== (renewAccountId || undefined) || selectedSub.profileId !== (renewProfileId || undefined))) {
        try {
          assignCustomerToProfile(selectedSub.accountId, selectedSub.profileId, undefined);
        } catch (error) {
          console.error('Could not release the previous profile after renewal', error);
          previousProfileReleaseFailed = true;
        }
      }
      const renewalRecord = {
        id: renewalOperationId.current,
        renewalDate: getTodayDateString(),
        previousEndDate: selectedSub.expiryDate,
        newStartDate: renewal.subscription.startDate,
        newEndDate: renewal.subscription.expiryDate,
        plan: renewal.subscription.plan,
        planId: renewal.subscription.planId,
        amount: renewal.sale.amount,
        amountPaid: renewal.payment.amount,
        amountDue: Math.max(0, renewal.sale.amount - renewal.payment.amount),
        currency: renewal.sale.currency,
        paymentStatus: renewal.payment.paymentStatus,
        saleId: renewal.sale.id,
        paymentId: renewal.payment.id,
        subscriptionId: renewal.subscription.id,
      };
      if (!selectedSub.renewalHistory?.some(item => item.id === renewalRecord.id)) {
        updateSubscription(selectedSub.id, {
          renewalHistory: [...(selectedSub.renewalHistory || []), renewalRecord],
        });
      }
      setSelectedSubId(renewal.subscription.id);
      setMobileView('detail');
      setIsRenewDrawerOpen(false);
      if (onClearRenewTarget) onClearRenewTarget();
      showToast(
        previousProfileReleaseFailed
          ? 'Renewal completed, but the previous profile could not be released.'
          : 'Renewal completed successfully.',
        previousProfileReleaseFailed ? 'error' : 'success'
      );
    } catch (error) {
      console.error('Subscription renewal failed', error);
      showToast('Renewal could not be completed. Please try again.', 'error');
    } finally {
      setIsRenewing(false);
    }
  };

  // Open Edit Drawer
  const openEditDrawer = (sub: Subscription) => {
    setSelectedSubId(sub.id);
    setEditPlan(sub.plan);
    setEditStartDate(sub.startDate);
    setEditDuration(sub.durationDays || 30);
    setEditPrice(sub.price || 0);
    setEditCurrency(sub.currency || currency);
    setEditPaymentStatus(sub.paymentStatus || 'paid');
    setEditNotes(sub.notes || '');
    setIsEditDrawerOpen(true);
    setIsMoreMenuOpen(false);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    const newExpiry = calculateExpiryDate(editStartDate, Number(editDuration));
    updateSubscription(selectedSub.id, {
      plan: editPlan.trim(),
      startDate: editStartDate,
      durationDays: Number(editDuration),
      expiryDate: newExpiry,
      price: Number(editPrice),
      currency: editCurrency,
      paymentStatus: editPaymentStatus,
      notes: editNotes.trim(),
    });

    showToast(
      language === 'bn' ? 'সাবস্ক্রিপশন সফলভাবে আপডেট হয়েছে।' : 'Subscription details updated successfully.',
      'success'
    );
    setIsEditDrawerOpen(false);
  };

  // Cancel Subscription Workflow (preserves history, logs status)
  const handleConfirmCancel = () => {
    if (!selectedSub) return;
    if (!cancellationReason.trim()) {
      showToast('Enter a cancellation reason before continuing.', 'error');
      return;
    }
    if (cancellationDate && !Number.isFinite(Date.parse(`${cancellationDate}T00:00:00`))) {
      showToast('Choose a valid cancellation date.', 'error');
      return;
    }
    updateSubscription(selectedSub.id, {
      status: 'cancelled',
      cancelledAt: cancellationDate ? `${cancellationDate}T00:00:00` : new Date().toISOString(),
      cancelledBy: currentUser?.uid || 'admin',
      cancellationReason: cancellationReason.trim(),
    });

    showToast(
      language === 'bn' ? 'সাবস্ক্রিপশন বাতিল হিসেবে চিহ্নিত হয়েছে।' : 'Subscription marked as cancelled.',
      'info'
    );
    setIsCancelDialogOpen(false);
    setCancellationReason('');
    setIsMoreMenuOpen(false);
  };

  // WhatsApp Reminder message
  const handleSendWhatsAppReminder = (sub: Subscription) => {
    const cust = resolveSubscriptionCustomer(sub, customers);
    if (!cust || !canContact(cust.id)) {
      showToast('Unable to open WhatsApp. Check that this customer has a valid phone number.', 'error');
      return;
    }
    openMessage({ customerId: cust.id, subscriptionId: sub.id, templateId: getExpiryWhatsAppTemplateId(getDaysDifference(sub.expiryDate)) });
  };

  // Change Profile Slot
  const handleChangeProfile = (targetProfileId: string) => {
    if (!selectedSub || !selectedAccount) return;
    const targetProfile = selectedAccount.profiles?.find(p => p.id === targetProfileId);
    if (!targetProfile) return;

    // Check if slot is assigned to someone else
    if (targetProfile.status === 'Assigned' && targetProfile.assignedCustomerId !== selectedSub.customerId) {
      showToast('This profile slot is already assigned to another customer.', 'error');
      return;
    }

    // Reassign
    assignCustomerToProfile(selectedAccount.id, targetProfileId, selectedSub.customerId);
    updateSubscription(selectedSub.id, {
      profileId: targetProfileId,
    });

    showToast(`Profile switched to "${targetProfile.profileName}".`, 'success');
    setIsChangeProfileDrawerOpen(false);
  };

  // + New Subscription Workflow with Progressive Disclosure & Smart Validation
  const handleOpenNewSubDrawer = () => {
    setNewSubCustomerId(customers[0]?.id || '');
    setNewSubServiceId(services[0]?.id || '');
    setNewSubPlan(services[0]?.plans[0] || 'Standard');
    setNewSubAccountId('');
    setNewSubProfileId('');
    setNewSubDuration(30);
    setNewSubStartDate(getTodayDateString());
    setNewSubPrice(services[0]?.defaultPriceBDT || 350);
    setNewSubCurrency(currency);
    setNewSubPaymentMethod('bKash');
    setNewSubPaymentStatus('paid');
    setNewSubTrxId('');
    setNewSubNotes('');
    setIsNewSubDrawerOpen(true);
  };

  // Update plans & accounts when service changes in New Sub Drawer
  const availableAccountsForNewSub = useMemo(() => {
    if (!newSubServiceId) return [];
    return accounts.filter(a => a.serviceId === newSubServiceId && a.status !== 'Expired' && a.status !== 'Suspended');
  }, [newSubServiceId, accounts]);

  const availableProfilesForNewSub = useMemo(() => {
    if (!newSubAccountId) return [];
    const acc = accounts.find(a => a.id === newSubAccountId);
    if (!acc || !acc.profiles) return [];
    return acc.profiles;
  }, [newSubAccountId, accounts]);

  // Execute New Subscription Creation
  const handleCreateNewSubscription = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Smart Validation
    if (!newSubCustomerId) {
      showToast('Please select a valid customer.', 'error');
      return;
    }
    const custExists = customers.some(c => c.id === newSubCustomerId);
    if (!custExists) {
      showToast('Selected customer does not exist.', 'error');
      return;
    }

    if (!newSubServiceId) {
      showToast('Please select an active service.', 'error');
      return;
    }
    const srv = services.find(s => s.id === newSubServiceId);
    if (!srv || srv.isArchived) {
      showToast('Selected service is inactive or archived.', 'error');
      return;
    }

    if (newSubAccountId) {
      const acc = accounts.find(a => a.id === newSubAccountId);
      if (!acc) {
        showToast('Selected account could not be found.', 'error');
        return;
      }
      if (acc.serviceId !== newSubServiceId) {
        showToast('Selected account does not belong to this service.', 'error');
        return;
      }
      if (newSubProfileId) {
        const prof = acc.profiles?.find(p => p.id === newSubProfileId);
        if (!prof) {
          showToast('Selected profile slot is invalid.', 'error');
          return;
        }
        if (prof.status === 'Assigned' && prof.assignedCustomerId !== newSubCustomerId) {
          showToast('Selected profile is already assigned to another customer.', 'error');
          return;
        }
      }
    }

    // 2. Invoke full sale & subscription transaction
    const newRecord = createSale({
      customerId: newSubCustomerId,
      serviceId: newSubServiceId,
      plan: newSubPlan || 'Standard',
      accountId: newSubAccountId || undefined,
      profileId: newSubProfileId || undefined,
      startDate: newSubStartDate,
      durationDays: Number(newSubDuration) || 30,
      price: Number(newSubPrice) || 0,
      currency: newSubCurrency,
      paymentMethod: newSubPaymentMethod,
      paymentStatus: newSubPaymentStatus,
      transactionId: newSubTrxId.trim() || undefined,
      notes: newSubNotes.trim() || undefined,
    });

    showToast(
      language === 'bn' ? 'নতুন সাবস্ক্রিপশন সফলভাবে তৈরি হয়েছে!' : 'New subscription created successfully!',
      'success'
    );
    setIsNewSubDrawerOpen(false);
    setSelectedSubId(newRecord.subscription.id);
  };

  // Counts for status tabs
  const statusCounts = useMemo(() => {
    const serviceById = new Map(services.map(service => [service.id, service]));
    const counts = { all: subscriptions.length, active: 0, expiring: 0, expired: 0, cancelled: 0, renewalsDue: 0 };
    subscriptions.forEach(subscription => {
      const status = getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays);
      if (status === 'active') counts.active += 1;
      else if (status === 'expiring_soon') counts.expiring += 1;
      else if (status === 'expired') counts.expired += 1;
      else counts.cancelled += 1;
      const renewedThrough = subscription.renewalHistory?.reduce(
        (latest, renewal) => renewal.newEndDate > latest ? renewal.newEndDate : latest,
        subscription.expiryDate
      ) || subscription.expiryDate;
      if (status !== 'cancelled' && (status === 'expiring_soon' || status === 'expired')
        && getDaysDifference(renewedThrough) <= getSubscriptionReminderDays(
          serviceById.get(subscription.serviceId), subscription.planId, settings.reminderNoticeDays
        )) counts.renewalsDue += 1;
    });
    return counts;
  }, [subscriptions, services, settings.reminderNoticeDays]);

  const handleExportSubscriptions = () => {
    const rows = [
      ['Subscription ID', 'Customer', 'Phone', 'Service', 'Plan', 'Account', 'Profile', 'Start Date', 'Expiry Date', 'Status', 'Total', 'Paid', 'Due', 'Payment Status'],
      ...subscriptionRows.map(({ subscription, customer, service, account, profile, sale, status, paid, due, paymentStatus }) => [
        subscription.id,
        customer?.name || '',
        customer?.phone || customer?.whatsapp || '',
        service?.name || '',
        subscription.plan,
        account?.name || account?.email || '',
        profile?.profileName || '',
        subscription.startDate,
        subscription.expiryDate,
        status,
        sale?.amount ?? subscription.price,
        paid,
        due,
        paymentStatus,
      ]),
    ];
    const content = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadCSV(`subscriptions-${getTodayDateString()}.csv`, content);
    logActivity({
      type: 'data_exported',
      title: 'Subscriptions Exported',
      description: `Exported ${subscriptionRows.length} subscription records to CSV.`,
      metadata: { entityType: 'subscriptions', count: subscriptionRows.length },
    });
    showToast(`Exported ${subscriptionRows.length} subscriptions.`, 'success');
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & ACTIONS                                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {language === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscriptions'}
            </h1>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
              {subscriptions.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            {language === 'bn'
              ? 'সাবস্ক্রিপশন, রিনিউয়াল এবং মেয়াদ শেষের তারিখ পরিচালনা করুন।'
              : 'Manage active plans, renewals, expiry dates and customer access.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onOpenNewSale()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{language === 'bn' ? '+ নতুন বিক্রয়' : '+ New Sale'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportSubscriptions}
            disabled={subscriptions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {selectedSub && canContact(selectedSub.customerId) && <button
            type="button"
            onClick={() => openMessage({
              customerId: selectedSub.customerId,
              subscriptionId: selectedSub.id,
              templateId: getExpiryWhatsAppTemplateId(getDaysDifference(selectedSub.expiryDate)),
            })}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp Reminder</span>
          </button>}
          {selectedSub && <button
            type="button"
            onClick={() => openRenewDrawer(selectedSub)}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Renew Subscription</span>
          </button>}
        </div>
      </div>

      <section aria-label="Subscription summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total Subscriptions', value: statusCounts.all },
          { label: 'Active', value: statusCounts.active },
          { label: 'Ending Soon', value: statusCounts.expiring },
          { label: 'Expired', value: statusCounts.expired },
          { label: 'Renewals Due', value: statusCounts.renewalsDue },
          { label: 'Cancelled', value: statusCounts.cancelled },
        ].map((item, index) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${index === 2 || index === 4 ? 'text-amber-600 dark:text-amber-400' : index === 3 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{item.value}</p>
          </div>
        ))}
      </section>

      {/* ========================================================================= */}
      {/* 2. SPLIT WORKSPACE: LEFT LIST BROWSER + RIGHT SELECTED WORKSPACE         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* ===================================================================== */}
        {/* LEFT PANEL: SUBSCRIPTION BROWSER (List view on mobile)                */}
        {/* ===================================================================== */}
        <div
          className={`md:col-span-5 lg:col-span-4 space-y-3.5 ${
            mobileView === 'detail' ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                language === 'bn'
                  ? 'গ্রাহক, ফোন, সার্ভিস, অ্যাকাউন্ট খুঁজুন...'
                  : 'Search subscriptions...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {[
              { id: 'all', label: 'All', count: statusCounts.all },
              { id: 'active', label: 'Active', count: statusCounts.active },
              { id: 'expiring_soon', label: 'Ending Soon', count: statusCounts.expiring },
              { id: 'expired', label: 'Expired', count: statusCounts.expired },
              { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 rounded-md ${
                    statusFilter === tab.id
                      ? 'bg-white/20 dark:bg-black/15 text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Expiry Filter Ribbon */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'bn' ? 'দ্রুত মেয়াদ ফিল্টার:' : 'Quick Expiry Window:'}</span>
              </span>
              {quickExpiry !== 'all' && (
                <button
                  type="button"
                  onClick={() => setQuickExpiry('all')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer text-[10px]"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px] font-bold">
              {[
                { id: 'today', label: 'Today' },
                { id: '3days', label: '3 Days' },
                { id: '7days', label: '7 Days' },
                { id: '15days', label: '15 Days' },
                { id: 'expired', label: 'Expired' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQuickExpiry(quickExpiry === opt.id ? 'all' : (opt.id as any))}
                  className={`py-1 rounded-md text-center transition-all cursor-pointer ${
                    quickExpiry === opt.id
                      ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Filter Row Toggle */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium text-[11px]"
            >
              <Filter className="w-3 h-3 text-slate-400" />
              <span>{showAdvancedFilters ? 'Hide Service & Payment Filters' : 'More Filters (Service, Payment, Currency)'}</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredSubscriptions.length} found
            </span>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span>Sort by</span>
            <select aria-label="Sort subscriptions" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <option value="expiring">Expiring soon</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="renewed">Recently renewed</option><option value="highest">Highest value</option><option value="lowest">Lowest value</option><option value="customer">Customer name</option><option value="service">Service name</option>
            </select>
          </label>

          {/* Collapsible Advanced Filters */}
          {showAdvancedFilters && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Service</label>
                  <select
                    value={serviceFilter}
                    onChange={e => setServiceFilter(e.target.value)}
                    className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Services</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Plan</label>
                  <select
                    value={planFilter}
                    onChange={e => setPlanFilter(e.target.value)}
                    className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Plans</option>
                    {services.flatMap(service => service.planDetails || []).map(plan => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Payment</label>
                  <select
                    value={paymentStatusFilter}
                    onChange={e => setPaymentStatusFilter(e.target.value as typeof paymentStatusFilter)}
                    className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Payment Status</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="failed">Failed</option>
                    <option value="due">Due</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Currency</label>
                  <select
                    value={currencyFilter}
                    onChange={e => setCurrencyFilter(e.target.value as any)}
                    className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Currencies</option>
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Date field</label>
                  <select aria-label="Subscription date filter field" value={dateFilterField} onChange={event => setDateFilterField(event.target.value as typeof dateFilterField)} className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    <option value="expiryDate">Expiry date</option><option value="startDate">Start date</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">From</label>
                  <input type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">To</label>
                  <input type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Customer</label>
                  <select value={customerFilter} onChange={event => setCustomerFilter(event.target.value)} className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    <option value="all">All customers</option>
                    {customers.filter(customer => !customer.isArchived).map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Resource</label>
                  <select value={resourceFilter} onChange={event => setResourceFilter(event.target.value as typeof resourceFilter)} className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    <option value="all">All resources</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option><option value="expiring">Resource expiring</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Subscription List Items */}
          <div className="space-y-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 scrollbar-thin">
            {filteredSubscriptions.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-400">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {subscriptions.length ? 'No matching subscriptions' : 'No subscriptions yet.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {subscriptions.length ? 'Try clearing search or relaxing filters' : 'Create a sale to start your first subscription.'}
                </p>
                {!subscriptions.length && <button type="button" onClick={() => onOpenNewSale()} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />New Sale</button>}
              </div>
            ) : (
              visibleSubscriptions.map(sub => {
                const row = subscriptionRowById.get(sub.id);
                const cust = row?.customer;
                const srv = row?.service;
                const isSelected = sub.id === selectedSubId;
                const isCancelled = row?.status === 'cancelled';
                const daysDiff = getDaysDifference(sub.expiryDate);
                const reminderDays = getSubscriptionReminderDays(srv, sub.planId, settings.reminderNoticeDays);
                const status = row?.status ?? getSubscriptionStatus(sub, srv, settings.reminderNoticeDays);
                const badge = isCancelled
                  ? {
                      status: 'cancelled',
                      shortLabel: 'Cancelled',
                      dotClass: 'bg-slate-400',
                      colorClass: 'text-slate-400 bg-slate-100 dark:bg-slate-800',
                    }
                  : getExpiryBadgeInfo(sub.expiryDate, language, reminderDays);

                const isNearExpiry = !isCancelled && (status === 'expiring_soon' || status === 'expired');

                return (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubId(sub.id);
                      setMobileView('detail');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/60 dark:border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                    }`}
                  >
                    {/* Left Accent indicator for active selection */}
                    {isSelected && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-r-md" />
                    )}

                    <div                     className="flex flex-wrap items-start justify-between gap-2">
                      {/* Customer & Service Header */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {getCustomerDisplayName(cust)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {cust?.phone || ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: srv?.color || '#10b981' }}
                          />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {srv?.name || 'Service'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                            {sub.plan}
                          </span>
                        </div>
                      </div>

                      {/* Price Tag */}
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block tabular-nums">
                          {formatCurrency(sub.price, sub.currency || currency)}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase block">
                        {row?.paymentStatus ?? sub.paymentStatus} · Due {formatCurrency(row?.due ?? 0, sub.currency || currency)}
                        </span>
                      </div>
                      <div className="basis-full truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {row?.account?.name || row?.account?.email || 'Unassigned'}{row?.profile?.profileName ? ` · ${row.profile.profileName}` : ''}
                      </div>
                    </div>

                    {/* Expiry & Quick Action Row */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dotClass}`} />
                        <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                          {isCancelled
                            ? 'Cancelled'
                            : daysDiff < 0
                            ? `Expired ${Math.abs(daysDiff)}d ago`
                            : daysDiff === 0
                            ? 'Expires today'
                            : daysDiff === 1
                              ? '1 day left'
                              : `${daysDiff} days left`}
                        </span>
                      </div>

                      {/* Renewal-First Quick Action on Card */}
                      {isNearExpiry ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openRenewDrawer(sub);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>Renew</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatAppDate(sub.expiryDate, language)}
                        </span>
                      )}
                    </div>
                    {filteredSubscriptions.length > pageSize && (
                      <nav aria-label="Subscription pages" className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                        <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="min-h-8 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">Previous</button>
                          <button type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="min-h-8 rounded-lg border border-slate-200 px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">Next</button>
                        </div>
                      </nav>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* RIGHT PANEL: SELECTED SUBSCRIPTION WORKSPACE                          */}
        {/* ===================================================================== */}
        <div
          className={`md:col-span-7 lg:col-span-8 ${
            mobileView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          {selectedSub && selectedService ? (
            <div className="space-y-4">
              {/* Mobile Back Button */}
              <div className="md:hidden flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 p-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Subscription List</span>
                </button>
                <span className="text-xs font-mono text-slate-400">
                  {selectedSub.id}
                </span>
              </div>

              {/* Workspace Main Header Card */}
              <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: selectedService.color || '#10b981' }}
                    >
                      {selectedService.logoUrl
                        ? <img src={selectedService.logoUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
                        : <Tv className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                          {selectedService.name}
                        </h2>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {selectedSub.plan}
                        </span>
                        {selectedSubBadge && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${selectedSubBadge.colorClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedSubBadge.dotClass}`} />
                            <span>{selectedSubBadge.label}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Customer:</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedCustomer && onNavigateSection) {
                              onNavigateSection('customers', selectedCustomer.id);
                            }
                          }}
                          disabled={!selectedCustomer}
                          className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 disabled:cursor-default disabled:no-underline"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{getCustomerDisplayName(selectedCustomer || undefined)}</span>
                          {selectedCustomer && <ExternalLink className="w-3 h-3 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Header Toolbar */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {/* Primary Action: Renew */}
                    <button
                      type="button"
                      onClick={() => openRenewDrawer(selectedSub)}
                      disabled={selectedSubStatus === 'cancelled'}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4 fill-current stroke-[2.5]" />
                      <span>{language === 'bn' ? 'রিনিউ করুন' : 'Renew'}</span>
                    </button>

                    {/* Pre-filled New Sale */}
                    <button
                      type="button"
                      onClick={() => selectedCustomer && onOpenNewSale(selectedCustomer.id, selectedService.id)}
                      disabled={!selectedCustomer}
                      title={!selectedCustomer ? 'Customer unavailable' : undefined}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t('newSale')}</span>
                    </button>

                    {/* Safe Edit */}
                    <button
                      type="button"
                      onClick={() => openEditDrawer(selectedSub)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{language === 'bn' ? 'এডিট' : 'Edit'}</span>
                    </button>

                    {/* More Dropdown */}
                    <div className="relative" ref={moreMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="More Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMoreMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 text-xs font-medium animate-in fade-in zoom-in-95">
                          {selectedAccount && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsChangeProfileDrawerOpen(true);
                                setIsMoreMenuOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>Change Profile Slot</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              handleSendWhatsAppReminder(selectedSub);
                              setIsMoreMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span>WhatsApp Reminder</span>
                          </button>

                          {selectedSub.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellationReason('');
                                setCancellationDate(getTodayDateString());
                                setIsCancelDialogOpen(true);
                                setIsMoreMenuOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer border-t border-slate-100 dark:border-slate-800"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Cancel Subscription</span>
                            </button>
                          )}

                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subscription Summary 4-Box Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Days Remaining
                    </span>
                    <span className="font-mono font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tabular-nums block mt-0.5">
                      {selectedSubStatus === 'cancelled'
                        ? 'Cancelled'
                        : getDaysDifference(selectedSub.expiryDate) < 0
                        ? `Expired ${Math.abs(getDaysDifference(selectedSub.expiryDate))}d ago`
                        : getDaysDifference(selectedSub.expiryDate) === 0
                        ? 'Expires today'
                        : getDaysDifference(selectedSub.expiryDate) === 1
                        ? '1 day left'
                        : `${getDaysDifference(selectedSub.expiryDate)} Days`}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Amount
                    </span>
                    <span className="font-mono font-extrabold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                      {formatCurrency(selectedSub.price, selectedSub.currency || currency)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Started
                    </span>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block mt-0.5">
                      {formatAppDate(selectedSub.startDate, language)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Expires
                    </span>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block mt-0.5">
                      {formatAppDate(selectedSub.expiryDate, language)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expiry Alert & Visual Progress Bar */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedSubStatus === 'cancelled'
                        ? 'Subscription Status: Cancelled'
                        : `Subscription ${selectedSubBadge?.label?.toLocaleLowerCase() || `expires in ${getDaysDifference(selectedSub.expiryDate)} days`}`}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-slate-400 text-[11px]">
                    Cycle: {selectedSub.durationDays || 30} days
                  </span>
                </div>

                {/* Progress bar */}
                {selectedSubStatus !== 'cancelled' && (
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {(() => {
                      const total = Math.max(selectedSub.durationDays || 30, 1);
                      const left = Math.max(getDaysDifference(selectedSub.expiryDate), 0);
                      const percentLeft = Math.min(Math.max(Math.round((left / total) * 100), 0), 100);
                      const isExpired = getDaysDifference(selectedSub.expiryDate) < 0;

                      return (
                        <div
                          className={`h-full transition-all duration-500 ${
                            isExpired
                              ? 'bg-rose-500 w-full'
                              : percentLeft <= 25
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${isExpired ? 100 : percentLeft}%` }}
                        />
                      );
                    })()}
                  </div>
                )}
                {selectedSubStatus === 'cancelled' && selectedSub.cancellationReason && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    Reason: {selectedSub.cancellationReason}
                  </p>
                )}
              </div>

              {/* Core Business Relationship Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Customer Information Card */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Customer Information
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCustomer && onNavigateSection) {
                          onNavigateSection('customers', selectedCustomer.id);
                        }
                      }}
                      disabled={!selectedCustomer}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>{selectedCustomer ? 'View Customer' : getCustomerDisplayName(undefined)}</span>
                      {selectedCustomer && <ExternalLink className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-300 shrink-0">
                      {selectedCustomer?.name.slice(0, 2).toUpperCase() || '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {getCustomerDisplayName(selectedCustomer || undefined)}
                      </h4>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {selectedCustomer?.phone || ''}
                      </p>
                    </div>
                  </div>

                  {/* Customer Quick Communication Actions */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {selectedCustomer && canContact(selectedCustomer.id) && <button
                      type="button"
                      onClick={() => selectedCustomer && handleSendWhatsAppReminder(selectedSub)}
                      className="py-2 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>}
                    <a
                      href={selectedCustomer?.phone ? `tel:${selectedCustomer.phone}` : undefined}
                      aria-disabled={!selectedCustomer?.phone}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-center"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                    {selectedCustomer?.email ? (
                      <a
                        href={`mailto:${selectedCustomer.email}`}
                        className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-center"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email</span>
                      </a>
                    ) : (
                      <div className="py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-slate-400 text-xs font-medium text-center">
                        No Email
                      </div>
                    )}
                  </div>
                  {reminders.some(reminder => reminder.subscriptionId === selectedSub.id
                    && (reminder.status === 'open' || reminder.status === 'snoozed')) && <section aria-label="Subscription reminders" className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Related Reminders</h4>
                    {reminders.filter(reminder => reminder.subscriptionId === selectedSub.id
                      && (reminder.status === 'open' || reminder.status === 'snoozed')).slice(0, 3).map(reminder => <div key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                      <div><p className="font-semibold">{reminder.title}</p><p className="text-slate-500">Due {formatAppDate(reminder.dueDate, language)}</p></div>
                      <div className="flex gap-2"><button type="button" onClick={() => completeReminder(reminder.id)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Complete</button><button type="button" onClick={() => snoozeReminder(reminder.id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())} className="font-semibold text-slate-600 hover:underline dark:text-slate-300">Snooze</button></div>
                    </div>)}
                  </section>}
                </div>

                {/* 2. Service & Plan Details Card */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Service Details
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateSection) onNavigateSection('services', selectedService.id);
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>View Service</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Service:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedService.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Plan Tier:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {selectedSub.plan}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Category:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedService.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Catalog Default:</span>
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                        ৳{selectedService.defaultPriceBDT} / ${selectedService.defaultPriceUSD}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Account & Profile Assignment Card */}
                {selectedRequiresResource && <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Account & Profile
                      </h3>
                    </div>
                    {selectedAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateSection) onNavigateSection('accounts', selectedAccount.id);
                        }}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>View Account</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {selectedAccount ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Linked Account:</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                          <span className="truncate max-w-[200px]">{selectedAccount.email}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedAccount.email, 'acc-email', 'Account email')}
                            className="p-1 hover:text-emerald-600 cursor-pointer"
                            title="Copy email"
                          >
                            {copiedKey === 'acc-email' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          </button>
                        </div>
                      </div>

                      {/* Profile Slot */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400">Profile Slot:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                            {selectedProfile ? selectedProfile.profileName : 'Slot Unspecified'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsChangeProfileDrawerOpen(true)}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                      <p>No inventory account linked yet.</p>
                      <button
                        type="button"
                        onClick={() => openEditDrawer(selectedSub)}
                        className="mt-2 text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Link an Account & Profile slot
                      </button>
                    </div>
                  )}
                </div>}

                {/* 4. Payment & Invoice Record Card */}
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Payment & Ledger
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateSection) onNavigateSection('payments');
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>View Payments</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Total:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(selectedPaymentSummary.total, selectedSub.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Paid / Due:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(selectedPaymentSummary.paid, selectedSub.currency)} / {formatCurrency(selectedPaymentSummary.due, selectedSub.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Sale:</span>
                      {selectedSale ? <button type="button" onClick={() => onNavigateSection?.('sales', selectedSale.id)} className="font-mono font-bold text-emerald-700 hover:underline dark:text-emerald-300">{selectedSale.invoiceNo} · {formatAppDate(selectedSale.date, language)}</button> : <span className="text-slate-500">No linked sale</span>}
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Related Invoice:</span>
                      {selectedSale ? (
                        <div className="flex flex-col items-end gap-0.5 text-right">
                          <button
                            type="button"
                            onClick={handleOpenSelectedInvoice}
                            className="font-mono font-bold text-emerald-700 hover:underline dark:text-emerald-300"
                          >
                            {selectedInvoice?.invoiceNumber || selectedSale.invoiceNo} · View Invoice
                          </button>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {selectedInvoice
                              ? formatAppDate(selectedInvoice.invoiceDate, language)
                              : formatAppDate(selectedSale.date, language)}
                            {' · Total '}
                            {formatCurrency(selectedSale.amount, selectedSale.currency)}
                            {' · Paid '}
                            {formatCurrency(getSalePaidAmount(selectedSale, payments), selectedSale.currency)}
                            {' · Due '}
                            {formatCurrency(getSaleDueAmount(selectedSale, payments), selectedSale.currency)}
                            {' · '}
                            {getSalePaymentStatus(selectedSale, payments).toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">No linked invoice</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Payment Status:</span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] uppercase ${
                          selectedPaymentSummary.status === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                            : selectedPaymentSummary.status === 'partial'
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {selectedPaymentSummary.status}
                      </span>
                    </div>
                    {selectedPaymentSummary.due > 0 && selectedCustomer && onAddPaymentForCustomer && (
                      <button
                        type="button"
                        onClick={() => onAddPaymentForCustomer(selectedCustomer.id)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <Plus className="h-3.5 w-3.5" />Add Payment
                      </button>
                    )}

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Method:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedPayment?.paymentMethodName || selectedPayment?.paymentMethod || 'Direct Gateway'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Transaction ID:</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {selectedPayment?.transactionId || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Payment Date:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedPayment?.paymentDate
                          ? formatAppDate(selectedPayment.paymentDate, language)
                          : formatAppDate(selectedSub.startDate, language)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Subscription Timeline & Historical Activity */}
              <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Subscription Activity Timeline
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {subscriptionTimeline.length} events logged
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {renewalHistoryRows.map(renewal => (
                    <div key={renewal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">Renewal · {renewal.plan}</span>
                        <span className="text-slate-500">{formatAppDate(renewal.renewalDate, language)}</span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">Previous end {formatAppDate(renewal.previousEndDate, language)} · New period {formatAppDate(renewal.newStartDate, language)} – {formatAppDate(renewal.newEndDate, language)}</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{formatCurrency(renewal.amount, renewal.currency || selectedSub.currency)} · {formatCurrency(renewal.amountPaid, renewal.currency || selectedSub.currency)} paid · {formatCurrency(renewal.amountDue, renewal.currency || selectedSub.currency)} due · {renewal.paymentStatus}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onNavigateSection?.('sales', renewal.saleId)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">View Sale</button>
                        {invoices.find(invoice => invoice.saleId === renewal.saleId) && <button type="button" onClick={() => onNavigateSection?.('invoices', invoices.find(invoice => invoice.saleId === renewal.saleId)?.invoiceId)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">View Invoice</button>}
                      </div>
                    </div>
                  ))}
                  {subscriptionTimeline.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      <p>Active subscription lifecycle started on {formatAppDate(selectedSub.startDate, language)}.</p>
                    </div>
                  ) : (
                    subscriptionTimeline.map(log => (
                      <div key={log.id} className="flex items-start gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {log.title}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {formatAppDateTime(log.timestamp, language)}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                            {log.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[450px] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-slate-400 space-y-3">
              <CreditCard className="w-12 h-12 stroke-1 opacity-30 text-slate-400" />
              <div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                  Select a subscription
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click on any subscription from the left list to view customer links, accounts, profile slots, and renewals.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNewSale()}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Sale</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. POLISHED RENEWAL DRAWER (Primary Action)                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRenewDrawerOpen}
        onClose={() => setIsRenewDrawerOpen(false)}
        title={language === 'bn' ? 'সাবস্ক্রিপশন রিনিউয়াল ওয়ার্কস্পেস' : 'Renew Subscription'}
        maxWidth="lg"
      >
        {selectedSub && selectedService && (
          <form onSubmit={handleExecuteRenew} className="space-y-4 text-xs">
            {/* Current Subscription Recap */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    {selectedService.name} · {selectedSub.plan}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Customer: <strong className="text-slate-800 dark:text-slate-200">{getCustomerDisplayName(selectedCustomer || undefined)}</strong>
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                    Current resource: {selectedAccount?.name || selectedAccount?.email || 'Unassigned'}{selectedProfile ? ` · ${selectedProfile.profileName}` : ''}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Expiry</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    {formatAppDate(selectedSub.expiryDate, language)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>Plan</span>
                <select value={renewPlanId} onChange={event => {
                  const plan = renewalPlanOptions.find(item => item.id === event.target.value);
                  setRenewPlanId(plan?.id || '');
                  if (plan) {
                    setRenewDuration(plan.durationDays);
                    setRenewPrice(plan.price);
                    setRenewCurrency(plan.currency);
                    setRenewDiscount(0);
                  }
                }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {!renewalPlanOptions.length && <option value="" disabled>No active plans available</option>}
                  {renewalPlanOptions.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.durationDays} days</option>)}
                </select>
              </label>
              <label className="space-y-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>Start Date</span>
                <input type="date" value={renewStartDate} onChange={event => setRenewStartDate(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
            </div>
            {!renewalPlanOptions.length && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">No active plan is available for renewal. Activate a plan in Services first.</p>}
            {renewalCurrentProfileUnavailable && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">The current profile is no longer available. Choose a new profile to continue.</p>}
            {renewalCurrentFulfillmentUnavailable && !renewalCurrentProfileUnavailable && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">The current account is no longer available. Choose another available account.</p>}
            {(selectedService.settings?.usesAccounts || selectedService.settings?.usesProfiles || renewalAccountOptions.length > 0) && <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>Account</span>
                <select value={renewAccountId} onChange={event => {
                  const accountId = event.target.value;
                  setRenewAccountId(accountId);
                  const account = renewalAccountOptions.find(item => item.id === accountId);
                  const profile = account?.profiles.find(item => item.assignedCustomerId === selectedSub.customerId)
                    || account?.profiles.find(item => item.status === 'Available');
                  setRenewProfileId(profile?.id || '');
                }} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Select account</option>
                  {renewalAccountOptions.map(account => <option key={account.id} value={account.id}>{account.email}</option>)}
                </select>
              </label>
              {(selectedService.settings?.usesProfiles || selectedService.settings?.profileAssignmentRequired || Boolean(renewalSelectedAccount?.profiles.length)) && <label className="space-y-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>Profile</span>
                <select value={renewProfileId} onChange={event => setRenewProfileId(event.target.value)} disabled={!renewalSelectedAccount} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Select available profile</option>
                  {renewalProfileOptions.map(profile => <option key={profile.id} value={profile.id}>{profile.profileName}{profile.assignedCustomerId === selectedSub.customerId ? ' · Current' : ''}</option>)}
                </select>
              </label>}
            </div>}

            <div className="grid gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700 sm:grid-cols-2">
              <div><p className="text-slate-500">Current plan</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedSub.plan} · {selectedSub.durationDays} days · {formatCurrency(selectedSub.price, selectedSub.currency)}</p></div>
              <div><p className="text-slate-500">Renewal plan</p><p className="mt-1 font-semibold text-emerald-800 dark:text-emerald-300">{renewalSelectedPlan ? `${renewalSelectedPlan.name} · ${renewalSelectedPlan.durationDays} days · ${formatCurrency(renewalSelectedPlan.price, renewalSelectedPlan.currency)}` : 'Select an active plan'}</p></div>
            </div>

            {/* Live New Expiry Calculation */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                  New Expiry Date
                </span>
                <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                  {formatAppDate(previewNewExpiryDate, language)}
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-lg">
                {renewDuration} days
              </span>
            </div>

            {/* Plan-controlled renewal price */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Renewal Price</span><p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{renewalSelectedPlan ? formatCurrency(renewalSelectedPlan.price, renewalSelectedPlan.currency) : 'Select a plan'}</p></div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Discount</label>
                <input type="number" min="0" max={Math.max(0, renewPrice - 0.01)} step={renewCurrency === 'USD' ? '0.01' : '1'} value={renewDiscount} onChange={event => setRenewDiscount(Number(event.target.value))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white text-xs" />
              </div>
              <div><span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Duration · Currency</span><p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{renewalSelectedPlan ? `${renewalSelectedPlan.durationDays} days · ${renewalSelectedPlan.currency}` : 'Select a plan'}</p></div>
            </div>

            {/* Payment Method & TrxID */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Method
                </label>
                <select
                  value={renewPaymentMethod}
                  onChange={e => setRenewPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {renewalPaymentMethods.map(method => <option key={method} value={method}>{method === 'Bank' ? 'Bank Transfer' : method}</option>)}
                </select>
                {!renewalPaymentMethods.length && <span className="mt-1 block text-rose-700 dark:text-rose-300">Enable a payment method in Settings before renewing.</span>}
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Status</label>
                <select value={renewPaymentStatus} onChange={event => {
                  const status = event.target.value as PaymentStatus;
                  setRenewPaymentStatus(status);
                  if (status === 'paid') setRenewAmountPaid(String(renewalTotal));
                  else if (status === 'partial') setRenewAmountPaid(String(Math.floor(renewalTotal / 2)));
                  else setRenewAmountPaid('0');
                }} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white">
                  <option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option>
                </select>
              </div>
              {renewPaymentStatus === 'partial' && <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Amount Paid</label>
                <input type="number" min="0.01" max={renewalTotal} step={renewCurrency === 'USD' ? '0.01' : '1'} value={renewAmountPaid} onChange={event => setRenewAmountPaid(event.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white" />
              </div>}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Transaction ID {paymentMethodRequiresTransactionId(renewPaymentMethod, renewalPaymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) ? '(Required)' : '(Optional)'}
                </label>
                <input
                  type="text"
                  required={paymentMethodRequiresTransactionId(renewPaymentMethod, renewalPaymentMethodConfigs, settings.paymentPreferences?.requireTransactionId)}
                  value={renewTrxId}
                  onChange={e => setRenewTrxId(e.target.value)}
                  placeholder="e.g. TXN987654"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
              <div><dt className="text-slate-500">Total</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{formatCurrency(renewalTotal, renewCurrency)}</dd></div>
              <div><dt className="text-slate-500">Paid</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{formatCurrency(renewalPaid, renewCurrency)}</dd></div>
              <div><dt className="text-slate-500">Due</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{formatCurrency(renewalDue, renewCurrency)}</dd></div>
            </dl>
            <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
              <p className="font-bold text-slate-800 dark:text-slate-200">Review Renewal</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{getCustomerDisplayName(selectedCustomer || undefined)} · {selectedService.name} · {renewalSelectedPlan?.name || selectedSub.plan}</p>
              <p className="mt-1 text-slate-500">{renewalSelectedAccount?.email || 'Manual fulfillment'}{renewalSelectedAccount?.profiles.find(profile => profile.id === renewProfileId) ? ` · ${renewalSelectedAccount.profiles.find(profile => profile.id === renewProfileId)?.profileName}` : ''}</p>
              <p className="mt-1 text-slate-500">{formatAppDate(renewStartDate, language)} – {formatAppDate(previewNewExpiryDate, language)}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsRenewDrawerOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRenewing || !renewalPlanOptions.length || !renewalPaymentMethods.length || selectedSubStatus === 'cancelled'}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-60"
              >
                {isRenewing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                <span>{isRenewing ? 'Renewing…' : 'Confirm Renewal'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 4. SAFE EDIT SUBSCRIPTION DRAWER                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title={language === 'bn' ? 'সাবস্ক্রিপশন সম্পাদনা' : 'Edit Subscription Details'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Plan</label>
            <input
              type="text"
              required
              value={editPlan}
              onChange={e => setEditPlan(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Date</label>
              <input
                type="date"
                required
                value={editStartDate}
                onChange={e => setEditStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Duration (Days)</label>
              <input
                type="number"
                min="1"
                required
                value={editDuration}
                onChange={e => setEditDuration(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Price</label>
              <input
                type="number"
                min="0"
                required
                value={editPrice}
                onChange={e => setEditPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Status</label>
              <select
                value={editPaymentStatus}
                onChange={e => setEditPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white"
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notes</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Internal fulfillment or renewal notes..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. CHANGE PROFILE SLOT DRAWER                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isChangeProfileDrawerOpen}
        onClose={() => setIsChangeProfileDrawerOpen(false)}
        title="Change Profile Slot"
        maxWidth="md"
      >
        {selectedAccount && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-500 dark:text-slate-400">
              Select an available profile slot on <strong>{selectedAccount.email}</strong>:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedAccount.profiles?.map(prof => {
                const isCurrent = prof.id === selectedSub?.profileId;
                const isOccupied = prof.status === 'Assigned' && !isCurrent;

                return (
                  <div
                    key={prof.id}
                    onClick={() => {
                      if (!isOccupied) handleChangeProfile(prof.id);
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : isOccupied
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-400 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{prof.profileName}</span>
                        {prof.pin && <span className="font-mono text-[10px] text-slate-400">PIN: ••••</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {isCurrent ? '● Currently Assigned to This Customer' : isOccupied ? '● Assigned to another client' : '● Available Slot'}
                      </span>
                    </div>

                    {isCurrent ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isOccupied ? (
                      <Lock className="w-4 h-4 text-slate-400" />
                    ) : (
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsChangeProfileDrawerOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 6. CANCEL SUBSCRIPTION DIALOG                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        title="Cancel Subscription"
        maxWidth="md"
      >
        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Cancel active subscription?</strong>
                <p className="text-[11px] mt-0.5 text-rose-700 dark:text-rose-400">
                  This will mark the subscription as <strong>Cancelled</strong> while preserving all historical sales, payment records, and customer logs.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Cancellation Reason (Required)
            </label>
            <input
              type="text"
              value={cancellationReason}
              onChange={e => setCancellationReason(e.target.value)}
              required
              placeholder="e.g. Customer requested refund, non-payment, switched service..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Cancellation Date (Optional)</label>
            <input type="date" value={cancellationDate} onChange={event => setCancellationDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCancelDialogOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              Keep Active
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>Confirm Cancellation</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. + NEW SUBSCRIPTION DRAWER (Progressive Disclosure & Smart Validation)  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isNewSubDrawerOpen}
        onClose={() => setIsNewSubDrawerOpen(false)}
        title={language === 'bn' ? '+ নতুন সাবস্ক্রিপশন তৈরি করুন' : '+ New Subscription Workspace'}
        maxWidth="xl"
      >
        <form onSubmit={handleCreateNewSubscription} className="space-y-4 text-xs">
          {/* Step 1: Customer Selection */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              1. Customer <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={newSubCustomerId}
              onChange={e => setNewSubCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white"
            >
              <option value="" disabled>-- Select Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2 & 3: Service & Plan Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                2. Service <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={newSubServiceId}
                onChange={e => {
                  const sId = e.target.value;
                  setNewSubServiceId(sId);
                  const matched = services.find(s => s.id === sId);
                  if (matched) {
                    setNewSubPlan(matched.plans[0] || 'Standard');
                    setNewSubPrice(matched.defaultPriceBDT || 350);
                  }
                  setNewSubAccountId('');
                  setNewSubProfileId('');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white"
              >
                <option value="" disabled>-- Select Service --</option>
                {services.filter(s => !s.isArchived).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                3. Plan <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={newSubPlan}
                onChange={e => setNewSubPlan(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
              >
                {services.find(s => s.id === newSubServiceId)?.plans.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )) || <option value="Standard">Standard</option>}
              </select>
            </div>
          </div>

          {/* Step 4 & 5: Progressive Account & Profile Selection */}
          {newSubServiceId && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Account & Profile Allocation (Progressive Disclosure)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    4. Inventory Account (Optional)
                  </label>
                  <select
                    value={newSubAccountId}
                    onChange={e => {
                      setNewSubAccountId(e.target.value);
                      setNewSubProfileId('');
                    }}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">-- No Account Linked --</option>
                    {availableAccountsForNewSub.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.email} ({a.plan})
                      </option>
                    ))}
                  </select>
                </div>

                {newSubAccountId && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      5. Profile Slot (Optional)
                    </label>
                    <select
                      value={newSubProfileId}
                      onChange={e => setNewSubProfileId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="">-- Select Profile Slot --</option>
                      {availableProfilesForNewSub.map(p => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={p.status === 'Assigned'}
                        >
                          {p.profileName} {p.status === 'Assigned' ? '(Occupied)' : '(Available)'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Duration & Dates with Live Expiry Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={newSubStartDate}
                onChange={e => setNewSubStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Duration (Days) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={newSubDuration}
                onChange={e => setNewSubDuration(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Calculated Expiry
              </label>
              <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                {calculateExpiryDate(newSubStartDate, Number(newSubDuration) || 30)}
              </div>
            </div>
          </div>

          {/* Step 7: Price, Payment & Currency */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Price</label>
              <input
                type="number"
                min="0"
                required
                value={newSubPrice}
                onChange={e => setNewSubPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Currency</label>
              <select
                value={newSubCurrency}
                onChange={e => setNewSubCurrency(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
              >
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Method</label>
              <select
                value={newSubPaymentMethod}
                onChange={e => setNewSubPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white"
              >
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Status</label>
              <select
                value={newSubPaymentStatus}
                onChange={e => setNewSubPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">TrxID (Optional)</label>
              <input
                type="text"
                value={newSubTrxId}
                onChange={e => setNewSubTrxId(e.target.value)}
                placeholder="e.g. TXN123456"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notes</label>
              <input
                type="text"
                value={newSubNotes}
                onChange={e => setNewSubNotes(e.target.value)}
                placeholder="Special client terms..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewSubDrawerOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Subscription</span>
            </button>
          </div>
        </form>
      </Modal>
      {selectedInvoiceData && (
        <InvoicePreviewModal
          isOpen={Boolean(selectedInvoiceData)}
          onClose={() => setSelectedInvoiceData(null)}
          saleData={selectedInvoiceData}
          onViewSale={saleId => onNavigateSection?.('sales', saleId)}
        />
      )}
    </div>
  );
};
