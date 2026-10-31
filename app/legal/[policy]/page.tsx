import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLegalPolicy, LEGAL_POLICY_UPDATED_AT, legalPolicies } from '../../../src/config/legalPolicies';
import { LegalPolicyPage } from '../LegalExperience';

export function generateStaticParams() {
  return legalPolicies.map(({ slug }) => ({ policy: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>;
}): Promise<Metadata> {
  const { policy: slug } = await params;
  const policy = getLegalPolicy(slug);
  if (!policy) return { title: 'Policy not found | XolveManager', robots: { index: false, follow: false } };

  return {
    title: `${policy.title} | XolveManager`,
    description: policy.description,
    alternates: { canonical: `/legal/${policy.slug}` },
    robots: { index: false, follow: false },
    other: { 'last-updated': LEGAL_POLICY_UPDATED_AT },
  };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  if (!getLegalPolicy(policy)) notFound();
  return <LegalPolicyPage slug={policy} />;
}
