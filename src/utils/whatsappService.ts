import type {
  AppSettings,
  Customer,
  Invoice,
  Payment,
  Sale,
  Service,
  Subscription,
  WhatsAppTemplate,
  WhatsAppTemplateId,
} from '../types';
import { formatAppDate, getDaysDifference } from './dateUtils';
import { getSaleDueAmount, getSalePaidAmount } from './saleUtils';
import { convertReportCurrency } from './reportMetrics';
import { createWhatsAppUrl, normalizePhoneNumber, openWhatsApp } from './phoneUtils';

export interface WhatsAppMessageContext {
  customerId?: string;
  subscriptionId?: string;
  saleId?: string;
  paymentId?: string;
  invoiceId?: string;
}

export interface WhatsAppMessageData {
  settings: AppSettings;
  customers: Customer[];
  services: Service[];
  subscriptions: Subscription[];
  sales: Sale[];
  payments: Payment[];
  invoices: Invoice[];
}

export interface WhatsAppMessageResult {
  message: string;
  phone: string;
  canOpen: boolean;
  missingFields: string[];
  warnings: string[];
}

export const supportedWhatsAppVariables = [
  'businessName', 'customerName', 'customerPhone', 'customerEmail', 'serviceName',
  'planName', 'accountName', 'profileName', 'startDate', 'expiryDate', 'daysRemaining',
  'invoiceNumber', 'invoiceDate', 'saleId', 'paymentId', 'totalAmount', 'paidAmount',
  'dueAmount', 'paymentMethod', 'currency', 'supportPhone', 'businessWhatsApp',
  'businessWebsite', 'businessEmail', 'status', 'paymentStatus',
  'customer_name', 'store_name', 'service_name', 'plan', 'days_left', 'expiry_date',
  'amount',
] as const;

export function getExpiryWhatsAppTemplateId(daysRemaining: number): WhatsAppTemplateId {
  if (daysRemaining < 0) return 'subscription_expired';
  if (daysRemaining === 0) return 'renewal_due_today';
  if (daysRemaining === 1) return 'renewal_tomorrow';
  if (daysRemaining === 3) return 'renewal_in_3_days';
  if (daysRemaining === 7) return 'renewal_in_7_days';
  return 'renewal_reminder';
}

