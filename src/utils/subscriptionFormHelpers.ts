/** Quick-pick durations (in days) offered in the New/Edit Subscription forms. */
export const SUBSCRIPTION_DURATION_CHIPS = [7, 30, 90, 365] as const;

/** Which duration chip (if any) matches the current duration. */
export function getActiveDurationChip(duration: number): number | null {
  if (!Number.isFinite(duration)) return null;
  return (SUBSCRIPTION_DURATION_CHIPS as readonly number[]).includes(duration) ? duration : null;
}

export type NewSubscriptionFormErrorTarget =
  | 'customer'
  | 'service'
  | 'account'
  | 'profile'
  | 'startDate'
  | 'duration'
  | 'price';

export interface NewSubscriptionFormErrorTargetInput {
  customerId: string;
  customerExists: boolean;
  serviceId: string;
  serviceArchived: boolean;
  accountId: string;
  accountExists: boolean;
  accountBelongsToService: boolean;
  profileId: string;
  profileExists: boolean;
  profileAssignedToOtherCustomer: boolean;
  startDate: string;
  duration: number;
  price: number;
}

/**
 * Mirrors the check order of SubscriptionsView.handleCreateNewSubscription
 * (customer → service → service account (login) → profile, then the fields
 * the native `required` attributes used to guard) and returns the field the
 * user should be jumped to for the FIRST failing check, or null when the
 * form is valid. Pure — used by the New Subscription drawer to scroll to
 * and focus the field that needs fixing (opening the collapsed advanced
 * section first when the failing field lives there).
 */
export function getFirstNewSubscriptionFormErrorTarget(
  input: NewSubscriptionFormErrorTargetInput,
): NewSubscriptionFormErrorTarget | null {
  if (!input.customerId || !input.customerExists) return 'customer';
  if (!input.serviceId || input.serviceArchived) return 'service';
  if (input.accountId && !input.accountExists) return 'account';
  if (input.accountId && !input.accountBelongsToService) return 'account';
  if (input.profileId && !input.profileExists) return 'profile';
  if (input.profileId && input.profileAssignedToOtherCustomer) return 'profile';
  if (!input.startDate || !Number.isFinite(Date.parse(`${input.startDate}T00:00:00`))) return 'startDate';
  if (!Number.isFinite(input.duration) || input.duration < 1) return 'duration';
  if (!Number.isFinite(input.price) || input.price < 0) return 'price';
  return null;
}

export type EditSubscriptionFormErrorTarget = 'plan' | 'startDate' | 'duration' | 'price';

export interface EditSubscriptionFormErrorTargetInput {
  plan: string;
  startDate: string;
  duration: number;
  price: number;
}

/**
 * Mirrors the `required` guards of the Safe Edit Subscription drawer
 * (plan, start date, duration, price) and returns the field the user should
 * be jumped to for the FIRST failing check, or null when the form is valid.
 * Pure — used by the Edit Subscription drawer to scroll to and focus the
 * field that needs fixing.
 */
export function getFirstEditSubscriptionFormErrorTarget(
  input: EditSubscriptionFormErrorTargetInput,
): EditSubscriptionFormErrorTarget | null {
  if (!input.plan.trim()) return 'plan';
  if (!input.startDate || !Number.isFinite(Date.parse(`${input.startDate}T00:00:00`))) return 'startDate';
  if (!Number.isFinite(input.duration) || input.duration < 1) return 'duration';
  if (!Number.isFinite(input.price) || input.price < 0) return 'price';
  return null;
}
