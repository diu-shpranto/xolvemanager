export const DEFAULT_SITE_ORIGIN = 'https://xolvemanager.vercel.app';

export const INDEXABLE_PUBLIC_PATHS = [
  '/',
  '/legal/privacy',
  '/legal/data-backup',
] as const;

export const getSiteOrigin = (configuredOrigin?: string): string => {
  const value = configuredOrigin?.trim() || DEFAULT_SITE_ORIGIN;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an absolute site origin.');
  }

  const isLocalDevelopmentOrigin = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !isLocalDevelopmentOrigin)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTPS origin without a path, credentials, query, or fragment.');
  }
  return url.origin;
};

export const SITE_ORIGIN = getSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);

export const getCanonicalUrl = (path: string): string =>
  new URL(path, `${SITE_ORIGIN}/`).toString();
