/**
 * Server Supabase client (Next.js App Router, @supabase/ssr).
 *
 * For Server Components, Route Handlers and the Proxy (see proxy.ts).
 * Returns null when Supabase is not configured. Never create the client
 * with placeholder credentials — that would fail at request time.
 *
 * NOTE (Next.js 16): `cookies()` from next/headers is async.
 */
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

export const createSupabaseServerClient = async (): Promise<SupabaseClient | null> => {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll is called from Server Components where writing cookies is
          // not allowed; the Proxy refreshes the session instead.
        }
      },
    },
  });
};
