import packageJson from '../../package.json';

export const productBrand = {
  name: 'XolveManager',
  shortName: 'XolveManager',
  tagline: 'Business Management Platform',
  description: 'Business Management Platform',
  logoUrl: undefined as string | undefined,
  faviconUrl: '/favicon.svg',
  primaryColor: '#059669',
  primaryHoverColor: '#047857',
  accentColor: '#34d399',
  surfaceColor: '#ffffff',
  backgroundColor: '#f6f8f7',
  version: packageJson.version,
} as const;

export const APP_BRAND = productBrand;

export const DEFAULT_INVOICE_BUSINESS_NAME = 'ShopiQue Prime Store';
export const DEFAULT_INVOICE_SUPPORT_NUMBER = '01614661521';
