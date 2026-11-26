'use client';

import { useEffect, useState } from 'react';
import { AuthScreen } from '../auth/AuthScreen';
import { hasLocalAccount } from '../../services/localAuthService';

type HomepageAuthMode = 'login' | 'signup' | 'forgot-password';

/**
 * The sign-in / sign-up card on the introduction page (hero, right column).
 * The same AuthScreen as /login and /signup, embedded: the mode switches in
 * place (sign up <-> sign in) instead of navigating away, and a completed
 * sign-in goes to the dashboard (a full load, so the app shell picks up
 * the fresh session — cloud or local — and renders the workspace).
 */
export function HomepageAuthCard() {
  const [mode, setMode] = useState<HomepageAuthMode>('signup');
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    setHasAccount(hasLocalAccount());
  }, []);

  return (
    <div id="auth-card">
      <AuthScreen
        embedded
        mode={mode}
        hasAccount={hasAccount}
        onAuthenticated={() => {
          window.location.href = '/dashboard';
        }}
        onNavigate={path => {
          if (path === '/login') setMode('login');
          else if (path === '/signup') setMode('signup');
          else if (path === '/forgot-password') setMode('forgot-password');
          else window.location.href = path;
        }}
      />
    </div>
  );
}
