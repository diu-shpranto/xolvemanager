import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, ArrowDown, ArrowUp, BellRing, Building2, CreditCard, FileText, KeyRound,
  LayoutDashboard, Plus, Receipt, Search, Settings, Users, Wallet, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { NavSection } from './Sidebar';
import {
  buildSearchIndex, getRecentSearchItems, GlobalSearchResult, RecentSearchItem, recordRecentSearchItem,
  resolveRecentSearchItems, SEARCH_ENTITY_LABELS, SEARCH_ENTITY_ORDER, searchRecords,
} from '../../services/globalSearch';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: GlobalSearchResult) => void;
  onViewAll: (query: string) => void;
  onNavigate: (section: NavSection) => void;
  onQuickAction: (action: QuickAction) => void;
}

export type QuickAction = 'customer' | 'service' | 'sale' | 'payment' | 'invoice' | 'account' | 'subscription';

type Command = { kind: 'navigation'; label: string; section: NavSection } | { kind: 'action'; label: string; action: QuickAction };
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
  { label: 'Add Service', action: 'service', icon: Building2 },
  { label: 'New Sale', action: 'sale', icon: Plus },
  { label: 'Add Payment', action: 'payment', icon: Wallet },
  { label: 'Create Invoice', action: 'invoice', icon: FileText },
  { label: 'Add Account', action: 'account', icon: KeyRound },
  { label: 'Add Subscription', action: 'subscription', icon: CreditCard },
];

const queryCommands = (query: string): Command[] => {
  const normalized = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!normalized) return [];
  const matchedActions = actions.filter(item =>
    normalized === item.label.toLowerCase() ||
    normalized === item.label.toLowerCase().replace(/^(add|new|create)\s+/, '') ||
    item.label.toLowerCase().startsWith(normalized)
  ).map(item => ({ kind: 'action' as const, label: item.label, action: item.action }));
  const matchedNavigation = navigation.filter(item =>
    normalized === item.label.toLowerCase() || item.label.toLowerCase().startsWith(normalized)
  ).map(item => ({ kind: 'navigation' as const, label: `Open ${item.label}`, section: item.section }));
  return [...matchedActions, ...matchedNavigation];
};

const searchResultIcon: Record<GlobalSearchResult['entity'], React.FC<{ className?: string }>> = {
  customers: Users, services: Building2, plans: FileText, accounts: KeyRound,
  profiles: Users, subscriptions: Activity, sales: Receipt, payments: Wallet,
  invoices: FileText, history: Activity, reminders: BellRing,
};

