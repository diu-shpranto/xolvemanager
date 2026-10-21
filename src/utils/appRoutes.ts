import type { NavSection } from '../components/navigation/Sidebar';

export type RecordSection = 'customers' | 'services' | 'accounts' | 'subscriptions' | 'sales' | 'payments' | 'invoices';
export type SettingsStartSection = 'data' | 'messages';

export const sectionPaths: Record<NavSection, string> = {
  dashboard: '/dashboard',
  customers: '/customers',
  services: '/services',
  accounts: '/accounts',
  profiles: '/profiles',
  subscriptions: '/subscriptions',
  sales: '/sales',
  payments: '/payments',
  cashbook: '/cashbook',
  'financial-control': '/financial-control',
  'data-integrity': '/data-integrity',
  expenses: '/expenses',
  'daily-closing': '/daily-closing',
  invoices: '/invoices',
  history: '/history',
  profitability: '/profitability',
  reports: '/reports',
  settings: '/settings',
  notifications: '/notifications',
  reminders: '/reminders',
  search: '/search',
};

const recordSections: Record<RecordSection, NavSection> = {
  customers: 'customers',
  services: 'services',
  accounts: 'accounts',
  subscriptions: 'subscriptions',
  sales: 'sales',
  payments: 'payments',
  invoices: 'invoices',
};

const routeAliases: Record<string, NavSection> = {
  '/': 'dashboard',
  '/transfers': 'cashbook',
  '/communications': 'settings',
  '/audit-log': 'history',
  '/backup': 'settings',
};

const authPaths = new Set(['/login', '/signup', '/forgot-password']);

export interface AppLocation {
  section: NavSection;
  recordSection?: RecordSection;
  recordId?: string;
  settingsStartSection?: SettingsStartSection;
  isNotFound?: boolean;
}

export const getAppLocation = (pathname: string): AppLocation => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments.length === 2 && Object.hasOwn(recordSections, segments[0]) && segments[1]) {
    const recordSection = segments[0] as RecordSection;
    return {
      section: recordSections[recordSection],
      recordSection,
      recordId: segments[1],
    };
  }

  const section = routeAliases[normalizedPath]
    || (Object.entries(sectionPaths).find(([, path]) => path === normalizedPath)?.[0] as NavSection | undefined);
  if (!section) return { section: 'dashboard', isNotFound: true };

  const settingsStartSection = normalizedPath === '/backup'
    ? 'data'
    : normalizedPath === '/communications' ? 'messages' : undefined;

  return { section, settingsStartSection };
};

export const isKnownAppPath = (pathname: string): boolean =>
  authPaths.has(pathname.replace(/\/+$/, '') || '/') || !getAppLocation(pathname).isNotFound;
