import type { DurationUnit } from '../types';

/** Quick-pick durations (in days) offered in the Add Service plan editor. */
export const SERVICE_DURATION_CHIPS = [7, 30, 90, 365] as const;

export interface DurationDraft {
  duration: number | '';
  durationUnit: DurationUnit;
}

/** Apply a duration chip: sets the duration in days and the unit to Days. */
export function applyDurationChip<T extends DurationDraft>(draft: T, days: number): T {
  return { ...draft, duration: days, durationUnit: 'Days' };
}

/** Which duration chip (if any) matches the current draft duration/unit. */
export function getActiveDurationChip(
  duration: number | '',
  durationUnit: DurationUnit,
): number | null {
  if (durationUnit !== 'Days' || typeof duration !== 'number') return null;
  return (SERVICE_DURATION_CHIPS as readonly number[]).includes(duration) ? duration : null;
}

export type ServiceFormErrorTarget =
  | 'name'
  | 'description'
  | 'logo'
  | 'reminder'
  | 'profiles'
  | 'plans'
  | 'defaultCost'
  | 'planCost';

export interface ServiceFormErrorTargetInput {
  name: string;
  description: string;
  logoUrl: string;
  reminderEnabled: boolean;
  reminderDays: number;
  usesProfiles: boolean;
  profileCapacity: number;
  plans: {
    price: number;
    durationDays: number;
    directCostType?: string | null;
    directCostAmount?: number;
  }[];
  defaultDirectCostType: string;
  defaultDirectCostAmount: number | '';
}

/**
 * Mirrors the check order of ServicesView.validateForm and returns the section
 * the user should be jumped to for the FIRST failing check, or null when the
 * form is valid. Pure — used by the Add/Edit Service modal to scroll to and
 * focus the field that needs fixing.
 */
export function getFirstServiceFormErrorTarget(
  input: ServiceFormErrorTargetInput,
): ServiceFormErrorTarget | null {
  if (!input.name.trim() || input.name.trim().length < 2 || input.name.trim().length > 80) return 'name';
  if (input.description.length > 500) return 'description';
  if (input.logoUrl.trim()) {
    try {
      const url = new URL(input.logoUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'logo';
    } catch {
      return 'logo';
    }
  }
  if (input.reminderEnabled && (!Number.isInteger(input.reminderDays) || input.reminderDays < 1)) return 'reminder';
  if (input.usesProfiles && (!Number.isInteger(input.profileCapacity) || input.profileCapacity < 1)) return 'profiles';
  if (
    input.plans.some(
      plan =>
        !Number.isFinite(plan.price) ||
        plan.price <= 0 ||
        !Number.isFinite(plan.durationDays) ||
        plan.durationDays <= 0,
    )
  ) {
    return 'plans';
  }
  if (
    input.defaultDirectCostType !== 'none' &&
    (input.defaultDirectCostAmount === '' ||
      !Number.isFinite(Number(input.defaultDirectCostAmount)) ||
      Number(input.defaultDirectCostAmount) < 0)
  ) {
    return 'defaultCost';
  }
  if (
    input.plans.some(
      plan =>
        plan.directCostType &&
        plan.directCostType !== 'none' &&
        (!Number.isFinite(plan.directCostAmount) || Number(plan.directCostAmount) < 0),
    )
  ) {
    return 'planCost';
  }
  return null;
}