export const CommandCenter: React.FC<CommandCenterProps> = ({
  isOpen, onClose, onSelect, onViewAll, onNavigate, onQuickAction,
}) => {
  const { customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders, currentBusiness } = useApp();
  const index = useMemo(() => buildSearchIndex({ customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders }), [
    customers, services, accounts, subscriptions, sales, payments, invoices, activityLogs, reminders,
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
  const commands = useMemo(() => queryCommands(query), [query]);
  const recentResults = useMemo(() => resolveRecentSearchItems(index, recents), [index, recents]);
  const groupedResults = useMemo(() => SEARCH_ENTITY_ORDER.flatMap(entity => {
    const group = results.filter(item => item.entity === entity);
    return group.length ? [{ entity, results: group.slice(0, 4), count: group.length }] : [];
  }), [results]);
  const selectableResults = query.trim()
    ? groupedResults.flatMap(group => group.results)
    : recentResults.slice(0, 8);
  const selectableCount = query.trim()
    ? commands.length + selectableResults.length
    : actions.length + selectableResults.length + navigation.length;

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
        setSelectedIndex(current => (current + 1) % selectableCount);
      } else if (event.key === 'ArrowUp' && selectableCount > 0) {
        event.preventDefault();
        setSelectedIndex(current => (current - 1 + selectableCount) % selectableCount);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!query.trim() && selectedIndex < actions.length) {
          onQuickAction(actions[selectedIndex].action);
          onClose();
        } else if (!query.trim() && selectedIndex < actions.length + selectableResults.length) {
          const result = selectableResults[selectedIndex - actions.length];
          if (result) selectResult(result);
        } else if (!query.trim()) {
          const item = navigation[selectedIndex - actions.length - selectableResults.length];
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
            <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Quick Actions</h3>
            {actions.map((item, position) => {
              const Icon = item.icon;
              return <button id={`command-option-${position}`} key={item.action} type="button" onMouseEnter={() => setSelectedIndex(position)}
                aria-current={selectedIndex === position ? 'true' : undefined}
                onClick={() => { onQuickAction(item.action); onClose(); }} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${selectedIndex === position ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />{item.label}
              </button>;
            })}
            {recentResults.length > 0 && <div className="mt-5">
              <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent Pages</h3>
              {recentResults.slice(0, 5).map((item, position) => {
                const Icon = searchResultIcon[item.entity];
                const optionIndex = actions.length + position;
                const selected = selectedIndex === optionIndex;
                return <button id={`command-option-${optionIndex}`} key={`${item.entity}:${item.id}`} type="button" onMouseEnter={() => setSelectedIndex(optionIndex)} onClick={() => selectResult(item)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left ${selected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Icon className="h-4 w-4 text-slate-500" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-slate-500">{SEARCH_ENTITY_LABELS[item.entity]} · {item.subtitle}</span></span>
                </button>;
              })}
            </div>}
          </section>
          <section>
            <h3 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Navigation</h3>
            {navigation.map((item, position) => {
              const Icon = item.icon;
              const optionIndex = actions.length + selectableResults.length + position;
              const selected = selectedIndex === optionIndex;
              return <button id={`command-option-${optionIndex}`} key={item.section} type="button" onMouseEnter={() => setSelectedIndex(optionIndex)} onClick={() => { onNavigate(item.section); onClose(); }}
                aria-current={selected ? 'true' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${selected ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Icon className="h-4 w-4 text-slate-500" />{item.label}
              </button>;
            })}
          </section>
        </div>
      ) : (
        <div className="py-3">
          {commands.length > 0 && <section className="mb-3">
            <h3 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Commands</h3>
            {commands.map((command, position) => <button key={`${command.kind}:${command.label}`} id={`command-option-${position}`} type="button" onMouseEnter={() => setSelectedIndex(position)} onClick={() => runCommand(command)}
              aria-current={selectedIndex === position ? 'true' : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${selectedIndex === position ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <Plus className="h-4 w-4 text-emerald-700" />{command.label}
            </button>)}
          </section>}
          {groupedResults.map(group => <section key={group.entity} className="mb-3" aria-label={`${SEARCH_ENTITY_LABELS[group.entity]} ${group.count} results`}>
            <h3 className="mb-1 flex justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><span>{SEARCH_ENTITY_LABELS[group.entity]}</span><span>{group.count} results</span></h3>
            {group.results.map(item => {
              const position = commands.length + selectableResults.findIndex(result => result.entity === item.entity && result.id === item.id);
              const Icon = searchResultIcon[item.entity];
              return <button key={`${item.entity}:${item.id}`} id={`command-option-${position}`} type="button" onMouseEnter={() => setSelectedIndex(position)} onClick={() => selectResult(item)}
                aria-current={selectedIndex === position ? 'true' : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${selectedIndex === position ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-slate-500">{item.subtitle}{item.detail ? ` · ${item.detail}` : ''}</span></span>
              </button>;
            })}
          </section>)}
          {results.length === 0 && commands.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">No results found. Try a name, phone, invoice number, or service.</p>}
          {results.length > 0 && <button type="button" onClick={() => { onViewAll(query); onClose(); }} className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30">View all results ({results.length})</button>}
          <span className="sr-only" aria-live="polite">{results.length} search results</span>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:p-8" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Global search and command center"
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:mt-[8vh] sm:h-auto sm:max-h-[min(78vh,760px)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-700">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 shrink-0 text-emerald-600" />
            <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }}
              placeholder="Search customers, sales, invoices..." aria-label="Search business data"
              aria-controls="global-search-results" aria-activedescendant={selectableCount ? `command-option-${selectedIndex}` : undefined}
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-slate-400 sm:text-lg" />
            <span className="hidden rounded border px-1.5 py-1 text-[10px] text-slate-500 sm:inline">ESC</span>
            <button type="button" onClick={onClose} aria-label="Close search" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-1 flex items-center gap-2 pl-8 text-[11px] text-slate-400"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> to navigate <span className="ml-auto">Ctrl K / ⌘ K</span></div>
        </header>
        <div id="global-search-results" className="min-h-0 flex-1 overflow-y-auto">
          {commandContent}
        </div>
      </div>
    </div>,
    document.body,
  );
};
