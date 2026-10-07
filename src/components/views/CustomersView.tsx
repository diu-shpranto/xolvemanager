import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  ExternalLink,
  Edit2,
  Trash2,
  CreditCard,
  Receipt,
  DollarSign,
  ChevronRight,
  Filter,
  MessageCircle,
  MapPin,
  Facebook,
  CheckCircle,
  CheckCircle2,
  Clock,
  X,
  Eye,
  Calendar,
  Sparkles,
  Archive,
  RotateCcw,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronDown,
  Shield,
  FileText,
  History,
  CalendarDays,
  Download,
  UserPlus,
  Copy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { Customer, Subscription } from '../../types';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import { InvoiceSaleDetails, downloadInvoiceJpg, generateInvoiceJpg } from '../../utils/invoiceGenerator';
import { resolvePaymentCustomer, resolveSaleCustomer } from '../../utils/relationships';
import { getSaleDueAmount, getSalePaidAmount, getSalePaymentStatus } from '../../utils/saleUtils';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { getInvoicesForCustomer } from '../../utils/invoiceUtils';
import {
  buildCustomerCrmMetrics,
  CUSTOMER_CRM_THRESHOLDS,
  isCustomerNew,
  type CustomerCrmMetrics,
  type CustomerCrmQuickFilter,
} from '../../utils/customerCrm';
import { matchesCustomerSearch, normalizePhoneDigits } from '../../services/globalSearch';
import { exportCustomersCSV } from '../../services/dataBackupService';
import { downloadCSV } from '../../utils/csvParser';
import { sanitizeActivityDescription } from '../../services/activityService';
import { buildSubscriptionRenewalMessage } from '../../utils/whatsappUtils';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { getExpiryWhatsAppTemplateId } from '../../utils/whatsappService';
import { convertReportCurrency } from '../../utils/reportMetrics';
import {
  formatAppDate,
  formatAppDateTime,
  formatCurrency,
  getExpiryBadgeInfo,
  getDaysDifference,
  getSubscriptionStatus,
  getSubscriptionReminderDays,
} from '../../utils/dateUtils';

interface CustomersViewProps {
  onOpenNewSaleForCustomer: (customerId?: string) => void;
  onViewSale: (saleId: string) => void;
  selectedCustomerId?: string | null;
  onClearSelectedCustomer?: () => void;
  onViewSubscription: (subscriptionId: string) => void;
  onRenewSubscription: (sub: Subscription) => void;
  createRequest?: number;
  onCreateRequestHandled?: () => void;
  onViewCustomerDetails?: (customerId: string) => void;
  onAddPaymentForCustomer?: (customerId: string) => void;
  onViewPayment?: (paymentId: string) => void;
  initialCustomerFilter?: CustomerCrmQuickFilter;
  initialServiceFilterId?: string;
  onInitialCustomerFilterHandled?: () => void;
}

