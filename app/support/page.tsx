import type { Metadata } from 'next';
import { SupportExperience } from '../../src/components/views/SupportExperience';

export const metadata: Metadata = {
  title: 'Contact & Support | XolveManager',
  description: 'Contact XolveManager support, review help resources, and find verified Local-First privacy and backup guidance.',
  alternates: { canonical: '/support' },
  robots: { index: false, follow: false },
};

export default function SupportPage() {
  return <SupportExperience />;
}
