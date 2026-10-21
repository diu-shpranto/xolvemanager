import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { registerUnsavedChanges } from '../../services/unsavedChanges';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  protectUnsavedChanges?: boolean;
}

let activeModalScrollLocks = 0;
let previousBodyOverflow = '';
let previousDocumentOverflow = '';

function lockPageScroll(): () => void {
  if (activeModalScrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousDocumentOverflow = document.documentElement.style.overflow;
  }
  activeModalScrollLocks += 1;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeModalScrollLocks = Math.max(0, activeModalScrollLocks - 1);
    if (activeModalScrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    }
  };
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  protectUnsavedChanges = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const discardDialogRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const interactionRef = useRef(false);
  const initialFormValuesRef = useRef(new Map<string, string>());
  const latestFormValuesRef = useRef(new Map<string, string>());
  const titleId = useId();
  onCloseRef.current = onClose;
  const readFormValues = () => Array.from(
    dialogRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    ) ?? []
  ).reduce((values, control, index) => {
    const identity = control.id
      || control.getAttribute('name')
      || control.getAttribute('aria-label')
      || control.getAttribute('placeholder')
      || control.labels?.[0]?.textContent?.trim()
      || `${control.tagName}-${index}`;
    const occurrence = values.occurrences.get(identity) ?? 0;
    values.occurrences.set(identity, occurrence + 1);
    let value: unknown;
    if (control instanceof HTMLInputElement) {
      if (control.type === 'checkbox' || control.type === 'radio') {
        value = [control.type, control.value, control.checked];
      } else if (control.type === 'file') {
        value = [control.type, Array.from(control.files || []).map(file => `${file.name}:${file.size}`)];
      }
    }
    if (control instanceof HTMLSelectElement && control.multiple) {
      value = [control.tagName, Array.from(control.selectedOptions).map(option => option.value)];
    }
    if (value === undefined) value = [control.tagName, control.value];
    values.current.set(`${control.tagName}:${identity}:${occurrence}`, JSON.stringify(value));
    return values;
  }, { current: new Map<string, string>(), occurrences: new Map<string, number>() }).current;
  const syncFormValues = (markInteraction = false) => {
    if (markInteraction) interactionRef.current = true;
    const currentValues = readFormValues();
    if (!interactionRef.current) {
      initialFormValuesRef.current = currentValues;
      latestFormValuesRef.current = new Map(currentValues);
      return;
    }
    for (const [key, value] of currentValues) {
      if (!initialFormValuesRef.current.has(key)) initialFormValuesRef.current.set(key, value);
      latestFormValuesRef.current.set(key, value);
    }
  };
  const isDirty = () => {
    if (!protectUnsavedChanges) return false;
    syncFormValues();
    return interactionRef.current && Array.from(latestFormValuesRef.current).some(
      ([key, value]) => initialFormValuesRef.current.get(key) !== value
    );
  };
  const requestClose = () => {
    if (isDirty()) {
      setShowDiscardConfirmation(true);
      return;
    }
    onCloseRef.current();
  };
  const getFocusableElements = () => Array.from(
    (showDiscardConfirmation ? discardDialogRef.current : dialogRef.current)?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    ) ?? []
  ).filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      interactionRef.current = false;
      initialFormValuesRef.current = new Map();
      latestFormValuesRef.current = new Map();
      setShowDiscardConfirmation(false);
      return;
    }
    syncFormValues();
  });

  useEffect(() => {
    if (!isOpen) return;
    return registerUnsavedChanges(() => protectUnsavedChanges && isDirty());
  }, [isOpen, protectUnsavedChanges]);

  useEffect(() => {
    if (showDiscardConfirmation) continueEditingRef.current?.focus();
  }, [showDiscardConfirmation]);

  useEffect(() => {
    if (!isOpen || !portalContainer) return;

    const unlockPageScroll = lockPageScroll();
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const visualViewport = window.visualViewport;
    const updateViewport = () => {
      if (!overlayRef.current || !visualViewport) return;
      overlayRef.current.style.setProperty('--app-visual-viewport-height', `${visualViewport.height}px`);
      overlayRef.current.style.setProperty('--app-visual-viewport-offset-top', `${visualViewport.offsetTop}px`);
    };
    updateViewport();
    visualViewport?.addEventListener('resize', updateViewport);
    visualViewport?.addEventListener('scroll', updateViewport);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showDiscardConfirmation) setShowDiscardConfirmation(false);
        else requestClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        (showDiscardConfirmation ? discardDialogRef.current : dialogRef.current)?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusScope = showDiscardConfirmation ? discardDialogRef.current : dialogRef.current;
      if (event.shiftKey && (document.activeElement === first || !focusScope?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusScope?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockPageScroll();
      window.removeEventListener('keydown', handleKeyDown);
      visualViewport?.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('scroll', updateViewport);
      returnFocusRef.current?.focus({ preventScroll: true });
      returnFocusRef.current = null;
    };
  }, [isOpen, portalContainer, showDiscardConfirmation]);

  if (!isOpen || !portalContainer) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return createPortal((
    <div
      ref={overlayRef}
      className="app-modal-overlay fixed inset-x-0 top-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/60 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xs sm:items-center sm:bg-transparent sm:p-4"
      onInputCapture={() => syncFormValues(true)}
      onChangeCapture={() => syncFormValues(true)}
      onClickCapture={() => syncFormValues()}
      onMouseDown={event => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 hidden bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 sm:block"
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby={titleId}
        className={`app-modal app-modal-dialog relative z-10 my-0 flex min-h-0 w-full ${maxWidthClasses} flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:my-8 sm:rounded-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="app-modal-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="app-modal-title text-base font-semibold leading-6 text-slate-900 dark:text-white sm:text-lg">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            ref={closeButtonRef}
            aria-label="Close dialog"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="app-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
        {footer && (
          <div className="app-modal-footer shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            {footer}
          </div>
        )}
        {showDiscardConfirmation && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onMouseDown={event => event.stopPropagation()}>
            <section
              ref={discardDialogRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${titleId}-discard-title`}
              aria-describedby={`${titleId}-discard-description`}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <h4 id={`${titleId}-discard-title`} className="text-base font-semibold text-slate-900 dark:text-white">Discard unsaved changes?</h4>
              <p id={`${titleId}-discard-description`} className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Your edits have not been saved. Continue editing or discard them?</p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    interactionRef.current = false;
                    const currentValues = readFormValues();
                    initialFormValuesRef.current = currentValues;
                    latestFormValuesRef.current = new Map(currentValues);
                    setShowDiscardConfirmation(false);
                    onCloseRef.current();
                  }}
                  className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                >
                  Discard Changes
                </button>
                <button
                  ref={continueEditingRef}
                  type="button"
                  onClick={() => setShowDiscardConfirmation(false)}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Continue Editing
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  ), portalContainer);
};
