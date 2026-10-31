import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, ArrowDown, ArrowUp, BellRing, Building2, FileText, KeyRound,
  LayoutDashboard, LoaderCircle, Plus, Receipt, Search, Settings, Users, Wallet, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { normalizeSearchText } from '../../services/globalSearch';
import type { NavSection } from './Sidebar';
import {
  buildSearchIndex, getRecentSearchItems, getSearchEntityLabel, GlobalSearchResult, RecentSearchItem, recordRecentSearchItem,
  resolveRecentSearchItems, SEARCH_ENTITY_ORDER, searchRecords,
} from '../../services/globalSearch';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: GlobalSearchResult) => void;
  onViewAll: (query: string) => void;
  onNavigate: (section: NavSection) => void;
  onQuickAction: (action: QuickAction) => void;
}

export type QuickAction = 'customer' | 'service' | 'sale' | 'payment' | 'account' | 'subscriptions' | 'invoices' | 'reports';

type Command = { kind: 'navigation'; label: string; section: NavSection } | { kind: 'action'; label: string; action: QuickAction };
interface ActionItem {
  label: string;
  aliases: string[];
  action: QuickAction;
  icon: React.FC<{ className?: string }>;
}
interface NavigationItem {
  label: string;
  aliases: string[];
  section: NavSection;
  icon: React.FC<{ className?: string }>;
}
const navigation: { label: string; section: NavSection; icon: React.FC<{ className?: string }> }[] = [
  { label: 'Dashboard', section: 'dashboard', icon: LayoutDashboard },
  { label: 'Customers', section: 'customers', icon: Users },
  { label: 'Services', section: 'services', icon: Building2 },
  { label: 'Accounts', section: 'accounts', icon: KeyRound },
  { label: 'Subscriptions', section: 'subscriptions', icon: Activity },
  { label: 'Sales', section: 'sales', icon: Receipt },
  { label: 'Payments', section: 'payments', icon: Wallet },
  { label: 'Invoices', section: 'invoices', icon: FileText },
  { label: 'Reports', section: 'reports', icon: Activity },
  { label: 'History', section: 'history', icon: Activity },
  { label: 'Notifications', section: 'notifications', icon: Activity },
  { label: 'Smart Reminders', section: 'reminders', icon: BellRing },
  { label: 'Settings', section: 'settings', icon: Settings },
];
const actions: { label: string; action: QuickAction; icon: React.FC<{ className?: string }> }[] = [
  { label: 'Add Customer', action: 'customer', icon: Users },
  { label: 'Create Service', action: 'service', icon: Building2 },
  { label: 'Create Sale', action: 'sale', icon: Plus },
  { label: 'Record Payment', action: 'payment', icon: Wallet },
  { label: 'View Invoices', action: 'invoices', icon: FileText },
  { label: 'View Reports', action: 'reports', icon: Activity },
  { label: 'Add Account', action: 'account', icon: KeyRound },
  { label: 'View Subscriptions', action: 'subscriptions', icon: Activity },
];

const banglaActionAliases: Record<QuickAction, string[]> = {
  customer: ['কাস্টমার', 'গ্রাহক'],
  service: ['সার্ভিস', 'সেবা'],
  sale: ['বিক্রয়', 'সেলস'],
  payment: ['পেমেন্ট', 'টাকা আদায়'],
  account: ['অ্যাকাউন্ট'],
  subscriptions: ['সাবস্ক্রিপশন'],
  invoices: ['ইনভয়েস'],
  reports: ['রিপোর্ট'],
};

const getNavigationLabel = (
  section: NavSection,
  englishLabel: string,
  isBangla: boolean,
  t: ReturnType<typeof useApp>['t']
): string => {
  if (!isBangla) return englishLabel;
  const translationKeys: Partial<Record<NavSection, Parameters<typeof t>[0]>> = {
    dashboard: 'nav_dashboard',
    customers: 'nav_customers',
    services: 'nav_services',
    accounts: 'nav_accounts',
    subscriptions: 'nav_subscriptions',
    sales: 'nav_sales',
    payments: 'nav_payments',
    history: 'nav_history',
    reports: 'nav_reports',
    settings: 'nav_settings',
  };
  const key = translationKeys[section];
  if (key) return t(key);
  const otherLabels: Partial<Record<NavSection, string>> = {
    invoices: 'ইনভয়েস',
    notifications: 'নোটিফিকেশন',
    reminders: 'স্মার্ট রিমাইন্ডার',
  };
  return otherLabels[section] || englishLabel;
};

