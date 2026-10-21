type DirtyCheck = () => boolean;

const dirtyChecks = new Map<symbol, DirtyCheck>();

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'undefined';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(',')}}`;
}

function hasUnsavedChanges(): boolean {
  for (const isDirty of dirtyChecks.values()) {
    if (isDirty()) return true;
  }
  return false;
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
}

export function registerUnsavedChanges(isDirty: DirtyCheck): () => void {
  const id = Symbol('unsaved-form');
  dirtyChecks.set(id, isDirty);
  if (dirtyChecks.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }
  return () => {
    dirtyChecks.delete(id);
    if (dirtyChecks.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  };
}

export function confirmUnsavedChangesBeforeNavigation(): boolean {
  if (!hasUnsavedChanges()) return true;
  return typeof window !== 'undefined'
    && window.confirm('You have unsaved changes. Leave this page and discard them?');
}

export function hasRegisteredUnsavedChanges(): boolean {
  return hasUnsavedChanges();
}