// Generate customer initials: e.g. "Rahim Ahmed" -> "RA"
function getInitials(name: string): string {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Curated subtle palette for customer avatars.
const avatarColorStyles = [
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40',
  'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/40',
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/40',
  'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40',
  'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40',
];

function getAvatarColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColorStyles.length;
  return avatarColorStyles[index];
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onOpenNewSaleForCustomer,
  onViewSale,
  selectedCustomerId,
  onClearSelectedCustomer,
  onViewSubscription,
  onRenewSubscription,
  createRequest,
  onCreateRequestHandled,
  onViewCustomerDetails,
  onAddPaymentForCustomer,
  onViewPayment,
  initialCustomerFilter,
  initialServiceFilterId,
  onInitialCustomerFilterHandled,
}) => {
  const {
    customers,
    customersLoading,
    customersError,
    storageWarning,
    subscriptions,
    sales,
    invoices,
    payments,
    accounts,
    activityLogs,
    reminders,
    completeReminder,
    snoozeReminder,
    services,
    addCustomer,
    updateCustomer,
    addCustomerNote,
    updateCustomerNote,
    deleteCustomerNote,
    deleteCustomer,
    archiveCustomer,
    restoreCustomer,
    settings,
    logActivity,
    ensureInvoiceForSale,
    currency,
    t,
    language,
  } = useApp();
  const { openMessage, canContact } = useWhatsAppCommunication();
  const serviceById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
  const { showToast } = useToast();

  // Search & Filter & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'spending'>('newest');
  const [filterStatus, setFilterStatus] = useState<'all' | 'archived'>('all');
  const [filterCrmStatus, setFilterCrmStatus] = useState<'all' | 'active' | 'at_risk' | 'inactive'>('all');
  const [filterServiceId, setFilterServiceId] = useState('all');
  const [filterRenewal, setFilterRenewal] = useState<'all' | 'due' | 'expired' | 'none'>('all');
  const [filterSubscription, setFilterSubscription] = useState<'all' | 'active' | 'none' | 'expiring' | 'expired'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'due' | 'failed'>('all');
  const [filterActivity, setFilterActivity] = useState<'all' | 'new' | 'recent' | 'inactive'>('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [lastActivityFrom, setLastActivityFrom] = useState('');
  const [lastActivityTo, setLastActivityTo] = useState('');
  const [openMoreCustomerId, setOpenMoreCustomerId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailedCustomerId, setDetailedCustomerId] = useState<string | null>(
    selectedCustomerId || null
  );
  useEffect(() => {
    if (selectedCustomerId) setDetailedCustomerId(selectedCustomerId);
  }, [selectedCustomerId]);
  useEffect(() => {
    if (!createRequest) return;
    setIsAddModalOpen(true);
    onCreateRequestHandled?.();
  }, [createRequest, onCreateRequestHandled]);
  useEffect(() => {
    if (!initialCustomerFilter) return;
    setSearchQuery('');
    setFilterStatus('all');
    setFilterCrmStatus(
      initialCustomerFilter === 'active' || initialCustomerFilter === 'at_risk' || initialCustomerFilter === 'inactive'
        ? initialCustomerFilter : 'all'
    );
    setFilterActivity(initialCustomerFilter === 'new' ? 'new' : 'all');
    setFilterPayment(initialCustomerFilter === 'due' ? 'due' : 'all');
    setFilterRenewal(initialCustomerFilter === 'renewals' ? 'due' : 'all');
    setFilterSubscription('all');
    setCurrentPage(1);
    onInitialCustomerFilterHandled?.();
  }, [initialCustomerFilter, onInitialCustomerFilterHandled]);
  useEffect(() => {
    if (!initialServiceFilterId) return;
    setSearchQuery('');
    setFilterServiceId(initialServiceFilterId);
    setCurrentPage(1);
  }, [initialServiceFilterId]);

  // Deletion / Archival Confirmation Modal State
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [duplicateCustomer, setDuplicateCustomer] = useState<Customer | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [duplicateOfCustomerId, setDuplicateOfCustomerId] = useState<string | undefined>();
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<InvoiceSaleDetails | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [facebookId, setFacebookId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [contactMethod, setContactMethod] = useState<'phone' | 'whatsapp' | 'email' | 'other'>('phone');
  const [contactAllowed, setContactAllowed] = useState<boolean | undefined>(undefined);
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'bn'>('en');
  const [newTag, setNewTag] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Validation Errors State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCustomerDetails = (customerId: string) => {
    setDetailedCustomerId(customerId);
    onViewCustomerDetails?.(customerId);
  };

  const safeCustomerNote = (text?: string) => sanitizeActivityDescription(
    text || '',
    accounts.flatMap(account => [
      account.password,
      account.passwordMasked || '',
      ...account.profiles.flatMap(profile => [profile.pin || '', profile.pinMasked || '']),
    ])
  );

  // Open Add Modal
  const openAddModal = () => {
    setName('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setFacebookUrl('');
    setFacebookId('');
    setAddress('');
    setNotes('');
    setContactMethod('phone');
    setContactAllowed(undefined);
    setPreferredLanguage(language);
    setFormErrors({});
    setDuplicateCustomer(null);
    setAllowDuplicate(false);
    setDuplicateOfCustomerId(undefined);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setWhatsapp(cust.whatsapp || cust.phone);
    setEmail(cust.email || '');
    setFacebookUrl(cust.facebookUrl || '');
    setFacebookId(cust.facebookId || '');
    setAddress(cust.address || '');
    setNotes(cust.notes || '');
    setContactMethod(cust.preferences?.contactMethod || 'phone');
    setContactAllowed(cust.preferences?.contactAllowed);
    setPreferredLanguage(cust.preferences?.language || language);
    setFormErrors({});
    setDuplicateCustomer(null);
    setAllowDuplicate(false);
    setDuplicateOfCustomerId(undefined);
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = language === 'bn' ? 'কাস্টমারের পূর্ণ নাম আবশ্যক' : 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = language === 'bn' ? 'নাম কমপক্ষে ২ অক্ষরের হতে হবে' : 'Name must be at least 2 characters';
    }

    if (!phone.trim()) {
      errors.phone = language === 'bn' ? 'ফোন নম্বর আবশ্যক' : 'Phone number is required';
    } else {
      const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
      if (cleanPhoneDigits.length < 6) {
        errors.phone = language === 'bn' ? 'সঠিক ফোন নম্বর প্রদান করুন' : 'Please provide a valid phone number';
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = language === 'bn' ? 'সঠিক ইমেইল ঠিকানা প্রদান করুন' : 'Please enter a valid email address';
      }
    }

    if (facebookUrl.trim()) {
      const url = facebookUrl.trim().toLowerCase();
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('facebook.com') && !url.startsWith('fb.com')) {
        errors.facebookUrl = language === 'bn' ? 'সঠিক ফেসবুক প্রোফাইল লিংক দিন' : 'Must be a valid Facebook URL';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!allowDuplicate) {
      const normalizedPhone = normalizePhoneDigits(phone);
      const normalizedEmail = email.trim().toLowerCase();
      const match = customers.find(customer =>
        customer.id !== editingCustomer?.id && !customer.isArchived && (
          (normalizedPhone && normalizePhoneDigits(customer.phone) === normalizedPhone) ||
          (normalizedEmail && customer.email.trim().toLowerCase() === normalizedEmail)
        )
      );
      if (match) {
        setDuplicateCustomer(match);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: name.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || phone.trim(),
          email: email.trim() || '',
          facebookUrl: facebookUrl.trim() || '',
          facebookId: facebookId.trim() || '',
          address: address.trim() || '',
          notes: notes.trim() || '',
          ...(duplicateOfCustomerId ? { duplicateOfCustomerId } : {}),
          preferences: {
            contactMethod,
            ...(contactAllowed === undefined ? {} : { contactAllowed }),
            language: preferredLanguage,
          },
        });
        showToast(
          language === 'bn'
            ? 'কাস্টমার প্রোফাইল সফলভাবে আপডেট করা হয়েছে!'
            : 'Customer profile updated successfully!',
          'success'
        );
        setEditingCustomer(null);
      } else {
        await addCustomer({
          name: name.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || phone.trim(),
          email: email.trim(),
          facebookUrl: facebookUrl.trim() || undefined,
          facebookId: facebookId.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          ...(duplicateOfCustomerId ? { duplicateOfCustomerId } : {}),
          preferences: {
            contactMethod,
            ...(contactAllowed === undefined ? {} : { contactAllowed }),
            language: preferredLanguage,
          },
        });
        showToast(
          language === 'bn'
            ? 'নতুন কাস্টমার সফলভাবে ফায়ারস্টোরে যোগ করা হয়েছে!'
            : 'New customer added successfully!',
          'success'
        );
        setIsAddModalOpen(false);
        setAllowDuplicate(false);
        setDuplicateOfCustomerId(undefined);
        setDuplicateCustomer(null);
      }
    } catch (err: unknown) {
      console.error('Customer save failed:', err);
      showToast(err instanceof Error ? err.message : 'Unable to save customer. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const invoiceDetailsForSale = (sale: (typeof sales)[number]) => {
    const service = services.find(item => item.id === sale.serviceId);
    const saleCustomer = resolveSaleCustomer(sale, customers, subscriptions);
    const invoice = invoices.find(item => item.saleId === sale.id) || ensureInvoiceForSale(sale.id);
    return buildInvoiceSaleDetails(
      invoice,
      sale,
      saleCustomer,
      service,
      payments,
      settings,
      subscriptions.find(subscription => subscription.id === invoice.subscriptionId || subscription.id === sale.subscriptionId)
    );
  };

  const handleOpenInvoice = (sale: (typeof sales)[number]) => {
    setSelectedInvoiceData(invoiceDetailsForSale(sale));
  };

  const handleDownloadInvoice = async (sale: (typeof sales)[number]) => {
    try {
      const result = await generateInvoiceJpg(invoiceDetailsForSale(sale));
      downloadInvoiceJpg(result.blob, result.fileName);
      showToast(`Downloaded ${result.fileName}`, 'success');
    } catch (error) {
      console.error('Customer invoice download failed:', error);
      showToast('Unable to download invoice. Please try again.', 'error');
    }
  };

  const copyCustomerField = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied.`, 'success');
    } catch (error) {
      console.error(`Customer ${label.toLowerCase()} copy failed:`, error);
      showToast(`Unable to copy ${label.toLowerCase()}. Check clipboard permissions.`, 'error');
    }
  };

  const saveCustomerTag = async (customer: Customer, rawTag: string) => {
    const tag = rawTag.trim().replace(/\s+/g, ' ');
    if (!tag || customer.tags?.some(existing => existing.toLowerCase() === tag.toLowerCase())) return;
    try {
      await updateCustomer(customer.id, { tags: [...(customer.tags || []), tag] });
      setNewTag('');
    } catch (error) {
      console.error('Customer tag save failed:', error);
      showToast('Unable to save customer tag.', 'error');
    }
  };

  const removeCustomerTag = async (customer: Customer, tag: string) => {
    try {
      await updateCustomer(customer.id, { tags: (customer.tags || []).filter(item => item !== tag) });
    } catch (error) {
      console.error('Customer tag removal failed:', error);
      showToast('Unable to remove customer tag.', 'error');
    }
  };

  const saveCustomerNote = () => {
    if (!detailedCustomer) return;
    try {
      if (editingNoteId) {
        updateCustomerNote(detailedCustomer.id, editingNoteId, editingNoteText);
        setEditingNoteId(null);
        setEditingNoteText('');
      } else {
        addCustomerNote(detailedCustomer.id, noteDraft);
        setNoteDraft('');
      }
      showToast('Customer note saved.', 'success');
    } catch (error) {
      console.error('Customer note save failed:', error);
      showToast(error instanceof Error ? error.message : 'Unable to save customer note.', 'error');
    }
  };

  const removeCustomerNote = (noteId: string) => {
    if (!detailedCustomer || !window.confirm('Delete this customer note?')) return;
    try {
      deleteCustomerNote(detailedCustomer.id, noteId);
      showToast('Customer note deleted.', 'success');
    } catch (error) {
      console.error('Customer note removal failed:', error);
      showToast(error instanceof Error ? error.message : 'Unable to delete customer note.', 'error');
    }
  };

  // Safe Deletion / Archival Handler
  const handleConfirmDelete = async (forcePermanent: boolean) => {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(customerToDelete.id, forcePermanent);
      showToast(
        forcePermanent
          ? (language === 'bn' ? 'কাস্টমার স্থায়ীভাবে মুছে ফেলা হয়েছে।' : 'Customer permanently deleted.')
          : (language === 'bn' ? 'কাস্টমার সফলভাবে আর্কাইভে পাঠানো হয়েছে।' : 'Customer safely archived.'),
        'info'
      );
      if (detailedCustomerId === customerToDelete.id) {
        setDetailedCustomerId(null);
      }
      setCustomerToDelete(null);
    } catch (err: unknown) {
      console.error('Customer delete or archive failed:', err);
      showToast('Unable to delete or archive customer. Please try again.', 'error');
    }
  };

  // Restore from archive
  const handleRestore = async (id: string, custName: string) => {
    try {
      await restoreCustomer(id);
      showToast(
        language === 'bn'
          ? `"${custName}" সফলভাবে রিস্টোর করা হয়েছে!`
          : `"${custName}" restored to the active customer list!`,
        'success'
      );
    } catch (err: unknown) {
      console.error('Customer restore failed:', err);
      showToast('Unable to restore customer. Please try again.', 'error');
    }
  };

  const customerMetrics = useMemo(() => {
    const crmMetrics = buildCustomerCrmMetrics(
      customers, sales, subscriptions, payments, invoices, activityLogs, services, currency,
      new Date(), settings.reminderNoticeDays
    );
    const subscriptionsByCustomer = new Map<string, Subscription[]>();
    subscriptions.forEach(subscription => {
      const customerSubscriptions = subscriptionsByCustomer.get(subscription.customerId) || [];
      customerSubscriptions.push(subscription);
      subscriptionsByCustomer.set(subscription.customerId, customerSubscriptions);
    });
    const metrics = new Map<string, CustomerCrmMetrics & {
      subscriptions: Subscription[];
      activeCount: number;
      renewalDueCount: number;
      spent: number;
      renewalStatus: 'due' | 'expired' | 'none' | 'active';
    }>();
    customers.forEach(customer => {
      const customerSubscriptions = subscriptionsByCustomer.get(customer.id) || [];
      const crm = crmMetrics.get(customer.id);
      if (!crm) return;
      const hasExpired = customerSubscriptions.some(
        subscription => getSubscriptionStatus(
          subscription,
          serviceById.get(subscription.serviceId),
          settings.reminderNoticeDays
        ) === 'expired'
      );
      metrics.set(customer.id, {
        ...crm,
        subscriptions: customerSubscriptions,
        activeCount: crm.activeSubscriptions,
        renewalDueCount: crm.renewalsDue,
        spent: crm.totalSpent,
        renewalStatus: crm.renewalsDue
          ? hasExpired ? 'expired' : 'due'
          : customerSubscriptions.length ? 'active' : 'none',
      });
    });
    return metrics;
  }, [customers, subscriptions, sales, payments, invoices, activityLogs, services, settings.reminderNoticeDays, currency]);

  const customerSummary = useMemo(() => {
    const visibleCustomers = customers.filter(customer => !customer.isArchived && customer.status !== 'archived');
    const activeCount = visibleCustomers.filter(customer => customerMetrics.get(customer.id)?.status === 'active').length;
    const atRiskCount = visibleCustomers.filter(customer => customerMetrics.get(customer.id)?.status === 'at_risk').length;
    const inactiveCount = visibleCustomers.filter(customer => customerMetrics.get(customer.id)?.status === 'inactive').length;
    const newCustomers = visibleCustomers.filter(customer => isCustomerNew(customer.createdAt)).length;
    const renewalsDue = customers.filter(
      customer => !customer.isArchived && (customerMetrics.get(customer.id)?.renewalDueCount || 0) > 0
    ).length;
    const totalDue = visibleCustomers.reduce((total, customer) => total + (customerMetrics.get(customer.id)?.totalDue || 0), 0);
    return { activeCount, atRiskCount, inactiveCount, newCustomers, renewalsDue, totalDue, total: visibleCustomers.length };
  }, [customers, customerMetrics]);

  const renewalOpportunityRows = useMemo(() => subscriptions.flatMap(subscription => {
    if (subscription.status === 'cancelled') return [];
    const service = services.find(item => item.id === subscription.serviceId);
    const state = getSubscriptionStatus(subscription, service, settings.reminderNoticeDays);
    const daysRemaining = getDaysDifference(subscription.expiryDate);
    if (state !== 'expiring_soon' && (state !== 'expired' || daysRemaining < -CUSTOMER_CRM_THRESHOLDS.recentlyExpiredDays)) return [];
    const customer = customers.find(item => item.id === subscription.customerId);
    if (!customer || customer.isArchived) return [];
    return [{ subscription, customer, service, daysRemaining }];
  }).sort((left, right) => left.daysRemaining - right.daysRemaining).slice(0, 8), [
    subscriptions, services, settings.reminderNoticeDays, customers,
  ]);

  const outstandingBalanceRows = useMemo(() => sales.flatMap(sale => {
    const customer = resolveSaleCustomer(sale, customers, subscriptions);
    if (!customer || customer.isArchived) return [];
    const due = getSaleDueAmount(sale, payments);
    return due > 0 ? [{ sale, customer, due, dueInCurrency: convertReportCurrency(due, sale.currency, currency) }] : [];
  }).sort((left, right) => right.dueInCurrency - left.dueInCurrency).slice(0, 8), [sales, customers, subscriptions, payments, currency]);

  // Filter & Sort Pipeline
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(cust => {
        // Archival filter
        if (filterStatus === 'archived') {
          if (!cust.isArchived) return false;
        } else {
          if (cust.isArchived) return false;
        }

        // Search is filtered locally across the customer's existing identity fields.
        if (!matchesCustomerSearch(cust, searchQuery)) return false;

        // Subscriptions status filter
        const metrics = customerMetrics.get(cust.id);
        if (filterServiceId !== 'all' && !metrics?.serviceIds.has(filterServiceId)) return false;
        if (filterRenewal === 'due' && !metrics?.renewalDueCount) return false;
        if (filterRenewal === 'expired' && metrics?.renewalStatus !== 'expired') return false;
        if (filterRenewal === 'none' && metrics?.renewalStatus !== 'none') return false;
        if (filterCrmStatus !== 'all' && metrics?.status !== filterCrmStatus) return false;
        if (filterSubscription === 'active' && !(metrics?.activeSubscriptions || 0)) return false;
        if (filterSubscription === 'none' && (metrics?.activeSubscriptions || 0) > 0) return false;
        if (filterSubscription === 'expiring' && !(metrics?.subscriptions.some(subscription =>
          getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays) === 'expiring_soon'
        ))) return false;
        if (filterSubscription === 'expired' && !(metrics?.subscriptions.some(subscription =>
          getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays) === 'expired'
        ))) return false;
        if (filterPayment === 'due' && !(metrics?.totalDue || 0)) return false;
        if (filterPayment === 'failed' && !metrics?.hasFailedPayment) return false;
        if (filterPayment === 'paid' && (!metrics?.salesCount || Boolean(metrics.totalDue) || metrics.hasFailedPayment)) return false;
        const createdDate = cust.createdAt.slice(0, 10);
        if (createdFrom && createdDate < createdFrom) return false;
        if (createdTo && createdDate > createdTo) return false;
        const activityDate = metrics?.lastActivity?.slice(0, 10) || '';
        if (lastActivityFrom && (!activityDate || activityDate < lastActivityFrom)) return false;
        if (lastActivityTo && (!activityDate || activityDate > lastActivityTo)) return false;
        if (filterActivity === 'new') {
          if (!isCustomerNew(cust.createdAt)) return false;
        }
        if (filterActivity === 'recent' && !metrics?.hasRecentActivity) return false;
        if (filterActivity === 'inactive' && metrics?.status !== 'inactive') return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'spending') {
          return (customerMetrics.get(b.id)?.spent || 0) - (customerMetrics.get(a.id)?.spent || 0);
        }
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'name_desc') {
          return b.name.localeCompare(a.name);
        }
        return a.name.localeCompare(b.name);
      });
  }, [
    customers,
    searchQuery,
    filterStatus,
    filterCrmStatus,
    filterServiceId,
    filterRenewal,
    filterSubscription,
    filterPayment,
    filterActivity,
    createdFrom,
    createdTo,
    lastActivityFrom,
    lastActivityTo,
    sortBy,
    customerMetrics,
    services,
    settings.reminderNoticeDays,
  ]);

  // Paginated records
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);
  const hasNoCustomers = customers.every(customer => customer.isArchived);
  const hasCustomerFilters = Boolean(
    searchQuery || filterServiceId !== 'all' || filterRenewal !== 'all'
    || filterCrmStatus !== 'all' || filterSubscription !== 'all' || filterPayment !== 'all'
    || filterActivity !== 'all' || createdFrom || createdTo || lastActivityFrom || lastActivityTo
  );

  // Selected customer for detailed view
  const detailedCustomer = customers.find(c => c.id === detailedCustomerId);
  const detailsLoadError = Boolean(customersError || storageWarning?.includes('saved data'));
  const detailedSubs = detailedCustomer
    ? (customerMetrics.get(detailedCustomer.id)?.subscriptions || [])
    : [];
  const detailedSales = detailedCustomer
    ? sales.filter(sale => resolveSaleCustomer(sale, customers, subscriptions)?.id === detailedCustomer.id)
    : [];
  const detailedPayments = detailedCustomer
    ? payments.filter(payment => resolvePaymentCustomer(payment, customers, sales, subscriptions)?.id === detailedCustomer.id)
    : [];
  const detailedCrmMetrics = detailedCustomer ? customerMetrics.get(detailedCustomer.id) : undefined;
  const detailedInvoices = detailedCustomer
    ? getInvoicesForCustomer(invoices, detailedCustomer.id)
    : [];
  const detailedEntityIds = new Set([
    ...(detailedCustomer ? [detailedCustomer.id] : []),
    ...detailedSubs.map(subscription => subscription.id),
    ...detailedSales.map(sale => sale.id),
    ...detailedPayments.map(payment => payment.id),
    ...detailedInvoices.map(invoice => invoice.invoiceId),
  ]);
  const detailedActivities = detailedCustomer
    ? activityLogs
      .filter(activity =>
        activity.customerId === detailedCustomer.id
        || Boolean(activity.entityId && detailedEntityIds.has(activity.entityId))
        || Boolean(activity.saleId && detailedEntityIds.has(activity.saleId))
        || Boolean(activity.invoiceId && detailedEntityIds.has(activity.invoiceId))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];
  const detailedReminders = detailedCustomer
    ? reminders.filter(reminder => reminder.customerId === detailedCustomer.id
      && (reminder.status === 'open' || reminder.status === 'snoozed'))
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    : [];

  const sortedDetailedSubs = [...detailedSubs].sort((a, b) => {
    const getPriority = (subscription: Subscription) => {
      const days = new Date(`${subscription.expiryDate}T00:00:00`).getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const daysUntil = Math.ceil(days / (24 * 60 * 60 * 1000));
      if (subscription.status === 'cancelled') return 6;
      if (daysUntil < 0) return 0;
      if (daysUntil === 0) return 1;
      if (daysUntil <= 3) return 2;
      if (daysUntil <= 7) return 3;
      return 4;
    };
    return getPriority(a) - getPriority(b) || a.expiryDate.localeCompare(b.expiryDate);
  });
  const activeSubsForDetailed = sortedDetailedSubs.filter(
    s => ['active', 'expiring_soon'].includes(getSubscriptionStatus(s, serviceById.get(s.serviceId), settings.reminderNoticeDays))
  );
  const expiredSubsForDetailed = sortedDetailedSubs.filter(
    s => getSubscriptionStatus(s, serviceById.get(s.serviceId), settings.reminderNoticeDays) === 'expired'
  );
  const currentActiveSubsForDetailed = activeSubsForDetailed.filter(
    sub => getSubscriptionStatus(sub, serviceById.get(sub.serviceId), settings.reminderNoticeDays) === 'active'
  );
  const endingSoonSubsForDetailed = activeSubsForDetailed.filter(
    sub => getSubscriptionStatus(sub, serviceById.get(sub.serviceId), settings.reminderNoticeDays) === 'expiring_soon'
  );
  const detailedTotalSales = detailedCrmMetrics?.totalSpent || 0;
  const detailedTotalPaid = detailedCrmMetrics?.totalPaid || 0;
  const detailedTotalDue = detailedCrmMetrics?.totalDue || 0;
  const detailedDueSale = [...detailedSales]
    .filter(sale => getSaleDueAmount(sale, payments) > 0)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
  const detailedLatestInvoice = [...detailedInvoices]
    .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate))[0];
  const detailedSuccessfulPayment = [...detailedPayments]
    .filter(payment => payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];
  const nearestRenewalSubscription = [...detailedSubs]
    .filter(subscription => getSubscriptionStatus(subscription, serviceById.get(subscription.serviceId), settings.reminderNoticeDays) !== 'cancelled')
    .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate))[0];
  const nearestRenewalService = nearestRenewalSubscription
    ? services.find(service => service.id === nearestRenewalSubscription.serviceId)
    : undefined;
  const renewalTemplate = nearestRenewalService?.renewalMessage?.enabled
    ? nearestRenewalService.renewalMessage.template?.trim()
    : '';
  const copyRenewalMessage = async () => {
    if (!detailedCustomer || !nearestRenewalSubscription || !nearestRenewalService || !renewalTemplate) return;
    const message = buildSubscriptionRenewalMessage(
      nearestRenewalSubscription,
      detailedCustomer,
      nearestRenewalService,
      renewalTemplate,
      language
    );
    if (!message) return;
    await copyCustomerField(message, 'Renewal message');
  };

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      <div className={detailedCustomerId ? 'hidden' : 'space-y-5'}>
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <span>{language === 'bn' ? 'কাস্টমার' : 'Customers'}</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'গ্রাহক, সাবস্ক্রিপশন, পেমেন্ট ও যোগাযোগ এক জায়গায় পরিচালনা করুন।'
              : 'Manage customers, subscriptions, payments and customer activity.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onOpenNewSaleForCustomer()}
            className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:inline-flex"
          >
            <CreditCard className="h-4 w-4" />
            New Sale
          </button>
          <button
            type="button"
            onClick={() => {
              const content = exportCustomersCSV(customers, sales, payments, subscriptions, invoices, activityLogs, services, currency);
              downloadCSV('customers.csv', content);
              logActivity({
                type: 'data_exported',
                title: 'Customers Exported',
                description: `${customers.filter(customer => !customer.isArchived).length} customer records were exported.`,
              });
              showToast('Customers exported successfully.', 'success');
            }}
            disabled={!customers.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Customers</span>
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('addCustomer')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {[
          {
            label: language === 'bn' ? 'মোট গ্রাহক' : 'Total Customers',
            value: customerSummary.total,
            icon: Users,
            color: 'text-slate-600 dark:text-slate-300',
            isCurrency: false,
          },
          {
            label: language === 'bn' ? 'সক্রিয় গ্রাহক' : 'Active Customers',
            value: customerSummary.activeCount,
            icon: CheckCircle2,
            color: 'text-emerald-600 dark:text-emerald-400',
            isCurrency: false,
          },
          {
            label: language === 'bn' ? 'নতুন গ্রাহক' : 'New Customers',
            value: customerSummary.newCustomers,
            icon: UserPlus,
            color: 'text-blue-600 dark:text-blue-400',
            isCurrency: false,
          },
          {
            label: language === 'bn' ? 'গ্রাহকের বকেয়া' : 'Customers With Due',
            value: customers.filter(customer => !customer.isArchived && (customerMetrics.get(customer.id)?.totalDue || 0) > 0).length,
            icon: AlertTriangle,
            color: 'text-rose-600 dark:text-rose-400',
            isCurrency: false,
          },
          {
            label: language === 'bn' ? 'নবায়ন বাকি' : 'Renewals Due',
            value: customerSummary.renewalsDue,
            icon: CalendarDays,
            color: 'text-amber-600 dark:text-amber-400',
            isCurrency: false,
          },
          {
            label: language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive Customers',
            value: customerSummary.inactiveCount,
            icon: Clock,
            color: 'text-slate-600 dark:text-slate-300',
            isCurrency: false,
          },
        ].map(metric => (
          <div key={metric.label} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-[#151C28] sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.label}</span>
              <metric.icon className={`h-4 w-4 shrink-0 ${metric.color}`} />
            </div>
            <div className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {customersError && customers.length === 0
                ? '—'
                : customersLoading && customers.length === 0
                ? <span className="block h-6 w-14 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                : metric.isCurrency ? formatCurrency(metric.value, currency) : metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* 2. SEARCH + FILTER TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input (Name, Phone, Email, Facebook ID) */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={
              language === 'bn'
                ? 'নাম, ফোন, ইমেইল, বা ফেসবুক আইডি দিয়ে খুঁজুন...'
                : 'Search customers...'
            }
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-11 pl-10 pr-10 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 shadow-2xs transition-all"
            aria-label="Search customers"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              aria-label="Clear customer search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Customer filters and sorting */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value as typeof filterStatus);
                setCurrentPage(1);
              }}
              className="h-11 px-3.5 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="all">
                {language === 'bn'
                  ? `সকল গ্রাহক (${customers.filter(c => !c.isArchived && c.status !== 'archived').length})`
                  : `All Customers (${customers.filter(c => !c.isArchived && c.status !== 'archived').length})`}
              </option>
              {customers.some(customer => customer.isArchived) && (
                <option value="archived">
                  {language === 'bn'
                    ? `আর্কাইভকৃত কাস্টমার (${customers.filter(c => c.isArchived).length})`
                    : `Archived Customers (${customers.filter(c => c.isArchived).length})`}
                </option>
              )}
            </select>
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="h-11 px-3.5 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="newest">{language === 'bn' ? 'নতুন' : 'Newest'}</option>
              <option value="oldest">{language === 'bn' ? 'পুরনো' : 'Oldest'}</option>
              <option value="name_asc">{language === 'bn' ? 'নাম (A-Z)' : 'Name (A-Z)'}</option>
              <option value="name_desc">{language === 'bn' ? 'নাম (Z-A)' : 'Name (Z-A)'}</option>
              <option value="spending">{language === 'bn' ? 'সর্বোচ্চ খরচ' : 'Most spent'}</option>
            </select>
          </div>

          {services.length > 0 && <select
            value={filterServiceId}
            onChange={e => {
              setFilterServiceId(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by service"
            className="h-11 max-w-full px-3 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সকল সার্ভিস' : 'All Services'}</option>
            {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>}

          {customers.some(customer => !customer.isArchived) && <select
            value={filterRenewal}
            onChange={e => {
              setFilterRenewal(e.target.value as typeof filterRenewal);
              setCurrentPage(1);
            }}
            aria-label="Filter by renewal status"
            className="h-11 max-w-full px-3 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সব নবায়ন' : 'All Renewals'}</option>
            <option value="due">{language === 'bn' ? 'নবায়ন বাকি' : 'Renewal Due'}</option>
            <option value="expired">{language === 'bn' ? 'মেয়াদোত্তীর্ণ' : 'Expired'}</option>
            <option value="none">{language === 'bn' ? 'সাবস্ক্রিপশন নেই' : 'No Subscription'}</option>
          </select>}

          <select
            value={filterCrmStatus}
            onChange={event => { setFilterCrmStatus(event.target.value as typeof filterCrmStatus); setCurrentPage(1); }}
            aria-label="Filter by customer status"
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-[#151C28] dark:text-slate-300"
          >
            <option value="all">All CRM statuses</option>
            <option value="active">Active</option>
            <option value="at_risk">At Risk</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={filterSubscription}
            onChange={event => { setFilterSubscription(event.target.value as typeof filterSubscription); setCurrentPage(1); }}
            aria-label="Filter by subscription"
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-[#151C28] dark:text-slate-300"
          >
            <option value="all">All subscriptions</option>
            <option value="active">Has active subscription</option>
            <option value="none">No active subscription</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={filterPayment}
            onChange={event => { setFilterPayment(event.target.value as typeof filterPayment); setCurrentPage(1); }}
            aria-label="Filter by payment status"
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-[#151C28] dark:text-slate-300"
          >
            <option value="all">All payments</option>
            <option value="paid">Fully paid</option>
            <option value="due">Has due</option>
            <option value="failed">Failed payment</option>
          </select>
          <select
            value={filterActivity}
            onChange={event => { setFilterActivity(event.target.value as typeof filterActivity); setCurrentPage(1); }}
            aria-label="Filter by customer activity"
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-slate-800 dark:bg-[#151C28] dark:text-slate-300"
          >
            <option value="all">All activity</option>
            <option value="new">New customers</option>
            <option value="recent">Recently active</option>
            <option value="inactive">Inactive</option>
          </select>
          <details className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-[#151C28] dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5" />
              Date filters
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid w-64 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <fieldset className="grid gap-2">
                <legend className="text-xs font-semibold text-slate-700 dark:text-slate-200">Created date</legend>
                <input type="date" aria-label="Created from" value={createdFrom} onChange={event => setCreatedFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700" />
                <input type="date" aria-label="Created to" value={createdTo} onChange={event => setCreatedTo(event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700" />
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="text-xs font-semibold text-slate-700 dark:text-slate-200">Last activity</legend>
                <input type="date" aria-label="Activity from" value={lastActivityFrom} onChange={event => setLastActivityFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700" />
                <input type="date" aria-label="Activity to" value={lastActivityTo} onChange={event => setLastActivityTo(event.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-700" />
              </fieldset>
              <button type="button" onClick={() => {
                setCreatedFrom(''); setCreatedTo(''); setLastActivityFrom(''); setLastActivityTo('');
              }} className="justify-self-start text-xs font-semibold text-emerald-700 dark:text-emerald-300">Clear dates</button>
            </div>
          </details>

          {/* Page size selector */}
          <div className="relative hidden sm:block">
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-11 px-3 bg-white dark:bg-[#151C28] border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400 focus:outline-hidden focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. ERROR BANNER */}
      {customersError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{customersError}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-rose-600 text-white rounded-md font-semibold text-xs hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. CUSTOMER TABLE & CARD LIST CONTAINER */}
      <div className="space-y-3">
        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-5">{language === 'bn' ? 'কাস্টমার' : 'Customer'}</th>
                <th className="py-3 px-5">{language === 'bn' ? 'ফোন' : 'Phone'}</th>
                <th className="py-3 px-5">{language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন' : 'Active Subscriptions'}</th>
                <th className="py-3 px-5">{language === 'bn' ? 'মোট খরচ' : 'Total Spent'}</th>
                <th className="py-3 px-5">{language === 'bn' ? 'বকেয়া' : 'Due'}</th>
                <th className="py-3 px-5">{language === 'bn' ? 'সর্বশেষ কার্যক্রম' : 'Last Activity'}</th>
                <th className="py-3 px-5">{language === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                <th className="py-3 px-5 text-right">{language === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {/* Loading State */}
              {customersLoading && customers.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="h-16 animate-pulse">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800" />
                        <div className="space-y-1.5 flex-1">
                          <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="w-36 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="w-24 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="w-16 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="w-16 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="w-20 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="w-12 h-6 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : paginatedCustomers.length === 0 ? (
                /* Empty State */
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
                        <Users className="w-7 h-7 stroke-[1.5]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {hasCustomerFilters
                            ? (language === 'bn' ? 'কোনো কাস্টমার পাওয়া যায়নি।' : 'No matching customers.')
                            : filterStatus === 'archived'
                            ? (language === 'bn' ? 'কোনো আর্কাইভকৃত কাস্টমার নেই।' : 'No archived customers.')
                            : customersError
                              ? (language === 'bn' ? 'গ্রাহক লোড করা যায়নি।' : 'Unable to load customers.')
                              : (language === 'bn' ? 'এখনও কোনো কাস্টমার নেই।' : 'No customers yet.')}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {hasCustomerFilters
                            ? (language === 'bn' ? 'অন্য নাম বা ফোন নম্বর দিয়ে খুঁজুন।' : 'Try a different search or filter.')
                            : customersError
                              ? (language === 'bn' ? 'আবার চেষ্টা করুন অথবা পরে রিলোড করুন।' : 'Retry to reload customer data.')
                              : (language === 'bn' ? 'শুরু করতে আপনার প্রথম কাস্টমার যোগ করুন।' : 'Add your first customer to get started.')}
                        </p>
                      </div>
                      {hasNoCustomers &&
                        !searchQuery &&
                        filterServiceId === 'all' &&
                        filterRenewal === 'all' &&
                        filterStatus !== 'archived' &&
                        !customersError && (
                        <button
                          onClick={openAddModal}
                          className="mt-1 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{language === 'bn' ? t('addCustomer') : 'Add Customer'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(cust => {
                  const metrics = customerMetrics.get(cust.id);
                  const activeCount = metrics?.activeCount || 0;
                  const spending = metrics?.spent || 0;
                  const canWhatsApp = canContact(cust.id);
                  const initials = getInitials(cust.name);
                  const avatarColor = getAvatarColorClass(cust.name);
                  const customerStatus = cust.isArchived ? 'Archived'
                    : metrics?.status === 'at_risk' ? 'At Risk'
                      : metrics?.status === 'inactive' ? 'Inactive' : 'Active';
                  const statusClass = cust.isArchived || metrics?.status === 'inactive'
                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    : metrics?.status === 'at_risk'
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => openCustomerDetails(cust.id)}
                      className="h-16 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Customer Cell: Avatar + Name + Email + FB */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border ${avatarColor}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm truncate flex items-center gap-1.5">
                              <span>{cust.name}</span>
                              {cust.isArchived && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-normal">
                                  Archived
                                </span>
                              )}
                              {cust.facebookUrl && (
                                <a
                                  href={cust.facebookUrl.startsWith('http') ? cust.facebookUrl : `https://${cust.facebookUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-blue-500 hover:text-blue-600 transition-colors"
                                  title={cust.facebookId ? `Facebook: ${cust.facebookId}` : 'Facebook Profile'}
                                >
                                  <Facebook className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                              <span>{cust.email || (language === 'bn' ? 'ইমেইল নেই' : 'No email')}</span>
                              {cust.facebookId && (
                                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate">
                                  · @{cust.facebookId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & WhatsApp Action */}
                      <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {cust.phone}
                          </span>
                          {canWhatsApp && <button type="button"
                            onClick={() => openMessage({ customerId: cust.id })}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-md border border-emerald-200/80 dark:border-emerald-800/60 transition-colors"
                            aria-label={`Compose WhatsApp message for ${cust.name}`}
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>WhatsApp</span>
                          </button>}
                        </div>
                      </td>

                      {/* Active Subscriptions */}
                      <td className="py-3.5 px-5">
                        <div className={`inline-flex items-center gap-1.5 text-xs ${activeCount > 0 ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <span>{activeCount}</span>
                        </div>
                      </td>

                      {/* Total Spent */}
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(spending, currency)}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 font-mono text-xs text-amber-700 dark:text-amber-300">
                        {formatCurrency(metrics?.totalDue || 0, currency)}
                      </td>

                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {metrics?.lastActivity ? formatAppDate(metrics.lastActivity, language) : '—'}
                      </td>

                      <td className="py-3.5 px-5">
                        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${statusClass}`}>
                          {customerStatus}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          {!cust.isArchived && <button
                            type="button"
                            onClick={() => onOpenNewSaleForCustomer(cust.id)}
                            aria-label={`New sale for ${cust.name}`}
                            title="New sale"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-950/40"
                          ><Plus className="h-4 w-4" /></button>}
                          {!cust.isArchived && onAddPaymentForCustomer && <button
                            type="button"
                            onClick={() => onAddPaymentForCustomer(cust.id)}
                            aria-label={`Add payment for ${cust.name}`}
                            title="Add payment"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700 dark:text-slate-300 dark:hover:bg-amber-950/40"
                          ><CreditCard className="h-4 w-4" /></button>}
                          <button
                            onClick={() => openCustomerDetails(cust.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {language === 'bn' ? 'দেখুন' : 'View'}
                          </button>
                          {cust.isArchived ? (
                            <button
                              onClick={() => handleRestore(cust.id, cust.name)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md transition-colors cursor-pointer"
                              title="Restore Customer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openEditModal(cust)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              title={t('edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setCustomerToDelete(cust)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                            title={cust.isArchived ? 'Permanent Delete' : 'Archive or Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="grid gap-3 sm:grid-cols-2">
          {customersLoading && customers.length === 0 ? (
            <div className="contents" aria-label="Loading customers">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#151C28]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-3 w-3/5 rounded bg-slate-100 dark:bg-slate-800/60" />
                    </div>
                  </div>
                  <div className="mt-4 h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
                  <div className="mt-3 h-8 w-28 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              ))}
            </div>
          ) : paginatedCustomers.length === 0 ? (
            <div className="col-span-full flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center dark:border-slate-700 dark:bg-[#151C28]">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {hasCustomerFilters
                    ? (language === 'bn' ? 'কোনো কাস্টমার পাওয়া যায়নি।' : 'No matching customers.')
                    : filterStatus === 'archived'
                      ? (language === 'bn' ? 'কোনো আর্কাইভকৃত কাস্টমার নেই।' : 'No archived customers.')
                    : customersError
                      ? (language === 'bn' ? 'গ্রাহক লোড করা যায়নি।' : 'Unable to load customers.')
                      : (language === 'bn' ? 'এখনও কোনো কাস্টমার নেই।' : 'No customers yet.')}
                </p>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {hasCustomerFilters
                    ? (language === 'bn' ? 'অন্য নাম বা ফোন নম্বর দিয়ে খুঁজুন।' : 'Try a different search or filter.')
                    : customersError
                      ? (language === 'bn' ? 'আবার চেষ্টা করতে রিলোড করুন।' : 'Reload to try again.')
                      : (language === 'bn' ? 'শুরু করতে আপনার প্রথম কাস্টমার যোগ করুন।' : 'Add your first customer to get started.')}
                </span>
                {hasNoCustomers &&
                  !searchQuery &&
                  filterServiceId === 'all' &&
                  filterRenewal === 'all' &&
                  filterStatus !== 'archived' &&
                  !customersError && (
                  <button
                    onClick={openAddModal}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4" />
                    {language === 'bn' ? t('addCustomer') : 'Add Customer'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            paginatedCustomers.map(cust => {
              const metrics = customerMetrics.get(cust.id);
              const activeCount = metrics?.activeCount || 0;
              const spending = metrics?.spent || 0;
              const canWhatsApp = canContact(cust.id);
              const initials = getInitials(cust.name);
              const avatarColor = getAvatarColorClass(cust.name);
              const valueTag = cust.tags?.find(tag => ['vip', 'high value'].includes(tag.trim().toLowerCase()));
              const customerStatus = cust.isArchived ? 'Archived'
                : metrics?.status === 'at_risk' ? 'At Risk'
                  : metrics?.status === 'inactive' ? 'Inactive' : 'Active';
              const statusClass = cust.isArchived || metrics?.status === 'inactive'
                ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : metrics?.status === 'at_risk'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300';
              const renewalSubscription = metrics?.subscriptions
                .filter(subscription => {
                  const days = getDaysDifference(subscription.expiryDate);
                  return subscription.status !== 'cancelled' && days >= 0 && days <= settings.reminderNoticeDays;
                })
                .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
              const renewalDays = renewalSubscription ? getDaysDifference(renewalSubscription.expiryDate) : null;

              return (
                <article
                  key={cust.id}
                  className="group min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-[border-color,box-shadow] hover:border-emerald-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#151C28] dark:hover:border-emerald-800"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${avatarColor}`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <button type="button" onClick={() => openCustomerDetails(cust.id)} className="min-w-0 truncate text-left text-[15px] font-bold text-slate-900 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-white dark:hover:text-emerald-300">
                            {cust.name}
                          </button>
                          {valueTag && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Sparkles className="h-2.5 w-2.5" />{valueTag}</span>}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {cust.phone || cust.id}
                          {cust.facebookId && <span className="text-blue-600 dark:text-blue-400"> · @{cust.facebookId}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass}`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${cust.isArchived || metrics?.status === 'inactive' ? 'bg-slate-400' : metrics?.status === 'at_risk' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {customerStatus}
                    </span>
                  </div>

                  <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                    {cust.phone && <a href={`tel:${cust.phone}`} onClick={event => event.stopPropagation()} className="inline-flex max-w-full items-center gap-1.5 truncate text-slate-600 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:text-emerald-300"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{cust.phone}</span></a>}
                    {cust.email && <a href={`mailto:${cust.email}`} onClick={event => event.stopPropagation()} className="inline-flex min-w-0 max-w-full items-center gap-1.5 truncate text-slate-600 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:text-emerald-300"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{cust.email}</span></a>}
                    {cust.facebookUrl && <a href={cust.facebookUrl.startsWith('http') ? cust.facebookUrl : `https://${cust.facebookUrl}`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} aria-label={`Facebook profile for ${cust.name}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"><Facebook className="h-3.5 w-3.5" /><span>Facebook</span></a>}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3.5 dark:border-slate-800 md:grid-cols-4">
                    <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Active Subscriptions</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{activeCount}</p></div>
                    <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Spent</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(spending, currency)}</p></div>
                    <div className={`min-w-0 rounded-lg px-2 py-1.5 ${metrics?.totalDue ? 'bg-amber-50/80 dark:bg-amber-950/25' : ''}`}><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Due</p><p className={`mt-1 truncate text-base font-semibold tabular-nums ${metrics?.totalDue ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>{formatCurrency(metrics?.totalDue || 0, currency)}</p></div>
                    <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Last Activity</p><p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{metrics?.lastActivity ? formatAppDate(metrics.lastActivity, language) : '—'}</p></div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${metrics?.status === 'at_risk' ? 'text-amber-700 dark:text-amber-300' : metrics?.status === 'inactive' ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${metrics?.status === 'at_risk' ? 'bg-amber-500' : metrics?.status === 'inactive' ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                      {customerStatus}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-slate-500 dark:text-slate-400">Last activity {metrics?.lastActivity ? formatAppDate(metrics.lastActivity, language) : 'not recorded'}</span>
                    {renewalSubscription && <button type="button" onClick={() => onViewSubscription(renewalSubscription.id)} className="rounded-md px-1.5 py-0.5 font-medium text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/40">{renewalDays === 0 ? 'Renewal due today' : `Renewal due in ${renewalDays} day${renewalDays === 1 ? '' : 's'}`}</button>}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {canWhatsApp ? <button type="button" onClick={() => openMessage({ customerId: cust.id })} aria-label={`Compose WhatsApp message for ${cust.name}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/40"><MessageCircle className="h-3.5 w-3.5" /><span>WhatsApp</span></button> : <span />}

                    <div className="flex flex-wrap items-center gap-1.5">
                      {!cust.isArchived && <button type="button" onClick={() => onOpenNewSaleForCustomer(cust.id)} aria-label={`New sale for ${cust.name}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"><Plus className="h-3.5 w-3.5" />New Sale</button>}
                      {!cust.isArchived && onAddPaymentForCustomer && <button type="button" onClick={() => onAddPaymentForCustomer(cust.id)} aria-label={`Add payment for ${cust.name}${metrics?.totalDue ? `, ${formatCurrency(metrics.totalDue, currency)} due` : ''}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><CreditCard className="h-3.5 w-3.5" />Payment{metrics?.totalDue ? ` · ${formatCurrency(metrics.totalDue, currency)} Due` : ''}</button>}
                      <button type="button" onClick={() => openCustomerDetails(cust.id)} aria-label={`View ${cust.name}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/40"><Eye className="h-3.5 w-3.5" /><span className="hidden sm:inline">View customer</span><span className="sm:hidden">View</span></button>
                      <div className="relative">
                        <button type="button" onClick={() => setOpenMoreCustomerId(openMoreCustomerId === cust.id ? null : cust.id)} aria-haspopup="menu" aria-expanded={openMoreCustomerId === cust.id} aria-label={`More actions for ${cust.name}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><span>More</span><ChevronDown className="h-3.5 w-3.5" /></button>
                        {openMoreCustomerId === cust.id && <div className="absolute bottom-full right-0 z-20 mb-1 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          <button type="button" onClick={() => { setOpenMoreCustomerId(null); openCustomerDetails(cust.id); }} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">View customer</button>
                          {!cust.isArchived && <button type="button" onClick={() => { setOpenMoreCustomerId(null); openEditModal(cust); }} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">Edit</button>}
                          {!cust.isArchived && <button type="button" onClick={() => { setOpenMoreCustomerId(null); onOpenNewSaleForCustomer(cust.id); }} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">New Sale</button>}
                          {!cust.isArchived && onAddPaymentForCustomer && <button type="button" onClick={() => { setOpenMoreCustomerId(null); onAddPaymentForCustomer(cust.id); }} className="w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">Add Payment</button>}
                          {cust.isArchived && <button type="button" onClick={() => { setOpenMoreCustomerId(null); void handleRestore(cust.id, cust.name); }} className="w-full rounded-md px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/40">Restore</button>}
                          <button type="button" onClick={() => { setOpenMoreCustomerId(null); setCustomerToDelete(cust); }} className="w-full rounded-md px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 dark:text-rose-300 dark:hover:bg-rose-950/40">{cust.isArchived ? 'Permanently delete' : 'Archive or delete'}</button>
                        </div>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* 5. PAGINATION FOOTER */}
        {filteredCustomers.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-1 py-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              {language === 'bn' ? 'প্রদর্শিত হচ্ছে' : 'Showing'}{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {(currentPage - 1) * pageSize + 1}
              </span>–<span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(currentPage * pageSize, filteredCustomers.length)}
              </span>{' '}of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {filteredCustomers.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                aria-label="Previous customers page"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div aria-live="polite" className="min-w-8 text-center font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {currentPage}
              </div>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                aria-label="Next customers page"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#151C28]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Renewal Opportunities</h2>
              <p className="mt-1 text-xs text-slate-500">Expiring subscriptions and recently expired renewals.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{renewalOpportunityRows.length}</span>
          </div>
          {renewalOpportunityRows.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50">No upcoming renewal opportunities.</p> : (
            <ul className="space-y-2">
              {renewalOpportunityRows.map(({ subscription, customer, service, daysRemaining }) => (
                <li key={subscription.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <button type="button" onClick={() => openCustomerDetails(customer.id)} className="min-w-0 text-left">
                    <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">{customer.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{service?.name || 'Service'} · {subscription.plan} · {formatCurrency(subscription.price, subscription.currency)}</span>
                    <span className="block text-[10px] text-amber-700 dark:text-amber-300">{daysRemaining < 0 ? `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago` : daysRemaining === 0 ? 'Expires today' : `Expires in ${daysRemaining} days`}</span>
                  </button>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => onViewSubscription(subscription.id)} className="rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">View</button>
                    <button type="button" onClick={() => onRenewSubscription(subscription)} className="rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700">Renew</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#151C28]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Outstanding Balance</h2>
              <p className="mt-1 text-xs text-slate-500">Open sales with a balance calculated from actual payment records.</p>
            </div>
            <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{outstandingBalanceRows.length}</span>
          </div>
          {outstandingBalanceRows.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50">No outstanding balances.</p> : (
            <ul className="space-y-2">
              {outstandingBalanceRows.map(({ sale, customer, due }) => (
                <li key={sale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <button type="button" onClick={() => openCustomerDetails(customer.id)} className="min-w-0 text-left">
                    <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">{customer.name} · {sale.invoiceNo}</span>
                    <span className="block truncate text-[11px] text-slate-500">{sale.plan} · {formatAppDate(sale.date, language)} · Due {formatCurrency(due, sale.currency)}</span>
                  </button>
                  <div className="flex gap-1.5">
                    {onAddPaymentForCustomer && <button type="button" onClick={() => onAddPaymentForCustomer(customer.id)} className="rounded-md bg-amber-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700">Add Payment</button>}
                    <button type="button" onClick={() => onViewSale(sale.id)} className="rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">View Sale</button>
                    <button type="button" onClick={() => handleOpenInvoice(sale)} className="rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Invoice</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      </div>

      {detailedCustomerId && (
        customersLoading ? (
          <div className="mx-auto w-full max-w-[1400px] animate-pulse space-y-5" aria-label="Loading customer details">
            <div className="h-8 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map(item => <div key={item} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />)}
            </div>
            <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : detailsLoadError ? (
          <div className="mx-auto w-full max-w-[1400px] rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#151C28]">
            <p className="text-sm text-slate-600 dark:text-slate-300">Could not load this information.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Try Again
            </button>
          </div>
        ) : !detailedCustomer ? (
          <div className="mx-auto w-full max-w-[1400px] rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#151C28]">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Customer not found.</p>
            <button
              type="button"
              onClick={() => {
                setDetailedCustomerId(null);
                onClearSelectedCustomer?.();
              }}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Back to Customers
            </button>
          </div>
        ) : (
        <div className="mx-auto w-full max-w-[1400px] space-y-5">
          <button
            type="button"
            onClick={() => {
              setDetailedCustomerId(null);
              onClearSelectedCustomer?.();
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Customers
          </button>
          <div className="space-y-6">
            {/* Header info card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 border ${getAvatarColorClass(
                    detailedCustomer.name
                  )}`}
                >
                  {getInitials(detailedCustomer.name)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {detailedCustomer.name?.trim() || '—'}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      detailedCrmMetrics?.status === 'at_risk'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : detailedCrmMetrics?.status === 'inactive'
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    }`}>
                      {detailedCrmMetrics?.status === 'at_risk' ? 'At Risk' : detailedCrmMetrics?.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{detailedCustomer.phone?.trim() || '—'}</span>
                    <span className="break-all">{detailedCustomer.email?.trim() || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {canContact(detailedCustomer.id) ? (
                  <button type="button"
                    onClick={() => openMessage({ customerId: detailedCustomer.id })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp Customer
                  </button>
                ) : <span className="text-xs text-slate-500">No phone number available · <button type="button" onClick={() => openEditModal(detailedCustomer)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Add Phone Number</button></span>}
                <button
                  onClick={() => {
                    onOpenNewSaleForCustomer(detailedCustomer.id);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Sale</span>
                </button>
                {onAddPaymentForCustomer && <button
                  type="button"
                  onClick={() => onAddPaymentForCustomer(detailedCustomer.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                ><CreditCard className="h-3.5 w-3.5" />Add Payment</button>}
                {detailedSales.length > 0 && (() => {
                  const latestSale = [...detailedSales].sort((a, b) => b.date.localeCompare(a.date))[0];
                  const hasInvoice = invoices.some(invoice => invoice.saleId === latestSale.id);
                  return <button
                    type="button"
                    onClick={() => handleOpenInvoice(latestSale)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                  ><Receipt className="h-3.5 w-3.5" />{hasInvoice ? 'View Invoice' : 'Create Invoice'}</button>;
                })()}

                <button
                  onClick={() => {
                    openEditModal(detailedCustomer);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Customer
                </button>
              </div>
            </div>

            {canContact(detailedCustomer.id) && <section aria-label="Customer WhatsApp actions" className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="mb-2 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /><h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">WhatsApp · {detailedCustomer.whatsapp?.trim() || detailedCustomer.phone}</h3></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Custom Message</button>
                {detailedDueSale && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, saleId: detailedDueSale.id, templateId: 'payment_reminder' })} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-300">Payment Reminder</button>}
                {nearestRenewalSubscription && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, subscriptionId: nearestRenewalSubscription.id, templateId: getExpiryWhatsAppTemplateId(getDaysDifference(nearestRenewalSubscription.expiryDate)) })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Renewal Reminder</button>}
                {detailedLatestInvoice && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, invoiceId: detailedLatestInvoice.invoiceId, templateId: 'invoice_ready' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Send Invoice</button>}
                {detailedSuccessfulPayment && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, paymentId: detailedSuccessfulPayment.id, templateId: 'payment_received' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Payment Confirmation</button>}
                {nearestRenewalSubscription && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, subscriptionId: nearestRenewalSubscription.id, templateId: 'subscription_details' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Subscription Details</button>}
              </div>
            </section>}

            <section aria-label="Customer reminders" className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <h3 className="mb-2 text-xs font-bold text-slate-800 dark:text-slate-100">Reminders ({detailedReminders.length})</h3>
              {detailedReminders.length === 0 ? <p className="text-xs text-slate-500">No open reminders for this customer.</p> : <div className="space-y-2">
                {detailedReminders.slice(0, 4).map(reminder => <div key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                  <div className="min-w-0"><p className="truncate font-semibold">{reminder.title}</p><p className="text-slate-500">{formatAppDate(reminder.dueDate, language)} · {reminder.priority}</p></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => completeReminder(reminder.id)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Complete</button>
                    <button type="button" onClick={() => snoozeReminder(reminder.id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())} className="font-semibold text-slate-600 hover:underline dark:text-slate-300">Snooze</button>
                  </div>
                </div>)}
              </div>}
            </section>

            {/* Quick KPI stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  {language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন' : 'Active Subscriptions'}
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {currentActiveSubsForDetailed.length}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Total Spent
                </div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  {formatCurrency(detailedTotalSales, currency)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Due</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5 font-mono">
                  {formatCurrency(detailedTotalDue, currency)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Purchases</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {detailedCrmMetrics?.salesCount || 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Last Purchase</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {detailedCrmMetrics?.lastPurchase ? formatAppDate(detailedCrmMetrics.lastPurchase, language) : '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Total Paid
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                  {formatCurrency(detailedTotalPaid, currency)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  {language === 'bn' ? 'পরবর্তী নবায়ন' : 'Next renewal'}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {customerMetrics.get(detailedCustomer.id)?.nextRenewal
                    ? formatAppDate(customerMetrics.get(detailedCustomer.id)?.nextRenewal || '', language)
                    : '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">First Purchase</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {detailedCrmMetrics?.firstPurchase ? formatAppDate(detailedCrmMetrics.firstPurchase, language) : '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Renewals</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {detailedCrmMetrics?.renewals || 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Average Sale</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {formatCurrency(detailedCrmMetrics?.averageSale || 0, currency)}
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer Information</div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Full Name</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">{detailedCustomer.name?.trim() || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">{detailedCustomer.phone?.trim() || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                  <dd className="mt-1 break-all font-medium text-slate-900 dark:text-white">
                    {detailedCustomer.email?.trim()
                      ? <a href={`mailto:${detailedCustomer.email}`} className="hover:underline">{detailedCustomer.email}</a>
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Customer Since</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                    {detailedCustomer.createdAt ? formatAppDate(detailedCustomer.createdAt, language) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Last Updated</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                    {detailedCustomer.updatedAt ? formatAppDateTime(detailedCustomer.updatedAt, language) : '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500 dark:text-slate-400">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900 dark:text-white">{safeCustomerNote(detailedCustomer.notes).trim() || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Preferred Contact</dt>
                  <dd className="mt-1 font-medium capitalize text-slate-900 dark:text-white">
                    {detailedCustomer.preferences?.contactMethod || 'Phone'}
                    {detailedCustomer.preferences?.contactAllowed === false ? ' · Not allowed' : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Preferred Language</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                    {detailedCustomer.preferences?.language === 'bn' ? 'Bangla' : 'English'}
                  </dd>
                </div>
              </dl>
            </div>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Customer Tags</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(detailedCustomer.tags || []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {tag}
                      <button type="button" onClick={() => void removeCustomerTag(detailedCustomer, tag)} aria-label={`Remove ${tag} tag`} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-rose-600 dark:hover:bg-slate-700">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {!(detailedCustomer.tags || []).length && <span className="text-xs text-slate-500">No tags yet.</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <label htmlFor="customer-new-tag" className="sr-only">Add or create a customer tag</label>
                  <input id="customer-new-tag" value={newTag} onChange={event => setNewTag(event.target.value)} onKeyDown={event => {
                    if (event.key === 'Enter') { event.preventDefault(); void saveCustomerTag(detailedCustomer, newTag); }
                  }} placeholder="Add a custom tag" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700" />
                  <button type="button" onClick={() => void saveCustomerTag(detailedCustomer, newTag)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">Add tag</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['VIP', 'Regular', 'New', 'High Value', 'Renewal Due', 'Has Due', 'At Risk'].map(tag => (
                    !(detailedCustomer.tags || []).some(existing => existing.toLowerCase() === tag.toLowerCase())
                      ? <button key={tag} type="button" onClick={() => void saveCustomerTag(detailedCustomer, tag)} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:border-emerald-400 dark:border-slate-700 dark:text-slate-300">{tag}</button>
                      : null
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Customer Notes</h4>
                <p className="mt-1 text-[11px] text-slate-500">Do not include passwords, PINs, or account credentials.</p>
                <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={2} aria-label="Add a customer note" placeholder="Add a note about this customer..." className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700" />
                <button type="button" onClick={saveCustomerNote} disabled={!noteDraft.trim()} className="mt-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Add Note</button>
                <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {[...(detailedCustomer.notesHistory || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(note => (
                    <li key={note.id} className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-700">
                      {editingNoteId === note.id ? (
                        <>
                          <textarea value={editingNoteText} onChange={event => setEditingNoteText(event.target.value)} rows={2} aria-label="Edit customer note" className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs dark:border-slate-600" />
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={saveCustomerNote} className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Save</button>
                            <button type="button" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }} className="text-[11px] font-semibold text-slate-500">Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200">{safeCustomerNote(note.text)}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <time className="text-[10px] text-slate-500">{formatAppDateTime(note.createdAt, language)}{note.updatedAt !== note.createdAt ? ' · edited' : ''}</time>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }} className="text-[10px] font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-300">Edit</button>
                              <button type="button" onClick={() => removeCustomerNote(note.id)} className="text-[10px] font-semibold text-rose-600">Delete</button>
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Subscriptions */}
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>
                  Subscriptions ({detailedSubs.length}) · Active {currentActiveSubsForDetailed.length}
                  {' · '}Ending Soon {endingSoonSubsForDetailed.length}
                  {' · '}Expired {expiredSubsForDetailed.length}
                </span>
              </div>
              {detailedSubs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <p>No subscriptions yet.</p>
                  <button
                    type="button"
                    onClick={() => onOpenNewSaleForCustomer(detailedCustomer.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Sale
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeSubsForDetailed.map(sub => {
                    const srv = services.find(s => s.id === sub.serviceId);
                    const account = accounts.find(item => item.id === sub.accountId);
                    const profile = account?.profiles.find(item => item.id === sub.profileId);
                    const badge = getExpiryBadgeInfo(sub.expiryDate, language, getSubscriptionReminderDays(srv, sub.planId, settings.reminderNoticeDays));
                    const daysLeft = getDaysDifference(sub.expiryDate);
                    const statusLabel = badge.status === 'expired' ? 'Expired' : badge.status === 'expiring_soon' ? 'Ending Soon' : 'Active';
                    return (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-sm text-slate-900 dark:text-white">
                            {srv?.name || 'Subscription Service'}
                          </div>
                          <div className="truncate text-xs text-slate-500 mt-0.5">
                            {sub.plan} · {formatCurrency(sub.price, sub.currency)}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Start Date: {sub.startDate ? formatAppDate(sub.startDate, language) : '—'}
                            {' · '}End Date: {sub.expiryDate ? formatAppDate(sub.expiryDate, language) : '—'}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                          </div>
                          {(account || profile) && (
                            <div className="mt-0.5 truncate text-[11px] text-slate-400">
                              {account?.email || account?.username || ''}
                              {profile ? ` · ${profile.profileName}` : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                badge.status === 'expiring_soon'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {statusLabel}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              Exp: {formatAppDate(sub.expiryDate, language)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onViewSubscription?.(sub.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 rounded-lg"
                          >
                            View
                          </button>
                          {account && <button
                            type="button"
                            onClick={() => onViewSubscription?.(sub.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30 rounded-lg"
                          >
                            Change Profile
                          </button>}

                          {detailedCustomer.phone && <button
                            type="button"
                            onClick={() => void copyCustomerField(detailedCustomer.phone, 'Phone')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                          ><Copy className="h-3.5 w-3.5" />Copy Phone</button>}
                          {detailedCustomer.email && <button
                            type="button"
                            onClick={() => void copyCustomerField(detailedCustomer.email, 'Email')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                          ><Copy className="h-3.5 w-3.5" />Copy Email</button>}
                          {renewalTemplate && <button
                            type="button"
                            onClick={() => void copyRenewalMessage()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                          ><Copy className="h-3.5 w-3.5" />Copy Renewal Message</button>}

                          <button
                            onClick={() => {
                              onRenewSubscription(sub);
                              setDetailedCustomerId(null);
                              onClearSelectedCustomer?.();
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                          >
                            {language === 'bn' ? 'নবায়ন' : 'Renew'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Expired Subscriptions Section */}
            {expiredSubsForDetailed.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                  Expired Subscriptions ({expiredSubsForDetailed.length})
                </div>
                <div className="space-y-2">
                  {expiredSubsForDetailed.map(sub => {
                    const srv = services.find(s => s.id === sub.serviceId);
                    return (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-700 dark:text-slate-300">
                            {srv?.name || '—'} — {sub.plan || '—'}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            Start Date: {sub.startDate ? formatAppDate(sub.startDate, language) : '—'}
                            {' · '}End Date: {sub.expiryDate ? formatAppDate(sub.expiryDate, language) : '—'}
                            {' · '}Days Left: 0 · Status: Expired
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onViewSubscription(sub.id);
                            setDetailedCustomerId(null);
                            onClearSelectedCustomer?.();
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {language === 'bn' ? 'দেখুন' : 'View'}
                        </button>
                        <button
                          onClick={() => {
                            onRenewSubscription(sub);
                            setDetailedCustomerId(null);
                            onClearSelectedCustomer?.();
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-200 hover:bg-emerald-600 hover:text-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Re-activate
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sales History */}
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Sales ({detailedSales.length})
                </div>
              </div>
              {detailedSales.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                  No sales yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...detailedSales]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(sale => (
                      <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                            {formatAppDate(sale.date, language)} · {services.find(service => service.id === sale.serviceId)?.name || '—'} · {sale.plan || '—'}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">{sale.invoiceNo}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-right font-mono text-slate-700 dark:text-slate-200">
                            <span className="block font-bold text-slate-900 dark:text-white">{formatCurrency(sale.amount, sale.currency)}</span>
                            <span className="block text-[10px] text-slate-500">Paid {formatCurrency(getSalePaidAmount(sale, payments), sale.currency)} · Due {formatCurrency(getSaleDueAmount(sale, payments), sale.currency)}</span>
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {getSalePaymentStatus(sale, payments)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onViewSale(sale.id)}
                            className="rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            View Sale
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(sale)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            {language === 'bn' ? 'ইনভয়েস' : 'View invoice'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Customer Invoices */}
            <div>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Invoices ({detailedInvoices.length})
              </div>
              {detailedInvoices.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                  No invoices yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailedInvoices.map(invoice => {
                    const sale = detailedSales.find(item => item.id === invoice.saleId);
                    if (!sale) return null;
                    return (
                      <div key={invoice.invoiceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {invoice.invoiceNumber} · {formatAppDate(invoice.invoiceDate, language)}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            Total {formatCurrency(invoice.totalAmount, sale.currency)}
                            {' · '}Paid {formatCurrency(invoice.paidAmount, sale.currency)}
                            {' · '}Due {formatCurrency(invoice.dueAmount, sale.currency)}
                          </div>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {invoice.paymentStatus}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(sale)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            View Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadInvoice(sale)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download JPG
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Payments Section */}
            <div>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Payments ({detailedPayments.length})
              </div>
              {detailedPayments.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                  No payments yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...detailedPayments]
                    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
                    .map(pay => {
                      const linkedSale = pay.saleId
                        ? detailedSales.find(sale => sale.id === pay.saleId)
                        : detailedSales.find(sale => sale.subscriptionId && sale.subscriptionId === pay.subscriptionId);
                      const serviceId = linkedSale?.serviceId ||
                        subscriptions.find(subscription => subscription.id === pay.subscriptionId)?.serviceId;
                      return (
                        <div key={pay.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                              {services.find(service => service.id === serviceId)?.name || (language === 'bn' ? 'সার্ভিস অনুপলব্ধ' : 'Service unavailable')}
                            </div>
                            <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                              {formatAppDate(pay.paymentDate, language)} · {pay.paymentMethodName || pay.paymentMethod}
                              {pay.transactionId ? ` · ${pay.transactionId}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {formatCurrency(pay.amount, pay.currency)}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {pay.paymentStatus}
                            </span>
                            {onViewPayment && <button type="button" onClick={() => onViewPayment(pay.id)} className="rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">View Payment</button>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Activity & History Trail */}
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Recent Activity</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  ({detailedActivities.length} {detailedActivities.length === 1 ? 'record' : 'records'})
                </span>
              </div>
              {detailedActivities.length === 0 ? (
                <div className="p-3.5 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No activity yet.
                </div>
              ) : (
                <ol aria-label="Customer activity timeline" className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {detailedActivities.map(act => (
                    <li
                      key={act.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {act.title}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                          {act.description}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
                        {formatAppDateTime(act.timestamp, language)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
        )
      )}

      {/* 7. ADD / EDIT CUSTOMER MODAL */}
      {(isAddModalOpen || editingCustomer) && (
        <Modal
          isOpen={isAddModalOpen || !!editingCustomer}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingCustomer(null);
            setFormErrors({});
            setDuplicateCustomer(null);
            setAllowDuplicate(false);
          }}
          title={
            editingCustomer
              ? language === 'bn'
                ? 'কাস্টমার প্রোফাইল সম্পাদনা'
                : 'Edit Customer Profile'
              : language === 'bn'
              ? 'নতুন কাস্টমার যোগ করুন'
              : 'Add New Customer'
          }
          maxWidth="lg"
        >
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            {duplicateCustomer && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="font-semibold">
                  {language === 'bn'
                    ? 'একই ফোন বা ইমেইলে একজন গ্রাহক পাওয়া গেছে।'
                    : 'Possible duplicate customer found by phone or email.'}
                </div>
                <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  {duplicateCustomer.name} · {duplicateCustomer.phone}{duplicateCustomer.email ? ` · ${duplicateCustomer.email}` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      openCustomerDetails(duplicateCustomer.id);
                      setDuplicateCustomer(null);
                      setIsAddModalOpen(false);
                      setEditingCustomer(null);
                    }}
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold dark:border-amber-800"
                  >
                    {language === 'bn' ? 'বিদ্যমান গ্রাহক দেখুন' : 'View existing customer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllowDuplicate(true);
                      setDuplicateOfCustomerId(duplicateCustomer.id);
                      setDuplicateCustomer(null);
                    }}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
                  >
                    {language === 'bn' ? 'তবুও চালিয়ে যান' : 'Continue anyway'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllowDuplicate(true);
                      setDuplicateOfCustomerId(duplicateCustomer.id);
                      setDuplicateCustomer(null);
                    }}
                    className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-950/60"
                  >
                    Mark as Duplicate
                  </button>
                </div>
              </div>
            )}
            {/* Full Name * */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('customerName')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="e.g. Tanvir Hasan"
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-colors ${
                  formErrors.name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {formErrors.name && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            {/* Phone * & WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('phone')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    setAllowDuplicate(false);
                    if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  placeholder="+880 1711-223344"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono transition-colors ${
                    formErrors.phone ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {formErrors.phone && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('whatsappNumber')}
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="Defaults to Phone"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setAllowDuplicate(false);
                  if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder="tanvir@example.com"
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-colors ${
                  formErrors.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {formErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.email}</p>
              )}
            </div>

            {/* Facebook URL & Facebook ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('facebookProfile')}
                </label>
                <input
                  type="text"
                  value={facebookUrl}
                  onChange={e => {
                    setFacebookUrl(e.target.value);
                    if (formErrors.facebookUrl) setFormErrors(prev => ({ ...prev, facebookUrl: '' }));
                  }}
                  placeholder="https://facebook.com/username"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-colors ${
                    formErrors.facebookUrl ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {formErrors.facebookUrl && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.facebookUrl}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('facebookId')}
                </label>
                <input
                  type="text"
                  value={facebookId}
                  onChange={e => setFacebookId(e.target.value)}
                  placeholder="tanvir.prime"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('address')}
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Dhanmondi, Dhaka"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('notes')}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="VIP buyer, prefers bKash payment..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <fieldset className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-3">
              <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">Contact Preferences</legend>
              <div>
                <label htmlFor="customer-contact-method" className="mb-1 block text-[11px] font-medium text-slate-500">Preferred contact</label>
                <select id="customer-contact-method" value={contactMethod} onChange={event => setContactMethod(event.target.value as typeof contactMethod)} className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-2 text-xs dark:border-slate-700">
                  <option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="customer-contact-permission" className="mb-1 block text-[11px] font-medium text-slate-500">Contact permission</label>
                <select id="customer-contact-permission" value={contactAllowed === undefined ? 'unset' : contactAllowed ? 'allowed' : 'not-allowed'} onChange={event => setContactAllowed(event.target.value === 'unset' ? undefined : event.target.value === 'allowed')} className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-2 text-xs dark:border-slate-700">
                  <option value="unset">Not set</option><option value="allowed">Allowed</option><option value="not-allowed">Not allowed</option>
                </select>
              </div>
              <div>
                <label htmlFor="customer-language" className="mb-1 block text-[11px] font-medium text-slate-500">Preferred language</label>
                <select id="customer-language" value={preferredLanguage} onChange={event => setPreferredLanguage(event.target.value as typeof preferredLanguage)} className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-2 text-xs dark:border-slate-700">
                  <option value="en">English</option><option value="bn">Bangla</option>
                </select>
              </div>
            </fieldset>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCustomer(null);
                  setFormErrors({});
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {allowDuplicate && !editingCustomer
                    ? language === 'bn' ? 'তবুও তৈরি করুন' : 'Create customer anyway'
                    : editingCustomer ? t('save') : t('addCustomer')}
                </span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. SAFE DELETION / ARCHIVAL CONFIRMATION DIALOG */}
      {customerToDelete && (
        <Modal
          isOpen={!!customerToDelete}
          onClose={() => setCustomerToDelete(null)}
          title={
            language === 'bn'
              ? 'কাস্টমার অপসারণ / আর্কাইভ নিশ্চিতকরণ'
              : 'Confirm Customer Removal / Archival'
          }
          maxWidth="md"
        >
          {(() => {
            const relSubs = subscriptions.filter(s => s.customerId === customerToDelete.id);
            const relSales = sales.filter(
              sale => sale.customerId === customerToDelete.id ||
                resolveSaleCustomer(sale, customers, subscriptions)?.id === customerToDelete.id
            );
            const relPayments = payments.filter(
              payment => payment.customerId === customerToDelete.id ||
                resolvePaymentCustomer(payment, customers, sales, subscriptions)?.id === customerToDelete.id
            );
            const hasHistory = relSubs.length > 0 || relSales.length > 0 || relPayments.length > 0;

            return (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      {customerToDelete.name} ({customerToDelete.phone})
                    </p>
                    {hasHistory ? (
                      <p className="leading-relaxed">
                        {language === 'bn'
                          ? `এই কাস্টমারের সাথে ${relSubs.length} টি সাবস্ক্রিপশন, ${relSales.length} টি বিক্রয় এবং ${relPayments.length} টি পেমেন্ট রেকর্ড যুক্ত রয়েছে। দোকানের আর্থিক হিসাব ও ইতিহাস সুরক্ষিত রাখতে কাস্টমারকে স্থায়ীভাবে মুছে ফেলার পরিবর্তে নিরাপদে আর্কাইভ করা হবে।`
                          : `This customer has ${relSubs.length} subscriptions, ${relSales.length} sales, and ${relPayments.length} payments on record. To preserve financial and purchase history, this customer will be archived instead of deleted.`}
                      </p>
                    ) : (
                      <p className="leading-relaxed">
                        {language === 'bn'
                          ? 'এই কাস্টমারের কোনো সাবস্ক্রিপশন, বিক্রয় বা পেমেন্ট রেকর্ড নেই। আপনি কি নিশ্চিত যে আপনি এই কাস্টমারকে স্থায়ীভাবে মুছে ফেলতে চান?'
                          : 'This customer has no associated sales, subscriptions, or payments. Are you sure you want to permanently delete this customer?'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCustomerToDelete(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    {t('cancel')}
                  </button>

                  {hasHistory ? (
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(false)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'নিরাপদে আর্কাইভ করুন' : 'Safe Archive Customer'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(true)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
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
      {selectedInvoiceData && (
        <InvoicePreviewModal
          isOpen={Boolean(selectedInvoiceData)}
          onClose={() => setSelectedInvoiceData(null)}
          saleData={selectedInvoiceData}
          onViewSale={onViewSale}
        />
      )}
    </div>
  );
};