const queryCommands = (query: string, actions: ActionItem[], navigation: NavigationItem[], isBangla: boolean): Command[] => {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const matchedActions = actions.filter(item =>
    [...item.aliases, item.label].some(alias => {
      const candidate = normalizeSearchText(alias);
      return candidate === normalized || candidate.startsWith(normalized);
    })
  ).map(item => ({ kind: 'action' as const, label: item.label, action: item.action }));
  const matchedNavigation = navigation.filter(item =>
    item.aliases.some(alias => {
      const candidate = normalizeSearchText(alias);
      return candidate === normalized || candidate.startsWith(normalized);
    })
  ).map(item => ({ kind: 'navigation' as const, label: `${isBangla ? 'খুলুন' : 'Open'} ${item.label}`, section: item.section }));
  return [...matchedActions, ...matchedNavigation];
};

const searchResultIcon: Record<GlobalSearchResult['entity'], React.FC<{ className?: string }>> = {
  customers: Users, services: Building2, plans: FileText, accounts: KeyRound, moneyAccounts: Wallet,
  profiles: Users, subscriptions: Activity, sales: Receipt, payments: Wallet,
  invoices: FileText, history: Activity, reminders: BellRing,
};

const highlightMatch = (text: string, query: string): React.ReactNode => {
  const match = query.trim();
  if (!match) return text;
  const escaped = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));
  if (parts.length === 1) return text;
  return parts.map((part, index) => index % 2 === 1
    ? <mark key={`${index}:${part}`} className="rounded bg-amber-200/80 text-inherit dark:bg-amber-700/60">{part}</mark>
    : part);
};

