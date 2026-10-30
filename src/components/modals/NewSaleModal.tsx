import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { useAppFormatting } from '../../hooks/useAppFormatting';
import { useToast } from '../common/Toast';
import { useWhatsAppCommunication } from '../whatsapp/WhatsAppCommunication';
import { PaymentMethod, AppCurrency, CustomerType, Subscription, OrderSource } from '../../types';
import type { Service } from '../../types';
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
  ChevronDown,
  AlertTriangle,
  LoaderCircle,
  MessageCircle,
} from 'lucide-react';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { CustomerNameWithType } from '../common/CustomerNameWithType';
import {
  InvoiceSaleDetails,
  generateInvoiceImage,
  downloadInvoiceImage,
  shareInvoiceFile,
  canShareInvoiceFile,
} from '../../utils/invoiceGenerator';
import { buildInvoiceSaleDetails } from '../../utils/invoiceUtils';
import {
  filterAndSortServiceSelection,
  getActiveServicePlanCount,
  getServiceSelectionCategories,
  hasServiceCreationDates,
  type ServiceSelectionSort,
} from '../../utils/serviceSelection';
import { getAvailableProfiles, isAccountOperational } from '../../utils/resourceManagement';
import {
  allocateInitialSalePayment,
  allocateMinorUnitsByWeight,
  allocateMinorUnitsInOrder,
  amountToMinorUnits,
  getCustomerAdvanceCredit,
  getSaleDueAmount,
  isValidPaymentLineAllocation,
  minorUnitsToAmount,
  parseAmountToMinorUnits,
} from '../../utils/saleUtils';
import { createRecordId } from '../../services/localStorageStore';
import type { NewSaleLineItemPayload } from '../../context/AppContext';

