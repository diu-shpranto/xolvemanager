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
import {
  LOCAL_WORKSPACE_ID,
  setActiveWorkspaceId,
} from '../localStorageStore';

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

/**
 * Password-recovery marker. Set only when the Supabase client emits the
 * PASSWORD_RECOVERY event (a reset link was opened), and mirrored
 * to sessionStorage so it survives a reload of the same tab. It is advisory
 * only: it never authorizes anything, it only tells AuthScreen to show the
 * set-new-password form instead of the sign-in form.
 *
 * The in-memory flag is the part tests and non-browser runtimes use;
 * sessionStorage is the part that survives reloads. Both are always set and
 * cleared together.
 */
const CLOUD_PASSWORD_RECOVERY_KEY = 'xolvemanager.cloud-password-recovery.v1';
let cloudPasswordRecoveryPending = false;

const markCloudPasswordRecoveryPending = (): void => {
  cloudPasswordRecoveryPending = true;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(CLOUD_PASSWORD_RECOVERY_KEY, '1');
  } catch {
    // The in-memory flag still carries the marker for this page load.
  }
};

const clearCloudPasswordRecoveryPending = (): void => {
  cloudPasswordRecoveryPending = false;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(CLOUD_PASSWORD_RECOVERY_KEY);
  } catch {
    // The in-memory flag is already cleared.
  }
};

/** True when this tab arrived from a cloud password-reset link and the new password has not been set yet. */
export const isCloudPasswordRecoveryPending = (): boolean => {
  if (cloudPasswordRecoveryPending) return true;
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(CLOUD_PASSWORD_RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
};

export const isCloudSession = (): boolean => {
  try {
    return window.localStorage.getItem(CLOUD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

export interface CloudSignUpResult {
  user: CloudAuthUser;
  /** True when email confirmation is on: no session was created and the
   * account must open the confirmation link before it can sign in. */
  confirmationPending: boolean;
}

/** Email/password sign-up against Supabase Auth. The account is created
 * but the user is NOT signed in: any session the sign-up returns is
 * signed out immediately, so the new account must sign in with its
 * credentials before it can enter the workspace. When email confirmation
 * is on, no session is created at all — the confirmation link returns to
 * /login, where the shell signs the confirmed account in. */
export const signUpWithSupabase = async (
  name: string,
  email: string,
  password: string
): Promise<CloudSignUpResult> => {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: name.trim() },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw new SupabaseAuthError('SIGNUP_FAILED', error.message);
  if (!data.user) throw new SupabaseAuthError('SIGNUP_FAILED', 'Cloud sign-up did not return an account.');
  // Supabase does not return an error when the email is already
  // registered (to avoid leaking which emails have accounts): it returns
  // a user with an empty identities list instead. Without this check the
  // caller would show a "check your email" confirmation notice for an
  // account that already exists — and the user would be stuck waiting
  // for a confirmation email that never comes.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new SupabaseAuthError('EMAIL_ALREADY_REGISTERED', 'User already registered');
  }
  clearCloudPasswordRecoveryPending();
  // Email confirmation is off, so sign-up returns an active session.
  // Sign it out right away and clear the cloud-session markers: the
  // caller sends the user to the sign-in page instead of the workspace.
  try {
    if (data.session) await client.auth.signOut();
  } catch {
    // Best effort: signOut clears the local session even when its server
    // call fails, and the markers below are cleared regardless.
  }
  clearCloudSessionFlag();
  setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
  return { user: toCloudUser(data.user), confirmationPending: !data.session };
};

/**
 * Passwordless sign-in — email the user a sign-in link. The link returns
 * to /dashboard; the browser client reads its token from the link on load
 * and the shell signs the user in, exactly like a Google OAuth return.
 * The link works in any browser — the token travels in the link itself.
 *
 * `shouldCreateUser: false`: a link is only sent to an existing account,
 * so the login page cannot be used to create accounts without a name or
 * terms. An unknown email gets EMAIL_LINK_NO_ACCOUNT instead of a link.
 */
export const signInWithEmailLink = async (email: string): Promise<void> => {
  const client = requireClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes('signups not allowed')) {
      throw new SupabaseAuthError('EMAIL_LINK_NO_ACCOUNT', 'No account uses this email yet. Sign up first.');
    }
    throw new SupabaseAuthError('EMAIL_LINK_FAILED', error.message);
  }
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
  clearCloudPasswordRecoveryPending();
  markCloudSession();
  setActiveWorkspaceId(data.user.id);
  return toCloudUser(data.user);
};

/** Sign out of the Supabase session (browser cookies + flag). */
export const signOutFromSupabase = async (): Promise<void> => {
  const client = getSupabaseBrowserClient();
  clearCloudSessionFlag();
  clearCloudPasswordRecoveryPending();
  setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
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

/** Minimal auth-client surface the password-reset functions need (real client or a test fake). */
export interface SupabasePasswordResetClient {
  auth: {
    resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{ data: unknown; error: { message: string } | null }>;
    verifyOtp: (params: { email: string; token: string; type: 'recovery' }) => Promise<{ data: { user: User | null; session: unknown }; error: { message: string } | null }>;
    updateUser: (attributes: { password: string }) => Promise<{ data: { user: User | null }; error: { message: string } | null }>;
    getSession: () => Promise<{ data: { session: unknown } }>;
    getUser: () => Promise<{ data: { user: User | null }; error: { message: string } | null }>;
    onAuthStateChange: SupabaseAuthStateClient['auth']['onAuthStateChange'];
  };
}

/**
 * Where a password-reset link returns to. Always `/login` — the route is
 * already allowed in the Supabase redirect list. The localhost fallback
 * only applies outside a browser (tests, SSR); the real call sites are
 * browser-only.
 */
const getPasswordResetRedirect = (): string =>
  typeof window === 'undefined' ? 'http://localhost:3000/login' : `${window.location.origin}/login`;

/**
 * Cloud password reset, step 1 — email the user a reset code (and link).
 *
 * Supabase sends the reset email back to `/login` (already an allowed
 * redirect). The email carries a code ({{ .Token }} in the
 * "Reset password" template) and the reset link: the code is verified in
 * the app with `verifyCloudPasswordResetCode`, while the link still works
 * on its own in any browser — the Gmail app, another browser, another
 * device — and opens a recovery session the same way.
 *
 * Supabase answers the same way whether or not the email has an account,
 * so callers must not reveal the distinction either.
 */
export const requestCloudPasswordReset = async (
  email: string,
  clientOverride?: SupabasePasswordResetClient | null
): Promise<void> => {
  const client = clientOverride ?? requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: getPasswordResetRedirect(),
  });
  if (error) throw new SupabaseAuthError('RESET_REQUEST_FAILED', error.message);
};

