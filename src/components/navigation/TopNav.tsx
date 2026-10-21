import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Menu,
  Search,
  Plus,
  Bell,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  X,
  UserRound,
  Check,
  CheckCheck,
  AlertTriangle,
  CircleAlert,
  CreditCard,
  FileText,
  RefreshCw,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NavSection } from './Sidebar';
import { ProductLogo } from '../common/BrandLockup';
import { formatAppDateTime } from '../../utils/dateUtils';
import type { BusinessNotification } from '../../types';
import type { QuickAction } from './CommandCenter';
import type { GlobalSearchResult } from '../../services/globalSearch';
import { requestPwaUpdate } from '../../services/pwaService';
import { usePwaState } from '../../hooks/usePwaState';

const CommandCenter = lazy(() => import('./CommandCenter').then(module => ({ default: module.CommandCenter })));

interface TopNavProps {
  onLogout: () => void;
  onOpenMobile: () => void;
  isMobileNavOpen: boolean;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenNewSale: () => void;
  hideNewSaleAction?: boolean;
  onNavigate: (section: NavSection) => void;
  onNavigateToNotification?: (section: NavSection, entityId?: string) => void;
  onSelectSearchResult: (result: GlobalSearchResult) => void;
  onViewAllSearchResults: (query: string) => void;
  onQuickAction: (action: QuickAction) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onLogout,
  onOpenMobile,
  isMobileNavOpen,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenNewSale,
  hideNewSaleAction = false,
  onNavigate,
  onNavigateToNotification,
  onSelectSearchResult,
  onViewAllSearchResults,
  onQuickAction,
}) => {
  const {
    currentUser,
    currentBusinessName,
    isDark,
    toggleDarkMode,
    language,
    setLanguage,
    currency,
    setCurrency,
    t,
    settings,
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useApp();
  const pwa = usePwaState();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [isConnectionNoticeDismissed, setIsConnectionNoticeDismissed] = useState(false);
  const businessLogoUrl = settings.invoiceLogoDataUrl?.trim() || settings.invoiceLogoUrl?.trim();
  const [businessLogoFailed, setBusinessLogoFailed] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notificationCloseButtonRef = useRef<HTMLButtonElement>(null);
  const notificationWasOpen = useRef(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsConnectionNoticeDismissed(false);
  }, [pwa.isOnline, pwa.updateAvailable, pwa.updatePending]);

  useEffect(() => {
    setBusinessLogoFailed(false);
  }, [businessLogoUrl]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node) &&
        !notifPanelRef.current?.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      const target = e.target;
      const isTypingTarget = target instanceof HTMLElement && (
        target.isContentEditable
        || target.matches('input, textarea, select')
      );
      if (!e.defaultPrevented && !isTypingTarget && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandCenter(true);
      }
      if (e.key === 'Escape') {
        setShowCommandCenter(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, []);

  useEffect(() => {
    if (showNotifications) {
      notificationCloseButtonRef.current?.focus();
      notificationWasOpen.current = true;
    } else if (notificationWasOpen.current) {
      notifRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Notifications"]')?.focus();
      notificationWasOpen.current = false;
    }
  }, [showNotifications]);

  useEffect(() => {
    if (!showNotifications) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !notifPanelRef.current) return;
      const focusable = notifPanelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [showNotifications]);

  const handleNotificationClick = (notification: (typeof notifications)[number]) => {
    markNotificationAsRead(notification.id);
    if (onNavigateToNotification) {
      onNavigateToNotification(notification.section, notification.entityId);
    } else {
      onNavigate(notification.section);
    }
    setShowNotifications(false);
  };

  const getNotificationIcon = (notification: BusinessNotification) => {
    const iconClass = 'h-4 w-4 shrink-0';
    switch (notification.priority) {
      case 'critical':
        return <AlertTriangle className={`${iconClass} text-rose-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-amber-600`} />;
      case 'success':
        return notification.title.toLowerCase().includes('payment')
          ? <CreditCard className={`${iconClass} text-emerald-600`} />
          : <Check className={`${iconClass} text-emerald-600`} />;
      case 'info':
        if (notification.title.toLowerCase().includes('invoice')) {
          return <FileText className={`${iconClass} text-blue-500`} />;
        }
        if (notification.title.toLowerCase().includes('subscription')) {
          return <RefreshCw className={`${iconClass} text-blue-500`} />;
        }
        if (notification.title.toLowerCase().includes('profile')) {
          return <UserCheck className={`${iconClass} text-blue-500`} />;
        }
        return <CircleAlert className={`${iconClass} text-blue-500`} />;
    }
  };

  const userName = currentUser?.name || settings.adminName || 'Demo User';
  const activeBusinessName = currentBusinessName || settings.storeName || 'Not set';
  const userEmail = currentUser?.email || settings.adminEmail;
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
  const searchShortcut = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
    ? '⌘K'
    : 'Ctrl K';

  return (
    <>
      <header className="app-topbar flex min-h-[60px] min-w-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-2.5 transition-colors dark:border-slate-800/80 dark:bg-[#111126] sm:gap-3 sm:px-5 lg:px-6">
      <div className="app-topbar-brand-group flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="app-icon-button mobile-sidebar-toggle -ml-1 lg:hidden"
          aria-label={isMobileNavOpen
            ? (language === 'bn' ? 'নেভিগেশন বন্ধ করুন' : 'Close navigation')
            : (language === 'bn' ? 'নেভিগেশন খুলুন' : 'Open navigation')}
          aria-controls="primary-navigation"
          aria-expanded={isMobileNavOpen}
        >
          {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="app-icon-button app-topbar-collapse hidden rounded-lg md:inline-flex"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isSidebarCollapsed}
          aria-controls="primary-navigation"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="app-topbar-brand-link md:hidden"
          aria-label={language === 'bn' ? 'ড্যাশবোর্ডে যান' : 'Go to dashboard'}
          title={language === 'bn' ? 'ড্যাশবোর্ডে যান' : 'Go to dashboard'}
        >
          <ProductLogo size="compact" markOnly className="app-topbar-brand" />
        </button>
        <div className="app-topbar-business hidden md:flex">
          <span className="app-topbar-business-divider" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="app-topbar-business-icon"
            aria-label={language === 'bn' ? 'ড্যাশবোর্ডে যান' : 'Go to dashboard'}
            title={language === 'bn' ? 'ড্যাশবোর্ডে যান' : 'Go to dashboard'}
          >
            {businessLogoUrl && !businessLogoFailed
              ? <img
                src={businessLogoUrl}
                alt=""
                className="app-topbar-business-logo-image"
                onError={() => setBusinessLogoFailed(true)}
              />
              : <ProductLogo size="compact" markOnly className="app-topbar-business-logo" />}
          </button>
          <span className="app-topbar-business-copy">
            <span className="app-topbar-business-label">{language === 'bn' ? 'বর্তমান ব্যবসা' : 'Current business'}</span>
            <strong title={activeBusinessName}>{activeBusinessName}</strong>
          </span>
        </div>
      </div>

      <div className="app-topbar-search-trigger-wrap md:hidden">
      <button
        type="button"
        onClick={() => setShowCommandCenter(true)}
        className="app-icon-button global-search-trigger lg:hidden"
        aria-label={`${language === 'bn' ? 'সার্চ খুলুন' : 'Open search'} (${searchShortcut})`}
        title={`${language === 'bn' ? 'সার্চ খুলুন' : 'Open search'} (${searchShortcut})`}
        aria-expanded={showCommandCenter}
        aria-haspopup="dialog"
      >
        <Search className="h-[18px] w-[18px] shrink-0" />
        <span className="mobile-search-label">{language === 'bn' ? 'সার্চ' : 'Search'}</span>
      </button>
      </div>

      <div className="app-topbar-search relative hidden min-w-0 md:block">
        <Search className="app-topbar-search-icon pointer-events-none absolute left-2.5 h-3.5 w-3.5" />
        <input
          type="text"
          placeholder="Search customers, services, sales..."
          readOnly
          onClick={() => setShowCommandCenter(true)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setShowCommandCenter(true);
            }
          }}
          aria-label="Open global search"
          aria-haspopup="dialog"
          className="app-search-input h-10 w-full py-2 pl-10 pr-24 text-sm"
        />
        <span className="app-topbar-search-shortcut absolute right-2.5 hidden items-center font-mono text-[10px] sm:inline-flex">{searchShortcut}</span>
      </div>

      <div className="app-topbar-tools">
        <div className="app-topbar-system-group">
      <span className={`app-connection-status ${pwa.isOnline ? 'is-online' : 'is-offline'}`} role="status" aria-label={pwa.isOnline ? 'Online' : 'Working offline'} title={pwa.isOnline ? 'Online' : 'Working offline'}>
        {pwa.isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span>{pwa.isOnline ? 'Online' : 'Offline'}</span>
      </span>
        {/* Language Switcher [ বাংলা | EN ] - Desktop Only */}
        <div className="hidden lg:flex app-control-group">
          <button
            onClick={() => setLanguage('bn')}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-xs ${
              language === 'bn'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
            aria-pressed={language === 'bn'}
          >
            বাংলা
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-xs ${
              language === 'en'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
            aria-pressed={language === 'en'}
          >
            EN
          </button>
        </div>

        {/* Currency Switcher [ ৳ BDT | $ USD ] - Desktop Only */}
        <div className="hidden lg:flex app-control-group">
          <button
            onClick={() => setCurrency('BDT')}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-xs font-mono ${
              currency === 'BDT'
                ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
            aria-pressed={currency === 'BDT'}
          >
            ৳ BDT
          </button>
          <button
            onClick={() => setCurrency('USD')}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-xs font-mono ${
              currency === 'USD'
                ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
            aria-pressed={currency === 'USD'}
          >
            $ USD
          </button>
        </div>
        </div>

        {/* Primary quick action */}
        <span className="app-topbar-divider" aria-hidden="true" />
        <div className="app-topbar-action-group">
        {!hideNewSaleAction && (
          <button
            onClick={onOpenNewSale}
            className="app-new-sale"
            aria-label={t('newSale')}
            title={t('newSale')}
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
            <span className="app-new-sale__label">{t('newSale')}</span>
          </button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="app-icon-button relative"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="app-notification-count" aria-label={`${unreadNotificationCount} unread notifications`}>
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && createPortal(
            <div
              className="app-notification-overlay fixed inset-0 z-[70] flex justify-end bg-slate-950/25 p-0 sm:p-3 lg:p-4"
              onMouseDown={event => {
                if (event.target === event.currentTarget) setShowNotifications(false);
              }}
            >
              <section
                ref={notifPanelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                className="app-notification-panel relative flex h-full w-full max-w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:h-auto sm:max-h-[min(82vh,680px)] sm:w-[min(26rem,calc(100vw-2rem))] sm:rounded-2xl"
              >
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {language === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                      {language === 'bn'
                        ? `${unreadNotificationCount} অপঠিত`
                        : `${unreadNotificationCount} unread`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>{language === 'bn' ? 'সব পড়া হয়েছে' : 'Mark all as read'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      ref={notificationCloseButtonRef}
                      className="app-icon-button h-9 w-9"
                      aria-label={language === 'bn' ? 'বন্ধ করুন' : 'Close notifications'}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
                      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Bell className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {language === 'bn' ? 'সবকিছু আপ টু ডেট' : "You're all caught up"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {language === 'bn' ? 'নতুন কোনো নোটিফিকেশন নেই।' : 'No new notifications.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.slice(0, 50).map(notification => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`flex min-h-11 w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-500 dark:hover:bg-slate-800/70 sm:px-5 ${
                            !notification.read ? 'bg-slate-50/80 dark:bg-slate-800/40' : ''
                          }`}
                        >
                          <span role="img" aria-label={`${notification.priority} priority`} className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            notification.priority === 'critical'
                              ? 'bg-rose-50 dark:bg-rose-950/40'
                              : notification.priority === 'warning'
                                ? 'bg-amber-50 dark:bg-amber-950/40'
                                : notification.priority === 'success'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40'
                                  : 'bg-blue-50 dark:bg-blue-950/40'
                          }`}>
                            {getNotificationIcon(notification)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-3">
                              <span className={`text-sm text-slate-900 dark:text-white ${
                                !notification.read ? 'font-bold' : 'font-semibold'
                              }`}>
                                {notification.title}
                              </span>
                              {!notification.read && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                              )}
                            </span>
                            <span className="mt-1 block break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                              {notification.message}
                            </span>
                            <span className="mt-1.5 block text-[11px] text-slate-400">
                              {formatAppDateTime(notification.createdAt, language, { timeZone: settings.businessProfile?.timeZone })}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="border-t border-slate-200 p-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('notifications');
                      setShowNotifications(false);
                    }}
                    className="min-h-11 w-full rounded-lg px-3 py-2.5 text-center text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {language === 'bn' ? 'সব নোটিফিকেশন দেখুন' : 'View all notifications'}
                  </button>
                </footer>
              </section>
            </div>,
            document.body
          )}
        </div>

        {/* Theme Toggle - Desktop Only */}
        <button
          onClick={toggleDarkMode}
          className="app-icon-button desktop-theme-control hidden lg:flex"
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {currentUser?.isDemo && (
          <span
            className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200 sm:px-2.5 sm:text-xs"
            aria-label="Demo Mode"
            title="Demo Mode — isolated sample data"
          >
            {language === 'bn' ? 'ডেমো' : 'Demo Mode'}
          </span>
        )}

        {/* Profile Menu */}
        <div ref={userRef} className="relative pl-0.5">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="app-profile-button"
            aria-label={language === 'bn' ? 'প্রোফাইল মেনু' : 'Profile menu'}
            aria-expanded={showUserMenu}
            aria-haspopup="menu"
          >
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              userInitials || <UserRound className="h-4 w-4" />
            )}
          </button>

          {showUserMenu && (
            <div className="app-popover absolute right-0 mt-2 w-56 p-2 z-50" role="menu">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {userEmail}
                </div>
              </div>
              <div className="py-1">
                {currentUser?.isDemo && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="app-profile-option w-full text-violet-700 dark:text-violet-300"
                    role="menuitem"
                  >
                    {language === 'bn' ? 'ডেমো মোড থেকে বের হন' : 'Exit Demo Mode'}
                  </button>
                )}
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setShowUserMenu(false);
                  }}
                  className="app-profile-option w-full"
                  role="menuitem"
                >
                  {t('nav_settings')}
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="app-profile-option w-full text-rose-600 dark:text-rose-300"
                  role="menuitem"
                >
                  {language === 'bn' ? 'সাইন আউট' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>

    {(!pwa.isOnline || pwa.updateAvailable) && !isConnectionNoticeDismissed && <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs sm:px-6 ${pwa.isOnline ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`} role="status" aria-live="polite">
      <span className="min-w-0 flex-1">{pwa.updatePending ? 'Update queued until current work is complete.' : !pwa.isOnline ? 'Working offline — local business data remains available on this device.' : 'New version available.'}</span>
      {pwa.updateAvailable && !pwa.updatePending && <button type="button" onClick={requestPwaUpdate} className="shrink-0 rounded-lg border border-current/30 px-3 py-1.5 font-semibold hover:bg-black/5 dark:hover:bg-white/5">Update</button>}
      <button
        type="button"
        onClick={() => setIsConnectionNoticeDismissed(true)}
        aria-label={language === 'bn' ? 'নোটিশ বন্ধ করুন' : 'Dismiss notification'}
        title={language === 'bn' ? 'নোটিশ বন্ধ করুন' : 'Dismiss notification'}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current dark:hover:bg-white/5"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>}

    {showCommandCenter && (
      <Suspense fallback={null}>
        <CommandCenter
          isOpen={showCommandCenter}
          onClose={() => setShowCommandCenter(false)}
          onSelect={onSelectSearchResult}
          onViewAll={onViewAllSearchResults}
          onNavigate={onNavigate}
          onQuickAction={onQuickAction}
        />
      </Suspense>
    )}
  </>
  );
};
