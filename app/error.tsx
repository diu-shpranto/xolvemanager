'use client';

import { useEffect } from 'react';
import { RecoveryScreen } from '../src/components/common/RecoveryScreen';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('Unexpected route rendering error.', error);
  }, [error]);

  return (
    <main>
      <RecoveryScreen variant="error" onRetry={retry} />
    </main>
  );
}
