import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Copy,
  MoreVertical,
  Printer,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { StatCard } from '../common/StatCard';
import type { Customer, CustomerType, Subscription } from '../../types';
import { CustomerNameWithType } from '../common/CustomerNameWithType';
import { getCustomerType } from '../../utils/relationships';
import { getFirstCustomerFormErrorTarget } from '../../utils/customerFormHelpers';
import { buildCustomerTimeline } from '../../utils/customerTimeline';
import {
  buildCustomerStatement,
  getCustomerStatementPeriod,
  renderCustomerStatementHtml,
  type CustomerStatementFilter,
} from '../../utils/customerStatement';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import { InvoiceSaleDetails, downloadInvoiceImage, generateInvoiceImage } from '../../utils/invoiceGenerator';
import { resolvePaymentCustomer, resolveSaleCustomer } from '../../utils/relationships';
import {
  getCustomerAdvanceCredit,
  getPaymentRecognizedAmount,
  getSaleDueAmount,
  getSaleLineFinancialAllocations,
  getSaleLineItems,
  getSalePaidAmount,
  getSalePaymentStatus,
} from '../../utils/saleUtils';
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
  formatCurrency,
  getDateInTimeZone,
  getExpiryBadgeInfo,
  getDaysDifferenceForTimeZone,
  getSubscriptionStatusForTimeZone,
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
  onViewInvoice?: (invoiceId: string) => void;
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
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40',
  'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40',
  'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40',
  'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/40',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-300/60 dark:border-indigo-700/40',
];

const customerCardAccentColors = ['#6366f1', '#3b82f6', '#0ea5e9', '#8b5cf6', '#4f46e5', '#2563eb'];

function getAvatarColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColorStyles.length;
  return avatarColorStyles[index];
}

