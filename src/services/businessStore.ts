import {
  createRecordId,
  readJsonValue,
  removeStoredValue,
  STORAGE_KEYS,
  updateJsonValue,
  writeJsonValue,
} from './localStorageStore';

const BUSINESS_OWNER_ID = 'local-user';

export interface CurrentBusiness {
  businessId: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

interface StoredBusiness {
  name: string;
  businessId?: string;
  ownerId?: string;
  createdAt?: string;
}

const isStoredBusiness = (value: unknown): value is StoredBusiness =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { name?: unknown }).name === 'string';

export const getBusinessName = (): string => {
  const business = readJsonValue<StoredBusiness | null>(
    STORAGE_KEYS.BUSINESS,
    null,
    (value): value is StoredBusiness | null => value === null || isStoredBusiness(value)
  );
  return business?.name.trim() || '';
};

export const setBusinessName = (name: string): CurrentBusiness => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    throw new Error('Business name must be between 2 and 80 characters.');
  }

  const existing = readBusinessRecord();
  const business: CurrentBusiness = {
    businessId: existing?.businessId || createRecordId('business'),
    name: trimmedName,
    ownerId: existing?.ownerId || BUSINESS_OWNER_ID,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  updateJsonValue(
    STORAGE_KEYS.BUSINESS,
    null,
    (value): value is StoredBusiness | null => value === null || isStoredBusiness(value),
    () => business
  );
  return business;
};

export const createRestoredBusinessRecord = (value: unknown, fallbackName: string): CurrentBusiness => {
  const source = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Partial<CurrentBusiness>
    : {};
  const name = typeof source.name === 'string' ? source.name.trim() : fallbackName.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error('Backup contains an invalid business name.');
  }
  const business: CurrentBusiness = {
    businessId: typeof source.businessId === 'string' && source.businessId.trim()
      ? source.businessId
      : createRecordId('business'),
    name,
    ownerId: typeof source.ownerId === 'string' && source.ownerId.trim()
      ? source.ownerId
      : BUSINESS_OWNER_ID,
    createdAt: typeof source.createdAt === 'string' && Number.isFinite(Date.parse(source.createdAt))
      ? source.createdAt
      : new Date().toISOString(),
  };
  return business;
};

export const clearBusinessName = (): void => {
  removeStoredValue(STORAGE_KEYS.BUSINESS);
};

export const getCurrentBusiness = (): CurrentBusiness | null => {
  const stored = readBusinessRecord();
  if (!stored?.name.trim()) return null;

  const business: CurrentBusiness = {
    businessId: stored.businessId || createRecordId('business'),
    name: stored.name.trim(),
    ownerId: stored.ownerId || BUSINESS_OWNER_ID,
    createdAt: stored.createdAt || new Date().toISOString(),
  };

  if (!stored.businessId || !stored.ownerId || !stored.createdAt || stored.name !== business.name) {
    writeJsonValue(STORAGE_KEYS.BUSINESS, business);
  }
  return business;
};

const readBusinessRecord = (): StoredBusiness | null =>
  readJsonValue<StoredBusiness | null>(
    STORAGE_KEYS.BUSINESS,
    null,
    (value): value is StoredBusiness | null => value === null || isStoredBusiness(value)
  );
