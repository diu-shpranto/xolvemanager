import type { Metadata } from 'next';
import { RecoveryScreen } from '../src/components/common/RecoveryScreen';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main>
      <RecoveryScreen variant="not-found" allowBack />
    </main>
  );
}
