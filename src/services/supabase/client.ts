/**
 * Browser Supabase client (Next.js App Router, @supabase/ssr).
 *
 * Returns null when Supabase is not configured — callers must fall back to
 * the local (localStorage) flow instead of crashing.
 *
 * Email links use the implicit flow (`flowType: 'implicit'`), NOT PKCE:
 * a PKCE link only works in the browser that requested it (the code
 * verifier lives in that browser's storage), so a confirmation or reset
 * link opened from Gmail — the Gmail app's browser, another browser, or
 * another device — failed with "link did not work". With implicit flow
 * the token travels in the link itself, so the link works in any browser
 * and signs the user in (or shows the reset form) on the spot. Google
 * OAuth and magic links share this client, so they follow the same flow.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

let browserClient: SupabaseClient | null = null;

export const getSupabaseBrowserClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.anonKey, {
      auth: { flowType: 'implicit' },
    });
  }
  return browserClient;
};

/** Test-only helper: drop the cached client so a fresh config is picked up. */
export const resetSupabaseBrowserClientForTests = (): void => {
  browserClient = null;
};
