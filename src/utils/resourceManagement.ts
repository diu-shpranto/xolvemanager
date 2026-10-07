import type { Account, AccountProfile, Service, Subscription } from '../types';
import { getDaysDifference } from './dateUtils';

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

export interface ServiceResourceSummary {
  serviceId: string;
  accountCount: number;
  activeAccounts: number;
  profileCapacity: number;
  usedProfiles: number;
  availableProfiles: number;
  utilization: number;
}

export const isAccountOperational = (account: Account, today = new Date()): boolean => {
  if (['Inactive', 'Suspended', 'Expired'].includes(account.status)) return false;
  if (!account.expiryDate) return true;
  const expiry = new Date(`${account.expiryDate}T00:00:00`);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Number.isFinite(expiry.getTime()) && expiry >= current;
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
  const utilization = capacity === 0 ? 1 : used / capacity;
  return {
    capacity,
    used,
    available: Math.max(0, capacity - used),
    utilization,
    status: used >= capacity ? 'Full' : utilization >= RESOURCE_CAPACITY_THRESHOLDS.almostFull ? 'Almost Full' : 'Available',
    assignedProfiles,
    availableProfiles,
  };
};

export const getProfileStatus = (profile: AccountProfile, account: Account): DerivedProfileStatus => {
  if (profile.status === 'Suspended' || account.status === 'Suspended') return 'Suspended';
  if (account.status === 'Expired'
    || (account.expiryDate !== undefined && getDaysDifference(account.expiryDate) < 0)
    || (profile.expiryDate !== undefined && getDaysDifference(profile.expiryDate) < 0)) return 'Expired';
  if (profile.status === 'Inactive' || profile.status === 'Disabled'
    || account.status === 'Inactive') return 'Inactive';
  return profile.assignedCustomerId || profile.status === 'Assigned' ? 'Assigned' : 'Available';
};

export const getAvailableProfiles = (
  accounts: Account[],
  serviceId?: string,
  planId?: string,
  excludedProfileId?: string
): Array<{ account: Account; profile: AccountProfile }> => accounts.flatMap(account => {
  if (!isAccountOperational(account) || account.allowNewAssignment === false
    || (serviceId && account.serviceId !== serviceId)) return [];
  if (planId && account.planId && account.planId !== planId) return [];
  if (getAccountCapacity(account).available <= 0) return [];
  return account.profiles
    .filter(profile => profile.id !== excludedProfileId
      && profile.status === 'Available'
      && !profile.assignedCustomerId
      && (!profile.expiryDate || getDaysDifference(profile.expiryDate) >= 0))
    .map(profile => ({ account, profile }));
});

export const getServiceResourceSummary = (
  services: Service[],
  accounts: Account[]
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
      activeAccounts: serviceAccounts.filter(account => isAccountOperational(account)).length,
      profileCapacity,
      usedProfiles,
      availableProfiles: Math.max(0, profileCapacity - usedProfiles),
      utilization: profileCapacity ? usedProfiles / profileCapacity : 0,
    };
  });
};

export const isSubscriptionCompatibleWithResource = (
  subscription: Subscription,
  account: Account,
  serviceId: string,
  planId?: string
): boolean => subscription.serviceId === serviceId
  && account.serviceId === serviceId
  && (!planId || !account.planId || account.planId === planId)
  && (!subscription.planId || !planId || subscription.planId === planId);
