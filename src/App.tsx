/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/common/Toast';
import { Sidebar, NavSection } from './components/navigation/Sidebar';
import { TopNav } from './components/navigation/TopNav';
import { DashboardView } from './components/views/DashboardView';
import type { CashbookAction } from './components/views/CashbookView';
import type { Subscription } from './types';
import type { CustomerCrmQuickFilter } from './utils/customerCrm';
import { recordRecentSearchItem } from './services/globalSearch';
import type { GlobalSearchResult } from './services/globalSearch';
import type { QuickAction } from './components/navigation/CommandCenter';
import { useApp } from './context/AppContext';
import { productBrand } from './config/brand';
import { WhatsAppCommunicationProvider } from './components/whatsapp/WhatsAppCommunication';

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
const ReportsView = lazy(() => import('./components/views/ReportsView').then(module => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then(module => ({ default: module.SettingsView })));
const NotificationsView = lazy(() => import('./components/views/NotificationsView').then(module => ({ default: module.NotificationsView })));
const SmartRemindersView = lazy(() => import('./components/views/SmartRemindersView').then(module => ({ default: module.SmartRemindersView })));
const SearchResultsView = lazy(() => import('./components/views/SearchResultsView').then(module => ({ default: module.SearchResultsView })));
const NewSaleModal = lazy(() => import('./components/modals/NewSaleModal').then(module => ({ default: module.NewSaleModal })));

const sectionPaths: Record<NavSection, string> = {
  dashboard: '/dashboard',
  customers: '/customers',
  services: '/services',
  accounts: '/accounts',
  profiles: '/profiles',
  subscriptions: '/subscriptions',
  sales: '/sales',
  payments: '/payments',
  cashbook: '/cashbook',
  'financial-control': '/financial-control',
  'data-integrity': '/data-integrity',
  expenses: '/expenses',
  'daily-closing': '/daily-closing',
  invoices: '/invoices',
  history: '/history',
  reports: '/reports',
  settings: '/settings',
  notifications: '/notifications',
  reminders: '/reminders',
  search: '/search',
};
const getSectionForPath = (pathname: string): NavSection =>
  (Object.entries(sectionPaths).find(([, path]) => path === pathname.replace(/\/+$/, '') || path === pathname)?.[0] as NavSection | undefined)
  || 'dashboard';

const MainAppLayout: React.FC = () => {
  const { currentBusiness } = useApp();
  // Navigation State
  const [currentSection, setCurrentSectionState] = useState<NavSection>(() =>
    typeof window === 'undefined' ? 'dashboard' : getSectionForPath(window.location.pathname)
  );
  const setCurrentSection = (section: NavSection) => {
    setCurrentSectionState(section);
    const nextPath = sectionPaths[section];
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({ section }, '', nextPath);
    }
  };
  const [settingsStartSection, setSettingsStartSection] = useState<'data' | undefined>();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Global New Sale Modal
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [newSalePreselectedCustomer, setNewSalePreselectedCustomer] = useState<string | undefined>(undefined);
  const [newSalePreselectedService, setNewSalePreselectedService] = useState<string | undefined>(undefined);
  const [paymentPreselectedCustomerId, setPaymentPreselectedCustomerId] = useState<string | undefined>();
  const [paymentPreselectedSaleId, setPaymentPreselectedSaleId] = useState<string | undefined>();

  // Selected customer for customer details drawer/modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerQuickFilter, setCustomerQuickFilter] = useState<CustomerCrmQuickFilter | undefined>();
  const [focusedAccountId, setFocusedAccountId] = useState<string | undefined>();
  const [accountServiceFilterId, setAccountServiceFilterId] = useState<string | undefined>();
  const [profileServiceFilterId, setProfileServiceFilterId] = useState<string | undefined>();
  const [subscriptionServiceFilterId, setSubscriptionServiceFilterId] = useState<string | undefined>();
  const [customerServiceFilterId, setCustomerServiceFilterId] = useState<string | undefined>();
  const [focusedServiceId, setFocusedServiceId] = useState<string | undefined>();
  const [focusedSubscriptionId, setFocusedSubscriptionId] = useState<string | undefined>();
  const [focusedSaleId, setFocusedSaleId] = useState<string | undefined>();
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | undefined>();
  const [focusedPaymentId, setFocusedPaymentId] = useState<string | undefined>();
  const [cashbookTarget, setCashbookTarget] = useState<{ accountId?: string; action?: CashbookAction }>({});
  const [expenseCreateRequest, setExpenseCreateRequest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [createRequests, setCreateRequests] = useState({ customer: 0, service: 0, account: 0, payment: 0 });
  const lastRecentView = useRef('');

  useEffect(() => {
    const handlePopState = () => setCurrentSectionState(getSectionForPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const pageNames: Record<NavSection, string> = {
      dashboard: 'Dashboard',
      customers: 'Customers',
      services: 'Services',
      accounts: 'Accounts',
      profiles: 'Profiles',
      subscriptions: 'Subscriptions',
      sales: 'Sales',
      payments: 'Payments',
      cashbook: 'Cashbook',
      'financial-control': 'Financial Control',
      'data-integrity': 'Data Integrity & Recovery',
      expenses: 'Expenses',
      'daily-closing': 'Daily Closing',
      invoices: 'Invoices',
      history: 'History',
      reports: 'Reports',
      settings: 'Settings',
      notifications: 'Notifications',
      reminders: 'Smart Reminders',
      search: 'Search',
    };
    document.title = `${productBrand.name} — ${pageNames[currentSection]}`;
  }, [currentSection]);

  // Direct Renewal Target
  const [renewTargetSub, setRenewTargetSub] = useState<Subscription | null>(null);

  const handleOpenNewSale = (customerId?: string, serviceId?: string) => {
    setNewSalePreselectedCustomer(customerId);
    setNewSalePreselectedService(serviceId);
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
    if (action === 'sale' || action === 'invoice' || action === 'subscription') {
      handleOpenNewSale();
      return;
    }
    const section = action === 'customer' ? 'customers'
      : action === 'service' ? 'services'
        : action === 'account' ? 'accounts' : 'payments';
    setCurrentSection(section);
    setCreateRequests(previous => ({ ...previous, [action]: previous[action] + 1 }));
  };
  const markCreateRequestHandled = (action: 'customer' | 'service' | 'account' | 'payment') => {
    setCreateRequests(previous => previous[action] === 0 ? previous : { ...previous, [action]: 0 });
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={section => {
          if (section === 'settings') setSettingsStartSection(undefined);
          setCurrentSection(section);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsedDesktop={isSidebarCollapsed}
        onToggleDesktop={() => setIsSidebarCollapsed(collapsed => !collapsed)}
      />

      {/* Main Content Area */}
      <div className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Sticky Top Navigation */}
        <TopNav
          onOpenMobile={() => setIsMobileSidebarOpen(true)}
          isMobileNavOpen={isMobileSidebarOpen}
          onOpenNewSale={() => handleOpenNewSale()}
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

        {/* View Content */}
        <main className="app-main flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="page-container" role="status" aria-live="polite">
              <div className="surface-card flex min-h-32 items-center justify-center gap-3 p-5 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
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

          {currentSection === 'accounts' && <AccountsView selectedAccountId={focusedAccountId} serviceFilterId={accountServiceFilterId} createRequest={createRequests.account} onCreateRequestHandled={() => markCreateRequestHandled('account')} />}

          {currentSection === 'profiles' && <ProfilesView serviceFilterId={profileServiceFilterId} />}

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
              if (activity.customerId) {
                setSelectedCustomerId(activity.customerId);
                setCurrentSection('customers');
              } else if (activity.invoiceId) {
                setFocusedInvoiceId(activity.invoiceId);
                setCurrentSection('invoices');
              } else if (activity.paymentId) {
                setFocusedPaymentId(activity.paymentId);
                setCurrentSection('payments');
              } else if (activity.saleId) {
                setFocusedSaleId(activity.saleId);
                setCurrentSection('sales');
              } else if (activity.subscriptionId) {
                setFocusedSubscriptionId(activity.subscriptionId);
                setCurrentSection('subscriptions');
              } else if (activity.serviceId) {
                setFocusedServiceId(activity.serviceId);
                setCurrentSection('services');
              } else if (activity.financialAccountId || activity.entityType === 'expense' || activity.entityType === 'income' || activity.entityType === 'transfer' || activity.entityType === 'adjustment') {
                setCurrentSection('cashbook');
              } else if (activity.accountId || activity.profileId) {
                setFocusedAccountId(activity.accountId);
                setCurrentSection('accounts');
              } else if (activity.entityType === 'reminder') {
                setCurrentSection('reminders');
              }
            }} />
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
          />}
          {currentSection === 'search' && <SearchResultsView query={searchQuery} onSelectResult={selectSearchResult} />}
          </Suspense>

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
          }}
          preselectedCustomerId={newSalePreselectedCustomer}
          preselectedServiceId={newSalePreselectedService}
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

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <WhatsAppCommunicationProvider>
          <MainAppLayout />
        </WhatsAppCommunicationProvider>
      </ToastProvider>
    </AppProvider>
  );
}
