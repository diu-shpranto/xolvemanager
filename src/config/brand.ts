import packageJson from '../../package.json';

export const productBrand = {
  name: 'XolveManager',
  shortName: 'XolveManager',
  tagline: 'Business, Simplified.',
  description: 'Business management for customers, services, subscriptions, sales, and payments.',
  faviconUrl: '/icons/xolvemanager-violet-32.png',
  iconUrl: '/icons/xolvemanager-violet-192.png',
  wordmarkDarkUrl: '/xolvemanager-wordmark-violet-dark.png',
  wordmarkLightUrl: '/xolvemanager-wordmark-violet-light.png',
  primaryColor: '#8B5CF6',
  primaryHoverColor: '#7C3AED',
  accentColor: '#C4B5FD',
  surfaceColor: '#ffffff',
  backgroundColor: '#0B0B1B',
  version: packageJson.version,
} as const;

export const APP_BRAND = productBrand;

export const DEFAULT_INVOICE_BUSINESS_NAME = 'XolveManager';
export const DEFAULT_INVOICE_SUPPORT_NUMBER = '01614661521';