/**
 * Cloud password reset, step 2 — verify the code from the reset
 * email. Verifying the code opens a recovery session: the client emits
 * PASSWORD_RECOVERY for a recovery verification, so this tab is marked
 * as a recovery session — a refresh still shows the new-password form
 * instead of signing straight in. Returns the account the code belongs
 * to; the caller then collects the new password with setCloudPassword.
 */
export const verifyCloudPasswordResetCode = async (
  email: string,
  code: string,
  clientOverride?: SupabasePasswordResetClient | null
): Promise<CloudAuthUser> => {
  const client = clientOverride ?? requireClient();
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  });
  if (error) throw new SupabaseAuthError('RESET_CODE_FAILED', error.message);
  if (!data.session || !data.user) {
    throw new SupabaseAuthError(
      'RESET_CODE_FAILED',
      'That code did not work. Request a new code and try again.'
    );
  }
  markCloudPasswordRecoveryPending();
  return toCloudUser(data.user);
};

/**
 * Cloud password reset, step 3 — set the new password on the recovery
 * session from the email link or code. Only valid while that recovery session is
 * active. On success the session becomes an ordinary signed-in session:
 * the recovery marker is cleared, the cloud session is marked, and the
 * account workspace is activated.
 */
export const setCloudPassword = async (
  newPassword: string,
  clientOverride?: SupabasePasswordResetClient | null
): Promise<CloudAuthUser> => {
  const client = clientOverride ?? requireClient();
  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new SupabaseAuthError('PASSWORD_UPDATE_FAILED', error.message);
  if (!data.user) {
    throw new SupabaseAuthError(
      'PASSWORD_UPDATE_FAILED',
      'The password could not be changed. Request a new reset link and try again.'
    );
  }
  clearCloudPasswordRecoveryPending();
  markCloudSession();
  setActiveWorkspaceId(data.user.id);
  return toCloudUser(data.user);
};

/**
 * True when the current browser session came from a cloud password-reset
 * link. The recovery marker is the signal; the live session is the proof
 * a session still exists. A marker with no live session is stale (link
 * expired, already used, or the session was replaced) and is cleared.
 */
export const hasCloudPasswordRecoverySession = async (
  clientOverride?: SupabasePasswordResetClient | null
): Promise<boolean> => {
  const client = clientOverride ?? getSupabaseBrowserClient();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  if (!data.session) {
    clearCloudPasswordRecoveryPending();
    return false;
  }
  return isCloudPasswordRecoveryPending();
};

/** Current Supabase session user, or null (offline mode, signed out, expired). */
export const getSupabaseSessionUser = async (
  clientOverride?: SupabasePasswordResetClient | null
): Promise<CloudAuthUser | null> => {
  const client = clientOverride ?? getSupabaseBrowserClient();
  if (!client) return null;
  // A password-reset link lands here with a recovery session. That session
  // must NOT sign the user in — the app shell would send them straight to
  // the dashboard with no way to set a new password. Catch the
  // PASSWORD_RECOVERY event, which the client emits while processing the
  // link: the listener is registered before getUser() awaits
  // initialization, and the event is delivered before getUser() returns.
  const unsubscribe = subscribeToSupabaseAuthChanges((event) => {
    if (event === 'PASSWORD_RECOVERY') markCloudPasswordRecoveryPending();
  }, clientOverride ?? undefined);
  const { data, error } = await client.auth.getUser();
  unsubscribe?.();
  if (error || !data.user) return null;
  // Recovery session: not a sign-in. AuthScreen shows the set-new-password
  // form instead (see hasCloudPasswordRecoverySession).
  if (isCloudPasswordRecoveryPending()) return null;
  // A valid session IS a cloud session — including Google OAuth, whose
  // redirect returns to a fresh page load where no sign-in function ran.
  // Without this, Google users were never marked as cloud users.
  markCloudSession();
  return toCloudUser(data.user);
};

/**
 * Subscribes to Supabase auth state changes (sign-in, sign-out, account
 * switch, token refresh, session expiry). The listener also fires once
 * with INITIAL_SESSION when a session already exists. Returns an
 * unsubscribe function, or null when Supabase is not configured.
 *
 * `clientOverride` exists only so tests can pass a fake auth client; the
 * real browser client is used otherwise.
 */
export interface SupabaseAuthStateClient {
  auth: {
    onAuthStateChange: (
      callback: (event: string, session: { user: User } | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
}

export const subscribeToSupabaseAuthChanges = (
  listener: (event: string, user: CloudAuthUser | null) => void,
  clientOverride?: SupabaseAuthStateClient | null
): (() => void) | null => {
  const client = clientOverride ?? getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    listener(event, session?.user ? toCloudUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
};
