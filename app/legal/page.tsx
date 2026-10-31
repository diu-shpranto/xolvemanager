import type { Metadata } from 'next';
import { LegalCenterPage } from './LegalExperience';

export const metadata: Metadata = {
  title: 'Legal & Trust Center',
  description: 'Read XolveManager policy drafts and verified information about privacy, local data, backups, and support.',
  alternates: { canonical: '/legal' },
  robots: { index: false, follow: false },
};

export default function LegalPage() {
  return <LegalCenterPage />;
}
