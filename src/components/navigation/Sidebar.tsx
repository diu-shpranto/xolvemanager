import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  KeyRound,
  UserCheck,
  CreditCard,
  Receipt,
  FileText,
  Wallet,
  Landmark,
  CalendarCheck,
  History,
  BarChart3,
  Settings,
  ShieldCheck,
  Database,
  Bell,
  BellRing,
  Sun,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProductLogo } from '../common/BrandLockup';

export type NavSection =
  | 'dashboard'
  | 'customers'
  | 'services'
  | 'accounts'
  | 'profiles'
  | 'subscriptions'
  | 'sales'
  | 'payments'
  | 'cashbook'
  | 'financial-control'
  | 'data-integrity'
  | 'expenses'
  | 'daily-closing'
  | 'invoices'
  | 'history'
  | 'reports'
  | 'settings'
  | 'notifications'
  | 'reminders'
  | 'search';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsedDesktop: boolean;
  onToggleDesktop: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpenMobile,
  onCloseMobile,
  isCollapsedDesktop,
  onToggleDesktop,
}) => {
  const {
    stats,
    t,
    settings,
    currentBusinessName,
    language,
    setLanguage,
    currency,
    setCurrency,
    isDark,
    toggleDarkMode,
  } = useApp();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = React.useRef<HTMLElement | null>(null);
  const activeBusinessName = currentBusinessName || settings.storeName || 'Not set';

  const navItems = [
    {
      id: 'dashboard' as NavSection,
      label: t('nav_dashboard'),
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'customers' as NavSection,
      label: t('nav_customers'),
      icon: Users,
      badge: stats.totalCustomers,
    },
    {
      id: 'services' as NavSection,
      label: t('nav_services'),
      icon: Layers,
      badge: stats.totalServices,
    },
    {
      id: 'accounts' as NavSection,
      label: t('nav_accounts'),
      icon: KeyRound,
      badge: stats.totalAccounts,
    },
    {
      id: 'profiles' as NavSection,
      label: t('nav_profiles'),
      icon: UserCheck,
      badge: null,
    },
    {
      id: 'subscriptions' as NavSection,
      label: t('nav_subscriptions'),
      icon: CreditCard,
      badge: stats.expiringSoonCount > 0 ? stats.expiringSoonCount : null,
      badgeAlert: stats.expiringSoonCount > 0,
    },
    {
      id: 'sales' as NavSection,
      label: language === 'bn' ? t('nav_sales') : 'Sales / Orders',
      icon: Receipt,
      badge: null,
    },
    {
      id: 'payments' as NavSection,
      label: t('nav_payments'),
      icon: Wallet,
      badge: null,
    },
    {
      id: 'cashbook' as NavSection,
      label: language === 'bn' ? 'ক্যাশবুক' : 'Cashbook',
      icon: Landmark,
      badge: null,
    },
    {
      id: 'financial-control' as NavSection,
      label: language === 'bn' ? 'আর্থিক নিয়ন্ত্রণ' : 'Financial Control',
      icon: ShieldCheck,
      badge: null,
    },
    {
      id: 'data-integrity' as NavSection,
      label: language === 'bn' ? 'ডেটা সুরক্ষা' : 'Data Integrity',
      icon: Database,
      badge: null,
    },
    {
      id: 'expenses' as NavSection,
      label: language === 'bn' ? 'খরচ' : 'Expenses',
      icon: Receipt,
      badge: null,
    },
    {
      id: 'daily-closing' as NavSection,
      label: language === 'bn' ? 'দৈনিক সমাপ্তি' : 'Daily Closing',
      icon: CalendarCheck,
      badge: null,
    },
    {
      id: 'invoices' as NavSection,
      label: language === 'bn' ? 'ইনভয়েস' : 'Invoices',
      icon: FileText,
      badge: null,
    },
    {
      id: 'history' as NavSection,
      label: language === 'bn' ? t('nav_history') : 'Activity History',
      icon: History,
      badge: null,
    },
    {
      id: 'reports' as NavSection,
      label: language === 'bn' ? t('nav_reports') : 'Reports & Analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'notifications' as NavSection,
      label: language === 'bn' ? 'নোটিফিকেশন' : 'Notifications',
      icon: Bell,
      badge: null,
    },
    {
      id: 'reminders' as NavSection,
      label: language === 'bn' ? 'স্মার্ট রিমাইন্ডার' : 'Smart Reminders',
      icon: BellRing,
      badge: null,
    },
    {
      id: 'settings' as NavSection,
      label: t('nav_settings'),
      icon: Settings,
      badge: null,
    },
  ];

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  useEffect(() => {
    if (!isOpenMobile) return;

    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previouslyFocusedElement.current?.focus();
      previouslyFocusedElement.current = null;
    };
  }, [isOpenMobile, onCloseMobile]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        id="primary-navigation"
        aria-label="Main navigation"
        data-collapsed={isCollapsedDesktop}
        className={`app-sidebar fixed top-0 bottom-0 left-0 z-40 flex w-[288px] max-w-[calc(100vw-16px)] flex-col border-r border-slate-200/80 bg-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.02),18px_0_42px_-30px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[width,transform] duration-200 ease-out dark:border-slate-800/80 dark:bg-[#0E131F]/90 motion-reduce:transition-none lg:translate-x-0 ${
          isCollapsedDesktop ? 'lg:w-16' : 'lg:w-64'
        } ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Application brand identity */}
        <div className={`app-sidebar-brand flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 dark:border-slate-800/80 dark:bg-slate-900/60 lg:h-[68px] ${isCollapsedDesktop ? 'lg:justify-center lg:px-2' : ''}`}>
          <div className={`flex min-w-0 items-center gap-3 lg:block ${isCollapsedDesktop ? 'lg:flex lg:justify-center' : ''}`}>
            <div className="flex min-w-0 items-center gap-3 lg:block">
              <ProductLogo size="compact" tone="inverse" showTagline className="max-w-full" />
            </div>
            <div className={`hidden items-center gap-1.5 text-[10px] leading-none text-slate-400 lg:flex ${isCollapsedDesktop ? 'lg:hidden' : 'lg:mt-1 lg:justify-center'}`}>
              <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              <span className="truncate" title={activeBusinessName}>
                Current Business: {activeBusinessName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleDesktop}
              className="app-icon-button hidden h-8 w-8 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white lg:inline-flex"
              aria-label={isCollapsedDesktop ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsedDesktop}
              title={isCollapsedDesktop ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsedDesktop ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              ref={closeButtonRef}
              className="app-icon-button h-8 w-8 shrink-0 rounded-lg border border-white/[0.06] text-slate-300 hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation list */}
        <nav className={`app-sidebar-nav min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3.5 transition-all duration-200 lg:space-y-5 lg:py-4 ${isCollapsedDesktop ? 'lg:px-2' : ''}`}>
          {[
            {
              label: language === 'bn' ? 'ওভারভিউ' : 'OVERVIEW',
              items: navItems.filter(item => item.id === 'dashboard'),
            },
            {
              label: language === 'bn' ? 'পরিচালনা' : 'MANAGE',
              items: navItems.filter(item =>
                ['customers', 'services', 'accounts', 'profiles'].includes(item.id)
              ),
            },
            {
              label: language === 'bn' ? 'বিক্রয় ও অর্থ' : 'REVENUE',
              items: navItems.filter(item =>
                ['subscriptions', 'sales', 'payments', 'cashbook', 'expenses', 'daily-closing', 'financial-control', 'invoices'].includes(item.id)
              ),
            },
            {
              label: language === 'bn' ? 'বিশ্লেষণ' : 'INSIGHTS',
              items: navItems.filter(item => ['history', 'reports', 'notifications', 'reminders', 'data-integrity'].includes(item.id)),
            },
            {
              label: language === 'bn' ? 'পছন্দসমূহ' : 'PREFERENCES',
              items: navItems.filter(item => item.id === 'settings'),
            },
          ].map(group => (
            <section key={group.label} aria-label={group.label}>
              <div className={`app-nav-group-label px-3 pb-1.5 text-[10px] font-medium tracking-[0.12em] text-slate-400 uppercase lg:pb-2 lg:text-xs lg:font-semibold lg:tracking-wider ${isCollapsedDesktop ? 'lg:sr-only' : ''}`}>
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map(item => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`app-nav-item relative flex h-[42px] w-full cursor-pointer items-center justify-between rounded-[10px] border border-transparent px-3 py-2 text-[13px] font-medium transition-all duration-200 group lg:h-11 lg:rounded-xl lg:py-2.5 ${
                  isCollapsedDesktop ? 'lg:justify-center lg:px-0' : ''
                } ${
                  isActive
                    ? 'is-active bg-emerald-50/90 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 lg:border-emerald-200/60 lg:shadow-2xs dark:lg:border-emerald-800/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                title={isCollapsedDesktop ? item.label : undefined}
              >
                <div className={`flex min-w-0 items-center gap-2.5 ${isCollapsedDesktop ? 'lg:justify-center' : ''}`}>
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-colors lg:h-4 lg:w-4 ${
                      isActive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span className={`truncate ${isCollapsedDesktop ? 'lg:hidden' : ''}`}>{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span
                    className={`app-nav-badge ml-1.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium transition-all duration-200 ${
                      isCollapsedDesktop ? 'lg:absolute lg:right-0.5 lg:top-0.5 lg:ml-0 lg:px-1 lg:py-0' : ''
                    } ${item.badgeAlert ? 'app-nav-badge--alert' : isActive ? 'app-nav-badge--active' : ''} ${
                      item.badgeAlert
                        ? 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 lg:ring-1 lg:ring-amber-500/20'
                        : isActive
                        ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 lg:bg-emerald-100/80 dark:lg:bg-emerald-900/60'
                        : 'bg-slate-800/80 text-slate-400 dark:bg-slate-800 dark:text-slate-400 lg:bg-slate-100 lg:text-slate-500 dark:lg:bg-slate-800 dark:lg:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
                })}
              </div>
            </section>
          ))}
        </nav>

        {/* Responsive Quick Controls: Language, Currency & Theme */}
        <div className={`app-sidebar-footer mx-3 shrink-0 border-t border-white/[0.07] pb-[max(12px,env(safe-area-inset-bottom))] pt-3 ${isCollapsedDesktop ? 'lg:mx-1 lg:px-0.5' : 'lg:mx-3'}`}>
          <div className={`mb-2 flex items-center justify-between ${isCollapsedDesktop ? 'lg:justify-center' : ''}`}>
            <span className={`text-[10px] font-medium tracking-[0.12em] text-slate-500 ${isCollapsedDesktop ? 'lg:hidden' : ''}`}>
              {language === 'bn' ? 'পছন্দসমূহ' : 'Preferences'}
            </span>
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-slate-300 transition-all duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-500 ${isCollapsedDesktop ? 'lg:w-9 lg:justify-center lg:px-0' : ''}`}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isCollapsedDesktop ? (isDark ? 'Switch to light theme' : 'Switch to dark theme') : undefined}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span className={isCollapsedDesktop ? 'lg:hidden' : ''}>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          {isCollapsedDesktop && (
            <div className="mb-2 hidden grid-cols-2 gap-1 lg:grid">
              <button
                type="button"
                onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
                className="flex h-8 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08]"
                aria-label={`Language: ${language === 'bn' ? 'বাংলা' : 'English'}. Switch language`}
                title={`Language: ${language === 'bn' ? 'বাংলা' : 'English'}`}
              >
                {language === 'bn' ? 'বাং' : 'EN'}
              </button>
              <button
                type="button"
                onClick={() => setCurrency(currency === 'BDT' ? 'USD' : 'BDT')}
                className="flex h-8 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08]"
                aria-label={`Currency: ${currency}. Switch currency`}
                title={`Currency: ${currency}`}
              >
                {currency === 'BDT' ? '৳' : '$'}
              </button>
            </div>
          )}

          <div className={`grid grid-cols-2 gap-2 ${isCollapsedDesktop ? 'lg:hidden' : ''}`}>
            {/* Language toggle */}
            <div>
              <span className="mb-1 block text-[10px] text-slate-500">{language === 'bn' ? 'ভাষা' : 'Language'}</span>
              <div className="flex items-center rounded-lg bg-slate-950/45 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLanguage('bn')}
                  className={`flex-1 rounded-md py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    language === 'bn' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  aria-pressed={language === 'bn'}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`flex-1 rounded-md py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    language === 'en' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  aria-pressed={language === 'en'}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Currency toggle */}
            <div>
              <span className="mb-1 block text-[10px] text-slate-500">{language === 'bn' ? 'মুদ্রা' : 'Currency'}</span>
              <div className="flex items-center rounded-lg bg-slate-950/45 p-0.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setCurrency('BDT')}
                  className={`flex-1 rounded-md py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    currency === 'BDT' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  aria-pressed={currency === 'BDT'}
                >
                  ৳ BDT
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 rounded-md py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    currency === 'USD' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  aria-pressed={currency === 'USD'}
                >
                  $ USD
                </button>
              </div>
            </div>
          </div>

          <div className={`mt-1 flex items-center justify-between border-t border-white/[0.07] px-1 pt-2 text-xs text-slate-500 ${isCollapsedDesktop ? 'lg:justify-center lg:px-0' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
              </span>
              <span className={`text-[11px] font-medium text-slate-300 ${isCollapsedDesktop ? 'lg:hidden' : ''}`}>
              {language === 'bn' ? 'স্টোর অনলাইন' : 'Store Active'}
              </span>
            </div>
            <span className={`text-[10px] font-mono text-slate-500 ${isCollapsedDesktop ? 'lg:hidden' : ''}`}>
              • {stats.activeCount} {language === 'bn' ? 'সক্রিয়' : 'subs'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
