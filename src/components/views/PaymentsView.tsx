import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Filter,
  MessageCircle,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { Modal } from '../common/Modal';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import { formatAppDate, formatAppDateTime, formatCurrency, getDaysDifference, getTodayDateString } from '../../utils/dateUtils';
import { getCustomerDisplayName, resolvePaymentCustomer } from '../../utils/relationships';
import { getSaleDueAmount, getSalePaidAmount, getSalePaymentStatus, getSalePayments } from '../../utils/saleUtils';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { convertReportCurrency } from '../../utils/reportMetrics';
import { getDefaultPaymentMethod, getPaymentMethodSummary, normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../../utils/paymentMethods';
import { normalizePhoneDigits, normalizeSearchText } from '../../services/globalSearch';
import { createRecordId } from '../../services/localStorageStore';
import { downloadCSV } from '../../utils/csvParser';
import { exportPaymentsCSV } from '../../services/dataBackupService';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import type { Payment, PaymentMethod, PaymentStatus, Sale } from '../../types';

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
type PaymentViewTab = 'payments' | 'outstanding';
type SortOrder = 'highest' | 'oldest' | 'newest';

const pageSize = 20;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getDateRange(filter: DateFilter, start: string, end: string): [string, string] | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

function getAgingDays(referenceDate: string): number {
  return Math.max(0, -getDaysDifference(referenceDate));
}

function getAgingBucket(days: number): string {
  if (days <= 7) return '0–7 days';
  if (days <= 30) return '8–30 days';
  if (days <= 60) return '31–60 days';
  return '60+ days';
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
  const {
    payments,
    reminders,
    customers,
    sales,
    invoices,
    subscriptions,
    services,
    settings,
    activityLogs,
    ensureInvoiceForSale,
    recordSalePayment,
    logActivity,
    currency: globalCurrency,
    language,
    t,
  } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();

  const [activeTab, setActiveTab] = useState<PaymentViewTab>('payments');
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
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<ReturnType<typeof buildInvoiceSaleDetails> | null>(null);

  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [saleSearch, setSaleSearch] = useState('');
  const [newSaleId, setNewSaleId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('Cash');
  const [newStatus, setNewStatus] = useState<Extract<PaymentStatus, 'paid' | 'pending' | 'failed'>>('paid');
  const [newTransactionId, setNewTransactionId] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(getTodayDateString());
  const [newNotes, setNewNotes] = useState('');
  const [newCustomerFilter, setNewCustomerFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [duplicatePayment, setDuplicatePayment] = useState<Payment | null>(null);
  const operationId = useRef('');
  const isSavingRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedMethod, selectedStatus, selectedDate, customStart, customEnd, selectedService, selectedCustomer, selectedAmount, activeTab, sortOrder]);

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
    setNewSaleId(preselectedSaleId || '');
    setSaleSearch('');
    setNewAmount('');
    setNewStatus('paid');
    setNewMethod((getDefaultPaymentMethod(normalizePaymentMethods(settings.paymentPreferences?.methods), settings.paymentPreferences?.defaultMethodId) || 'Cash') as PaymentMethod);
    setNewTransactionId('');
    setNewPaymentDate(getTodayDateString());
    setNewNotes('');
    setNewCustomerFilter(preselectedCustomerId || 'all');
    operationId.current = createRecordId('sale-payment-operation');
    setIsAddPaymentOpen(true);
    onCreateRequestHandled?.();
  }, [createRequest, onCreateRequestHandled, preselectedCustomerId, preselectedSaleId, settings.paymentPreferences?.methods]);

  const customersById = useMemo(() => new Map(customers.map(customer => [customer.id, customer])), [customers]);
  const servicesById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);
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
      const sale = paymentSales.get(payment.id);
      if (!sale) return;
      const linked = index.get(sale.id) || [];
      linked.push(payment);
      index.set(sale.id, linked);
    });
    return index;
  }, [payments, paymentSales]);

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
    () => getDateRange(selectedDate, customStart, customEnd),
    [selectedDate, customStart, customEnd]
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
      const fields = [
        payment.id,
        payment.transactionId || '',
        customer?.name || '',
        customer?.phone || '',
        customer?.email || '',
        invoice?.invoiceNumber || sale?.invoiceNo || '',
        sale?.id || payment.saleId || '',
        service?.name || '',
        sale?.plan || '',
        payment.paymentMethodName || payment.paymentMethod,
      ];
      const queryMatch = !query || fields.some(field => normalizeSearchText(field).includes(query))
        || (queryDigits.length >= 3 && customer?.phone
          ? normalizePhoneDigits(customer.phone).includes(queryDigits)
          : false);
      const matchesMethod = selectedMethod === 'all' || (payment.paymentMethodName || payment.paymentMethod) === selectedMethod;
      const matchesStatus = selectedStatus === 'all' || payment.paymentStatus === selectedStatus;
      const matchesDate = !dateRange || (payment.paymentDate >= dateRange[0] && payment.paymentDate <= dateRange[1]);
      const matchesService = selectedService === 'all' || sale?.serviceId === selectedService;
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
      const fields = [customer?.name || '', customer?.phone || '', customer?.email || '', item.invoice?.invoiceNumber || item.sale.invoiceNo, item.sale.id, item.sale.plan, service?.name || ''];
      const queryMatch = !query || fields.some(field => normalizeSearchText(field).includes(query))
        || (queryDigits.length >= 3 && customer?.phone ? normalizePhoneDigits(customer.phone).includes(queryDigits) : false);
      const matchesMethod = selectedMethod === 'all' || (paymentsBySaleId.get(item.sale.id) || []).some(payment =>
        (payment.paymentMethodName || payment.paymentMethod) === selectedMethod
      );
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchesService = selectedService === 'all' || item.sale.serviceId === selectedService;
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

  const receivedTotal = useMemo(() => visiblePayments.reduce((total, payment) => {
    if (payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') return total;
    return total + convertReportCurrency(Number(payment.amount) || 0, payment.currency, globalCurrency);
  }, 0), [visiblePayments, globalCurrency]);
  const dueTotal = useMemo(() => visibleOutstanding.reduce(
    (total, item) => total + convertReportCurrency(item.due, item.sale.currency, globalCurrency), 0
  ), [visibleOutstanding, globalCurrency]);
  const partialCount = useMemo(() => visiblePayments.filter(payment => payment.paymentStatus === 'partial').length, [visiblePayments]);
  const pendingCount = useMemo(() => visiblePayments.filter(payment => payment.paymentStatus === 'pending').length, [visiblePayments]);
  const failedCount = useMemo(() => visiblePayments.filter(payment => payment.paymentStatus === 'failed').length, [visiblePayments]);
  const today = getTodayDateString();
  const paymentMethodSummaries = useMemo(
    () => getPaymentMethodSummary(visiblePayments, paymentMethods, globalCurrency, today),
    [visiblePayments, paymentMethods, globalCurrency, today]
  );
  const totalPages = Math.max(1, Math.ceil((activeTab === 'payments' ? visiblePayments.length : visibleOutstanding.length) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagePayments = visiblePayments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageOutstanding = visibleOutstanding.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const eligibleSales = useMemo(() => sales.filter(sale => {
    const linkedPayments = paymentsBySaleId.get(sale.id) || [];
    const due = getSaleDueAmount(sale, linkedPayments);
    if (due <= 0 || getSalePaymentStatus(sale, linkedPayments) === 'refunded') return false;
    if (newCustomerFilter !== 'all' && sale.customerId !== newCustomerFilter) return false;
    const query = normalizeSearchText(saleSearch);
    if (!query) return true;
    const customer = customersById.get(sale.customerId);
    const service = servicesById.get(sale.serviceId);
    const invoice = invoicesBySaleId.get(sale.id);
    const fields = [sale.id, sale.invoiceNo, invoice?.invoiceNumber || '', customer?.name || '', customer?.phone || '', service?.name || '', sale.plan];
    const digits = normalizePhoneDigits(saleSearch);
    return fields.some(field => normalizeSearchText(field).includes(query))
      || (digits.length >= 3 && customer?.phone ? normalizePhoneDigits(customer.phone).includes(digits) : false);
  }).sort((left, right) => right.date.localeCompare(left.date)), [sales, paymentsBySaleId, newCustomerFilter, saleSearch, customersById, servicesById, invoicesBySaleId]);
  const newSale = salesById.get(newSaleId);
  const newSaleCustomer = newSale ? customersById.get(newSale.customerId) : undefined;
  const newSaleService = newSale ? servicesById.get(newSale.serviceId) : undefined;
  const newSaleInvoice = newSale ? invoicesBySaleId.get(newSale.id) : undefined;
  const newSalePayments = newSale ? paymentsBySaleId.get(newSale.id) || [] : [];
  const newSaleDue = newSale ? getSaleDueAmount(newSale, newSalePayments) : 0;
  const duplicateTransaction = useMemo(() => {
    const transactionId = newTransactionId.trim().toLocaleLowerCase();
    if (!transactionId || !newSale) return null;
    return payments.find(payment => payment.transactionId?.trim().toLocaleLowerCase() === transactionId);
  }, [newTransactionId, newSale, payments]);
  const possibleDuplicate = useMemo(() => {
    if (!newSale || !newAmount || !newPaymentDate) return null;
    const amount = Number(newAmount);
    if (!Number.isFinite(amount)) return null;
    return payments.find(payment =>
      (payment.saleId === newSale.id || paymentSales.get(payment.id)?.id === newSale.id)
      && payment.paymentMethod === newMethod
      && payment.paymentDate === newPaymentDate
      && Math.abs(Number(payment.amount) - amount) < 0.005
    ) || null;
  }, [newSale, newAmount, newPaymentDate, newMethod, payments, paymentSales]);

  const openAddPayment = (customerId?: string) => {
    setNewSaleId('');
    setSaleSearch('');
    setNewAmount('');
    setNewStatus('paid');
    setNewMethod((getDefaultPaymentMethod(paymentMethods, settings.paymentPreferences?.defaultMethodId) || 'Cash') as PaymentMethod);
    setNewTransactionId('');
    setNewPaymentDate(getTodayDateString());
    setNewNotes('');
    setNewCustomerFilter(customerId || preselectedCustomerId || 'all');
    setDuplicatePayment(null);
    operationId.current = createRecordId('sale-payment-operation');
    setIsAddPaymentOpen(true);
  };

  const handleRecordPayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSale || isSaving || isSavingRef.current) return;
    const amount = Number(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Payment amount must be greater than zero.', 'error');
      return;
    }
    if (amount > newSaleDue) {
      showToast('Payment cannot be greater than the remaining balance.', 'error');
      return;
    }
    if (!isValidDate(newPaymentDate) || newPaymentDate > getTodayDateString()) {
      showToast('Choose a valid payment date that is not in the future.', 'error');
      return;
    }
    if (!activePaymentMethods.includes(newMethod)) {
      showToast('Choose an active payment method from Settings.', 'error');
      return;
    }
    if (paymentMethodRequiresTransactionId(newMethod, paymentMethods, settings.paymentPreferences?.requireTransactionId) && !newTransactionId.trim()) {
      showToast('Enter the required transaction ID.', 'error');
      return;
    }
    if (duplicateTransaction) {
      setDuplicatePayment(duplicateTransaction);
      showToast('Possible duplicate payment. Review the existing payment before continuing.', 'error');
      return;
    }
    if (possibleDuplicate) {
      setDuplicatePayment(possibleDuplicate);
      showToast('Possible duplicate payment. Review the existing payment before continuing.', 'error');
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      recordSalePayment(newSale.id, {
        operationId: operationId.current,
        customerId: newSale.customerId,
        amount: Math.round(amount * 100) / 100,
        currency: newSale.currency,
        paymentMethod: newMethod,
        transactionId: newTransactionId.trim() || undefined,
        paymentDate: newPaymentDate,
        paymentStatus: newStatus,
        notes: newNotes.trim() || undefined,
      });
      showToast('Payment recorded successfully.', 'success');
      setIsAddPaymentOpen(false);
      setNewCustomerFilter(preselectedCustomerId || 'all');
      setNewSaleId('');
      setNewAmount('');
      setNewTransactionId('');
      setNewNotes('');
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
      subscriptionsById.get(invoice.subscriptionId || sale.subscriptionId || '')
    );
    setSelectedInvoiceData(details);
  };

  const exportPayments = () => {
    downloadCSV(`payments-${getTodayDateString()}.csv`, exportPaymentsCSV(
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
  const validCustomRange = selectedDate !== 'custom'
    || (isValidDate(customStart) && isValidDate(customEnd) && customStart <= customEnd);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Wallet className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Payments</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track payments, outstanding balances and payment history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportPayments} disabled={!visiblePayments.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <ArrowDownToLine className="h-4 w-4" /> Export
          </button>
          <button type="button" onClick={() => openAddPayment()} disabled={!activePaymentMethods.length || !outstandingSales.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <CreditCard className="h-4 w-4" /> Add Payment
          </button>
        </div>
      </header>

      <section aria-label="Payment summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Matching Payments" value={String(visiblePayments.length)} />
        <Metric label="Received (filtered)" value={formatCurrency(receivedTotal, globalCurrency)} tone="emerald" />
        <Metric label="Outstanding Due" value={formatCurrency(dueTotal, globalCurrency)} tone="amber" />
        <Metric label="Partial" value={String(partialCount)} tone="amber" />
        <Metric label="Pending" value={String(pendingCount)} />
        <Metric label="Failed" value={String(failedCount)} tone="rose" />
      </section>
      <section aria-label="Payment methods summary" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Received by method</h2><p className="text-xs text-slate-500">Received and partial payments matching the current filters.</p></div>
          {selectedMethod !== 'all' && <span className="text-xs text-slate-500">Filtered to {selectedMethod}</span>}
        </div>
        {paymentMethodSummaries.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {paymentMethodSummaries.map(item => <div key={item.methodId} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{item.methodName}</span><span className="text-[10px] capitalize text-slate-500">{item.category.replace('_', ' ')}</span></div>
            <p className="mt-1 font-mono text-base font-bold">{formatCurrency(item.received, globalCurrency)}</p>
            <p className="mt-1 text-[11px] text-slate-500">{item.transactionCount} payments · Avg {formatCurrency(item.average, globalCurrency)}</p>
            <p className="mt-1 text-[10px] text-slate-500">Today {formatCurrency(item.today, globalCurrency)} · Month {formatCurrency(item.thisMonth, globalCurrency)}</p>
          </div>)}
        </div> : <p className="py-4 text-center text-xs text-slate-500">No received payments match the current filters.</p>}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>Payment history <span>{payments.length}</span></TabButton>
        <TabButton active={activeTab === 'outstanding'} onClick={() => setActiveTab('outstanding')}>Outstanding <span>{outstandingSales.length}</span></TabButton>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search payments and receivables</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search payment, transaction, customer, invoice, sale, service or plan" className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
          <div className="flex gap-2">
            {activeTab === 'payments' && <select aria-label="Filter by payment status" value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)} className="min-h-10 min-w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="all">All statuses</option>
              <option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
            </select>}
            <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>
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
              <option value="all">All customers</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
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
          <div className="flex items-end justify-between gap-3 text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
            <span>{activeTab === 'payments' ? `${visiblePayments.length} payments` : `${visibleOutstanding.length} outstanding invoices`}</span>
            <button type="button" onClick={() => { setSelectedMethod('all'); setSelectedStatus('all'); setSelectedDate('all'); setCustomStart(''); setCustomEnd(''); setSelectedService('all'); setSelectedCustomer('all'); setSelectedAmount('all'); setSearchInput(''); }} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Clear filters</button>
          </div>
          {!validCustomRange && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300 sm:col-span-2 lg:col-span-4">Enter a valid custom date range.</p>}
        </div>}
      </section>

      {activeTab === 'payments' ? (
        <section aria-label="Payments table" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Invoice / Sale</th><th className="px-3 py-3">Service</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Transaction</th><th className="px-3 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagePayments.map(payment => {
                  const sale = paymentSales.get(payment.id);
                  const customer = resolvePaymentCustomer(payment, customers, sales, subscriptions);
                  const invoice = payment.invoiceId ? invoices.find(item => item.invoiceId === payment.invoiceId) : undefined;
                  const service = sale ? servicesById.get(sale.serviceId) : undefined;
                  return <tr id={`payment-${payment.id}`} key={payment.id} className={focusedPaymentIdState === payment.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}>
                    <td className="px-3 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">{payment.id}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatAppDate(payment.paymentDate, language)}</td>
                    <td className="px-3 py-3"><div className="font-semibold text-slate-900 dark:text-white">{getCustomerDisplayName(customer)}</div><div className="text-[10px] text-slate-500">{customer?.phone || customer?.email || ''}</div></td>
                    <td className="px-3 py-3"><div>{invoice?.invoiceNumber || sale?.invoiceNo || '—'}</div><div className="font-mono text-[10px] text-slate-500">{sale?.id || payment.saleId || 'Unlinked legacy payment'}</div></td>
                    <td className="px-3 py-3">{service?.name || '—'}{sale?.plan && <div className="text-[10px] text-slate-500">{sale.plan}</div>}</td>
                    <td className="px-3 py-3">{methodLabel(payment.paymentMethodName || payment.paymentMethod)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono font-bold">{formatCurrency(payment.amount, payment.currency)}</td>
                    <td className="px-3 py-3"><PaymentStatusBadge status={payment.paymentStatus} className={statusStyle(payment.paymentStatus)} icon={statusIcon(payment.paymentStatus)} /></td>
                    <td className="max-w-32 truncate px-3 py-3 font-mono text-slate-500" title={payment.transactionId || ''}>{payment.transactionId || '—'}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => openPaymentDetails(payment)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"><Eye className="h-3.5 w-3.5" /> View</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
            {pagePayments.map(payment => {
              const sale = paymentSales.get(payment.id);
              const customer = resolvePaymentCustomer(payment, customers, sales, subscriptions);
              const service = sale ? servicesById.get(sale.serviceId) : undefined;
              return <article id={`payment-${payment.id}`} key={payment.id} className={`space-y-2 p-4 ${focusedPaymentIdState === payment.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-mono text-xs text-slate-500">{payment.id}</p><h3 className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">{getCustomerDisplayName(customer)}</h3><p className="text-xs text-slate-500">{service?.name || 'Payment'}{sale?.plan ? ` · ${sale.plan}` : ''}</p></div><span className="shrink-0 font-mono font-bold">{formatCurrency(payment.amount, payment.currency)}</span></div>
                <div className="flex flex-wrap items-center justify-between gap-2"><PaymentStatusBadge status={payment.paymentStatus} className={statusStyle(payment.paymentStatus)} icon={statusIcon(payment.paymentStatus)} /><span className="text-xs text-slate-500">{methodLabel(payment.paymentMethodName || payment.paymentMethod)} · {formatAppDate(payment.paymentDate, language)}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[11px] text-slate-500">{payment.transactionId || 'No transaction ID'}</span><button type="button" onClick={() => openPaymentDetails(payment)} className="min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">View details</button></div>
              </article>;
            })}
          </div>
          {pagePayments.length === 0 && <EmptyState title={payments.length ? selectedStatus === 'failed' ? 'No failed payments' : 'No payments found' : 'No payments yet'} description={payments.length ? 'Try changing your search or filters.' : 'Payments will appear here after transactions are recorded.'} />}
        </section>
      ) : (
        <section aria-label="Outstanding receivables" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Invoice / Sale</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Last payment</th><th className="px-4 py-3">Days outstanding</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageOutstanding.map(({ sale, invoice, due, paid, lastPayment, dueReferenceDate }) => {
                  const customer = customersById.get(sale.customerId);
                  const service = servicesById.get(sale.serviceId);
                  const days = getAgingDays(dueReferenceDate);
                  return <tr key={sale.id}>
                    <td className="px-4 py-3"><div className="font-semibold">{getCustomerDisplayName(customer)}</div><div className="text-[10px] text-slate-500">{customer?.phone || ''}</div></td>
                    <td className="px-4 py-3">{invoice?.invoiceNumber || sale.invoiceNo}<div className="font-mono text-[10px] text-slate-500">{sale.id}</div></td>
                    <td className="px-4 py-3">{service?.name || '—'}<div className="text-[10px] text-slate-500">{sale.plan}</div></td>
                    <td className="px-4 py-3">{formatCurrency(sale.amount, sale.currency)}</td><td className="px-4 py-3">{formatCurrency(paid, sale.currency)}</td>
                    <td className="px-4 py-3 font-bold text-amber-700 dark:text-amber-300">{formatCurrency(due, sale.currency)}</td>
                    <td className="px-4 py-3">{lastPayment ? formatAppDate(lastPayment.paymentDate, language) : '—'}</td>
                    <td className="px-4 py-3"><span>{days} days</span><div className="text-[10px] text-slate-500">{getAgingBucket(days)}</div></td>
                    <td className="px-4 py-3"><div className="flex gap-1"><button type="button" onClick={() => openAddPayment(sale.customerId)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700">Add Payment</button>{customer && canContact(customer.id) && <button type="button" title="Compose payment reminder" aria-label={`Compose payment reminder for ${customer.name}`} onClick={() => openMessage({ customerId: customer.id, saleId: sale.id, templateId: 'payment_reminder' })} className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><MessageCircle className="h-4 w-4" /></button>}<button type="button" aria-label="View sale" onClick={() => onNavigateSection?.('sales', sale.id)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Eye className="h-4 w-4" /></button><button type="button" aria-label="View invoice" onClick={() => openInvoice(sale)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><FileText className="h-4 w-4" /></button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
            {pageOutstanding.map(({ sale, invoice, due, paid, lastPayment, dueReferenceDate }) => {
              const customer = customersById.get(sale.customerId);
              const days = getAgingDays(dueReferenceDate);
              return <article key={sale.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{getCustomerDisplayName(customer)}</h3><p className="text-xs text-slate-500">{servicesById.get(sale.serviceId)?.name || 'Service'} · {sale.plan}</p><p className="mt-1 text-[11px] text-slate-500">{invoice?.invoiceNumber || sale.invoiceNo}</p></div><p className="font-mono font-bold text-amber-700 dark:text-amber-300">{formatCurrency(due, sale.currency)} due</p></div>
                <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-500">Total / Paid</dt><dd>{formatCurrency(sale.amount, sale.currency)} / {formatCurrency(paid, sale.currency)}</dd></div><div><dt className="text-slate-500">Outstanding</dt><dd>{days} days · {getAgingBucket(days)}</dd></div><div><dt className="text-slate-500">Last payment</dt><dd>{lastPayment ? formatAppDate(lastPayment.paymentDate, language) : 'None'}</dd></div></dl>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openAddPayment(sale.customerId)} className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">Add Payment</button>{customer && canContact(customer.id) && <button type="button" onClick={() => openMessage({ customerId: customer.id, saleId: sale.id, templateId: 'payment_reminder' })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />WhatsApp Reminder</button>}<button type="button" onClick={() => onNavigateSection?.('sales', sale.id)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">View Sale</button><button type="button" onClick={() => openInvoice(sale)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">View Invoice</button><button type="button" onClick={() => onNavigateSection?.('customers', sale.customerId)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">Customer</button></div>
              </article>;
            })}
          </div>
          {pageOutstanding.length === 0 && <EmptyState title={outstandingSales.length ? 'No matching receivables' : 'All balances are paid'} description={outstandingSales.length ? 'Try changing your search or filters.' : 'There are no outstanding sale balances to collect.'} />}
        </section>
      )}

      {(activeTab === 'payments' ? visiblePayments.length : visibleOutstanding.length) > 0 && <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="min-h-9 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="min-h-9 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button></div>
      </nav>}

      <Modal isOpen={isAddPaymentOpen} onClose={() => { if (!isSaving) setIsAddPaymentOpen(false); }} title="Record Payment" subtitle="Select an outstanding sale and record a received payment." maxWidth="lg">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Find sale or invoice
            <span className="relative mt-1.5 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={saleSearch} onChange={event => setSaleSearch(event.target.value)} placeholder="Invoice, customer, phone, service or sale ID" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></span>
          </label>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Outstanding sale *
            <select required value={newSaleId} onChange={event => { setNewSaleId(event.target.value); setNewAmount(''); setNewTransactionId(''); setDuplicatePayment(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Choose a sale</option>
              {eligibleSales.map(sale => {
                const customer = customersById.get(sale.customerId);
                const due = getSaleDueAmount(sale, paymentsBySaleId.get(sale.id) || []);
                return <option key={sale.id} value={sale.id}>{getCustomerDisplayName(customer)} · {servicesById.get(sale.serviceId)?.name || 'Service'} · {invoicesBySaleId.get(sale.id)?.invoiceNumber || sale.invoiceNo} · Due {formatCurrency(due, sale.currency)}</option>;
              })}
            </select>
          </label>
          {!eligibleSales.length && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No sales with an outstanding balance were found.</p>}
          {newSale && <section aria-label="Selected sale balance" className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20 sm:grid-cols-2">
            <div><p className="text-xs text-slate-500">Customer</p><p className="font-semibold">{getCustomerDisplayName(newSaleCustomer)}</p><p className="text-xs text-slate-500">{newSaleCustomer?.phone || newSaleCustomer?.email || ''}</p></div>
            <div><p className="text-xs text-slate-500">Sale</p><p className="font-semibold">{newSaleService?.name || 'Service'} · {newSale.plan}</p><p className="text-xs text-slate-500">{newSaleInvoice?.invoiceNumber || newSale.invoiceNo}</p></div>
            <div><p className="text-xs text-slate-500">Total · Previously paid</p><p className="font-semibold">{formatCurrency(newSale.amount, newSale.currency)} · {formatCurrency(getSalePaidAmount(newSale, newSalePayments), newSale.currency)}</p></div>
            <div><p className="text-xs text-slate-500">Remaining balance</p><p className="font-mono font-bold text-amber-800 dark:text-amber-300">{formatCurrency(newSaleDue, newSale.currency)}</p></div>
          </section>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Amount *
              <input required type="number" min="0.01" max={newSaleDue || undefined} step={newSale?.currency === 'USD' ? '0.01' : '1'} value={newAmount} onChange={event => { setNewAmount(event.target.value); setDuplicatePayment(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Payment date *
              <input required type="date" max={getTodayDateString()} value={newPaymentDate} onChange={event => { setNewPaymentDate(event.target.value); setDuplicatePayment(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Payment method *
              <select required value={newMethod} onChange={event => { setNewMethod(event.target.value as PaymentMethod); setDuplicatePayment(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                {activePaymentMethods.map(method => <option key={method} value={method}>{methodLabel(method)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Payment status *
              <select required value={newStatus} onChange={event => setNewStatus(event.target.value as Extract<PaymentStatus, 'paid' | 'pending' | 'failed'>)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="paid">Received</option><option value="pending">Pending</option><option value="failed">Failed</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Transaction ID {paymentMethodRequiresTransactionId(newMethod, paymentMethods, settings.paymentPreferences?.requireTransactionId) ? '*' : '(optional)'}
              <input required={paymentMethodRequiresTransactionId(newMethod, paymentMethods, settings.paymentPreferences?.requireTransactionId)} value={newTransactionId} onChange={event => { setNewTransactionId(event.target.value); setDuplicatePayment(null); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Note <span className="font-normal text-slate-500">(optional)</span>
            <input value={newNotes} onChange={event => setNewNotes(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>
          {duplicateTransaction && <DuplicateWarning payment={duplicateTransaction} onReview={() => { setIsAddPaymentOpen(false); openPaymentDetails(duplicateTransaction); }} />}
          {!duplicateTransaction && possibleDuplicate && <DuplicateWarning payment={possibleDuplicate} onReview={() => { setIsAddPaymentOpen(false); openPaymentDetails(possibleDuplicate); }} />}
          {duplicatePayment && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">A matching payment exists. Review it before recording another payment.</p>}
          <p className="text-xs text-slate-500">Only active payment methods from Settings are selectable. Received payments are added to the existing sale, invoice and subscription records.</p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button type="button" disabled={isSaving} onClick={() => setIsAddPaymentOpen(false)} className="min-h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={isSaving || !newSale || !activePaymentMethods.length || Boolean(duplicateTransaction || possibleDuplicate)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? <><Clock3 className="h-4 w-4 animate-spin" /> Recording payment…</> : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} title={selectedPayment?.id || 'Payment Details'} subtitle={selectedPayment ? `${formatAppDate(selectedPayment.paymentDate, language)} · ${selectedPayment.paymentStatus}` : undefined} maxWidth="xl">
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
          <section className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-bold">Customer</h3>
            <p className="text-sm font-semibold">{getCustomerDisplayName(selectedCustomerForPayment)}</p>
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
            <ol className="space-y-2">{selectedHistory.map(payment => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70"><span>{formatAppDate(payment.paymentDate, language)} · {methodLabel(payment.paymentMethodName || payment.paymentMethod)}{payment.transactionId ? ` · ${payment.transactionId}` : ''}</span><span className="font-semibold">{formatCurrency(payment.amount, payment.currency)} · {payment.paymentStatus}</span></li>)}</ol>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold dark:border-slate-700"><span>Total received</span><span>{formatCurrency(selectedSalePaid, selectedSaleForPayment.currency)}</span></div>
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

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'border-slate-200 dark:border-slate-800',
    emerald: 'border-emerald-200 dark:border-emerald-900',
    amber: 'border-amber-200 dark:border-amber-900',
    rose: 'border-rose-200 dark:border-rose-900',
  };
  return <div className={`min-w-0 rounded-2xl border bg-white p-3 shadow-xs dark:bg-slate-900 sm:p-4 ${tones[tone]}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900 dark:text-white sm:text-xl">{value}</p></div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{children}</button>;
}

function PaymentStatusBadge({ status, className, icon }: { status: PaymentStatus; className: string; icon: React.ReactNode }) {
  const label = status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : 'Refunded';
  return <span aria-label={`Payment status: ${label}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${className}`}>{icon}{label}</span>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="px-4 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><Wallet className="h-5 w-5" /></div><h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></div>;
}

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-words text-sm ${strong ? 'font-mono font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{value}</dd></div>;
}

function DuplicateWarning({ payment, onReview }: { payment: Payment; onReview: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><span>Possible duplicate payment: {payment.id} · {payment.transactionId || formatCurrency(payment.amount, payment.currency)}.</span><button type="button" onClick={onReview} className="inline-flex items-center gap-1 font-bold underline"><Eye className="h-3.5 w-3.5" /> Review payment</button></div>;
}
