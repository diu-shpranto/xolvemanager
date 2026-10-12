import React from 'react';
import {
  BarChart3,
  BellRing,
  Building2,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import type { NavSection } from './Sidebar';
import type { QuickAction } from './CommandCenter';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

interface MobileQuickNavProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenNewSale: () => void;
  onAddPayment: () => void;
  onQuickAction: (action: QuickAction) => void;
}

export const MobileQuickNav: React.FC<MobileQuickNavProps> = ({
  currentSection,
  onNavigate,
  onOpenNewSale,
  onAddPayment,
  onQuickAction,
}) => {
  const { language } = useApp();
  const isBangla = language === 'bn';
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const items: {
    label: string;
    section: NavSection;
    icon: typeof LayoutDashboard;
    onClick: () => void;
  }[] = [
    {
      label: isBangla ? 'হোম' : 'Home',
      section: 'dashboard',
      icon: LayoutDashboard,
      onClick: () => onNavigate('dashboard'),
    },
    {
      label: isBangla ? 'গ্রাহক' : 'Customers',
      section: 'customers',
      icon: Users,
      onClick: () => onNavigate('customers'),
    },
    {
      label: isBangla ? 'পেমেন্ট' : 'Payment',
      section: 'payments',
      icon: Wallet,
      onClick: () => onNavigate('payments'),
    },
    {
      label: isBangla ? 'ফলো-আপ' : 'Follow-up',
      section: 'reminders',
      icon: BellRing,
      onClick: () => onNavigate('reminders'),
    },
  ];

  return (
    <nav
      aria-label={isBangla ? 'দ্রুত নেভিগেশন' : 'Quick navigation'}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-30 rounded-2xl border border-white/80 bg-white/90 px-1.5 py-1.5 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.32),0_2px_8px_-2px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-950/90 dark:shadow-[0_12px_36px_-12px_rgba(0,0,0,0.7)] lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-6 items-end gap-1">
        {items.slice(0, 2).map(item => {
          const Icon = item.icon;
          const isActive = currentSection === item.section;
          return (
            <button
              key={item.section}
              type="button"
              onClick={item.onClick}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-violet-600 active:scale-95 ${
                isActive
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                  : 'text-slate-500 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-slate-800/80'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenNewSale}
          aria-label={isBangla ? 'নতুন বিক্রয় তৈরি করুন' : 'Create a new sale'}
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 px-1 text-[10px] font-bold text-white shadow-[0_5px_14px_-4px_rgba(109,40,217,0.65)] transition-all duration-200 hover:from-violet-700 hover:to-purple-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 active:scale-95"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-full truncate">{isBangla ? 'নতুন বিক্রয়' : 'New Sale'}</span>
        </button>
        {items.slice(2).map(item => {
          const Icon = item.icon;
          const isActive = currentSection === item.section;
          return (
            <button
              key={item.section}
              type="button"
              onClick={item.onClick}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-violet-600 active:scale-95 ${
                isActive
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                  : 'text-slate-500 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-slate-800/80'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-100/80 focus-visible:outline-2 focus-visible:outline-violet-600 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800/80"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>{isBangla ? 'আরও' : 'More'}</span>
        </button>
      </div>
      <Modal
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        title={isBangla ? 'দ্রুত কাজ' : 'Quick actions'}
        subtitle={isBangla ? 'সাধারণ কাজ বা বিভাগ দ্রুত খুলুন।' : 'Create a record or jump to a business area.'}
        maxWidth="md"
      >
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: isBangla ? 'গ্রাহক যোগ করুন' : 'Add customer', icon: Users, action: 'customer' as const },
            { label: isBangla ? 'সেবা যোগ করুন' : 'Add service', icon: Building2, action: 'service' as const },
            { label: isBangla ? 'অ্যাকাউন্ট যোগ করুন' : 'Add account', icon: KeyRound, action: 'account' as const },
            { label: isBangla ? 'পেমেন্ট যোগ করুন' : 'Add payment', icon: Wallet, action: 'payment' as const },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.action}
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onQuickAction(item.action);
                }}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-100 dark:hover:border-violet-700 dark:hover:bg-violet-950/30"
              >
                <Icon className="h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {[
            { label: isBangla ? 'বিক্রয়' : 'Sales', section: 'sales' as const, icon: Receipt },
            { label: isBangla ? 'সাবস্ক্রিপশন' : 'Subscriptions', section: 'subscriptions' as const, icon: CreditCard },
            { label: isBangla ? 'ক্যাশবুক' : 'Cashbook', section: 'cashbook' as const, icon: Wallet },
            { label: isBangla ? 'রিপোর্ট' : 'Reports', section: 'reports' as const, icon: BarChart3 },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.section}
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onNavigate(item.section);
                }}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-100 dark:hover:border-violet-700 dark:hover:bg-violet-950/30"
              >
                <Icon className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsMoreOpen(false);
              onNavigate('expenses');
            }}
            className="col-span-2 flex min-h-14 items-center justify-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 transition-colors hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-100 dark:hover:border-violet-700 dark:hover:bg-violet-950/30"
          >
            <Receipt className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            {isBangla ? 'খরচ' : 'Expenses'}
          </button>
        </div>
      </Modal>
    </nav>
  );
};
