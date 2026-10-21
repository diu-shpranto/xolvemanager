import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Filter,
  HandCoins,
  MessageCircle,
  Phone,
  Search,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { CustomerNameWithType } from '../common/CustomerNameWithType';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import { formatAppDate, formatCurrency, getDaysDifference, getDateInTimeZone, getTodayDateString } from '../../utils/dateUtils';
import { getCustomerDisplayName, getCustomerOptionLabel, resolvePaymentCustomer } from '../../utils/relationships';
import {
  amountToMinorUnits,
  getCustomerAdvanceCredit,
  getPaymentCashSaleAllocation,
  getPaymentRefundTotals,
  getSaleDueAmount,
  getSaleLineItems,
  getSalePaidAmount,
  getSalePaymentStatus,
  getSalePayments,
  minorUnitsToAmount,
  parseAmountToMinorUnits,
  splitPaymentAllocation,
} from '../../utils/saleUtils';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { convertReportCurrency } from '../../utils/reportMetrics';
import { getDefaultPaymentMethod, getPaymentMethodSummary, normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../../utils/paymentMethods';
import { normalizePhoneDigits, normalizeSearchText } from '../../services/globalSearch';
import { createRecordId, readJsonValue, writeJsonValue } from '../../services/localStorageStore';
import { downloadCSV } from '../../utils/csvParser';
import { exportPaymentsCSV } from '../../services/dataBackupService';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import type { AppCurrency, Payment, PaymentMethod, PaymentStatus, Sale } from '../../types';
import {
  buildDueCollectionSummary,
  getCustomerDueFollowUpStorageKey,
  isCustomerDueFollowUps,
  type CustomerDueFollowUps,
  type CustomerDueFollowUpStatus,
} from '../../utils/dueCollection';

interface PaymentsViewProps {
  focusPaymentId?: string;
  onFocusedPaymentHandled?: () => void;
  createRequest?: number;
  onCreateRequestHandled?: () => void;
  preselectedCustomerId?: string;
  preselectedSaleId?: string;
  onNavigateSection?: (section: string, targetId?: string) => void;
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';
type PaymentViewTab = 'payments' | 'outstanding' | 'due-collection';
type CollectionPeriod = 'month' | 'last_month' | 'all';
type SortOrder = 'highest' | 'oldest' | 'newest';

const followUpLabels: Record<CustomerDueFollowUpStatus, string> = {
  follow_up_required: 'Follow-up required',
  contacted: 'Contacted',
  promise_to_pay: 'Promise to pay',
  partially_settled: 'Partially settled',
  resolved: 'Resolved',
};

const pageSize = 20;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getDateRange(filter: DateFilter, start: string, end: string, timeZone?: string): [string, string] | null {
  const today = new Date(`${getDateInTimeZone(timeZone)}T12:00:00`);
  const toDateString = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (filter === 'custom') return [start, end];
  if (filter === 'all') return null;
  let first = new Date(today);
  let last = new Date(today);
  if (filter === 'yesterday') {
    first.setDate(first.getDate() - 1);
    last = new Date(first);
  } else if (filter === 'week') {
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  } else if (filter === 'month') {
    first = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (filter === 'last_month') {
    first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    last = new Date(today.getFullYear(), today.getMonth(), 0);
  }
  return [toDateString(first), toDateString(last)];
}

function getAgingDays(referenceDate: string, timeZone?: string): number {
  return Math.max(0, -getDaysDifference(referenceDate, timeZone));
}

function getAgingBucket(days: number, formatNumber: (value: number) => string, dayLabel: string): string {
  if (days <= 7) return `${formatNumber(0)}–${formatNumber(7)} ${dayLabel}`;
  if (days <= 30) return `${formatNumber(8)}–${formatNumber(30)} ${dayLabel}`;
  if (days <= 60) return `${formatNumber(31)}–${formatNumber(60)} ${dayLabel}`;
  return `${formatNumber(60)}+ ${dayLabel}`;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  focusPaymentId,
  onFocusedPaymentHandled,
  createRequest,
  onCreateRequestHandled,
  preselectedCustomerId,
  preselectedSaleId,
  onNavigateSection,
}) => {
  const { formatCurrency, formatDate: formatAppDate, formatDateTime: formatAppDateTime, formatDurationDays, formatNumber } = useAppFormatting();
  const {
    payments,
    reminders,
    customers,
    sales,
    invoices,
    subscriptions,
    services,
    settings,
    currentBusiness,
    activityLogs,
    ensureInvoiceForSale,
    recordSalePayment,
    applyCustomerAdvanceToSale,
    recordPaymentRefund,
    addPayment,
    logActivity,
    language,
    t,
    currency,
  } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();

  const [activeTab, setActiveTab] = useState<PaymentViewTab>('payments');
  const [dueSearch, setDueSearch] = useState('');
  const [dueCustomerType, setDueCustomerType] = useState<'all' | 'Customer' | 'Reseller'>('all');
  const [dueSortOrder, setDueSortOrder] = useState<'highest' | 'overdue' | 'oldest'>('highest');
  const [collectionPeriod, setCollectionPeriod] = useState<CollectionPeriod>('month');
  const [customerDueFollowUps, setCustomerDueFollowUps] = useState<CustomerDueFollowUps>({});
  const [followUpNotesDraft, setFollowUpNotesDraft] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedAmount, setSelectedAmount] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('highest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [focusedPaymentIdState, setFocusedPaymentIdState] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundFormOpen, setRefundFormOpen] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundDateInput, setRefundDateInput] = useState(getTodayDateString(settings.businessProfile?.timeZone));
  const [refundNote, setRefundNote] = useState('');
  const [isRefundSaving, setIsRefundSaving] = useState(false);
  const refundOperationId = useRef('');
  const isRefundSavingRef = useRef(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<ReturnType<typeof buildInvoiceSaleDetails> | null>(null);

  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [newPaymentMode, setNewPaymentMode] = useState<'sale' | 'advance' | 'apply-advance'>('sale');
  const [saleSearch, setSaleSearch] = useState('');
  const [newSaleId, setNewSaleId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newAdvanceCurrency, setNewAdvanceCurrency] = useState<AppCurrency>(currency);
  const [newMethod, setNewMethod] = useState<PaymentMethod>('Cash');
  const [newStatus, setNewStatus] = useState<Extract<PaymentStatus, 'paid' | 'pending' | 'failed'>>('paid');
  const [newTransactionId, setNewTransactionId] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(getTodayDateString(settings.businessProfile?.timeZone));
  const [newNotes, setNewNotes] = useState('');
  const [newCustomerFilter, setNewCustomerFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [possibleDuplicateConfirmed, setPossibleDuplicateConfirmed] = useState(false);
  const operationId = useRef('');
  const isSavingRef = useRef(false);

  const resetPaymentFilters = () => {
    setSelectedMethod('all');
    setSelectedStatus('all');
    setSelectedDate('all');
    setCustomStart('');
    setCustomEnd('');
    setSelectedService('all');
    setSelectedCustomer('all');
    setSelectedAmount('all');
    setSearchInput('');
    setSearchQuery('');
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedMethod, selectedStatus, selectedDate, customStart, customEnd, selectedService, selectedCustomer, selectedAmount, activeTab, sortOrder, dueSearch, dueCustomerType, dueSortOrder]);

  useEffect(() => {
    if (!focusPaymentId) return;
    const payment = payments.find(item => item.id === focusPaymentId);
    if (payment) {
      setActiveTab('payments');
      setSelectedStatus('all');
      setSelectedMethod('all');
      setFocusedPaymentIdState(payment.id);
      setSelectedPayment(payment);
    }
    onFocusedPaymentHandled?.();
  }, [focusPaymentId, payments, onFocusedPaymentHandled]);

  useEffect(() => {
    if (!createRequest) return;
    setNewPaymentMode('sale');
    setNewSaleId(preselectedSaleId || '');
    setNewAdvanceCurrency(currency);
    setSaleSearch('');
    setNewAmount('');
    setNewStatus('paid');
    setNewMethod((getDefaultPaymentMethod(normalizePaymentMethods(settings.paymentPreferences?.methods), settings.paymentPreferences?.defaultMethodId) || 'Cash') as PaymentMethod);
    setNewTransactionId('');
    setNewPaymentDate(getTodayDateString(settings.businessProfile?.timeZone));
    setNewNotes('');
    setNewCustomerFilter(preselectedCustomerId || 'all');
    operationId.current = createRecordId('sale-payment-operation');
    setIsAddPaymentOpen(true);
    onCreateRequestHandled?.();
  }, [createRequest, onCreateRequestHandled, preselectedCustomerId, preselectedSaleId, settings.paymentPreferences?.methods, currency]);

  const currentBusinessId = currentBusiness?.businessId || 'local';
  useEffect(() => {
    const savedFollowUps = readJsonValue<CustomerDueFollowUps>(
      getCustomerDueFollowUpStorageKey(currentBusinessId),
      {},
      isCustomerDueFollowUps
    );
    setCustomerDueFollowUps(savedFollowUps);
    setFollowUpNotesDraft(Object.fromEntries(
      Object.entries(savedFollowUps).map(([customerId, followUp]) => [customerId, followUp.note || ''])
    ));
  }, [currentBusinessId]);

  const customersById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const servicesById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
  const saleItemLabel = (sale: Sale): string => getSaleLineItems(sale).map(item =>
    `${servicesById.get(item.serviceId)?.name || 'Service'} · ${item.plan}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
  ).join('; ');
  const subscriptionsById = useMemo(() => new Map(subscriptions.map(subscription => [subscription.id, subscription])), [subscriptions]);
  const invoicesBySaleId = useMemo(() => new Map(invoices.map(invoice => [invoice.saleId, invoice])), [invoices]);
  const salesById = useMemo(() => new Map(sales.map(sale => [sale.id, sale])), [sales]);
  const paymentSales = useMemo(() => {
    const byId = new Map<string, Sale>();
    payments.forEach(payment => {
      const linkedSale = payment.saleId
        ? salesById.get(payment.saleId)
        : payment.invoiceId
          ? sales.find(sale => invoicesBySaleId.get(sale.id)?.invoiceId === payment.invoiceId)
          : payment.subscriptionId
            ? sales.find(sale => sale.subscriptionId === payment.subscriptionId && sale.customerId === payment.customerId)
            : undefined;
      if (linkedSale) byId.set(payment.id, linkedSale);
    });
    return byId;
  }, [payments, salesById, sales, invoicesBySaleId]);
  const paymentsBySaleId = useMemo(() => {
    const index = new Map<string, Payment[]>();
    payments.forEach(payment => {
      const saleIds = new Set([
        payment.saleId,
        ...(payment.allocations || []).map(allocation => allocation.saleId),
        ...(payment.refundedSaleAllocations || []).map(allocation => allocation.saleId),
      ].filter((saleId): saleId is string => Boolean(saleId)));
      if (!saleIds.size) {
        const legacySale = paymentSales.get(payment.id);
        if (legacySale) saleIds.add(legacySale.id);
      }
      saleIds.forEach(saleId => {
        const sale = salesById.get(saleId);
        if (!sale || sale.customerId !== payment.customerId || sale.currency !== payment.currency) return;
        const linked = index.get(sale.id) || [];
        linked.push(payment);
        index.set(sale.id, linked);
      });
    });
    return index;
  }, [payments, paymentSales, salesById]);

  const paymentMethods = useMemo(() => normalizePaymentMethods(settings.paymentPreferences?.methods), [settings.paymentPreferences?.methods]);
  const activePaymentMethods = paymentMethods.filter(method => method.enabled).map(method => method.name) as PaymentMethod[];
  const methodOptions = useMemo(
    () => [...new Set([...paymentMethods.map(method => method.name), ...payments.map(payment => payment.paymentMethodName || payment.paymentMethod)])],
    [paymentMethods, payments]
  );

  const outstandingSales = useMemo(() => sales
    .map(sale => {
      const linkedPayments = paymentsBySaleId.get(sale.id) || [];
      const invoice = invoicesBySaleId.get(sale.id);
      const due = getSaleDueAmount(sale, linkedPayments);
      return {
        sale,
        invoice,
        due,
        paid: getSalePaidAmount(sale, linkedPayments),
        lastPayment: getSalePayments(sale, linkedPayments)
          .filter(payment => payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
          .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0],
        dueReferenceDate: invoice?.invoiceDate || sale.date,
        status: getSalePaymentStatus(sale, linkedPayments),
      };
    })
    .filter(item => item.due > 0 && item.status !== 'refunded'), [sales, paymentsBySaleId, invoicesBySaleId]);

  const dateRange = useMemo(
    () => getDateRange(selectedDate, customStart, customEnd, settings.businessProfile?.timeZone),
    [selectedDate, customStart, customEnd, settings.businessProfile?.timeZone]
  );
  const visiblePayments = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    const queryDigits = normalizePhoneDigits(searchQuery);
    const found = payments.filter(payment => {
      const customer = resolvePaymentCustomer(payment, customers, sales, subscriptions);
      const sale = paymentSales.get(payment.id);
      const invoice = payment.invoiceId
        ? invoices.find(item => item.invoiceId === payment.invoiceId)
        : sale ? invoicesBySaleId.get(sale.id) : undefined;
      const service = sale ? servicesById.get(sale.serviceId) : undefined;
      const saleItems = sale ? getSaleLineItems(sale) : [];
      const fields = [
        payment.id,
        payment.transactionId || '',
        customer?.name || '',
        customer?.phone || '',
        customer?.email || '',
        invoice?.invoiceNumber || sale?.invoiceNo || '',
        sale?.id || payment.saleId || '',
        service?.name || '',
        ...saleItems.flatMap(item => [servicesById.get(item.serviceId)?.name || '', item.plan]),
        payment.paymentMethodName || payment.paymentMethod,
      ];
      const queryMatch = !query || fields.some(field => normalizeSearchText(field).includes(query))
        || (queryDigits.length >= 3 && customer?.phone
          ? normalizePhoneDigits(customer.phone).includes(queryDigits)
          : false);
      const matchesMethod = selectedMethod === 'all' || (payment.paymentMethodName || payment.paymentMethod) === selectedMethod;
      const matchesStatus = selectedStatus === 'all' || payment.paymentStatus === selectedStatus;
      const matchesDate = !dateRange || (payment.paymentDate >= dateRange[0] && payment.paymentDate <= dateRange[1]);
      const matchesService = selectedService === 'all' || saleItems.some(item => item.serviceId === selectedService);
      const matchesCustomer = selectedCustomer === 'all' || payment.customerId === selectedCustomer;
      const amountInBdt = convertReportCurrency(payment.amount, payment.currency, 'BDT');
      const matchesAmount = selectedAmount === 'all'
        || (selectedAmount === 'under500' && amountInBdt < 500)
        || (selectedAmount === '500to1000' && amountInBdt >= 500 && amountInBdt <= 1000)
        || (selectedAmount === '1000to5000' && amountInBdt > 1000 && amountInBdt <= 5000)
        || (selectedAmount === 'over5000' && amountInBdt > 5000);
      return queryMatch && matchesMethod && matchesStatus && matchesDate && matchesService && matchesCustomer && matchesAmount;
    });
    return found.sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)
      || (right.createdAt || '').localeCompare(left.createdAt || ''));
  }, [payments, customers, sales, subscriptions, invoices, paymentSales, invoicesBySaleId, servicesById, searchQuery, selectedMethod, selectedStatus, dateRange, selectedService, selectedCustomer, selectedAmount]);

  const visibleOutstanding = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    const queryDigits = normalizePhoneDigits(searchQuery);
    const found = outstandingSales.filter(item => {
      const customer = customersById.get(item.sale.customerId);
      const service = servicesById.get(item.sale.serviceId);
      const saleItems = getSaleLineItems(item.sale);
      const fields = [customer?.name || '', customer?.phone || '', customer?.email || '', item.invoice?.invoiceNumber || item.sale.invoiceNo, item.sale.id, service?.name || '', ...saleItems.flatMap(line => [line.plan, servicesById.get(line.serviceId)?.name || ''])];
      const queryMatch = !query || fields.some(field => normalizeSearchText(field).includes(query))
        || (queryDigits.length >= 3 && customer?.phone ? normalizePhoneDigits(customer.phone).includes(queryDigits) : false);
      const matchesMethod = selectedMethod === 'all' || (paymentsBySaleId.get(item.sale.id) || []).some(payment =>
        (payment.paymentMethodName || payment.paymentMethod) === selectedMethod
      );
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchesService = selectedService === 'all' || saleItems.some(line => line.serviceId === selectedService);
      const matchesCustomer = selectedCustomer === 'all' || item.sale.customerId === selectedCustomer;
      const matchesDate = !dateRange || (item.dueReferenceDate >= dateRange[0] && item.dueReferenceDate <= dateRange[1]);
      const dueInBdt = convertReportCurrency(item.due, item.sale.currency, 'BDT');
      const matchesAmount = selectedAmount === 'all'
        || (selectedAmount === 'under500' && dueInBdt < 500)
        || (selectedAmount === '500to1000' && dueInBdt >= 500 && dueInBdt <= 1000)
        || (selectedAmount === '1000to5000' && dueInBdt > 1000 && dueInBdt <= 5000)
        || (selectedAmount === 'over5000' && dueInBdt > 5000);
      return queryMatch && matchesMethod && matchesStatus && matchesService && matchesCustomer && matchesDate && matchesAmount;
    });
    return found.sort((left, right) => sortOrder === 'oldest'
      ? left.dueReferenceDate.localeCompare(right.dueReferenceDate)
      : sortOrder === 'newest'
        ? right.dueReferenceDate.localeCompare(left.dueReferenceDate)
        : convertReportCurrency(right.due, right.sale.currency, 'BDT') - convertReportCurrency(left.due, left.sale.currency, 'BDT'));
  }, [outstandingSales, paymentsBySaleId, searchQuery, customersById, servicesById, selectedMethod, selectedStatus, selectedService, selectedCustomer, dateRange, selectedAmount, sortOrder]);

  const currencyTotals = useMemo(() => {
    const totals: Record<AppCurrency, { received: number; due: number; refunded: number }> = {
      BDT: { received: 0, due: 0, refunded: 0 },
      USD: { received: 0, due: 0, refunded: 0 },
    };
    visiblePayments.forEach(payment => {
      if (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial') {
        totals[payment.currency].received += Number(payment.amount) || 0;
      } else if (payment.paymentStatus === 'refunded') {
        totals[payment.currency].refunded += Number(payment.amount) || 0;
      }
    });
    visibleOutstanding.forEach(item => {
      totals[item.sale.currency].due += item.due;
    });
    return totals;
  }, [visiblePayments, visibleOutstanding]);
  const partialCount = useMemo(() => visiblePayments.filter(payment => payment.paymentStatus === 'partial').length, [visiblePayments]);
  const pendingCount = useMemo(() => visiblePayments.filter(payment => payment.paymentStatus === 'pending').length, [visiblePayments]);
  const failedCount = useMemo(() => visiblePayments.filter(payment => payment.paymentStatus === 'failed').length, [visiblePayments]);
  const today = getTodayDateString(settings.businessProfile?.timeZone);
  const collectionDateRangeValues = collectionPeriod === 'all' ? null : getDateRange(collectionPeriod, '', '', settings.businessProfile?.timeZone);
  const collectionDateRange = {
    start: collectionDateRangeValues?.[0] || '0000-01-01',
    end: collectionDateRangeValues?.[1] || '9999-12-31',
  };
  const dueCollectionSummary = useMemo(() => buildDueCollectionSummary({
    sales,
    payments,
    invoices,
    customers,
    subscriptions,
    currency,
    today,
    dateRange: collectionDateRange,
  }), [sales, payments, invoices, customers, subscriptions, currency, today, collectionDateRange.start, collectionDateRange.end]);
  const visibleDueCustomers = useMemo(() => {
    const query = normalizeSearchText(dueSearch);
    const queryDigits = normalizePhoneDigits(dueSearch);
    const filtered = dueCollectionSummary.customers.filter(summary => {
      const customer = summary.customer;
      const fields = [customer.name, customer.phone, customer.email, customer.customerType || 'Customer'];
      const matchesQuery = !query
        || fields.some(field => normalizeSearchText(field || '').includes(query))
        || (queryDigits.length >= 3 && normalizePhoneDigits(customer.phone || '').includes(queryDigits));
      const matchesType = dueCustomerType === 'all'
        || (customer.customerType || 'Customer') === dueCustomerType;
      return matchesQuery && matchesType;
    });
    return filtered.sort((left, right) => dueSortOrder === 'oldest'
      ? (left.earliestOverdueDate || '9999-12-31').localeCompare(right.earliestOverdueDate || '9999-12-31')
      : dueSortOrder === 'overdue'
        ? right.overdue - left.overdue
        : right.due - left.due);
  }, [dueCollectionSummary.customers, dueSearch, dueCustomerType, dueSortOrder]);
  const paymentMethodSummaries = useMemo(
    () => (['BDT', 'USD'] as const).map(currency => ({
      currency,
      methods: getPaymentMethodSummary(
        visiblePayments.filter(payment => payment.currency === currency),
        paymentMethods,
        currency,
        today
      ),
    })).filter(group => group.methods.length > 0),
    [visiblePayments, paymentMethods, today]
  );
  const totalPages = Math.max(1, Math.ceil((
    activeTab === 'payments' ? visiblePayments.length
      : activeTab === 'outstanding' ? visibleOutstanding.length : visibleDueCustomers.length
  ) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagePayments = visiblePayments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageOutstanding = visibleOutstanding.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageDueCustomers = visibleDueCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const eligibleSales = useMemo(() => sales.filter(sale => {
    const linkedPayments = paymentsBySaleId.get(sale.id) || [];
    const due = getSaleDueAmount(sale, linkedPayments);
    if (due <= 0 || getSalePaymentStatus(sale, linkedPayments) === 'refunded') return false;
    if (newCustomerFilter !== 'all' && sale.customerId !== newCustomerFilter) return false;
    if (newPaymentMode === 'apply-advance' && sale.currency !== newAdvanceCurrency) return false;
    const query = normalizeSearchText(saleSearch);
    if (!query) return true;
    const customer = customersById.get(sale.customerId);
    const itemLabel = saleItemLabel(sale);
    const invoice = invoicesBySaleId.get(sale.id);
    const fields = [sale.id, sale.invoiceNo, invoice?.invoiceNumber || '', customer?.name || '', customer?.phone || '', itemLabel];
    const digits = normalizePhoneDigits(saleSearch);
    return fields.some(field => normalizeSearchText(field).includes(query))
      || (digits.length >= 3 && customer?.phone ? normalizePhoneDigits(customer.phone).includes(digits) : false);
  }).sort((left, right) => right.date.localeCompare(left.date)), [sales, paymentsBySaleId, newCustomerFilter, newPaymentMode, newAdvanceCurrency, saleSearch, customersById, servicesById, invoicesBySaleId]);
  const newSale = salesById.get(newSaleId);
  const newSaleCustomer = newSale ? customersById.get(newSale.customerId) : undefined;
  const newSaleService = newSale ? servicesById.get(newSale.serviceId) : undefined;
  const newSaleInvoice = newSale ? invoicesBySaleId.get(newSale.id) : undefined;
  const newSalePayments = newSale ? paymentsBySaleId.get(newSale.id) || [] : [];
  const newSaleDue = newSale ? getSaleDueAmount(newSale, newSalePayments) : 0;
  const parsedNewAmountMinor = parseAmountToMinorUnits(newAmount);
  const availableAdvance = newCustomerFilter === 'all'
    ? 0
    : getCustomerAdvanceCredit(payments, newCustomerFilter, newPaymentMode === 'advance' ? newAdvanceCurrency : newSale?.currency || newAdvanceCurrency);
  const newPaymentAllocation = splitPaymentAllocation(
    parsedNewAmountMinor === null ? 0 : minorUnitsToAmount(parsedNewAmountMinor),
    newSaleDue
  );
  const duplicateTransaction = useMemo(() => {
    const transactionId = newTransactionId.trim().toLocaleLowerCase();
    if (!transactionId || !newSale) return null;
    return payments.find(payment => payment.transactionId?.trim().toLocaleLowerCase() === transactionId);
  }, [newTransactionId, newSale, payments]);
  const possibleDuplicate = useMemo(() => {
    if (newPaymentMode !== 'sale' || !newSale || parsedNewAmountMinor === null || !newPaymentDate) return null;
    return payments.find(payment => {
      const cashAllocationMinor = amountToMinorUnits(getPaymentCashSaleAllocation(payment, newSale));
      return (payment.paymentStatus === 'paid' || payment.paymentStatus === 'partial')
        && payment.customerId === newSale.customerId
        && payment.currency === newSale.currency
        && cashAllocationMinor > 0
        && payment.paymentMethod === newMethod
        && payment.paymentDate === newPaymentDate
        && cashAllocationMinor === parsedNewAmountMinor;
    }) || null;
  }, [newPaymentMode, newSale, parsedNewAmountMinor, newPaymentDate, newMethod, payments]);

  const saveCustomerFollowUp = (
    customerId: string,
    status: CustomerDueFollowUpStatus,
    note: string
  ) => {
    const storageKey = getCustomerDueFollowUpStorageKey(currentBusinessId);
    const latestFollowUps = readJsonValue<CustomerDueFollowUps>(storageKey, {}, isCustomerDueFollowUps);
    const nextFollowUps: CustomerDueFollowUps = {
      ...latestFollowUps,
      [customerId]: {
        status,
        note: note.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
    };
    try {
      writeJsonValue(storageKey, nextFollowUps);
      setCustomerDueFollowUps(nextFollowUps);
      setFollowUpNotesDraft(previous => ({ ...previous, [customerId]: note }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the follow-up status.', 'error');
    }
  };

  const openAddPayment = (customerId?: string, saleId?: string) => {
    setNewPaymentMode('sale');
    setNewSaleId(saleId || '');
    setSaleSearch('');
    setNewAmount('');
    setNewStatus('paid');
    setNewMethod((getDefaultPaymentMethod(paymentMethods, settings.paymentPreferences?.defaultMethodId) || 'Cash') as PaymentMethod);
    setNewTransactionId('');
    setNewPaymentDate(getTodayDateString(settings.businessProfile?.timeZone));
    setNewNotes('');
    setNewCustomerFilter(customerId || preselectedCustomerId || 'all');
    setNewAdvanceCurrency(currency);
    setPossibleDuplicateConfirmed(false);
    operationId.current = createRecordId('sale-payment-operation');
    setIsAddPaymentOpen(true);
  };

  const handleRecordPayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || isSavingRef.current) return;
    if (newPaymentMode !== 'advance' && !newSale) {
      showToast(newPaymentMode === 'apply-advance' ? 'Choose an outstanding sale for this advance application.' : 'Choose an outstanding sale.', 'error');
      return;
    }
    if (newPaymentMode !== 'sale' && newCustomerFilter === 'all') {
      showToast('Choose a customer for this advance payment.', 'error');
      return;
    }
    if (newPaymentMode === 'apply-advance' && newSale?.customerId !== newCustomerFilter) {
      showToast('Choose a sale belonging to the selected customer.', 'error');
      return;
    }
    if (parsedNewAmountMinor === null || parsedNewAmountMinor <= 0) {
      showToast('Enter a valid amount with no more than two decimal places.', 'error');
      return;
    }
    const amount = minorUnitsToAmount(parsedNewAmountMinor);
    if (newPaymentMode === 'apply-advance') {
      const availableMinor = amountToMinorUnits(availableAdvance);
      const dueMinor = amountToMinorUnits(newSaleDue);
      if (parsedNewAmountMinor > availableMinor) {
        showToast('The application amount exceeds the customer’s available advance credit.', 'error');
        return;
      }
      if (parsedNewAmountMinor > dueMinor) {
        showToast('The application amount exceeds this sale’s outstanding due.', 'error');
        return;
      }
    }
    if (newPaymentMode === 'sale' && newStatus !== 'paid'
      && parsedNewAmountMinor > (parseAmountToMinorUnits(newSaleDue) ?? 0)) {
      showToast('Pending or failed payment attempts cannot exceed the outstanding balance.', 'error');
      return;
    }
    if (newPaymentMode !== 'apply-advance'
      && (!isValidDate(newPaymentDate) || newPaymentDate > getTodayDateString(settings.businessProfile?.timeZone))) {
      showToast('Choose a valid payment date that is not in the future.', 'error');
      return;
    }
    if (newPaymentMode !== 'apply-advance' && !activePaymentMethods.includes(newMethod)) {
      showToast('Choose an active payment method from Settings.', 'error');
      return;
    }
    if (newPaymentMode !== 'apply-advance'
      && paymentMethodRequiresTransactionId(newMethod, paymentMethods, settings.paymentPreferences?.requireTransactionId)
      && !newTransactionId.trim()) {
      showToast('Enter the required transaction ID.', 'error');
      return;
    }
    if (duplicateTransaction) {
      showToast('Possible duplicate payment. Review the existing payment before continuing.', 'error');
      return;
    }
    if (possibleDuplicate && !possibleDuplicateConfirmed) {
      showToast('Review the similar payment and confirm this is a separate receipt before continuing.', 'error');
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      if (newPaymentMode === 'apply-advance' && newSale) {
        const appliedAmount = applyCustomerAdvanceToSale(
          newCustomerFilter,
          newSale.id,
          amount,
          operationId.current
        );
        showToast(`${formatCurrency(appliedAmount, newSale.currency)} existing advance credit applied to the sale. No new cash was recorded.`, 'success');
      } else if (newPaymentMode === 'advance') {
        addPayment({
          operationId: operationId.current,
          customerId: newCustomerFilter,
          amount,
          currency: newAdvanceCurrency,
          paymentMethod: newMethod,
          transactionId: newTransactionId.trim() || undefined,
          paymentDate: newPaymentDate,
          paymentStatus: 'paid',
          allocations: [],
          advanceCreditAmount: amount,
          notes: newNotes.trim() || undefined,
        });
        showToast('Customer advance recorded. It is stored as credit, not revenue.', 'success');
      } else if (newSale) {
        recordSalePayment(newSale.id, {
          operationId: operationId.current,
          customerId: newSale.customerId,
          amount,
          currency: newSale.currency,
          paymentMethod: newMethod,
          transactionId: newTransactionId.trim() || undefined,
          paymentDate: newPaymentDate,
          paymentStatus: newStatus,
          notes: newNotes.trim() || undefined,
        });
        showToast(
          newPaymentAllocation.advanceCreditAmount > 0
            ? `Payment recorded. ${formatCurrency(newPaymentAllocation.allocatedAmount, newSale.currency)} allocated to the sale; ${formatCurrency(newPaymentAllocation.advanceCreditAmount, newSale.currency)} added as customer advance.`
            : 'Payment recorded successfully.',
          'success'
        );
      }
      setIsAddPaymentOpen(false);
      setNewCustomerFilter(preselectedCustomerId || 'all');
      setNewSaleId('');
      setNewAmount('');
      setNewTransactionId('');
      setNewNotes('');
      setPossibleDuplicateConfirmed(false);
    } catch (error) {
      console.error('Payment could not be recorded:', error);
      showToast(error instanceof Error ? error.message : 'Payment could not be recorded. Please try again.', 'error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const openInvoice = (sale: Sale) => {
    const invoice = invoicesBySaleId.get(sale.id) || ensureInvoiceForSale(sale.id);
    const details = buildInvoiceSaleDetails(
      invoice,
      sale,
      customersById.get(invoice.customerId),
      servicesById.get(invoice.serviceId),
      payments,
      settings,
      subscriptionsById.get(invoice.subscriptionId || sale.subscriptionId || ''),
      services,
      subscriptions
    );
    setSelectedInvoiceData(details);
  };

  const exportPayments = () => {
    downloadCSV(`payments-${getTodayDateString(settings.businessProfile?.timeZone)}.csv`, exportPaymentsCSV(
      visiblePayments,
      customers,
      invoices,
      sales,
      services
    ));
    logActivity({
      type: 'data_exported',
      title: 'Data Exported',
      description: `${visiblePayments.length} payment records were exported to CSV.`,
      entityType: 'data',
      metadata: { recordType: 'payments', count: visiblePayments.length },
    });
    showToast('Payments exported to CSV.', 'success');
  };

  const methodLabel = (method: PaymentMethod | string) => method === 'Bank' ? 'Bank Transfer' : method;
  const statusStyle = (status: PaymentStatus) => status === 'paid'
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
    : status === 'partial'
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
      : status === 'pending'
        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
        : status === 'failed'
          ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
          : 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300';
  const statusIcon = (status: PaymentStatus) => status === 'paid'
    ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    : status === 'failed'
      ? <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />;

  const openPaymentDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setFocusedPaymentIdState(null);
    setRefundFormOpen(false);
    setRefundAmountInput('');
    setRefundDateInput(getTodayDateString(settings.businessProfile?.timeZone));
    setRefundNote('');
  };

  const handleRecordRefund = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPayment || isRefundSaving || isRefundSavingRef.current) return;
    if (parsedRefundAmountMinor === null || parsedRefundAmountMinor <= 0
      || minorUnitsToAmount(parsedRefundAmountMinor) > selectedRefundableAmount) {
      showToast('Enter a valid refund amount within the remaining refundable balance.', 'error');
      return;
    }
    isRefundSavingRef.current = true;
    setIsRefundSaving(true);
    if (!refundOperationId.current) refundOperationId.current = createRecordId('payment-refund-operation');
    try {
      recordPaymentRefund(
        selectedPayment.id,
        minorUnitsToAmount(parsedRefundAmountMinor),
        refundDateInput,
        refundNote,
        refundOperationId.current
      );
      showToast('Refund recorded. Sale balances and customer advance were updated.', 'success');
      setRefundFormOpen(false);
      setRefundAmountInput('');
      setRefundDateInput(getTodayDateString(settings.businessProfile?.timeZone));
      setRefundNote('');
    } catch (error) {
      console.error('Payment refund could not be recorded:', error);
      showToast(error instanceof Error ? error.message : 'Payment refund could not be recorded.', 'error');
    } finally {
      isRefundSavingRef.current = false;
      setIsRefundSaving(false);
    }
  };

  const selectedSaleForPayment = selectedPayment ? paymentSales.get(selectedPayment.id) : undefined;
  const selectedCustomerForPayment = selectedPayment
    ? resolvePaymentCustomer(selectedPayment, customers, sales, subscriptions)
    : undefined;
  const selectedInvoiceForPayment = selectedPayment
    ? invoices.find(invoice => invoice.invoiceId === selectedPayment.invoiceId)
      || (selectedSaleForPayment ? invoicesBySaleId.get(selectedSaleForPayment.id) : undefined)
    : undefined;
  const selectedPaymentReminders = selectedPayment
    ? reminders.filter(reminder =>
      (reminder.paymentId === selectedPayment.id
        || Boolean(selectedSaleForPayment && reminder.saleId === selectedSaleForPayment.id)
        || Boolean(selectedInvoiceForPayment && reminder.invoiceId === selectedInvoiceForPayment.invoiceId))
      && (reminder.status === 'open' || reminder.status === 'snoozed')
    )
    : [];
  const selectedSubscriptionForPayment = selectedPayment?.subscriptionId
    ? subscriptionsById.get(selectedPayment.subscriptionId)
    : selectedSaleForPayment?.subscriptionId
      ? subscriptionsById.get(selectedSaleForPayment.subscriptionId)
      : undefined;
  const selectedSalePayments = selectedSaleForPayment
    ? paymentsBySaleId.get(selectedSaleForPayment.id) || []
    : [];
  const selectedHistory = selectedSaleForPayment
    ? getSalePayments(selectedSaleForPayment, selectedSalePayments).sort((left, right) => left.paymentDate.localeCompare(right.paymentDate))
    : selectedPayment ? [selectedPayment] : [];
  const selectedSalePaid = selectedSaleForPayment
    ? getSalePaidAmount(selectedSaleForPayment, selectedSalePayments)
    : selectedPayment?.amount || 0;
  const selectedSaleDue = selectedSaleForPayment
    ? getSaleDueAmount(selectedSaleForPayment, selectedSalePayments)
    : 0;
  const selectedRefundTotals = selectedPayment
    ? getPaymentRefundTotals(selectedPayment, payments)
    : { totalRefunded: 0, saleRefunded: 0, advanceRefunded: 0 };
  const selectedRefundableAmount = selectedPayment
    ? Math.max(0, selectedPayment.amount - selectedRefundTotals.totalRefunded)
    : 0;
  const parsedRefundAmountMinor = parseAmountToMinorUnits(refundAmountInput);
  const selectedRefundAdvanceRemaining = selectedPayment
    ? Math.max(0, (selectedPayment.advanceCreditAmount || 0) - selectedRefundTotals.advanceRefunded)
    : 0;
  const refundAdvancePreview = parsedRefundAmountMinor === null
    ? 0
    : minorUnitsToAmount(Math.min(parsedRefundAmountMinor, Math.round(selectedRefundAdvanceRemaining * 100)));
  const validCustomRange = selectedDate !== 'custom'
    || (isValidDate(customStart) && isValidDate(customEnd) && customStart <= customEnd);
  const activeFilterCount = [
    searchInput.trim().length > 0,
    selectedMethod !== 'all',
    selectedStatus !== 'all',
    selectedDate !== 'all',
    selectedService !== 'all',
    selectedCustomer !== 'all',
    selectedAmount !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="payments-view customer-list-page mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-6 xl:px-8">
      <header className="customer-page-header flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-nowrap sm:gap-4 sm:pb-4">
        <div className="customer-heading flex min-w-0 flex-1 items-start gap-3">
          <div className="customer-page-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 sm:h-11 sm:w-11">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="customer-page-eyebrow mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Finance</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[30px]">Payments</h1>
            <p className="mt-0.5 max-w-[28rem] text-sm leading-5 text-slate-600 dark:text-slate-400">Collections, balances &amp; payment history.</p>
          </div>
        </div>
        <div className="customer-header-actions payments-header-actions flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={exportPayments} disabled={!visiblePayments.length} aria-label="Export payments" title="Export payments" className="payments-header-action inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-[#151C28] dark:text-slate-200 dark:hover:bg-slate-800">
            <ArrowDownToLine className="h-4 w-4" /><span>Export</span>
          </button>
          <button type="button" onClick={() => { openAddPayment(); setNewPaymentMode('advance'); }} disabled={!activePaymentMethods.length || !customers.length} aria-label="Record advance" title="Record advance" className="payments-header-action inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-white px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-900 dark:bg-[#151C28] dark:text-violet-300 dark:hover:bg-violet-950/40">
            <Wallet className="h-4 w-4" /><span>Record Advance</span>
          </button>
          <button type="button" onClick={() => openAddPayment()} disabled={!activePaymentMethods.length || !customers.length} aria-label="Add payment" title="Add payment" className="customer-primary-action payments-header-action inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">
            <CreditCard className="h-4 w-4" /><span>Add Payment</span>
          </button>
        </div>
      </header>

      <div className="payment-tabs flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-[#151C28]">
        <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>Payment history <span>{payments.length}</span></TabButton>
        <TabButton active={activeTab === 'outstanding'} onClick={() => setActiveTab('outstanding')}>Outstanding <span>{outstandingSales.length}</span></TabButton>
        <TabButton active={activeTab === 'due-collection'} onClick={() => setActiveTab('due-collection')}>Due Collection <span>{dueCollectionSummary.customers.length}</span></TabButton>
      </div>

      {activeTab === 'due-collection' ? (
        <>
          <section aria-label="Due collection summary" className="payment-summary-grid grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric label={`Total Outstanding · ${currency}`} value={formatCurrency(dueCollectionSummary.totalOutstanding, currency)} tone="amber" icon={AlertCircle} />
            <Metric label={`Overdue Amount · ${currency}`} value={formatCurrency(dueCollectionSummary.overdueAmount, currency)} tone="rose" icon={CalendarDays} />
            <Metric label="Partially Paid Transactions" value={String(dueCollectionSummary.partiallyPaidTransactions)} tone="amber" icon={CreditCard} />
            <Metric label="Fully Paid Transactions" value={String(dueCollectionSummary.fullyPaidTransactions)} tone="emerald" icon={CheckCircle2} />
            <Metric label={`Payments Collected · ${currency}`} value={formatCurrency(dueCollectionSummary.paymentsCollected, currency)} tone="emerald" icon={HandCoins} />
          </section>
          <section className="dashboard-panel flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-[#151C28] sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Customer and reseller balances</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Balances use recorded sale allocations; overdue amounts require an invoice due date. Collected is net of refunds recorded in the selected period. Follow-up status and notes do not change balances.
              </p>
            </div>
            <label className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Collection period
              <select
                aria-label="Payments collected period"
                value={collectionPeriod}
                onChange={event => setCollectionPeriod(event.target.value as CollectionPeriod)}
                className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-40"
              >
                <option value="month">This month</option>
                <option value="last_month">Last month</option>
                <option value="all">All time</option>
              </select>
            </label>
          </section>
          <section aria-label="Due collection filters" className="dashboard-panel grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-[#151C28] sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative min-w-0">
              <span className="sr-only">Search due customers</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                aria-label="Search due customers"
                value={dueSearch}
                onChange={event => setDueSearch(event.target.value)}
                placeholder="Search name, phone, email..."
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Customer type
              <select
                aria-label="Filter due customers by type"
                value={dueCustomerType}
                onChange={event => setDueCustomerType(event.target.value as typeof dueCustomerType)}
                className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">All types</option>
                <option value="Customer">Customer</option>
                <option value="Reseller">Reseller</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Sort balances
              <select
                aria-label="Sort due customers"
                value={dueSortOrder}
                onChange={event => setDueSortOrder(event.target.value as typeof dueSortOrder)}
                className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="highest">Highest balance</option>
                <option value="overdue">Highest overdue</option>
                <option value="oldest">Earliest overdue</option>
              </select>
            </label>
            <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">
              {visibleDueCustomers.length} {visibleDueCustomers.length === 1 ? 'customer' : 'customers'} with an outstanding balance
            </div>
          </section>
          <section aria-label="Due collection customers" className="dashboard-panel overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="data-table-scroll hidden overflow-x-auto lg:block" role="region" aria-label="Due collection table" tabIndex={0}>
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Customer / Reseller</th>
                    <th className="px-3 py-3">Charged</th>
                    <th className="px-3 py-3">Recorded payments</th>
                    <th className="px-3 py-3">Outstanding</th>
                    <th className="px-3 py-3">Earliest overdue</th>
                    <th className="px-3 py-3">Last payment</th>
                    <th className="px-3 py-3">Follow-up status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pageDueCustomers.map(summary => {
                    const status = customerDueFollowUps[summary.customer.id]?.status || 'follow_up_required';
                    return (
                      <tr key={summary.customer.id}>
                        <td className="max-w-64 px-3 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white"><CustomerNameWithType customer={summary.customer} /></div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                            {summary.customer.phone ? <><Phone className="h-3 w-3" />{summary.customer.phone}</> : 'No contact number'}
                          </div>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                              {summary.transactions.length} outstanding {summary.transactions.length === 1 ? 'transaction' : 'transactions'}
                            </summary>
                            <ul className="mt-2 space-y-2">
                              {summary.transactions.map(transaction => (
                                <li key={transaction.sale.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70">
                                  <span className="min-w-0 flex-1">{saleItemLabel(transaction.sale)} · {transaction.invoice?.invoiceNumber || transaction.sale.invoiceNo}</span>
                                  <strong>{formatCurrency(transaction.due, transaction.sale.currency)}</strong>
                                  <button type="button" onClick={() => openAddPayment(summary.customer.id, transaction.sale.id)} className="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-600">Record Payment</button>
                                  <button type="button" onClick={() => onNavigateSection?.('sales', transaction.sale.id)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold dark:border-slate-700">Sale</button>
                                  {transaction.invoice && <button type="button" onClick={() => openInvoice(transaction.sale)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold dark:border-slate-700">Invoice</button>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono">{formatCurrency(summary.charged, currency)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono">{formatCurrency(summary.paid, currency)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-amber-700 dark:text-amber-300">{formatCurrency(summary.due, currency)}</td>
                        <td className="whitespace-nowrap px-3 py-3">{summary.earliestOverdueDate ? formatAppDate(summary.earliestOverdueDate, language) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3">{summary.lastPaymentDate ? formatAppDate(summary.lastPaymentDate, language) : '—'}</td>
                        <td className="min-w-48 px-3 py-3">
                          <select
                            aria-label={`Follow-up status for ${summary.customer.name}`}
                            value={status}
                            onChange={event => saveCustomerFollowUp(summary.customer.id, event.target.value as CustomerDueFollowUpStatus, followUpNotesDraft[summary.customer.id] || '')}
                            className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            {Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <div className="mt-1 flex gap-1">
                            <input aria-label={`Follow-up note for ${summary.customer.name}`} value={followUpNotesDraft[summary.customer.id] ?? customerDueFollowUps[summary.customer.id]?.note ?? ''} onChange={event => setFollowUpNotesDraft(previous => ({ ...previous, [summary.customer.id]: event.target.value }))} placeholder="Optional note" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-transparent px-2 py-1 text-[10px] dark:border-slate-700" />
                            <button type="button" onClick={() => saveCustomerFollowUp(summary.customer.id, status, followUpNotesDraft[summary.customer.id] ?? customerDueFollowUps[summary.customer.id]?.note ?? '')} className="rounded-md border border-slate-200 px-2 text-[10px] font-semibold dark:border-slate-700">Save</button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => onNavigateSection?.('customers', summary.customer.id)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Users className="h-3.5 w-3.5" />Profile</button>
                            {summary.customer.phone && canContact(summary.customer.id) && <button type="button" onClick={() => openMessage({ customerId: summary.customer.id, saleId: summary.transactions[0]?.sale.id, templateId: 'payment_reminder' })} aria-label={`Send payment reminder to ${summary.customer.name}`} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-emerald-200 px-2 font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />Contact</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
              {pageDueCustomers.map(summary => {
                const status = customerDueFollowUps[summary.customer.id]?.status || 'follow_up_required';
                return (
                  <article key={summary.customer.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><h3 className="break-words font-semibold text-slate-900 dark:text-white"><CustomerNameWithType customer={summary.customer} /></h3><p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">{summary.customer.phone ? <><Phone className="h-3 w-3" />{summary.customer.phone}</> : 'No contact number'}</p></div>
                      <strong className="shrink-0 font-mono text-amber-700 dark:text-amber-300">{formatCurrency(summary.due, currency)}</strong>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div><dt className="text-slate-500">Charged</dt><dd>{formatCurrency(summary.charged, currency)}</dd></div>
                      <div><dt className="text-slate-500">Payments</dt><dd>{formatCurrency(summary.paid, currency)}</dd></div>
                      <div><dt className="text-slate-500">Earliest overdue</dt><dd>{summary.earliestOverdueDate ? formatAppDate(summary.earliestOverdueDate, language) : 'Not overdue / no due date'}</dd></div>
                      <div><dt className="text-slate-500">Last payment</dt><dd>{summary.lastPaymentDate ? formatAppDate(summary.lastPaymentDate, language) : 'None'}</dd></div>
                    </dl>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Follow-up status
                      <select aria-label={`Follow-up status for ${summary.customer.name}`} value={status} onChange={event => saveCustomerFollowUp(summary.customer.id, event.target.value as CustomerDueFollowUpStatus, followUpNotesDraft[summary.customer.id] || '')} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        {Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <input aria-label={`Follow-up note for ${summary.customer.name}`} value={followUpNotesDraft[summary.customer.id] ?? customerDueFollowUps[summary.customer.id]?.note ?? ''} onChange={event => setFollowUpNotesDraft(previous => ({ ...previous, [summary.customer.id]: event.target.value }))} placeholder="Optional follow-up note" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 text-xs dark:border-slate-700" />
                      <button type="button" onClick={() => saveCustomerFollowUp(summary.customer.id, status, followUpNotesDraft[summary.customer.id] ?? customerDueFollowUps[summary.customer.id]?.note ?? '')} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">Save note</button>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-violet-700 dark:text-violet-300">{summary.transactions.length} outstanding transactions</summary>
                      <ul className="mt-2 space-y-2">
                        {summary.transactions.map(transaction => (
                          <li key={transaction.sale.id} className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
                            <p className="font-semibold">{saleItemLabel(transaction.sale)}</p>
                            <p className="break-all text-slate-500">{transaction.invoice?.invoiceNumber || transaction.sale.invoiceNo} · Due {formatCurrency(transaction.due, transaction.sale.currency)}</p>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => openAddPayment(summary.customer.id, transaction.sale.id)} className="min-h-9 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white">Record Payment</button>
                              <button type="button" onClick={() => onNavigateSection?.('sales', transaction.sale.id)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">View Sale</button>
                              {transaction.invoice && <button type="button" onClick={() => openInvoice(transaction.sale)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">View Invoice</button>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onNavigateSection?.('customers', summary.customer.id)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700"><Users className="h-3.5 w-3.5" />View Profile</button>
                      {summary.customer.phone && canContact(summary.customer.id) && <button type="button" onClick={() => openMessage({ customerId: summary.customer.id, saleId: summary.transactions[0]?.sale.id, templateId: 'payment_reminder' })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />Contact</button>}
                    </div>
                  </article>
                );
              })}
            </div>
            {pageDueCustomers.length === 0 && <EmptyState title={dueCollectionSummary.customers.length ? 'No matching customers' : 'No outstanding balances'} description={dueCollectionSummary.customers.length ? 'Try a different search or customer type.' : 'There are no eligible sale balances to collect.'} />}
          </section>
        </>
      ) : (
        <>
      <section aria-label="Payment summary" className="payment-summary-grid grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Received" value={<CurrencyAmounts amounts={currencyTotals} field="received" />} tone="emerald" icon={Wallet} />
        <Metric label="Outstanding Due" value={<CurrencyAmounts amounts={currencyTotals} field="due" />} tone="amber" icon={AlertCircle} />
        <Metric label="Partial" value={String(partialCount)} tone="amber" icon={CreditCard} />
        <Metric label="Pending" value={String(pendingCount)} tone="slate" icon={Clock3} />
        <Metric label="Refunds" value={<CurrencyAmounts amounts={currencyTotals} field="refunded" />} tone="rose" icon={ArrowDownToLine} />
        <Metric label="Failed" value={String(failedCount)} tone="rose" icon={AlertCircle} />
      </section>

      <section className="payment-followup dashboard-panel rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-[#151C28] sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold text-slate-800 dark:text-slate-100">Payment follow-up</p><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Jump to payments that need attention</p></div>
          <button
            type="button"
            onClick={() => {
              resetPaymentFilters();
              setActiveTab('payments');
            }}
            className="min-h-9 px-2 text-[11px] font-semibold text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
          >
            Clear
          </button>
        </div>
        <div className="payment-quick-actions flex flex-wrap gap-1.5">
          {[
            { label: 'Due now', active: activeTab === 'outstanding' && selectedDate === 'month' && selectedStatus === 'all', action: () => { resetPaymentFilters(); setActiveTab('outstanding'); setSelectedDate('month'); } },
            { label: 'Partial', active: activeTab === 'payments' && selectedStatus === 'partial' && selectedDate === 'month', action: () => { resetPaymentFilters(); setActiveTab('payments'); setSelectedStatus('partial'); setSelectedDate('month'); } },
            { label: 'Pending', active: activeTab === 'payments' && selectedStatus === 'pending' && selectedDate === 'month', action: () => { resetPaymentFilters(); setActiveTab('payments'); setSelectedStatus('pending'); setSelectedDate('month'); } },
            { label: 'Today', active: activeTab === 'payments' && selectedDate === 'today' && selectedStatus === 'all', action: () => { resetPaymentFilters(); setActiveTab('payments'); setSelectedDate('today'); } },
          ].map(action => (
            <button
              key={action.label}
              type="button"
              aria-pressed={action.active}
              onClick={action.action}
              className={`min-h-9 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${action.active ? 'border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-300'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Payment methods summary" className="payment-method-summary dashboard-panel space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-[#151C28] sm:p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Received by method</h2><p className="text-xs text-slate-500">Received and partial payments matching the current filters.</p></div>
          {selectedMethod !== 'all' && <span className="text-xs text-slate-500">Filtered to {selectedMethod}</span>}
        </div>
        {paymentMethodSummaries.length ? <div className="space-y-4">
          {paymentMethodSummaries.map(group => <div key={group.currency}>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.currency}</h3>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {group.methods.map(item => <div key={`${group.currency}-${item.methodId}`} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50 sm:p-3">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{item.methodName}</span><span className="text-[10px] capitalize text-slate-500">{item.category.replace('_', ' ')}</span></div>
                <p className="mt-1 font-mono text-base font-bold">{formatCurrency(item.received, group.currency)}</p>
                <p className="mt-1 text-[11px] text-slate-500">{item.transactionCount} payments · Avg {formatCurrency(item.average, group.currency)}</p>
                <p className="mt-1 text-[10px] text-slate-500">Today {formatCurrency(item.today, group.currency)} · Month {formatCurrency(item.thisMonth, group.currency)}</p>
              </div>)}
            </div>
          </div>)}
        </div> : <p className="payment-method-empty rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">No received payments match the current filters.</p>}
      </section>

      <section className="payment-filter-panel dashboard-panel space-y-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-[#151C28] sm:p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search payments and receivables</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search payments and receivables" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search payments, customers, invoices..." className="payment-search w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
          <div className="flex gap-2">
            {activeTab === 'payments' && <select aria-label="Filter by payment status" value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)} className="min-h-10 min-w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">All statuses</option>
              <option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
            </select>}
            <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <Filter className="h-4 w-4" /> Filters{activeFilterCount > 0 && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{activeFilterCount}</span>}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'payments' ? `${visiblePayments.length} payments` : `${visibleOutstanding.length} outstanding invoices`}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : ''}
          </span>
          {(activeFilterCount > 0 || sortOrder !== 'highest') && <button type="button" onClick={() => { resetPaymentFilters(); setSortOrder('highest'); }} className="min-h-8 px-1 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">Clear all</button>}
        </div>
        {showFilters && <div className="grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Method
            <select value={selectedMethod} onChange={event => setSelectedMethod(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">All methods</option>{methodOptions.map(method => <option key={method} value={method}>{method === 'Bank' ? 'Bank Transfer' : method}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date
            <select value={selectedDate} onChange={event => setSelectedDate(event.target.value as DateFilter)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">Any date</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="last_month">Last month</option><option value="custom">Custom range</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Service
            <select value={selectedService} onChange={event => setSelectedService(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">All services</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Customer
            <select value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">All customers</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{getCustomerOptionLabel(customer)}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount
            <select value={selectedAmount} onChange={event => setSelectedAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">Any amount</option><option value="under500">Under ৳500</option><option value="500to1000">৳500–৳1,000</option><option value="1000to5000">৳1,000–৳5,000</option><option value="over5000">Over ৳5,000</option>
            </select>
          </label>
          {activeTab === 'outstanding' && <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sort receivables
            <select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="highest">Highest due</option><option value="oldest">Oldest due</option><option value="newest">Newest due</option>
            </select>
          </label>}
          {selectedDate === 'custom' && <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">From<input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">To<input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
          </div>}
          <div className="flex items-end justify-end gap-3 text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
            {activeFilterCount > 0 && <button type="button" onClick={resetPaymentFilters} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">Clear filters</button>}
          </div>
          {!validCustomRange && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300 sm:col-span-2 lg:col-span-4">Enter a valid custom date range.</p>}
        </div>}
      </section>

      {activeTab === 'payments' ? (
        <section aria-label="Payments table" className="dashboard-panel overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="data-table-scroll hidden overflow-x-auto lg:block" role="region" aria-label="Payments table; scroll horizontally to view all columns" tabIndex={0}>
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Invoice / Sale</th><th className="px-3 py-3">Service</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Transaction</th><th className="px-3 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagePayments.map(payment => {
                  const sale = paymentSales.get(payment.id);
                  const customer = resolvePaymentCustomer(payment, customers, sales, subscriptions);
                  const invoice = payment.invoiceId ? invoices.find(item => item.invoiceId === payment.invoiceId) : undefined;
                  return <tr id={`payment-${payment.id}`} key={payment.id} className={focusedPaymentIdState === payment.id ? 'bg-violet-50 dark:bg-violet-950/30' : ''}>
                    <td className="px-3 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">{payment.id}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatAppDate(payment.paymentDate, language)}</td>
                    <td className="px-3 py-3"><div className="font-semibold text-slate-900 dark:text-white"><CustomerNameWithType customer={customer} /></div><div className="text-[10px] text-slate-500">WA: {customer?.whatsapp || customer?.phone || 'Not set'}</div></td>
                    <td className="px-3 py-3"><div>{invoice?.invoiceNumber || sale?.invoiceNo || '—'}</div><div className="font-mono text-[10px] text-slate-500">{sale?.id || payment.saleId || 'Unlinked legacy payment'}</div></td>
                    <td className="px-3 py-3">{sale ? saleItemLabel(sale) : '—'}</td>
                    <td className="px-3 py-3">{methodLabel(payment.paymentMethodName || payment.paymentMethod)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono font-bold">{formatCurrency(payment.amount, payment.currency)}</td>
                    <td className="px-3 py-3"><PaymentStatusBadge status={payment.paymentStatus} className={statusStyle(payment.paymentStatus)} icon={statusIcon(payment.paymentStatus)} /></td>
                    <td className="max-w-32 truncate px-3 py-3 font-mono text-slate-500" title={payment.transactionId || ''}>{payment.transactionId || '—'}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => openPaymentDetails(payment)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"><Eye className="h-3.5 w-3.5" /> View</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
            {pagePayments.map(payment => {
              const sale = paymentSales.get(payment.id);
              const customer = resolvePaymentCustomer(payment, customers, sales, subscriptions);
              return <article id={`payment-${payment.id}`} key={payment.id} className={`space-y-2 p-4 ${focusedPaymentIdState === payment.id ? 'bg-violet-50 dark:bg-violet-950/30' : ''}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-mono text-xs text-slate-500">{payment.id}</p><h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white"><CustomerNameWithType customer={customer} nameClassName="min-w-0 break-words" /></h3><p className="text-xs text-slate-500">WA: {customer?.whatsapp || customer?.phone || 'Not set'}</p><p className="break-words text-xs text-slate-500">{sale ? saleItemLabel(sale) : 'Payment'}</p></div><span className="shrink-0 font-mono font-bold">{formatCurrency(payment.amount, payment.currency)}</span></div>
                <div className="flex flex-wrap items-center justify-between gap-2"><PaymentStatusBadge status={payment.paymentStatus} className={statusStyle(payment.paymentStatus)} icon={statusIcon(payment.paymentStatus)} /><span className="text-xs text-slate-500">{methodLabel(payment.paymentMethodName || payment.paymentMethod)} · {formatAppDate(payment.paymentDate, language)}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[11px] text-slate-500">{payment.transactionId || 'No transaction ID'}</span><button type="button" onClick={() => openPaymentDetails(payment)} className="min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40">View details</button></div>
              </article>;
            })}
          </div>
          {pagePayments.length === 0 && <EmptyState title={payments.length ? selectedStatus === 'failed' ? 'No failed payments' : 'No payments found' : 'No payments yet'} description={payments.length ? 'Try changing your search or filters.' : 'Payments will appear here after transactions are recorded.'} />}
        </section>
      ) : (
        <section aria-label="Outstanding receivables" className="dashboard-panel overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="data-table-scroll hidden overflow-x-auto lg:block" role="region" aria-label="Outstanding receivables table; scroll horizontally to view all columns" tabIndex={0}>
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-violet-50/60 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-violet-950/20 dark:text-slate-400"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Invoice / Sale</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Last payment</th><th className="px-4 py-3">Days outstanding</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageOutstanding.map(({ sale, invoice, due, paid, lastPayment, dueReferenceDate }) => {
                  const customer = customersById.get(sale.customerId);
                  const itemLabel = saleItemLabel(sale);
                  const days = getAgingDays(dueReferenceDate, settings.businessProfile?.timeZone);
                  return <tr key={sale.id}>
                    <td className="px-4 py-3"><div className="font-semibold"><CustomerNameWithType customer={customer} /></div><div className="text-[10px] text-slate-500">WA: {customer?.whatsapp || customer?.phone || 'Not set'}</div></td>
                    <td className="px-4 py-3">{invoice?.invoiceNumber || sale.invoiceNo}<div className="font-mono text-[10px] text-slate-500">{sale.id}</div></td>
                    <td className="px-4 py-3">{itemLabel}</td>
                    <td className="px-4 py-3">{formatCurrency(sale.amount, sale.currency)}</td><td className="px-4 py-3">{formatCurrency(paid, sale.currency)}</td>
                    <td className="px-4 py-3 font-bold text-amber-700 dark:text-amber-300">{formatCurrency(due, sale.currency)}</td>
                    <td className="px-4 py-3">{lastPayment ? formatAppDate(lastPayment.paymentDate, language) : '—'}</td>
                    <td className="px-4 py-3"><span>{formatDurationDays(days)}</span><div className="text-[10px] text-slate-500">{getAgingBucket(days, formatNumber, language === 'bn' ? 'দিন' : 'days')}</div></td>
                    <td className="px-4 py-3"><div className="flex gap-1"><button type="button" onClick={() => openAddPayment(sale.customerId, sale.id)} className="rounded-lg bg-violet-600 px-2.5 py-1.5 font-semibold text-white hover:bg-violet-700">Add Payment</button>{customer && canContact(customer.id) && <button type="button" title="Compose payment reminder" aria-label={`Compose payment reminder for ${customer.name}`} onClick={() => openMessage({ customerId: customer.id, saleId: sale.id, templateId: 'payment_reminder' })} className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><MessageCircle className="h-4 w-4" /></button>}<button type="button" aria-label="View sale" onClick={() => onNavigateSection?.('sales', sale.id)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Eye className="h-4 w-4" /></button><button type="button" aria-label="View invoice" onClick={() => openInvoice(sale)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><FileText className="h-4 w-4" /></button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
            {pageOutstanding.map(({ sale, invoice, due, paid, lastPayment, dueReferenceDate }) => {
              const customer = customersById.get(sale.customerId);
              const days = getAgingDays(dueReferenceDate, settings.businessProfile?.timeZone);
              return <article key={sale.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold"><CustomerNameWithType customer={customer} /></h3><p className="text-xs text-slate-500">{saleItemLabel(sale)}</p><p className="mt-1 text-[11px] text-slate-500">{invoice?.invoiceNumber || sale.invoiceNo}</p></div><p className="font-mono font-bold text-amber-700 dark:text-amber-300">{formatCurrency(due, sale.currency)} due</p></div>
                <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-500">Total / Paid</dt><dd>{formatCurrency(sale.amount, sale.currency)} / {formatCurrency(paid, sale.currency)}</dd></div><div><dt className="text-slate-500">Outstanding</dt><dd>{formatDurationDays(days)} · {getAgingBucket(days, formatNumber, language === 'bn' ? 'দিন' : 'days')}</dd></div><div><dt className="text-slate-500">Last payment</dt><dd>{lastPayment ? formatAppDate(lastPayment.paymentDate, language) : 'None'}</dd></div></dl>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openAddPayment(sale.customerId, sale.id)} className="min-h-9 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700">Add Payment</button>{customer && canContact(customer.id) && <button type="button" onClick={() => openMessage({ customerId: customer.id, saleId: sale.id, templateId: 'payment_reminder' })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp Reminder</button>}<button type="button" onClick={() => onNavigateSection?.('sales', sale.id)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">View Sale</button><button type="button" onClick={() => openInvoice(sale)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">View Invoice</button><button type="button" onClick={() => onNavigateSection?.('customers', sale.customerId)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">Customer</button></div>
              </article>;
            })}
          </div>
          {pageOutstanding.length === 0 && <EmptyState title={outstandingSales.length ? 'No matching receivables' : 'All balances are paid'} description={outstandingSales.length ? 'Try changing your search or filters.' : 'There are no outstanding sale balances to collect.'} />}
        </section>
      )}
        </>
      )}

      {(activeTab === 'payments' ? visiblePayments.length : activeTab === 'outstanding' ? visibleOutstanding.length : visibleDueCustomers.length) > 0 && <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="min-h-9 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button></div>
      </nav>}

      <Modal isOpen={isAddPaymentOpen} onClose={() => { if (!isSaving) setIsAddPaymentOpen(false); }} title={newPaymentMode === 'advance' ? 'Record Customer Advance' : newPaymentMode === 'apply-advance' ? 'Apply Existing Advance to Due' : 'Record Payment'} subtitle={newPaymentMode === 'advance' ? 'Record money received for a customer with no sale allocation.' : newPaymentMode === 'apply-advance' ? 'Use existing customer credit to reduce an outstanding sale. No new cash is recorded.' : 'Allocate a payment to an outstanding sale; any excess becomes customer advance credit.'} maxWidth="lg">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:grid-cols-3" aria-label="Payment action">
            <button type="button" aria-pressed={newPaymentMode === 'sale'} onClick={() => { setNewPaymentMode('sale'); setNewSaleId(''); setNewAmount(''); setPossibleDuplicateConfirmed(false); }} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${newPaymentMode === 'sale' ? 'bg-white text-violet-700 shadow-xs dark:bg-slate-700 dark:text-violet-200' : 'text-slate-600 dark:text-slate-300'}`}>Receive New Payment</button>
            <button type="button" aria-pressed={newPaymentMode === 'advance'} onClick={() => { setNewPaymentMode('advance'); setNewSaleId(''); setNewAmount(''); setPossibleDuplicateConfirmed(false); }} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${newPaymentMode === 'advance' ? 'bg-white text-violet-700 shadow-xs dark:bg-slate-700 dark:text-violet-200' : 'text-slate-600 dark:text-slate-300'}`}>Record Advance</button>
            <button type="button" aria-pressed={newPaymentMode === 'apply-advance'} onClick={() => { setNewPaymentMode('apply-advance'); setNewSaleId(''); setNewAmount(''); setSaleSearch(''); setNewCustomerFilter(newSale?.customerId || preselectedCustomerId || 'all'); setNewAdvanceCurrency(newSale?.currency || currency); setPossibleDuplicateConfirmed(false); }} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${newPaymentMode === 'apply-advance' ? 'bg-white text-violet-700 shadow-xs dark:bg-slate-700 dark:text-violet-200' : 'text-slate-600 dark:text-slate-300'}`}>Apply Existing Advance</button>
          </div>
          {newPaymentMode === 'apply-advance' && <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Customer *
              <select required value={newCustomerFilter === 'all' ? '' : newCustomerFilter} onChange={event => { setNewCustomerFilter(event.target.value || 'all'); setNewSaleId(''); setNewAmount(''); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Choose a customer</option>{customers.filter(customer => !customer.isArchived).map(customer => <option key={customer.id} value={customer.id}>{getCustomerOptionLabel(customer)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Currency *
              <select value={newAdvanceCurrency} onChange={event => { setNewAdvanceCurrency(event.target.value as AppCurrency); setNewSaleId(''); setNewAmount(''); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="BDT">BDT — ৳</option><option value="USD">USD — $</option></select>
            </label>
            {newCustomerFilter !== 'all' && <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900 dark:bg-violet-950/30 dark:text-violet-200 sm:col-span-2">
              Available advance credit: <strong className="font-mono">{formatCurrency(availableAdvance, newAdvanceCurrency)}</strong>
            </p>}
          </div>}
          {newPaymentMode === 'advance' && <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Customer *
              <select required value={newCustomerFilter === 'all' ? '' : newCustomerFilter} onChange={event => setNewCustomerFilter(event.target.value || 'all')} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Choose a customer</option>{customers.filter(customer => !customer.isArchived).map(customer => <option key={customer.id} value={customer.id}>{getCustomerOptionLabel(customer)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Currency *
              <select value={newAdvanceCurrency} onChange={event => setNewAdvanceCurrency(event.target.value as AppCurrency)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="BDT">BDT — ৳</option><option value="USD">USD — $</option></select>
            </label>
            {newCustomerFilter !== 'all' && <p className="text-xs text-slate-500 sm:col-span-2">Current advance: {formatCurrency(getCustomerAdvanceCredit(payments, newCustomerFilter, newAdvanceCurrency))} · Recording this receipt adds new customer credit, not revenue.</p>}
          </div>}
          {newPaymentMode === 'sale' && <>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Find sale or invoice
              <span className="relative mt-1.5 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={saleSearch} onChange={event => setSaleSearch(event.target.value)} placeholder="Invoice, customer, phone, service or sale ID" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></span>
            </label>
          </>}
          {newPaymentMode !== 'advance' && <>
            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{newPaymentMode === 'apply-advance' ? 'Outstanding sale for this customer *' : 'Outstanding sale *'}</legend>
              <div className="mt-1.5 max-h-64 space-y-2 overflow-y-auto overscroll-contain rounded-xl pr-1">
                {eligibleSales.map(sale => {
                  const customer = customersById.get(sale.customerId);
                  const due = getSaleDueAmount(sale, paymentsBySaleId.get(sale.id) || []);
                  const selected = newSaleId === sale.id;
                  return (
                    <label
                      key={sale.id}
                      className={`grid min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-500 ${
                        selected
                          ? 'border-violet-500 bg-violet-50/70 dark:border-violet-500 dark:bg-violet-950/30'
                          : 'border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-violet-700'
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="outstanding-sale"
                        required
                        value={sale.id}
                        checked={selected}
                        onChange={() => {
                          setNewSaleId(sale.id);
                          setNewAmount('');
                          setNewTransactionId('');
                          setPossibleDuplicateConfirmed(false);
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold leading-5 text-slate-900 dark:text-white">
                          {getCustomerDisplayName(customer)}
                        </span>
                        <span className="mt-0.5 block break-words text-xs leading-4 text-slate-500 dark:text-slate-400">
                          {customer?.whatsapp || customer?.phone || 'No phone number'}
                        </span>
                        <span className="mt-1 block break-words text-xs font-medium leading-4 text-violet-700 dark:text-violet-300">
                          {saleItemLabel(sale)}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col items-end gap-2">
                        <span className="max-w-full text-right leading-4 [overflow-wrap:anywhere]">
                          <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">Due</span>
                          <span className="block text-xs font-bold tabular-nums text-amber-800 dark:text-amber-300">
                            {formatCurrency(due, sale.currency)}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? 'border-violet-600 bg-violet-600 dark:border-violet-400 dark:bg-violet-400'
                              : 'border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900'
                          }`}
                        >
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-900" />}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {!eligibleSales.length && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{newPaymentMode === 'apply-advance' ? newCustomerFilter === 'all' ? 'Choose a customer to find their outstanding sales.' : 'This customer has no outstanding sales in the selected currency.' : 'No sales with an outstanding balance were found. Choose Record Advance to record an unallocated receipt.'}</p>}
          </>}
          {newSale && <section aria-label="Selected sale balance" className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/20 sm:grid-cols-2">
            <div><p className="text-xs text-slate-500">Customer</p><p className="font-semibold"><CustomerNameWithType customer={newSaleCustomer} /></p><p className="text-xs text-slate-500">{newSaleCustomer?.phone || newSaleCustomer?.email || ''}</p></div>
            <div><p className="text-xs text-slate-500">Sale</p><p className="font-semibold">{newSaleService?.name || 'Service'} · {newSale.plan}</p><p className="text-xs text-slate-500">{newSaleInvoice?.invoiceNumber || newSale.invoiceNo}</p></div>
            <div><p className="text-xs text-slate-500">Total · Previously paid</p><p className="font-semibold">{formatCurrency(newSale.amount, newSale.currency)} · {formatCurrency(getSalePaidAmount(newSale, newSalePayments), newSale.currency)}</p></div>
            <div><p className="text-xs text-slate-500">Remaining balance</p><p className="font-mono font-bold text-amber-800 dark:text-amber-300">{formatCurrency(newSaleDue, newSale.currency)}</p></div>
          </section>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{newPaymentMode === 'apply-advance' ? 'Amount to apply *' : 'Amount received *'}
              <input required type="number" min="0.01" max={newPaymentMode === 'apply-advance' ? Math.min(availableAdvance, newSaleDue) : undefined} step="0.01" inputMode="decimal" value={newAmount} onChange={event => { setNewAmount(event.target.value); setPossibleDuplicateConfirmed(false); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>
            {newPaymentMode !== 'apply-advance' && <>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Payment date *
                <input required type="date" max={getTodayDateString(settings.businessProfile?.timeZone)} value={newPaymentDate} onChange={event => { setNewPaymentDate(event.target.value); setPossibleDuplicateConfirmed(false); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Payment method *
                <select required value={newMethod} onChange={event => { setNewMethod(event.target.value as PaymentMethod); setPossibleDuplicateConfirmed(false); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {activePaymentMethods.map(method => <option key={method} value={method}>{methodLabel(method)}</option>)}
                </select>
              </label>
            </>}
            {newPaymentMode === 'sale' && <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Payment status *
              <select required value={newStatus} onChange={event => setNewStatus(event.target.value as Extract<PaymentStatus, 'paid' | 'pending' | 'failed'>)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="paid">Received</option><option value="pending">Pending</option><option value="failed">Failed</option>
              </select>
            </label>}
            {newPaymentMode !== 'apply-advance' && <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Transaction ID {paymentMethodRequiresTransactionId(newMethod, paymentMethods, settings.paymentPreferences?.requireTransactionId) ? '*' : '(optional)'}
              <input required={paymentMethodRequiresTransactionId(newMethod, paymentMethods, settings.paymentPreferences?.requireTransactionId)} value={newTransactionId} onChange={event => { setNewTransactionId(event.target.value); setPossibleDuplicateConfirmed(false); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>}
          </div>
          {newPaymentMode === 'sale' && newStatus === 'paid' && newSale && parsedNewAmountMinor !== null && parsedNewAmountMinor > 0 && <section aria-label="Payment allocation preview" className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm dark:border-violet-900 dark:bg-violet-950/20">
            <p className="font-semibold text-slate-900 dark:text-white">Allocation preview</p>
            <div className="mt-2 flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-300">Applied to outstanding sale</span><span className="font-mono font-semibold">{formatCurrency(newPaymentAllocation.allocatedAmount, newSale.currency)}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-300">Added to customer advance</span><span className="font-mono font-semibold">{formatCurrency(newPaymentAllocation.advanceCreditAmount, newSale.currency)}</span></div>
          </section>}
          {newPaymentMode === 'apply-advance' && newSale && parsedNewAmountMinor !== null && parsedNewAmountMinor > 0 && <section aria-label="Advance application preview" className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
            <p className="font-semibold text-slate-900 dark:text-white">Advance application preview</p>
            <div className="mt-2 flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-300">Applied to outstanding sale</span><span className="font-mono font-semibold">{formatCurrency(minorUnitsToAmount(Math.min(parsedNewAmountMinor, amountToMinorUnits(newSaleDue))), newSale.currency)}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-300">Advance remaining</span><span className="font-mono font-semibold">{formatCurrency(minorUnitsToAmount(Math.max(0, amountToMinorUnits(availableAdvance) - parsedNewAmountMinor)), newSale.currency)}</span></div>
            {(parsedNewAmountMinor > amountToMinorUnits(newSaleDue) || parsedNewAmountMinor > amountToMinorUnits(availableAdvance)) && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">Amount exceeds the sale due or available advance credit.</p>}
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">This moves existing advance credit to the sale; it does not record a new cash receipt.</p>
          </section>}
          {newPaymentMode !== 'apply-advance' && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Note <span className="font-normal text-slate-500">(optional)</span>
            <input value={newNotes} onChange={event => setNewNotes(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>}
          {duplicateTransaction && <DuplicateWarning payment={duplicateTransaction} onReview={() => { setIsAddPaymentOpen(false); openPaymentDetails(duplicateTransaction); }} />}
          {!duplicateTransaction && possibleDuplicate && <DuplicateWarning payment={possibleDuplicate} onReview={() => { setIsAddPaymentOpen(false); openPaymentDetails(possibleDuplicate); }} />}
          {possibleDuplicate && <label className="flex min-h-11 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <input type="checkbox" checked={possibleDuplicateConfirmed} onChange={event => setPossibleDuplicateConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600" />
            <span>I reviewed the similar received payment and confirm this is a separate receipt for the remaining balance.</span>
          </label>}
          {newPaymentMode !== 'apply-advance' && <p className="text-xs text-slate-500">Only active payment methods from Settings are selectable. Sale allocations are limited to the outstanding amount; any excess is saved as customer advance credit and is not auto-applied to another sale.</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button type="button" disabled={isSaving} onClick={() => setIsAddPaymentOpen(false)} className="min-h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={isSaving || (newPaymentMode !== 'advance' && !newSale) || (newPaymentMode !== 'sale' && newCustomerFilter === 'all') || parsedNewAmountMinor === null || (newPaymentMode !== 'apply-advance' && !activePaymentMethods.length) || Boolean(duplicateTransaction || (possibleDuplicate && !possibleDuplicateConfirmed)) || (newPaymentMode === 'apply-advance' && (parsedNewAmountMinor <= 0 || parsedNewAmountMinor > amountToMinorUnits(availableAdvance) || parsedNewAmountMinor > amountToMinorUnits(newSaleDue)))} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? <><Clock3 className="h-4 w-4 animate-spin" /> Saving…</> : newPaymentMode === 'advance' ? 'Record Advance' : newPaymentMode === 'apply-advance' ? 'Apply Advance to Sale' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(selectedPayment)} onClose={() => { setSelectedPayment(null); setRefundFormOpen(false); }} title={selectedPayment?.id || 'Payment Details'} subtitle={selectedPayment ? `${formatAppDate(selectedPayment.paymentDate, language)} · ${selectedPayment.paymentStatus}` : undefined} maxWidth="xl">
        {selectedPayment && <div className="space-y-5">
          <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-3">
            <Detail label="Amount" value={formatCurrency(selectedPayment.amount, selectedPayment.currency)} strong />
            <Detail label="Method" value={methodLabel(selectedPayment.paymentMethodName || selectedPayment.paymentMethod)} />
            <Detail label="Method category" value={selectedPayment.paymentMethodCategory?.replace('_', ' ') || 'Not categorized'} />
            {selectedPayment.paymentAccount && <Detail label="Account label" value={selectedPayment.paymentAccount} />}
            <div><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1"><PaymentStatusBadge status={selectedPayment.paymentStatus} className={statusStyle(selectedPayment.paymentStatus)} icon={statusIcon(selectedPayment.paymentStatus)} /></dd></div>
            <Detail label="Transaction ID" value={selectedPayment.transactionId || 'Not provided'} />
            <Detail label="Payment date" value={formatAppDate(selectedPayment.paymentDate, language)} />
            <Detail label="Created" value={selectedPayment.createdAt ? formatAppDateTime(selectedPayment.createdAt, language) : '—'} />
          </section>
          <section aria-label="Payment refunds" className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Refunds</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Refunded {formatCurrency(selectedRefundTotals.totalRefunded, selectedPayment.currency)} · Remaining refundable {formatCurrency(selectedRefundableAmount, selectedPayment.currency)}
                </p>
              </div>
              {selectedPayment.paymentStatus !== 'failed' && selectedPayment.paymentStatus !== 'refunded' && selectedRefundableAmount > 0 && !refundFormOpen && (
                <button type="button" onClick={() => {
                  refundOperationId.current = createRecordId('payment-refund-operation');
                  setRefundAmountInput('');
                  setRefundDateInput(getTodayDateString(settings.businessProfile?.timeZone));
                  setRefundFormOpen(true);
                }} className="min-h-10 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                  Record Refund
                </button>
              )}
            </div>
            {payments.filter(payment => payment.refundOfPaymentId === selectedPayment.id).map(refund => (
              <div key={refund.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs dark:bg-rose-950/30">
                <span>{formatAppDate(refund.paymentDate, language)} · {refund.notes || 'Refund recorded'}</span>
                <strong className="font-mono text-rose-800 dark:text-rose-200">{formatCurrency(refund.amount, refund.currency)}</strong>
              </div>
            ))}
            {refundFormOpen && selectedRefundableAmount > 0 && <form onSubmit={handleRecordRefund} className="grid gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900 dark:bg-rose-950/20 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Refund amount *
                <input required type="number" min="0.01" max={selectedRefundableAmount} step="0.01" inputMode="decimal" value={refundAmountInput} onChange={event => setRefundAmountInput(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Refund date *
                <input required type="date" max={getTodayDateString(settings.businessProfile?.timeZone)} value={refundDateInput} onChange={event => setRefundDateInput(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">Note <span className="font-normal text-slate-500">(optional)</span>
                <input value={refundNote} onChange={event => setRefundNote(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
              {parsedRefundAmountMinor !== null && parsedRefundAmountMinor > 0 && <p className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">
                This refund returns {formatCurrency(refundAdvancePreview, selectedPayment.currency)} from customer advance first, then reverses any remaining sale allocation. The refunded amount is not revenue.
              </p>}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" disabled={isRefundSaving} onClick={() => setRefundFormOpen(false)} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={isRefundSaving || parsedRefundAmountMinor === null || parsedRefundAmountMinor <= 0 || minorUnitsToAmount(parsedRefundAmountMinor) > selectedRefundableAmount} className="min-h-10 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{isRefundSaving ? 'Recording…' : 'Confirm Refund'}</button>
              </div>
            </form>}
          </section>
          <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold">Customer</h3>
            <p className="text-sm font-semibold"><CustomerNameWithType customer={selectedCustomerForPayment} /></p>
            <p className="text-xs text-slate-500">{selectedCustomerForPayment?.phone || 'No phone'} · {selectedCustomerForPayment?.email || 'No email'}</p>
            {selectedCustomerForPayment && <button type="button" onClick={() => { setSelectedPayment(null); onNavigateSection?.('customers', selectedCustomerForPayment.id); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Customer</button>}
            {selectedCustomerForPayment && selectedPayment.paymentStatus !== 'failed' && selectedPayment.paymentStatus !== 'refunded' && canContact(selectedCustomerForPayment.id) && <button type="button" onClick={() => openMessage({ customerId: selectedCustomerForPayment.id, paymentId: selectedPayment.id, saleId: selectedSaleForPayment?.id, templateId: 'payment_received' })} className="ml-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp Confirmation</button>}
            {selectedSaleForPayment && selectedSaleDue > 0 && selectedCustomerForPayment && canContact(selectedCustomerForPayment.id) && <button type="button" onClick={() => openMessage({ customerId: selectedCustomerForPayment.id, saleId: selectedSaleForPayment.id, templateId: 'payment_reminder' })} className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"><MessageCircle className="h-3.5 w-3.5" />Payment Reminder</button>}
          </section>
          <section aria-label="Payment reminders" className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Related Reminders ({selectedPaymentReminders.length})</h3>
              {onNavigateSection && <button type="button" onClick={() => { setSelectedPayment(null); onNavigateSection('reminders'); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Open Smart Reminders</button>}
            </div>
            {selectedPaymentReminders.length
              ? <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">{selectedPaymentReminders.slice(0, 3).map(reminder => <li key={reminder.id}>{reminder.title} · Due {formatAppDate(reminder.dueDate, language)}</li>)}</ul>
              : <p className="text-xs text-slate-500">No open reminders are linked to this payment.</p>}
          </section>
          {selectedSaleForPayment && <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold">Sale</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Detail label="Sale ID" value={selectedSaleForPayment.id} />
              <Detail label="Invoice" value={selectedInvoiceForPayment?.invoiceNumber || selectedSaleForPayment.invoiceNo} />
              <Detail label="Service / Plan" value={`${servicesById.get(selectedSaleForPayment.serviceId)?.name || 'Service'} · ${selectedSaleForPayment.plan}`} />
              <Detail label="Sale date" value={formatAppDate(selectedSaleForPayment.date, language)} />
              <Detail label="Total / Paid / Due" value={`${formatCurrency(selectedSaleForPayment.amount, selectedSaleForPayment.currency)} · ${formatCurrency(selectedSalePaid, selectedSaleForPayment.currency)} · ${formatCurrency(selectedSaleDue, selectedSaleForPayment.currency)}`} />
            </dl>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setSelectedPayment(null); onNavigateSection?.('sales', selectedSaleForPayment.id); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Sale</button>{selectedInvoiceForPayment && <button type="button" onClick={() => { setSelectedPayment(null); openInvoice(selectedSaleForPayment); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Invoice</button>}</div>
          </section>}
          {selectedSubscriptionForPayment && <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold">Subscription</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2"><Detail label="Service / Plan" value={`${servicesById.get(selectedSubscriptionForPayment.serviceId)?.name || 'Service'} · ${selectedSubscriptionForPayment.plan}`} /><Detail label="Subscription ID" value={selectedSubscriptionForPayment.id} /><Detail label="Start date" value={formatAppDate(selectedSubscriptionForPayment.startDate, language)} /><Detail label="Expiry date" value={formatAppDate(selectedSubscriptionForPayment.expiryDate, language)} /></dl>
            <button type="button" onClick={() => { setSelectedPayment(null); onNavigateSection?.('subscriptions', selectedSubscriptionForPayment.id); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View Subscription</button>
          </section>}
          {selectedSaleForPayment && <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Payment History</h3><span className="text-xs text-slate-500">{selectedHistory.length} records</span></div>
            <ol className="space-y-2">{selectedHistory.map(payment => {
              const saleAllocations = payment.allocations?.filter(allocation => allocation.saleId === selectedSaleForPayment.id) || [];
              const advanceMinor = saleAllocations
                .filter(allocation => allocation.fundingSource === 'advance_credit')
                .reduce((total, allocation) => total + amountToMinorUnits(allocation.amount), 0);
              const allocatedMinor = saleAllocations.reduce(
                (total, allocation) => total + amountToMinorUnits(allocation.amount),
                0
              );
              const cashMinor = Math.max(0, allocatedMinor - advanceMinor);
              return <li key={`${payment.id}:${saleAllocations.map(allocation => allocation.id || allocation.advanceApplicationId || allocation.saleId).join('|')}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                <span>{formatAppDate(payment.paymentDate, language)} · {advanceMinor > 0 && cashMinor === 0 ? 'Customer advance applied' : methodLabel(payment.paymentMethodName || payment.paymentMethod)}{payment.transactionId && cashMinor > 0 ? ` · ${payment.transactionId}` : ''}</span>
                <span className="text-right font-semibold">
                  {cashMinor > 0 && <span className="block">{formatCurrency(minorUnitsToAmount(cashMinor), payment.currency)} received</span>}
                  {advanceMinor > 0 && <span className="block">{formatCurrency(minorUnitsToAmount(advanceMinor), payment.currency)} from advance</span>}
                  {allocatedMinor === 0 && <span>{formatCurrency(payment.amount, payment.currency)} · {payment.paymentStatus}</span>}
                </span>
              </li>;
            })}</ol>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold dark:border-slate-700"><span>Total applied to sale</span><span>{formatCurrency(selectedSalePaid, selectedSaleForPayment.currency)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Remaining</span><span className="font-semibold">{formatCurrency(selectedSaleDue, selectedSaleForPayment.currency)}</span></div>
          </section>}
          {selectedInvoiceForPayment && selectedSaleForPayment && <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold">Invoice Information</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2"><Detail label="Invoice number" value={selectedInvoiceForPayment.invoiceNumber} /><Detail label="Invoice date" value={formatAppDate(selectedInvoiceForPayment.invoiceDate, language)} /><Detail label="Total · Paid · Due" value={`${formatCurrency(selectedSaleForPayment.amount, selectedSaleForPayment.currency)} · ${formatCurrency(selectedSalePaid, selectedSaleForPayment.currency)} · ${formatCurrency(selectedSaleDue, selectedSaleForPayment.currency)}`} /><Detail label="Status" value={getSalePaymentStatus(selectedSaleForPayment, selectedSalePayments)} /></dl>
            <button type="button" onClick={() => { setSelectedPayment(null); openInvoice(selectedSaleForPayment); }} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">View / Print / Download Invoice</button>
          </section>}
          <section aria-label="Payment activity" className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold">Activity</h3>
            {activityLogs.filter(log => log.paymentId === selectedPayment.id || log.entityId === selectedPayment.id).sort((left, right) => right.timestamp.localeCompare(left.timestamp)).map(log => <div key={log.id} className="border-l-2 border-emerald-300 pl-3"><p className="text-xs font-semibold">{log.title}</p><p className="mt-0.5 text-xs text-slate-500">{log.description}</p><time className="mt-1 block text-[10px] text-slate-400">{formatAppDateTime(log.timestamp, language)}</time></div>)}
            {!activityLogs.some(log => log.paymentId === selectedPayment.id || log.entityId === selectedPayment.id) && <p className="text-xs text-slate-500">No activity recorded for this payment.</p>}
          </section>
        </div>}
      </Modal>

      {selectedInvoiceData && <InvoicePreviewModal isOpen onClose={() => setSelectedInvoiceData(null)} saleData={selectedInvoiceData} />}
    </div>
  );
};

function Metric({ label, value, tone = 'slate', icon: Icon }: {
  label: string;
  value: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  };
  return <article className="payment-metric min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-[#151C28] sm:p-3.5"><div className="flex min-w-0 items-center gap-2"><span className={`payment-metric-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></span><p className="min-w-0 text-[11px] font-semibold leading-tight text-slate-600 dark:text-slate-300">{label}</p></div><div className="payment-metric-value mt-2 min-w-0 break-words font-mono text-lg font-bold tabular-nums text-slate-950 dark:text-white sm:text-xl">{value}</div></article>;
}

function CurrencyAmounts({ amounts, field }: {
  amounts: Record<AppCurrency, { received: number; due: number; refunded: number }>;
  field: 'received' | 'due' | 'refunded';
}) {
  return <span className="block space-y-0.5">
    {(['BDT', 'USD'] as const).map(currency => (
      <span key={currency} className="flex items-center justify-between gap-1 text-xs">
        <span className="text-[10px] font-semibold text-slate-400">{currency}</span>
        <span className="truncate">{formatCurrency(amounts[currency][field], currency)}</span>
      </span>
    ))}
  </span>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors sm:text-sm ${active ? 'bg-violet-600 text-white shadow-xs dark:bg-violet-500' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-violet-300'}`}>{children}</button>;
}

function PaymentStatusBadge({ status, className, icon }: { status: PaymentStatus; className: string; icon: React.ReactNode }) {
  const label = status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : 'Refunded';
  return <span aria-label={`Payment status: ${label}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${className}`}>{icon}{label}</span>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="payment-empty-state px-4 py-8 text-center sm:py-10"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Wallet className="h-5 w-5" /></div><h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></div>;
}

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-words text-sm ${strong ? 'font-mono font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{value}</dd></div>;
}

function DuplicateWarning({ payment, onReview }: { payment: Payment; onReview: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><span>Possible duplicate payment: {payment.id} · {payment.transactionId || formatCurrency(payment.amount, payment.currency)}.</span><button type="button" onClick={onReview} className="inline-flex items-center gap-1 font-bold underline"><Eye className="h-3.5 w-3.5" /> Review payment</button></div>;
}
