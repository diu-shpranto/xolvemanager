import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import type { FinancialAccount, PaymentMethodConfig } from '../../types';

interface ReceivingAccountSelectorProps {
  accounts: FinancialAccount[];
  selectedAccountId: string;
  currency: string;
  paymentMethods: PaymentMethodConfig[];
  onSelect: (accountId: string) => void;
  onCreateAccount: () => void;
}

const accountTypeLabels: Record<FinancialAccount['type'], string> = {
  mobile_banking: 'Mobile banking',
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

export const ReceivingAccountSelector: React.FC<ReceivingAccountSelectorProps> = ({
  accounts,
  selectedAccountId,
  currency,
  paymentMethods,
  onSelect,
  onCreateAccount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSheetRef = useRef<HTMLElement>(null);
  const selectedAccount = accounts.find(account => account.id === selectedAccountId);

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 639px)').matches) {
        closeButtonRef.current?.focus();
      } else {
        document.querySelector<HTMLElement>('.receiving-account-option[aria-selected="true"]')
          ?.focus();
        if (!document.activeElement?.classList.contains('receiving-account-option')) {
          document.querySelector<HTMLElement>('.receiving-account-option')?.focus();
        }
      }
    });
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node
        && !triggerRef.current?.parentElement?.contains(event.target)
        && !mobileSheetRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const chooseAccount = (accountId: string) => {
    onSelect(accountId);
    close();
  };

  const getMethodLabel = (account: FinancialAccount) => paymentMethods
    .filter(method => method.financialAccountId === account.id)
    .map(method => method.name)
    .join(', ');

  const accountOption = (account: FinancialAccount) => {
    const mappedMethods = getMethodLabel(account);
    const isSelected = selectedAccountId === account.id;
    return (
      <button
        key={account.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => chooseAccount(account.id)}
        className={`receiving-account-option flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-600 ${
          isSelected
            ? 'bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100'
            : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isSelected
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
        }`}>
          {isSelected ? <Check className="h-5 w-5" aria-hidden="true" /> : <span className="text-xs font-bold">{account.currency}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold">{account.name}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{accountTypeLabels[account.type]}</span>
            <span>{account.currency}</span>
            {account.identifier && <span>{account.identifier}</span>}
            {mappedMethods && <span>For {mappedMethods}</span>}
          </span>
        </span>
        {isSelected && <span className="shrink-0 text-xs font-semibold text-violet-700 dark:text-violet-300">Selected</span>}
      </button>
    );
  };

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/25">
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">No receiving account available</p>
        <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">
          Create or activate an account in the required currency before recording this payment.
        </p>
        <button
          type="button"
          onClick={onCreateAccount}
          className="mt-3 min-h-11 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          Create Account
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Account receiving money: ${selectedAccount?.name || 'Choose an account'}`}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            close();
          }
        }}
        className="mt-1.5 flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-800 shadow-xs hover:border-violet-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        <span className="min-w-0">
          {selectedAccount ? (
            <>
              <span className="block truncate font-semibold">{selectedAccount.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {accountTypeLabels[selectedAccount.type]} · {selectedAccount.currency}
              </span>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Choose an account</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {!selectedAccount && (
        <p className="mt-1 block text-[11px] text-slate-500">Choose an active account in this currency.</p>
      )}

      {isOpen && (
        <div
          className="absolute inset-0 z-[80] hidden sm:block"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <div
            role="listbox"
            aria-label="Choose receiving account"
            className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {accounts.map(accountOption)}
          </div>
        </div>
      )}

      {isOpen && portalContainer && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 backdrop-blur-[2px] sm:hidden"
          onMouseDown={event => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === 'Tab') {
              const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [role="option"]'
              ));
              if (!focusable.length) return;
              if (event.shiftKey && document.activeElement === focusable[0]) {
                event.preventDefault();
                focusable[focusable.length - 1].focus();
              } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
                event.preventDefault();
                focusable[0].focus();
              }
            }
          }}
        >
          <section
            ref={mobileSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose receiving account"
            className="flex max-h-[min(78dvh,42rem)] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
              <div>
                <h2 className="section-title">Choose receiving account</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{currency} · {accounts.length} available</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Close account selector"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div role="listbox" aria-label="Choose receiving account" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              {accounts.map(accountOption)}
            </div>
          </section>
        </div>,
        portalContainer
      )}
    </div>
  );
};
