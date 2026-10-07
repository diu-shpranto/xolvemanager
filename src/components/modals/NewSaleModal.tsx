import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { PaymentMethod, PaymentStatus, AppCurrency, Subscription } from '../../types';
import { getDefaultPaymentMethod, normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../../utils/paymentMethods';
import { calculateExpiryDate, formatAppDate, formatCurrency, getDaysDifference, getTodayDateString } from '../../utils/dateUtils';
import {
  Plus,
  Check,
  FileText,
  Download,
  CheckCircle2,
  RefreshCw,
  Receipt,
  Share2,
  Search,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Layers,
  CreditCard,
  CalendarDays,
  AlertTriangle,
  LoaderCircle,
  MessageCircle,
} from 'lucide-react';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import {
  InvoiceSaleDetails,
  generateInvoiceJpg,
  downloadInvoiceJpg,
  shareInvoiceJpg,
  canShareInvoiceJpg,
} from '../../utils/invoiceGenerator';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { getAvailableProfiles, isAccountOperational } from '../../utils/resourceManagement';
import { getSaleDueAmount } from '../../utils/saleUtils';
import { createRecordId } from '../../services/localStorageStore';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCustomerId?: string;
  preselectedServiceId?: string;
  onViewSubscription?: (subscriptionId: string) => void;
  onViewCustomer?: (customerId: string) => void;
  onViewSale?: (saleId: string) => void;
  onViewAccounts?: () => void;
  onAddService: () => void;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  preselectedCustomerId,
  preselectedServiceId,
  onViewSubscription,
  onViewCustomer,
  onViewSale,
  onViewAccounts,
  onAddService,
}) => {
  const { customers, services, accounts, subscriptions, sales, payments, createSale, addCustomer, addAccount, logActivity, settings, currency: globalCurrency, t, language } = useApp();
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();

  // Quick Customer Creation Toggle
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustWhatsapp, setNewCustWhatsapp] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustFb, setNewCustFb] = useState('');

  // Form Fields
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [serviceId, setServiceId] = useState(preselectedServiceId || (services.find(s => s.status === 'active' && !s.isArchived)?.id || ''));
  const [plan, setPlan] = useState('');
  const [planId, setPlanId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [durationDays, setDurationDays] = useState(settings.subscriptionDefaults?.durationDays ?? 30);
  const [currency, setCurrency] = useState<AppCurrency>(globalCurrency);
  const [price, setPrice] = useState(350);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    (getDefaultPaymentMethod(normalizePaymentMethods(settings.paymentPreferences?.methods), settings.paymentPreferences?.defaultMethodId) || 'Cash') as PaymentMethod
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [transactionId, setTransactionId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(!preselectedCustomerId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountProfileCount, setNewAccountProfileCount] = useState(1);
  const [discountMode, setDiscountMode] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const submissionLock = useRef(false);
  const saleOperationId = useRef(createRecordId('new-sale-operation'));
  const customerCreationLock = useRef(false);
  const accountCreationLock = useRef(false);
  const invoiceGenerationLock = useRef(false);

  const reportValidationError = (message: string, targetStep?: number) => {
    setStepError(message);
    if (targetStep !== undefined) setStep(targetStep);
    showToast(message, 'error');
  };

  // Completed sale state for Invoice Generation & Success Flow
  const [completedSaleData, setCompletedSaleData] = useState<InvoiceSaleDetails | null>(null);
  const [completedSubscription, setCompletedSubscription] = useState<Subscription | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [isDownloadingDirect, setIsDownloadingDirect] = useState(false);
  const [isSharingDirect, setIsSharingDirect] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

  // Update defaults when preselected customer/service changes
  useEffect(() => {
    if (isOpen) setDurationDays(settings.subscriptionDefaults?.durationDays ?? 30);
  }, [isOpen, settings.subscriptionDefaults?.durationDays]);

  useEffect(() => {
    if (preselectedCustomerId) {
      setCustomerId(preselectedCustomerId);
      setShowCustomerPicker(false);
    }
  }, [preselectedCustomerId]);

  useEffect(() => {
    if (preselectedServiceId) setServiceId(preselectedServiceId);
  }, [preselectedServiceId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim().toLocaleLowerCase()), 180);
    return () => window.clearTimeout(timeout);
  }, [customerSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedServiceSearch(serviceSearch.trim().toLocaleLowerCase()), 180);
    return () => window.clearTimeout(timeout);
  }, [serviceSearch]);

  // Keep plan defaults synchronized while preserving account/profile selections unless the service changes.
  useEffect(() => {
    const canSellService = (service: typeof services[number]) =>
      !service.isArchived
      && service.status === 'active'
      && service.settings?.subscriptionEnabled !== false
      && service.advanced?.allowNewSubscriptions !== false
      && service.advanced?.showInNewSale !== false;
    const srv = services.find(s => s.id === serviceId && canSellService(s));
    if (!srv) return;
    const activePlans = srv.planDetails?.filter(item => item.status === 'active') || [];
    const selectedPlan = activePlans.find(item => item.id === planId) || activePlans[0];
    if (selectedPlan) {
      setPlan(selectedPlan.name);
      setPlanId(selectedPlan.id);
      setDurationDays(selectedPlan.durationDays);
      setCurrency(selectedPlan.currency);
      setPrice(selectedPlan.price);
    } else {
      setPlan('');
      setPlanId('');
      setDurationDays(srv.defaultDurationDays || 30);
      setPrice(currency === 'BDT' ? srv.defaultPriceBDT || 350 : srv.defaultPriceUSD || 3.50);
    }
  }, [serviceId, services]);

  const handleServiceChange = (nextServiceId: string) => {
    setServiceId(nextServiceId);
    setPlan('');
    setPlanId('');
    setAccountId('');
    setProfileId('');
    setDiscountMode('fixed');
    setDiscountValue(0);
    setPaymentStatus('paid');
    setAmountPaidInput('');
  };

  const handlePlanChange = (selectedPlan: NonNullable<(typeof services)[number]['planDetails']>[number]) => {
    setPlan(selectedPlan.name);
    setPlanId(selectedPlan.id);
    setDurationDays(selectedPlan.durationDays);
    setCurrency(selectedPlan.currency);
    setPrice(selectedPlan.price);
    setAccountId('');
    setProfileId('');
    setDiscountMode('fixed');
    setDiscountValue(0);
    setPaymentStatus('paid');
    setAmountPaidInput('');
  };

  // When account changes, update available profile
  const handleAccountChange = (accId: string) => {
    setAccountId(accId);
    const acc = accounts.find(a => a.id === accId);
    if (acc && acc.profiles && acc.profiles.length > 0) {
      const availProfile = acc.profiles.find(p => p.status === 'Available');
      setProfileId(availProfile ? availProfile.id : '');
    } else {
      setProfileId('');
    }
  };

  // Calculated expiry date
  const calculatedExpiryDate = calculateExpiryDate(startDate, durationDays);

  const selectedService = services.find(s => s.id === serviceId);
  const selectedPlan = selectedService?.planDetails?.find(item => item.id === planId && item.status === 'active');
  const selectedAccount = accounts.find(a => a.id === accountId);
  const eligibleServices = useMemo(
    () => services.filter(s =>
      !s.isArchived
      && s.status === 'active'
      && s.settings?.subscriptionEnabled !== false
      && s.advanced?.allowNewSubscriptions !== false
      && s.advanced?.showInNewSale !== false
    ),
    [services]
  );
  const filteredServices = useMemo(() => {
    const query = debouncedServiceSearch;
    return eligibleServices.filter(service =>
      !query || [service.name, service.description, service.category]
        .some(value => value?.toLowerCase().includes(query))
    ).slice(0, 50);
  }, [eligibleServices, debouncedServiceSearch]);
  const serviceUsesProfiles = selectedService?.settings?.usesProfiles === true;
  const profileRequired = serviceUsesProfiles || selectedService?.settings?.profileAssignmentRequired === true;
  const serviceUsesAccounts = selectedService?.settings?.usesAccounts === true || profileRequired;
  const availableProfilePairs = useMemo(
    () => getAvailableProfiles(accounts, serviceId, planId),
    [accounts, serviceId, planId]
  );
  const availableAccounts = useMemo(
    () => accounts.filter(a =>
      a.serviceId === serviceId
      && (!a.planId || a.planId === planId)
      && isAccountOperational(a)
      && a.allowNewAssignment !== false
      && (!profileRequired || availableProfilePairs.some(pair => pair.account.id === a.id))
    ),
    [accounts, serviceId, planId, profileRequired, availableProfilePairs]
  );
  const availableProfiles = availableAccounts.some(account => account.id === selectedAccount?.id)
    ? availableProfilePairs.filter(pair => pair.account.id === selectedAccount?.id).map(pair => pair.profile)
    : [];
  const activeCustomers = useMemo(
    () => customers.filter(c => !c.isArchived && c.status !== 'archived'),
    [customers]
  );
  const filteredCustomers = useMemo(() => {
    const query = debouncedCustomerSearch;
    const matches = !query ? activeCustomers : activeCustomers.filter(c =>
      [c.name, c.phone, c.whatsapp, c.email].some(value => value?.toLowerCase().includes(query))
    );
    return matches.slice(0, 50);
  }, [activeCustomers, debouncedCustomerSearch]);
  const selectedCustomer = customers.find(c => c.id === customerId && !c.isArchived && c.status !== 'archived');
  const selectedProfile = selectedAccount?.profiles?.find(p => p.id === profileId);
  const subtotal = Number(price);
  const discountAmount = Math.min(
    Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0,
    discountMode === 'percentage' ? subtotal * Math.max(0, Number(discountValue) || 0) / 100 : Math.max(0, Number(discountValue) || 0)
  );
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const amountPaid = paymentStatus === 'paid'
    ? totalAmount
    : paymentStatus === 'partial'
      ? Number(amountPaidInput) || 0
      : 0;
  const dueAmount = Math.max(0, totalAmount - amountPaid);
  const customerDueByCurrency = useMemo(() => {
    if (!selectedCustomer) return [];
    const dueByCurrency = new Map<AppCurrency, number>();
    sales.filter(sale => sale.customerId === selectedCustomer.id).forEach(sale => {
      const due = getSaleDueAmount(sale, payments);
      if (due > 0) dueByCurrency.set(sale.currency, (dueByCurrency.get(sale.currency) || 0) + due);
    });
    return [...dueByCurrency.entries()];
  }, [selectedCustomer, sales, payments]);
  const customerServiceSubscriptions = useMemo(() => {
    if (!selectedCustomer || !selectedService) return [];
    return subscriptions.filter(subscription =>
      subscription.customerId === selectedCustomer.id
      && subscription.serviceId === selectedService.id
      && subscription.status !== 'cancelled'
      && getDaysDifference(subscription.expiryDate) >= 0
    );
  }, [selectedCustomer, selectedService, subscriptions]);

  const handleQuickAddAccount = () => {
    if (accountCreationLock.current || !selectedService) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAccountEmail.trim())) {
      showToast('Enter a valid account email.', 'error');
      return;
    }
    if (serviceUsesProfiles && (!Number.isInteger(newAccountProfileCount) || newAccountProfileCount < 1)) {
      showToast('Enter at least one profile slot.', 'error');
      return;
    }
    accountCreationLock.current = true;
    setIsAddingAccount(true);
    try {
      const profileCount = serviceUsesProfiles ? Math.max(1, Math.floor(newAccountProfileCount)) : 0;
      const added = addAccount({
        serviceId: selectedService.id,
        email: newAccountEmail.trim(),
        password: newAccountPassword,
        plan: plan || 'Standard',
        planId: planId || undefined,
        status: 'Available',
        maxProfiles: profileCount,
        profiles: Array.from({ length: profileCount }, (_, index) => ({
          id: '',
          accountId: '',
          profileName: `Profile ${index + 1}`,
          status: 'Available' as const,
        })),
      });
      setAccountId(added.id);
      setProfileId(added.profiles.find(profile => profile.status === 'Available')?.id || '');
      setNewAccountEmail('');
      setNewAccountPassword('');
      setIsAddingAccount(false);
      showToast('Account added and selected.', 'success');
    } catch (error) {
      console.error('Failed to add account from New Sale', error);
      showToast('Unable to add account. Please try again.', 'error');
    } finally {
      accountCreationLock.current = false;
      setIsAddingAccount(false);
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerCreationLock.current) return;
    if (!newCustName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    const normalizePhone = (value?: string) => value?.replace(/\D/g, '') || '';
    const normalizedPhones = [normalizePhone(newCustPhone), normalizePhone(newCustWhatsapp)].filter(Boolean);
    const normalizedEmail = newCustEmail.trim().toLowerCase();
    const normalizedName = newCustName.trim().toLowerCase();
    const duplicate = activeCustomers.find(customer => {
      const phoneMatches = normalizedPhones.some(phone =>
        [customer.phone, customer.whatsapp].some(existingPhone => normalizePhone(existingPhone) === phone)
      );
      const emailMatches = normalizedEmail !== '' && customer.email.trim().toLowerCase() === normalizedEmail;
      return phoneMatches || emailMatches;
    });
    if (duplicate) {
      setCustomerId(duplicate.id);
      setIsCreatingCustomer(false);
      setShowCustomerPicker(false);
      showToast(`${duplicate.name} already exists. Selected the existing customer.`, 'info');
      return;
    }
    const sameName = activeCustomers.some(customer => customer.name.trim().toLowerCase() === normalizedName);
    if (sameName && !normalizedPhones.length && !normalizedEmail) {
      setShowCustomerPicker(true);
      setCustomerSearch(newCustName.trim());
      setIsCreatingCustomer(false);
      showToast('A customer with this name already exists. Select the intended record or add a unique phone or email.', 'error');
      return;
    }
    customerCreationLock.current = true;
    setIsAddingCustomer(true);
    try {
      const created = await addCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        whatsapp: newCustWhatsapp.trim() || newCustPhone.trim(),
        email: newCustEmail.trim(),
        facebookUrl: newCustFb.trim(),
        notes: 'Added via New Sale wizard',
      });
      setCustomerId(created.id);
      setIsCreatingCustomer(false);
      showToast(`Added customer: ${created.name}`, 'success');
    } catch (error) {
      console.error('Failed to add customer from New Sale', error);
      showToast('Unable to add customer. Please try again.', 'error');
    } finally {
      customerCreationLock.current = false;
      setIsAddingCustomer(false);
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    if (submissionLock.current) return;
    if (!customerId) {
      reportValidationError('Please select or create a customer.', 0);
      return;
    }
    if (!selectedCustomer) {
      reportValidationError('The selected customer is no longer available. Select a current customer record.', 0);
      return;
    }
    if (!serviceId) {
      reportValidationError('Please choose a service.', 1);
      return;
    }
    if (
      !selectedService
      || selectedService.status !== 'active'
      || selectedService.isArchived
      || selectedService.settings?.subscriptionEnabled === false
      || selectedService.advanced?.allowNewSubscriptions === false
      || selectedService.advanced?.showInNewSale === false
    ) {
      reportValidationError('This service is no longer available. Choose an active service.', 1);
      return;
    }
    const selectedServicePlan = selectedService.planDetails?.find(item => item.id === planId);
    if (!selectedServicePlan || selectedServicePlan.status !== 'active' || selectedServicePlan.name !== plan) {
      reportValidationError('The selected plan is no longer available. Choose a plan for this service.', 1);
      return;
    }
    if (Number(durationDays) !== selectedServicePlan.durationDays || Number(price) !== selectedServicePlan.price || currency !== selectedServicePlan.currency) {
      reportValidationError('Price and duration must match the selected plan. Select the correct active plan.', 1);
      return;
    }
    if (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1 || calculatedExpiryDate <= startDate) {
      reportValidationError('Enter a valid start date and duration.', 2);
      return;
    }
    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      reportValidationError('Enter a valid sale price.', 2);
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || discountValue < 0 || (discountMode === 'fixed' && discountValue > subtotal) || (discountMode === 'percentage' && discountValue > 100)) {
      reportValidationError('Enter a valid price and discount.', 2);
      return;
    }
    if (serviceUsesAccounts && !accountId) {
      reportValidationError('Select an account for this service.', 2);
      return;
    }
    if (accountId && !availableAccounts.some(account => account.id === accountId)) {
      reportValidationError('The selected account is no longer available. Choose another account or use manual fulfillment.', 2);
      return;
    }
    if (profileRequired && !profileId) {
      reportValidationError('Select an available profile for this service.', 2);
      return;
    }
    if (profileId && !availableProfiles.some(profile => profile.id === profileId)) {
      reportValidationError('The selected profile is no longer available. Choose another profile or use manual fulfillment.', 2);
      return;
    }

    if (paymentStatus === 'partial' && !(amountPaid > 0 && amountPaid < totalAmount)) {
      reportValidationError('Partial payment must be greater than zero and less than the total.', 3);
      return;
    }
    if (amountPaid > totalAmount || amountPaid < 0) {
      reportValidationError('Amount paid cannot exceed the total.', 3);
      return;
    }
    if ((settings.paymentPreferences?.methods ?? ['bKash', 'Nagad', 'Rocket', 'Bank', 'Card', 'Cash', 'Other']).length === 0) {
      reportValidationError('Enable at least one payment method in Settings before creating a sale.', 3);
      return;
    }
    if (!paymentMethods.includes(paymentMethod)) {
      reportValidationError('Choose an enabled payment method.', 3);
      return;
    }
    if (paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) && !transactionId.trim()) {
      reportValidationError('Enter the required transaction ID.', 3);
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      const result = createSale({
        customerId,
        serviceId,
        plan,
        planId,
        accountId: accountId || undefined,
        profileId: profileId || undefined,
        startDate,
        durationDays: Number(durationDays),
        subtotal,
        discount: discountAmount,
        price: totalAmount,
        amountPaid,
        currency,
        paymentMethod,
        paymentStatus,
        paymentNote: paymentNote.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        senderNumber: senderNumber.trim() || undefined,
        notes,
        operationId: saleOperationId.current,
      });

      const cust = customers.find(c => c.id === customerId);
      const srv = services.find(s => s.id === serviceId);
      const acc = accounts.find(a => a.id === accountId);
      const prof = acc?.profiles?.find(p => p.id === profileId);

      const invoicePayload: InvoiceSaleDetails = {
        ...buildInvoiceSaleDetails(
          result.invoice,
          result.sale,
          cust,
          srv,
          [result.payment],
          settings,
          result.subscription
        ),
        allocation: prof?.profileName
          ? undefined
          : accountId
            ? 'Full account access'
            : 'Digital license',
        profileName: prof?.profileName,
        subtotal: result.sale.subtotal ?? result.sale.amount,
        discount: result.sale.discount ?? 0,
        paymentDate: result.payment.paymentDate,
        transactionId: result.payment.transactionId || result.sale.transactionId,
        tagline: settings.tagline,
        contactPhone: settings.contactPhone,
        adminEmail: settings.adminEmail,
        invoiceSettings: srv?.invoiceSettings,
        serviceDescription: srv?.description,
        serviceLogoUrl: srv?.logoUrl,
      };

      setCompletedSaleData(invoicePayload);
      setCompletedSubscription(result.subscription);
      showToast('Sale completed successfully.', 'success');
    } catch (error) {
      console.error('Unable to complete sale', error);
      showToast('Unable to complete sale. Your form details are still available; review the selections and try again.', 'error');
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDirectDownload = async () => {
    if (!completedSaleData || invoiceGenerationLock.current) return;
    invoiceGenerationLock.current = true;
    setIsDownloadingDirect(true);
    try {
      const result = await generateInvoiceJpg(completedSaleData);
      downloadInvoiceJpg(result.blob, result.fileName);
      recordInvoiceGenerated(completedSaleData);
      showToast(`Invoice generated · ${Math.round(result.blob.size / 1024)} KB`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Unable to generate invoice. Please try again.', 'error');
    } finally {
      invoiceGenerationLock.current = false;
      setIsDownloadingDirect(false);
    }
  };

  const handleDirectShare = async () => {
    if (!completedSaleData || invoiceGenerationLock.current) return;
    invoiceGenerationLock.current = true;
    setIsSharingDirect(true);
    try {
      const result = await generateInvoiceJpg(completedSaleData);
      recordInvoiceGenerated(completedSaleData);
      if (!canShareInvoiceJpg()) {
        downloadInvoiceJpg(result.blob, result.fileName);
        showToast('File sharing is unavailable here. The JPG invoice was downloaded.', 'info');
        return;
      }
      const shared = await shareInvoiceJpg(
        result.blob,
        result.fileName,
        `${settings.storeName} Invoice ${completedSaleData.invoiceNo}`,
        `Receipt for ${completedSaleData.serviceName} · ${formatCurrency(completedSaleData.amount, completedSaleData.currency)}`
      );
      if (shared === 'shared') {
        showToast('Invoice shared successfully!', 'success');
      } else if (shared === 'cancelled') {
        showToast('Invoice sharing was cancelled.', 'info');
      }
    } catch (err) {
      console.error('Invoice file sharing failed:', err);
      showToast('Unable to share invoice. Please try downloading it instead.', 'error');
    } finally {
      invoiceGenerationLock.current = false;
      setIsSharingDirect(false);
    }
  };

  const handleModalClose = () => {
    if (submissionLock.current) return;
    const hasDraft = Boolean(
      customerId !== (preselectedCustomerId || '')
      || serviceId !== (preselectedServiceId || '')
      || accountId
      || profileId
      || discountValue
      || transactionId.trim()
      || senderNumber.trim()
      || notes.trim()
      || paymentNote.trim()
      || startDate !== getTodayDateString()
      || paymentStatus !== 'paid'
      || (preselectedCustomerId && customerId === preselectedCustomerId)
    );
    if (!completedSaleData && hasDraft) {
      setShowLeaveConfirmation(true);
      return;
    }
    setCompletedSaleData(null);
    setCompletedSubscription(null);
    onClose();
  };

  const handleViewCompletedSale = () => {
    if (!completedSaleData?.saleId) return;
    const saleId = completedSaleData.saleId;
    handleModalClose();
    onViewSale?.(saleId);
  };

  const handleCreateAnotherSale = () => {
    saleOperationId.current = createRecordId('new-sale-operation');
    setCompletedSaleData(null);
    setCompletedSubscription(null);
    setTransactionId('');
    setSenderNumber('');
    setNotes('');
    setDiscountMode('fixed');
    setDiscountValue(0);
    setAmountPaidInput('');
    setPaymentStatus('paid');
    setStep(0);
    setShowCustomerPicker(!customerId);
  };

  const handleContinue = () => {
    setStepError('');
    if (step === 0 && !selectedCustomer) {
      reportValidationError('Select a customer before continuing.');
      return;
    }
    if (step === 1 && (!selectedService || selectedService.status !== 'active' || selectedService.isArchived)) {
      reportValidationError('Choose an active service before continuing.');
      return;
    }
    if (step === 1 && !selectedService?.planDetails?.some(item => item.id === planId && item.status === 'active')) {
      reportValidationError('Choose an active plan before continuing.');
      return;
    }
    if (step === 1 && selectedPlan && (Number(durationDays) !== selectedPlan.durationDays || Number(price) !== selectedPlan.price || currency !== selectedPlan.currency)) {
      reportValidationError('Price and duration must match the selected plan.');
      return;
    }
    if (step === 2 && accountId && !availableProfiles.some(profile => profile.id === profileId)) {
      reportValidationError('Choose an available profile, or switch to manual fulfillment.');
      return;
    }
    if (step === 2 && serviceUsesAccounts && !accountId) {
      reportValidationError('Select an account for this service.');
      return;
    }
    if (step === 2 && profileRequired && !profileId) {
      reportValidationError('Select an available profile for this service.');
      return;
    }
    if (step === 2 && (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1 || calculatedExpiryDate <= startDate)) {
      reportValidationError('Enter a valid start date and duration.');
      return;
    }
    if (step === 2 && (!Number.isFinite(subtotal) || subtotal <= 0 || discountValue < 0 || (discountMode === 'fixed' && discountValue > subtotal) || (discountMode === 'percentage' && discountValue > 100) || totalAmount <= 0)) {
      reportValidationError('Enter a valid price and discount.');
      return;
    }
    if (step === 3 && paymentStatus === 'partial' && !(amountPaid > 0 && amountPaid < totalAmount)) {
      reportValidationError('Partial payment must be greater than zero and less than the total.');
      return;
    }
    if (step === 3 && (totalAmount <= 0 || amountPaid > totalAmount || !paymentMethods.includes(paymentMethod))) {
      reportValidationError('Check the sale total and amount paid before continuing.');
      return;
    }
    if (step === 3 && paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) && !transactionId.trim()) {
      reportValidationError('Enter the required transaction ID.');
      return;
    }
    if (step === 3 && paymentStatus === 'paid' && amountPaid !== totalAmount) {
      reportValidationError('Paid amount must equal the total.');
      return;
    }
    setStep(current => Math.min(current + 1, 4));
  };

  const handleChooseCustomer = (id: string) => {
    setCustomerId(id);
    setShowCustomerPicker(false);
    setCustomerSearch('');
  };

  const handleSendRenewalInstructions = () => {
    if (!completedSubscription) return;
    const customerId = completedSubscription.customerId;
    if (!canContact(customerId)) {
      showToast('Unable to open renewal instructions. Check that this customer has a valid phone number.', 'error');
      return;
    }
    const completedSale = sales.find(sale => sale.id === completedSaleData?.saleId);
    openMessage({
      customerId,
      subscriptionId: completedSubscription.id,
      saleId: completedSaleData?.saleId,
      invoiceId: completedSaleData?.invoiceId,
      templateId: completedSale?.renewalOfSubscriptionId ? 'renewal_completed' : 'subscription_activated',
    });
  };

  const handleOpenInvoiceWhatsApp = () => {
    if (!completedSaleData) return;
    if (!completedSaleData.customerId || !canContact(completedSaleData.customerId)) {
      showToast('Unable to open WhatsApp. Check the customer phone number and browser pop-up settings.', 'error');
      return;
    }
    openMessage({
      customerId: completedSaleData.customerId,
      saleId: completedSaleData.saleId,
      invoiceId: completedSaleData.invoiceId,
      templateId: 'invoice_ready',
    });
  };

  const recordInvoiceGenerated = (invoice: InvoiceSaleDetails) => {
    if (!invoice.saleId) return;
    logActivity({
      type: 'invoice_generated',
      title: 'Invoice Generated',
      description: `Invoice ${invoice.invoiceNo} generated for ${invoice.customerName} · ${invoice.serviceName}.`,
      customerName: invoice.customerName,
      serviceName: invoice.serviceName,
      entityId: invoice.saleId,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNo,
      saleId: invoice.saleId,
      customerId: invoice.customerId,
      amount: invoice.amount,
      currency: invoice.currency,
    });
  };

  const handleViewSubscription = () => {
    if (!completedSubscription || !onViewSubscription) return;
    onViewSubscription(completedSubscription.id);
    handleModalClose();
  };

  const paymentMethodConfigs = useMemo(() => normalizePaymentMethods(settings.paymentPreferences?.methods), [settings.paymentPreferences?.methods]);
  const paymentMethods: PaymentMethod[] = paymentMethodConfigs.filter(method => method.enabled).map(method => method.name as PaymentMethod);
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.includes(paymentMethod)) {
      setPaymentMethod(getDefaultPaymentMethod(paymentMethodConfigs, settings.paymentPreferences?.defaultMethodId) as PaymentMethod);
    }
  }, [paymentMethods, paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.defaultMethodId]);
  const steps = [
    { label: 'Customer', icon: UserRound },
    { label: 'Service & Plan', icon: Layers },
    { label: 'Account & Profile', icon: CalendarDays },
    { label: 'Payment', icon: CreditCard },
    { label: 'Review', icon: Receipt },
  ];
  const orderSummary = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order Summary</h3>
        <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedService?.name || 'Choose a service'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{plan || 'Choose a plan'}</p>
        </div>
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Customer</span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-200">{selectedCustomer?.name || 'Not selected'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Duration</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{Number(durationDays) || 0} days</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Account / Profile</span>
            <span className="max-w-[155px] truncate text-right font-medium text-slate-800 dark:text-slate-200">
              {selectedAccount ? `${selectedAccount.email}${selectedProfile ? ` · ${selectedProfile.profileName}` : ''}` : 'Manual fulfillment'}
            </span>
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Total</span>
          <span className="font-mono text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totalAmount, currency)}
          </span>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Price and duration start from the existing service defaults; review before confirming.
      </p>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title={
          completedSaleData
            ? language === 'bn'
              ? 'বিক্রয় সফল ও ডিজিটাল ইনভয়েস'
              : 'Sale Completed Successfully'
            : language === 'bn'
            ? 'নতুন সাবস্ক্রিপশন বিক্রয় ও অ্যাক্টিভেশন'
            : 'New Sale'
        }
        subtitle={
          completedSaleData
            ? language === 'bn'
              ? 'সাবস্ক্রিপশন সক্রিয় হয়েছে। নিচে JPG রসিদ ডাউনলোড বা শেয়ার করুন।'
              : 'Subscription activated. Your customer-ready JPG receipt is available below.'
            : language === 'bn'
            ? 'কাস্টমার, সার্ভিস, অ্যাকাউন্ট ও প্রোফাইল নির্বাচন করে সরাসরি বিক্রয় রেকর্ড করুন।'
            : 'A guided transaction workspace for customer, service, fulfillment, payment, and invoice.'
        }
        maxWidth="4xl"
      >
        {/* AFTER SALE FLOW: SUCCESS & INVOICE SCREEN */}
        {completedSaleData ? (
          <div className="space-y-5 py-2">
            {/* Success Banner */}
            <div className="text-center p-6 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
              <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/25">
                <Check className="w-8 h-8 stroke-[2.8]" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {language === 'bn' ? 'বিক্রয় সফলভাবে সম্পন্ন হয়েছে!' : 'Sale Completed Successfully!'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
                {language === 'bn'
                  ? `ইনভয়েস নং ${completedSaleData.invoiceNo} এর বিপরীতে সাবস্ক্রিপশন সক্রিয় করা হয়েছে।`
                  : `Subscription activated · Invoice ${completedSaleData.invoiceNo}`}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Invoice Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {completedSaleData.invoiceNo}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {completedSaleData.customerName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Service & Plan</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {completedSaleData.serviceName} · {completedSaleData.planName}
                </span>
              </div>

              {(completedSaleData.profileName || completedSaleData.allocation) && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Account / Profile</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {completedSaleData.profileName
                      ? `Profile: ${completedSaleData.profileName}`
                      : completedSaleData.allocation}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Duration & Validity</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                {completedSaleData.durationLabel || (completedSaleData.durationDays ? `${completedSaleData.durationDays} Days` : 'Duration unavailable')} ({completedSaleData.startDate ? formatAppDate(completedSaleData.startDate, language) : '—'} to {completedSaleData.expiryDate ? formatAppDate(completedSaleData.expiryDate, language) : '—'})
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total · Paid · Due</span>
                <span className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(completedSaleData.amount, completedSaleData.currency)} · {formatCurrency(completedSaleData.amountPaid ?? completedSaleData.amount, completedSaleData.currency)} · {formatCurrency(completedSaleData.amountDue ?? 0, completedSaleData.currency)}
                </span>
              </div>
            </div>

            {/* Invoice Action Options */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs">Customer Invoice Options</span>
              </div>
              <p className="text-[11px] text-slate-500">
                View, download, or share a compact 900 × 1200 JPG receipt.
              </p>

              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setIsInvoicePreviewOpen(true)}
                  disabled={isDownloadingDirect || isSharingDirect}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Preview the generated JPG invoice"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectDownload}
                  disabled={isDownloadingDirect || isSharingDirect}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Generate and download compact JPG"
                >
                  {isDownloadingDirect ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isDownloadingDirect ? 'Generating…' : 'Download Invoice JPG'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectShare}
                  disabled={isSharingDirect || isDownloadingDirect}
                  className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Share this JPG where supported, or download it"
                >
                  {isSharingDirect ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>{isSharingDirect ? 'Preparing…' : 'Share Invoice'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleOpenInvoiceWhatsApp}
                disabled={!completedSaleData.customerPhone}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <MessageCircle className="h-4 w-4" />
                Open WhatsApp
              </button>
              <button
                type="button"
                onClick={handleSendRenewalInstructions}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
              >
                <Share2 className="h-4 w-4" />
                Send renewal instructions
              </button>
              <button
                type="button"
                onClick={handleViewSubscription}
                disabled={!onViewSubscription}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Receipt className="h-4 w-4" />
                View subscription
              </button>
              <button
                type="button"
                onClick={() => completedSubscription && onViewCustomer?.(completedSubscription.customerId)}
                disabled={!completedSubscription || !onViewCustomer}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <UserRound className="h-4 w-4" />
                View customer
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleCreateAnotherSale}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                + Create Another Sale
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleViewCompletedSale}
                  disabled={!completedSaleData.saleId || !onViewSale}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Sale
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD NEW SALE FORM */
          <form
            onSubmit={handleSaveSale}
            onKeyDown={event => {
              if (
                event.key === 'Enter' &&
                !event.defaultPrevented &&
                event.target instanceof HTMLElement &&
                !['BUTTON', 'TEXTAREA'].includes(event.target.tagName)
              ) {
                event.preventDefault();
              }
            }}
            className="space-y-4"
          >
            <ol aria-label="Sale progress" className="flex items-center gap-1 sm:gap-2">
              {steps.map((item, index) => {
                const Icon = item.icon;
                const isCurrent = step === index;
                const isComplete = step > index;
                return (
                  <li key={item.label} className="flex min-w-0 flex-1 items-center">
                    <button type="button" onClick={() => index < step && setStep(index)} disabled={index > step} aria-current={isCurrent ? 'step' : undefined} className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-2 text-left text-[11px] font-semibold sm:gap-2 sm:px-2.5 sm:text-xs ${isCurrent ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : isComplete ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCurrent || isComplete ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>
                      <span className="hidden truncate sm:inline">{item.label}</span>
                    </button>
                    {index < steps.length - 1 && <span className="mx-0.5 h-px min-w-1 flex-1 bg-slate-200 dark:bg-slate-700" />}
                  </li>
                );
              })}
            </ol>

            {stepError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{stepError}</p>}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-4">
                {step === 0 && (
                  <section aria-labelledby="sale-customer-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h2 id="sale-customer-title" className="text-base font-bold text-slate-900 dark:text-white">Choose a customer</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Search by name, phone, or email. The sale is linked to the selected customer record.</p></div>
                      <button type="button" onClick={() => setIsCreatingCustomer(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"><Plus className="h-3.5 w-3.5" />{isCreatingCustomer ? 'Choose existing' : 'Add customer'}</button>
                    </div>
                    {selectedCustomer && !showCustomerPicker && !isCreatingCustomer ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                        <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300"><Check className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">{selectedCustomer.phone || selectedCustomer.whatsapp || 'No phone'}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{selectedCustomer.email || 'No email'}</p></div></div>
                        <button type="button" onClick={() => setShowCustomerPicker(true)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-slate-800">Change Customer</button>
                      </div>
                    ) : isCreatingCustomer ? (
                      <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Customer name *</span><input aria-label="Customer full name" type="text" value={newCustName} onChange={e => setNewCustName(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Phone</span><input aria-label="Customer phone number" type="tel" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>WhatsApp</span><input aria-label="Customer WhatsApp number" type="tel" value={newCustWhatsapp} onChange={e => setNewCustWhatsapp(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Email</span><input aria-label="Customer email address" type="email" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Facebook profile URL</span><input aria-label="Customer Facebook profile URL" type="url" value={newCustFb} onChange={e => setNewCustFb(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                      </div><button type="button" onClick={handleQuickAddCustomer} disabled={isAddingCustomer} className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{isAddingCustomer ? 'Adding customer…' : 'Save & select customer'}</button></div>
                    ) : (
                      <div className="space-y-3">
                        <label className="relative block"><span className="sr-only">Search customers by name, phone, or email</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (filteredCustomers.length === 1) handleChooseCustomer(filteredCustomers[0].id); else if (filteredCustomers.length > 1) showToast('Choose the intended customer from the results.', 'info'); } }} placeholder="Search name, phone, or email" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1" role="listbox" aria-label="Customer search results">
                          {filteredCustomers.length ? filteredCustomers.map(customer => <button key={customer.id} type="button" role="option" aria-selected={customer.id === customerId} onClick={() => handleChooseCustomer(customer.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${customer.id === customerId ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{customer.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{customer.phone || customer.whatsapp || 'Phone unavailable'}{customer.email ? ` · ${customer.email}` : ''}</span></span><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{subscriptions.filter(sub => sub.customerId === customer.id && sub.status !== 'cancelled' && getDaysDifference(sub.expiryDate) >= 0).length} active</span></button>) : <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800">No matching customers. Use Add customer to create a record.</p>}
                        </div>
                        {filteredCustomers.length === 50 && <p className="text-xs text-slate-500">Showing the first 50 matches. Refine your search to find another customer.</p>}
                      </div>
                    )}
                    {selectedCustomer && !showCustomerPicker && !isCreatingCustomer && (
                      <>
                        {customerDueByCurrency.length > 0 && <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Outstanding balance: {customerDueByCurrency.map(([dueCurrency, amount]) => formatCurrency(amount, dueCurrency)).join(' · ')}. This sale will be recorded separately.</span></div>}
                        {selectedService && customerServiceSubscriptions.length > 0 && <div role="status" className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>This customer already has {customerServiceSubscriptions.length} active {selectedService.name} subscription{customerServiceSubscriptions.length === 1 ? '' : 's'}. Confirm whether this is an additional subscription or a renewal.</span></div>}
                      </>
                    )}
                  </section>
                )}

                {step === 1 && (
                  <section aria-labelledby="sale-service-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div><h2 id="sale-service-title" className="text-base font-bold text-slate-900 dark:text-white">Choose a service</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select an active service; plans and default pricing come from its existing record.</p></div>
                    <label className="relative block"><span className="sr-only">Search services</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={serviceSearch} onChange={event => setServiceSearch(event.target.value)} placeholder="Search services..." className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                    {filteredServices.length ? <div className="grid gap-2.5 sm:grid-cols-2">{filteredServices.map(service => {
                      const isSelected = service.id === serviceId;
                      const hasActivePlans = Boolean(service.planDetails?.some(item => item.status === 'active'));
                                      const serviceAccounts = accounts.filter(account =>
                                        account.serviceId === service.id
                                        && !['Inactive', 'Suspended', 'Expired'].includes(account.status)
                                      );
                                      const capacity = serviceAccounts.reduce((count, account) =>
                                        count + account.profiles.filter(profile => profile.status === 'Available').length, 0);
                      const defaultPrice = currency === 'BDT' ? service.defaultPriceBDT ?? service.defaultPrice ?? 0 : service.defaultPriceUSD ?? service.defaultPrice ?? 0;
                      return <button key={service.id} type="button" onClick={() => hasActivePlans && handleServiceChange(service.id)} disabled={!hasActivePlans} aria-pressed={isSelected} title={hasActivePlans ? undefined : 'No active plans; manage this service to add a plan'} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/20 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'}`} style={service.color ? { borderLeftWidth: 3, borderLeftColor: service.color } : undefined}><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-sm font-bold dark:bg-slate-800">{service.logoUrl ? <img src={service.logoUrl} alt="" className="h-6 w-6 object-contain" /> : <span aria-hidden="true">{service.name.trim().charAt(0).toUpperCase() || '?'}</span>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{service.name}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{service.description || service.category} · {service.planDetails?.filter(item => item.status === 'active').length || 0} active plans</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${!hasActivePlans ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : capacity ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : service.settings?.usesAccounts ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{!hasActivePlans ? 'No active plans' : capacity ? `${capacity} available` : service.settings?.usesAccounts ? 'No account' : 'Available'}</span></button>;
                    })}</div> : eligibleServices.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">No services match your search.</p> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>There are no active services available for sale.</p><button type="button" onClick={onAddService} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><Plus className="h-3.5 w-3.5" />Add Service</button></div>}
                    {selectedService && <div className="border-t border-slate-200 pt-4 dark:border-slate-700"><h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Select a plan</h3>{selectedService.planDetails?.some(item => item.status === 'active') ? <div className="grid gap-2 sm:grid-cols-2">{selectedService.planDetails.filter(item => item.status === 'active').map(servicePlan => <button key={servicePlan.id} type="button" onClick={() => handlePlanChange(servicePlan)} aria-pressed={planId === servicePlan.id} className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-emerald-600 ${planId === servicePlan.id ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}><span><span className="block">{servicePlan.name}</span><span className="mt-0.5 block text-xs font-normal text-slate-500">{formatCurrency(servicePlan.price, servicePlan.currency)} · {servicePlan.duration ?? servicePlan.durationDays} {servicePlan.durationUnit || 'Days'}{servicePlan.profileCapacity ? ` · ${servicePlan.profileCapacity} profiles` : ''}</span></span>{planId === servicePlan.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}</button>)}</div> : <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>No active plans are available for this service.</p><button type="button" onClick={onAddService} className="mt-2 font-semibold underline">Manage services and plans</button></div>}</div>}
                  </section>
                )}

                {step === 2 && (
                  <section aria-labelledby="sale-fulfillment-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div><h2 id="sale-fulfillment-title" className="text-base font-bold text-slate-900 dark:text-white">Account and profile</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose active inventory for this service. Account credentials and profile PINs are never displayed.</p></div>
                    {serviceUsesAccounts && <div className="space-y-3">
                      {availableAccounts.length ? <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Account *</span><select value={accountId} onChange={e => handleAccountChange(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Select an account</option>{availableAccounts.map(account => <option key={account.id} value={account.id}>{account.email} · {account.plan} · {account.profiles.filter(profile => profile.status === 'Available' && !profile.assignedCustomerId).length} profiles available</option>)}</select></label> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{profileRequired ? 'No available profiles for this plan.' : 'No available account found.'}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => setIsAddingAccount(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add Account</button>{onViewAccounts && <button type="button" onClick={onViewAccounts} className="inline-flex min-h-9 items-center rounded-lg border border-amber-800 px-3 text-xs font-semibold text-amber-900 dark:text-amber-200">View Accounts</button>}</div></div>}
                      {isAddingAccount && <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium"><span>Account email *</span><input required type="email" value={newAccountEmail} onChange={event => setNewAccountEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium"><span>Password</span><input type="password" value={newAccountPassword} onChange={event => setNewAccountPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        {serviceUsesProfiles && <label className="space-y-1 text-xs font-medium"><span>Profile slots</span><input type="number" min={1} step={1} value={newAccountProfileCount} onChange={event => setNewAccountProfileCount(Number(event.target.value))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>}
                        <button type="button" onClick={handleQuickAddAccount} disabled={isAddingAccount} className="self-end rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isAddingAccount ? 'Adding…' : 'Save & Select Account'}</button>
                      </div>}
                    </div>}
                    {profileRequired && selectedAccount && <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Available Profile *</span><select value={profileId} onChange={e => setProfileId(e.target.value)} disabled={!availableProfiles.length} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">{availableProfiles.length ? 'Choose an available profile' : 'No available profiles for this account'}</option>{availableProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.profileName} · Available</option>)}</select>{!availableProfiles.length && <span className="block text-amber-700 dark:text-amber-300">No available profiles for this plan. {onViewAccounts && <button type="button" onClick={onViewAccounts} className="underline">View Accounts</button>}</span>}</label>}
                    {selectedAccount && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-slate-800/60"><p className="font-semibold text-slate-900 dark:text-white">{selectedAccount.email}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{selectedProfile ? `${selectedProfile.profileName} · Available${selectedProfile.pin ? ' · PIN protected' : ''}` : selectedAccount.profiles?.length ? 'Select an available profile to continue.' : 'Full account allocation; no profile slots are configured.'}</p></div>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Start date</span><input aria-label="Sale start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Expiry date</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{calculatedExpiryDate}</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">{t('price')} · {t('currency')}</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{selectedPlan ? formatCurrency(selectedPlan.price, selectedPlan.currency) : 'Choose an active plan'}</p><span className="block text-[11px] font-normal">Price and currency are set by the selected plan.</span></div>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Duration</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{selectedPlan ? `${selectedPlan.durationDays} days` : 'Choose a plan'}</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Discount</span><div className="flex gap-2"><input aria-label="Discount amount" type="number" min={0} max={discountMode === 'percentage' ? 100 : subtotal} step={currency === 'USD' ? '0.01' : '1'} value={discountValue} onChange={event => setDiscountValue(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><select aria-label="Discount type" value={discountMode} onChange={event => setDiscountMode(event.target.value as 'fixed' | 'percentage')} className="rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="fixed">Fixed</option><option value="percentage">Percent</option></select></div></label>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60"><div className="flex justify-between"><span className="text-slate-500">Plan Price</span><span>{formatCurrency(subtotal || 0, currency)}</span></div><div className="flex justify-between"><span className="text-slate-500">Discount</span><span>−{formatCurrency(discountAmount, currency)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-700"><span>Total</span><span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(totalAmount, currency)}</span></div></div>
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="sale-payment-title" className="space-y-4">
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5"><div><h2 id="sale-payment-title" className="text-base font-bold text-slate-900 dark:text-white">Payment details</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose an enabled method. {settings.paymentPreferences?.requireTransactionId ? 'A transaction ID is required by your payment settings.' : 'A transaction ID is optional.'}</p></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{t('paymentMethod')}</span><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{paymentMethods.length ? paymentMethods.map(method => <option key={method} value={method}>{method === 'Bank' ? 'Bank transfer' : method}</option>) : <option value="">No active payment methods</option>}</select></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Payment Status</span><select value={paymentStatus} onChange={e => { const status = e.target.value as PaymentStatus; setPaymentStatus(status); if (status === 'partial') setAmountPaidInput(String(Math.max(0, Math.round(totalAmount / 2 * 100) / 100))); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Amount Paid</span><input aria-label="Amount paid" type="number" min={0} max={totalAmount} step={currency === 'USD' ? '0.01' : '1'} disabled={paymentStatus !== 'partial'} value={paymentStatus === 'paid' ? totalAmount : paymentStatus === 'partial' ? amountPaidInput : 0} onChange={event => setAmountPaidInput(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-70" /></label>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800/60"><div className="flex justify-between"><span>Total</span><span>{formatCurrency(totalAmount, currency)}</span></div><div className="mt-1 flex justify-between"><span>Paid</span><span>{formatCurrency(amountPaid, currency)}</span></div><div className="mt-1 flex justify-between font-semibold"><span>Due</span><span>{formatCurrency(dueAmount, currency)}</span></div></div>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{t('transactionId')} <span className="font-normal text-slate-400">({paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) ? 'required' : 'optional'})</span></span><input aria-label="Transaction ID" required={paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId)} type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Enter transaction ID" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{t('senderNumber')} <span className="font-normal text-slate-400">(optional)</span></span><input aria-label="Payment sender number" type="tel" value={senderNumber} onChange={e => setSenderNumber(e.target.value)} placeholder="Enter sender number" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Payment note (optional)</span><textarea aria-label="Payment note" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Internal sale notes <span className="font-normal text-slate-400">(optional)</span></span><textarea aria-label="Internal sale notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                      </div>
                    </div>
                  </section>
                )}
                {step === 4 && (
                  <section aria-labelledby="sale-review-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div><h2 id="sale-review-title" className="text-base font-bold text-slate-900 dark:text-white">Review Sale</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Check customer, fulfillment, dates, and payment before creating the sale. Use Edit to return to a step.</p></div>
                    <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60 sm:grid-cols-2">
                      <div><dt className="flex items-center justify-between text-slate-500">Customer <button type="button" onClick={() => setStep(0)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedCustomer?.name || 'Not selected'}{selectedCustomer?.phone ? ` · ${selectedCustomer.phone}` : ''}{selectedCustomer?.email ? ` · ${selectedCustomer.email}` : ''}</dd></div>
                      <div><dt className="flex items-center justify-between text-slate-500">Service <button type="button" onClick={() => setStep(1)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedService?.name || 'Not selected'}</dd></div>
                      <div><dt className="text-slate-500">Plan</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{plan || 'Not selected'}</dd></div>
                      {serviceUsesAccounts && <div><dt className="text-slate-500">Account</dt><dd className="mt-1 break-all font-semibold text-slate-900 dark:text-white">{selectedAccount?.email || 'Not selected'}</dd></div>}
                      {profileRequired && <div><dt className="text-slate-500">Profile</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedProfile?.profileName || 'Not selected'}</dd></div>}
                      <div><dt className="flex items-center justify-between text-slate-500">Start Date <button type="button" onClick={() => setStep(2)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{formatAppDate(startDate, language)}</dd></div>
                      <div><dt className="text-slate-500">End Date</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{formatAppDate(calculatedExpiryDate, language)} · {durationDays} days</dd></div>
                      <div><dt className="flex items-center justify-between text-slate-500">Payment <button type="button" onClick={() => setStep(3)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold capitalize text-slate-900 dark:text-white">{paymentStatus} · {paymentMethod}</dd></div>
                    </dl>
                    <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                      <div className="flex justify-between"><span className="text-slate-500">Plan Price</span><span>{formatCurrency(subtotal, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>−{formatCurrency(discountAmount, currency)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold dark:border-slate-700"><span>Total</span><span>{formatCurrency(totalAmount, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{formatCurrency(amountPaid, currency)}</span></div>
                      <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300"><span>Due</span><span>{formatCurrency(dueAmount, currency)}</span></div>
                    </div>
                  </section>
                )}
              </div>
              <aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-2 lg:block">{orderSummary}</aside>
            </div>
            <details className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 lg:hidden"><summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">Order summary · {formatCurrency(Number(price) || 0, currency)}</summary><div className="pt-3">{orderSummary}</div></details>
            <div className="sticky bottom-[-20px] z-10 -mx-6 flex items-center justify-between gap-3 border-t border-slate-200/90 bg-white/95 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              {step > 0 ? <button type="button" onClick={() => setStep(current => Math.max(current - 1, 0))} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" />Back</button> : <button type="button" onClick={handleModalClose} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800">{t('cancel')}</button>}
              {step < 4 ? <button type="button" onClick={handleContinue} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Continue<ChevronRight className="h-4 w-4" /></button> : <button type="submit" disabled={isSubmitting || !selectedCustomer || !selectedService || !Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > totalAmount || Number(durationDays) < 1} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isSubmitting ? 'Completing Sale…' : `Complete Sale · ${formatCurrency(totalAmount, currency)}`}</button>}
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={showLeaveConfirmation} onClose={() => setShowLeaveConfirmation(false)} title="Discard this sale?" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Your current checkout details have not been saved. Do you want to discard them?</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowLeaveConfirmation(false)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Keep editing</button>
            <button type="button" onClick={() => { setShowLeaveConfirmation(false); setCompletedSaleData(null); setCompletedSubscription(null); onClose(); }} className="min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">Discard sale</button>
          </div>
        </div>
      </Modal>

      {/* Invoice Preview Modal (opens when clicking "Generate Invoice") */}
      {completedSaleData && (
        <InvoicePreviewModal
          isOpen={isInvoicePreviewOpen}
          onClose={() => setIsInvoicePreviewOpen(false)}
          saleData={completedSaleData}
          onViewSale={handleViewCompletedSale}
        />
      )}
    </>
  );
};
