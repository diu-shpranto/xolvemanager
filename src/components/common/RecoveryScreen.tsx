'use client';

import { useEffect, useState, type FC } from 'react';
import { ArrowLeft, Compass, House, RotateCcw, TriangleAlert } from 'lucide-react';

interface RecoveryScreenProps {
  variant: 'not-found' | 'error';
  onDashboard?: () => void;
  onRetry?: () => void;
  allowBack?: boolean;
}

export const RecoveryScreen: FC<RecoveryScreenProps> = ({
  variant,
  onDashboard,
  onRetry,
  allowBack = false,
}) => {
  const [canGoBack, setCanGoBack] = useState(false);
  const isNotFound = variant === 'not-found';

  useEffect(() => {
    setCanGoBack(allowBack && window.history.length > 1);
  }, [allowBack]);

  const goToDashboard = () => {
    if (onDashboard) onDashboard();
    else window.location.assign('/dashboard');
  };

  return (
    <div className="grid min-h-[min(76vh,48rem)] w-full place-items-center px-4 py-10 sm:px-6">
      <section
        role={isNotFound ? undefined : 'alert'}
        className="w-full max-w-xl rounded-2xl border border-violet-200/80 bg-white p-6 text-center shadow-sm dark:border-violet-900/70 dark:bg-[#15121f] sm:p-10"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
          {isNotFound ? <Compass className="h-6 w-6" aria-hidden="true" /> : <TriangleAlert className="h-6 w-6" aria-hidden="true" />}
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
          XolveManager
        </p>
        <p className="mt-2 text-sm font-semibold tabular-nums text-slate-400 dark:text-slate-500">
          {isNotFound ? '404' : 'Page error'}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
          {isNotFound ? 'We couldn’t find that page' : 'This page ran into a problem'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
          {isNotFound
            ? 'The address may be incorrect, or the page may have moved. Your saved business data has not been changed.'
            : 'You can try rendering this page again or return to the dashboard. Recovery will not clear or reset your saved business data.'}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={goToDashboard}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            <House className="h-4 w-4" aria-hidden="true" />
            Go to Dashboard
          </button>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          ) : canGoBack ? (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go Back
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
};
