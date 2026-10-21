import type { Account, AccountProfile, Service, Subscription } from '../types';
import { getCalendarDateInTimeZone, getDaysDifference } from './dateUtils';

export const RESOURCE_CAPACITY_THRESHOLDS = {
  almostFull: 0.8,
  highCapacity: 0.9,
  expiringSoonDays: 7,
} as const;

export type ResourceCapacityStatus = 'Available' | 'Almost Full' | 'Full';
export type DerivedProfileStatus = 'Available' | 'Assigned' | 'Expired' | 'Suspended' | 'Inactive';

export interface AccountCapacity {
  capacity: number;
  used: number;
  available: number;
  utilization: number;
  status: ResourceCapacityStatus;
  assignedProfiles: number;
  availableProfiles: number;
}

export type AccountHealthStatus =
  | 'Active'
  | 'Full'
  | 'Available capacity'
  | 'Expired'
  | 'Unavailable'
  | 'Review required';

export interface AccountInventoryMetrics {
  capacity: number;
  configuredProfiles: number;
  assignedProfiles: number;
  availableProfiles: number;
  remainingCapacity: number;
  dataReviewRequired: boolean;
  health: AccountHealthStatus;
}

export interface ServiceResourceSummary {
  serviceId: string;
  accountCount: number;
  activeAccounts: number;
  profileCapacity: number;
  usedProfiles: number;
  availableProfiles: number;
  utilization: number;
}

export const isAccountOperational = (account: Account, timeZone?: string): boolean => {
  if (['Inactive', 'Suspended', 'Expired'].includes(account.status)) return false;
  if (!account.expiryDate) return true;
  const expiryDate = getCalendarDateInTimeZone(account.expiryDate, timeZone);
  return Boolean(expiryDate) && getDaysDifference(expiryDate, timeZone) >= 0;
};

export const getAccountInventoryMetrics = (account: Account, timeZone?: string): AccountInventoryMetrics => {
  const profiles = Array.isArray(account.profiles) ? account.profiles : [];
  const capacity = Math.max(0, Number.isFinite(account.maxProfiles) ? Math.floor(account.maxProfiles) : 0);
  const assignedProfiles = profiles.filter(profile =>
    profile.status === 'Assigned' || Boolean(profile.assignedCustomerId)
  ).length;
  const availableProfiles = isAccountOperational(account, timeZone)
    ? profiles.filter(profile =>
      profile.status === 'Available'
      && !profile.assignedCustomerId
      && (!profile.expiryDate || getDaysDifference(profile.expiryDate, timeZone) >= 0)
    ).length
    : 0;
  const profileIds = new Set<string>();
  const inconsistentProfiles = profiles.some(profile => {
    const duplicateOrMissingId = !profile.id || profileIds.has(profile.id);
    if (profile.id) profileIds.add(profile.id);
    return duplicateOrMissingId
      || profile.accountId !== account.id
      || (profile.status === 'Available' && Boolean(profile.assignedCustomerId))
      || (profile.status === 'Assigned' && !profile.assignedCustomerId);
  });
  const invalidAccountExpiry = Boolean(account.expiryDate
    && !Number.isFinite(Date.parse(`${account.expiryDate}T00:00:00`)));
  const dataReviewRequired = !Number.isInteger(account.maxProfiles)
    || account.maxProfiles < 0
    || profiles.length > capacity
    || profiles.length !== capacity
    || !Array.isArray(account.profiles)
    || invalidAccountExpiry
    || inconsistentProfiles;
  const expired = account.status === 'Expired'
    || Boolean(account.expiryDate && getDaysDifference(account.expiryDate, timeZone) < 0);
  const unavailable = ['Inactive', 'Suspended'].includes(account.status);
  const full = capacity > 0 && assignedProfiles >= capacity;
  const health: AccountHealthStatus = dataReviewRequired
    ? 'Review required'
    : expired
      ? 'Expired'
      : unavailable
        ? 'Unavailable'
        : full
          ? 'Full'
          : capacity - assignedProfiles > 0 && availableProfiles > 0
            ? 'Available capacity'
            : 'Active';

  return {
    capacity,
    configuredProfiles: profiles.length,
    assignedProfiles,
    availableProfiles,
    remainingCapacity: Math.max(0, capacity - assignedProfiles),
    dataReviewRequired,
    health,
  };
};

