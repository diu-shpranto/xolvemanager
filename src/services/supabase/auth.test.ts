import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '@supabase/supabase-js';
import {
  getSupabaseSessionUser,
  hasCloudPasswordRecoverySession,
  isCloudPasswordRecoveryPending,
  requestCloudPasswordReset,
  setCloudPassword,
  verifyCloudPasswordResetCode,
  signOutFromSupabase,
  SupabaseAuthError,
} from './auth.ts';
import type { SupabasePasswordResetClient } from './auth.ts';

const fakeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'rina@example.test',
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Rina Akter' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

interface FakeCalls {
  reset: { email: string; options?: { redirectTo?: string } }[];
  verify: { email: string; token: string; type: string }[];
  update: { password: string }[];
}

const makeFakeClient = (options: {
  session?: unknown;
  user?: User | null;
  userError?: { message: string } | null;
  resetError?: { message: string } | null;
  verifyError?: { message: string } | null;
  verifySession?: unknown;
  verifyUser?: User | null;
  updateError?: { message: string } | null;
  updateUser?: User | null;
  fireRecoveryEvent?: boolean;
} = {}): { calls: FakeCalls; client: SupabasePasswordResetClient } => {
  const calls: FakeCalls = { reset: [], verify: [], update: [] };
  const client: SupabasePasswordResetClient = {
    auth: {
      resetPasswordForEmail: async (email, opts) => {
        calls.reset.push({ email, options: opts });
        return { data: {}, error: options.resetError ?? null };
      },
      verifyOtp: async (params) => {
        calls.verify.push({ email: params.email, token: params.token, type: params.type });
        return {
          data: {
            user: options.verifyUser === undefined ? fakeUser() : options.verifyUser,
            session: options.verifySession === undefined ? { access_token: 'token' } : options.verifySession,
          },
          error: options.verifyError ?? null,
        };
      },
      updateUser: async (attributes) => {
        calls.update.push(attributes);
        return {
          data: { user: options.updateUser === undefined ? fakeUser() : options.updateUser },
          error: options.updateError ?? null,
        };
      },
      getSession: async () => ({ data: { session: options.session ?? null } }),
      getUser: async () => ({ data: { user: options.user ?? null }, error: options.userError ?? null }),
      onAuthStateChange: (callback) => {
        if (options.fireRecoveryEvent) {
          callback('PASSWORD_RECOVERY', { user: fakeUser() });
        }
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
  return { calls, client };
};

test('requestCloudPasswordReset sends a normalized email and a /login redirect', async () => {
  const { calls, client } = makeFakeClient();
  await requestCloudPasswordReset('  Rina@Example.Test ', client);
  assert.equal(calls.reset.length, 1);
  assert.equal(calls.reset[0]?.email, 'rina@example.test');
  assert.ok(calls.reset[0]?.options?.redirectTo?.endsWith('/login'));
});

test('requestCloudPasswordReset resolves when the email has no account (no leak)', async () => {
  const { client } = makeFakeClient();
  await requestCloudPasswordReset('nobody@example.test', client);
});

test('requestCloudPasswordReset throws a coded error when Supabase rejects it', async () => {
  const { client } = makeFakeClient({ resetError: { message: 'Email rate limit exceeded' } });
  await assert.rejects(
    () => requestCloudPasswordReset('rina@example.test', client),
    (error: unknown) => error instanceof SupabaseAuthError && error.code === 'RESET_REQUEST_FAILED'
  );
});

test('setCloudPassword updates the password and returns the signed-in cloud user', async () => {
  const { calls, client } = makeFakeClient();
  const user = await setCloudPassword('NewPass123!@#', client);
  assert.deepEqual(calls.update, [{ password: 'NewPass123!@#' }]);
  assert.deepEqual(user, { uid: 'user-1', email: 'rina@example.test', name: 'Rina Akter', role: 'owner' });
});

test('setCloudPassword throws a coded error when the update fails', async () => {
  const { client } = makeFakeClient({ updateError: { message: 'New password should be different from the old password.' } });
  await assert.rejects(
    () => setCloudPassword('NewPass123!@#', client),
    (error: unknown) => error instanceof SupabaseAuthError && error.code === 'PASSWORD_UPDATE_FAILED'
  );
});

test('setCloudPassword throws when no user is returned', async () => {
  const { client } = makeFakeClient({ updateUser: null });
  await assert.rejects(
    () => setCloudPassword('NewPass123!@#', client),
    (error: unknown) => error instanceof SupabaseAuthError && error.code === 'PASSWORD_UPDATE_FAILED'
  );
});

test('verifyCloudPasswordResetCode verifies a recovery OTP and marks the recovery session', async () => {
  const { calls, client } = makeFakeClient();
  const user = await verifyCloudPasswordResetCode('  Rina@Example.Test ', ' 123456 ', client);
  assert.deepEqual(calls.verify, [{ email: 'rina@example.test', token: '123456', type: 'recovery' }]);
  assert.deepEqual(user, { uid: 'user-1', email: 'rina@example.test', name: 'Rina Akter', role: 'owner' });
  assert.equal(isCloudPasswordRecoveryPending(), true);
  await signOutFromSupabase();
  assert.equal(isCloudPasswordRecoveryPending(), false);
});

test('verifyCloudPasswordResetCode throws a coded error when the code is rejected', async () => {
  const { client } = makeFakeClient({ verifyError: { message: 'Token has expired or is invalid' } });
  await assert.rejects(
    () => verifyCloudPasswordResetCode('rina@example.test', '123456', client),
    (error: unknown) => error instanceof SupabaseAuthError && error.code === 'RESET_CODE_FAILED'
  );
});

test('verifyCloudPasswordResetCode throws when no recovery session is returned', async () => {
  const { client } = makeFakeClient({ verifySession: null });
  await assert.rejects(
    () => verifyCloudPasswordResetCode('rina@example.test', '123456', client),
    (error: unknown) => error instanceof SupabaseAuthError && error.code === 'RESET_CODE_FAILED'
  );
});

test('getSupabaseSessionUser returns the user for a normal session', async () => {
  const { client } = makeFakeClient({ user: fakeUser() });
  const user = await getSupabaseSessionUser(client);
  assert.deepEqual(user, { uid: 'user-1', email: 'rina@example.test', name: 'Rina Akter', role: 'owner' });
  assert.equal(isCloudPasswordRecoveryPending(), false);
});

test('getSupabaseSessionUser returns null for a recovery session and marks it pending', async () => {
  const { client } = makeFakeClient({ user: fakeUser(), fireRecoveryEvent: true });
  const user = await getSupabaseSessionUser(client);
  assert.equal(user, null);
  assert.equal(isCloudPasswordRecoveryPending(), true);
  await signOutFromSupabase();
  assert.equal(isCloudPasswordRecoveryPending(), false);
});

test('hasCloudPasswordRecoverySession needs a live session and a pending marker', async () => {
  const withSession = makeFakeClient({ session: { access_token: 'token' } });
  assert.equal(await hasCloudPasswordRecoverySession(withSession.client), false);

  const { client } = makeFakeClient({ user: fakeUser(), fireRecoveryEvent: true });
  assert.equal(await getSupabaseSessionUser(client), null);
  assert.equal(await hasCloudPasswordRecoverySession(withSession.client), true);

  const withoutSession = makeFakeClient({ session: null });
  assert.equal(await hasCloudPasswordRecoverySession(withoutSession.client), false);
  // A marker with no live session is stale and is cleared.
  assert.equal(isCloudPasswordRecoveryPending(), false);
});

test('setCloudPassword clears the pending recovery marker', async () => {
  const { client } = makeFakeClient({ user: fakeUser(), fireRecoveryEvent: true });
  assert.equal(await getSupabaseSessionUser(client), null);
  assert.equal(isCloudPasswordRecoveryPending(), true);
  const { client: resetClient } = makeFakeClient();
  await setCloudPassword('NewPass123!@#', resetClient);
  assert.equal(isCloudPasswordRecoveryPending(), false);
});

test('getSupabaseSessionUser returns null when Supabase is not configured', async () => {
  const user = await getSupabaseSessionUser();
  assert.equal(user, null);
});
