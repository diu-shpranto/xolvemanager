/**
 * Next.js 16 Proxy (formerly Middleware): refreshes the Supabase session
 * cookie once per navigation. No-op when Supabase is not configured.
 */
import type { NextRequest } from 'next/server';
import { updateSupabaseSession } from './src/services/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