interface SaleItemDraft extends NewSaleLineItemPayload {
  currency: AppCurrency;
  draftId: string;
}

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCustomerId?: string;
  preselectedServiceId?: string;
  preselectedAccountId?: string;
  preselectedProfileId?: string;
  preselectedPlanId?: string;
  preselectedOrderId?: string;
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
  preselectedOrderId,
  onViewSubscription,
  onViewCustomer,
  onViewSale,
  onViewAccounts,
  onAddService,
}) => {
  const { formatCurrency, formatDate: formatAppDate, formatDurationDays } = useAppFormatting();
  const { currentBusiness, customers, services, accounts, subscriptions, sales, payments, orders, createSale, createOrderQuotation, updateOrderQuotation, addCustomer, addAccount, logActivity, settings, currency: globalCurrency, t, language } = useApp();
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
  const [serviceId, setServiceId] = useState(preselectedServiceId || '');
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
  const [transactionId, setTransactionId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString(settings.businessProfile?.timeZone));
  const [notes, setNotes] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [orderSource, setOrderSource] = useState<OrderSource>('whatsapp');
  const [orderQuotationId, setOrderQuotationId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceSort, setServiceSort] = useState<ServiceSelectionSort>('name');
  const [isServiceSearchOpen, setIsServiceSearchOpen] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(!preselectedCustomerId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountProfileCount, setNewAccountProfileCount] = useState(1);
  const [discountMode, setDiscountMode] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [amountReceivedInput, setAmountReceivedInput] = useState('0');
  const [paymentStatusChoice, setPaymentStatusChoice] = useState<'paid' | 'partial' | 'due'>('due');
  const [applyExistingAdvance, setApplyExistingAdvance] = useState(false);
  const [advanceCreditInput, setAdvanceCreditInput] = useState('0');
  const [itemDiscountInput, setItemDiscountInput] = useState('0');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemDrafts, setItemDrafts] = useState<SaleItemDraft[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    preselectedServiceId ? [preselectedServiceId] : []
  );
  const [isCurrentItemActive, setIsCurrentItemActive] = useState(Boolean(preselectedServiceId));
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const selectedServiceQueue = selectedServiceIds;
  const submissionLock = useRef(false);
  const resourcePresetApplied = useRef(false);
  const saleOperationId = useRef(createRecordId('new-sale-operation'));
  const orderQuotationIdRef = useRef<string | null>(null);
  const currentItemDraftId = useRef(createRecordId('sale-line-draft'));
  const customerCreationLock = useRef(false);
  const accountCreationLock = useRef(false);
  const invoiceGenerationLock = useRef(false);
  const servicePickerRef = useRef<HTMLDivElement>(null);

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
      setIsCurrentItemActive(true);
    }
  }, [preselectedServiceId]);

  const resumedOrderId = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !preselectedOrderId || resumedOrderId.current === preselectedOrderId) return;
    const savedOrder = orders.find(order => order.id === preselectedOrderId);
    if (!savedOrder || ['invoiced', 'cancelled'].includes(savedOrder.status)) return;
    resumedOrderId.current = savedOrder.id;
    orderQuotationIdRef.current = savedOrder.id;
    saleOperationId.current = `order-${savedOrder.id}`;
    setOrderQuotationId(savedOrder.id);
    setOrderSource(savedOrder.source);
    setCustomerId(savedOrder.customerId);
    setShowCustomerPicker(false);
    setCurrency(savedOrder.currency);
    setItemDrafts(savedOrder.items.map((item, index) => ({
      ...item,
      currency: savedOrder.currency,
      draftId: `${savedOrder.id}-line-${index + 1}`,
    })));
    setSelectedServiceIds([]);
    setIsCurrentItemActive(false);
    setEditingItemIndex(null);
    setDiscountMode('fixed');
    const lineDiscount = savedOrder.items.reduce((sum, item) => sum + item.discount, 0);
    setDiscountValue(Math.max(0, savedOrder.discount - lineDiscount));
    setAmountReceivedInput('0');
    setPaymentStatusChoice('due');
    setStep(5);
  }, [isOpen, preselectedOrderId, orders]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim().toLocaleLowerCase()), 180);
    return () => window.clearTimeout(timeout);
  }, [customerSearch]);

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
    const configuredIndex = itemDrafts.findIndex((item, index) =>
      index !== editingItemIndex && item.serviceId === nextServiceId
    );
    const hasCurrentItemSelection = isCurrentItemActive
      && (step !== 1 || editingItemIndex !== null || selectedServiceQueue.includes(serviceId));
    const isCurrentSelection = hasCurrentItemSelection && serviceId === nextServiceId;
    if (isCurrentSelection) {
      setIsCurrentItemActive(false);
      setSelectedServiceIds(current => current.filter(id => id !== nextServiceId));
      setItemDrafts(current => current.filter((_, index) => index !== editingItemIndex));
      setEditingItemIndex(null);
      return;
    }

    if (hasCurrentItemSelection && selectedService) {
      const currentItem: SaleItemDraft = {
        serviceId,
        serviceNameSnapshot: selectedService.name,
        plan,
        planId,
        quantity: itemQuantity,
        unitPrice: Number(price),
        discount: Number(itemDiscountInput) || 0,
        startDate,
        durationDays: Number(durationDays),
        expectedPaymentDate,
        ...(serviceUsesAccounts ? {
          units: allocationRows.map(allocation => ({
            accountId: allocation.accountId || undefined,
            profileId: allocation.profileId || undefined,
          })),
        } : {}),
        currency,
        draftId: editingItemIndex === null
          ? currentItemDraftId.current
          : itemDrafts[editingItemIndex]?.draftId || currentItemDraftId.current,
      };
      setItemDrafts(current => {
        if (editingItemIndex !== null) {
          return current.map((item, index) => index === editingItemIndex ? currentItem : item);
        }
        const existingIndex = current.findIndex(item => item.serviceId === currentItem.serviceId);
        return existingIndex >= 0
          ? current.map((item, index) => index === existingIndex ? currentItem : item)
          : [...current, currentItem];
      });
      setSelectedServiceIds(current => current.filter(id => id !== serviceId));
      setEditingItemIndex(null);
      currentItemDraftId.current = createRecordId('sale-line-draft');
      setIsCurrentItemActive(false);
    } else if (isCurrentItemActive) {
      setIsCurrentItemActive(false);
    }

    if (configuredIndex >= 0) {
      setItemDrafts(current => current.filter((_, index) => index !== configuredIndex));
      setSelectedServiceIds(current => current.filter(id => id !== nextServiceId));
      return;
    }
    setSelectedServiceIds(current => current.includes(nextServiceId)
      ? current.filter(id => id !== nextServiceId)
      : [...current, nextServiceId]);
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
  const selectedServiceIdsForDisplay = [...new Set([
    ...selectedServiceQueue,
    ...itemDrafts.map(item => item.serviceId),
    ...(isCurrentItemActive
      && selectedService
      && (step !== 1 || editingItemIndex !== null || selectedServiceQueue.includes(serviceId))
      ? [selectedService.id]
      : []),
  ])];
  const selectedServiceCount = selectedServiceIdsForDisplay.length;
  const isPreselectedServiceReady = Boolean(
    preselectedServiceId
    && selectedService?.id === preselectedServiceId
    && eligibleServices.some(service => service.id === preselectedServiceId)
    && selectedPlan
  );
  const serviceCategories = useMemo(
    () => getServiceSelectionCategories(eligibleServices),
    [eligibleServices]
  );
  const canSortByRecentlyAdded = useMemo(
    () => hasServiceCreationDates(eligibleServices),
    [eligibleServices]
  );
  const filteredServices = useMemo(
    () => filterAndSortServiceSelection(eligibleServices, serviceSearch, serviceCategory, serviceSort),
    [eligibleServices, serviceSearch, serviceCategory, serviceSort]
  );
  const serviceSearchQuery = serviceSearch.trim();
  const matchingServicesToAdd = filteredServices.filter(service =>
    !selectedServiceIdsForDisplay.includes(service.id)
  );
  const servicesToDisplay = matchingServicesToAdd.slice(0, 50);
  const availableMatchingServiceCount = matchingServicesToAdd.length;
  const hasActiveServiceFilters = Boolean(serviceSearchQuery || serviceCategory || serviceSort !== 'name');
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
        discount: Number(itemDiscountInput) || 0,
        startDate,
        durationDays: Number(durationDays),
        ...(serviceUsesAccounts ? {
          units: allocationRows.map(allocation => ({
            accountId: allocation.accountId || undefined,
            profileId: allocation.profileId || undefined,
          })),
        } : {}),
        currency,
        draftId: currentItemDraftId.current,
      };
      setItemDrafts(current => [...current, currentItem]);
      setSelectedServiceIds(current => current.filter(id => id !== serviceId));
      setIsCurrentItemActive(false);
    }
    setEditingItemIndex(index);
    currentItemDraftId.current = item.draftId;
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
    setExpectedPaymentDate(item.expectedPaymentDate || '');
    setCurrency(item.currency);
    setPrice(item.unitPrice);
    setItemDiscountInput(String(item.discount || 0));
    setStep(2);
  };
  const handleRemoveSaleItem = (index: number) => {
    const item = itemDrafts[index];
    if (!item) return;
    setItemDrafts(current => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedServiceIds(current => current.filter(id => id !== item.serviceId));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setIsCurrentItemActive(false);
      setServiceId('');
      setPlan('');
      setPlanId('');
      setItemQuantity(1);
      setItemDiscountInput('0');
      setExpectedPaymentDate('');
      setStep(1);
    } else if (editingItemIndex !== null && index < editingItemIndex) {
      setEditingItemIndex(current => current === null ? null : current - 1);
    }
  };
  const handleRemoveCurrentService = () => {
    if (editingItemIndex !== null) {
      handleRemoveSaleItem(editingItemIndex);
      return;
    }
    const remainingServiceIds = selectedServiceQueue.filter(id => id !== serviceId);
    setSelectedServiceIds(remainingServiceIds);
    setIsCurrentItemActive(remainingServiceIds.length > 0);
    setServiceId(remainingServiceIds[0] || '');
    setPlan('');
    setPlanId('');
    setItemQuantity(1);
    setItemDiscountInput('0');
    setItemAllocations([{ accountId: '', profileId: '' }]);
    setStartDate(getTodayDateString(settings.businessProfile?.timeZone));
    setExpectedPaymentDate('');
    currentItemDraftId.current = createRecordId('sale-line-draft');
    if (!remainingServiceIds.length) setStep(1);
  };
  const selectedProfile = selectedAccount?.profiles?.find(p => p.id === profileId);
  const currentItemSubtotal = isCurrentItemActive && Number.isSafeInteger(itemQuantity) && itemQuantity > 0
    ? minorUnitsToAmount(amountToMinorUnits(Number(price)) * itemQuantity)
    : 0;
  const parsedCurrentItemDiscount = parseAmountToMinorUnits(itemDiscountInput);
  const currentItemDiscountValid = !isCurrentItemActive
    || (parsedCurrentItemDiscount !== null && parsedCurrentItemDiscount <= amountToMinorUnits(currentItemSubtotal));
  const currentItemDiscount = isCurrentItemActive && parsedCurrentItemDiscount !== null
    ? minorUnitsToAmount(parsedCurrentItemDiscount)
    : 0;
  const subtotal = minorUnitsToAmount(
    itemDrafts.reduce((total, item, index) => total + (index === editingItemIndex
      ? 0
      : amountToMinorUnits(item.unitPrice) * item.quantity), 0)
      + amountToMinorUnits(currentItemSubtotal)
  );
  const subtotalMinor = amountToMinorUnits(subtotal);
  const itemDiscountMinor = itemDrafts.reduce((total, item, index) => total
    + (index === editingItemIndex ? 0 : amountToMinorUnits(item.discount || 0)), 0)
    + (isCurrentItemActive ? amountToMinorUnits(currentItemDiscount) : 0);
  const itemDiscountAmount = minorUnitsToAmount(itemDiscountMinor);
  const globalDiscountableMinor = Math.max(0, subtotalMinor - itemDiscountMinor);
  const requestedDiscountMinor = discountMode === 'percentage'
    ? Math.round(globalDiscountableMinor * Math.max(0, Number(discountValue) || 0) / 100)
    : amountToMinorUnits(Math.max(0, Number(discountValue) || 0));
  const invoiceDiscountAmount = minorUnitsToAmount(Math.min(globalDiscountableMinor, requestedDiscountMinor));
  const discountAmount = minorUnitsToAmount(itemDiscountMinor + amountToMinorUnits(invoiceDiscountAmount));
  const totalAmount = minorUnitsToAmount(Math.max(0, subtotalMinor - amountToMinorUnits(discountAmount)));
  const availableCustomerAdvance = selectedCustomer
    ? getCustomerAdvanceCredit(payments, selectedCustomer.id, currency)
    : 0;
  const parsedAdvanceMinor = parseAmountToMinorUnits(advanceCreditInput);
  const maxAdvanceToApply = Math.min(availableCustomerAdvance, totalAmount);
  const advanceInputValid = !applyExistingAdvance
    || (parsedAdvanceMinor !== null && parsedAdvanceMinor <= amountToMinorUnits(maxAdvanceToApply));
  const advanceCreditToApply = applyExistingAdvance && advanceInputValid && parsedAdvanceMinor !== null
    ? minorUnitsToAmount(parsedAdvanceMinor)
    : 0;
  const paymentLineDrafts: SaleItemDraft[] = itemDrafts.filter((_, index) => index !== editingItemIndex);
  if (isCurrentItemActive && selectedService) {
    paymentLineDrafts.push({
      serviceId: selectedService.id,
      serviceNameSnapshot: selectedService.name,
      planId: selectedPlan?.id || '',
      plan: plan || '',
      quantity: itemQuantity,
      unitPrice: Number(price) || 0,
      discount: currentItemDiscount,
      currency,
      durationDays: Number(durationDays) || 0,
      startDate,
      expectedPaymentDate,
      units: itemAllocations,
      draftId: editingItemIndex === null
        ? currentItemDraftId.current
        : itemDrafts[editingItemIndex]?.draftId || currentItemDraftId.current,
    });
  }
  const updateExpectedPaymentDate = (draftId: string, value: string) => {
    if (isCurrentItemActive && draftId === currentItemDraftId.current) {
      setExpectedPaymentDate(value);
      return;
    }
    setItemDrafts(current => current.map(item => item.draftId === draftId
      ? { ...item, expectedPaymentDate: value || undefined }
      : item
    ));
  };
  const persistCurrentQuotation = (status: 'quotation' | 'confirmed' = 'quotation') => {
    if (!selectedCustomer || !paymentLineDrafts.length) {
      throw new Error('Choose a customer and configure at least one service before saving the quotation.');
    }
    const items = paymentLineDrafts.map(({ currency: _currency, draftId: _draftId, ...item }) => ({
      ...item,
      serviceNameSnapshot: item.serviceNameSnapshot || services.find(service => service.id === item.serviceId)?.name || 'Service',
      discount: item.discount || 0,
      expectedPaymentDate: item.expectedPaymentDate || undefined,
    }));
    const now = new Date().toISOString();
    const existing = orderQuotationIdRef.current
      ? orders.find(order => order.id === orderQuotationIdRef.current)
      : undefined;
    const statusData = status === 'confirmed'
      ? { status, confirmedAt: existing?.confirmedAt || now }
      : {
        status: existing?.status === 'confirmed' ? 'confirmed' as const : 'quotation' as const,
        quotedAt: existing?.quotedAt || now,
      };
    if (existing) {
      const updated = updateOrderQuotation(existing.id, {
        customerId,
        source: orderSource,
        currency,
        items,
        subtotal,
        discount: discountAmount,
        total: totalAmount,
        notes: notes.trim() || undefined,
        ...statusData,
      });
      setOrderQuotationId(updated.id);
      return updated;
    }
    const generatedId = createRecordId('order');
    const id = currentBusiness?.businessId?.startsWith('xvm_demo_')
      ? `xvm_demo_order_${generatedId}`
      : generatedId;
    const reference = `QUO-${id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()}`;
    const order = createOrderQuotation({
      id,
      reference,
      customerId,
      source: orderSource,
      status,
      quotedAt: now,
      ...(status === 'confirmed' ? { confirmedAt: now } : {}),
      currency,
      items,
      subtotal,
      discount: discountAmount,
      total: totalAmount,
      notes: notes.trim() || undefined,
    });
    orderQuotationIdRef.current = order.id;
    saleOperationId.current = `order-${order.id}`;
    setOrderQuotationId(order.id);
    return order;
  };
  const buildQuotationMessage = (reference: string) => {
    const lines = paymentLineDrafts.map(item => {
      const lineTotal = minorUnitsToAmount(
        amountToMinorUnits(item.unitPrice) * item.quantity - amountToMinorUnits(item.discount || 0)
      );
      return `• ${item.serviceNameSnapshot || 'Service'} — ${item.plan}, ${formatDurationDays(item.durationDays)}, ${item.quantity} × ${formatCurrency(item.unitPrice, item.currency)} = ${formatCurrency(lineTotal, item.currency)}`;
    });
    return [
      `Hello ${selectedCustomer?.name || 'there'},`,
      '',
      `Here is your quotation ${reference} from ${settings.storeName}.`,
      ...lines,
      `Subtotal: ${formatCurrency(subtotal, currency)}`,
      `Discounts: -${formatCurrency(discountAmount, currency)}`,
      `Total: ${formatCurrency(totalAmount, currency)}`,
      '',
      'This is a quotation, not an invoice or payment receipt. Please reply to confirm the order.',
      `Thank you, ${settings.storeName}`,
    ].join('\n');
  };
  const handleShareQuotation = () => {
    try {
      const order = persistCurrentQuotation('quotation');
      const opened = openMessage({
        customerId: order.customerId,
        templateId: 'custom_message',
        customMessage: buildQuotationMessage(order.reference),
      });
      if (opened) showToast('Quotation message prepared. WhatsApp does not confirm delivery.', 'info');
    } catch (error) {
      reportValidationError(error instanceof Error ? error.message : 'Unable to prepare the quotation.');
    }
  };
  const handleCopyQuotation = async () => {
    try {
      const order = persistCurrentQuotation('quotation');
      await navigator.clipboard.writeText(buildQuotationMessage(order.reference));
      showToast('Quotation text copied.', 'success');
    } catch (error) {
      console.error('Quotation copy failed.', error);
      showToast('Could not copy the quotation. Check browser clipboard permission.', 'error');
    }
  };
  const paymentLineNetMinor = paymentLineDrafts.map(item =>
    Math.max(0, amountToMinorUnits(item.unitPrice) * item.quantity - amountToMinorUnits(item.discount || 0))
  );
  const invoiceDiscountMinor = amountToMinorUnits(invoiceDiscountAmount);
  const paymentLineNetTotalMinor = paymentLineNetMinor.reduce((total, amount) => total + amount, 0);
  let remainingInvoiceDiscountMinor = invoiceDiscountMinor;
  const paymentLineInvoiceDiscountMinor = paymentLineNetMinor.map((amount, index) => {
    const share = index === paymentLineNetMinor.length - 1
      ? remainingInvoiceDiscountMinor
      : paymentLineNetTotalMinor > 0
        ? Math.min(
          remainingInvoiceDiscountMinor,
          Math.round(invoiceDiscountMinor * amount / paymentLineNetTotalMinor)
        )
        : 0;
    remainingInvoiceDiscountMinor -= share;
    return share;
  });
  const paymentLineTotalsMinor = paymentLineNetMinor.map((amount, index) =>
    Math.max(0, amount - paymentLineInvoiceDiscountMinor[index])
  );
  const parsedAmountReceivedMinor = parseAmountToMinorUnits(amountReceivedInput);
  const amountReceivedValid = parsedAmountReceivedMinor !== null;
  const amountReceivedMinor = parsedAmountReceivedMinor || 0;
  const amountReceived = minorUnitsToAmount(amountReceivedMinor);
  const tenderAllocation = allocateInitialSalePayment(amountReceived, totalAmount, advanceCreditToApply);
  const amountPaid = tenderAllocation.amountPaid;
  const dueAmount = tenderAllocation.amountDue;
  const paymentStatus = totalAmount > 0 && dueAmount === 0
    ? 'paid'
    : amountPaid > 0 ? 'partial' : 'pending';
  const paymentLineCashMinor = allocateMinorUnitsInOrder(
    amountToMinorUnits(tenderAllocation.cashApplied),
    paymentLineTotalsMinor
  );
  const paymentLineAllocationsValid = paymentLineDrafts.length > 0
    && amountReceivedValid
    && advanceInputValid
    && isValidPaymentLineAllocation(
      amountToMinorUnits(tenderAllocation.cashApplied),
      paymentLineTotalsMinor,
      paymentLineCashMinor
    );
  const previewLineCashMinor = paymentLineAllocationsValid
    ? paymentLineCashMinor
    : allocateMinorUnitsInOrder(amountToMinorUnits(tenderAllocation.cashApplied), paymentLineTotalsMinor);
  const advanceLinePaidMinor = allocateMinorUnitsByWeight(
    amountToMinorUnits(tenderAllocation.advanceApplied),
    paymentLineTotalsMinor.map((total, index) => Math.max(0, total - previewLineCashMinor[index]))
  );
  const paymentLinePaidMinor = paymentLineTotalsMinor.map((total, index) =>
    Math.min(total, previewLineCashMinor[index] + advanceLinePaidMinor[index])
  );
  const paymentLineFinancials = paymentLineDrafts.map((item, index) => {
    const totalMinor = paymentLineTotalsMinor[index];
    const paidMinor = paymentLinePaidMinor[index];
    return {
      item,
      total: minorUnitsToAmount(totalMinor),
      paid: minorUnitsToAmount(paidMinor),
      due: minorUnitsToAmount(Math.max(0, totalMinor - paidMinor)),
      status: totalMinor > 0 && paidMinor >= totalMinor
        ? 'paid'
        : paidMinor > 0 ? 'partial' : 'pending',
    };
  });
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
      reportValidationError('Item quantity must be a positive whole number.', 2);
      return;
    }
    if (!currentItemDiscountValid) {
      reportValidationError('Item discount must be a valid amount no greater than this line subtotal.', 3);
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
      reportValidationError('Enter a valid start date and duration.', 2);
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
      discount: currentItemDiscount,
      startDate,
      durationDays: Number(durationDays),
      expectedPaymentDate,
      ...(unitAllocations ? { units: unitAllocations } : {}),
      currency,
      draftId: editingItemIndex === null
        ? currentItemDraftId.current
        : itemDrafts[editingItemIndex]?.draftId || currentItemDraftId.current,
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
    setItemDiscountInput('0');
    setStartDate(getTodayDateString(settings.businessProfile?.timeZone));
    setExpectedPaymentDate('');
    currentItemDraftId.current = createRecordId('sale-line-draft');
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
    const selectedServicePlan = selectedService?.planDetails?.find(item => item.id === planId);
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
      reportValidationError('Item quantity must be a positive whole number.', 2);
      return;
    }
    if (isCurrentItemActive && itemDrafts.some((item, index) => index !== editingItemIndex && item.currency !== currency)) {
      reportValidationError('All items in one sale must use the same currency.', 2);
      return;
    }
    if (isCurrentItemActive && (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1 || calculatedExpiryDate <= startDate)) {
      reportValidationError('Enter a valid start date and duration.', 2);
      return;
    }
    if (isCurrentItemActive && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      reportValidationError('Enter a valid sale price.', 2);
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || discountValue < 0 || (discountMode === 'fixed' && amountToMinorUnits(discountValue) > globalDiscountableMinor) || (discountMode === 'percentage' && discountValue > 100)) {
      reportValidationError('Enter a valid price and discount.', 5);
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

    if (!currentItemDiscountValid || !advanceInputValid || !amountReceivedValid) {
      reportValidationError('Check item discounts, the amount received, and the advance application amount.', 5);
      return;
    }
    if (!paymentLineAllocationsValid) {
      reportValidationError('Service payment allocations must equal the cash applied to this sale and stay within each line total.', 5);
      return;
    }
    if (!Number.isFinite(amountReceived) || amountReceived < 0 || !Number.isFinite(amountPaid) || amountPaid < 0) {
      reportValidationError('Enter a valid amount received.', 5);
      return;
    }
    if (!paymentDate || !Number.isFinite(Date.parse(`${paymentDate}T00:00:00`))
      || paymentDate > getTodayDateString(settings.businessProfile?.timeZone)) {
      reportValidationError('Choose a valid payment date that is not in the future.', 5);
      return;
    }
    if ((settings.paymentPreferences?.methods ?? ['bKash', 'Nagad', 'Rocket', 'Bank', 'Card', 'Cash', 'Other']).length === 0) {
      reportValidationError('Enable at least one payment method in Settings before creating a sale.', 5);
      return;
    }
    if (!paymentMethods.includes(paymentMethod)) {
      reportValidationError('Choose an enabled payment method.', 5);
      return;
    }
    if (amountReceived > 0 && paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) && !transactionId.trim()) {
      reportValidationError('Enter the required transaction ID.', 5);
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
        discount: currentItemDiscount,
        startDate,
        durationDays: Number(durationDays),
        expectedPaymentDate,
        ...(serviceUsesAccounts ? {
          units: allocationRows.map(allocation => ({
            accountId: allocation.accountId || undefined,
            profileId: allocation.profileId || undefined,
          })),
        } : {}),
        currency,
        draftId: currentItemDraftId.current,
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
      if (orderQuotationIdRef.current) {
        updateOrderQuotation(orderQuotationIdRef.current, {
          customerId,
          source: orderSource,
          currency,
          items: requestedItems.map(({ currency: _currency, draftId: _draftId, ...item }) => ({
            ...item,
            serviceNameSnapshot: item.serviceNameSnapshot || services.find(service => service.id === item.serviceId)?.name || 'Service',
            discount: item.discount || 0,
            expectedPaymentDate: item.expectedPaymentDate || undefined,
          })),
          subtotal,
          discount: discountAmount,
          total: totalAmount,
          status: 'confirmed',
          confirmedAt: orders.find(order => order.id === orderQuotationIdRef.current)?.confirmedAt || new Date().toISOString(),
          notes: notes.trim() || undefined,
        });
      }
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
        amountReceived,
        advanceCreditToApply,
        paymentDate,
        currency,
        paymentMethod,
        paymentStatus,
        paymentNote: paymentNote.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        senderNumber: senderNumber.trim() || undefined,
        notes,
        operationId: saleOperationId.current,
        paymentLineAllocations: paymentLineCashMinor.map(minorUnitsToAmount),
        ...(requestedItems.length > 1 || requestedItems.some(item => item.quantity > 1 || (item.discount || 0) > 0 || item.expectedPaymentDate) ? {
          lineItems: requestedItems.map(({ currency: _currency, draftId: _draftId, ...item }) => ({
            ...item,
            expectedPaymentDate: item.expectedPaymentDate || undefined,
          })),
        } : {}),
      });
      if (orderQuotationIdRef.current) {
        try {
          updateOrderQuotation(orderQuotationIdRef.current, {
            status: 'invoiced',
            saleId: result.sale.id,
            invoiceId: result.invoice.invoiceId,
          });
        } catch (error) {
          console.error('Sale was created, but its quotation status could not be updated.', error);
          showToast('Sale and invoice were created, but the quotation status needs attention.', 'error');
        }
      }

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
          result.payments,
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
      const result = await generateInvoiceImage(completedSaleData, language);
      downloadInvoiceImage(result.blob, result.fileName);
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
      const result = await generateInvoiceImage(completedSaleData, language);
      recordInvoiceGenerated(completedSaleData);
      if (!canShareInvoiceFile()) {
        downloadInvoiceImage(result.blob, result.fileName);
        showToast('File sharing is unavailable here. A PNG download was requested.', 'info');
        return;
      }
      const shared = await shareInvoiceFile(
        result.blob,
        result.fileName,
        `${settings.storeName} Invoice ${completedSaleData.invoiceNo}`,
        `Receipt for ${completedSaleData.serviceName} · ${formatCurrency(completedSaleData.amount, completedSaleData.currency)}`
      );
      if (shared === 'shared') {
        showToast('Share sheet opened. Check your selected app to complete sharing; delivery is not confirmed.', 'info');
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
      || amountReceivedInput !== '0'
      || applyExistingAdvance
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
    setAmountReceivedInput('0');
    setPaymentStatusChoice('due');
    setApplyExistingAdvance(false);
    setAdvanceCreditInput('0');
    setPaymentDate(getTodayDateString(settings.businessProfile?.timeZone));
    setExpectedPaymentDate('');
    setOrderSource('whatsapp');
    setOrderQuotationId(null);
    orderQuotationIdRef.current = null;
    resumedOrderId.current = null;
    setPaymentNote('');
    setItemQuantity(1);
    setItemDiscountInput('0');
    setItemDrafts([]);
    currentItemDraftId.current = createRecordId('sale-line-draft');
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
        setStep(5);
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
      if (serviceId !== firstService.id) {
        setPlan('');
        setPlanId('');
        setItemQuantity(1);
        setItemDiscountInput('0');
        setItemAllocations([{ accountId: '', profileId: '' }]);
        setStartDate(getTodayDateString(settings.businessProfile?.timeZone));
        currentItemDraftId.current = createRecordId('sale-line-draft');
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
    if (step === 2 && isCurrentItemActive && (!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || !Number.isSafeInteger(Number(durationDays)) || Number(durationDays) < 1 || calculatedExpiryDate <= startDate)) {
      reportValidationError('Enter a valid start date and duration.', 2);
      return;
    }
    if (step === 2 && !currentItemDiscountValid) {
      reportValidationError('Item discount cannot exceed this service line total.', 2);
      return;
    }
    if (step === 2 && selectedPlan && (Number(durationDays) !== selectedPlan.durationDays || Number(price) !== selectedPlan.price || currency !== selectedPlan.currency)) {
      reportValidationError('Price and duration must match the selected plan.');
      return;
    }
    if (step === 2 && !serviceUsesAccounts) {
      handleAddSaleItem();
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
    if (step === 3) {
      if (!isCurrentItemActive && itemDrafts.length > 0) {
        setStep(1);
        return;
      }
      if (!isCurrentItemActive || !Number.isSafeInteger(itemQuantity) || itemQuantity < 1
        || !Number.isFinite(subtotal) || subtotal <= 0 || discountValue < 0
        || (discountMode === 'fixed' && amountToMinorUnits(discountValue) > globalDiscountableMinor)
        || (discountMode === 'percentage' && discountValue > 100) || totalAmount <= 0) {
        reportValidationError('Add a valid service, price, and discount before continuing.', 2);
        return;
      }
      if (isCurrentItemActive && selectedServiceQueue.some(id => id !== serviceId)) {
        handleAddSaleItem();
        return;
      }
      handleAddSaleItem();
      return;
    }
    if (step === 4) {
      try {
        persistCurrentQuotation('confirmed');
        setStep(5);
      } catch (error) {
        reportValidationError(error instanceof Error ? error.message : 'Unable to confirm this quotation.');
      }
      return;
    }
    if (step === 5 && (totalAmount <= 0 || !amountReceivedValid || !advanceInputValid
      || !paymentLineAllocationsValid
      || !currentItemDiscountValid || !paymentMethods.includes(paymentMethod))) {
      reportValidationError('Check the sale total, payment amount, discounts, and advance application.');
      return;
    }
    if (step === 5 && (!paymentDate || !Number.isFinite(Date.parse(`${paymentDate}T00:00:00`))
      || paymentDate > getTodayDateString(settings.businessProfile?.timeZone))) {
      reportValidationError('Choose a valid payment date that is not in the future.');
      return;
    }
    if (step === 5 && amountReceived > 0 && paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) && !transactionId.trim()) {
      reportValidationError('Enter the required transaction ID.');
      return;
    }
    if (step === 5) return;
    setStep(current => current === 0 && isPreselectedServiceReady ? 2 : Math.min(current + 1, 6));
  };

  const handleChooseCustomer = (id: string) => {
    setCustomerId(id);
    setApplyExistingAdvance(false);
    setAdvanceCreditInput('0');
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
  const visibleSteps = [
    { label: 'Customer', icon: UserRound },
    { label: 'Services & subscriptions', icon: Layers },
    ...(serviceUsesAccounts
      || selectedServiceQueue.some(id => {
        const service = eligibleServices.find(candidate => candidate.id === id);
        return service?.settings?.usesAccounts === true
          || service?.settings?.usesProfiles === true
          || service?.settings?.profileAssignmentRequired === true;
      })
      || itemDrafts.some(item => Boolean(item.units?.length))
      ? [{ label: 'Fulfillment', icon: Layers }]
      : []),
    { label: 'Payment', icon: CreditCard },
  ];
  const hasFulfillmentStep = visibleSteps.some(item => item.label === 'Fulfillment');
  const activeVisibleStep = step === 0 ? 0 : step <= 2 ? 1 : hasFulfillmentStep ? step === 3 ? 2 : 3 : 2;
  const visibleStepInternalIndexes = hasFulfillmentStep ? [0, 1, 3, 5] : [0, 1, 5];
  const summaryPaymentLines = paymentLineFinancials.filter(({ item }) =>
    selectedServiceIdsForDisplay.includes(item.serviceId)
  );
  const summaryConfiguredServiceIds = new Set(summaryPaymentLines.map(({ item }) => item.serviceId));
  const pendingSummaryServices = selectedServiceIdsForDisplay
    .filter(id => !summaryConfiguredServiceIds.has(id))
    .map(id => eligibleServices.find(service => service.id === id))
    .filter((service): service is NonNullable<typeof service> => Boolean(service));
  const summaryLineCount = summaryPaymentLines.length;
  const summaryUnitCount = summaryPaymentLines.reduce((total, { item }) => total + item.quantity, 0);
  const summaryIsComplete = selectedServiceCount > 0 && pendingSummaryServices.length === 0;
  const summarySubtotal = summaryPaymentLines.reduce(
    (total, { item }) => total + amountToMinorUnits(item.unitPrice) * item.quantity,
    0
  );
  const summaryItemDiscount = summaryPaymentLines.reduce(
    (total, { item }) => total + amountToMinorUnits(item.discount || 0),
    0
  );
  const summaryGrandTotal = summaryPaymentLines.reduce(
    (total, { total: lineTotal }) => total + amountToMinorUnits(lineTotal),
    0
  );
  const getItemAllocationSummary = (item: SaleItemDraft) => (item.units || []).map(unit => {
    const account = accounts.find(candidate => candidate.id === unit.accountId);
    const profile = account?.profiles.find(candidate => candidate.id === unit.profileId);
    return [account?.email, profile?.profileName].filter(Boolean).join(' · ');
  }).filter(Boolean).join(', ');
  const orderSummary = (
    <section aria-label="Live order summary" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order Summary</h3>
        <Receipt className="w-4 h-4 text-violet-600 dark:text-violet-400" />
      </div>
      {selectedServiceCount === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"><Layers className="h-5 w-5" /></span>
          <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">No services selected</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">Select a service to see your order summary.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-50/70 px-3 py-2.5 text-xs dark:bg-violet-950/30">
            <span className="font-semibold text-violet-900 dark:text-violet-200">{selectedServiceCount} service{selectedServiceCount === 1 ? '' : 's'} selected</span>
            <span className="text-right text-violet-800 dark:text-violet-300">{summaryLineCount} configured line{summaryLineCount === 1 ? '' : 's'} · {summaryUnitCount} unit{summaryUnitCount === 1 ? '' : 's'}</span>
          </div>
          {step === 5 && summaryPaymentLines.length > 0 && <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {summaryPaymentLines.map(({ item, total }) => (
              <div key={item.draftId} className="flex min-w-0 items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || 'Service'}</p>
                  <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">{item.plan} · {item.quantity} × {formatCurrency(item.unitPrice, item.currency)}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(total, item.currency)}</span>
              </div>
            ))}
          </div>}
          {pendingSummaryServices.length > 0 && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Configure the remaining service{pendingSummaryServices.length === 1 ? '' : 's'} to see the complete order total.</p>}
          {selectedCustomer && <div className="flex min-w-0 justify-between gap-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
            <span className="shrink-0 text-slate-500 dark:text-slate-400">Customer</span>
            <span className="min-w-0 break-words text-right font-medium text-slate-800 dark:text-slate-200">{selectedCustomer.name}</span>
          </div>}
          <div className="space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
            <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">{summaryIsComplete ? 'Subtotal' : 'Configured subtotal'}</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(minorUnitsToAmount(summarySubtotal), currency)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Item discounts</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">−{formatCurrency(minorUnitsToAmount(summaryItemDiscount), currency)}</span></div>
            {summaryIsComplete && <>
              <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Sale discount</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">−{formatCurrency(invoiceDiscountAmount, currency)}</span></div>
              <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white">{step === 5 ? 'Total bill' : 'Grand total'}</span>
                <span className="whitespace-nowrap font-mono text-lg font-extrabold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(minorUnitsToAmount(summaryGrandTotal), currency)}</span>
              </div>
            </>}
            {step >= 5 && summaryIsComplete && <>
              <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">New cash received</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(amountReceived, currency)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Advance payment used</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(tenderAllocation.advanceApplied, currency)}</span></div>
              <div className="flex justify-between gap-3"><span className="font-semibold text-slate-700 dark:text-slate-300">Outstanding due</span><span className="whitespace-nowrap font-semibold tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(dueAmount, currency)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Extra advance payment</span><span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(tenderAllocation.advanceCreditCreated, currency)}</span></div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Payment status</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partly paid' : 'Due'}
                </span>
              </div>
            </>}
          </div>
        </>
      )}
      {selectedServiceCount > 0 && <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Sale discount applies to the combined subtotal. Each service keeps its own plan, dates, quantity, and fulfillment.</p>}
    </section>
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
              : completedSaleData.paymentStatus === 'failed' ? 'Sale Recorded'
                : completedSaleData.paymentStatus === 'paid' ? 'Sale completed · paid in full'
                  : completedSaleData.paymentStatus === 'partial' ? 'Sale created · partial payment' : 'Sale created · unpaid'
            : language === 'bn'
            ? 'নতুন সাবস্ক্রিপশন বিক্রয় ও অ্যাক্টিভেশন'
            : 'New Sale'
        }
        subtitle={
          completedSaleData
            ? language === 'bn'
              ? completedSaleData.paymentStatus === 'failed'
                ? 'পেমেন্ট ব্যর্থ হয়েছে; ইনভেন্টরি বরাদ্দ করা হয়নি।'
                : 'সাবস্ক্রিপশন সক্রিয় হয়েছে। নিচে PNG রসিদ ডাউনলোড বা শেয়ার করুন।'
              : completedSaleData.paymentStatus === 'failed'
                ? 'Payment failed. Inventory was not allocated.'
                : `Invoice ${completedSaleData.invoiceNo} created for ${completedSaleData.customerName}. Your customer-ready PNG invoice is available below.`
            : language === 'bn'
            ? 'কাস্টমার, সার্ভিস, অ্যাকাউন্ট ও প্রোফাইল নির্বাচন করে সরাসরি বিক্রয় রেকর্ড করুন।'
            : 'Create one customer sale with separate services, plans, and fulfillment details.'
        }
        maxWidth="5xl"
        protectUnsavedChanges={!completedSaleData}
        footer={!completedSaleData ? (
        <nav aria-label="Sale workflow navigation" className="flex items-center justify-between gap-2 sm:gap-3">
          {step > 0 ? <button type="button" onClick={() => {
            setStep(step >= 5 ? 1 : step === 4 ? 3 : step === 3 ? 2 : step === 2 ? 1 : 0);
          }} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"><ChevronLeft className="h-4 w-4" />Back</button> : <button type="button" onClick={handleModalClose} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3">{t('cancel')}</button>}
            {step < 5 ? (
              <button key="continue" type="button" onClick={handleContinue} disabled={step === 1 && selectedServiceQueue.length === 0 && itemDrafts.length === 0} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:px-4">
                <span className="sm:hidden">Continue</span>
                <span className="hidden sm:inline">{step === 1 ? selectedServiceQueue.length ? `Continue with ${selectedServiceQueue.length} service${selectedServiceQueue.length === 1 ? '' : 's'}` : 'View order summary' : step === 3 ? 'Save service' : 'Continue'}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            ) : (
              <button key="create-invoice" type="submit" form="new-sale-form" disabled={isSubmitting || !selectedCustomer || (!isCurrentItemActive && itemDrafts.length === 0) || (isCurrentItemActive && (!selectedService || !selectedPlan)) || !Number.isFinite(totalAmount) || totalAmount <= 0 || !amountReceivedValid || !paymentLineAllocationsValid || !advanceInputValid || !currentItemDiscountValid || !paymentDate || (isCurrentItemActive && Number(durationDays) < 1)} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:px-4">
                {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span className="truncate">{isSubmitting ? 'Creating invoice…' : 'Create Invoice'}</span>
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
                : completedSaleData.paymentStatus === 'failed' ? 'Sale Recorded · Payment Failed'
                  : completedSaleData.paymentStatus === 'paid' ? 'Sale paid in full'
                    : completedSaleData.paymentStatus === 'partial' ? 'Sale created · partial payment' : 'Sale created · unpaid'}
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
                        {(item.discount || 0) > 0 && <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">Item discount −{formatCurrency(item.discount || 0, item.currency)} · Line total {formatCurrency(item.total ?? item.subtotal - (item.discount || 0), item.currency)}</p>}
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

              <div className="grid gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-[11px] font-medium text-slate-500">Total</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(completedSaleData.amount, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">New cash received</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(completedSaleData.amountReceived ?? 0, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">Paid toward sale</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(completedSaleData.amountPaid ?? 0, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">Advance payment used</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(completedSaleData.advanceCreditApplied ?? 0, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">Outstanding due</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300">{formatCurrency(completedSaleData.amountDue ?? 0, completedSaleData.currency)}</p></div>
                <div><p className="text-[11px] font-medium text-slate-500">Extra advance payment</p><p className="mt-0.5 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(completedSaleData.advanceCreditCreated ?? 0, completedSaleData.currency)}</p></div>
              </div>
            </div>

            {/* Invoice Action Options */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs">Customer Invoice Options</span>
              </div>
              <p className="text-[11px] text-slate-500">
                View, download, or share the complete invoice as a PNG image.
              </p>

              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setIsInvoicePreviewOpen(true)}
                  disabled={isDownloadingDirect || isSharingDirect}
                  className="px-3.5 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Preview the generated PNG invoice"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectDownload}
                  disabled={isDownloadingDirect || isSharingDirect}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Generate and download the complete invoice PNG"
                >
                  {isDownloadingDirect ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isDownloadingDirect ? 'Generating…' : 'Download Invoice PNG'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectShare}
                  disabled={isSharingDirect || isDownloadingDirect}
                  className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Share this PNG where supported, or download it"
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
                  <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">{visibleSteps[activeVisibleStep]?.label || 'Sale'}</span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-violet-700 dark:text-violet-300">Step {activeVisibleStep + 1} of {visibleSteps.length}</span>
                </div>
                <ol aria-label="Sale progress" className="flex min-w-0 items-center gap-1 sm:gap-2">
                  {visibleSteps.map((item, visibleIndex) => {
                    const Icon = item.icon;
                    const isCurrent = activeVisibleStep === visibleIndex;
                    const isComplete = visibleIndex < activeVisibleStep;
                    return (
                      <li key={item.label} className="flex min-w-0 flex-1 items-center">
                        <button type="button" onClick={() => isComplete && setStep(visibleStepInternalIndexes[visibleIndex])} disabled={visibleIndex > activeVisibleStep} aria-current={isCurrent ? 'step' : undefined} aria-label={`${item.label}${isComplete ? ', completed' : isCurrent ? ', current step' : ', upcoming'}`} className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 sm:gap-2 sm:px-2.5 ${isCurrent ? 'bg-white text-violet-900 shadow-sm ring-1 ring-violet-200 dark:bg-slate-900 dark:text-violet-200 dark:ring-violet-800' : isComplete ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400 dark:text-slate-500'}`}>
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

            <div className={`grid min-w-0 gap-4 ${step === 1 ? 'lg:grid-cols-[minmax(0,2.6fr)_minmax(16rem,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_280px]'}`}>
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
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="sale-service-title" className="text-base font-bold text-slate-900 dark:text-white">Choose Services</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">Select one or more services. Each can have its own plan, quantity, and fulfillment details.</p></div><span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 text-[11px] font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{selectedServiceCount} selected</span></div>
                    {itemDrafts.length > 0 && <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Configured services ({itemDrafts.length})</h3><span className="text-xs text-slate-600 dark:text-slate-300">Choose another service or update an existing configuration.</span></div>
                      {itemDrafts.map((item, index) => <div key={`${item.serviceId}-${item.planId}-${index}`} className="flex min-w-0 items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-slate-900">
                        <div className="min-w-0"><p className="break-words font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || services.find(candidate => candidate.id === item.serviceId)?.name || 'Service'} · {item.plan}</p><p className="text-slate-600 dark:text-slate-300">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)} = {formatCurrency(minorUnitsToAmount(amountToMinorUnits(item.unitPrice) * item.quantity), item.currency)} · {formatDurationDays(item.durationDays)}</p></div>
                        <div className="flex shrink-0 gap-1"><button type="button" onClick={() => handleEditSaleItem(index)} className="min-h-8 rounded-md px-2 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-slate-800">Edit</button><button type="button" onClick={() => setItemDrafts(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.plan} item`} className="min-h-8 rounded-md px-2 font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-slate-800">Remove</button></div>
                      </div>)}
                    </div>}
                    {selectedServiceQueue.length > 0 && <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Selected services ({selectedServiceQueue.length})</h3>
                      {selectedServiceQueue.map(id => {
                        const service = services.find(candidate => candidate.id === id);
                        const activePlanCount = service ? getActiveServicePlanCount(service) : 0;
                        return <div key={id} className="grid min-h-24 min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-violet-300 bg-violet-50/80 p-3 shadow-sm dark:border-violet-800 dark:bg-violet-950/30">
                          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-100 text-sm font-bold text-violet-800 dark:bg-violet-900/70 dark:text-violet-200">
                            <span aria-hidden="true">{service?.name.trim().charAt(0).toUpperCase() || '?'}</span>
                            {service?.logoUrl && <img src={service.logoUrl} alt="" className="absolute inset-0 h-full w-full bg-white object-contain p-1.5 dark:bg-slate-900" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block line-clamp-2 break-words text-sm font-semibold text-slate-900 dark:text-white">{service?.name || 'Selected service'}</span>
                            <span className="mt-1 block line-clamp-2 break-words text-xs leading-4 text-slate-600 dark:text-slate-300">{service?.description || service?.category || 'Service selected for this sale'}</span>
                            <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-slate-900/80 dark:text-violet-200">{activePlanCount} active {activePlanCount === 1 ? 'plan' : 'plans'}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-center gap-1">
                            <span aria-label="Selected" className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-white shadow-sm dark:bg-violet-500"><Check className="h-4 w-4" /></span>
                            <button type="button" onClick={() => handleServiceChange(id)} aria-label={`Remove ${service?.name || 'service'} from selection`} className="min-h-8 rounded-md px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-violet-200">Remove</button>
                          </span>
                        </div>;
                      })}
                    </div>}
                    <div ref={servicePickerRef} className="space-y-2">
                      <label className="group relative block">
                        <span className="sr-only">Search services</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-violet-600" />
                        <input
                          type="text"
                          role="searchbox"
                          value={serviceSearch}
                          onClick={() => setIsServiceSearchOpen(true)}
                          onFocus={() => setIsServiceSearchOpen(true)}
                          onBlur={() => window.setTimeout(() => {
                            if (!servicePickerRef.current?.contains(document.activeElement)) {
                              setIsServiceSearchOpen(false);
                            }
                          }, 0)}
                          onKeyDown={event => { if (event.key === 'Escape') setIsServiceSearchOpen(false); }}
                          onChange={event => { setServiceSearch(event.target.value); setIsServiceSearchOpen(true); }}
                          aria-expanded={isServiceSearchOpen}
                          aria-controls="sale-service-suggestions"
                          placeholder="Search services..."
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-violet-600"
                        />
                        {serviceSearch && <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setServiceSearch(''); setIsServiceSearchOpen(true); }} aria-label="Clear service search" className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-violet-600 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-4 w-4" /></button>}
                      </label>
                      {selectedServiceCount > 0 && !serviceSearchQuery && !isServiceSearchOpen && <p role="status" className="text-xs font-medium text-slate-600 dark:text-slate-300">Click to see all services or type to search.</p>}
                      {isServiceSearchOpen && <div id="sale-service-suggestions" className="max-h-[min(56vh,30rem)] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p role="status" className="text-xs font-semibold text-slate-700 dark:text-slate-200">{filteredServices.length} matching {filteredServices.length === 1 ? 'service' : 'services'} · {availableMatchingServiceCount} available to add</p>
                            {hasActiveServiceFilters && <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">Filters: {[
                              serviceSearchQuery && `“${serviceSearchQuery}”`,
                              serviceCategory,
                              serviceSort === 'plans' ? 'Most plans' : serviceSort === 'recent' ? 'Recently added' : '',
                            ].filter(Boolean).join(' · ')}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <label htmlFor="sale-service-sort" className="sr-only">Sort services</label>
                            <select
                              id="sale-service-sort"
                              value={serviceSort}
                              onChange={event => {
                                const value = event.target.value;
                                if (value === 'name' || value === 'plans' || value === 'recent') {
                                  setServiceSort(value);
                                }
                              }}
                              className="h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            >
                              <option value="name">Name A–Z</option>
                              <option value="plans">Most plans</option>
                              {canSortByRecentlyAdded && <option value="recent">Recently added</option>}
                            </select>
                            {hasActiveServiceFilters && <button
                              type="button"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => { setServiceSearch(''); setServiceCategory(''); setServiceSort('name'); setIsServiceSearchOpen(true); }}
                              className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/40"
                            >Clear filters</button>}
                          </div>
                        </div>
                        <div role="group" aria-label="Filter by service category" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                          {[{ label: 'All Services', value: '', count: eligibleServices.length }, ...serviceCategories.map(category => ({
                            label: category,
                            value: category,
                            count: eligibleServices.filter(service => service.category.trim() === category).length,
                          }))].map(option => {
                            const isSelected = serviceCategory === option.value;
                            return <button
                              key={option.value || 'all'}
                              type="button"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => setServiceCategory(option.value)}
                              aria-pressed={isSelected}
                              className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${isSelected
                                ? 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                              }`}
                            >
                              {option.label}<span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-white/10">{option.count}</span>
                            </button>;
                          })}
                        </div>
                        <div role={servicesToDisplay.length ? 'listbox' : undefined} aria-label={servicesToDisplay.length ? 'Service suggestions' : undefined} className="grid gap-2 sm:grid-cols-2">
                        {servicesToDisplay.length ? servicesToDisplay.map(service => {
                      const hasActivePlans = Boolean(service.planDetails?.some(item => item.status === 'active'));
                      const activePlanCount = getActiveServicePlanCount(service);
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
                      const isDisabled = !hasActivePlans || (tracksInventory && capacity === 0);
                      const availabilityClass = tracksInventory && capacity === 0
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : tracksInventory
                          ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                      return <button
                        key={service.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        aria-label={`Select ${service.name}`}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => { handleServiceChange(service.id); setServiceSearch(''); setIsServiceSearchOpen(false); }}
                        disabled={isDisabled}
                        title={!hasActivePlans ? 'No active plans; manage this service to add a plan' : tracksInventory && capacity === 0 ? 'No available inventory for this service' : undefined}
                        className="group grid min-h-28 min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_1.75rem] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-700 dark:disabled:hover:border-slate-700"
                      >
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-sm font-bold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                          <span aria-hidden="true">{service.name.trim().charAt(0).toUpperCase() || '?'}</span>
                          {service.logoUrl && <img src={service.logoUrl} alt="" className="absolute inset-0 h-full w-full bg-white object-contain p-1.5 dark:bg-slate-900" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900 dark:text-white">{service.name}</span>
                          <span className="mt-1 block line-clamp-2 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{service.description || service.category}</span>
                          <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="inline-flex max-w-full items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{activePlanCount} active {activePlanCount === 1 ? 'plan' : 'plans'}</span>
                            <span className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-4 ${availabilityClass}`}>{availabilityLabel}</span>
                          </span>
                        </span>
                        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-transparent transition-colors group-hover:border-violet-400 dark:border-slate-600 dark:bg-slate-950">
                          <Check className="h-4 w-4" />
                        </span>
                      </button>;
                    }) : filteredServices.length > 0 ? <p className="col-span-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">All matching services are already selected.</p> : eligibleServices.length > 0 ? <div className="col-span-full rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No services found</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try a different search or clear your filters.</p>
                        </div> : <div className="col-span-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                          <p>There are no active services available for sale.</p>
                          <button type="button" onClick={onAddService} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><Plus className="h-3.5 w-3.5" />Add Service</button>
                        </div>}
                        </div>
                        {availableMatchingServiceCount > 50 && <p className="text-xs text-slate-500 dark:text-slate-400">Showing the first 50 available services. Refine your search to see others.</p>}
                      </div>}
                    </div>
                  </section>
                )}

                {step === 2 && (
                  <section aria-labelledby="sale-plan-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 id="sale-plan-title" className="text-base font-bold text-slate-900 dark:text-white">Choose a plan</h2>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose a plan and set the details below.</p>
                        </div>
                        <button type="button" onClick={() => setStep(1)} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950/40">Change services</button>
                      </div>
                    </div>
                    {isCurrentItemActive && selectedService && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <h3 className="min-w-0 break-words text-sm font-bold text-slate-900 dark:text-white">Choose a plan for <span className="inline rounded-md bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200">{selectedService.name}</span></h3>
                        <button type="button" onClick={handleRemoveCurrentService} aria-label={`Remove ${selectedService.name} service`} className="min-h-9 shrink-0 rounded-lg border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-600 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">Remove</button>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">This service has its own plan, dates, quantity, and discount. Duration and price follow the selected active plan.</p>
                        {selectedService.planDetails?.some(item => item.status === 'active') ? <div className="grid gap-2 sm:grid-cols-2">{selectedService.planDetails.filter(item => item.status === 'active').map(servicePlan => <button key={servicePlan.id} type="button" onClick={() => handlePlanChange(servicePlan)} aria-pressed={planId === servicePlan.id} className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${planId === servicePlan.id ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500/20 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}><span className="min-w-0"><span className="block break-words font-semibold">{servicePlan.name}</span><span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{formatCurrency(servicePlan.price, servicePlan.currency)} · {formatDurationDays(servicePlan.durationDays)}{servicePlan.profileCapacity ? ` · ${servicePlan.profileCapacity} profiles` : ''}</span></span>{planId === servicePlan.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" />}</button>)}</div> : <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>No active plans are available for this service.</p><button type="button" onClick={onAddService} className="mt-2 font-semibold underline">Manage services and plans</button></div>}
                        {!selectedPlan && <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">Choose an active plan to configure this service.</p>}
                      </div>
                    </section>}
                    {selectedPlan && <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40 sm:grid-cols-3">
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">{t('price')} per unit</span><p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{formatCurrency(selectedPlan.price, selectedPlan.currency)}</p><span className="block text-[11px] font-normal">Set by the selected plan.</span></div>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Duration</span><p className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{formatDurationDays(selectedPlan.durationDays)}</p><span className="block text-[11px] font-normal">This line's subscription duration.</span></div>
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Quantity</span><input aria-label={`${selectedService.name} quantity`} type="number" min={1} max={serviceUsesAccounts ? allocationCapacity : undefined} step={1} value={itemQuantity} onChange={event => updateQuantity(Number(event.target.value))} aria-describedby={`sale-quantity-help-${selectedService.id}`} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><span id={`sale-quantity-help-${selectedService.id}`} className="block text-[11px] font-normal">{serviceUsesAccounts ? `${allocationCapacity} distinct inventory unit${allocationCapacity === 1 ? '' : 's'} available. One account or profile is required per unit.` : 'This service does not require tracked inventory.'}</span></label>
                    </div>}
                    {selectedPlan && <div className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Subscription start date</span><input aria-label={`${selectedService.name} start date`} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} aria-invalid={!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || calculatedExpiryDate <= startDate} aria-describedby={`sale-start-date-error-${selectedService.id}`} className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />{(!startDate || !Number.isFinite(Date.parse(`${startDate}T00:00:00`)) || calculatedExpiryDate <= startDate) && <span id={`sale-start-date-error-${selectedService.id}`} role="alert" className="block text-[11px] font-medium text-rose-700 dark:text-rose-300">Enter a valid start date.</span>}</label>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span className="block">Calculated expiry date</span><p className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{startDate ? formatAppDate(calculatedExpiryDate, language) : 'Select a valid start date'}</p></div>
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Item discount</span><input aria-label={`${selectedService.name} item discount`} type="number" min={0} max={currentItemSubtotal} step={currency === 'USD' ? '0.01' : '1'} value={itemDiscountInput} onChange={event => setItemDiscountInput(event.target.value)} aria-invalid={!currentItemDiscountValid} aria-describedby={`sale-discount-error-${selectedService.id}`} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />{!currentItemDiscountValid && <span id={`sale-discount-error-${selectedService.id}`} role="alert" className="block text-[11px] font-medium text-rose-700 dark:text-rose-300">Discount cannot exceed this line subtotal.</span>}</label>
                      <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-violet-50 px-3 py-2.5 text-xs dark:bg-violet-950/30"><span className="font-semibold text-violet-900 dark:text-violet-200">Line total</span><span className="font-mono text-base font-bold tabular-nums text-violet-800 dark:text-violet-200">{formatCurrency(minorUnitsToAmount(Math.max(0, amountToMinorUnits(currentItemSubtotal) - amountToMinorUnits(currentItemDiscount))), currency)}</span></div>
                    </div>}
                    {isCurrentItemActive && selectedPlan && <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 dark:border-violet-800 dark:bg-violet-950/20 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Sale discount</span><div className="flex gap-2"><input aria-label="Discount amount" type="number" min={0} max={discountMode === 'percentage' ? 100 : minorUnitsToAmount(globalDiscountableMinor)} step={currency === 'USD' ? '0.01' : '1'} value={discountValue} onChange={event => setDiscountValue(Number(event.target.value))} aria-invalid={discountValue < 0 || (discountMode === 'fixed' && amountToMinorUnits(discountValue) > globalDiscountableMinor) || (discountMode === 'percentage' && discountValue > 100)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><select aria-label="Discount type" value={discountMode} onChange={event => setDiscountMode(event.target.value as 'fixed' | 'percentage')} className="rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="fixed">Fixed</option><option value="percentage">Percent</option></select></div><span className="block text-[11px] font-normal">Applied to the full sale.</span></label>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"><div className="flex justify-between"><span className="text-slate-500">Order subtotal</span><span>{formatCurrency(subtotal || 0, currency)}</span></div><div className="flex justify-between"><span className="text-slate-500">Sale discount</span><span>−{formatCurrency(discountAmount, currency)}</span></div><div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-700"><span>Grand total</span><span className="text-violet-700 dark:text-violet-300">{formatCurrency(totalAmount, currency)}</span></div></div>
                    </div>}
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="sale-fulfillment-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div><h2 id="sale-fulfillment-title" className="text-base font-bold text-slate-900 dark:text-white">Fulfillment</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{serviceUsesAccounts ? 'Choose active account or profile inventory for this service. Credentials and profile PINs are never displayed.' : 'This service does not need an account or profile. Continue to save this service.'}</p></div>
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
                  </section>
                )}

                {step === 4 && (
                  <section id="sale-quotation-print" aria-labelledby="sale-quotation-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <style>{`@media print { body * { visibility: hidden !important; } #sale-quotation-print, #sale-quotation-print * { visibility: visible !important; } #sale-quotation-print { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; border: 0 !important; box-shadow: none !important; color: #0f172a !important; background: #fff !important; } #sale-quotation-print .print\\:hidden { display: none !important; } }`}</style>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 id="sale-quotation-title" className="text-base font-bold text-slate-900 dark:text-white">Quotation {orderQuotationId ? orders.find(order => order.id === orderQuotationId)?.reference : 'preview'}</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{settings.storeName} · {formatAppDate(getTodayDateString(settings.businessProfile?.timeZone), language)}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Review this offer with the customer before recording payment.</p>
                      </div>
                      <label className="min-w-[10rem] space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span>Order came from</span>
                        <select value={orderSource} onChange={event => setOrderSource(event.target.value as OrderSource)} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                          <option value="whatsapp">WhatsApp</option>
                          <option value="phone">Phone</option>
                          <option value="in_person">In person</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs dark:border-violet-900/60 dark:bg-violet-950/20">
                      <p className="font-semibold text-violet-900 dark:text-violet-200">Customer: {selectedCustomer?.name || 'Not selected'}</p>
                      <p className="mt-1 text-violet-800 dark:text-violet-300">{selectedCustomer?.phone || selectedCustomer?.whatsapp || selectedCustomer?.email || 'No contact details saved'}</p>
                      <p className="mt-1 text-violet-800 dark:text-violet-300">{paymentLineDrafts.length} line item{paymentLineDrafts.length === 1 ? '' : 's'} · {paymentLineDrafts.reduce((sum, item) => sum + item.quantity, 0)} unit{paymentLineDrafts.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'}</p>
                    </div>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                      {paymentLineDrafts.map(item => {
                        const lineTotal = minorUnitsToAmount(
                          amountToMinorUnits(item.unitPrice) * item.quantity - amountToMinorUnits(item.discount || 0)
                        );
                        const expiry = calculateExpiryDate(item.startDate, item.durationDays);
                        return <div key={item.draftId} className="flex min-w-0 items-start justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || 'Service'} · {item.plan}</p>
                            <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{formatDurationDays(item.durationDays)} · {formatAppDate(item.startDate, language)} to {formatAppDate(expiry, language)}</p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)}{item.discount > 0 ? ` · Discount ${formatCurrency(item.discount, item.currency)}` : ''}</p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(lineTotal, item.currency)}</span>
                        </div>;
                      })}
                    </div>
                    <div className="ml-auto max-w-sm space-y-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Discounts</span><span>−{formatCurrency(discountAmount, currency)}</span></div>
                      <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-bold dark:border-slate-700"><span>Total</span><span className="text-violet-700 dark:text-violet-300">{formatCurrency(totalAmount, currency)}</span></div>
                    </div>
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">This is a quotation only. It is not an invoice or payment receipt, and no payment has been recorded.</p>
                    <div className="flex flex-wrap gap-2 print:hidden">
                      <button type="button" onClick={handleShareQuotation} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" />Prepare WhatsApp message</button>
                      <button type="button" onClick={handleCopyQuotation} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FileText className="h-4 w-4" />Copy quotation text</button>
                      <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-4 w-4" />Print / save PDF</button>
                    </div>
                  </section>
                )}

                {step === 5 && (
                  <div className="lg:hidden">{orderSummary}</div>
                )}
                {step === 5 && (
                  <section aria-labelledby="sale-payment-title" className="space-y-4">
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5"><div><h2 id="sale-payment-title" className="text-base font-bold text-slate-900 dark:text-white">Payment details</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose an enabled method. {settings.paymentPreferences?.requireTransactionId && amountReceived > 0 ? 'A transaction ID is required for received cash.' : 'A transaction ID is optional when no cash is received.'}</p></div>
                      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <div>
                          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Expected payment dates (optional)</h3>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">These are customer promises only. They are not payment dates and do not count as money received.</p>
                        </div>
                        {paymentLineDrafts.map(item => (
                          <label key={item.draftId} className="grid min-w-0 gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.7fr)] sm:items-center">
                            <span className="min-w-0 break-words">{item.serviceNameSnapshot || 'Service'} · {item.plan}</span>
                            <input aria-label={`${item.serviceNameSnapshot || 'Service'} expected payment date`} type="date" value={item.expectedPaymentDate || ''} onChange={event => updateExpectedPaymentDate(item.draftId, event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{t('paymentMethod')}</span><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{paymentMethods.length ? paymentMethods.map(method => <option key={method} value={method}>{method === 'Bank' ? 'Bank transfer' : method}</option>) : <option value="">No active payment methods</option>}</select></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Payment date</span><input aria-label="Payment date" type="date" max={getTodayDateString(settings.businessProfile?.timeZone)} value={paymentDate} onChange={event => setPaymentDate(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <div className="space-y-3 sm:col-span-2">
                          <fieldset className="space-y-2">
                            <legend className="text-xs font-semibold text-slate-700 dark:text-slate-200">Payment status</legend>
                            <div className="grid grid-cols-3 gap-2">
                              {([
                                { value: 'paid', label: 'Paid' },
                                { value: 'partial', label: 'Partial' },
                                { value: 'due', label: 'Due' },
                              ] as const).map(option => (
                                <button key={option.value} type="button" aria-pressed={paymentStatusChoice === option.value} onClick={() => {
                                  setPaymentStatusChoice(option.value);
                                  if (option.value === 'paid') {
                                    setAmountReceivedInput(String(minorUnitsToAmount(Math.max(
                                      0,
                                      amountToMinorUnits(totalAmount) - amountToMinorUnits(advanceCreditToApply)
                                    ))));
                                  } else if (option.value === 'partial') {
                                    setAmountReceivedInput('');
                                  } else {
                                    setApplyExistingAdvance(false);
                                    setAdvanceCreditInput('0');
                                    setAmountReceivedInput('0');
                                  }
                                }} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet-600 ${paymentStatusChoice === option.value ? 'border-violet-500 bg-violet-50 text-violet-800 ring-1 ring-violet-500/20 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{option.label}</button>
                              ))}
                            </div>
                          </fieldset>
                          <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <span>Amount received</span>
                            <input aria-label="Total cash received" type="number" min={0} step={currency === 'USD' ? '0.01' : '1'} value={amountReceivedInput} onChange={event => {
                              const value = event.target.value;
                              setAmountReceivedInput(value);
                              const valueMinor = parseAmountToMinorUnits(value);
                              if (valueMinor === null || value === '') return;
                              if (valueMinor === 0) setPaymentStatusChoice('due');
                              else if (valueMinor + amountToMinorUnits(advanceCreditToApply) >= amountToMinorUnits(totalAmount)) setPaymentStatusChoice('paid');
                              else setPaymentStatusChoice('partial');
                            }} aria-describedby="sale-combined-payment-help" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                            <span id="sale-combined-payment-help" className="block text-[11px] font-normal">{paymentStatusChoice === 'paid' ? 'Paid fills in the full amount due.' : paymentStatusChoice === 'partial' ? 'Enter the amount actually received. The rest stays due.' : 'No payment is recorded. The full bill stays due.'} Extra money is saved as an advance payment.</span>
                          </label>
                          <p className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-200">Payment is applied to services in the order shown. Any extra money is saved as an advance payment.</p>
                        </div>
                        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:col-span-2">
                          <label className="flex items-start gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100"><input type="checkbox" checked={applyExistingAdvance} disabled={availableCustomerAdvance <= 0 || totalAmount <= 0} onChange={event => {
                            const shouldApply = event.target.checked;
                            setApplyExistingAdvance(shouldApply);
                            setAdvanceCreditInput(shouldApply ? String(maxAdvanceToApply) : '0');
                          }} className="mt-0.5 h-4 w-4 accent-violet-600" /><span>Use advance payment <span className="block pt-0.5 font-normal text-slate-500 dark:text-slate-400">Available: {formatCurrency(availableCustomerAdvance, currency)} · paid earlier.</span></span></label>
                          {applyExistingAdvance && <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Advance payment to use (up to {formatCurrency(maxAdvanceToApply, currency)})</span><input aria-label="Advance payment to use" type="number" min={0} max={maxAdvanceToApply} step={currency === 'USD' ? '0.01' : '1'} value={advanceCreditInput} onChange={event => setAdvanceCreditInput(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />{!advanceInputValid && <span className="block text-rose-700 dark:text-rose-300">Enter no more than the available balance or sale total.</span>}</label>}
                        </div>
                        <div className="grid gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs dark:border-violet-900/60 dark:bg-violet-950/20 sm:col-span-2 sm:grid-cols-2">
                          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Total bill</span><span className="font-semibold">{formatCurrency(totalAmount, currency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">New cash received</span><span>{formatCurrency(amountReceived, currency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Cash allocated to sale</span><span>{formatCurrency(tenderAllocation.cashApplied, currency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Advance payment used</span><span>{formatCurrency(tenderAllocation.advanceApplied, currency)}</span></div>
                          <div className="flex justify-between font-bold text-rose-700 dark:text-rose-300"><span>Outstanding due</span><span>{formatCurrency(dueAmount, currency)}</span></div>
                          <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300"><span>Extra advance payment</span><span>{formatCurrency(tenderAllocation.advanceCreditCreated, currency)}</span></div>
                          <div className="sm:col-span-2"><span className="inline-flex rounded-full bg-white px-2.5 py-1 font-bold capitalize text-violet-800 dark:bg-slate-900 dark:text-violet-200">{paymentStatus === 'paid' ? 'Fully paid' : paymentStatus === 'partial' ? 'Partially paid' : 'Unpaid'}</span>{tenderAllocation.advanceCreditCreated > 0 && <p className="mt-1.5 text-slate-600 dark:text-slate-300">Extra money is saved as an advance payment for this customer.</p>}</div>
                        </div>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{t('transactionId')} <span className="font-normal text-slate-400">({amountReceived > 0 && paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId) ? 'required' : 'optional'})</span></span><input aria-label="Transaction ID" required={amountReceived > 0 && paymentMethodRequiresTransactionId(paymentMethod, paymentMethodConfigs, settings.paymentPreferences?.requireTransactionId)} type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Enter transaction ID" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{t('senderNumber')} <span className="font-normal text-slate-400">(optional)</span></span><input aria-label="Payment sender number" type="tel" value={senderNumber} onChange={e => setSenderNumber(e.target.value)} placeholder="Enter sender number" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Payment note (optional)</span><textarea aria-label="Payment note" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"><span>Internal sale notes <span className="font-normal text-slate-400">(optional)</span></span><textarea aria-label="Internal sale notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
                      </div>
                    </div>
                  </section>
                )}
                {step === 6 && (
                  <section aria-labelledby="sale-review-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                    <div><h2 id="sale-review-title" className="text-base font-bold text-slate-900 dark:text-white">Review Sale</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Check customer, fulfillment, dates, and payment before creating the sale. Use Edit to return to a step.</p></div>
                    {itemDrafts.length > 0 && <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Items in this sale</h3>
                      {itemDrafts.map((item, index) => index === editingItemIndex ? null : (
                        <div key={item.draftId} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-slate-900 dark:text-white">{item.serviceNameSnapshot || services.find(candidate => candidate.id === item.serviceId)?.name || 'Service'} · {item.plan}</p>
                            <p className="text-slate-500 dark:text-slate-400">{item.quantity} × {formatCurrency(item.unitPrice, item.currency)} = {formatCurrency(minorUnitsToAmount(amountToMinorUnits(item.unitPrice) * item.quantity), item.currency)} · {formatAppDate(item.startDate, language)} · {formatDurationDays(item.durationDays)}</p>
                            {(item.discount || 0) > 0 && <p className="text-emerald-700 dark:text-emerald-300">Item discount −{formatCurrency(item.discount || 0, item.currency)} · Line total {formatCurrency(minorUnitsToAmount(amountToMinorUnits(item.unitPrice) * item.quantity - amountToMinorUnits(item.discount || 0)), item.currency)}</p>}
                            {paymentLineFinancials.filter(financial => financial.item.draftId === item.draftId).map(financial => <p key={`${item.draftId}-payment`} className="mt-0.5 text-slate-600 dark:text-slate-300">Paid {formatCurrency(financial.paid, item.currency)} · Due {formatCurrency(financial.due, item.currency)} · {financial.status === 'paid' ? 'Paid' : financial.status === 'partial' ? 'Partially paid' : 'Unpaid'}</p>)}
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
                        {currentItemDiscount > 0 && <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Item discount −{formatCurrency(currentItemDiscount, currency)} · Line total {formatCurrency(minorUnitsToAmount(amountToMinorUnits(currentItemSubtotal) - amountToMinorUnits(currentItemDiscount)), currency)}</p>}
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
                      <div><dt className="flex items-center justify-between text-slate-500">Payment <button type="button" onClick={() => setStep(5)} className="font-semibold text-emerald-700 underline dark:text-emerald-300">Edit</button></dt><dd className="mt-1 font-semibold capitalize text-slate-900 dark:text-white">{paymentStatus} · {paymentMethod}</dd></div>
                    </dl>
                    <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                      <div className="flex justify-between"><span className="text-slate-500">Items ({itemDrafts.length - (editingItemIndex === null ? 0 : 1) + (isCurrentItemActive ? 1 : 0)} lines · {itemDrafts.reduce((sum, item, index) => sum + (index === editingItemIndex ? 0 : item.quantity), 0) + (isCurrentItemActive ? itemQuantity : 0)} units)</span><span>{formatCurrency(subtotal, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>−{formatCurrency(discountAmount, currency)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold dark:border-slate-700"><span>Total</span><span>{formatCurrency(totalAmount, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">New cash received</span><span>{formatCurrency(amountReceived, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Existing advance applied</span><span>{formatCurrency(tenderAllocation.advanceApplied, currency)}</span></div>
                      <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300"><span>Due</span><span>{formatCurrency(dueAmount, currency)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Extra advance payment</span><span>{formatCurrency(tenderAllocation.advanceCreditCreated, currency)}</span></div>
                    </div>
                  </section>
                )}
              </div>
              <aside className="hidden h-fit lg:sticky lg:top-2 lg:block">{orderSummary}</aside>
            </div>
            {step === 1
              ? <div className="lg:hidden">{orderSummary}</div>
              : step !== 5 && <details className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 lg:hidden"><summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">Order summary · {formatCurrency(totalAmount, currency)}</summary><div className="pt-3">{orderSummary}</div></details>}
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
