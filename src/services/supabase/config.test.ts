import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupabaseConfig, isGoogleOAuthEnabled, isSupabaseConfigured } from './config.ts';

const saveEnv = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  google: process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED,
});

const restoreEnv = (saved: ReturnType<typeof saveEnv>) => {
  if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
  if (saved.anonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anonKey;
  if (saved.google === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED;
  else process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED = saved.google;
};

test('missing env vars mean offline mode', () => {
  const saved = saveEnv();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED;
  try {
    assert.equal(getSupabaseConfig(), null);
    assert.equal(isSupabaseConfigured(), false);
    assert.equal(isGoogleOAuthEnabled(), false);
  } finally {
    restoreEnv(saved);
  }
});

test('placeholder values are not treated as configured', () => {
  const saved = saveEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
  try {
    assert.equal(getSupabaseConfig(), null);
    assert.equal(isSupabaseConfigured(), false);
  } finally {
    restoreEnv(saved);
  }
});

test('a non-https URL is not treated as configured', () => {
  const saved = saveEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://not-a-supabase-url.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-real-looking-key';
  try {
    assert.equal(getSupabaseConfig(), null);
  } finally {
    restoreEnv(saved);
  }
});

test('real-looking values configure Supabase, Google stays off by default', () => {
  const saved = saveEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
  delete process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED;
  try {
    assert.deepEqual(getSupabaseConfig(), {
      url: 'https://abcdefghijklmnopqrst.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    });
    assert.equal(isSupabaseConfigured(), true);
    assert.equal(isGoogleOAuthEnabled(), false);
    process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED = 'true';
    assert.equal(isGoogleOAuthEnabled(), true);
  } finally {
    restoreEnv(saved);
  }
});
