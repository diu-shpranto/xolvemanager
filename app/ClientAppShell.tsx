'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { productBrand } from '../src/config/brand';
import type { LocalAuthUser } from '../src/services/localAuthService';
import { getSupabaseSessionUser, isCloudSession, signOutFromSupabase } from '../src/services/supabase/auth';
import { isSupabaseConfigured } from '../src/services/supabase/config';
import { LOCAL_WORKSPACE_ID, setActiveWorkspaceId } from '../src/services/localStorageStore';
import {
  AUTH_ACCOUNTS_KEY,
  AUTH_LOGOUT_SIGNAL_KEY,
  AUTH_STATE_EVENT,
  hasLocalAccount,
  restoreLocalSession,
  signOutLocally,
} from '../src/services/localAuthService';

const AppLaunchScreen = () => (
  <div
    className="app-launch-screen"
    style={{ backgroundColor: productBrand.launchColor }}
    role="status"
    aria-live="polite"
    aria-label="Loading XolveManager"
  >
    <div className="app-launch-content">
      <Image
        src={productBrand.iconUrl}
        alt=""
        width={96}
        height={96}
        priority
        className="app-launch-icon"
      />
      <span className="app-launch-label">Loading XolveManager…</span>
    </div>
  </div>
);

const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => <AppLaunchScreen />,
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

  const refreshSession = useCallback(async (currentPath: string) => {
    // Cloud first when configured: a Supabase session signs the user in
    // without touching the local account. Falls through to local auth when
    // there is no cloud session (or Supabase is not configured).
    if (isSupabaseConfigured()) {
      try {
        const cloudUser = await getSupabaseSessionUser();
        if (cloudUser) {
          // The workspace is the cloud account's own from here on; the app
          // shell resolves this before the workspace mounts, so its first
          // read already loads this account's data.
          setActiveWorkspaceId(cloudUser.uid);
          setHasAccount(true);
          setUser(cloudUser);
          setStatus('authenticated');
          setAuthError('');
          if (getAuthMode(currentPath)) {
            navigateTo('/dashboard', true);
            setPathname('/dashboard');
          }
          return;
        }
      } catch (error) {
        console.error('Cloud session could not be verified; using the local session instead.', error);
      }
    }
    try {
      const restoredUser = restoreLocalSession();
      const accountExists = hasLocalAccount();
      setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
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
      console.error('Local authentication could not be initialized.', error);
      setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
      setUser(null);
      setStatus('error');
      setAuthError('XolveManager could not verify this local session. Your business records were not cleared. Check browser storage availability and try again.');
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
          console.error('Local session could not be fully cleared.', error);
          setAuthError('This local session could not be fully cleared. Your business records were not changed.');
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
    // Cloud sign-ins use the account's workspace; local sign-ins use the
    // shared local workspace. Set before the app mounts so its first
    // read already loads the right data.
    setActiveWorkspaceId(
      isCloudSession() && authenticatedUser.uid ? authenticatedUser.uid : LOCAL_WORKSPACE_ID
    );
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
      // Clears the cloud session (flag synchronously, cookies async) when
      // one exists; harmless when the user signed in locally.
      void signOutFromSupabase().catch(error => {
        console.error('Cloud sign-out did not complete.', error);
      });
      signOutLocally();
      // Back to the shared local workspace (signOutFromSupabase also
      // resets it; this covers the local-only path too).
      setActiveWorkspaceId(LOCAL_WORKSPACE_ID);
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
    return <AppLaunchScreen />;
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
