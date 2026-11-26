/**
 * Browser Supabase client (Next.js App Router, @supabase/ssr).
 *
 * Returns null when Supabase is not configured — callers must fall back to
 * the local (localStorage) flow instead of crashing.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

let browserClient: SupabaseClient | null = null;

export const getSupabaseBrowserClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.anonKey);
  }
  return browserClient;
};

/** Test-only helper: drop the cached client so a fresh config is picked up. */
export const resetSupabaseBrowserClientForTests = (): void => {
  browserClient = null;
};
