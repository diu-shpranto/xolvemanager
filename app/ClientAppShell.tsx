'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import type { LocalAuthUser } from '../src/services/localAuthService';
import {
  AUTH_ACCOUNTS_KEY,
  AUTH_LOGOUT_SIGNAL_KEY,
  AUTH_STATE_EVENT,
  hasLocalAccount,
  restoreLocalSession,
  signOutLocally,
} from '../src/services/localAuthService';

const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center text-sm text-slate-500" role="status">
      Loading XolveManager…
    </div>
  ),
});

type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'error';
type AuthMode = 'login' | 'signup' | 'forgot-password';

const getAuthMode = (pathname: string): AuthMode | null => {
  if (pathname === '/login') return 'login';
  if (pathname === '/signup') return 'signup';
  if (pathname === '/forgot-password') return 'forgot-password';
  return null;
};

const navigateTo = (path: string, replace = false) => {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export default function ClientAppShell() {
  const [pathname, setPathname] = useState('/');
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [hasAccount, setHasAccount] = useState(false);
  const [user, setUser] = useState<LocalAuthUser | null>(null);
  const [authError, setAuthError] = useState('');
  const returnPath = useRef('/dashboard');

  const refreshSession = useCallback((currentPath: string) => {
    try {
      const restoredUser = restoreLocalSession();
      const accountExists = hasLocalAccount();
      setHasAccount(accountExists);
      setUser(restoredUser);
      setStatus(restoredUser ? 'authenticated' : 'anonymous');
      setAuthError('');
      if (restoredUser && getAuthMode(currentPath)) {
        navigateTo('/dashboard', true);
        setPathname('/dashboard');
      } else if (!restoredUser && !getAuthMode(currentPath)) {
        returnPath.current = currentPath === '/' ? '/dashboard' : currentPath;
        navigateTo('/login', true);
        setPathname('/login');
      }
    } catch (error) {
      setUser(null);
      setStatus('error');
      setAuthError(error instanceof Error ? error.message : 'Local authentication could not be initialized.');
      if (!getAuthMode(currentPath)) {
        returnPath.current = currentPath === '/' ? '/dashboard' : currentPath;
        navigateTo('/login', true);
        setPathname('/login');
      }
    }
  }, []);

  useEffect(() => {
    const currentPath = window.location.pathname;
    setPathname(currentPath);
    refreshSession(currentPath);

    const handlePopState = () => {
      const nextPath = window.location.pathname;
      setPathname(nextPath);
      if (status === 'authenticated' && getAuthMode(nextPath)) {
        navigateTo('/dashboard', true);
        setPathname('/dashboard');
      } else if ((status === 'anonymous' || status === 'error') && !getAuthMode(nextPath)) {
        returnPath.current = nextPath === '/' ? '/dashboard' : nextPath;
        navigateTo('/login', true);
        setPathname('/login');
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_LOGOUT_SIGNAL_KEY) {
        try {
          signOutLocally(false);
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : 'This local session could not be fully cleared.');
        }
        refreshSession(window.location.pathname);
      } else if (event.key === AUTH_ACCOUNTS_KEY) {
        refreshSession(window.location.pathname);
      }
    };
    const handleAuthState = () => refreshSession(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUTH_STATE_EVENT, handleAuthState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUTH_STATE_EVENT, handleAuthState);
    };
  }, [refreshSession, status]);

  const handleAuthenticated = (authenticatedUser: LocalAuthUser) => {
    setHasAccount(true);
    setUser(authenticatedUser);
    setStatus('authenticated');
    setAuthError('');
    const destination = getAuthMode(returnPath.current) ? '/dashboard' : returnPath.current;
    navigateTo(destination, true);
    setPathname(destination);
  };

  const handleLogout = () => {
    let logoutError = '';
    try {
      signOutLocally();
    } catch (error) {
      logoutError = error instanceof Error ? error.message : 'The local session could not be fully cleared.';
    } finally {
      setUser(null);
      setStatus('anonymous');
      setAuthError(logoutError);
      navigateTo('/login', true);
      setPathname('/login');
    }
  };

  if (status === 'checking') {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500" role="status">Loading XolveManager…</div>;
  }

  if (status === 'authenticated' && user) {
    return <App currentUser={user} onLogout={handleLogout} />;
  }

  const mode = getAuthMode(pathname) || 'login';
  return (
    <AuthScreen
      mode={mode}
      hasAccount={hasAccount}
      initialError={authError}
      onAuthenticated={handleAuthenticated}
      onNavigate={path => {
        setAuthError('');
        navigateTo(path);
        setPathname(path);
      }}
    />
  );
}
