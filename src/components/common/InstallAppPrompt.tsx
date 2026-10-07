import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaState } from '../../hooks/usePwaState';
import { dismissPwaInstallPrompt, installPwa } from '../../services/pwaService';
import { productBrand } from '../../config/brand';

const installStatusLabel = {
  installed: 'Installed',
  installable: 'Installable',
  'not-available': 'Not Available',
} as const;

export const InstallAppPrompt: React.FC = () => {
  const { installStatus, installDismissed } = usePwaState();
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await installPwa();
    } catch (installError) {
      console.error('XolveManager installation could not be started.', installError);
      setError(installError instanceof Error ? installError.message : 'The install prompt could not be opened.');
    } finally {
      setInstalling(false);
    }
  };

  return <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="App installation">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">App Installation</h3>
        <p className="mt-1 text-xs text-slate-500">Install XolveManager for a standalone app window. Business data remains stored locally on this device.</p>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Installation status: <strong>{installStatusLabel[installStatus]}</strong></p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">App version: <strong>{productBrand.version}</strong></p>
      </div>
      {installStatus === 'installable' && <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => void handleInstall()} disabled={installing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          <Download className="h-4 w-4" />{installing ? 'Opening…' : 'Install XolveManager'}
        </button>
        {!installDismissed && <button type="button" onClick={dismissPwaInstallPrompt} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600">
          <X className="h-4 w-4" />Not now
        </button>}
      </div>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
  </section>;
};
