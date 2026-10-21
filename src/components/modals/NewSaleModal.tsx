import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { PaymentMethod, PaymentStatus, AppCurrency, CustomerType, Subscription } from '../../types';
import { getDefaultPaymentMethod, normalizePaymentMethods, paymentMethodRequiresTransactionId } from '../../utils/paymentMethods';
import { calculateExpiryDate, formatAppDate, formatCurrency, getDaysDifferenceForTimeZone, getSubscriptionStatusForTimeZone, getTodayDateString } from '../../utils/dateUtils';
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
  X,
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
import { CustomerNameWithType } from '../common/CustomerNameWithType';
import {
  InvoiceSaleDetails,
  generateInvoiceJpg,
  downloadInvoiceJpg,
  shareInvoiceJpg,
  canShareInvoiceJpg,
} from '../../utils/invoiceGenerator';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import { getAvailableProfiles, isAccountOperational } from '../../utils/resourceManagement';
import { amountToMinorUnits, getSaleDueAmount, minorUnitsToAmount } from '../../utils/saleUtils';
import { createRecordId } from '../../services/localStorageStore';
import type { NewSaleLineItemPayload } from '../../context/AppContext';

interface SaleItemDraft extends NewSaleLineItemPayload {
  currency: AppCurrency;
}

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCustomerId?: string;
  preselectedServiceId?: string;
  preselectedAccountId?: string;
  preselectedProfileId?: string;
  preselectedPlanId?: string;
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
  preselectedAccountId,
  preselectedProfileId,
  preselectedPlanId,
  onViewSubscription,
  onViewCustomer,
  onViewSale,
  onViewAccounts,
  onAddService,
}) => {
  const { formatCurrency, formatDate: formatAppDate, formatDurationDays } = useAppFormatting();
  const { customers, services, accounts, subscriptions, sales, payments, createSale, addCustomer, addAccount, logActivity, settings, currency: globalCurrency, t, language } = useApp();
  const getDaysDifference = getDaysDifferenceForTimeZone(settings.businessProfile?.timeZone);
  const getSubscriptionStatus = getSubscriptionStatusForTimeZone(settings.businessProfile?.timeZone);
  const { showToast } = useToast();
  const { openMessage, canContact } = useWhatsAppCommunication();

  // Quick Customer Creation Toggle
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustType, setNewCustType] = useState<CustomerType>('Customer');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustWhatsapp, setNewCustWhatsapp] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustFb, setNewCustFb] = useState('');

  // Form Fields
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [serviceId, setServiceId] = useState(preselectedServiceId || (services.find(s => s.status === 'active' && !s.isArchived)?.id || ''));
  const [plan, setPlan] = useState('');
  const [planId, setPlanId] = useState(preselectedPlanId || '');
  const [itemAllocations, setItemAllocations] = useState<{ accountId: string; profileId: string }[]>([
    { accountId: '', profileId: '' },
  ]);
  const accountId = itemAllocations[0]?.accountId || '';
  const profileId = itemAllocations[0]?.profileId || '';
  const [startDate, setStartDate] = useState(getTodayDateString(settings.businessProfile?.timeZone));
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
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemDrafts, setItemDrafts] = useState<SaleItemDraft[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    preselectedServiceId ? [preselectedServiceId] : []
  );
  const [isCurrentItemActive, setIsCurrentItemActive] = useState(true);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const selectedServiceQueue = selectedServiceIds;
  const submissionLock = useRef(false);
  const resourcePresetApplied = useRef(false);
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
    if (preselectedServiceId) {
      setServiceId(preselectedServiceId);
      setSelectedServiceIds([preselectedServiceId]);
    }
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
    setIsCurrentItemActive(false);
    setSelectedServiceIds(current => {
      const selectedIds = current;
      return selectedIds.includes(nextServiceId)
        ? selectedIds.filter(id => id !== nextServiceId)
        : [...selectedIds, nextServiceId];
    });
  };

  const handlePlanChange = (selectedPlan: NonNullable<(typeof services)[number]['planDetails']>[number]) => {
    setPlan(selectedPlan.name);
    setPlanId(selectedPlan.id);
    setDurationDays(selectedPlan.durationDays);
    setCurrency(selectedPlan.currency);
    setPrice(selectedPlan.price);
    setItemAllocations([{ accountId: '', profileId: '' }]);
    setIsCurrentItemActive(true);
    if (itemDrafts.length === 0) {
      setDiscountMode('fixed');
      setDiscountValue(0);
      setPaymentStatus('paid');
      setAmountPaidInput('');
    }
  };

  // When account changes, update available profile
  const handleAccountChange = (accId: string, unitIndex = 0) => {
    const acc = accounts.find(a => a.id === accId);
    const reservedByOtherUnits = new Set(itemAllocations.flatMap((allocation, index) =>
      index !== unitIndex && allocation.accountId && allocation.profileId
        ? [`${allocation.accountId}:${allocation.profileId}`]
        : []
    ));
    const availableProfile = profileRequired && acc
      ? getAvailableProfiles([acc], serviceId, planId, undefined, settings.businessProfile?.timeZone)
        .find(pair => !reservedProfileIds.has(`${pair.account.id}:${pair.profile.id}`)
          && !reservedByOtherUnits.has(`${pair.account.id}:${pair.profile.id}`))
        ?.profile
      : undefined;
    setItemAllocations(current => current.map((allocation, index) =>
      index === unitIndex
        ? { accountId: accId, profileId: availableProfile?.id || '' }
        : allocation
    ));
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
  const isPreselectedServiceReady = Boolean(
    preselectedServiceId
    && selectedService?.id === preselectedServiceId
    && eligibleServices.some(service => service.id === preselectedServiceId)
    && selectedPlan
  );
  const filteredServices = useMemo(() => {
    const query = debouncedServiceSearch;
    return eligibleServices.filter(service =>
      !query || [service.name, service.description, service.category]
        .some(value => value?.toLowerCase().includes(query))
    ).slice(0, 50);
  }, [eligibleServices, debouncedServiceSearch]);
  const profileRequired = selectedService?.settings?.usesProfiles === true
    || selectedService?.settings?.profileAssignmentRequired === true;
  const serviceUsesAccounts = selectedService?.settings?.usesAccounts === true || profileRequired;
  const reservedProfileIds = useMemo(() => new Set(itemDrafts.flatMap((item, index) =>
    index === editingItemIndex ? [] :
    (item.units || []).flatMap(unit => unit.accountId && unit.profileId
      ? [`${unit.accountId}:${unit.profileId}`]
      : [])
  )), [itemDrafts, editingItemIndex]);
  const reservedFullAccountIds = useMemo(() => new Set(itemDrafts.flatMap((item, index) =>
    index === editingItemIndex ? [] :
    (item.units || []).flatMap(unit => unit.accountId && !unit.profileId ? [unit.accountId] : [])
  )), [itemDrafts, editingItemIndex]);
  const availableProfilePairs = useMemo(
    () => getAvailableProfiles(accounts, serviceId, planId, undefined, settings.businessProfile?.timeZone).filter(({ account, profile }) =>
      !reservedProfileIds.has(`${account.id}:${profile.id}`)
      && !reservedFullAccountIds.has(account.id)
      && !subscriptions.some(subscription =>
        subscription.accountId === account.id
        && !subscription.profileId
        && ['active', 'expiring_soon'].includes(
          getSubscriptionStatus(subscription, selectedService, settings.reminderNoticeDays)
        )
      )
    ),
    [accounts, serviceId, planId, subscriptions, selectedService, settings.reminderNoticeDays, settings.businessProfile?.timeZone, reservedProfileIds]
  );
  const availableAccounts = useMemo(
    () => accounts.filter(a =>
      a.serviceId === serviceId
      && (!a.planId || a.planId === planId)
      && isAccountOperational(a, settings.businessProfile?.timeZone)
      && a.allowNewAssignment !== false
      && (!profileRequired || availableProfilePairs.some(pair => pair.account.id === a.id))
      && (profileRequired || !reservedFullAccountIds.has(a.id))
      && (profileRequired || ![...reservedProfileIds].some(key => key.startsWith(`${a.id}:`)))
      && (profileRequired || (
        !['Assigned', 'Full'].includes(a.status)
        && !a.profiles.some(profile => profile.status === 'Assigned' || Boolean(profile.assignedCustomerId))
        && !subscriptions.some(subscription =>
          subscription.accountId === a.id
          && ['active', 'expiring_soon'].includes(
            getSubscriptionStatus(subscription, selectedService, settings.reminderNoticeDays)
          )
        )
      ))
    ),
    [accounts, serviceId, planId, profileRequired, availableProfilePairs, reservedFullAccountIds, reservedProfileIds, subscriptions, selectedService, settings.reminderNoticeDays, settings.businessProfile?.timeZone]
  );
  useEffect(() => {
    if (!isOpen) {
      resourcePresetApplied.current = false;
      return;
    }
    if (!preselectedAccountId || resourcePresetApplied.current) return;
    const account = availableAccounts.find(item => item.id === preselectedAccountId);
    if (!account) return;
    const profile = account.profiles.find(item =>
      item.id === preselectedProfileId
      && item.status === 'Available'
      && !item.assignedCustomerId
    );
    if (profileRequired && !profile) return;
    setItemAllocations(current => current.map((allocation, index) => index === 0
      ? { accountId: account.id, profileId: profile?.id || '' }
      : allocation));
    resourcePresetApplied.current = true;
  }, [isOpen, preselectedAccountId, preselectedProfileId, availableAccounts, profileRequired]);
  const activeCustomers = useMemo(
    () => customers.filter(c => !c.isArchived && c.status !== 'archived'),
    [customers]
  );
  const filteredCustomers = useMemo(() => {
    const query = debouncedCustomerSearch;
    const matches = !query ? activeCustomers : activeCustomers.filter(c =>
      [c.name, c.customerType, c.phone, c.whatsapp, c.email].some(value => value?.toLowerCase().includes(query))
    );
    return matches.slice(0, 50);
  }, [activeCustomers, debouncedCustomerSearch]);
  const selectedCustomer = customers.find(c => c.id === customerId && !c.isArchived && c.status !== 'archived');
  const allocationCapacity = profileRequired ? availableProfilePairs.length : availableAccounts.length;
  const allocationRows = Array.from({ length: serviceUsesAccounts ? Math.max(1, itemQuantity) : 1 }, (_, index) =>
    itemAllocations[index] || { accountId: '', profileId: '' }
  );
  const accountsForUnit = (unitIndex: number) => availableAccounts.filter(account =>
    profileRequired
      || !itemAllocations.some((allocation, index) => index !== unitIndex && allocation.accountId === account.id)
  );
  const profilesForUnit = (unitIndex: number, unitAccountId: string) =>
    availableProfilePairs
      .filter(pair => pair.account.id === unitAccountId
        && !itemAllocations.some((allocation, index) =>
          index !== unitIndex
          && allocation.accountId === unitAccountId
          && allocation.profileId === pair.profile.id
        ))
      .map(pair => pair.profile);
  const updateQuantity = (quantity: number) => {
    if (serviceUsesAccounts && Number.isSafeInteger(quantity) && quantity > allocationCapacity) {
      setStepError(`Only ${allocationCapacity} inventory unit${allocationCapacity === 1 ? '' : 's'} are currently available.`);
      return;
    }
    setItemQuantity(quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) return;
    setItemAllocations(current => Array.from(
      { length: quantity },
      (_, index) => current[index] || { accountId: '', profileId: '' }
    ));
  };
  const handleEditSaleItem = (index: number) => {
    const item = itemDrafts[index];
    if (!item) return;
    if (isCurrentItemActive && selectedPlan && selectedService) {
      const currentItem: SaleItemDraft = {
        serviceId,
        serviceNameSnapshot: selectedService.name,
        plan,
        planId,
        quantity: itemQuantity,
        unitPrice: Number(price),
        startDate,
        durationDays: Number(durationDays),
        ...(serviceUsesAccounts ? {
          units: allocationRows.map(allocation => ({
            accountId: allocation.accountId || undefined,
            profileId: allocation.profileId || undefined,
          })),
        } : {}),
        currency,
      };
      setItemDrafts(current => [...current, currentItem]);
      setSelectedServiceIds(current => current.filter(id => id !== serviceId));
      setIsCurrentItemActive(false);
    }
    setEditingItemIndex(index);
    setIsCurrentItemActive(true);
    setServiceId(item.serviceId);
    setPlan(item.plan);
    setPlanId(item.planId || '');
    setItemQuantity(item.quantity);
    setItemAllocations(Array.from(
      { length: item.quantity },
      (_, unitIndex) => ({
        accountId: item.units?.[unitIndex]?.accountId || '',
        profileId: item.units?.[unitIndex]?.profileId || '',
      })
    ));
    setStartDate(item.startDate);
    setDurationDays(item.durationDays);
    setCurrency(item.currency);
    setPrice(item.unitPrice);
    setStep(2);
  };
  const selectedProfile = selectedAccount?.profiles?.find(p => p.id === profileId);
  const currentItemSubtotal = isCurrentItemActive && Number.isSafeInteger(itemQuantity) && itemQuantity > 0
    ? minorUnitsToAmount(amountToMinorUnits(Number(price)) * itemQuantity)
    : 0;
  const subtotal = minorUnitsToAmount(
    itemDrafts.reduce((total, item, index) => total + (index === editingItemIndex
      ? 0
      : amountToMinorUnits(item.unitPrice) * item.quantity), 0)
      + amountToMinorUnits(currentItemSubtotal)
  );
  const subtotalMinor = amountToMinorUnits(subtotal);
  const requestedDiscountMinor = discountMode === 'percentage'
    ? Math.round(subtotalMinor * Math.max(0, Number(discountValue) || 0) / 100)
    : amountToMinorUnits(Math.max(0, Number(discountValue) || 0));
  const discountAmount = minorUnitsToAmount(Math.min(subtotalMinor, requestedDiscountMinor));
  const totalAmount = minorUnitsToAmount(Math.max(0, subtotalMinor - amountToMinorUnits(discountAmount)));
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
    if (profileRequired && (!Number.isInteger(newAccountProfileCount) || newAccountProfileCount < 1)) {
      showToast('Enter at least one profile slot.', 'error');
      return;
    }
    accountCreationLock.current = true;
    setIsAddingAccount(true);
    try {
      const profileCount = profileRequired ? Math.max(1, Math.floor(newAccountProfileCount)) : 0;
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
      setItemAllocations(current => current.map((allocation, index) => index === 0
        ? {
          accountId: added.id,
          profileId: profileRequired
            ? added.profiles.find(profile => profile.status === 'Available')?.id || ''
            : '',
        }
        : allocation));
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
        customerType: newCustType,
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

  const handleAddSaleItem = () => {
    if (!isCurrentItemActive) {
      setStep(1);
      return;
    }
    if (!selectedService || !selectedPlan
      || selectedService.status !== 'active'
      || selectedService.isArchived
      || selectedService.settings?.subscriptionEnabled === false
      || selectedService.advanced?.allowNewSubscriptions === false
      || selectedService.advanced?.showInNewSale === false) {
      reportValidationError('Choose an active service and plan before adding this item.', 1);
      return;
    }
    if (!Number.isSafeInteger(itemQuantity) || itemQuantity < 1) {
      reportValidationError('Item quantity must be a positive whole number.', 3);
      return;
    }
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
      reportValidationError('Sale item price must be greater than zero.', 3);
      return;
    }
    if (serviceUsesAccounts && allocationRows.some(allocation =>
      !allocation.accountId || (profileRequired && !allocation.profileId)
    )) {
      reportValidationError('Select a distinct available account or profile for every item unit.', 3);
      return;
    }
    if (new Set(itemAllocations.filter(allocation => allocation.accountId).map(allocation =>
      profileRequired ? `${allocation.accountId}:${allocation.profileId}` : allocation.accountId
    )).size !== itemAllocations.filter(allocation => allocation.accountId).length) {
      reportValidationError('The same account, profile, or slot cannot be allocated twice in this sale.', 3);
      return;
    }
    if (serviceUsesAccounts && allocationRows.some((allocation, index) =>
      !accountsForUnit(index).some(account => account.id === allocation.accountId)
      || (profileRequired && !profilesForUnit(index, allocation.accountId).some(profile => profile.id === allocation.profileId))
    )) {
      reportValidationError('One or more selected inventory units are no longer available.', 3);
      return;
    }
    if (itemDrafts.some((item, index) => index !== editingItemIndex && item.currency !== currency)) {
      reportValidationError('All items in one sale must use the same currency.', 2);
      return;
    }
    if (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`))
      || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1
      || calculatedExpiryDate <= startDate) {
      reportValidationError('Enter a valid start date and duration.', 3);
      return;
    }

    const unitAllocations = serviceUsesAccounts
      ? allocationRows.map(allocation => ({
        accountId: allocation.accountId,
        ...(allocation.profileId ? { profileId: allocation.profileId } : {}),
      }))
      : undefined;
    const lineItem: SaleItemDraft = {
      serviceId,
      serviceNameSnapshot: selectedService.name,
      plan,
      planId,
      quantity: itemQuantity,
      unitPrice: Number(price),
      startDate,
      durationDays: Number(durationDays),
      ...(unitAllocations ? { units: unitAllocations } : {}),
      currency,
    };
    const wasEditing = editingItemIndex !== null;
    setItemDrafts(current => editingItemIndex === null
      ? [...current, lineItem]
      : current.map((item, index) => index === editingItemIndex ? lineItem : item));
    const remainingServiceIds = selectedServiceQueue.filter(id => wasEditing || id !== serviceId);
    setSelectedServiceIds(remainingServiceIds);
    setEditingItemIndex(null);
    setIsCurrentItemActive(remainingServiceIds.length > 0);
    setServiceId(remainingServiceIds[0] || '');
    setPlan('');
    setPlanId('');
    setItemAllocations([{ accountId: '', profileId: '' }]);
    setItemQuantity(1);
    setStepError('');
    setStep(remainingServiceIds.length > 0 ? 2 : 1);
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
    if (isCurrentItemActive && !serviceId) {
      reportValidationError('Please choose a service.', 1);
      return;
    }
    if (isCurrentItemActive && (
      !selectedService
      || selectedService.status !== 'active'
      || selectedService.isArchived
      || selectedService.settings?.subscriptionEnabled === false
      || selectedService.advanced?.allowNewSubscriptions === false
      || selectedService.advanced?.showInNewSale === false
    )) {
      reportValidationError('This service is no longer available. Choose an active service.', 1);
      return;
    }
    const selectedServicePlan = selectedService.planDetails?.find(item => item.id === planId);
    if (isCurrentItemActive && (!selectedServicePlan || selectedServicePlan.status !== 'active' || selectedServicePlan.name !== plan)) {
      reportValidationError('The selected plan is no longer available. Choose a plan for this service.', 2);
      return;
    }
    if (isCurrentItemActive && selectedServicePlan
      && (Number(durationDays) !== selectedServicePlan.durationDays || Number(price) !== selectedServicePlan.price || currency !== selectedServicePlan.currency)) {
      reportValidationError('Price and duration must match the selected plan. Select the correct active plan.', 2);
      return;
    }
    if (isCurrentItemActive && (!Number.isSafeInteger(itemQuantity) || itemQuantity < 1)) {
      reportValidationError('Item quantity must be a positive whole number.', 3);
      return;
    }
    if (isCurrentItemActive && itemDrafts.some((item, index) => index !== editingItemIndex && item.currency !== currency)) {
      reportValidationError('All items in one sale must use the same currency.', 2);
      return;
    }
    if (isCurrentItemActive && (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1 || calculatedExpiryDate <= startDate)) {
      reportValidationError('Enter a valid start date and duration.', 3);
      return;
    }
    if (isCurrentItemActive && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      reportValidationError('Enter a valid sale price.', 3);
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || discountValue < 0 || (discountMode === 'fixed' && discountValue > subtotal) || (discountMode === 'percentage' && discountValue > 100)) {
      reportValidationError('Enter a valid price and discount.', 3);
      return;
    }
    if (isCurrentItemActive && serviceUsesAccounts && allocationRows.some(allocation =>
      !allocation.accountId || (profileRequired && !allocation.profileId)
    )) {
      reportValidationError('Select a valid allocation for every inventory-backed unit.', 3);
      return;
    }
    if (isCurrentItemActive && serviceUsesAccounts && allocationRows.some((allocation, index) =>
      !accountsForUnit(index).some(account => account.id === allocation.accountId)
      || (profileRequired && !profilesForUnit(index, allocation.accountId).some(profile => profile.id === allocation.profileId))
    )) {
      reportValidationError('An inventory allocation is no longer available. Review each selected account or profile.', 3);
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
      const currentLineItem: SaleItemDraft | undefined = isCurrentItemActive ? {
        serviceId,
        serviceNameSnapshot: selectedService?.name || 'Service unavailable',
        plan,
        planId,
        quantity: itemQuantity,
        unitPrice: Number(price),
        startDate,
        durationDays: Number(durationDays),
        ...(serviceUsesAccounts ? {
          units: allocationRows.map(allocation => ({
            accountId: allocation.accountId || undefined,
            profileId: allocation.profileId || undefined,
          })),
        } : {}),
        currency,
      } : undefined;
      const requestedItems = itemDrafts
        .filter((_, index) => index !== editingItemIndex)
        .concat(currentLineItem ? [currentLineItem] : []);
      if (!requestedItems.length) {
        reportValidationError('Add at least one item before creating the sale.', 1);
        return;
      }
      const primaryItem = requestedItems[0];
      const primaryAllocation = primaryItem.units?.[0];
      const result = createSale({
        customerId,
        serviceId: primaryItem.serviceId,
        plan: primaryItem.plan,
        planId: primaryItem.planId,
        accountId: primaryAllocation?.accountId,
        profileId: primaryAllocation?.profileId,
        startDate: primaryItem.startDate,
        durationDays: primaryItem.durationDays,
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
        ...(requestedItems.length > 1 || requestedItems.some(item => item.quantity > 1) ? {
          lineItems: requestedItems.map(({ currency: _currency, ...item }) => item),
        } : {}),
      });

      const cust = customers.find(c => c.id === customerId);
      const srv = services.find(s => s.id === primaryItem.serviceId);
      const acc = accounts.find(a => a.id === primaryAllocation?.accountId);
      const prof = acc?.profiles?.find(p => p.id === primaryAllocation?.profileId);

      const invoicePayload: InvoiceSaleDetails = {
        ...buildInvoiceSaleDetails(
          result.invoice,
          result.sale,
          cust,
          srv,
          [result.payment],
          settings,
          result.subscription,
          services,
          subscriptions
        ),
        allocation: prof?.profileName
          ? undefined
          : primaryAllocation?.accountId
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
      const result = await generateInvoiceJpg(completedSaleData, language);
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
      const result = await generateInvoiceJpg(completedSaleData, language);
      recordInvoiceGenerated(completedSaleData);
      if (!canShareInvoiceJpg()) {
        downloadInvoiceJpg(result.blob, result.fileName);
        showToast('File sharing is unavailable here. A JPG download was requested.', 'info');
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
      || itemDrafts.length > 0
      || startDate !== getTodayDateString(settings.businessProfile?.timeZone)
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
    setItemQuantity(1);
    setItemDrafts([]);
    setSelectedServiceIds(preselectedServiceId ? [preselectedServiceId] : []);
    setIsCurrentItemActive(true);
    setEditingItemIndex(null);
    setStep(0);
    setShowCustomerPicker(!customerId);
  };

  const handleContinue = () => {
    setStepError('');
    if (step === 0 && !selectedCustomer) {
      reportValidationError('Select a customer before continuing.');
      return;
    }
    if (step === 1) {
      const servicesToConfigure = selectedServiceQueue;
      if (!servicesToConfigure.length && itemDrafts.length) {
        setStep(4);
        return;
      }
      const firstService = eligibleServices.find(service => service.id === servicesToConfigure[0]);
      if (!firstService) {
        reportValidationError('Choose at least one active service before continuing.');
        return;
      }
      const firstServiceRequiresProfiles = firstService.settings?.usesProfiles === true
        || firstService.settings?.profileAssignmentRequired === true;
      const firstServiceTracksInventory = firstService.settings?.usesAccounts === true || firstServiceRequiresProfiles;
      if (firstServiceTracksInventory) {
        const available = firstServiceRequiresProfiles
          ? getAvailableProfiles(accounts, firstService.id, undefined, undefined, settings.businessProfile?.timeZone).length
          : accounts.filter(account =>
            account.serviceId === firstService.id
            && isAccountOperational(account, settings.businessProfile?.timeZone)
            && account.allowNewAssignment !== false
            && !['Assigned', 'Full'].includes(account.status)
          ).length;
        if (!available) {
          reportValidationError('No inventory is available for this service. Choose another service or update inventory.', 1);
          return;
        }
      }
      setServiceId(firstService.id);
      setIsCurrentItemActive(true);
      setStep(2);
      return;
    }
    if (step === 2 && !selectedService?.planDetails?.some(item => item.id === planId && item.status === 'active')) {
      reportValidationError('Choose an active plan before continuing.');
      return;
    }
    if (step === 2 && (!Number.isSafeInteger(itemQuantity) || itemQuantity < 1)) {
      reportValidationError('Quantity must be a positive whole number.', 2);
      return;
    }
    if (step === 2 && serviceUsesAccounts && itemQuantity > allocationCapacity) {
      reportValidationError(`Only ${allocationCapacity} inventory unit${allocationCapacity === 1 ? '' : 's'} are currently available.`, 2);
      return;
    }
    if (step === 2 && selectedPlan && (Number(durationDays) !== selectedPlan.durationDays || Number(price) !== selectedPlan.price || currency !== selectedPlan.currency)) {
      reportValidationError('Price and duration must match the selected plan.');
      return;
    }
    if (step === 3 && isCurrentItemActive && serviceUsesAccounts && allocationRows.some(allocation =>
      !allocation.accountId || (profileRequired && !allocation.profileId)
    )) {
      reportValidationError('Select a distinct account or profile for every item unit.');
      return;
    }
    if (step === 3 && isCurrentItemActive && serviceUsesAccounts && allocationRows.some((allocation, index) =>
      !accountsForUnit(index).some(account => account.id === allocation.accountId)
      || (profileRequired && !profilesForUnit(index, allocation.accountId).some(profile => profile.id === allocation.profileId))
    )) {
      reportValidationError('One or more selected inventory units are no longer available.');
      return;
    }
    if (step === 3 && isCurrentItemActive && (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1 || calculatedExpiryDate <= startDate)) {
      reportValidationError('Enter a valid start date and duration.');
      return;
    }
    if (step === 3 && ((!isCurrentItemActive && itemDrafts.length === 0)
      || (isCurrentItemActive && (!Number.isSafeInteger(itemQuantity) || itemQuantity < 1))
      || !Number.isFinite(subtotal) || subtotal <= 0 || discountValue < 0
      || (discountMode === 'fixed' && discountValue > subtotal)
      || (discountMode === 'percentage' && discountValue > 100) || totalAmount <= 0)) {
      reportValidationError('Enter at least one valid item, price, and discount.');
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
    if (step === 3 && isCurrentItemActive && selectedServiceQueue.some(id => id !== serviceId)) {
      handleAddSaleItem();
      return;
    }
    setStep(current => current === 0 && isPreselectedServiceReady ? 2 : Math.min(current + 1, 4));
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
    { label: 'Service', icon: Layers },
    { label: 'Plan', icon: Layers },
    { label: 'Fulfillment & Payment', icon: CreditCard },
    { label: 'Review', icon: Receipt },
  ];
  const visibleSteps = isPreselectedServiceReady && step !== 1
    ? steps.filter((_, index) => index !== 1)
    : steps;
  const visibleStepIndexes = visibleSteps.map(item => steps.indexOf(item));
  const summaryLineCount = itemDrafts.length - (editingItemIndex === null ? 0 : 1) + (isCurrentItemActive ? 1 : 0);
  const summaryUnitCount = itemDrafts.reduce(
    (total, item, index) => total + (index === editingItemIndex ? 0 : item.quantity),
    0
  ) + (isCurrentItemActive ? itemQuantity : 0);
  const getItemAllocationSummary = (item: SaleItemDraft) => (item.units || []).map(unit => {
    const account = accounts.find(candidate => candidate.id === unit.accountId);
    const profile = account?.profiles.find(candidate => candidate.id === unit.profileId);
    return [account?.email, profile?.profileName].filter(Boolean).join(' · ');
  }).filter(Boolean).join(', ');
  const orderSummary = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order Summary</h3>
        <Receipt className="w-4 h-4 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{summaryLineCount} line{summaryLineCount === 1 ? '' : 's'} · {summaryUnitCount} unit{summaryUnitCount === 1 ? '' : 's'}</p>
          {itemDrafts.map((item, index) => {
            if (index === editingItemIndex) return null;
            const lineSubtotal = minorUnitsToAmount(amountToMinorUnits(item.unitPrice) * item.quantity);
            const allocations = getItemAllocationSummary(item);
            return (
              <div key={`${item.serviceId}-${item.planId}-${index}`} className="min-w-0 border-t border-slate-200 pt-2 dark:border-slate-700">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-xs font-semibold text-slate-900 dark:text-white">
                    {item.serviceNameSnapshot || services.find(service => service.id === item.serviceId)?.name || 'Service'} · {item.plan}
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(lineSubtotal, item.currency)}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {item.quantity} × {formatCurrency(item.unitPrice, item.currency)} · {formatDurationDays(item.durationDays)}
                </p>
                {allocations && <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">Fulfillment: {allocations}</p>}
              </div>
            );
          })}
          {isCurrentItemActive && (
            <div className="min-w-0 border-t border-slate-200 pt-2 dark:border-slate-700">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 break-words text-xs font-semibold text-slate-900 dark:text-white">{selectedService?.name || 'Choose a service'} · {plan || 'Choose a plan'}</p>
                <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(currentItemSubtotal, currency)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {itemQuantity} × {formatCurrency(Number(price) || 0, currency)} · {formatDurationDays(Number(durationDays) || 0)}
              </p>
              {selectedAccount && <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">Fulfillment: {selectedAccount.email}{selectedProfile ? ` · ${selectedProfile.profileName}` : ''}</p>}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">Customer</span>
            <span className="min-w-0 break-words text-right font-medium text-slate-800 dark:text-slate-200">{selectedCustomer?.name || 'Not selected'}</span>
          </div>
        </div>
        <div className="space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
          <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(subtotal, currency)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Sale discount</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">−{formatCurrency(discountAmount, currency)}</span></div>
          <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-700">
            <span className="font-bold text-slate-900 dark:text-white">Grand total</span>
            <span className="whitespace-nowrap font-mono text-lg font-extrabold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(totalAmount, currency)}</span>
          </div>
          {step >= 3 && <>
            <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Initial payment</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(amountPaid, currency)}</span></div>
            <div className="flex justify-between gap-3"><span className="font-semibold text-slate-700 dark:text-slate-300">Outstanding due</span><span className="whitespace-nowrap font-semibold tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(dueAmount, currency)}</span></div>
          </>}
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Sale discount applies to the combined subtotal. Each line retains its selected plan price and duration.
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
              ? completedSaleData.paymentStatus === 'failed' ? 'বিক্রয় রেকর্ড করা হয়েছে' : 'বিক্রয় সফল ও ডিজিটাল ইনভয়েস'
              : completedSaleData.paymentStatus === 'failed' ? 'Sale Recorded' : 'Sale Completed Successfully'
            : language === 'bn'
            ? 'নতুন সাবস্ক্রিপশন বিক্রয় ও অ্যাক্টিভেশন'
            : 'New Sale'
        }
        subtitle={
          completedSaleData
            ? language === 'bn'
              ? completedSaleData.paymentStatus === 'failed'
                ? 'পেমেন্ট ব্যর্থ হয়েছে; ইনভেন্টরি বরাদ্দ করা হয়নি।'
                : 'সাবস্ক্রিপশন সক্রিয় হয়েছে। নিচে JPG রসিদ ডাউনলোড বা শেয়ার করুন।'
              : completedSaleData.paymentStatus === 'failed'
                ? 'Payment failed. Inventory was not allocated.'
                : 'Subscription activated. Your customer-ready JPG receipt is available below.'
            : language === 'bn'
            ? 'কাস্টমার, সার্ভিস, অ্যাকাউন্ট ও প্রোফাইল নির্বাচন করে সরাসরি বিক্রয় রেকর্ড করুন।'
            : 'Create one customer sale with separate services, plans, and fulfillment details.'
        }
        maxWidth="5xl"
        protectUnsavedChanges={!completedSaleData}
        footer={!completedSaleData ? (
          <nav aria-label="Sale workflow navigation" className="flex items-center justify-between gap-2 sm:gap-3">
            {step > 0 ? <button type="button" onClick={() => {
              const currentIndex = visibleStepIndexes.indexOf(step);
              setStep(visibleStepIndexes[Math.max(currentIndex - 1, 0)]);
            }} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"><ChevronLeft className="h-4 w-4" />Back</button> : <button type="button" onClick={handleModalClose} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3">{t('cancel')}</button>}
            {step < steps.length - 1 ? (
              <button type="button" onClick={handleContinue} disabled={step === 1 && selectedServiceQueue.length === 0 && itemDrafts.length === 0} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:px-4">
                <span className="sm:hidden">Continue</span>
                <span className="hidden sm:inline">{step === 1 ? selectedServiceQueue.length ? `Continue with ${selectedServiceQueue.length} service${selectedServiceQueue.length === 1 ? '' : 's'}` : 'Review items' : 'Continue'}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            ) : (
              <button type="submit" form="new-sale-form" disabled={isSubmitting || !selectedCustomer || (!isCurrentItemActive && itemDrafts.length === 0) || (isCurrentItemActive && (!selectedService || !selectedPlan)) || !Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > totalAmount || (isCurrentItemActive && Number(durationDays) < 1)} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:px-4">
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span className="truncate">{isSubmitting ? 'Completing Sale…' : 'Confirm & Create Sale'}</span>
              </button>
            )}
          </nav>
        ) : undefined}
      >
        {/* AFTER SALE FLOW: SUCCESS & INVOICE SCREEN */}
        {completedSaleData ? (
          <div className="space-y-5 py-2">
            {/* Success Banner */}
            <div className={`text-center p-6 rounded-2xl border shadow-2xs ${completedSaleData.paymentStatus === 'failed' ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60' : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60'}`}>
            <div className={`w-14 h-14 rounded-full text-white flex items-center justify-center mx-auto mb-3 shadow-md ${completedSaleData.paymentStatus === 'failed' ? 'bg-amber-600 shadow-amber-600/25' : 'bg-emerald-600 shadow-emerald-600/25'}`}>
                {completedSaleData.paymentStatus === 'failed'
                  ? <AlertTriangle className="w-7 h-7" />
                  : <Check className="w-8 h-8 stroke-[2.8]" />}
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {language === 'bn'
                ? completedSaleData.paymentStatus === 'failed' ? 'বিক্রয় রেকর্ড করা হয়েছে' : 'বিক্রয় সফলভাবে সম্পন্ন হয়েছে!'
                : completedSaleData.paymentStatus === 'failed' ? 'Sale Recorded · Payment Failed' : 'Sale Completed Successfully!'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
              {language === 'bn'
                ? completedSaleData.paymentStatus === 'failed'
                  ? `ইনভয়েস ${completedSaleData.invoiceNo} তৈরি হয়েছে; কোনো ইনভেন্টরি বরাদ্দ করা হয়নি।`
                  : `ইনভয়েস নং ${completedSaleData.invoiceNo} এর বিপরীতে সাবস্ক্রিপশন সক্রিয় করা হয়েছে।`
                : completedSaleData.paymentStatus === 'failed'
                  ? `Invoice ${completedSaleData.invoiceNo} recorded · no inventory was allocated.`
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

              {completedSaleData.lineItems?.length ? (
                <div className="space-y-2 border-y border-slate-200/70 py-3 dark:border-slate-700">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Items ({completedSaleData.lineItems.length} lines)</p>
                  {completedSaleData.lineItems.map((item, index) => (
                    <div key={`${item.serviceName}-${item.planName}-${index}`} className="flex min-w-0 items-start justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-900/50">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-900 dark:text-white">{item.serviceName} · {item.planName}</p>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)} = {formatCurrency(item.subtotal, item.currency)}</p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {item.durationDays ? `${formatDurationDays(item.durationDays)} · ` : ''}
                          {item.startDate ? formatAppDate(item.startDate, language) : '—'} to {item.expiryDate ? formatAppDate(item.expiryDate, language) : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Service & Plan</span>
                    <span className="text-right font-semibold text-slate-900 dark:text-white">{completedSaleData.serviceName} · {completedSaleData.planName}</span>
                  </div>
                  {(completedSaleData.profileName || completedSaleData.allocation) && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Account / Profile</span>
                      <span className="text-right font-medium text-slate-700 dark:text-slate-300">
                        {completedSaleData.profileName ? `Profile: ${completedSaleData.profileName}` : completedSaleData.allocation}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Duration & Validity</span>
                    <span className="text-right font-medium text-slate-700 dark:text-slate-300">
                      {completedSaleData.durationLabel || (completedSaleData.durationDays ? `${completedSaleData.durationDays} Days` : 'Duration unavailable')} ({completedSaleData.startDate ? formatAppDate(completedSaleData.startDate, language) : '—'} to {completedSaleData.expiryDate ? formatAppDate(completedSaleData.expiryDate, language) : '—'})
                    </span>
                  </div>
                </>
              )}

              <div className="grid gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-700 sm:grid-cols-3">
                <div><p className="text-[11px] font-medium text-slate-500">Total</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(completedSaleData.amount, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">Paid</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(completedSaleData.amountPaid ?? completedSaleData.amount, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">Due</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(completedSaleData.amountDue ?? 0, completedSaleData.currency)}</p></div>
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
                  className="px-3.5 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
            id="new-sale-form"
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
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 dark:border-violet-900/60 dark:bg-violet-950/20">
                <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
                  <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">{visibleSteps[visibleStepIndexes.indexOf(step)]?.label || 'Sale'}</span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-violet-700 dark:text-violet-300">Step {visibleStepIndexes.indexOf(step) + 1} of {visibleSteps.length}</span>
                </div>
                <ol aria-label="Sale progress" className="flex min-w-0 items-center gap-1 sm:gap-2">
                  {visibleSteps.map((item, visibleIndex) => {
                    const index = visibleStepIndexes[visibleIndex];
                    const Icon = item.icon;
                    const isCurrent = step === index;
                    const isComplete = index < step;
                    return (
                      <li key={item.label} className="flex min-w-0 flex-1 items-center">
                        <button type="button" onClick={() => index < step && setStep(index)} disabled={index > step} aria-current={isCurrent ? 'step' : undefined} aria-label={`${item.label}${isComplete ? ', completed' : isCurrent ? ', current step' : ', upcoming'}`} className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:gap-2 sm:px-2.5 ${isCurrent ? 'bg-white text-violet-900 shadow-sm ring-1 ring-violet-200 dark:bg-slate-900 dark:text-violet-200 dark:ring-violet-800' : isComplete ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400 dark:text-slate-500'}`}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isCurrent ? 'bg-violet-600 text-white' : isComplete ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>
                          <span className="hidden truncate md:inline">{item.label}</span>
                        </button>
                        {visibleIndex < visibleSteps.length - 1 && <span className={`mx-0.5 h-px min-w-1 flex-1 ${isComplete ? 'bg-violet-300 dark:bg-violet-800' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                      </li>
                    );
                  })}
                </ol>
            </div>

            {stepError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{stepError}</p>}

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-4">
                {step === 0 && (
                  <section aria-labelledby="sale-customer-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h2 id="sale-customer-title" className="text-base font-bold text-slate-900 dark:text-white">Choose a customer</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Search by name, phone, or email. The sale is linked to the selected customer record.</p></div>
                      <button type="button" onClick={() => setIsCreatingCustomer(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-violet-200 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"><Plus className="h-3.5 w-3.5" />{isCreatingCustomer ? 'Choose existing' : 'Add customer'}</button>
                    </div>
                    {selectedCustomer && !showCustomerPicker && !isCreatingCustomer ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                        <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300"><Check className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">WhatsApp: {selectedCustomer.whatsapp || selectedCustomer.phone || 'Not set'}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{selectedCustomer.email || 'No email'}</p></div></div>
                        <button type="button" onClick={() => setShowCustomerPicker(true)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-slate-800">Change Customer</button>
                      </div>
                    ) : isCreatingCustomer ? (
                      <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Customer name *</span><input aria-label="Customer full name" type="text" value={newCustName} onChange={e => setNewCustName(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                       <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Customer type</span><select aria-label="Customer type" value={newCustType} onChange={e => setNewCustType(e.target.value as CustomerType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="Customer">Customer</option><option value="Reseller">Reseller</option></select></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Phone</span><input aria-label="Customer phone number" type="tel" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>WhatsApp</span><input aria-label="Customer WhatsApp number" type="tel" value={newCustWhatsapp} onChange={e => setNewCustWhatsapp(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Email</span><input aria-label="Customer email address" type="email" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Facebook profile URL</span><input aria-label="Customer Facebook profile URL" type="url" value={newCustFb} onChange={e => setNewCustFb(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                      </div><button type="button" onClick={handleQuickAddCustomer} disabled={isAddingCustomer} className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{isAddingCustomer ? 'Adding customer…' : 'Save & select customer'}</button></div>
                    ) : (
                      <div className="space-y-3">
                        <label className="relative block"><span className="sr-only">Search customers by name, phone, or email</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (filteredCustomers.length === 1) handleChooseCustomer(filteredCustomers[0].id); else if (filteredCustomers.length > 1) showToast('Choose the intended customer from the results.', 'info'); } }} placeholder="Search name, phone, or email" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1" role="listbox" aria-label="Customer search results">
                          {filteredCustomers.length ? filteredCustomers.map(customer => <button key={customer.id} type="button" role="option" aria-selected={customer.id === customerId} onClick={() => handleChooseCustomer(customer.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${customer.id === customerId ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'}`}><span className="min-w-0"><CustomerNameWithType customer={customer} nameClassName="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-white" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1" /><span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">WhatsApp: {customer.whatsapp || customer.phone || 'Not set'}{customer.email ? ` · ${customer.email}` : ''}</span></span><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{subscriptions.filter(sub => sub.customerId === customer.id && sub.status !== 'cancelled' && getDaysDifference(sub.expiryDate) >= 0).length} active</span></button>) : <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800">No matching customers. Use Add customer to create a record.</p>}
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
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="sale-service-title" className="text-base font-bold text-slate-900 dark:text-white">Choose services</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select one or more services. Each can have its own plan, quantity, and fulfillment details.</p></div><span className="inline-flex min-h-7 items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 text-[11px] font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{selectedServiceQueue.length} selected</span></div>
                    {itemDrafts.length > 0 && <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Items in this sale ({itemDrafts.length})</h3><span className="text-xs text-slate-600 dark:text-slate-300">Choose another service or review the current items.</span></div>
                      {itemDrafts.map((item, index) => <div key={`${item.serviceId}-${item.planId}-${index}`} className="flex min-w-0 items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-slate-900">
                        <div className="min-w-0"><p className="break-words font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || services.find(candidate => candidate.id === item.serviceId)?.name || 'Service'} · {item.plan}</p><p className="text-slate-600 dark:text-slate-300">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)} = {formatCurrency(minorUnitsToAmount(amountToMinorUnits(item.unitPrice) * item.quantity), item.currency)} · {formatDurationDays(item.durationDays)}</p></div>
                        <div className="flex shrink-0 gap-1"><button type="button" onClick={() => handleEditSaleItem(index)} className="min-h-8 rounded-md px-2 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-slate-800">Edit</button><button type="button" onClick={() => setItemDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.plan} item`} className="min-h-8 rounded-md px-2 font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-slate-800">Remove</button></div>
                      </div>)}
                    </div>}
                    <label className="relative block"><span className="sr-only">Search services</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={serviceSearch} onChange={event => setServiceSearch(event.target.value)} placeholder="Search services..." className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />{serviceSearch && <button type="button" onClick={() => setServiceSearch('')} aria-label="Clear service search" className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-violet-600 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-4 w-4" /></button>}</label>
                    {selectedServiceQueue.length > 0 && <p role="status" className="text-xs font-medium text-slate-600 dark:text-slate-300">Choose any available service below. Selected services stay selected while searching.</p>}
                    {filteredServices.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2.5">{filteredServices.map(service => {
                      const isSelected = selectedServiceQueue.includes(service.id);
                      const hasActivePlans = Boolean(service.planDetails?.some(item => item.status === 'active'));
                      const requiresProfiles = service.settings?.usesProfiles === true
                        || service.settings?.profileAssignmentRequired === true;
                      const tracksInventory = service.settings?.usesAccounts === true || requiresProfiles;
                      const capacity = !tracksInventory
                        ? undefined
                        : requiresProfiles
                          ? getAvailableProfiles(accounts, service.id, undefined, undefined, settings.businessProfile?.timeZone)
                            .filter(({ account, profile }) =>
                              !reservedProfileIds.has(`${account.id}:${profile.id}`)
                              && !reservedFullAccountIds.has(account.id)
                              && !subscriptions.some(subscription =>
                                subscription.accountId === account.id
                                && subscription.profileId === profile.id
                                && ['active', 'expiring_soon'].includes(
                                  getSubscriptionStatus(subscription, service, settings.reminderNoticeDays)
                                )
                              )
                            ).length
                          : accounts.filter(account =>
                            account.serviceId === service.id
                            && isAccountOperational(account, settings.businessProfile?.timeZone)
                            && account.allowNewAssignment !== false
                            && !['Assigned', 'Full'].includes(account.status)
                            && !account.profiles.some(profile => profile.status === 'Assigned' || Boolean(profile.assignedCustomerId))
                            && !reservedFullAccountIds.has(account.id)
                            && ![...reservedProfileIds].some(key => key.startsWith(`${account.id}:`))
                            && !subscriptions.some(subscription =>
                              subscription.accountId === account.id
                              && !subscription.profileId
                              && ['active', 'expiring_soon'].includes(
                                getSubscriptionStatus(subscription, service, settings.reminderNoticeDays)
                              )
                            )
                          ).length;
                      const availabilityLabel = !hasActivePlans
                        ? 'No active plans'
                        : !tracksInventory
                          ? 'No tracked inventory'
                          : capacity
                            ? `${capacity} ${requiresProfiles ? 'profiles' : 'accounts'} available`
                            : `No available ${requiresProfiles ? 'profiles' : 'accounts'}`;
                      return <button key={service.id} type="button" onClick={() => handleServiceChange(service.id)} disabled={!hasActivePlans || (tracksInventory && capacity === 0)} aria-pressed={isSelected} title={!hasActivePlans ? 'No active plans; manage this service to add a plan' : tracksInventory && capacity === 0 ? 'No available inventory for this service' : undefined} className={`grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_1.75rem] items-start gap-x-3 gap-y-2 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? 'border-violet-500 bg-violet-50/70 ring-1 ring-violet-500/20 dark:border-violet-700 dark:bg-violet-950/30' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'}`} style={service.color ? { borderLeftWidth: 3, borderLeftColor: service.color } : undefined}><span className="row-span-2 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-sm font-bold dark:bg-slate-800">{service.logoUrl ? <img src={service.logoUrl} alt="" className="h-6 w-6 object-contain" /> : <span aria-hidden="true">{service.name.trim().charAt(0).toUpperCase() || '?'}</span>}</span><span className="min-w-0"><span className="block break-words text-sm font-semibold text-slate-900 dark:text-white">{service.name}</span><span className="mt-0.5 block break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{service.description || service.category} · {service.planDetails?.filter(item => item.status === 'active').length || 0} active plans</span>{isSelected && <span className="mt-1 block text-[10px] font-semibold text-violet-800 dark:text-violet-300">Selected for this sale</span>}</span><span className="flex h-7 w-7 items-center justify-center">{isSelected && <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-violet-700 dark:text-violet-300" />}</span><span className={`col-start-2 col-span-2 max-w-full justify-self-start rounded-full px-2 py-1 text-[10px] font-semibold leading-4 ${!hasActivePlans ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : tracksInventory && !capacity ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : tracksInventory ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{availabilityLabel}</span></button>;
                    })}</div> : eligibleServices.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">No services match your search.</p> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>There are no active services available for sale.</p><button type="button" onClick={onAddService} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><Plus className="h-3.5 w-3.5" />Add Service</button></div>}
                  </section>
                )}

                {step === 2 && (
                  <section aria-labelledby="sale-plan-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 id="sale-plan-title" className="text-base font-bold text-slate-900 dark:text-white">Configure each service</h2>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose a plan for each selected service. Each configuration becomes a separate line in this one sale.</p>
                        </div>
                        <button type="button" onClick={() => setStep(1)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/40">Change services</button>
                      </div>
                      {(itemDrafts.length > 0 || selectedServiceQueue.length > 0) && (
                        <div className="mt-3 space-y-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Selected items and services</h3>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{itemDrafts.length} configured · {selectedServiceQueue.length} to configure</span>
                          </div>
                          {itemDrafts.map((item, index) => (
                            <div key={`${item.serviceId}-${item.planId}-${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                              <div className="min-w-0">
                                <p className="break-words text-xs font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || services.find(service => service.id === item.serviceId)?.name || 'Service'} · {item.plan}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)} · {formatDurationDays(item.durationDays)}</p>
                              </div>
                              <button type="button" onClick={() => handleEditSaleItem(index)} className="min-h-9 shrink-0 rounded-md px-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/40">Edit item</button>
                            </div>
                          ))}
                          {selectedServiceQueue.map(id => {
                            const queuedService = services.find(service => service.id === id);
                            const isCurrent = id === serviceId;
                            return <div key={id} className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 ${isCurrent ? 'border-violet-300 bg-white dark:border-violet-800 dark:bg-slate-900' : 'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70'}`}>
                              <p className="min-w-0 break-words text-xs font-semibold text-slate-800 dark:text-slate-100">{queuedService?.name || 'Selected service'}</p>
                              <span className={`shrink-0 text-[10px] font-semibold ${isCurrent ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>{isCurrent ? 'Configure now' : 'Up next'}</span>
                            </div>;
                          })}
                        </div>
                      )}
                    </div>
                    {selectedService && <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-800 dark:bg-violet-900/60 dark:text-violet-200">{selectedService.name.trim().charAt(0).toUpperCase() || '?'}</span>
                        <div className="min-w-0"><p className="break-words text-sm font-bold text-slate-900 dark:text-white">{selectedService.name}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">Select one active plan for this line</p></div>
                      </div>
                      {selectedService.planDetails?.some(item => item.status === 'active') ? <div className="grid gap-2 sm:grid-cols-2">{selectedService.planDetails.filter(item => item.status === 'active').map(servicePlan => <button key={servicePlan.id} type="button" onClick={() => handlePlanChange(servicePlan)} aria-pressed={planId === servicePlan.id} className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${planId === servicePlan.id ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500/20 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}><span className="min-w-0"><span className="block break-words font-semibold">{servicePlan.name}</span><span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{formatCurrency(servicePlan.price, servicePlan.currency)} · {formatDurationDays(servicePlan.durationDays)}{servicePlan.profileCapacity ? ` · ${servicePlan.profileCapacity} profiles` : ''}</span></span>{planId === servicePlan.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" />}</button>)}</div> : <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>No active plans are available for this service.</p><button type="button" onClick={onAddService} className="mt-2 font-semibold underline">Manage services and plans</button></div>}
                    </div>}
                    {selectedPlan && <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40 sm:grid-cols-3">
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">{t('price')} per unit</span><p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{formatCurrency(selectedPlan.price, selectedPlan.currency)}</p><span className="block text-[11px] font-normal">Set by the selected plan.</span></div>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Duration</span><p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{formatDurationDays(selectedPlan.durationDays)}</p><span className="block text-[11px] font-normal">This line's subscription duration.</span></div>
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Quantity</span><input aria-label={`${selectedService.name} quantity`} type="number" min={1} max={serviceUsesAccounts ? allocationCapacity : undefined} step={1} value={itemQuantity} onChange={event => updateQuantity(Number(event.target.value))} aria-describedby={`sale-quantity-help-${selectedService.id}`} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><span id={`sale-quantity-help-${selectedService.id}`} className="block text-[11px] font-normal">{serviceUsesAccounts ? `${allocationCapacity} distinct inventory unit${allocationCapacity === 1 ? '' : 's'} available. One account or profile is required per unit.` : 'This service does not require tracked inventory.'}</span></label>
                    </div>}
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="sale-fulfillment-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div><h2 id="sale-fulfillment-title" className="text-base font-bold text-slate-900 dark:text-white">Account and profile</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose active inventory for this service. Account credentials and profile PINs are never displayed.</p></div>
                    {serviceUsesAccounts && <div className="space-y-3">
                      {allocationRows.map((allocation, unitIndex) => {
                        const unitAccounts = accountsForUnit(unitIndex);
                        const unitProfiles = profilesForUnit(unitIndex, allocation.accountId);
                        return <div key={unitIndex} className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 sm:col-span-2">Unit {unitIndex + 1} allocation</p>
                          <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Account *</span><select value={allocation.accountId} onChange={event => handleAccountChange(event.target.value, unitIndex)} disabled={!unitAccounts.length} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">{unitAccounts.length ? 'Select an account' : 'No available account'}</option>{unitAccounts.map(account => <option key={account.id} value={account.id}>{account.email} · {account.plan}{profileRequired ? ` · ${account.profiles.filter(profile => profile.status === 'Available' && !profile.assignedCustomerId).length} profiles` : ' · Full account'}</option>)}</select></label>
                          {profileRequired && <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Profile *</span><select value={allocation.profileId} onChange={event => setItemAllocations(current => current.map((item, index) => index === unitIndex ? { ...item, profileId: event.target.value } : item))} disabled={!unitProfiles.length} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">{unitProfiles.length ? 'Select an available profile' : 'No available profile'}</option>{unitProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.profileName}</option>)}</select></label>}
                          {!unitAccounts.length && <p className="text-xs text-amber-700 dark:text-amber-300 sm:col-span-2">No available inventory for this unit. Add or free an account before continuing.</p>}
                        </div>;
                      })}
                      {!availableAccounts.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{profileRequired ? 'No available profiles for this plan.' : 'No available account found.'}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => setIsAddingAccount(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add Account</button>{onViewAccounts && <button type="button" onClick={onViewAccounts} className="inline-flex min-h-9 items-center rounded-lg border border-amber-800 px-3 text-xs font-semibold text-amber-900 dark:text-amber-200">View Accounts</button>}</div></div>}
                      {isAddingAccount && <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium"><span>Account email *</span><input required type="email" value={newAccountEmail} onChange={event => setNewAccountEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1 text-xs font-medium"><span>Password</span><input type="password" value={newAccountPassword} onChange={event => setNewAccountPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        {profileRequired && <label className="space-y-1 text-xs font-medium"><span>Profile slots</span><input type="number" min={1} step={1} value={newAccountProfileCount} onChange={event => setNewAccountProfileCount(Number(event.target.value))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>}
                        <button type="button" onClick={handleQuickAddAccount} disabled={isAddingAccount} className="self-end rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{isAddingAccount ? 'Adding…' : 'Save & Select Account'}</button>
                      </div>}
                    </div>}
                    {selectedAccount && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-slate-800/60"><p className="font-semibold text-slate-900 dark:text-white">{selectedAccount.email}</p><p className="mt-1 text-slate-500 dark:text-slate-400">{selectedProfile ? `${selectedProfile.profileName} · Available${selectedProfile.pin ? ' · PIN protected' : ''}` : selectedAccount.profiles?.length ? 'Select an available profile to continue.' : 'Full account allocation; no profile slots are configured.'}</p></div>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Start date</span><input aria-label="Sale start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Expiry date</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{calculatedExpiryDate}</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">{t('price')} · {t('currency')}</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{selectedPlan ? formatCurrency(selectedPlan.price, selectedPlan.currency) : 'Choose an active plan'}</p><span className="block text-[11px] font-normal">Price and currency are set by the selected plan.</span></div>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Duration</span><p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">{selectedPlan ? formatDurationDays(selectedPlan.durationDays) : 'Choose a plan'}</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Sale discount</span><div className="flex gap-2"><input aria-label="Discount amount" type="number" min={0} max={discountMode === 'percentage' ? 100 : subtotal} step={currency === 'USD' ? '0.01' : '1'} value={discountValue} onChange={event => setDiscountValue(Number(event.target.value))} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><select aria-label="Discount type" value={discountMode} onChange={event => setDiscountMode(event.target.value as 'fixed' | 'percentage')} className="rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="fixed">Fixed</option><option value="percentage">Percent</option></select></div></label>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60"><div className="flex justify-between"><span className="text-slate-500">Order subtotal</span><span>{formatCurrency(subtotal || 0, currency)}</span></div><div className="flex justify-between"><span className="text-slate-500">Sale discount</span><span>−{formatCurrency(discountAmount, currency)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-700"><span>Grand total</span><span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(totalAmount, currency)}</span></div></div>
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
                    {itemDrafts.length > 0 && <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Items in this sale</h3>
                      {itemDrafts.map((item, index) => index === editingItemIndex ? null : (
                        <div key={`${item.serviceId}-${item.planId}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || services.find(candidate => candidate.id === item.serviceId)?.name || 'Service'} · {item.plan}</p>
                            <p className="text-slate-500 dark:text-slate-400">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)} = {formatCurrency(minorUnitsToAmount(amountToMinorUnits(item.unitPrice) * item.quantity), item.currency)} · {formatAppDate(item.startDate, language)} · {formatDurationDays(item.durationDays)}</p>
                            {getItemAllocationSummary(item) && <p className="mt-0.5 break-words text-slate-500 dark:text-slate-400">Fulfillment: {getItemAllocationSummary(item)}</p>}
                          </div>
                          <div className="flex shrink-0 gap-1"><button type="button" onClick={() => handleEditSaleItem(index)} className="rounded-md px-2 py-1 font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-slate-700">Edit</button><button type="button" onClick={() => setItemDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.plan} item`} className="rounded-md px-2 py-1 font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Remove</button></div>
                        </div>
                      ))}
                    </div>}
                    {isCurrentItemActive && <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{selectedService?.name || 'Service'} · {plan || 'Plan'}</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">{itemQuantity} × {formatCurrency(Number(price) || 0, currency)} = {formatCurrency(currentItemSubtotal, currency)} · {formatAppDate(startDate, language)} · {formatDurationDays(Number(durationDays))}</p>
                      </div>
                    </div>}
                    <button type="button" onClick={handleAddSaleItem} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/50"><Plus className="h-4 w-4" />Add Another Item</button>
                    <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60 sm:grid-cols-2">
                      <div><dt className="flex items-center justify-between text-slate-500">Customer <button type="button" onClick={() => setStep(0)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedCustomer?.name || 'Not selected'} · WhatsApp: {selectedCustomer?.whatsapp || selectedCustomer?.phone || 'Not set'}{selectedCustomer?.email ? ` · ${selectedCustomer.email}` : ''}</dd></div>
                      {isCurrentItemActive && <div><dt className="flex items-center justify-between text-slate-500">Service <button type="button" onClick={() => setStep(1)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedService?.name || 'Not selected'}</dd></div>}
                      {isCurrentItemActive && <div><dt className="text-slate-500">Plan</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{plan || 'Not selected'}</dd></div>}
                      {isCurrentItemActive && serviceUsesAccounts && <div><dt className="text-slate-500">Account</dt><dd className="mt-1 break-all font-semibold text-slate-900 dark:text-white">{selectedAccount?.email || 'Not selected'}</dd></div>}
                      {isCurrentItemActive && profileRequired && <div><dt className="text-slate-500">Profile</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedProfile?.profileName || 'Not selected'}</dd></div>}
                      {isCurrentItemActive && <div><dt className="flex items-center justify-between text-slate-500">Start Date <button type="button" onClick={() => setStep(3)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{formatAppDate(startDate, language)}</dd></div>}
                      {isCurrentItemActive && <div><dt className="text-slate-500">End Date</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-white">{formatAppDate(calculatedExpiryDate, language)} · {formatDurationDays(durationDays)}</dd></div>}
                      <div><dt className="flex items-center justify-between text-slate-500">Payment <button type="button" onClick={() => setStep(3)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold capitalize text-slate-900 dark:text-white">{paymentStatus} · {paymentMethod}</dd></div>
                    </dl>
                    <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                      <div className="flex justify-between"><span className="text-slate-500">Items ({itemDrafts.length - (editingItemIndex === null ? 0 : 1) + (isCurrentItemActive ? 1 : 0)} lines · {itemDrafts.reduce((sum, item, index) => sum + (index === editingItemIndex ? 0 : item.quantity), 0) + (isCurrentItemActive ? itemQuantity : 0)} units)</span><span>{formatCurrency(subtotal, currency)}</span></div>
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
            <details className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 lg:hidden"><summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">Order summary · {formatCurrency(totalAmount, currency)}</summary><div className="pt-3">{orderSummary}</div></details>
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
