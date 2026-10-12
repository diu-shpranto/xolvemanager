const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableBackupContent = (value: unknown): string => JSON.stringify(value, (key, item: unknown) => {
  if (key === 'integrityChecksum') return undefined;
  if (!isRecord(item)) return item;
  return Object.keys(item).sort().reduce<Record<string, unknown>>((sorted, itemKey) => {
    sorted[itemKey] = item[itemKey];
    return sorted;
  }, {});
});

export function createBackupChecksum(value: unknown): string {
  const content = stableBackupContent(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function verifyBackupChecksum(value: unknown): 'valid' | 'missing' | 'invalid' {
  if (!isRecord(value) || value.integrityChecksum === undefined) return 'missing';
  if (typeof value.integrityChecksum !== 'string'
    || !/^fnv1a32:[0-9a-f]{8}$/.test(value.integrityChecksum)) return 'invalid';
  return value.integrityChecksum === createBackupChecksum(value) ? 'valid' : 'invalid';
}