const defaultTemplates: WhatsAppTemplate[] = [
  ['welcome_customer', 'Welcome Customer', 'Hello {customerName},\n\nWelcome to {businessName}.\n\nThank you for choosing us.\n\nIf you need any help, please contact us.\n\n{businessName}'],
  ['renewal_reminder', 'Renewal Reminder', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription will expire on {expiryDate}.\n\nIf you would like to renew, please contact us.\n\nAmount: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['renewal_due_today', 'Renewal Due Today', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription expires today ({expiryDate}). Please contact us if you would like to renew.\n\nAmount: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['renewal_tomorrow', 'Renewal Due Tomorrow', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription expires tomorrow ({expiryDate}). Please contact us if you would like to renew.\n\nAmount: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['renewal_in_3_days', 'Renewal in 3 Days', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription will expire in 3 days on {expiryDate}. Please contact us if you would like to renew.\n\nAmount: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['renewal_in_7_days', 'Renewal in 7 Days', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription will expire in 7 days on {expiryDate}. Please contact us if you would like to renew.\n\nAmount: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['renewal_completed', 'Renewal Completed', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription has been renewed.\n\nNew expiry: {expiryDate}\nAmount: {currency}{totalAmount}\n\nThank you,\n{businessName}'],
  ['payment_reminder', 'Payment Reminder', 'Hello {customerName},\n\nYour payment for {serviceName} - {planName} is still due.\n\nTotal: {currency}{totalAmount}\nPaid: {currency}{paidAmount}\nDue: {currency}{dueAmount}\n\nPlease contact us if you need help.\n\nThank you,\n{businessName}'],
  ['payment_received', 'Payment Received', 'Hello {customerName},\n\nWe received your payment.\n\nService: {serviceName}\nAmount Paid: {currency}{paidAmount}\nPayment Method: {paymentMethod}\nInvoice: {invoiceNumber}\n\nThank you for your payment.\n\n{businessName}'],
  ['invoice_ready', 'Invoice Ready', 'Hello {customerName},\n\nYour invoice is ready.\n\nInvoice: {invoiceNumber}\nService: {serviceName}\nPlan: {planName}\nPeriod: {startDate} - {expiryDate}\nTotal: {currency}{totalAmount}\nPaid: {currency}{paidAmount}\nDue: {currency}{dueAmount}\n\nYour invoice is available in XolveManager.\n\nThank you,\n{businessName}'],
  ['subscription_activated', 'Subscription Activated', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription is active.\n\nStart: {startDate}\nExpiry: {expiryDate}\n\nThank you,\n{businessName}'],
  ['subscription_expired', 'Subscription Expired', 'Hello {customerName},\n\nYour {serviceName} - {planName} subscription expired on {expiryDate}.\n\nContact us if you would like to renew.\n\nThank you,\n{businessName}'],
  ['subscription_details', 'Subscription Details', 'Hello {customerName},\n\nSubscription details:\nService: {serviceName}\nPlan: {planName}\nStart: {startDate}\nExpiry: {expiryDate}\nStatus: {status}\nPayment status: {paymentStatus}\nPaid: {currency}{paidAmount}\nDue: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['due_payment_reminder', 'Due Payment Reminder', 'Hello {customerName},\n\nThis is a reminder that {currency}{dueAmount} is due for {serviceName} - {planName}.\n\nTotal: {currency}{totalAmount}\nPaid: {currency}{paidAmount}\nDue: {currency}{dueAmount}\n\nThank you,\n{businessName}'],
  ['custom_message', 'Custom Message', 'Hello {customerName},\n\n'],
].map(([templateId, name, message]) => ({
  templateId: templateId as WhatsAppTemplateId,
  name: name as string,
  type: templateId as WhatsAppTemplateId,
  message: message as string,
  enabled: true,
  variables: [...(message as string).matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const dangerousVariablePattern = /\{[^}]*?(?:password|passcode|pin|credential|secret|login|access.?code)[^}]*?\}/gi;
const variablePattern = /\{([^{}]+)\}/g;
const amountString = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
const currencySymbol = (currency: AppSettings['currency']): string => currency === 'BDT' ? '৳' : '$';

export function validateWhatsAppTemplate(message: string): string[] {
  const warnings: string[] = [];
  if (dangerousVariablePattern.test(message)) warnings.push('Sensitive credential placeholders are not allowed.');
  dangerousVariablePattern.lastIndex = 0;
  const unknown = [...message.matchAll(variablePattern)].map(match => match[1])
    .filter(name => !supportedWhatsAppVariables.includes(name as typeof supportedWhatsAppVariables[number]));
  if (unknown.length) warnings.push(`Unsupported variables: ${[...new Set(unknown)].map(name => `{${name}}`).join(', ')}.`);
  const withoutVariables = message.replace(variablePattern, '');
  if (/[{}]/.test(withoutVariables)) warnings.push('Template contains invalid placeholder syntax.');
  return warnings;
}

export function getWhatsAppTemplates(settings: AppSettings): WhatsAppTemplate[] {
  const saved = settings.whatsappPreferences?.templates || [];
  return defaultTemplates.map(defaultTemplate => {
    const customized = saved.find(template => template.templateId === defaultTemplate.templateId);
    return customized
      ? { ...defaultTemplate, ...customized }
      : { ...defaultTemplate, message: (settings.whatsappPreferences?.defaultLanguage || settings.language) === 'bn' && defaultTemplate.templateId === 'renewal_reminder'
        ? settings.whatsappReminderTemplateBN : defaultTemplate.templateId === 'renewal_reminder'
          ? settings.whatsappReminderTemplateEN : defaultTemplate.message };
  });
}

export function generateWhatsAppMessage(
  templateId: WhatsAppTemplateId,
  context: WhatsAppMessageContext,
  data: WhatsAppMessageData
): WhatsAppMessageResult {
  const template = getWhatsAppTemplates(data.settings).find(item => item.templateId === templateId && item.enabled);
  const missingFields: string[] = [];
  const warnings: string[] = [];
  if (!template) {
    return { message: '', phone: '', canOpen: false, missingFields: ['template'], warnings: ['Message template is unavailable or disabled.'] };
  }

  const payment = data.payments.find(item => item.id === context.paymentId);
  const sale = data.sales.find(item => item.id === context.saleId)
    || data.sales.find(item => item.id === payment?.saleId)
    || data.sales.find(item => item.id === data.invoices.find(invoice => invoice.invoiceId === context.invoiceId)?.saleId)
    || data.sales.find(item => item.id === data.subscriptions.find(sub => sub.id === context.subscriptionId)?.saleId);
  const subscription = data.subscriptions.find(item => item.id === context.subscriptionId)
    || data.subscriptions.find(item => item.id === payment?.subscriptionId)
    || data.subscriptions.find(item => item.id === sale?.subscriptionId);
  const invoice = data.invoices.find(item => item.invoiceId === context.invoiceId)
    || data.invoices.find(item => item.saleId === sale?.id)
    || data.invoices.find(item => item.invoiceId === payment?.invoiceId);
  const customerId = context.customerId || payment?.customerId || invoice?.customerId || sale?.customerId || subscription?.customerId;
  const customer = data.customers.find(item => item.id === customerId);
  const serviceId = sale?.serviceId || subscription?.serviceId || invoice?.serviceId;
  const service = data.services.find(item => item.id === serviceId);
  const plan = service?.planDetails?.find(item => item.id === (sale?.planId || subscription?.planId || invoice?.planId));
  const countryCode = data.settings.whatsappPreferences?.countryCode || '880';
  const normalizedPhone = customer?.whatsapp?.trim()
    ? normalizePhoneNumber(customer.whatsapp, countryCode) || normalizePhoneNumber(customer.phone, countryCode)
    : normalizePhoneNumber(customer?.phone || '', countryCode);
  const phone = normalizedPhone ? `+${normalizedPhone}` : '';
  const saleDue = sale ? getSaleDueAmount(sale, data.payments) : invoice?.dueAmount ?? subscription?.price ?? 0;
  const paid = sale ? getSalePaidAmount(sale, data.payments) : invoice?.paidAmount ?? 0;
  const total = sale?.amount ?? invoice?.totalAmount ?? subscription?.price ?? 0;
  const isRenewalAmount = ['renewal_reminder', 'renewal_due_today', 'renewal_tomorrow', 'renewal_in_3_days', 'renewal_in_7_days'].includes(templateId);
  const due = isRenewalAmount ? subscription?.price ?? 0 : saleDue;
  const sourceCurrency = sale?.currency || subscription?.currency || data.settings.currency;
  const convertAmount = (amount: number) => convertReportCurrency(amount, sourceCurrency, data.settings.currency);
  const daysRemaining = subscription ? getDaysDifference(subscription.expiryDate) : undefined;

  if (!customer) missingFields.push('customer');
  if (!phone) missingFields.push('phone');
  if (customer?.preferences?.contactAllowed === false) {
    missingFields.push('contact permission');
    warnings.push('This customer has opted out of contact.');
  }
  if (['renewal_reminder', 'renewal_due_today', 'renewal_completed', 'subscription_expired', 'subscription_details'].includes(templateId) && !subscription) missingFields.push('subscription');
  if (['payment_reminder', 'due_payment_reminder'].includes(templateId) && !sale) missingFields.push('sale');
  if (templateId === 'payment_received' && !payment) missingFields.push('payment');
  if (templateId === 'invoice_ready' && !invoice && !sale) missingFields.push('invoice');
  if (serviceId && !service) missingFields.push('service');
  if (subscription && daysRemaining !== undefined) {
    if (templateId === 'subscription_expired' && daysRemaining >= 0) {
      warnings.push('This subscription has not expired; choose a renewal reminder instead.');
    }
    if (templateId === 'renewal_due_today' && daysRemaining !== 0) {
      warnings.push('This subscription is not due today; choose the matching expiry reminder.');
    }
    if (templateId === 'renewal_tomorrow' && daysRemaining !== 1) {
      warnings.push('This subscription is not due tomorrow; choose the matching expiry reminder.');
    }
    if (templateId === 'renewal_in_3_days' && daysRemaining !== 3) {
      warnings.push('This subscription is not due in 3 days; choose the matching expiry reminder.');
    }
    if (templateId === 'renewal_in_7_days' && daysRemaining !== 7) {
      warnings.push('This subscription is not due in 7 days; choose the matching expiry reminder.');
    }
    if (templateId === 'renewal_reminder' && daysRemaining <= 0) {
      warnings.push('This subscription is not expiring in the future; choose the matching expiry reminder.');
    }
  }
  if (sale && ['payment_reminder', 'due_payment_reminder'].includes(templateId) && saleDue <= 0) {
    warnings.push('This sale is fully paid; a payment reminder is not available.');
  }
  if (payment && templateId === 'payment_received' && payment.paymentStatus !== 'paid' && payment.paymentStatus !== 'partial') {
    warnings.push('Only a successful payment can have a confirmation message.');
  }

  const variables: Record<string, string> = {
    businessName: data.settings.whatsappPreferences?.displayName?.trim() || data.settings.storeName || '',
    customerName: customer?.name || '',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || '',
    serviceName: service?.name || '',
    planName: sale?.plan || subscription?.plan || plan?.name || invoice?.invoiceNumber || '',
    accountName: '',
    profileName: '',
    startDate: subscription ? formatAppDate(subscription.startDate, data.settings.whatsappPreferences?.defaultLanguage || data.settings.language) : '',
    expiryDate: subscription ? formatAppDate(subscription.expiryDate, data.settings.whatsappPreferences?.defaultLanguage || data.settings.language) : '',
    daysRemaining: daysRemaining === undefined ? '' : String(daysRemaining),
    invoiceNumber: invoice?.invoiceNumber || sale?.invoiceNo || '',
    invoiceDate: invoice ? formatAppDate(invoice.invoiceDate, data.settings.whatsappPreferences?.defaultLanguage || data.settings.language) : '',
    saleId: sale?.id || '',
    paymentId: payment?.id || '',
    totalAmount: amountString(convertAmount(total)),
    paidAmount: amountString(convertAmount(payment?.amount ?? paid)),
    dueAmount: amountString(convertAmount(due)),
    paymentMethod: payment?.paymentMethodName || payment?.paymentMethod || sale?.paymentMethod || '',
    currency: currencySymbol(data.settings.currency),
    supportPhone: data.settings.contactPhone || '',
    businessWhatsApp: data.settings.whatsappNumber || '',
    businessWebsite: data.settings.businessProfile?.website || '',
    businessEmail: data.settings.adminEmail || '',
    status: subscription?.status || (subscription ? (daysRemaining !== undefined && daysRemaining < 0 ? 'expired' : 'active') : ''),
    paymentStatus: sale?.paymentStatus || payment?.paymentStatus || invoice?.paymentStatus || subscription?.paymentStatus || '',
    customer_name: customer?.name || '',
    store_name: data.settings.storeName || '',
    service_name: service?.name || '',
    plan: sale?.plan || subscription?.plan || plan?.name || '',
    days_left: daysRemaining === undefined ? '' : String(daysRemaining),
    expiry_date: subscription ? formatAppDate(subscription.expiryDate, data.settings.whatsappPreferences?.defaultLanguage || data.settings.language) : '',
    amount: amountString(convertAmount(total)),
  };
  const dangerousTokens = template.message.match(dangerousVariablePattern) || [];
  warnings.push(...validateWhatsAppTemplate(template.message));
  const templateVariables = [...template.message.matchAll(variablePattern)].map(match => match[1]);
  const unknownVariables = templateVariables.filter(name => !supportedWhatsAppVariables.includes(name as typeof supportedWhatsAppVariables[number]));

  let message = template.message.replace(variablePattern, (_token, name: string) => variables[name] ?? '');
  if (dangerousTokens.length || unknownVariables.length) message = '';
  const footer = data.settings.whatsappPreferences?.defaultFooter?.trim();
  if (footer && message.trim()) message = `${message.trimEnd()}\n\n${footer}`;
  const missingValueFields = templateVariables.filter(name =>
    supportedWhatsAppVariables.includes(name as typeof supportedWhatsAppVariables[number])
    && !variables[name]?.trim()
  );
  if (missingValueFields.length) warnings.push(`Some template values are unavailable: ${[...new Set(missingValueFields)].join(', ')}.`);
  if (!message.trim()) missingFields.push('message');
  return {
    message,
    phone,
    canOpen: missingFields.length === 0
      && !warnings.some(warning => warning.includes('Unsupported variables')
        || warning.includes('credential placeholders')
        || warning.includes('This subscription')
        || warning.includes('This sale is fully paid')
        || warning.includes('Only a successful payment'))
      && Boolean(createWhatsAppUrl(phone, message, countryCode)),
    missingFields: [...new Set(missingFields)],
    warnings,
  };
}

export { createWhatsAppUrl, openWhatsApp };
