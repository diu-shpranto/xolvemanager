'use client';

import { useEffect } from 'react';
import { RecoveryScreen } from '../src/components/common/RecoveryScreen';
import './globals.css';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('Unexpected root rendering error.', error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 antialiased dark:bg-[#0B0B1B] dark:text-slate-100">
        <main>
          <RecoveryScreen variant="error" onRetry={retry} />
        </main>
      </body>
    </html>
  );
}
