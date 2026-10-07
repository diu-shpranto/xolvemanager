import { Customer, Language, Service, Subscription } from '../types';
import { formatAppDate, formatCurrency, getExpiryBadgeInfo, getSubscriptionReminderDays } from './dateUtils';
import { openWhatsApp } from './phoneUtils';

export function openSubscriptionWhatsAppReminder(
  subscription: Subscription,
  customer: Customer | undefined,
  service: Service | undefined,
  template: string,
  language: Language,
  saleDetails?: { invoiceNumber?: string; amount?: number; currency?: string }
): boolean {
  if (!customer || !service || !(customer.whatsapp?.trim() || customer.phone.trim())) return false;

  const message = buildSubscriptionRenewalMessage(subscription, customer, service, template, language, saleDetails);
  if (!message) return false;
  return openWhatsApp(customer.whatsapp?.trim() || customer.phone, message);
}

export function buildSubscriptionRenewalMessage(
  subscription: Subscription,
  customer: Customer | undefined,
  service: Service | undefined,
  template: string,
  language: Language,
  saleDetails?: { invoiceNumber?: string; amount?: number; currency?: string }
): string | undefined {
  if (!customer || !service) return undefined;
  const badge = getExpiryBadgeInfo(subscription.expiryDate, language, getSubscriptionReminderDays(service, subscription.planId));
  const variables: Record<string, string> = {
    customer_name: customer.name,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    service_name: service.name,
    serviceName: service.name,
    plan: subscription.plan,
    planName: subscription.plan,
    days_left: badge.shortLabel,
    expiry_date: formatAppDate(subscription.expiryDate, language),
    expiryDate: formatAppDate(subscription.expiryDate, language),
    startDate: formatAppDate(subscription.startDate, language),
    invoiceNumber: saleDetails?.invoiceNumber || '',
    amount: saleDetails?.amount === undefined ? '' : formatCurrency(saleDetails.amount, subscription.currency),
    currency: saleDetails?.currency || subscription.currency,
  };
  return template.replace(/\{([a-zA-Z_]+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : placeholder
  );
}
