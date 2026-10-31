import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClientAppShell from '../ClientAppShell';
import { isKnownAppPath } from '../../src/utils/appRoutes';

export const metadata: Metadata = {
  title: 'XolveManager app',
  description: 'Private XolveManager application workspace.',
  robots: { index: false, follow: false },
};

export default async function AppRoutePage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  if (!isKnownAppPath(`/${segments.join('/')}`)) notFound();

  return <ClientAppShell />;
}
