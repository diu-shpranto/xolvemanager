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
  if (!policy) return { title: 'Policy not found', robots: { index: false, follow: false } };

  const isIndexablePolicy = ['privacy', 'data-backup'].includes(policy.slug);
  return {
    title: policy.title,
    description: policy.description,
    alternates: { canonical: `/legal/${policy.slug}` },
    robots: { index: isIndexablePolicy, follow: true },
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
