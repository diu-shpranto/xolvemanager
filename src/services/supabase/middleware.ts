/**
 * Supabase session refresh for the Next.js Proxy (Next.js 16 renamed
 * Middleware to Proxy — same behaviour, see node_modules/next/dist/docs
 * 01-app/01-getting-started/16-proxy.md).
 *
 * Runs once per navigation: refreshes an expired session cookie before the
 * page renders, so the browser and server see the same session. When
 * Supabase is not configured this is a no-op pass-through — the app keeps
 * working in offline (localStorage) mode.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';

export const updateSupabaseSession = async (request: NextRequest): Promise<NextResponse> => {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes the session when expired; do NOT use the returned user for
  // authorization decisions here (see Next.js proxy docs: optimistic only).
  await supabase.auth.getUser();
  return response;
};
