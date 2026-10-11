import packageJson from '../../package.json';

export const productBrand = {
  name: 'XolveManager',
  shortName: 'XolveManager',
  tagline: 'Business Management Platform',
  description: 'Business Management Platform',
  faviconUrl: '/favicon.svg',
  primaryColor: '#7C3AED',
  primaryHoverColor: '#6D28D9',
  accentColor: '#A78BFA',
  surfaceColor: '#ffffff',
  backgroundColor: '#F8FAFC',
  version: packageJson.version,
} as const;

export const APP_BRAND = productBrand;

export const DEFAULT_INVOICE_BUSINESS_NAME = 'XolveManager';
export const DEFAULT_INVOICE_SUPPORT_NUMBER = '01614661521';
