/**
 * Supabase Auth — email/password (primary cloud path) + Google OAuth (wired,
 * disabled until configured).
 *
 * This module never touches src/services/localAuthService.ts. When Supabase
 * is not configured every function here fails with a clear error and the
 * caller falls back to the local auth flow.
 *
 * Cloud sign-in is tracked separately from the local session with the
 * CLOUD_SESSION_KEY flag so the app shell can tell a cloud user from a
 * local user without changing the LocalAuthUser type.
 */
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';
import {
  CLOUD_SESSION_KEY,
  getSupabaseConfig,
  isGoogleOAuthEnabled,
  isSupabaseConfigured,
} from './config';

export interface CloudAuthUser {
  uid: string;
  email: string;
  name: string;
  role: 'owner';
}

export class SupabaseAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.code = code;
  }
}

const requireClient = () => {
  const client = getSupabaseBrowserClient();
  if (!client || !getSupabaseConfig()) {
    throw new SupabaseAuthError(
      'SUPABASE_NOT_CONFIGURED',
      'Cloud sign-in is not set up yet. Use the account on this device instead.'
    );
  }
  return client;
};

const toCloudUser = (user: User): CloudAuthUser => ({
  uid: user.id,
  email: user.email ?? '',
  name: (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name)
    || (typeof user.user_metadata?.name === 'string' && user.user_metadata.name)
    || user.email?.split('@')[0]
    || 'Owner',
  role: 'owner',
});

const markCloudSession = (): void => {
  try {
    window.localStorage.setItem(CLOUD_SESSION_KEY, '1');
  } catch {
    // Cloud sign-in still works; only the cloud-vs-local marker is lost.
  }
};

export const clearCloudSessionFlag = (): void => {
  try {
    window.localStorage.removeItem(CLOUD_SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
};

export const isCloudSession = (): boolean => {
  try {
    return window.localStorage.getItem(CLOUD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

/** Email/password sign-up against Supabase Auth. Also signs the user in. */
export const signUpWithSupabase = async (
  name: string,
  email: string,
  password: string
): Promise<CloudAuthUser> => {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: name.trim() } },
  });
  if (error) throw new SupabaseAuthError('SIGNUP_FAILED', error.message);
  if (!data.user) throw new SupabaseAuthError('SIGNUP_FAILED', 'Cloud sign-up did not return an account.');
  markCloudSession();
  return toCloudUser(data.user);
};

/** Email/password sign-in against Supabase Auth. */
export const signInWithSupabase = async (
  email: string,
  password: string
): Promise<CloudAuthUser> => {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new SupabaseAuthError('INVALID_CREDENTIALS', error.message);
  if (!data.user) throw new SupabaseAuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  markCloudSession();
  return toCloudUser(data.user);
};

/** Sign out of the Supabase session (browser cookies + flag). */
export const signOutFromSupabase = async (): Promise<void> => {
  const client = getSupabaseBrowserClient();
  clearCloudSessionFlag();
  if (client) await client.auth.signOut();
};

/**
 * Google OAuth. Wired through Supabase, but disabled until the project owner
 * enables the Google provider in the Supabase dashboard AND sets
 * NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED=true. Until then this throws a clear
 * error instead of opening a broken OAuth flow.
 */
export const signInWithGoogle = async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new SupabaseAuthError(
      'SUPABASE_NOT_CONFIGURED',
      'Cloud sign-in is not set up yet. Use the account on this device instead.'
    );
  }
  if (!isGoogleOAuthEnabled()) {
    throw new SupabaseAuthError(
      'GOOGLE_NOT_CONFIGURED',
      'Google sign-in is not configured yet. Sign in with email and password instead.'
    );
  }
  const client = requireClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) throw new SupabaseAuthError('GOOGLE_FAILED', error.message);
};

/** Current Supabase session user, or null (offline mode, signed out, expired). */
export const getSupabaseSessionUser = async (): Promise<CloudAuthUser | null> => {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return toCloudUser(data.user);
};
