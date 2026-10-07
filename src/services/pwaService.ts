export type PwaInstallStatus = 'installed' | 'installable' | 'not-available';

export interface PwaState {
  isOnline: boolean;
  installStatus: PwaInstallStatus;
  installDismissed: boolean;
  updateAvailable: boolean;
  updatePending: boolean;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALL_DISMISSED_KEY = 'xolve-manager-install-dismissed-v1';
const listeners = new Set<() => void>();
const dirtyForms = new Set<HTMLFormElement>();
let installPrompt: InstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
let registration: ServiceWorkerRegistration | null = null;
let registrationStarted = false;
let updatePoll: number | undefined;
let reloadAfterControllerChange = false;
let updateCheckTimer: number | undefined;
let state: PwaState = {
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  installStatus: 'not-available',
  installDismissed: false,
  updateAvailable: false,
  updatePending: false,
};

const isStandalone = (): boolean =>
  (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches)
  || (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true);

const publish = (updates: Partial<PwaState>): void => {
  state = { ...state, ...updates };
  listeners.forEach(listener => listener());
};

export const getPwaState = (): PwaState => state;
export const subscribeToPwaState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isPWAInstalled = (): boolean => isStandalone();

const isSafeToActivateUpdate = (): boolean => {
  for (const form of dirtyForms) {
    if (!form.isConnected) dirtyForms.delete(form);
  }
  if (dirtyForms.size > 0) return false;
  if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return false;
  const active = document.activeElement;
  return !(active instanceof HTMLElement && (
    active.isContentEditable
    || active.matches('input, textarea, select')
  ));
};

const clearUpdateTimer = (): void => {
  if (updateCheckTimer !== undefined) window.clearTimeout(updateCheckTimer);
  updateCheckTimer = undefined;
};

const activateWaitingWorkerWhenSafe = (): void => {
  if (!state.updatePending || !waitingWorker) return;
  clearUpdateTimer();
  if (!isSafeToActivateUpdate()) {
    updateCheckTimer = window.setTimeout(activateWaitingWorkerWhenSafe, 1000);
    return;
  }
  reloadAfterControllerChange = true;
  waitingWorker.postMessage('SKIP_WAITING');
};

const setWaitingWorker = (worker: ServiceWorker | null): void => {
  waitingWorker = worker;
  publish({ updateAvailable: Boolean(worker) });
  if (worker) activateWaitingWorkerWhenSafe();
};

const loadInstallDismissal = (): boolean => {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
  } catch (error) {
    console.error('Could not read PWA install dismissal preference.', error);
    return false;
  }
};

const clearDevelopmentServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations
    .filter(item => new URL(item.active?.scriptURL || item.installing?.scriptURL || item.waiting?.scriptURL || '/', location.href).pathname === '/sw.js')
    .map(item => item.unregister()));
};

const bindSafeUpdateEvents = (): void => {
  document.addEventListener('input', event => {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const form = target.closest('form');
      if (form) dirtyForms.add(form);
    }
  }, true);
  document.addEventListener('change', event => {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const form = target.closest('form');
      if (form) dirtyForms.add(form);
    }
  }, true);
  document.addEventListener('submit', event => {
    if (event.target instanceof HTMLFormElement) dirtyForms.delete(event.target);
    if (state.updatePending) {
      window.setTimeout(activateWaitingWorkerWhenSafe, 1500);
    }
  }, true);
  document.addEventListener('reset', event => {
    if (event.target instanceof HTMLFormElement) dirtyForms.delete(event.target);
    if (state.updatePending) window.setTimeout(activateWaitingWorkerWhenSafe, 0);
  }, true);
  document.addEventListener('focusout', () => {
    if (state.updatePending) window.setTimeout(activateWaitingWorkerWhenSafe, 0);
  }, true);
};

export const registerPwa = (): void => {
  if (registrationStarted || typeof window === 'undefined') return;
  registrationStarted = true;
  publish({
    isOnline: navigator.onLine,
    installStatus: isStandalone() ? 'installed' : 'not-available',
    installDismissed: loadInstallDismissal(),
  });
  bindSafeUpdateEvents();
  window.addEventListener('online', () => publish({ isOnline: true }));
  window.addEventListener('offline', () => publish({ isOnline: false }));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    publish({
      installStatus: isStandalone() ? 'installed' : 'installable',
      installDismissed: loadInstallDismissal(),
    });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    publish({ installStatus: 'installed', installDismissed: true });
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
    if (event.matches) publish({ installStatus: 'installed' });
    else if (!installPrompt) publish({ installStatus: 'not-available' });
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadAfterControllerChange) return;
      reloadAfterControllerChange = false;
      window.location.reload();
    });
  }
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) {
    if (!import.meta.env.PROD) {
      void clearDevelopmentServiceWorker().catch(error => console.error('Could not disable the XolveManager development service worker.', error));
    }
    return;
  }

  void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(async registered => {
    registration = registered;
    setWaitingWorker(registered.waiting);
    registered.addEventListener('updatefound', () => {
      const installing = registered.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(registered.waiting || installing);
        }
      });
    });
    await registered.update();
    if (updatePoll === undefined) {
      updatePoll = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void registration?.update().catch(error => console.error('Could not check for a XolveManager app update.', error));
        }
      }, 60 * 60 * 1000);
    }
  }).catch(error => {
    console.error('XolveManager offline application support could not be initialized.', error);
  });
};

export const installPwa = async (): Promise<void> => {
  if (!installPrompt || state.installStatus !== 'installable') return;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === 'accepted') {
    publish({ installStatus: isStandalone() ? 'installed' : 'not-available' });
  } else {
    publish({ installStatus: 'not-available' });
  }
};

export const dismissPwaInstallPrompt = (): void => {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
  } catch (error) {
    console.error('Could not save PWA install dismissal preference.', error);
  }
  publish({ installDismissed: true });
};

export const requestPwaUpdate = (): void => {
  if (!waitingWorker) return;
  publish({ updatePending: true });
  activateWaitingWorkerWhenSafe();
};
