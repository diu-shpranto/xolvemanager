import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Menu,
  Search,
  Plus,
  Bell,
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
import { ProductLogo } from '../common/BrandLockup';
import { NavSection } from './Sidebar';
import { formatAppDateTime } from '../../utils/dateUtils';
import type { BusinessNotification } from '../../types';
import type { QuickAction } from './CommandCenter';
import type { GlobalSearchResult } from '../../services/globalSearch';
import { requestPwaUpdate } from '../../services/pwaService';
import { usePwaState } from '../../hooks/usePwaState';

const CommandCenter = lazy(() => import('./CommandCenter').then(module => ({ default: module.CommandCenter })));

interface TopNavProps {
  onOpenMobile: () => void;
  isMobileNavOpen: boolean;
  onOpenNewSale: () => void;
  onNavigate: (section: NavSection) => void;
  onNavigateToNotification?: (section: NavSection, entityId?: string) => void;
  onSelectSearchResult: (result: GlobalSearchResult) => void;
  onViewAllSearchResults: (query: string) => void;
  onQuickAction: (action: QuickAction) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenMobile,
  isMobileNavOpen,
  onOpenNewSale,
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
  const activeBusinessName = currentBusinessName || settings.storeName || 'Not set';
  const pwa = usePwaState();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notificationCloseButtonRef = useRef<HTMLButtonElement>(null);
  const notificationWasOpen = useRef(false);
  const userRef = useRef<HTMLDivElement>(null);

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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
      <header className="app-topbar sticky top-0 z-30 flex min-h-[60px] items-center justify-between gap-2 border-b border-slate-200/80 bg-white/80 px-2.5 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-[#0E131F]/85 sm:gap-3 sm:px-5 lg:px-7">
      {/* Mobile navigation and search; desktop global search */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 lg:max-w-[900px]">
        <button
          type="button"
          onClick={onOpenMobile}
          className="app-icon-button -ml-1 lg:hidden"
          aria-label={language === 'bn' ? 'নেভিগেশন খুলুন' : 'Open navigation'}
          aria-controls="primary-navigation"
          aria-expanded={isMobileNavOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowCommandCenter(true)}
          className="app-icon-button lg:hidden"
          aria-label={language === 'bn' ? 'সার্চ খুলুন' : 'Search'}
          aria-expanded={showCommandCenter}
          aria-haspopup="dialog"
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="min-w-0 max-w-[145px] lg:hidden">
          <ProductLogo size="compact" className="max-w-full" />
        </div>

        <div className="hidden min-w-0 shrink-0 items-center gap-3 lg:flex">
          <ProductLogo size="compact" showTagline className="max-w-[180px]" />
          <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 xl:block" aria-hidden="true" />
          <div className="hidden min-w-0 flex-col leading-tight xl:flex">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Current Business</span>
            <span className="max-w-[170px] truncate text-xs font-semibold text-slate-700 dark:text-slate-200" title={activeBusinessName}>
              {activeBusinessName}
            </span>
          </div>
        </div>

        {/* Global Search Input - Desktop only */}
        <div className="relative hidden min-w-0 flex-1 xl:block">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search customers, sales, invoices..."
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
              className="app-search-input h-9 w-full py-2 pl-9 pr-12 text-xs sm:text-[13px]"
            />
            <span className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">{searchShortcut}</span>
          </div>
        </div>
      </div>

      {/* Utility controls and primary action */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${pwa.isOnline ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`} role="status" aria-label={pwa.isOnline ? 'Online' : 'Working offline'} title={pwa.isOnline ? 'Online' : 'Working offline'}>
          {pwa.isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span className="hidden xl:inline">{pwa.isOnline ? 'Online' : 'Offline'}</span>
          <span className="sr-only">{pwa.isOnline ? 'Online' : 'Offline'}</span>
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
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
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
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
            aria-pressed={currency === 'USD'}
          >
            $ USD
          </button>
        </div>

        {/* Primary Action: + New Sale (Always visible on mobile & desktop) */}
        <button
          onClick={onOpenNewSale}
          className="app-new-sale"
          aria-label={t('newSale')}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">{t('newSale')}</span>
        </button>

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
              className="fixed inset-0 z-[70] flex justify-end bg-slate-950/25 p-0 sm:p-3 lg:p-4"
              onMouseDown={event => {
                if (event.target === event.currentTarget) setShowNotifications(false);
              }}
            >
              <section
                ref={notifPanelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                className="relative flex h-full w-full max-w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:h-auto sm:max-h-[min(82vh,680px)] sm:w-[min(26rem,calc(100vw-2rem))] sm:rounded-2xl"
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
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
                          className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600 dark:hover:bg-slate-800/70 sm:px-5 ${
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
                              <span className="sr-only">{notification.priority} priority</span>
                              {!notification.read && (
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
                              )}
                            </span>
                            <span className="mt-1 block break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                              {notification.message}
                            </span>
                            <span className="mt-1.5 block text-[11px] text-slate-400">
                              {formatAppDateTime(notification.createdAt, language)}
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
                    className="w-full rounded-lg px-3 py-2.5 text-center text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
            <div className="app-popover absolute right-0 mt-2 w-56 p-2 z-50 animate-in fade-in" role="menu">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {userEmail}
                </div>
              </div>
              <div className="py-1">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {(!pwa.isOnline || pwa.updateAvailable) && <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs sm:px-6 ${pwa.isOnline ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`} role="status" aria-live="polite">
      <span>{pwa.updatePending ? 'Update queued until current work is complete.' : !pwa.isOnline ? 'Working offline — local business data remains available on this device.' : 'New version available.'}</span>
      {pwa.updateAvailable && !pwa.updatePending && <button type="button" onClick={requestPwaUpdate} className="shrink-0 rounded-lg border border-current/30 px-3 py-1.5 font-semibold hover:bg-black/5 dark:hover:bg-white/5">Update</button>}
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
