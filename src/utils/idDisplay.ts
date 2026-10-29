export function formatCompactIdentifier(value: string, maxLength = 18): string {
  const identifier = value.trim();
  if (identifier.length <= maxLength) return identifier;

  const charactersOnEachSide = Math.max(1, Math.floor((maxLength - 1) / 2));
  const prefix = identifier.slice(0, charactersOnEachSide).replace(/[-_]+$/, '');
  const suffix = identifier.slice(-charactersOnEachSide).replace(/^[-_]+/, '');
  return `${prefix}…${suffix}`;
}
