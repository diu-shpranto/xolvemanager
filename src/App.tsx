/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/common/Toast';
import { Sidebar, NavSection } from './components/navigation/Sidebar';
import { TopNav } from './components/navigation/TopNav';
import type { CashbookAction } from './components/views/CashbookView';
import type { Subscription } from './types';
import type { CustomerCrmQuickFilter } from './utils/customerCrm';
import { recordRecentSearchItem } from './services/globalSearch';
import type { GlobalSearchResult } from './services/globalSearch';
import type { QuickAction } from './components/navigation/CommandCenter';
import { useApp } from './context/AppContext';
import { WhatsAppCommunicationProvider } from './components/whatsapp/WhatsAppCommunication';
import { registerPwa } from './services/pwaService';
import type { CurrentAdminUser } from './context/AppContext';
import { RecoveryScreen } from './components/common/RecoveryScreen';
import { getAppLocation, sectionPaths, type SettingsStartSection } from './utils/appRoutes';
import { getActivityEntityType } from './services/activityService';
import { confirmUnsavedChangesBeforeNavigation, hasRegisteredUnsavedChanges } from './services/unsavedChanges';

const DashboardView = lazy(() => import('./components/views/DashboardView').then(module => ({ default: module.DashboardView })));
const CustomersView = lazy(() => import('./components/views/CustomersView').then(module => ({ default: module.CustomersView })));
const ServicesView = lazy(() => import('./components/views/ServicesView').then(module => ({ default: module.ServicesView })));
const AccountsView = lazy(() => import('./components/views/AccountsView').then(module => ({ default: module.AccountsView })));
const ProfilesView = lazy(() => import('./components/views/ProfilesView').then(module => ({ default: module.ProfilesView })));
const SubscriptionsView = lazy(() => import('./components/views/SubscriptionsView').then(module => ({ default: module.SubscriptionsView })));
const SalesView = lazy(() => import('./components/views/SalesView').then(module => ({ default: module.SalesView })));
const PaymentsView = lazy(() => import('./components/views/PaymentsView').then(module => ({ default: module.PaymentsView })));
const CashbookView = lazy(() => import('./components/views/CashbookView').then(module => ({ default: module.CashbookView })));
const FinancialControlView = lazy(() => import('./components/views/FinancialControlView').then(module => ({ default: module.FinancialControlView })));
const DataIntegrityView = lazy(() => import('./components/views/DataIntegrityView').then(module => ({ default: module.DataIntegrityView })));
const DailyClosingView = lazy(() => import('./components/views/DailyClosingView').then(module => ({ default: module.DailyClosingView })));
const ExpensesView = lazy(() => import('./components/views/ExpensesView').then(module => ({ default: module.ExpensesView })));
const InvoicesView = lazy(() => import('./components/views/InvoicesView').then(module => ({ default: module.InvoicesView })));
const HistoryView = lazy(() => import('./components/views/HistoryView').then(module => ({ default: module.HistoryView })));
const ProfitAnalyticsView = lazy(() => import('./components/views/ProfitAnalyticsView').then(module => ({ default: module.ProfitAnalyticsView })));
const ReportsView = lazy(() => import('./components/views/ReportsView').then(module => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then(module => ({ default: module.SettingsView })));
const NotificationsView = lazy(() => import('./components/views/NotificationsView').then(module => ({ default: module.NotificationsView })));
const SmartRemindersView = lazy(() => import('./components/views/SmartRemindersView').then(module => ({ default: module.SmartRemindersView })));
const SearchResultsView = lazy(() => import('./components/views/SearchResultsView').then(module => ({ default: module.SearchResultsView })));
const NewSaleModal = lazy(() => import('./components/modals/NewSaleModal').then(module => ({ default: module.NewSaleModal })));

class LazyViewErrorBoundary extends React.Component<
  { children: React.ReactNode; onDashboard: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Could not load the selected app page.', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <RecoveryScreen
          variant="error"
          onDashboard={this.props.onDashboard}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

const MainAppLayout: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { currentBusiness } = useApp();
  const initialLocation = typeof window === 'undefined'
    ? { section: 'dashboard' as NavSection }
    : getAppLocation(window.location.pathname);
  // Navigation State
  const [currentSection, setCurrentSectionState] = useState<NavSection>(initialLocation.section);
  const currentSectionRef = useRef(currentSection);
  currentSectionRef.current = currentSection;
  const ignoreNextPopStateRef = useRef(false);
  const [isNotFound, setIsNotFound] = useState(Boolean(initialLocation.isNotFound));
  const setCurrentSection = (section: NavSection) => {
    if (section !== currentSectionRef.current && !confirmUnsavedChangesBeforeNavigation()) return;
    setCurrentSectionState(section);
    currentSectionRef.current = section;
    setIsNotFound(false);
    const nextPath = sectionPaths[section];
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({ section }, '', nextPath);
    }
  };
  const [settingsStartSection, setSettingsStartSection] = useState<SettingsStartSection | undefined>(initialLocation.settingsStartSection);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const closeMobileSidebar = useCallback(() => setIsMobileSidebarOpen(false), []);

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 768px)');
    const closeMobileSidebarOnBreakpointChange = () => setIsMobileSidebarOpen(false);

    desktopViewport.addEventListener('change', closeMobileSidebarOnBreakpointChange);
    return () => desktopViewport.removeEventListener('change', closeMobileSidebarOnBreakpointChange);
  }, []);

  // Global New Sale Modal
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [newSalePreselectedCustomer, setNewSalePreselectedCustomer] = useState<string | undefined>(undefined);
  const [newSalePreselectedService, setNewSalePreselectedService] = useState<string | undefined>(undefined);
  const [newSaleResourcePreset, setNewSaleResourcePreset] = useState<{ accountId: string; profileId?: string; planId?: string }>();
  const [paymentPreselectedCustomerId, setPaymentPreselectedCustomerId] = useState<string | undefined>();
  const [paymentPreselectedSaleId, setPaymentPreselectedSaleId] = useState<string | undefined>();

  // Selected customer for customer details drawer/modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() =>
    initialLocation.recordSection === 'customers' ? initialLocation.recordId ?? null : null
  );
  const [customerQuickFilter, setCustomerQuickFilter] = useState<CustomerCrmQuickFilter | undefined>();
  const [focusedAccountId, setFocusedAccountId] = useState<string | undefined>(() =>
    initialLocation.recordSection === 'accounts' ? initialLocation.recordId : undefined
  );
  const [accountServiceFilterId, setAccountServiceFilterId] = useState<string | undefined>();
  const [profileServiceFilterId, setProfileServiceFilterId] = useState<string | undefined>();
  const [subscriptionServiceFilterId, setSubscriptionServiceFilterId] = useState<string | undefined>();
  const [customerServiceFilterId, setCustomerServiceFilterId] = useState<string | undefined>();
  const [focusedServiceId, setFocusedServiceId] = useState<string | undefined>(() =>
    initialLocation.recordSection === 'services' ? initialLocation.recordId : undefined
  );
  const [focusedSubscriptionId, setFocusedSubscriptionId] = useState<string | undefined>(() =>
    initialLocation.recordSection === 'subscriptions' ? initialLocation.recordId : undefined
  );
  const [focusedSaleId, setFocusedSaleId] = useState<string | undefined>(() =>
    initialLocation.recordSection === 'sales' ? initialLocation.recordId : undefined
  );
  const [profitSalesFilterIds, setProfitSalesFilterIds] = useState<string[]>();
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | undefined>(() =>
    initialLocation.recordSection === 'invoices' ? initialLocation.recordId : undefined
  );
  const [focusedPaymentId, setFocusedPaymentId] = useState<string | undefined>(() =>
    initialLocation.recordSection === 'payments' ? initialLocation.recordId : undefined
  );
  const [cashbookTarget, setCashbookTarget] = useState<{ accountId?: string; action?: CashbookAction }>({});
  const [expenseCreateRequest, setExpenseCreateRequest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [createRequests, setCreateRequests] = useState({ customer: 0, service: 0, account: 0, payment: 0 });
  const lastRecentView = useRef('');

  useEffect(() => {
    if (currentSection !== 'sales' && currentSection !== 'profitability') {
      setProfitSalesFilterIds(undefined);
    }
  }, [currentSection]);

  useEffect(() => {
    const handlePopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }
      if (hasRegisteredUnsavedChanges() && !confirmUnsavedChangesBeforeNavigation()) {
        ignoreNextPopStateRef.current = true;
        window.history.go(1);
        return;
      }
      const location = getAppLocation(window.location.pathname);
      setCurrentSectionState(location.section);
      currentSectionRef.current = location.section;
      setIsNotFound(Boolean(location.isNotFound));
      setSettingsStartSection(location.settingsStartSection);
      setSelectedCustomerId(location.recordSection === 'customers' ? location.recordId ?? null : null);
      setFocusedServiceId(location.recordSection === 'services' ? location.recordId : undefined);
      setFocusedAccountId(location.recordSection === 'accounts' ? location.recordId : undefined);
      setFocusedSubscriptionId(location.recordSection === 'subscriptions' ? location.recordId : undefined);
      setFocusedSaleId(location.recordSection === 'sales' ? location.recordId : undefined);
      setFocusedPaymentId(location.recordSection === 'payments' ? location.recordId : undefined);
      setFocusedInvoiceId(location.recordSection === 'invoices' ? location.recordId : undefined);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Direct Renewal Target
  const [renewTargetSub, setRenewTargetSub] = useState<Subscription | null>(null);

  const handleOpenNewSale = (
    customerId?: string,
    serviceId?: string,
    resourcePreset?: { accountId: string; profileId?: string; planId?: string }
  ) => {
    setNewSalePreselectedCustomer(customerId);
    setNewSalePreselectedService(serviceId);
    setNewSaleResourcePreset(resourcePreset);
    setIsNewSaleOpen(true);
  };

  const handleAddPaymentForCustomer = (customerId: string) => {
    setPaymentPreselectedCustomerId(customerId);
    setPaymentPreselectedSaleId(undefined);
    setCurrentSection('payments');
    setCreateRequests(previous => ({ ...previous, payment: previous.payment + 1 }));
  };

  const handleAddPaymentForSale = (saleId: string, customerId?: string) => {
    setPaymentPreselectedCustomerId(customerId);
    setPaymentPreselectedSaleId(saleId);
    setCurrentSection('payments');
    setCreateRequests(previous => ({ ...previous, payment: previous.payment + 1 }));
  };

  const handleAddServiceFromSale = () => {
    setIsNewSaleOpen(false);
    setNewSalePreselectedCustomer(undefined);
    setNewSalePreselectedService(undefined);
    setNewSaleResourcePreset(undefined);
    setCurrentSection('services');
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentSection('customers');
  };

  const handleRenewFromDashboard = (sub: Subscription) => {
    setRenewTargetSub(sub);
    setCurrentSection('subscriptions');
  };

  useEffect(() => {
    const selection = currentSection === 'customers' && selectedCustomerId
      ? { entity: 'customers' as const, id: selectedCustomerId }
      : currentSection === 'services' && focusedServiceId
        ? { entity: 'services' as const, id: focusedServiceId }
        : currentSection === 'accounts' && focusedAccountId
          ? { entity: 'accounts' as const, id: focusedAccountId }
          : currentSection === 'subscriptions' && focusedSubscriptionId
            ? { entity: 'subscriptions' as const, id: focusedSubscriptionId }
            : currentSection === 'sales' && focusedSaleId
              ? { entity: 'sales' as const, id: focusedSaleId }
              : currentSection === 'payments' && focusedPaymentId
                ? { entity: 'payments' as const, id: focusedPaymentId }
                : currentSection === 'invoices' && focusedInvoiceId
                  ? { entity: 'invoices' as const, id: focusedInvoiceId }
                  : null;
    if (!selection) {
      lastRecentView.current = '';
      return;
    }
    const key = `${selection.entity}:${selection.id}:${currentSection}`;
    if (lastRecentView.current === key) return;
    lastRecentView.current = key;
    recordRecentSearchItem(selection, currentBusiness?.businessId);
  }, [
    currentSection, selectedCustomerId, focusedServiceId, focusedAccountId,
    focusedSubscriptionId, focusedSaleId, focusedPaymentId, focusedInvoiceId,
    currentBusiness?.businessId,
  ]);

  const selectSearchResult = (result: GlobalSearchResult) => {
    recordRecentSearchItem(result, currentBusiness?.businessId);
    if (result.entity === 'customers') setSelectedCustomerId(result.id);
    if (result.entity === 'services' || result.entity === 'plans') setFocusedServiceId(result.parentId ?? result.id);
    if (result.entity === 'accounts' || result.entity === 'profiles') setFocusedAccountId(result.parentId ?? result.id);
    if (result.entity === 'subscriptions') setFocusedSubscriptionId(result.id);
    if (result.entity === 'sales') setFocusedSaleId(result.id);
    if (result.entity === 'payments') setFocusedPaymentId(result.id);
    if (result.entity === 'invoices') setFocusedInvoiceId(result.id);
    setCurrentSection(result.section);
  };

  const handleViewAllSearchResults = (query: string) => {
    setSearchQuery(query);
    setCurrentSection('search');
  };

  const handleSearchQuickAction = (action: QuickAction) => {
    if (action === 'subscriptions') {
      setCurrentSection('subscriptions');
      return;
    }
    if (action === 'sale') {
      handleOpenNewSale();
      return;
    }
    if (action === 'payment') {
      setCurrentSection('payments');
      setCreateRequests(previous => ({ ...previous, payment: previous.payment + 1 }));
      return;
    }
    const section = action === 'customer' ? 'customers'
      : action === 'service' ? 'services'
        : 'accounts';
    setCurrentSection(section);
    setCreateRequests(previous => ({ ...previous, [action]: previous[action] + 1 }));
  };
  const markCreateRequestHandled = (action: 'customer' | 'service' | 'account' | 'payment') => {
    setCreateRequests(previous => previous[action] === 0 ? previous : { ...previous, [action]: 0 });
  };

  return (
    <div className="app-shell" data-sidebar-collapsed={isSidebarCollapsed}>
      <div className="app-topbar-region" inert={isMobileSidebarOpen}>
        <TopNav
          onLogout={onLogout}
          onOpenMobile={() => setIsMobileSidebarOpen(open => !open)}
          isMobileNavOpen={isMobileSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(collapsed => !collapsed)}
          onOpenNewSale={() => handleOpenNewSale()}
          hideNewSaleAction={currentSection === 'sales'}
          onNavigate={setCurrentSection}
          onSelectSearchResult={selectSearchResult}
          onViewAllSearchResults={handleViewAllSearchResults}
          onQuickAction={handleSearchQuickAction}
          onNavigateToNotification={(section, entityId) => {
            if (section === 'customers' && entityId) setSelectedCustomerId(entityId);
            if (section === 'accounts' && entityId) setFocusedAccountId(entityId);
            if (section === 'services' && entityId) setFocusedServiceId(entityId);
            if (section === 'subscriptions') {
              setFocusedSubscriptionId(entityId);
            }
            if (section === 'sales' && entityId) setFocusedSaleId(entityId);
            if (section === 'payments' && entityId) setFocusedPaymentId(entityId);
            if (section === 'invoices' && entityId) setFocusedInvoiceId(entityId);
            setCurrentSection(section);
          }}
        />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={section => {
          if (section === 'settings') setSettingsStartSection(undefined);
          setCurrentSection(section);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={closeMobileSidebar}
        isCollapsedDesktop={isSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="app-main-area min-w-0" inert={isMobileSidebarOpen}>
        {/* View Content */}
        <main className="app-main flex-1">
          {isNotFound ? (
            <RecoveryScreen
              variant="not-found"
              allowBack
              onDashboard={() => setCurrentSection('dashboard')}
            />
          ) : (
          <LazyViewErrorBoundary key={currentSection} onDashboard={() => setCurrentSection('dashboard')}>
          <Suspense fallback={
            <div className="page-container" role="status" aria-live="polite">
              <div className="surface-card flex min-h-32 items-center justify-center gap-3 p-5 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
                Loading page…
              </div>
            </div>
          }>
          {currentSection === 'dashboard' && (
            <DashboardView
              onNavigate={(section, targetId) => {
                if (section === 'customers' && targetId) setSelectedCustomerId(targetId);
                if (section === 'services' && targetId) setFocusedServiceId(targetId);
                if (section === 'accounts' && targetId) setFocusedAccountId(targetId);
                if (section === 'subscriptions' && targetId) setFocusedSubscriptionId(targetId);
                if (section === 'sales' && targetId) setFocusedSaleId(targetId);
                if (section === 'invoices' && targetId) setFocusedInvoiceId(targetId);
                if (section === 'payments' && targetId) setFocusedPaymentId(targetId);
                if (section === 'cashbook') {
                  const action = targetId?.startsWith('action:') ? targetId.slice('action:'.length) : '';
                  if (action === 'expense' || action === 'income' || action === 'transfer') {
                    setCashbookTarget({ action });
                  } else {
                    setCashbookTarget(targetId ? { accountId: targetId } : {});
                  }
                }
                if (section === 'expenses' && targetId === 'action:create') {
                  setExpenseCreateRequest(previous => previous + 1);
                }
                setCurrentSection(section);
              }}
              onRequestCreate={section => {
                setCurrentSection(section);
                const request = section === 'customers' ? 'customer'
                  : section === 'services' ? 'service'
                    : section === 'accounts' ? 'account' : 'payment';
                setCreateRequests(previous => ({ ...previous, [request]: previous[request] + 1 }));
              }}
              onOpenNewSale={handleOpenNewSale}
              onSelectCustomer={handleSelectCustomer}
              onNavigateToCustomers={filter => {
                setCustomerQuickFilter(filter);
                setSelectedCustomerId(null);
                setCurrentSection('customers');
              }}
              onRenewSubscription={handleRenewFromDashboard}
              onViewInvoice={invoiceId => {
                setFocusedInvoiceId(invoiceId);
                setCurrentSection('invoices');
              }}
              onViewSale={saleId => {
                setFocusedSaleId(saleId);
                setCurrentSection('sales');
              }}
            />
          )}

          {currentSection === 'customers' && (
            <CustomersView
              onOpenNewSaleForCustomer={(custId) => handleOpenNewSale(custId, undefined)}
              onViewSale={saleId => {
                setFocusedSaleId(saleId);
                setCurrentSection('sales');
              }}
              selectedCustomerId={selectedCustomerId}
              createRequest={createRequests.customer}
              onCreateRequestHandled={() => markCreateRequestHandled('customer')}
              onViewCustomerDetails={customerId => recordRecentSearchItem({ entity: 'customers', id: customerId }, currentBusiness?.businessId)}
              onClearSelectedCustomer={() => setSelectedCustomerId(null)}
              onViewSubscription={subscriptionId => {
                setFocusedSubscriptionId(subscriptionId);
                setCurrentSection('subscriptions');
              }}
              onRenewSubscription={handleRenewFromDashboard}
              onAddPaymentForCustomer={handleAddPaymentForCustomer}
              onViewPayment={paymentId => {
                setFocusedPaymentId(paymentId);
                setCurrentSection('payments');
              }}
              onViewInvoice={invoiceId => {
                setFocusedInvoiceId(invoiceId);
                setCurrentSection('invoices');
              }}
              initialCustomerFilter={customerQuickFilter}
              initialServiceFilterId={customerServiceFilterId}
              onInitialCustomerFilterHandled={() => setCustomerQuickFilter(undefined)}
            />
          )}

          {currentSection === 'services' && (
            <ServicesView
              selectedServiceId={focusedServiceId}
              onClearSelectedService={() => setFocusedServiceId(undefined)}
              createRequest={createRequests.service}
              onCreateRequestHandled={() => markCreateRequestHandled('service')}
              onOpenNewSaleForService={(srvId) => handleOpenNewSale(undefined, srvId)}
              onNavigateToServiceAccounts={serviceId => {
                setAccountServiceFilterId(serviceId);
                setCurrentSection('accounts');
              }}
              onNavigateToServiceSubscriptions={serviceId => {
                setSubscriptionServiceFilterId(serviceId);
                setCurrentSection('subscriptions');
              }}
              onNavigateToServiceCustomers={serviceId => {
                setCustomerServiceFilterId(serviceId);
                setCurrentSection('customers');
              }}
              onNavigateToServiceProfiles={serviceId => {
                setProfileServiceFilterId(serviceId);
                setCurrentSection('profiles');
              }}
              onAddAccountForService={serviceId => {
                setAccountServiceFilterId(serviceId);
                setCurrentSection('accounts');
                setCreateRequests(previous => ({ ...previous, account: previous.account + 1 }));
              }}
              onAddCustomerForService={serviceId => {
                setCustomerServiceFilterId(serviceId);
                setSelectedCustomerId(null);
                setCurrentSection('customers');
                setCreateRequests(previous => ({ ...previous, customer: previous.customer + 1 }));
              }}
              onNavigateSection={(section, targetId) => {
                if (section === 'subscriptions' && targetId) setFocusedSubscriptionId(targetId);
                if (section === 'customers' && targetId) setSelectedCustomerId(targetId);
                if (section === 'accounts' && targetId) setFocusedAccountId(targetId);
                if (section === 'services' && targetId) setFocusedServiceId(targetId);
                if (section === 'sales' && targetId) setFocusedSaleId(targetId);
                setCurrentSection(section as NavSection);
              }}
              onSelectCustomer={handleSelectCustomer}
              onViewSubscription={subscriptionId => {
                setFocusedSubscriptionId(subscriptionId);
                setCurrentSection('subscriptions');
              }}
            />
          )}

          {currentSection === 'accounts' && <AccountsView selectedAccountId={focusedAccountId} serviceFilterId={accountServiceFilterId} createRequest={createRequests.account} onCreateRequestHandled={() => markCreateRequestHandled('account')} onCreateSaleForAccount={details => handleOpenNewSale(undefined, details.serviceId, details)} onCreateSaleForProfile={details => handleOpenNewSale(details.customerId, details.serviceId, details)} onViewSale={saleId => { setFocusedSaleId(saleId); setCurrentSection('sales'); }} onViewSubscription={subscriptionId => { setFocusedSubscriptionId(subscriptionId); setCurrentSection('subscriptions'); }} />}

          {currentSection === 'profiles' && <ProfilesView serviceFilterId={profileServiceFilterId} onCreateSaleForProfile={details => handleOpenNewSale(details.customerId, details.serviceId, details)} />}

          {currentSection === 'subscriptions' && (
            <SubscriptionsView
              onOpenNewSale={(custId, srvId) => handleOpenNewSale(custId, srvId)}
              renewTargetSub={renewTargetSub}
              serviceFilterId={subscriptionServiceFilterId}
              focusSubscriptionId={focusedSubscriptionId}
              onFocusedSubscriptionHandled={() => setFocusedSubscriptionId(undefined)}
              onClearRenewTarget={() => setRenewTargetSub(null)}
              onAddPaymentForCustomer={handleAddPaymentForCustomer}
              onNavigateSection={(section, targetId) => {
                if (section === 'customers' && targetId) {
                  setSelectedCustomerId(targetId);
                }
                setCurrentSection(section as NavSection);
              }}
            />
          )}

          {currentSection === 'sales' && (
            <SalesView
              onOpenNewSale={customerId => handleOpenNewSale(customerId)}
              onViewCustomer={customerId => {
                setSelectedCustomerId(customerId);
                setCurrentSection('customers');
              }}
              onViewSubscription={subscriptionId => {
                setFocusedSubscriptionId(subscriptionId);
                setCurrentSection('subscriptions');
              }}
              onViewAccount={accountId => {
                setFocusedAccountId(accountId);
                setCurrentSection('accounts');
              }}
              onViewProfiles={serviceId => {
                setProfileServiceFilterId(serviceId);
                setCurrentSection('profiles');
              }}
              onViewPayment={paymentId => {
                setFocusedPaymentId(paymentId);
                setCurrentSection('payments');
              }}
              onNavigateReminders={() => setCurrentSection('reminders')}
              focusSaleId={focusedSaleId}
              onFocusedSaleHandled={() => setFocusedSaleId(undefined)}
              saleIdFilter={profitSalesFilterIds}
              onClearSaleIdFilter={() => setProfitSalesFilterIds(undefined)}
            />
          )}

          {currentSection === 'payments' && (
            <PaymentsView
              focusPaymentId={focusedPaymentId}
              createRequest={createRequests.payment}
              preselectedCustomerId={paymentPreselectedCustomerId}
              preselectedSaleId={paymentPreselectedSaleId}
              onCreateRequestHandled={() => {
                markCreateRequestHandled('payment');
                setPaymentPreselectedCustomerId(undefined);
                setPaymentPreselectedSaleId(undefined);
              }}
              onFocusedPaymentHandled={() => setFocusedPaymentId(undefined)}
              onNavigateSection={(section, targetId) => {
                if (section === 'customers' && targetId) setSelectedCustomerId(targetId);
                if (section === 'sales' && targetId) setFocusedSaleId(targetId);
                if (section === 'subscriptions' && targetId) setFocusedSubscriptionId(targetId);
                if (section === 'invoices' && targetId) setFocusedInvoiceId(targetId);
                setCurrentSection(section as NavSection);
              }}
            />
          )}

          {currentSection === 'cashbook' && <CashbookView
            focusAccountId={cashbookTarget.accountId}
            initialAction={cashbookTarget.action}
            onTargetHandled={() => setCashbookTarget({})}
          />}
          {currentSection === 'financial-control' && <FinancialControlView />}
          {currentSection === 'data-integrity' && <DataIntegrityView onOpenBackupSettings={() => {
            setSettingsStartSection('data');
            setCurrentSection('settings');
          }} />}
          {currentSection === 'daily-closing' && <DailyClosingView onNavigate={section => setCurrentSection(section)} />}
          {currentSection === 'expenses' && <ExpensesView
            onNavigate={(section, targetId) => {
              if (section === 'cashbook') {
                setCashbookTarget(targetId ? { accountId: targetId } : {});
              }
              setCurrentSection(section);
            }}
            createRequest={expenseCreateRequest}
            onCreateRequestHandled={() => setExpenseCreateRequest(0)}
          />}

          {currentSection === 'invoices' && (
            <InvoicesView
              onViewSale={saleId => {
                setFocusedSaleId(saleId);
                setCurrentSection('sales');
              }}
              onViewCustomer={customerId => {
                setSelectedCustomerId(customerId);
                setCurrentSection('customers');
              }}
              onViewSubscription={subscriptionId => {
                setFocusedSubscriptionId(subscriptionId);
                setCurrentSection('subscriptions');
              }}
              onViewPayment={paymentId => {
                setFocusedPaymentId(paymentId);
                setCurrentSection('payments');
              }}
              onAddPayment={handleAddPaymentForSale}
              focusInvoiceId={focusedInvoiceId}
              onFocusedInvoiceHandled={() => setFocusedInvoiceId(undefined)}
              onNavigateSection={(section, targetId) => {
                if (section === 'sales' && targetId) setFocusedSaleId(targetId);
                setCurrentSection(section as NavSection);
              }}
            />
          )}

          {currentSection === 'history' && (
            <HistoryView onViewRelated={activity => {
              const entityType = activity.entityType || getActivityEntityType(activity);
              if (entityType === 'invoice' && (activity.invoiceId || activity.entityId)) {
                setFocusedInvoiceId(activity.invoiceId || activity.entityId);
                setCurrentSection('invoices');
              } else if (entityType === 'payment' && (activity.paymentId || activity.entityId)) {
                setFocusedPaymentId(activity.paymentId || activity.entityId);
                setCurrentSection('payments');
              } else if (entityType === 'sale' && (activity.saleId || activity.entityId)) {
                setFocusedSaleId(activity.saleId || activity.entityId);
                setCurrentSection('sales');
              } else if (entityType === 'subscription' && (activity.subscriptionId || activity.entityId)) {
                setFocusedSubscriptionId(activity.subscriptionId || activity.entityId);
                setCurrentSection('subscriptions');
              } else if ((entityType === 'service' || entityType === 'plan') && (activity.serviceId || (entityType === 'service' ? activity.entityId : undefined))) {
                setFocusedServiceId(activity.serviceId || activity.entityId);
                setCurrentSection('services');
              } else if (entityType === 'customer' && (activity.customerId || activity.entityId)) {
                setSelectedCustomerId(activity.customerId || activity.entityId || null);
                setCurrentSection('customers');
              } else if (entityType === 'financial_account') {
                setCashbookTarget({ accountId: activity.financialAccountId || activity.entityId });
                setCurrentSection('cashbook');
              } else if (entityType === 'expense' || entityType === 'income' || entityType === 'transfer' || entityType === 'adjustment' || entityType === 'daily_closing') {
                setCurrentSection(entityType === 'daily_closing' ? 'daily-closing' : 'cashbook');
              } else if (entityType === 'account' || entityType === 'profile') {
                setFocusedAccountId(activity.accountId);
                setCurrentSection('accounts');
              } else if (entityType === 'reminder') {
                setCurrentSection('reminders');
              }
            }} />
          )}

          {currentSection === 'profitability' && (
            <ProfitAnalyticsView
              onViewSale={saleId => {
                setProfitSalesFilterIds(undefined);
                setFocusedSaleId(saleId);
                setCurrentSection('sales');
              }}
              onViewSales={saleIds => {
                setFocusedSaleId(undefined);
                setProfitSalesFilterIds(saleIds);
                setCurrentSection('sales');
              }}
            />
          )}

          {currentSection === 'reports' && (
            <ReportsView
              onNavigate={(section, targetId) => {
                if (section === 'customers' && targetId) setSelectedCustomerId(targetId);
                if (section === 'sales' && targetId) setFocusedSaleId(targetId);
                if (section === 'subscriptions' && targetId) setFocusedSubscriptionId(targetId);
                setCurrentSection(section);
              }}
              onRenewSubscription={handleRenewFromDashboard}
              onViewInvoice={invoiceId => {
                setFocusedInvoiceId(invoiceId);
                setCurrentSection('invoices');
              }}
            />
          )}

          {currentSection === 'reminders' && (
            <SmartRemindersView
              onNavigate={(section, targetId) => {
                if (section === 'customers' && targetId) setSelectedCustomerId(targetId);
                if (section === 'subscriptions' && targetId) setFocusedSubscriptionId(targetId);
                if (section === 'sales' && targetId) setFocusedSaleId(targetId);
                if (section === 'payments' && targetId) setFocusedPaymentId(targetId);
                if (section === 'invoices' && targetId) setFocusedInvoiceId(targetId);
                setCurrentSection(section);
              }}
              onRenewSubscription={handleRenewFromDashboard}
              onAddPayment={handleAddPaymentForSale}
            />
          )}

          {currentSection === 'settings' && <SettingsView
            initialSection={settingsStartSection}
            onOpenIntegrity={() => setCurrentSection('data-integrity')}
            onNavigate={setCurrentSection}
          />}
          {currentSection === 'search' && <SearchResultsView query={searchQuery} onSelectResult={selectSearchResult} />}
          </Suspense>
          </LazyViewErrorBoundary>
          )}

          {currentSection === 'notifications' && (
            <NotificationsView
              onNavigateToNotification={(section, entityId) => {
                if (section === 'customers' && entityId) setSelectedCustomerId(entityId);
                if (section === 'accounts' && entityId) setFocusedAccountId(entityId);
                if (section === 'services' && entityId) setFocusedServiceId(entityId);
                if (section === 'subscriptions' && entityId) setFocusedSubscriptionId(entityId);
                if (section === 'sales' && entityId) setFocusedSaleId(entityId);
                if (section === 'payments' && entityId) setFocusedPaymentId(entityId);
                if (section === 'invoices' && entityId) setFocusedInvoiceId(entityId);
                setCurrentSection(section);
              }}
            />
          )}
        </main>
      </div>

      {/* Global New Sale Workflow Modal */}
      {isNewSaleOpen && (
        <Suspense fallback={null}>
        <NewSaleModal
          isOpen={isNewSaleOpen}
          onClose={() => {
            setIsNewSaleOpen(false);
            setNewSalePreselectedCustomer(undefined);
            setNewSalePreselectedService(undefined);
            setNewSaleResourcePreset(undefined);
          }}
          preselectedCustomerId={newSalePreselectedCustomer}
          preselectedServiceId={newSalePreselectedService}
          preselectedAccountId={newSaleResourcePreset?.accountId}
          preselectedProfileId={newSaleResourcePreset?.profileId}
          preselectedPlanId={newSaleResourcePreset?.planId}
          onViewSubscription={subscriptionId => {
            setFocusedSubscriptionId(subscriptionId);
            setCurrentSection('subscriptions');
          }}
          onViewCustomer={handleSelectCustomer}
          onViewSale={saleId => {
            setFocusedSaleId(saleId);
            setCurrentSection('sales');
          }}
          onViewAccounts={() => {
            setIsNewSaleOpen(false);
            setCurrentSection('accounts');
          }}
          onAddService={handleAddServiceFromSale}
        />
        </Suspense>
      )}
    </div>
  );
};

export default function App({ currentUser, onLogout }: { currentUser: CurrentAdminUser; onLogout: () => void }) {
  useEffect(() => {
    registerPwa();
  }, []);

  return (
    <AppProvider currentUser={currentUser}>
      <ToastProvider>
        <WhatsAppCommunicationProvider>
          <MainAppLayout onLogout={onLogout} />
        </WhatsAppCommunicationProvider>
      </ToastProvider>
    </AppProvider>
  );
}