export const getAccountCapacity = (account: Account): AccountCapacity => {
  const capacity = Math.max(0, Number.isFinite(account.maxProfiles) ? Math.floor(account.maxProfiles) : 0);
  const assignedProfiles = account.profiles.filter(profile =>
    profile.status === 'Assigned' || Boolean(profile.assignedCustomerId)
  ).length;
  const used = Math.min(capacity, assignedProfiles);
  const availableProfiles = account.profiles.filter(profile =>
    profile.status === 'Available' && !profile.assignedCustomerId
  ).length;
  const utilization = capacity === 0 ? 0 : used / capacity;
  return {
    capacity,
    used,
    available: Math.max(0, capacity - used),
    utilization,
    status: capacity > 0 && used >= capacity
      ? 'Full'
      : utilization >= RESOURCE_CAPACITY_THRESHOLDS.almostFull && capacity > 0
        ? 'Almost Full'
        : 'Available',
    assignedProfiles,
    availableProfiles,
  };
};

export const getProfileStatus = (profile: AccountProfile, account: Account, timeZone?: string): DerivedProfileStatus => {
  if (profile.status === 'Suspended' || account.status === 'Suspended') return 'Suspended';
  if (account.status === 'Expired'
    || (account.expiryDate !== undefined && getDaysDifference(account.expiryDate, timeZone) < 0)
    || (profile.expiryDate !== undefined && getDaysDifference(profile.expiryDate, timeZone) < 0)) return 'Expired';
  if (profile.status === 'Inactive' || profile.status === 'Disabled'
    || account.status === 'Inactive') return 'Inactive';
  return profile.assignedCustomerId || profile.status === 'Assigned' ? 'Assigned' : 'Available';
};

export const getAvailableProfiles = (
  accounts: Account[],
  serviceId?: string,
  planId?: string,
  excludedProfileId?: string,
  timeZone?: string
): Array<{ account: Account; profile: AccountProfile }> => accounts.flatMap(account => {
  if (!isAccountOperational(account, timeZone) || account.allowNewAssignment === false
    || (serviceId && account.serviceId !== serviceId)) return [];
  if (planId && account.planId && account.planId !== planId) return [];
  if (getAccountCapacity(account).available <= 0) return [];
  return account.profiles
    .filter(profile => profile.id !== excludedProfileId
      && profile.status === 'Available'
      && !profile.assignedCustomerId
      && (!profile.expiryDate || getDaysDifference(profile.expiryDate, timeZone) >= 0))
    .map(profile => ({ account, profile }));
});

export const getServiceResourceSummary = (
  services: Service[],
  accounts: Account[],
  timeZone?: string
): ServiceResourceSummary[] => {
  const accountsByServiceId = new Map<string, Account[]>();
  accounts.forEach(account => {
    const serviceAccounts = accountsByServiceId.get(account.serviceId) || [];
    serviceAccounts.push(account);
    accountsByServiceId.set(account.serviceId, serviceAccounts);
  });
  return services.map(service => {
    const serviceAccounts = accountsByServiceId.get(service.id) || [];
    const capacities = serviceAccounts.map(getAccountCapacity);
    const profileCapacity = capacities.reduce((total, capacity) => total + capacity.capacity, 0);
    const usedProfiles = capacities.reduce((total, capacity) => total + capacity.used, 0);
    return {
      serviceId: service.id,
      accountCount: serviceAccounts.length,
      activeAccounts: serviceAccounts.filter(account => isAccountOperational(account, timeZone)).length,
      profileCapacity,
      usedProfiles,
      availableProfiles: Math.max(0, profileCapacity - usedProfiles),
      utilization: profileCapacity ? usedProfiles / profileCapacity : 0,
    };
  });
};

export const isSubscriptionCompatibleWithResource = (
  subscription: Pick<Subscription, 'serviceId' | 'planId'>,
  account: Account,
  serviceId: string,
  planId?: string
): boolean => subscription.serviceId === serviceId
  && account.serviceId === serviceId
  && (!planId || !account.planId || account.planId === planId)
  && (!subscription.planId || !planId || subscription.planId === planId);
