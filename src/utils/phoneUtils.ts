const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export function normalizePhoneNumber(phone: string, countryCode = '880'): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  let digits = digitsOnly(trimmed);
  if (trimmed.startsWith('00')) {
    digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? digits : '';
  }
  else if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : '';

  const normalizedCountryCode = digitsOnly(countryCode);
  if (normalizedCountryCode && digits.startsWith(normalizedCountryCode) && digits.length >= 8 && digits.length <= 15) {
    return digits;
  }
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!normalizedCountryCode) return digits.length >= 8 && digits.length <= 15 ? digits : '';
  const normalized = `${normalizedCountryCode}${digits}`;
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : '';
}

export function formatPhoneNumber(phone: string, countryCode = '880'): string {
  const normalized = normalizePhoneNumber(phone, countryCode);
  return normalized ? `+${normalized}` : '';
}

export function isValidPhoneNumber(phone: string, countryCode = '880'): boolean {
  return Boolean(normalizePhoneNumber(phone, countryCode));
}

export function createWhatsAppUrl(phone: string, message = '', countryCode = '880'): string {
  const normalized = normalizePhoneNumber(phone, countryCode);
  if (!normalized) return '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${query}`;
}

export function openWhatsApp(phone: string, message: string, countryCode = '880'): boolean {
  const url = createWhatsAppUrl(phone, message, countryCode);
  if (!url) return false;
  const openedWindow = window.open(url, '_blank');
  if (!openedWindow) return false;
  openedWindow.opener = null;
  return true;
}
