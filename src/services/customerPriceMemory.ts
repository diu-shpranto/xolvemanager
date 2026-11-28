/**
 * Per-customer remembered plan prices for the Express Sale flow.
 *
 * When a seller charges a customer a custom price for a plan, the price is
 * remembered for that customer + plan so the next sale to the same customer
 * pre-fills it. A different customer always gets the catalog price.
 *
 * Storage: the map lives on the Customer record
 * (`customer.rememberedPlanPrices`, keyed by plan id). Customer records are
 * persisted wholesale in localStorage, included in backups, and synced to
 * the cloud via the existing auto-sync (the full record rides in the cloud
 * row's `data` payload), so no new table or storage key is needed.
 *
 * The plan catalog price is never changed — the remembered price is only a
 * pre-fill suggestion. Saving a sale at the catalog price clears the
 * remembered price for that customer + plan.
 */
import type { AppCurrency, Customer, RememberedPlanPrice, Service } from '../types/index.ts';

export const getRememberedPrice = (
  customer: Customer | null | undefined,
  planId: string
): RememberedPlanPrice | undefined => {
  if (!customer || !planId) return undefined;
  const entry = customer.rememberedPlanPrices?.[planId];
  if (!entry || !Number.isFinite(entry.price) || entry.price <= 0) return undefined;
  return entry;
};

export const resolveEffectivePrice = (
  customer: Customer | null | undefined,
  plan: { id: string; price: number; currency: AppCurrency }
): { price: number; currency: AppCurrency; fromMemory: boolean } => {
  const remembered = getRememberedPrice(customer, plan.id);
  if (remembered && remembered.currency === plan.currency) {
    return { price: remembered.price, currency: remembered.currency, fromMemory: true };
  }
  return { price: plan.price, currency: plan.currency, fromMemory: false };
};

export interface PricedSaleItemInput {
  planId?: string;
  unitPrice: number;
  currency: AppCurrency;
}

/**
 * Builds the customer update that records what this sale charged per plan.
 * Returns null when nothing changed (no custom prices, nothing to clear).
 * Never mutates the customer or the items.
 */
export const applyPriceMemoryUpdates = (
  customer: Customer,
  items: PricedSaleItemInput[],
  services: Service[]
): { rememberedPlanPrices: Record<string, RememberedPlanPrice> } | null => {
  const next: Record<string, RememberedPlanPrice> = { ...(customer.rememberedPlanPrices ?? {}) };
  let changed = false;
  for (const item of items) {
    if (!item.planId || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0) continue;
    const catalog = services
      .flatMap(service => service.planDetails ?? [])
      .find(plan => plan.id === item.planId);
    if (!catalog) continue;
    const existing = next[item.planId];
    if (item.unitPrice !== catalog.price) {
      if (!existing || existing.price !== item.unitPrice || existing.currency !== item.currency) {
        next[item.planId] = { price: item.unitPrice, currency: item.currency };
        changed = true;
      }
    } else if (existing) {
      delete next[item.planId];
      changed = true;
    }
  }
  return changed ? { rememberedPlanPrices: next } : null;
};