export const CommandCenter: React.FC<CommandCenterProps> = ({
  isOpen, onClose, onSelect, onViewAll, onNavigate, onQuickAction,
}) => {
  const { customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders, currentBusiness, currentUser, settings, language, t } = useApp();
  const index = useMemo(() => currentUser
    ? buildSearchIndex({ customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders }, settings.businessProfile?.timeZone)
    : [], [
    currentUser, customers, services, accounts, financialAccounts, subscriptions, sales, payments, invoices, activityLogs, reminders, settings.businessProfile?.timeZone,
  ]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recents, setRecents] = useState<RecentSearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !previousOpenRef.current) {
      priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRecents(getRecentSearchItems(currentBusiness?.businessId));
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!isOpen && previousOpenRef.current) {
      priorFocusRef.current?.focus();
    }
    previousOpenRef.current = isOpen;
  }, [isOpen, currentBusiness?.businessId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const results = useMemo(() => searchRecords(index, debouncedQuery), [index, debouncedQuery]);
  const isSearching = query !== debouncedQuery;
  const visibleResults = isSearching ? [] : results;
  const isBangla = language === 'bn';
  const copy = isBangla ? {
    quickActions: 'দ্রুত কাজ',
    recentPages: 'সাম্প্রতিক পৃষ্ঠা',
    navigation: 'নেভিগেশন',
    commands: 'কমান্ড',
    noResults: 'কোনো ফলাফল পাওয়া যায়নি। নাম, ফোন, ইনভয়েস নম্বর বা সার্ভিস দিয়ে খুঁজুন।',
    viewAll: 'সব ফলাফল দেখুন',
    results: 'টি ফলাফল',
    searchPlaceholder: 'কাস্টমার, বিক্রয়, ইনভয়েস খুঁজুন…',
    searchAriaLabel: 'ব্যবসার তথ্য খুঁজুন',
    clear: 'সার্চ মুছুন',
    close: 'সার্চ বন্ধ করুন',
    navigate: 'নেভিগেট করতে',
    loading: 'খোঁজা হচ্ছে…',
    dialog: 'গ্লোবাল সার্চ ও কমান্ড সেন্টার',
  } : {
    quickActions: 'Quick Actions',
    recentPages: 'Recent Pages',
    navigation: 'Navigation',
    commands: 'Commands',
    noResults: 'No results found. Try a name, phone, invoice number, or service.',
    viewAll: 'View all results',
    results: 'results',
    searchPlaceholder: 'Search customers, sales, invoices...',
    searchAriaLabel: 'Search business data',
    clear: 'Clear search',
    close: 'Close search',
    navigate: 'to navigate',
    loading: 'Searching…',
    dialog: 'Global search and command center',
  };
  const actionLabels: Record<QuickAction, string> = {
    customer: t('addCustomer'),
    service: isBangla ? 'সার্ভিস তৈরি করুন' : 'Create Service',
    sale: isBangla ? 'বিক্রয় তৈরি করুন' : 'Create Sale',
    payment: isBangla ? 'পেমেন্ট রেকর্ড করুন' : 'Record Payment',
    account: t('addAccount'),
    subscriptions: t('nav_subscriptions'),
    invoices: isBangla ? 'ইনভয়েস দেখুন' : 'View Invoices',
    reports: isBangla ? 'রিপোর্ট দেখুন' : 'View Reports',
  };
  const legacyActionAliases: Record<QuickAction, string> = {
    customer: t('addCustomer'),
    service: t('addService'),
    sale: t('newSale'),
    payment: t('addPayment'),
    account: t('addAccount'),
    subscriptions: t('nav_subscriptions'),
    invoices: 'Invoices',
    reports: t('nav_reports'),
  };
  const availableActions: ActionItem[] = currentUser ? actions.map(item => ({
    ...item,
    label: actionLabels[item.action],
    aliases: [item.label, item.action, legacyActionAliases[item.action], ...(isBangla ? banglaActionAliases[item.action] : [])],
  })) : [];
  const availableNavigation: NavigationItem[] = currentUser ? navigation.map(item => {
    const label = getNavigationLabel(item.section, item.label, isBangla, t);
    return { ...item, label, aliases: [item.label, label] };
  }) : [];
  const commands = queryCommands(query, availableActions, availableNavigation, isBangla);
  const recentResults = useMemo(() => resolveRecentSearchItems(index, recents), [index, recents]);
  const groupedResults = useMemo(() => SEARCH_ENTITY_ORDER.flatMap(entity => {
    const group = visibleResults.filter(item => item.entity === entity);
    return group.length ? [{ entity, results: group.slice(0, 4), count: group.length }] : [];
  }), [visibleResults]);
  const selectableResults = query.trim()
    ? groupedResults.flatMap(group => group.results)
    : recentResults.slice(0, 5);
  const selectableCount = query.trim()
    ? commands.length + selectableResults.length
    : availableActions.length + selectableResults.length + availableNavigation.length;

  useEffect(() => {
    setSelectedIndex(current => Math.min(current, Math.max(0, selectableCount - 1)));
  }, [selectableCount]);

  const selectResult = (result: GlobalSearchResult) => {
    onSelect(result);
    setRecents(getRecentSearchItems(currentBusiness?.businessId));
    recordRecentSearchItem(result, currentBusiness?.businessId);
    onClose();
  };
  const runCommand = (command: Command) => {
    if (command.kind === 'navigation') onNavigate(command.section);
    else onQuickAction(command.action);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown' && selectableCount > 0) {
        event.preventDefault();
        setSelectedIndex(current => {
          const next = (current + 1) % selectableCount;
          requestAnimationFrame(() => document.getElementById(`command-option-${next}`)?.scrollIntoView({ block: 'nearest' }));
          return next;
        });
      } else if (event.key === 'ArrowUp' && selectableCount > 0) {
        event.preventDefault();
        setSelectedIndex(current => {
          const next = (current - 1 + selectableCount) % selectableCount;
          requestAnimationFrame(() => document.getElementById(`command-option-${next}`)?.scrollIntoView({ block: 'nearest' }));
          return next;
        });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!query.trim() && selectedIndex < availableActions.length) {
          onQuickAction(availableActions[selectedIndex].action);
          onClose();
        } else if (!query.trim() && selectedIndex < availableActions.length + selectableResults.length) {
          const result = selectableResults[selectedIndex - availableActions.length];
          if (result) selectResult(result);
        } else if (!query.trim()) {
          const item = availableNavigation[selectedIndex - availableActions.length - selectableResults.length];
          if (item) { onNavigate(item.section); onClose(); }
        } else {
          if (selectedIndex < commands.length) {
            const command = commands[selectedIndex];
            if (command) runCommand(command);
          } else {
            const result = selectableResults[selectedIndex - commands.length];
            if (result) selectResult(result);
          }
        }
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, selectableCount, selectableResults, commands, selectedIndex, onClose, currentBusiness?.businessId]);

  if (!isOpen) return null;
  const commandContent = (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-5">
      {!query.trim() ? (
        <div className="grid gap-5 py-4 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{copy.quickActions}</h3>
            {availableActions.map((item, position) => {
              const Icon = item.icon;
              return <button id={`command-option-${position}`} key={item.action} type="button" onMouseEnter={() => setSelectedIndex(position)}
                aria-current={selectedIndex === position ? 'true' : undefined}
                onClick={() => { onQuickAction(item.action); onClose(); }} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${selectedIndex === position ? 'bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Icon className="h-4 w-4 text-violet-700 dark:text-violet-300" />{item.label}
              </button>;
            })}
            {recentResults.length > 0 && <div className="mt-5">
              <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{copy.recentPages}</h3>
              {recentResults.slice(0, 5).map((item, position) => {
                const Icon = searchResultIcon[item.entity];
                const optionIndex = actions.length + position;
                const selected = selectedIndex === optionIndex;
                return <button id={`command-option-${optionIndex}`} key={`${item.entity}:${item.id}`} type="button" onMouseEnter={() => setSelectedIndex(optionIndex)} onClick={() => selectResult(item)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left ${selected ? 'bg-violet-50 dark:bg-violet-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Icon className="h-4 w-4 text-slate-500" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-slate-500">{getSearchEntityLabel(item.entity, language)} · {item.subtitle}</span></span>
                </button>;
              })}
            </div>}
          </section>
          <section>
            <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{copy.navigation}</h3>
            {availableNavigation.map((item, position) => {
              const Icon = item.icon;
              const optionIndex = actions.length + selectableResults.length + position;
              const selected = selectedIndex === optionIndex;
              return <button id={`command-option-${optionIndex}`} key={item.section} type="button" onMouseEnter={() => setSelectedIndex(optionIndex)} onClick={() => { onNavigate(item.section); onClose(); }}
                aria-current={selected ? 'true' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${selected ? 'bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Icon className="h-4 w-4 text-slate-500" />{item.label}
              </button>;
            })}
          </section>
        </div>
      ) : (
        <div className="py-3">
          {commands.length > 0 && <section className="mb-3">
            <h3 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{copy.commands}</h3>
            {commands.map((command, position) => <button key={`${command.kind}:${command.label}`} id={`command-option-${position}`} type="button" onMouseEnter={() => setSelectedIndex(position)} onClick={() => runCommand(command)}
              aria-current={selectedIndex === position ? 'true' : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${selectedIndex === position ? 'bg-violet-50 dark:bg-violet-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <Plus className="h-4 w-4 text-violet-700" />{command.label}
            </button>)}
          </section>}
          {groupedResults.map(group => <section key={group.entity} className="mb-3" aria-label={`${getSearchEntityLabel(group.entity, language)} ${group.count} ${copy.results}`}>
            <h3 className="mb-1 flex justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><span>{getSearchEntityLabel(group.entity, language)}</span><span>{group.count} {copy.results}</span></h3>
            {group.results.map(item => {
              const position = commands.length + selectableResults.findIndex(result => result.entity === item.entity && result.id === item.id);
              const Icon = searchResultIcon[item.entity];
              return <button key={`${item.entity}:${item.id}`} id={`command-option-${position}`} type="button" onMouseEnter={() => setSelectedIndex(position)} onClick={() => selectResult(item)}
                aria-current={selectedIndex === position ? 'true' : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${selectedIndex === position ? 'bg-violet-50 dark:bg-violet-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{highlightMatch(item.title, query)}</span><span className="block truncate text-xs text-slate-500">{highlightMatch(`${item.subtitle}${item.detail ? ` · ${item.detail}` : ''}`, query)}</span></span>
              </button>;
            })}
          </section>)}
          {isSearching && <div role="status" className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />{copy.loading}</div>}
          {!isSearching && results.length === 0 && commands.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{copy.noResults}</p>}
          {!isSearching && results.length > 0 && <button type="button" onClick={() => { onViewAll(query); onClose(); }} className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:border-slate-700 dark:text-violet-300 dark:hover:bg-violet-950/30">{copy.viewAll} ({results.length.toLocaleString(isBangla ? 'bn-BD' : 'en-US')})</button>}
          <span className="sr-only" aria-live="polite">{results.length.toLocaleString(isBangla ? 'bn-BD' : 'en-US')} {copy.results}</span>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="app-command-center-overlay fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:p-8" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.dialog}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:mt-[8vh] sm:h-auto sm:max-h-[min(78vh,760px)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-700">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }}
              placeholder={copy.searchPlaceholder} aria-label={copy.searchAriaLabel}
              aria-controls="global-search-results" aria-activedescendant={selectableCount ? `command-option-${selectedIndex}` : undefined}
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-slate-400 sm:text-lg" />
            {query && <button type="button" onClick={() => { setQuery(''); setDebouncedQuery(''); setSelectedIndex(0); inputRef.current?.focus(); }} aria-label={copy.clear} title={copy.clear} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>}
            <span className="hidden rounded border px-1.5 py-1 text-[10px] text-slate-500 sm:inline">ESC</span>
            <button type="button" onClick={onClose} aria-label={copy.close} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-1 flex items-center gap-2 pl-8 text-[11px] text-slate-400"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> {copy.navigate} <span className="ml-auto">Ctrl K / ⌘ K</span></div>
        </header>
        <div id="global-search-results" className="min-h-0 flex-1 overflow-y-auto">
          {commandContent}
        </div>
      </div>
    </div>,
    document.body,
  );
};
