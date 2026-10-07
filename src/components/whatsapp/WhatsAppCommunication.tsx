import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import type { WhatsAppTemplateId } from '../../types';
import {
  generateWhatsAppMessage,
  getWhatsAppTemplates,
  openWhatsApp,
  supportedWhatsAppVariables,
  type WhatsAppMessageContext,
  type WhatsAppMessageResult,
} from '../../utils/whatsappService';
import { isValidPhoneNumber } from '../../utils/phoneUtils';

interface CommunicationRequest extends WhatsAppMessageContext {
  templateId?: WhatsAppTemplateId;
}

interface WhatsAppCommunicationApi {
  openMessage: (request: CommunicationRequest) => boolean;
  isEnabled: boolean;
  showButtons: boolean;
  canContact: (customerId: string) => boolean;
}

const CommunicationContext = createContext<WhatsAppCommunicationApi | null>(null);

export function useWhatsAppCommunication(): WhatsAppCommunicationApi {
  const context = useContext(CommunicationContext);
  if (!context) throw new Error('WhatsApp communication must be used within its provider.');
  return context;
}

export const WhatsAppCommunicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    settings, customers, services, subscriptions, sales, payments, invoices, logActivity,
  } = useApp();
  const { showToast } = useToast();
  const [request, setRequest] = useState<CommunicationRequest | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<WhatsAppTemplateId>('custom_message');
  const [message, setMessage] = useState('');
  const preferences = settings.whatsappPreferences;
  const countryCode = preferences?.countryCode || '880';
  const isEnabled = preferences?.enabled !== false;
  const showButtons = preferences?.showButtons !== false;
  const templates = useMemo(() => getWhatsAppTemplates(settings), [settings]);

  const data = useMemo(() => ({
    settings,
    customers,
    services,
    subscriptions,
    sales,
    payments,
    invoices,
  }), [settings, customers, services, subscriptions, sales, payments, invoices]);

  const generated = useMemo<WhatsAppMessageResult | null>(() => request
    ? generateWhatsAppMessage(activeTemplateId, request, data)
    : null, [request, activeTemplateId, data]);

  useEffect(() => {
    if (!generated) return;
    setMessage(generated.message);
  }, [generated]);

  const openMessage = (nextRequest: CommunicationRequest): boolean => {
    if (!isEnabled || !showButtons) {
      showToast('WhatsApp actions are disabled in Settings.', 'error');
      return false;
    }
    if (!nextRequest.customerId && !nextRequest.subscriptionId && !nextRequest.saleId
      && !nextRequest.paymentId && !nextRequest.invoiceId) {
      showToast('Choose a customer or business record before composing a message.', 'error');
      return false;
    }
    setRequest(nextRequest);
    setActiveTemplateId(nextRequest.templateId || 'custom_message');
    return true;
  };

  const close = () => {
    setRequest(null);
    setMessage('');
  };

  const selectedCustomer = request?.customerId
    ? customers.find(customer => customer.id === request.customerId)
    : undefined;
  const phoneValid = Boolean(generated?.phone && isValidPhoneNumber(generated.phone, countryCode));
  const messageSafetyWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (/\{[^}]*?(?:password|passcode|pin|credential|secret|login|access.?code)[^}]*?\}/i.test(message)) {
      warnings.push('Sensitive credential placeholders are not allowed.');
    }
    const placeholders = [...message.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);
    const unsupported = placeholders.filter(name =>
      !supportedWhatsAppVariables.includes(name as typeof supportedWhatsAppVariables[number])
    );
    if (unsupported.length) warnings.push(`Unsupported variables: ${[...new Set(unsupported)].map(name => `{${name}}`).join(', ')}.`);
    return warnings;
  }, [message]);
  const canOpen = Boolean(generated?.canOpen && phoneValid && message.trim() && messageSafetyWarnings.length === 0);

  const handleOpenWhatsApp = () => {
    if (!request || !generated || !canOpen) {
      showToast(!phoneValid ? 'Please check the customer phone number.' : 'Review the message and correct any validation warnings.', 'error');
      return;
    }
    const opened = openWhatsApp(generated.phone, message, countryCode);
    if (!opened) {
      showToast('Could not open WhatsApp. Check your browser pop-up settings and phone number.', 'error');
      return;
    }
    logActivity({
      type: 'whatsapp_opened',
      category: 'system',
      action: 'other',
      entityType: 'customer',
      entityId: request.customerId || generated.phone,
      customerId: request.customerId,
      customerName: selectedCustomer?.name,
      subscriptionId: request.subscriptionId,
      saleId: request.saleId,
      paymentId: request.paymentId,
      invoiceId: request.invoiceId,
      title: 'WhatsApp Opened',
      description: `A ${templates.find(template => template.templateId === activeTemplateId)?.name || 'custom'} message was prepared for ${selectedCustomer?.name || 'a customer'}. Delivery is not tracked.`,
      metadata: { templateId: activeTemplateId },
    });
    showToast('WhatsApp opened with your message ready to review. Delivery is not tracked.', 'success');
    close();
  };

  const handleCopy = async () => {
    if (!message.trim()) {
      showToast('Message cannot be empty.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      showToast('Message copied.', 'success');
    } catch (error) {
      console.error('Could not copy WhatsApp message.', error);
      showToast('Could not copy the message. Check clipboard permissions.', 'error');
    }
  };

  const api = useMemo<WhatsAppCommunicationApi>(() => ({
    openMessage,
    isEnabled,
    showButtons,
    canContact: customerId => {
      const customer = customers.find(item => item.id === customerId);
      const phones = [customer?.whatsapp, customer?.phone].filter((phone): phone is string => Boolean(phone?.trim()));
      return isEnabled && showButtons && customer?.preferences?.contactAllowed !== false
        && phones.some(phone => isValidPhoneNumber(phone, countryCode));
    },
  }), [isEnabled, showButtons, customers, countryCode]);

  return (
    <CommunicationContext.Provider value={api}>
      {children}
      {request && generated && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => {
          if (event.target === event.currentTarget) close();
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="whatsapp-dialog-title" className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><MessageCircle className="h-5 w-5" /></span>
                <div><h2 id="whatsapp-dialog-title" className="font-bold text-slate-900 dark:text-white">WhatsApp message</h2><p className="text-xs text-slate-500">Link mode · XolveManager does not track delivery</p></div>
              </div>
              <button type="button" onClick={close} aria-label="Close message composer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Message type
                  <select aria-label="Message type" value={activeTemplateId} onChange={event => setActiveTemplateId(event.target.value as WhatsAppTemplateId)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    {templates.filter(template => template.enabled).map(template => <option key={template.templateId} value={template.templateId}>{template.name}</option>)}
                  </select>
                </label>
                <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <p className="font-semibold text-slate-900 dark:text-white">{selectedCustomer?.name || 'Customer unavailable'}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{generated.phone || 'No phone number available'}</p>
                  {generated.missingFields.length > 0 && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{generated.missingFields.includes('phone') ? 'Please check the customer phone number.' : `Missing required information: ${generated.missingFields.join(', ')}.`}</p>}
                </div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Message
                  <textarea aria-label="WhatsApp message" rows={11} value={message} onChange={event => setMessage(event.target.value)} className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <p className="text-right text-[11px] text-slate-500">{message.length} characters</p>
                {[...generated.warnings, ...messageSafetyWarnings].map(warning => <p key={warning} role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{warning}</p>)}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Preview</h3><span className="text-[11px] text-slate-500">Not delivered</span></div>
                <div className="min-h-72 rounded-2xl bg-[#e8f2eb] p-4 dark:bg-[#10231a]">
                  <div className="ml-auto max-w-[95%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm dark:bg-[#005c4b] dark:text-slate-100">{message || 'Your message preview will appear here.'}</div>
                  <p className="mt-3 text-right text-[10px] text-slate-500">Preview only · XolveManager cannot confirm delivery</p>
                </div>
                <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">Available variables: {supportedWhatsAppVariables.slice(0, 10).map(variable => `{${variable}}`).join(', ')} and more.</p>
              </div>
            </div>
            <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={close} className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={() => void handleCopy()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Copy className="h-4 w-4" /> Copy</button>
              <button type="button" onClick={handleOpenWhatsApp} disabled={!canOpen} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><ExternalLink className="h-4 w-4" /> Open WhatsApp</button>
            </footer>
          </section>
        </div>
      )}
    </CommunicationContext.Provider>
  );
};