function getCustomerCardAccent(customerId: string): string {
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = customerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return customerCardAccentColors[Math.abs(hash) % customerCardAccentColors.length];
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
  onViewInvoice,
  initialCustomerFilter,
  initialServiceFilterId,
  onInitialCustomerFilterHandled,
}) => {
  const { formatCurrency, formatDate: formatAppDate, formatEventDateTime: formatAppEventDateTime, formatNumber } = useAppFormatting();
  const {
    currentBusiness,
    currentBusinessName,
    customers,
    customersLoading,
    customersError,
    storageWarning,
    subscriptions,
    sales,
    invoices,
    payments,
    accounts,
    financialAccounts,
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
  const getDaysDifference = getDaysDifferenceForTimeZone(settings.businessProfile?.timeZone);
  const getSubscriptionStatus = getSubscriptionStatusForTimeZone(settings.businessProfile?.timeZone);
  const { openMessage, canContact } = useWhatsAppCommunication();
  const serviceById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
  const { showToast } = useToast();

  // Search & Filter & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'spending'>('newest');
  const [filterStatus, setFilterStatus] = useState<'all' | 'archived'>('all');
  const [filterCrmStatus, setFilterCrmStatus] = useState<'all' | 'active' | 'at_risk' | 'inactive'>('all');
  const [filterCustomerType, setFilterCustomerType] = useState<'all' | CustomerType>('all');
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

  useEffect(() => {
    setCurrentPage(1);
  }, [createdFrom, createdTo, lastActivityFrom, lastActivityTo]);

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
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'sales' | 'payments' | 'subscriptions' | 'refunds'>('all');
  const [statementFilter, setStatementFilter] = useState<CustomerStatementFilter>('all');
  const [statementSearch, setStatementSearch] = useState('');
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Customer');
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
  useEffect(() => {
    setNewTag('');
    setNoteDraft('');
    setEditingNoteId(null);
    setEditingNoteText('');
  }, [detailedCustomerId]);

  // Validation Errors State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New single-screen form (mirrors the Add Service form): the essentials
  // live on one screen and everything optional sits behind one collapsed
  // "আরও সেটিংস (ঐচ্ছিক)" section.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const facebookInputRef = useRef<HTMLInputElement | null>(null);

  const jumpToFirstFormError = () => {
    const target = getFirstCustomerFormErrorTarget({ name, phone, email, facebookUrl });
    if (target === 'name') {
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameInputRef.current?.focus({ preventScroll: true });
    } else if (target === 'phone') {
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phoneInputRef.current?.focus({ preventScroll: true });
    } else if (target === 'email' || target === 'facebook') {
      // Both live inside the collapsed advanced section: open it first,
      // then scroll to and focus the field once it is rendered.
      setAdvancedOpen(true);
      window.setTimeout(() => {
        const el = target === 'email' ? emailInputRef.current : facebookInputRef.current;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
      }, 60);
    }
  };

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
    setCustomerType('Customer');
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
    setAdvancedOpen(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setCustomerType(getCustomerType(cust) || 'Customer');
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
    setAdvancedOpen(false);
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = language === 'bn' ? 'কাস্টমারের পূর্ণ নাম আবশ্যক' : 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = language === 'bn' ? 'নাম কমপক্ষে ২ অক্ষরের হতে হবে' : 'Name must have at least 2 characters.';
    }

    if (!phone.trim()) {
      errors.phone = language === 'bn' ? 'ফোন নম্বর আবশ্যক' : 'Phone number is required';
    } else {
      const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
      if (cleanPhoneDigits.length < 6) {
        errors.phone = language === 'bn' ? 'সঠিক ফোন নম্বর প্রদান করুন' : 'Enter a valid phone number.';
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = language === 'bn' ? 'সঠিক ইমেইল ঠিকানা প্রদান করুন' : 'Enter a valid email address.';
      }
    }

    if (facebookUrl.trim()) {
      const url = facebookUrl.trim().toLowerCase();
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('facebook.com') && !url.startsWith('fb.com')) {
        errors.facebookUrl = language === 'bn' ? 'সঠিক ফেসবুক প্রোফাইল লিংক দিন' : 'Enter a valid Facebook link.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      jumpToFirstFormError();
      return;
    }

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
          customerType,
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
          customerType,
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
      subscriptions.find(subscription => subscription.id === invoice.subscriptionId || subscription.id === sale.subscriptionId),
      services,
      subscriptions
    );
  };

  const handleOpenInvoice = (sale: (typeof sales)[number]) => {
    setSelectedInvoiceData(invoiceDetailsForSale(sale));
  };

  const handleDownloadInvoice = async (sale: (typeof sales)[number]) => {
    try {
      const result = await generateInvoiceImage(invoiceDetailsForSale(sale), language);
      downloadInvoiceImage(result.blob, result.fileName);
      showToast(`Download requested · ${result.fileName}`, 'info');
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
          ? (language === 'bn' ? 'কাস্টমার স্থায়ীভাবে মুছে ফেলা হয়েছে।' : 'Customer deleted.')
          : (language === 'bn' ? 'কাস্টমার সফলভাবে আর্কাইভে পাঠানো হয়েছে।' : 'Customer archived.'),
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
      new Date(), settings.reminderNoticeDays, settings.businessProfile?.timeZone
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
  }, [customers, subscriptions, sales, payments, invoices, activityLogs, services, settings.reminderNoticeDays, settings.businessProfile?.timeZone, currency]);

  const customerSummary = useMemo(() => {
    const visibleCustomers = customers.filter(customer => !customer.isArchived && customer.status !== 'archived');
    const activeCount = visibleCustomers.filter(customer => customerMetrics.get(customer.id)?.status === 'active').length;
    const atRiskCount = visibleCustomers.filter(customer => customerMetrics.get(customer.id)?.status === 'at_risk').length;
    const inactiveCount = visibleCustomers.filter(customer => customerMetrics.get(customer.id)?.status === 'inactive').length;
    const newCustomers = visibleCustomers.filter(customer => isCustomerNew(
      customer.createdAt, new Date(), settings.businessProfile?.timeZone
    )).length;
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

  const invalidCustomerDateRange = Boolean(
    (createdFrom && createdTo && createdFrom > createdTo)
    || (lastActivityFrom && lastActivityTo && lastActivityFrom > lastActivityTo)
  );

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

        if (invalidCustomerDateRange) return false;

        // Search is filtered locally across the customer's existing identity fields.
        if (!matchesCustomerSearch(cust, searchQuery)
          && !getCustomerType(cust)?.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())) return false;
        if (filterCustomerType !== 'all' && getCustomerType(cust) !== filterCustomerType) return false;

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
          if (!isCustomerNew(cust.createdAt, new Date(), settings.businessProfile?.timeZone)) return false;
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
    filterCustomerType,
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
    invalidCustomerDateRange,
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
    || filterCrmStatus !== 'all' || filterCustomerType !== 'all' || filterSubscription !== 'all' || filterPayment !== 'all'
    || filterActivity !== 'all' || filterStatus === 'archived'
    || createdFrom || createdTo || lastActivityFrom || lastActivityTo
  );
  const activeFilterCount = [
    searchQuery,
    filterStatus === 'archived',
    filterCrmStatus !== 'all',
    filterCustomerType !== 'all',
    filterServiceId !== 'all',
    filterRenewal !== 'all',
    filterSubscription !== 'all',
    filterPayment !== 'all',
    filterActivity !== 'all',
    createdFrom,
    createdTo,
    lastActivityFrom,
    lastActivityTo,
  ].filter(Boolean).length;
  const activeFilterSummary = [
    searchQuery ? `${language === 'bn' ? 'অনুসন্ধান' : 'Search'}: ${searchQuery}` : null,
    filterStatus === 'archived' ? (language === 'bn' ? 'আর্কাইভকৃত' : 'Archived') : null,
    filterCrmStatus !== 'all'
      ? ({
          active: language === 'bn' ? 'সক্রিয়' : 'Active',
          at_risk: language === 'bn' ? 'ঝুঁকিতে' : 'At risk',
          inactive: language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive',
        } as const)[filterCrmStatus]
      : null,
    filterCustomerType !== 'all' ? filterCustomerType : null,
    filterServiceId !== 'all' ? services.find(service => service.id === filterServiceId)?.name || null : null,
    filterRenewal !== 'all'
      ? ({
          due: language === 'bn' ? 'নবায়ন বাকি' : 'Renewal due',
          expired: language === 'bn' ? 'মেয়াদোত্তীর্ণ' : 'Expired',
          none: language === 'bn' ? 'সাবস্ক্রিপশন নেই' : 'No subscription',
        } as const)[filterRenewal]
      : null,
    filterSubscription !== 'all'
      ? ({
          active: language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন' : 'Has an active plan',
          none: language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন নেই' : 'No active subscription',
          expiring: language === 'bn' ? 'মেয়াদ শেষ হচ্ছে' : 'Plan ending soon',
          expired: language === 'bn' ? 'মেয়াদোত্তীর্ণ সাবস্ক্রিপশন' : 'Plan ended',
        } as const)[filterSubscription]
      : null,
    filterPayment !== 'all'
      ? ({
          paid: language === 'bn' ? 'সম্পূর্ণ পরিশোধিত' : 'Fully paid',
          due: language === 'bn' ? 'বকেয়া আছে' : 'Has money due',
          failed: language === 'bn' ? 'পেমেন্ট ব্যর্থ' : 'Failed payment',
        } as const)[filterPayment]
      : null,
    filterActivity !== 'all'
      ? ({
          new: language === 'bn' ? 'নতুন গ্রাহক' : 'New customers',
          recent: language === 'bn' ? 'সাম্প্রতিক কার্যক্রম' : 'Active recently',
          inactive: language === 'bn' ? 'নিষ্ক্রিয় কার্যক্রম' : 'Inactive activity',
        } as const)[filterActivity]
      : null,
    createdFrom || createdTo ? `${language === 'bn' ? 'তৈরির তারিখ' : 'Created'}: ${createdFrom || '…'}–${createdTo || '…'}` : null,
    lastActivityFrom || lastActivityTo ? `${language === 'bn' ? 'সর্বশেষ কার্যক্রম' : 'Last activity'}: ${lastActivityFrom || '…'}–${lastActivityTo || '…'}` : null,
  ].filter((label): label is string => Boolean(label));
  const clearCustomerFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterCrmStatus('all');
    setFilterCustomerType('all');
    setFilterServiceId('all');
    setFilterRenewal('all');
    setFilterSubscription('all');
    setFilterPayment('all');
    setFilterActivity('all');
    setCreatedFrom('');
    setCreatedTo('');
    setLastActivityFrom('');
    setLastActivityTo('');
    setCurrentPage(1);
  };

  // KPI shortcut: show exactly the customers a KPI counts (other filters reset first).
  const applyKpiFilter = (key: 'all' | 'active' | 'at_risk' | 'renewals') => {
    clearCustomerFilters();
    if (key === 'active') setFilterCrmStatus('active');
    else if (key === 'at_risk') setFilterCrmStatus('at_risk');
    else if (key === 'renewals') setFilterRenewal('due');
  };

  // Selected customer for detailed view
  const detailedCustomer = customers.find(c => c.id === detailedCustomerId);
  const detailsLoadError = Boolean(customersError || storageWarning?.includes('saved data'));
  const detailedSubs = detailedCustomer
    ? (customerMetrics.get(detailedCustomer.id)?.subscriptions || [])
    : [];
  const detailedSales = detailedCustomer
    ? sales.filter(sale => resolveSaleCustomer(sale, customers, subscriptions)?.id === detailedCustomer.id)
    : [];
  const detailedExpectedPaymentDates = [...new Set(detailedSales.flatMap(sale =>
    getSaleLineFinancialAllocations(sale, payments)
      .flatMap(line => line.due > 0 && line.item.expectedPaymentDate ? [line.item.expectedPaymentDate] : [])
  ))].sort();
  const detailedPayments = detailedCustomer
    ? payments.filter(payment => resolvePaymentCustomer(payment, customers, sales, subscriptions)?.id === detailedCustomer.id)
    : [];
  const detailedAdvanceBalances = detailedCustomer
    ? {
      BDT: getCustomerAdvanceCredit(payments, detailedCustomer.id, 'BDT'),
      USD: getCustomerAdvanceCredit(payments, detailedCustomer.id, 'USD'),
    }
    : { BDT: 0, USD: 0 };
  const detailedPaymentHistory = [...detailedPayments].sort((left, right) =>
    right.paymentDate.localeCompare(left.paymentDate) || (right.createdAt || '').localeCompare(left.createdAt || '')
  );
  const detailedCrmMetrics = detailedCustomer ? customerMetrics.get(detailedCustomer.id) : undefined;
  const detailedInvoices = detailedCustomer
    ? getInvoicesForCustomer(invoices, detailedCustomer.id)
    : [];
  const customerStatement = detailedCustomer
    ? buildCustomerStatement({
      customerId: detailedCustomer.id,
      currency,
      sales: detailedSales,
      invoices: detailedInvoices,
      payments: detailedPayments,
      subscriptions: detailedSubs,
      services,
      accounts: financialAccounts,
      today: getDateInTimeZone(settings.businessProfile?.timeZone),
      timeZone: settings.businessProfile?.timeZone,
      reminderNoticeDays: settings.reminderNoticeDays,
      businessId: currentBusiness?.businessId,
    })
    : null;
  const statementRangeValid = !statementFrom || !statementTo || statementFrom <= statementTo;
  const statementPeriod = customerStatement
    ? getCustomerStatementPeriod(
      customerStatement.entries,
      statementFrom,
      statementTo
    )
    : null;
  const statementTypeLabel = ({
    all: 'Everything',
    payments: 'Payments received',
    invoices: 'Invoices and discounts',
    advances: 'Advance payments',
    refunds: 'Refunds',
  } satisfies Record<CustomerStatementFilter, string>)[statementFilter];
  const statementVisibleEntries = (statementPeriod?.entries || [])
    .filter(entry => {
      if (statementFilter === 'payments') return entry.type === 'payment';
      if (statementFilter === 'invoices') return entry.type === 'invoice' || entry.type === 'discount';
      if (statementFilter === 'advances') return entry.type === 'advance_created' || entry.type === 'advance_applied';
      if (statementFilter === 'refunds') return entry.type === 'refund';
      return true;
    })
    .filter(entry => {
      const query = statementSearch.trim().toLocaleLowerCase();
      return !query || [
        entry.reference,
        entry.invoiceNumber,
        entry.description,
        entry.notes,
      ].some(value => value?.toLocaleLowerCase().includes(query));
    })
    .slice()
    .reverse();
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
  const detailedTimeline = buildCustomerTimeline({
    sales: detailedSales,
    payments: detailedPayments,
    subscriptions: detailedSubs,
    invoices: detailedInvoices,
    activities: detailedActivities,
    services,
    reminderNoticeDays: settings.reminderNoticeDays,
    timeZone: settings.businessProfile?.timeZone,
  });
  const visibleTimeline = detailedTimeline.filter(event => {
    if (timelineFilter === 'all') return true;
    if (timelineFilter === 'sales') return event.type === 'sale' || event.type === 'invoice';
    if (timelineFilter === 'payments') return event.type === 'payment';
    if (timelineFilter === 'subscriptions') return event.type === 'subscription';
    return event.type === 'refund';
  });
  const detailedReminders = detailedCustomer
    ? reminders.filter(reminder => reminder.customerId === detailedCustomer.id
      && (reminder.status === 'open' || reminder.status === 'snoozed'))
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    : [];

  const sortedDetailedSubs = [...detailedSubs].sort((a, b) => {
    const getPriority = (subscription: Subscription) => {
      const daysUntil = getDaysDifference(subscription.expiryDate);
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
  const printCustomerStatement = () => {
    if (!detailedCustomer || !customerStatement || !statementPeriod || !statementRangeValid) {
      showToast('Choose a valid statement date range before printing.', 'error');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('The statement could not open. Check your browser pop-up settings.', 'error');
      return;
    }
    const filterLabel = [
      statementFilter === 'all' ? '' : statementTypeLabel,
      statementSearch.trim() ? `Search: ${statementSearch.trim()}` : '',
    ].filter(Boolean).join(' · ');
    printWindow.document.open();
    printWindow.document.write(renderCustomerStatementHtml({
      customer: detailedCustomer,
      businessName: currentBusinessName || settings.storeName,
      currency,
      generatedAt: formatAppEventDateTime(new Date().toISOString()),
      dateRange: `${statementFrom ? formatAppDate(statementFrom, language) : 'First transaction'} – ${statementTo ? formatAppDate(statementTo, language) : 'Latest transaction'}`,
      openingBalance: formatCurrency(statementPeriod.openingBalance, currency),
      debitTotal: formatCurrency(statementPeriod.debitTotal, currency),
      creditTotal: formatCurrency(statementPeriod.creditTotal, currency),
      closingBalance: formatCurrency(statementPeriod.closingBalance, currency),
      outstandingDue: formatCurrency(customerStatement.summary.totalDue, currency),
      availableAdvance: formatCurrency(customerStatement.summary.availableAdvance, currency),
      entries: statementVisibleEntries,
      filterLabel: filterLabel || undefined,
    }));
    printWindow.document.close();
  };
  const copyRenewalMessage = async () => {
    if (!detailedCustomer || !nearestRenewalSubscription || !nearestRenewalService || !renewalTemplate) return;
    const message = buildSubscriptionRenewalMessage(
      nearestRenewalSubscription,
      detailedCustomer,
      nearestRenewalService,
      renewalTemplate,
      language,
      undefined,
      settings.businessProfile?.timeZone
    );
    if (!message) return;
    await copyCustomerField(message, 'Renewal message');
  };

  return (
    <div className="customers-view section-layout-shell mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-6 lg:px-8" data-section="customers">
      <div className={detailedCustomerId ? 'hidden' : 'customer-list-page space-y-3 sm:space-y-4'}>
      {/* 1. PAGE HEADER */}
      <div className="customer-page-header customer-page-header--v2 flex min-w-0 flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:gap-4">
        <div className="customer-heading flex min-w-0 flex-1 items-start gap-3">
          <div className="customer-page-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="customer-page-eyebrow mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
              {language === 'bn' ? 'গ্রাহক সম্পর্ক' : 'Customer summary'}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">
              {language === 'bn' ? 'কাস্টমার' : 'Customers'}
            </h1>
            <p className="mt-0.5 max-w-[28rem] text-sm leading-5 text-slate-600 dark:text-slate-400">
              {language === 'bn'
                ? 'গ্রাহক, নবায়ন ও বকেয়া'
                : 'Customers, renewals & balances.'}
            </p>
          </div>
        </div>

        <div className="customer-header-actions flex shrink-0 items-center gap-1.5">
          <details className="customer-page-actions relative">
            <summary
              aria-label={language === 'bn' ? 'আরও কাস্টমার অ্যাকশন' : 'More customer actions'}
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <MoreVertical className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid w-48 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={event => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  onOpenNewSaleForCustomer();
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <CreditCard className="h-4 w-4" />
                New Sale
              </button>
              <button
                type="button"
                onClick={event => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
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
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Export Customers
              </button>
            </div>
          </details>
          <button
            type="button"
            onClick={openAddModal}
            aria-label={t('addCustomer')}
            title={t('addCustomer')}
            className="customer-primary-action inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-violet-600 active:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:gap-2 sm:px-4"
          >
            <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" />
            <span>{t('addCustomer')}</span>
          </button>
        </div>
      </div>

      <div className="customer-kpi-grid grid grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: language === 'bn' ? 'মোট গ্রাহক' : 'Total Customers',
            value: customerSummary.total,
            icon: Users,
            tone: 'violet' as const,
          },
          {
            label: language === 'bn' ? 'সক্রিয় গ্রাহক' : 'Active Customers',
            value: customerSummary.activeCount,
            icon: CheckCircle2,
            tone: 'emerald' as const,
          },
          {
            label: language === 'bn' ? 'ঝুঁকিতে' : 'At Risk',
            value: customerSummary.atRiskCount,
            icon: AlertTriangle,
            tone: 'rose' as const,
          },
          {
            label: language === 'bn' ? 'নবায়ন বাকি' : 'Renewals Due',
            value: customerSummary.renewalsDue,
            icon: CalendarDays,
            tone: 'amber' as const,
          },
        ].map((metric, index) => {
          const filterKey = (['all', 'active', 'at_risk', 'renewals'] as const)[index];
          const pressed =
            filterKey === 'all' ? !hasCustomerFilters
            : filterKey === 'active' ? filterCrmStatus === 'active'
            : filterKey === 'at_risk' ? filterCrmStatus === 'at_risk'
            : filterRenewal === 'due';
          return (
            <StatCard
              key={metric.label}
              icon={<metric.icon className="h-5 w-5" aria-hidden="true" />}
              label={metric.label}
              value={
                customersError && customers.length === 0
                  ? '—'
                  : customersLoading && customers.length === 0
                  ? <span className="block h-6 w-14 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  : metric.value
              }
              tone={metric.tone}
              onClick={() => applyKpiFilter(filterKey)}
              ariaLabel={`${metric.label}${pressed ? ` (${language === 'bn' ? 'সক্রিয় ফিল্টার' : 'active filter'})` : ''}`}
              className={pressed ? 'border-violet-500 shadow-[0_0_0_3px_rgba(124,58,237,0.14)] dark:border-violet-400' : undefined}
            />
          );
        })}
      </div>

      {/* 2. SEARCH + FILTER TOOLBAR */}
      <div className="customer-toolbar grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-3 xl:p-3 dark:border-slate-800 dark:bg-slate-900">
        {/* Search input (Name, Phone, Email, Facebook ID) */}
        <div className="customer-search-box relative min-w-0">
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
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 transition-colors placeholder:text-slate-500 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:bg-slate-950"
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
        <div className="customer-filter-toolbar grid min-w-0 grid-cols-2 gap-2 xl:flex xl:items-center">
            <select
              value={filterStatus === 'archived' ? 'archived' : filterCrmStatus}
              onChange={event => {
                const value = event.target.value;
                setFilterStatus(value === 'archived' ? 'archived' : 'all');
                setFilterCrmStatus(value === 'archived' ? 'all' : value as typeof filterCrmStatus);
                setCurrentPage(1);
              }}
              aria-label={language === 'bn' ? 'কাস্টমার স্ট্যাটাস ফিল্টার' : 'Filter customers by status'}
              className="h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:bg-slate-950 xl:w-auto"
            >
              <option value="all">{language === 'bn' ? 'সব গ্রাহক' : 'All customers'}</option>
              <option value="active">{language === 'bn' ? 'সক্রিয়' : 'Active'}</option>
              <option value="at_risk">{language === 'bn' ? 'ঝুঁকিতে' : 'At risk'}</option>
              <option value="inactive">{language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'}</option>
              {customers.some(customer => customer.isArchived) && <option value="archived">{language === 'bn' ? 'আর্কাইভকৃত' : 'Archived'}</option>}
            </select>

            <select
              value={filterCustomerType}
              onChange={event => {
                setFilterCustomerType(event.target.value as typeof filterCustomerType);
                setCurrentPage(1);
              }}
              aria-label={language === 'bn' ? 'কাস্টমারের ধরন ফিল্টার' : 'Filter customers by type'}
              className="h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:bg-slate-950 xl:w-auto"
            >
              <option value="all">{language === 'bn' ? 'সব ধরনের' : 'All types'}</option>
              <option value="Customer">Customer</option>
              <option value="Reseller">Reseller</option>
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              aria-label={language === 'bn' ? 'কাস্টমার সাজান' : 'Sort customers'}
              className="h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 focus:border-violet-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:bg-slate-950 xl:w-auto"
            >
              <option value="newest">{language === 'bn' ? 'নতুন' : 'Newest'}</option>
              <option value="oldest">{language === 'bn' ? 'পুরনো' : 'Oldest'}</option>
              <option value="name_asc">{language === 'bn' ? 'নাম (A-Z)' : 'Name (A-Z)'}</option>
              <option value="name_desc">{language === 'bn' ? 'নাম (Z-A)' : 'Name (Z-A)'}</option>
              <option value="spending">{language === 'bn' ? 'সর্বোচ্চ খরচ' : 'Most spent'}</option>
            </select>

          <details className="customer-advanced-filters col-span-2 min-w-0 xl:col-span-1">
            <summary className="flex h-11 min-w-0 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 transition-colors hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 xl:min-w-32">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>{language === 'bn' ? 'আরও ফিল্টার' : 'More filters'}</span>
              {activeFilterCount > 0 && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{activeFilterCount}</span>}
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </summary>
            <div className="customer-advanced-filter-panel mt-2 flex flex-wrap items-center gap-2">
          {services.length > 0 && <select
            value={filterServiceId}
            onChange={e => {
              setFilterServiceId(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by service"
            className="h-11 max-w-full px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-violet-500 shadow-2xs cursor-pointer"
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
            aria-label={language === 'bn' ? 'নবায়নের প্রয়োজন অনুযায়ী ফিল্টার' : 'Filter by renewal need'}
            className="h-11 max-w-full px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-violet-500 shadow-2xs cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সব নবায়নের অবস্থা' : 'All renewal needs'}</option>
            <option value="due">{language === 'bn' ? 'নবায়ন বাকি' : 'Renewal due'}</option>
            <option value="expired">{language === 'bn' ? 'মেয়াদোত্তীর্ণ নবায়ন' : 'Renewal expired'}</option>
            <option value="none">{language === 'bn' ? 'কোনো সাবস্ক্রিপশন রেকর্ড নেই' : 'No subscription on record'}</option>
          </select>}

          <select
            value={filterSubscription}
            onChange={event => { setFilterSubscription(event.target.value as typeof filterSubscription); setCurrentPage(1); }}
            aria-label={language === 'bn' ? 'সাবস্ক্রিপশনের অবস্থা অনুযায়ী ফিল্টার' : 'Filter by current subscription state'}
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-violet-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="all">Any subscription state</option>
            <option value="active">Has active subscription</option>
            <option value="none">No active subscription</option>
            <option value="expiring">Expiring soon</option>
            <option value="expired">Has an expired subscription</option>
          </select>
          <select
            value={filterPayment}
            onChange={event => { setFilterPayment(event.target.value as typeof filterPayment); setCurrentPage(1); }}
            aria-label="Filter by payment status"
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-violet-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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
            className="h-11 max-w-full rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs focus:border-violet-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="all">All activity</option>
            <option value="new">New customers</option>
            <option value="recent">Recently active</option>
          </select>
          <details className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
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
              }} className="justify-self-start text-xs font-semibold text-violet-700 dark:text-violet-300">Clear dates</button>
            </div>
          </details>

              {invalidCustomerDateRange && <p role="alert" className="col-span-full text-xs font-medium text-rose-700 dark:text-rose-300">
                {language === 'bn' ? 'শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না।' : 'Each start date must be on or before its end date.'}
              </p>}
            </div>
          </details>

          <div className="col-span-full flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <p className="shrink-0 font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
                {customersLoading && customers.length === 0
                  ? (language === 'bn' ? 'গ্রাহক লোড হচ্ছে…' : 'Loading customers…')
                  : language === 'bn'
                    ? `${filteredCustomers.length} জন গ্রাহক`
                    : `${filteredCustomers.length} ${filteredCustomers.length === 1 ? 'customer' : 'customers'}`}
              </p>
              {activeFilterSummary.length > 0 && (
                <p className="min-w-0 break-words text-slate-500 dark:text-slate-400">
                  <span className="sr-only">{language === 'bn' ? 'সক্রিয় ফিল্টার: ' : 'Active filters: '}</span>
                  {activeFilterSummary.join(' · ')}
                </p>
              )}
            </div>
            {hasCustomerFilters && (
              <button
                type="button"
                onClick={clearCustomerFilters}
                className="min-h-9 rounded-md px-2 font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/50"
              >
                {language === 'bn' ? 'ফিল্টার মুছুন' : 'Clear filters'}
              </button>
            )}
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

      <div className="customer-list-section space-y-3">
        <div className="customer-list-header" aria-hidden="true">
          <span>{language === 'bn' ? 'কাস্টমার' : 'Customer'}</span>
          <span>{language === 'bn' ? 'যোগাযোগ' : 'Contact'}</span>
          <span>{language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন' : 'Active subscriptions'}</span>
          <span>{language === 'bn' ? 'মোট খরচ' : 'Total spent'}</span>
          <span>{language === 'bn' ? 'বকেয়া' : 'Due'}</span>
          <span>{language === 'bn' ? 'শেষ কার্যক্রম' : 'Last activity'}</span>
          <span />
        </div>
        <div className="customer-card-grid customer-card-list-grid grid gap-2.5">
          {customersLoading && customers.length === 0 ? (
            <div className="contents" aria-label="Loading customers">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="customer-card-skeleton animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-3 w-3/5 rounded bg-slate-100 dark:bg-slate-800/60" />
                    </div>
                    <div className="hidden h-8 w-20 rounded-full bg-slate-100 dark:bg-slate-800/60 sm:block" />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <div className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
                    <div className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
                    <div className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
                    <div className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginatedCustomers.length === 0 ? (
            <div className="customer-empty-state col-span-full flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-violet-300/70 bg-violet-50/40 px-4 py-12 text-center dark:border-violet-900/60 dark:bg-violet-950/20">
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
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600"
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
              const cardAccent = getCustomerCardAccent(cust.id);
              const valueTag = cust.tags?.find(tag => ['vip', 'high value'].includes(tag.trim().toLowerCase()));
              const customerStatus = cust.isArchived ? 'Archived'
                : metrics?.status === 'at_risk' ? 'At Risk'
                  : metrics?.status === 'inactive' ? 'Inactive' : 'Active';
              const statusClass = cust.isArchived || metrics?.status === 'inactive'
                ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : metrics?.status === 'at_risk'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300';
              const rowStatus = cust.isArchived ? 'archived' : metrics?.status === 'at_risk' ? 'at_risk' : metrics?.status === 'inactive' ? 'inactive' : 'active';
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
                  role="button"
                  tabIndex={0}
                  aria-label={`View customer details for ${cust.name}`}
                  onClick={event => {
                    const target = event.target;
                    const interactiveTarget = target instanceof Element
                      ? target.closest('button, a, input, select, textarea, [role="button"]')
                      : null;
                    if (interactiveTarget && interactiveTarget !== event.currentTarget) return;
                    openCustomerDetails(cust.id);
                  }}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openCustomerDetails(cust.id);
                    }
                  }}
                  className={`customer-card customer-card--${rowStatus} group min-w-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600`}
                  style={{ '--customer-card-accent': cardAccent } as React.CSSProperties & { '--customer-card-accent': string }}
                >
                  <div className="customer-card-identity">
                    <div
                      className={`customer-card-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${avatarColor}`}
                    >
                      {initials}
                    </div>
                    <div className="customer-card-identity-copy min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        <button type="button" onClick={() => openCustomerDetails(cust.id)} aria-label={`View customer details for ${cust.name}`} className="customer-card-name inline-flex min-h-10 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-left text-[15px] font-bold text-slate-900 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-white dark:hover:text-violet-300">
                          <CustomerNameWithType customer={cust} nameClassName="min-w-0 break-words" />
                        </button>
                        {valueTag && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Sparkles className="h-2.5 w-2.5" />{valueTag}</span>}
                        <span className={`customer-card-status inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass}`}>
                          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${cust.isArchived || metrics?.status === 'inactive' ? 'bg-slate-400' : metrics?.status === 'at_risk' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {customerStatus}
                        </span>
                      </div>
                      {renewalSubscription && (
                        <button type="button" onClick={() => onViewSubscription(renewalSubscription.id)} className="customer-card-renewal mt-1 inline-flex min-h-8 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70">
                          <CalendarDays className="h-3 w-3" aria-hidden="true" />
                          {renewalDays === 0 ? 'Renewal due today' : `Renewal due in ${renewalDays} day${renewalDays === 1 ? '' : 's'}`}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="customer-card-contacts mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0 text-xs">
                    {cust.whatsapp && cust.whatsapp !== cust.phone && (
                      <span className="customer-contact-link inline-flex min-h-9 min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
                        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="min-w-0">WA: {cust.whatsapp}</span>
                      </span>
                    )}
                    {cust.phone && <a href={`tel:${cust.phone}`} onClick={event => event.stopPropagation()} className="customer-contact-link inline-flex min-h-9 min-w-0 items-center gap-2 text-slate-700 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-200 dark:hover:text-violet-300"><Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0">{cust.phone}</span></a>}
                    {cust.email && <a href={`mailto:${cust.email}`} onClick={event => event.stopPropagation()} title={cust.email} className="customer-contact-link inline-flex min-h-9 min-w-0 items-center gap-2 text-slate-700 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-200 dark:hover:text-violet-300"><Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0">{cust.email}</span></a>}
                    {cust.facebookUrl && <a href={cust.facebookUrl.startsWith('http') ? cust.facebookUrl : `https://${cust.facebookUrl}`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} aria-label={`Facebook profile for ${cust.name}`} className="customer-contact-link inline-flex min-h-9 min-w-0 items-center gap-2 text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300"><Facebook className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Facebook</span></a>}
                  </div>

                  <div className="customer-card-metrics mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-2.5 dark:border-slate-800">
                    <div className="customer-card-metric min-w-0"><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Active Subscriptions</p><p className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-white">{activeCount}</p></div>
                    <div className="customer-card-metric min-w-0"><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Spent</p><p className="mt-1 truncate text-base font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(spending, currency)}</p></div>
                    <div className={`customer-card-metric customer-card-due min-w-0 rounded-lg ${metrics?.totalDue ? 'bg-amber-50/80 dark:bg-amber-950/25' : ''}`}><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Due Amount</p><p className={`mt-1 truncate text-base font-semibold tabular-nums ${metrics?.totalDue ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>{formatCurrency(metrics?.totalDue || 0, currency)}</p></div>
                    <div className="customer-card-metric min-w-0"><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Last Activity</p><p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{metrics?.lastActivity ? formatAppEventDateTime(metrics.lastActivity) : '—'}</p></div>
                  </div>

                  <div className="customer-card-actions mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {!cust.isArchived && <button type="button" onClick={() => onOpenNewSaleForCustomer(cust.id)} aria-label={`New sale for ${cust.name}`} className="customer-new-sale inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"><Plus className="h-3.5 w-3.5" />New Sale</button>}
                      {!cust.isArchived && onAddPaymentForCustomer && <button type="button" onClick={() => onAddPaymentForCustomer(cust.id)} aria-label={`Add payment for ${cust.name}${metrics?.totalDue ? `, ${formatCurrency(metrics.totalDue, currency)} due` : ''}`} title={metrics?.totalDue ? `Due ${formatCurrency(metrics.totalDue, currency)}` : 'Add payment'} className="customer-payment-action inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><CreditCard className="h-4 w-4" /></button>}
                      {canWhatsApp && <button type="button" onClick={() => openMessage({ customerId: cust.id })} aria-label={`Compose WhatsApp message for ${cust.name}`} title="WhatsApp" className="customer-whatsapp-action inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><MessageCircle className="h-4 w-4" /></button>}
                      <button type="button" onClick={() => openCustomerDetails(cust.id)} aria-label={`View ${cust.name}`} title="View customer" className="customer-view-action inline-flex min-h-10 items-center justify-center rounded-lg text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/40"><Eye className="h-4 w-4" /></button>
                      <div className="relative">
                        <button type="button" onClick={() => setOpenMoreCustomerId(openMoreCustomerId === cust.id ? null : cust.id)} aria-haspopup="menu" aria-expanded={openMoreCustomerId === cust.id} aria-label={`More actions for ${cust.name}`} title="More actions" className="customer-more-action inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronDown className="h-4 w-4" /></button>
                        {openMoreCustomerId === cust.id && <div className="absolute bottom-full right-0 z-20 mb-1 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          <button type="button" onClick={() => { setOpenMoreCustomerId(null); openCustomerDetails(cust.id); }} className="min-h-10 w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">View customer</button>
                          {!cust.isArchived && <button type="button" onClick={() => { setOpenMoreCustomerId(null); openEditModal(cust); }} className="min-h-10 w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">Edit</button>}
                          {!cust.isArchived && <button type="button" onClick={() => { setOpenMoreCustomerId(null); onOpenNewSaleForCustomer(cust.id); }} className="min-h-10 w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">New Sale</button>}
                          {!cust.isArchived && onAddPaymentForCustomer && <button type="button" onClick={() => { setOpenMoreCustomerId(null); onAddPaymentForCustomer(cust.id); }} className="min-h-10 w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-700">Add Payment</button>}
                          {cust.isArchived && <button type="button" onClick={() => { setOpenMoreCustomerId(null); void handleRestore(cust.id, cust.name); }} className="min-h-10 w-full rounded-md px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/40">Restore</button>}
                          <button type="button" onClick={() => { setOpenMoreCustomerId(null); setCustomerToDelete(cust); }} className="min-h-10 w-full rounded-md px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 dark:text-rose-300 dark:hover:bg-rose-950/40">{cust.isArchived ? 'Permanently delete' : 'Archive or delete'}</button>
                        </div>}
                      </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* 5. PAGINATION FOOTER */}
        {filteredCustomers.length > 0 && (
          <div className="customer-pagination flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2 text-[11px] text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
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

            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label={language === 'bn' ? 'প্রতি পৃষ্ঠায় কতজন' : 'Customers per page'}
                className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-2xs focus:border-violet-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value={10}>10 / {language === 'bn' ? 'পৃষ্ঠা' : 'page'}</option>
                <option value={25}>25 / {language === 'bn' ? 'পৃষ্ঠা' : 'page'}</option>
                <option value={50}>50 / {language === 'bn' ? 'পৃষ্ঠা' : 'page'}</option>
              </select>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                aria-label="Previous customers page"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="customer-attention-panel customer-attention-panel--renewals rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />{language === 'bn' ? 'নবায়নের সুযোগ' : 'Renewal Opportunities'}</h2>
              <p className="mt-1 text-xs text-slate-500">{language === 'bn' ? 'মেয়াদ শেষ হচ্ছে এমন ও সম্প্রতি মেয়াদোত্তীর্ণ সাবস্ক্রিপশন।' : 'Expiring subscriptions and recently expired renewals.'}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{renewalOpportunityRows.length}</span>
          </div>
          {renewalOpportunityRows.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50">{language === 'bn' ? 'আসন্ন কোনো নবায়নের সুযোগ নেই।' : 'No upcoming renewal opportunities.'}</p> : (
            <ul className="space-y-2">
              {renewalOpportunityRows.map(({ subscription, customer, service, daysRemaining }) => (
                <li key={subscription.id} className="customer-attention-row flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-bold ${getAvatarColorClass(customer.name)}`} aria-hidden="true">{getInitials(customer.name)}</span>
                  <button type="button" onClick={() => openCustomerDetails(customer.id)} className="min-w-0 flex-1 text-left">
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

        <section className="customer-attention-panel customer-attention-panel--due rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" aria-hidden="true" />{language === 'bn' ? 'বকেয়া' : 'Outstanding Balance'}</h2>
              <p className="mt-1 text-xs text-slate-500">{language === 'bn' ? 'প্রকৃত পেমেন্ট রেকর্ড থেকে হিসাব করা বকেয়া সহ খোলা বিক্রয়।' : 'Open sales with a balance calculated from actual payment records.'}</p>
            </div>
            <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{outstandingBalanceRows.length}</span>
          </div>
          {outstandingBalanceRows.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50">{language === 'bn' ? 'কোনো বকেয়া নেই।' : 'No outstanding balances.'}</p> : (
            <ul className="space-y-2">
              {outstandingBalanceRows.map(({ sale, customer, due }) => (
                <li key={sale.id} className="customer-attention-row flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-bold ${getAvatarColorClass(customer.name)}`} aria-hidden="true">{getInitials(customer.name)}</span>
                  <button type="button" onClick={() => openCustomerDetails(customer.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">{customer.name} · {sale.invoiceNo}</span>
                    <span className="block text-[11px] text-slate-500">{getSaleLineItems(sale).map(item => `${services.find(service => service.id === item.serviceId)?.name || 'Service'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join('; ')} · {formatAppEventDateTime(sale.createdAt || sale.date)} · Due {formatCurrency(due, sale.currency)}</span>
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
          <div className="mx-auto w-full max-w-[1400px] rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
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
          <div className="mx-auto w-full max-w-[1400px] rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
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
        <div
          className="customer-detail-workspace mx-auto w-full max-w-[1400px] space-y-4"
          onClick={event => {
            const target = event.target;
            if (target instanceof Element && !target.closest('.customer-profile-more')) {
              event.currentTarget.querySelector('.customer-profile-more[open]')?.removeAttribute('open');
            }
          }}
        >
          <button
            type="button"
            onClick={() => {
              setDetailedCustomerId(null);
              onClearSelectedCustomer?.();
            }}
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-300"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Customers
          </button>
          <div className="customer-detail-content space-y-5">
            {/* Header info card */}
            <section className="customer-profile-header customer-profile-header--v2 flex min-w-0 flex-col gap-5 rounded-2xl p-5 shadow-xs sm:p-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="customer-profile-identity flex min-w-0 items-start gap-4 sm:items-center">
                <div
                  className={`customer-profile-avatar mt-0.5 flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.125rem] border text-lg font-bold sm:mt-0 ${getAvatarColorClass(
                    detailedCustomer.name
                  )}`}
                >
                  {getInitials(detailedCustomer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="customer-profile-name min-w-0 break-words text-[1.625rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[1.875rem]">
                    {detailedCustomer.name?.trim() || '—'}
                  </h1>
                  <div className="customer-profile-meta mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    {getCustomerType(detailedCustomer) && (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none ${
                        getCustomerType(detailedCustomer) === 'Reseller'
                          ? 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200'
                          : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
                      }`}>
                        {getCustomerType(detailedCustomer)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none ${
                      detailedCrmMetrics?.status === 'at_risk'
                        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                        : detailedCrmMetrics?.status === 'inactive'
                          ? 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                    }`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${
                        detailedCrmMetrics?.status === 'at_risk'
                          ? 'bg-amber-500'
                          : detailedCrmMetrics?.status === 'inactive'
                            ? 'bg-slate-500'
                            : 'bg-emerald-500'
                      }`} />
                      {detailedCrmMetrics?.status === 'at_risk' ? 'At Risk' : detailedCrmMetrics?.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </div>
                  {(detailedCustomer.phone?.trim() || detailedCustomer.email?.trim()) && <div className="customer-profile-contact mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {detailedCustomer.phone?.trim() && <a href={`tel:${detailedCustomer.phone}`} className="break-all hover:text-violet-700 dark:hover:text-violet-300">{detailedCustomer.phone}</a>}
                    {detailedCustomer.email?.trim() && <a href={`mailto:${detailedCustomer.email}`} className="break-all hover:text-violet-700 dark:hover:text-violet-300">{detailedCustomer.email}</a>}
                  </div>}
                  {detailedCustomer.createdAt && (
                    <p className="customer-profile-since mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{language === 'bn' ? 'গ্রাহক হিসেবে যোগদান:' : 'Customer since'} {formatAppEventDateTime(detailedCustomer.createdAt)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="customer-profile-actions flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewSaleForCustomer(detailedCustomer.id);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                >
                  <Plus className="h-4 w-4" />
                  New Sale
                </button>
                {canContact(detailedCustomer.id) && <button type="button"
                  onClick={() => openMessage({ customerId: detailedCustomer.id })}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>}
                <button
                  type="button"
                  onClick={() => openEditModal(detailedCustomer)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <details
                  className="customer-profile-more relative"
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.removeAttribute('open');
                      event.currentTarget.querySelector('summary')?.focus();
                    }
                  }}
                >
                  <summary aria-label={language === 'bn' ? 'আরও কাস্টমার অ্যাকশন' : 'More customer actions'} title={language === 'bn' ? 'আরও অ্যাকশন' : 'More actions'} className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    <MoreVertical className="h-5 w-5" />
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 grid min-w-48 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {onAddPaymentForCustomer && <button type="button" onClick={event => {
                      event.currentTarget.closest('details')?.removeAttribute('open');
                      onAddPaymentForCustomer(detailedCustomer.id);
                    }} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800"><CreditCard className="h-4 w-4" />{language === 'bn' ? 'পেমেন্ট গ্রহণ' : 'Receive Payment'}</button>}
                    {detailedSales.length > 0 && (() => {
                      const latestSale = [...detailedSales].sort((a, b) => b.date.localeCompare(a.date))[0];
                      const hasInvoice = invoices.some(invoice => invoice.saleId === latestSale.id);
                      return <button type="button" onClick={event => {
                        event.currentTarget.closest('details')?.removeAttribute('open');
                        handleOpenInvoice(latestSale);
                      }} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-slate-800"><Receipt className="h-4 w-4" />{hasInvoice ? (language === 'bn' ? 'ইনভয়েস দেখুন' : 'View Invoice') : (language === 'bn' ? 'ইনভয়েস তৈরি' : 'Create Invoice')}</button>;
                    })()}
                  </div>
                </details>
              </div>
            </section>

            <nav aria-label="Customer sections" className="customer-detail-nav customer-detail-nav--v2 sticky top-0 z-10 flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xs backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <a href="#customer-overview" className="customer-detail-nav-link">{language === 'bn' ? 'সারসংক্ষেপ' : 'Overview'}</a>
              <a href="#customer-financial-statement" className="customer-detail-nav-link">Financial statement</a>
              <a href="#customer-subscriptions" className="customer-detail-nav-link">{language === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscriptions'} <span>{detailedSubs.length}</span></a>
              <a href="#customer-purchases" className="customer-detail-nav-link">{language === 'bn' ? 'পেমেন্ট ও কেনাকাটা' : 'Payments & Purchases'}</a>
              <a href="#customer-activity" className="customer-detail-nav-link">{language === 'bn' ? 'লেনদেন' : 'Transactions'} <span>{detailedTimeline.length}</span></a>
            </nav>

            <section id="customer-overview" aria-label="Customer overview" className="customer-overview-grid grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                label={language === 'bn' ? 'সক্রিয় সাবস্ক্রিপশন' : 'Active plans'}
                value={currentActiveSubsForDetailed.length}
                hint={language === 'bn'
                  ? `${formatNumber(detailedSubs.length)}টি মোট সাবস্ক্রিপশন`
                  : `${detailedSubs.length} plans total`}
                tone="violet"
                valueTone="violet"
              />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
                label={language === 'bn' ? `মোট বকেয়া · ${currency}` : `Amount due · ${currency}`}
                value={formatCurrency(detailedTotalDue, currency)}
                hint={language === 'bn' ? 'গ্রাহকের মোট বকেয়া' : 'Money the customer still owes'}
                tone="amber"
                valueTone={detailedTotalDue > 0 ? 'amber' : undefined}
                valueClassName="text-xl! sm:text-2xl!"
                extra={detailedTotalDue > 0 ? (
                  <small className="mt-2 inline-flex w-fit flex-wrap items-center gap-x-1 rounded-md border border-orange-300 bg-orange-100 px-2 py-1 font-semibold text-orange-900 dark:border-yellow-800 dark:bg-yellow-950/60 dark:text-amber-300">
                    {language === 'bn' ? 'প্রত্যাশিত পেমেন্টের তারিখ' : 'Expected payment date'}:{' '}
                    {detailedExpectedPaymentDates.length > 0
                      ? <>
                        {formatAppDate(detailedExpectedPaymentDates[0], language)}
                        {detailedExpectedPaymentDates.length > 1 && ` + ${detailedExpectedPaymentDates.length - 1} ${language === 'bn' ? 'টি তারিখ' : 'more date(s)'}`}
                      </>
                      : (language === 'bn' ? 'সেট করা হয়নি' : 'Not set')}
                  </small>
                ) : undefined}
              />
              <StatCard
                icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
                label={`Payments received · ${currency}`}
                value={formatCurrency(customerStatement?.summary.amountReceived || 0, currency)}
                hint="Total payments received"
                tone="emerald"
                valueTone="emerald"
                valueClassName="text-xl! sm:text-2xl!"
              />
              <StatCard
                icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
                label={language === 'bn' ? `অগ্রিম পেমেন্ট · ${currency}` : `Advance payment · ${currency}`}
                value={formatCurrency(customerStatement?.summary.availableAdvance || detailedAdvanceBalances[currency], currency)}
                hint={language === 'bn' ? 'পরের কেনাকাটায় ব্যবহার করা যাবে' : 'Available for the next sale'}
                tone="violet"
                valueClassName="text-xl! sm:text-2xl!"
              />
              <StatCard
                icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
                label={`Total sales · ${currency}`}
                value={formatCurrency(detailedTotalSales, currency)}
                hint={language === 'bn'
                  ? `${formatNumber(detailedCrmMetrics?.salesCount || 0)}টি বিক্রয়`
                  : `${detailedCrmMetrics?.salesCount || 0} sales`}
                tone="violet"
                valueClassName="text-xl! sm:text-2xl!"
              />
              <StatCard
                icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
                label={`Discounts · ${currency}`}
                value={formatCurrency(customerStatement?.summary.totalDiscounts || 0, currency)}
                hint="Total discount given"
                tone="slate"
                valueClassName="text-xl! sm:text-2xl!"
              />
              <StatCard
                icon={<Clock className="h-5 w-5" aria-hidden="true" />}
                label="Late invoices"
                value={customerStatement?.summary.overdueInvoices || 0}
                hint="Unpaid invoices past their due date"
                tone="rose"
                valueTone={(customerStatement?.summary.overdueInvoices || 0) > 0 ? 'amber' : undefined}
              />
              <StatCard
                icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                label={language === 'bn' ? 'পরবর্তী সাবস্ক্রিপশনের মেয়াদ' : 'Next plan ends'}
                value={
                  customerMetrics.get(detailedCustomer.id)?.nextRenewal
                    ? formatAppDate(customerMetrics.get(detailedCustomer.id)?.nextRenewal || '', language)
                    : (language === 'bn' ? 'আসন্ন মেয়াদ শেষ হওয়ার তারিখ নেই' : 'No plan ending soon')
                }
                tone="amber"
                valueClassName="text-lg!"
                className="col-span-2 md:col-span-2 xl:col-span-1"
              />
            </section>

            <section id="customer-financial-statement" aria-label="Customer financial statement" className="customer-statement-panel min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <History className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                    Account statement
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Invoices, payments, refunds, and credit · {currency}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={printCustomerStatement}
                  disabled={!statementRangeValid || !statementPeriod}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print or save PDF
                </button>
              </div>

              {customerStatement && statementPeriod && (
                <>
                  <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 dark:border-slate-800 sm:grid-cols-3 xl:grid-cols-6">
                    {[
                      ['Balance before dates', statementPeriod.openingBalance],
                      ['Added to amount due', statementPeriod.debitTotal],
                      ['Reduced from amount due', statementPeriod.creditTotal],
                      ['Balance at end', statementPeriod.closingBalance],
                      ['Amount still due', customerStatement.summary.totalDue],
                      ['Advance payment', customerStatement.summary.availableAdvance],
                    ].map(([label, value]) => {
                      const numericValue = Number(value);
                      const valueTone =
                        label === 'Amount still due' && numericValue > 0
                          ? 'amber' as const
                          : label === 'Advance payment' && numericValue > 0
                            ? 'emerald' as const
                            : undefined;
                      return (
                        <StatCard
                          key={label}
                          icon={<></>}
                          hideIcon
                          size="mini"
                          label={label}
                          value={formatCurrency(numericValue, currency)}
                          tone={valueTone ?? 'violet'}
                          valueTone={valueTone}
                        />
                      );
                    })}
                  </div>

                  <div className="grid min-w-0 gap-2 border-b border-slate-100 p-3 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="min-w-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Search the list
                      <span className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-700 dark:bg-slate-900">
                        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <input
                          type="search"
                          value={statementSearch}
                          onChange={event => setStatementSearch(event.target.value)}
                          placeholder="Invoice number or details"
                          className="min-w-0 flex-1 bg-transparent text-xs font-normal outline-none"
                        />
                        {statementSearch && (
                          <button
                            type="button"
                            onClick={() => setStatementSearch('')}
                            aria-label="Clear search"
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </label>
                    <label className="min-w-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Show
                      <select aria-label="Show" value={statementFilter} onChange={event => setStatementFilter(event.target.value as CustomerStatementFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
                        <option value="all">Everything</option>
                        <option value="payments">Payments received</option>
                        <option value="invoices">Invoices and discounts</option>
                        <option value="advances">Advance payments</option>
                        <option value="refunds">Refunds</option>
                      </select>
                    </label>
                    <label className="min-w-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Start date
                      <input type="date" value={statementFrom} onChange={event => setStatementFrom(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900" />
                    </label>
                    <label className="min-w-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      End date
                      <input type="date" value={statementTo} onChange={event => setStatementTo(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900" />
                    </label>
                    {!statementRangeValid && (
                      <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300 sm:col-span-2 xl:col-span-4">
                        Start date must be on or before end date.
                      </p>
                    )}
                  </div>

                  {customerStatement.entries.some(entry => !entry.verified || !entry.hasExactTime) && (
                    <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      Some saved records are missing an invoice link or exact time. We mark them as unverified and do not guess the missing details.
                    </p>
                  )}
                  <p className="px-4 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                    A positive balance means the customer owes money. A negative balance means the customer has credit. Payments received are shown before refunds. Using credit is not a new payment.
                    {statementFilter !== 'all' || statementSearch.trim() ? ` Totals include all activity in these dates. The list shows only ${statementTypeLabel.toLowerCase()}${statementSearch.trim() ? ` matching “${statementSearch.trim()}”` : ''}.` : ''}
                  </p>

                  {detailsLoadError && (
                    <p role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                      We could not check all saved data. Please review these records before using this statement.
                    </p>
                  )}
                  {statementVisibleEntries.length === 0 ? (
                    <p className="px-4 py-9 text-center text-sm text-slate-500 dark:text-slate-400">
                      {customerStatement.entries.length === 0
                        ? 'No payments or invoices yet.'
                        : 'No results. Try changing your search or filters.'}
                    </p>
                  ) : (
                    <div className="max-w-full overflow-x-auto p-3">
                      <table className="customer-statement-table w-full min-w-[1000px] border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <th className="px-2 py-2 font-semibold">Date and time</th>
                            <th className="px-2 py-2 font-semibold">Reference</th>
                            <th className="px-2 py-2 font-semibold">Type</th>
                            <th className="px-2 py-2 font-semibold">Details</th>
                            <th className="px-2 py-2 text-right font-semibold">Added to due</th>
                            <th className="px-2 py-2 text-right font-semibold">Paid or reduced</th>
                            <th className="px-2 py-2 text-right font-semibold">Balance</th>
                            <th className="px-2 py-2 font-semibold">Payment / account</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {statementVisibleEntries.map(entry => (
                            <tr key={entry.id} className="align-top text-slate-700 dark:text-slate-200">
                              <td className="whitespace-nowrap px-2 py-2">
                                <span className="block">{entry.hasExactTime ? formatAppEventDateTime(entry.timestamp) : formatAppDate(entry.date, language)}</span>
                                {!entry.hasExactTime && <span className="text-[10px] text-amber-700 dark:text-amber-300">Time not recorded</span>}
                              </td>
                              <td className="max-w-40 break-all px-2 py-2 font-mono">
                                {entry.reference}
                                <span className={`mt-1 block w-fit rounded px-1.5 py-0.5 font-sans text-[9px] font-semibold ${entry.verified ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                                  {entry.verified ? 'Verified' : 'Unverified'}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 font-medium">{entry.type.replace(/_/g, ' ')}</td>
                              <td className="max-w-60 break-words px-2 py-2">
                                <span className="block font-medium">{entry.description}</span>
                                {entry.invoiceNumber && <span className="mt-0.5 block text-slate-500 dark:text-slate-400">Invoice {entry.invoiceNumber}</span>}
                                {entry.memoAmount !== undefined && <span className="mt-0.5 block text-violet-700 dark:text-violet-300">Advance: {formatCurrency(entry.memoAmount, currency)}</span>}
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {entry.saleId && <button type="button" onClick={() => onViewSale(entry.saleId!)} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">Sale</button>}
                                  {entry.invoiceId && onViewInvoice && <button type="button" onClick={() => onViewInvoice(entry.invoiceId!)} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">Invoice</button>}
                                  {entry.paymentIds?.map(paymentId => onViewPayment && <button key={paymentId} type="button" onClick={() => onViewPayment(paymentId)} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">Payment</button>)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatCurrency(entry.debit, currency)}</td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatCurrency(entry.credit, currency)}</td>
                              <td className={`whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums ${entry.runningBalance < 0 ? 'text-emerald-700 dark:text-emerald-300' : entry.runningBalance > 0 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                                {formatCurrency(entry.runningBalance, currency)}
                                {entry.runningBalance < 0 && <span className="ml-1 text-[9px]">credit</span>}
                              </td>
                              <td className="max-w-36 break-words px-2 py-2">{entry.paymentMethod || '—'}<span className="block text-slate-500 dark:text-slate-400">{entry.account || '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>

            {canContact(detailedCustomer.id) && <details className="customer-message-templates customer-message-templates--v2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4 text-violet-600 dark:text-violet-300" />{language === 'bn' ? 'হোয়াটসঅ্যাপ মেসেজ টেমপ্লেট' : 'WhatsApp message templates'}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </summary>
              <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              <div className="mb-2 flex items-center gap-2"><span className="text-xs text-slate-500 dark:text-slate-400">{detailedCustomer.whatsapp?.trim() || detailedCustomer.phone}</span></div>
              <div className="flex flex-wrap gap-2">
                {detailedDueSale && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, saleId: detailedDueSale.id, templateId: 'payment_reminder' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-200 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Payment Reminder</button>}
                {nearestRenewalSubscription && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, subscriptionId: nearestRenewalSubscription.id, templateId: getExpiryWhatsAppTemplateId(getDaysDifference(nearestRenewalSubscription.expiryDate)) })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Renewal Reminder</button>}
                {detailedLatestInvoice && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, invoiceId: detailedLatestInvoice.invoiceId, templateId: 'invoice_ready' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Send Invoice</button>}
                {detailedSuccessfulPayment && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, paymentId: detailedSuccessfulPayment.id, templateId: 'payment_received' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Payment Confirmation</button>}
                {nearestRenewalSubscription && <button type="button" onClick={() => openMessage({ customerId: detailedCustomer.id, subscriptionId: nearestRenewalSubscription.id, templateId: 'subscription_details' })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Subscription Details</button>}
              </div>
              </div>
            </details>}

            <section aria-label="Customer reminders" className="customer-reminders--v2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"><Clock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" aria-hidden="true" />Reminders ({detailedReminders.length})</h3>
              {detailedReminders.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">No open reminders for this customer.</p> : <div className="space-y-2">
                {detailedReminders.slice(0, 4).map(reminder => {
                  const isPaymentReminder = ['invoice_due', 'invoice_overdue', 'partial_payment', 'payment_overdue', 'unpaid_sale']
                    .includes(reminder.type);
                  return (
                    <div key={reminder.id} className="customer-reminder-row flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{reminder.title}</p>
                        <p className="text-slate-500 dark:text-slate-400">{isPaymentReminder ? 'Expected payment' : 'Due'} {formatAppDate(reminder.dueDate, language)} · {reminder.priority}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => completeReminder(reminder.id)} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Complete</button>
                        <button type="button" onClick={() => snoozeReminder(reminder.id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())} className="font-semibold text-slate-600 hover:underline dark:text-slate-300">Snooze</button>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </section>

            {/* Customer Information */}
            <div className="customer-detail-information rounded-xl border border-slate-200/80 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Users className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />Customer Information</div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Customer Since</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                    {detailedCustomer.createdAt ? formatAppEventDateTime(detailedCustomer.createdAt) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Last Updated</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                    {detailedCustomer.updatedAt ? formatAppEventDateTime(detailedCustomer.updatedAt) : '—'}
                  </dd>
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
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />Customer Tags</h4>
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
                  <button type="button" onClick={() => void saveCustomerTag(detailedCustomer, newTag)} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600">Add tag</button>
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
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><FileText className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />Customer Notes</h4>
                <p className="mt-1 text-[11px] text-slate-500">Do not include passwords, PINs, or account credentials.</p>
                <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={2} aria-label="Add a customer note" placeholder="Add a note about this customer..." className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700" />
                <button type="button" onClick={saveCustomerNote} disabled={!noteDraft.trim()} className="mt-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">Add Note</button>
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
                            <time className="text-[10px] text-slate-500">{formatAppEventDateTime(note.createdAt)}{note.updatedAt !== note.createdAt ? ' · edited' : ''}</time>
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
                {detailedPaymentHistory.some(payment => payment.notes?.trim()) && (
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Payment notes ({detailedPaymentHistory.filter(payment => payment.notes?.trim()).length})
                    </h5>
                    <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                      {detailedPaymentHistory.filter(payment => payment.notes?.trim()).map(payment => (
                        <li key={payment.id} className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-700">
                          <p className="whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200">{safeCustomerNote(payment.notes)}</p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500">
                              {formatAppEventDateTime(payment.createdAt || payment.paymentDate)} · {payment.transactionId?.trim() || payment.id}
                            </span>
                            {onViewPayment && (
                              <button type="button" onClick={() => onViewPayment(payment.id)} className="text-[10px] font-semibold text-violet-700 hover:underline dark:text-violet-300">
                                View payment
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </section>

            {/* Subscriptions */}
            <div id="customer-subscriptions" className="customer-detail-section">
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
                    const badge = getExpiryBadgeInfo(
                      sub.expiryDate,
                      language,
                      getSubscriptionReminderDays(srv, sub.planId, settings.reminderNoticeDays),
                      settings.businessProfile?.timeZone
                    );
                    const daysLeft = getDaysDifference(sub.expiryDate);
                    const statusLabel = badge.status === 'expired' ? 'Expired' : badge.status === 'expiring_soon' ? 'Ending Soon' : 'Active';
                    return (
                      <div
                        key={sub.id}
                        className={`customer-subscription-row p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between ${
                          badge.status === 'expiring_soon'
                            ? 'customer-subscription-row--ending-soon'
                            : badge.status === 'active' ? 'customer-subscription-row--active' : ''
                        }`}
                      >
                        <span className="customer-subscription-icon hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200/70 bg-violet-50 text-sm font-bold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300 sm:flex" aria-hidden="true">{(srv?.name || 'S').trim().charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
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
                        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:shrink-0 sm:justify-end">
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
            <div id="customer-purchases" className="customer-detail-section">
              <section aria-label="Customer payment history" className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white"><CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" aria-hidden="true" />Payment history ({detailedPaymentHistory.length})</h3>
                  <span className="text-[10px] text-slate-500">Received amounts include any advance payment.</span>
                </div>
                {detailedPaymentHistory.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900/50">No payment history yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {detailedPaymentHistory.map(payment => (
                      <li key={payment.id} className="customer-transaction-row flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-xs dark:border-slate-700">
                        <span className="customer-row-icon hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 sm:flex" aria-hidden="true"><CreditCard className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{formatAppEventDateTime(payment.createdAt || payment.paymentDate)} · {payment.paymentMethodName || payment.paymentMethod} · {payment.paymentStatus}</p>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {payment.allocations?.length
                              ? `Allocated to sale${payment.allocations.length === 1 ? '' : 's'}: ${formatCurrency(getPaymentRecognizedAmount(payment), payment.currency)}`
                              : payment.advanceCreditAmount
                                ? 'Advance payment'
                                : payment.saleId ? 'Sale payment' : 'Unallocated historical payment'}
                            {Number(payment.advanceCreditAmount) > 0 ? ` · Advance payment ${formatCurrency(payment.advanceCreditAmount || 0, payment.currency)}` : ''}
                          </p>
                        </div>
                        <strong className="font-mono text-slate-900 dark:text-white">{formatCurrency(payment.amount, payment.currency)}</strong>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
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
                      <div key={sale.id} className="customer-transaction-row flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                        <span className="customer-row-icon hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300 sm:flex" aria-hidden="true"><Receipt className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatAppEventDateTime(sale.createdAt || sale.date)}
                          </div>
                          {getSaleLineFinancialAllocations(sale, payments).map(({ item }) => (
                            <div key={item.id} className="mt-0.5 text-slate-500 dark:text-slate-400">
                              <span>{services.find(service => service.id === item.serviceId)?.name || '—'} · {item.plan}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span>
                              {item.expectedPaymentDate && (
                                <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                                  Expected payment · {formatAppDate(item.expectedPaymentDate, language)}
                                </span>
                              )}
                            </div>
                          ))}
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
                      <div key={invoice.invoiceId} className="customer-transaction-row flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                        <span className="customer-row-icon hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 sm:flex" aria-hidden="true"><FileText className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {invoice.invoiceNumber} · {formatAppEventDateTime(invoice.createdAt || invoice.invoiceDate)}
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
                            Download PNG
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
                        <div key={pay.id} className="customer-transaction-row flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                          <span className="customer-row-icon hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 sm:flex" aria-hidden="true"><CreditCard className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                              {services.find(service => service.id === serviceId)?.name || (language === 'bn' ? 'সার্ভিস অনুপলব্ধ' : 'Service unavailable')}
                            </div>
                            <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                              {formatAppEventDateTime(pay.createdAt || pay.paymentDate)} · {pay.paymentMethodName || pay.paymentMethod}
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

            {/* Customer transaction timeline */}
            <section id="customer-activity" aria-label="Customer transaction timeline" className="customer-detail-section overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <History className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                    Transactions & activity
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {detailedTimeline.length} {detailedTimeline.length === 1 ? 'record' : 'records'} · newest first
                  </p>
                </div>
                <div role="group" aria-label="Filter customer activity" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {([
                    ['all', 'All'],
                    ['sales', 'Sales'],
                    ['payments', 'Payments'],
                    ['subscriptions', 'Subscriptions'],
                    ['refunds', 'Refunds'],
                  ] as const).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={timelineFilter === filter}
                      onClick={() => setTimelineFilter(filter)}
                      className={`min-h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-600 ${
                        timelineFilter === filter
                          ? 'bg-white text-violet-800 shadow-xs dark:bg-slate-700 dark:text-violet-200'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {visibleTimeline.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {detailedTimeline.length === 0
                    ? 'No transaction activity recorded for this customer yet.'
                    : timelineFilter === 'refunds'
                      ? 'No refunds recorded for this customer.'
                      : `No ${timelineFilter} recorded for this customer.`}
                </p>
              ) : (
                <ol aria-label="Customer transaction events" className="customer-timeline--v2 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {visibleTimeline.map(event => {
                    const iconClass = event.type === 'refund'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                      : event.type === 'payment'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : event.type === 'subscription'
                          ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
                          : event.type === 'invoice'
                            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
                    const eventIcon = event.type === 'refund'
                      ? <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      : event.type === 'payment'
                        ? <CreditCard className="h-4 w-4" aria-hidden="true" />
                        : event.type === 'subscription'
                          ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          : event.type === 'invoice'
                            ? <FileText className="h-4 w-4" aria-hidden="true" />
                            : <Receipt className="h-4 w-4" aria-hidden="true" />;
                    const handleOpenEvent = () => {
                      if (event.type === 'sale') onViewSale(event.recordId);
                      else if (event.type === 'payment' || event.type === 'refund') onViewPayment?.(event.recordId);
                      else if (event.type === 'subscription') onViewSubscription(event.recordId);
                      else onViewInvoice?.(event.recordId);
                    };
                    const canOpenEvent = event.type === 'sale'
                      || event.type === 'subscription'
                      || (event.type === 'payment' || event.type === 'refund' ? Boolean(onViewPayment) : Boolean(onViewInvoice));
                    const content = (
                      <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{event.title}</span>
                            {event.status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{event.status.replaceAll('_', ' ')}</span>}
                          </span>
                          <span className="mt-1 block break-words text-xs text-slate-500 dark:text-slate-400">{event.description}</span>
                          <time className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{formatAppEventDateTime(event.timestamp)}</time>
                        </span>
                        {event.amount !== undefined && (
                          <strong className={`shrink-0 text-left text-sm font-bold tabular-nums sm:text-right ${event.amount < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(event.amount, event.currency)}
                          </strong>
                        )}
                      </span>
                    );
                    return (
                      <li key={event.id} className="flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-5">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{eventIcon}</span>
                        {canOpenEvent ? (
                          <button
                            type="button"
                            onClick={handleOpenEvent}
                            aria-label={`Open ${event.title.toLowerCase()}: ${event.description}`}
                            className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:hover:text-violet-200"
                          >
                            {content}
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          </button>
                        ) : content}
                      </li>
                    );
                  })}
                </ol>
              )}
              {detailedActivities.length > 0 && (
                <details className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:text-violet-300">
                    Audit history ({detailedActivities.length})
                  </summary>
                  <ol aria-label="Customer audit history" className="customer-activity-list mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {detailedActivities.map(activity => (
                      <li key={activity.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{activity.title}</div>
                          <div className="break-words text-[11px] text-slate-500 dark:text-slate-400">{activity.description}</div>
                        </div>
                        <time className="shrink-0 whitespace-nowrap font-mono text-[10px] text-slate-400">{formatAppEventDateTime(activity.timestamp)}</time>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </section>
          </div>
        </div>
        )
      )}

      {/* 7. ADD / EDIT CUSTOMER MODAL — single screen, mirrors the Add Service form */}
      {(isAddModalOpen || editingCustomer) && (
        <Modal
          isOpen={isAddModalOpen || !!editingCustomer}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingCustomer(null);
            setFormErrors({});
            setDuplicateCustomer(null);
            setAllowDuplicate(false);
            setAdvancedOpen(false);
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
          footer={(
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCustomer(null);
                  setFormErrors({});
                  setAdvancedOpen(false);
                }}
                className="min-h-11 rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                form="customer-profile-form"
                disabled={isSubmitting}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {allowDuplicate && !editingCustomer
                    ? language === 'bn' ? 'তবুও তৈরি করুন' : 'Create customer anyway'
                    : editingCustomer ? t('save') : t('addCustomer')}
                </span>
              </button>
            </div>
          )}
        >
          <form id="customer-profile-form" onSubmit={handleSaveCustomer} noValidate className="space-y-5 text-sm">
            {/* How a customer fits in: Service → Plan → Sale → Subscription → Service Account (login) → Profile */}
            <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-xs leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              কাস্টমার হলেন যিনি কিনবেন — তার নামে সেল হবে, সাবস্ক্রিপশন চালু হবে, আর সার্ভিস অ্যাকাউন্টের একটি প্রোফাইল তাকে দেওয়া হবে।
            </p>

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

            {/* Live preview — updates as you type */}
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white" aria-hidden="true">
                {getInitials(name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900 dark:text-white">
                  {name.trim() || (language === 'bn' ? 'কাস্টমারের নাম' : 'Customer name')}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {phone.trim() || (language === 'bn' ? 'ফোন নম্বর' : 'Phone number')}
                  {customerType === 'Reseller' ? ` · ${language === 'bn' ? 'রিসেলার' : 'Reseller'}` : ''}
                </p>
              </div>
            </div>

            {/* 1. Customer name */}
            <section aria-labelledby="customer-name-title" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">1</span>
                <h3 id="customer-name-title" className="text-base font-bold text-slate-900 dark:text-white">{t('customerName')} <span className="text-rose-500">*</span></h3>
              </div>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder={language === 'bn' ? 'যেমন: তানভীর হাসান' : 'e.g. Tanvir Hasan'}
                className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-base text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white ${
                  formErrors.name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {formErrors.name && (
                <p role="alert" className="text-xs text-rose-600">{formErrors.name}</p>
              )}
            </section>

            {/* 2. Phone & WhatsApp */}
            <section aria-labelledby="customer-phone-title" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">2</span>
                <h3 id="customer-phone-title" className="text-base font-bold text-slate-900 dark:text-white">{language === 'bn' ? 'ফোন ও হোয়াটসঅ্যাপ' : 'Phone & WhatsApp'}</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('phone')} <span className="text-rose-500">*</span></span>
                  <input
                    ref={phoneInputRef}
                    type="text"
                    inputMode="tel"
                    value={phone}
                    onChange={e => {
                      setPhone(e.target.value);
                      setAllowDuplicate(false);
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="+880 1711-223344"
                    className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white ${
                      formErrors.phone ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {formErrors.phone && (
                    <span role="alert" className="block text-xs text-rose-600">{formErrors.phone}</span>
                  )}
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('whatsappNumber')} <span className="font-normal text-slate-400">{language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}</span></span>
                  <input
                    type="text"
                    inputMode="tel"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    placeholder={language === 'bn' ? 'ফোন নম্বরই ব্যবহার হবে' : 'Defaults to Phone'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'bn'
                  ? 'হোয়াটসঅ্যাপ নম্বর না দিলে ফোন নম্বরটাই হোয়াটসঅ্যাপ হিসেবে ব্যবহার হবে।'
                  : 'If left blank, the phone number is used as the WhatsApp number.'}
              </p>
            </section>

            {/* 3. Customer type */}
            <section aria-labelledby="customer-type-title" className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">3</span>
                <h3 id="customer-type-title" className="text-base font-bold text-slate-900 dark:text-white">{language === 'bn' ? 'ধরন' : 'Customer type'}</h3>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={language === 'bn' ? 'ধরন' : 'Customer type'}>
                {(['Customer', 'Reseller'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={customerType === type}
                    onClick={() => setCustomerType(type)}
                    className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                      customerType === type
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {type === 'Customer'
                      ? (language === 'bn' ? 'কাস্টমার' : 'Customer')
                      : (language === 'bn' ? 'রিসেলার' : 'Reseller')}
                  </button>
                ))}
              </div>
            </section>

            {/* 4. More settings (collapsed, optional) */}
            <section aria-labelledby="customer-advanced-title" className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAdvancedOpen(previous => !previous)}
                aria-expanded={advancedOpen}
                className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left dark:bg-slate-800/60"
              >
                <span id="customer-advanced-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">{language === 'bn' ? 'আরও সেটিংস (ঐচ্ছিক)' : 'More settings (optional)'}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-4 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  {/* Email */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('email')} <span className="font-normal text-slate-400">{language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}</span></span>
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        setAllowDuplicate(false);
                        if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                      }}
                      placeholder="tanvir@example.com"
                      className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white ${
                        formErrors.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.email && (
                      <span role="alert" className="block text-xs text-rose-600">{formErrors.email}</span>
                    )}
                  </label>

                  {/* Facebook profile & ID */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('facebookProfile')} <span className="font-normal text-slate-400">{language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}</span></span>
                      <input
                        ref={facebookInputRef}
                        type="text"
                        value={facebookUrl}
                        onChange={e => {
                          setFacebookUrl(e.target.value);
                          if (formErrors.facebookUrl) setFormErrors(prev => ({ ...prev, facebookUrl: '' }));
                        }}
                        placeholder="https://facebook.com/username"
                        className={`w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white ${
                          formErrors.facebookUrl ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      {formErrors.facebookUrl && (
                        <span role="alert" className="block text-xs text-rose-600">{formErrors.facebookUrl}</span>
                      )}
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('facebookId')} <span className="font-normal text-slate-400">{language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}</span></span>
                      <input
                        type="text"
                        value={facebookId}
                        onChange={e => setFacebookId(e.target.value)}
                        placeholder="tanvir.prime"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                  </div>

                  {/* Address */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('address')} <span className="font-normal text-slate-400">{language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}</span></span>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder={language === 'bn' ? 'ধানমন্ডি, ঢাকা' : 'Dhanmondi, Dhaka'}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                    />
                  </label>

                  {/* Notes */}
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('notes')} <span className="font-normal text-slate-400">{language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}</span></span>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={language === 'bn' ? 'ভিআইপি ক্রেতা, বিকাশে পেমেন্ট পছন্দ করেন...' : 'VIP buyer, prefers bKash payment...'}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                    />
                  </label>

                  {/* Contact preferences */}
                  <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                    <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'যোগাযোগের পছন্দ' : 'Contact Preferences'}
                    </legend>
                    <div>
                      <p className="mb-2 text-[11px] font-medium text-slate-500">{language === 'bn' ? 'কোন মাধ্যমে যোগাযোগ করবেন' : 'Preferred contact'}</p>
                      <div className="flex flex-wrap gap-2" role="group" aria-label={language === 'bn' ? 'যোগাযোগের মাধ্যম' : 'Preferred contact'}>
                        {(['phone', 'whatsapp', 'email', 'other'] as const).map(method => (
                          <button
                            key={method}
                            type="button"
                            aria-pressed={contactMethod === method}
                            onClick={() => setContactMethod(method)}
                            className={`min-h-10 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                              contactMethod === method
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                            }`}
                          >
                            {method === 'phone' ? (language === 'bn' ? 'ফোন' : 'Phone')
                              : method === 'whatsapp' ? 'WhatsApp'
                              : method === 'email' ? (language === 'bn' ? 'ইমেইল' : 'Email')
                              : (language === 'bn' ? 'অন্যান্য' : 'Other')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">{language === 'bn' ? 'যোগাযোগের অনুমতি' : 'Contact permission'}</span>
                        <select
                          value={contactAllowed === undefined ? 'unset' : contactAllowed ? 'allowed' : 'not-allowed'}
                          onChange={event => setContactAllowed(event.target.value === 'unset' ? undefined : event.target.value === 'allowed')}
                          className="min-h-11 w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-2 text-sm dark:border-slate-700"
                        >
                          <option value="unset">{language === 'bn' ? 'ঠিক করা হয়নি' : 'Not set'}</option>
                          <option value="allowed">{language === 'bn' ? 'অনুমতি আছে' : 'Allowed'}</option>
                          <option value="not-allowed">{language === 'bn' ? 'অনুমতি নেই' : 'Not allowed'}</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">{language === 'bn' ? 'পছন্দের ভাষা' : 'Preferred language'}</span>
                        <select
                          value={preferredLanguage}
                          onChange={event => setPreferredLanguage(event.target.value as typeof preferredLanguage)}
                          className="min-h-11 w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-2 text-sm dark:border-slate-700"
                        >
                          <option value="en">English</option>
                          <option value="bn">Bangla</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                </div>
              )}
            </section>

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

