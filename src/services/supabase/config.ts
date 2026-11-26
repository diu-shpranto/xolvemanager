/**
 * Supabase configuration.
 *
 * The app works in two modes:
 * - Cloud mode: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   are set to real project values, and Supabase Auth + Postgres (RLS) are used.
 * - Offline mode: the env vars are absent (or still placeholders). The app
 *   keeps working exactly as before on localStorage, and shows an offline
 *   banner. Nothing in this module throws when the vars are missing.
 *
 * Env vars are read on every call (never cached at import time) so tests can
 * change process.env and so Next.js can inject them at runtime.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const PLACEHOLDER_MARKERS = ['YOUR-PROJECT-REF', 'YOUR_SUPABASE', 'YOUR-ANON-KEY', 'example.com', 'placeholder'];

const isUsableValue = (value: string | undefined): value is string => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lowered = trimmed.toLowerCase();
  return !PLACEHOLDER_MARKERS.some(marker => lowered.includes(marker.toLowerCase()));
};

/** Returns the configured Supabase project, or null when env vars are absent/placeholders. */
export const getSupabaseConfig = (): SupabaseConfig | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isUsableValue(url) || !isUsableValue(anonKey)) return null;
  if (!/^https:\/\//.test(url.trim())) return null;
  return { url: url.trim(), anonKey: anonKey.trim() };
};

/** True only when real Supabase credentials are configured. */
export const isSupabaseConfigured = (): boolean => getSupabaseConfig() !== null;

/**
 * Google OAuth is wired (see auth.ts) but stays disabled until the project
 * owner enables the Google provider in Supabase AND sets this flag.
 */
export const isGoogleOAuthEnabled = (): boolean =>
  isSupabaseConfigured() && process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED === 'true';

/** localStorage key marking that this browser is signed in with a cloud account. */
export const CLOUD_SESSION_KEY = 'xolvemanager.auth.cloud.v1';

/** localStorage key marking that the browser data was uploaded to the cloud. */
export const CLOUD_MIGRATED_KEY = 'xolvemanager.cloud-migrated.v1';

/** localStorage key marking that the user dismissed the cloud-upload offer. */
export const CLOUD_MIGRATION_DISMISSED_KEY = 'xolvemanager.cloud-migration-dismissed.v1';

/** localStorage key holding the last successful cloud download summary (JSON). */
export const CLOUD_LAST_DOWNLOAD_KEY = 'xolvemanager.cloud-last-download.v1';
