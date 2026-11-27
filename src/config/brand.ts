import packageJson from '../../package.json' with { type: 'json' };

export const productBrand = {
  name: 'XolveManager',
  shortName: 'XolveManager',
  tagline: 'Business, Simplified.',
  description: 'Business management for customers, services, subscriptions, sales, and payments.',
  faviconUrl: '/icons/xolvemanager-brand-32.png',
  iconUrl: '/icons/xolvemanager-violet-192-v3.png',
  wordmarkDarkUrl: '/xolvemanager-wordmark-violet-dark-v3.png',
  wordmarkLightUrl: '/xolvemanager-wordmark-violet-light-v3.png',
  // Stacked original artwork (icon above "XolveManager" text, one image,
  // transparent) — used on the sign-in / sign-up pages, exactly as the
  // owner drew it. The horizontal wordmark above stays for the small
  // spots (sidebar, navbar, footer).
  stackedLogoUrl: '/xolvemanager-logo-stacked.png',
  primaryColor: '#8B5CF6',
  primaryHoverColor: '#7C3AED',
  accentColor: '#C4B5FD',
  launchColor: '#380759',
  surfaceColor: '#ffffff',
  backgroundColor: '#0B0B1B',
  version: packageJson.version,
} as const;

export const APP_BRAND = productBrand;

export const DEFAULT_INVOICE_BUSINESS_NAME = 'XolveManager';
export const DEFAULT_INVOICE_SUPPORT_NUMBER = '01614661521';
