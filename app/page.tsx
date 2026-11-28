import type { Metadata } from 'next';
import { HomepageContent } from '../src/components/marketing/HomepageContent';
import { productBrand } from '../src/config/brand';
import { getCanonicalUrl, SITE_ORIGIN } from '../src/config/seo';

const pageTitle = 'XolveManager | Customer & Subscription Management Software';
const pageDescription = 'Sign in with Google or email and manage customer records, services, subscriptions, sales, invoices, and payments in one workspace — your data follows your account across devices.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: getCanonicalUrl('/') },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    type: 'website',
    url: getCanonicalUrl('/'),
    siteName: productBrand.name,
    locale: 'en_US',
    images: [{
      url: '/xolvemanager-social.png',
      width: 1200,
      height: 630,
      alt: 'XolveManager — customer and business management workspace',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
    images: ['/xolvemanager-social.png'],
  },
};

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: productBrand.name,
    url: SITE_ORIGIN,
    description: pageDescription,
    inLanguage: 'en',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: productBrand.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: SITE_ORIGIN,
    description: pageDescription,
    inLanguage: 'en',
    featureList: [
      'Customer and contact management',
      'Service and subscription tracking',
      'Sales and invoice management',
      'Payment and customer balance tracking',
      'Business reports',
      'Cloud account sign-in with Google or email',
      'Per-account workspaces',
      'Manual cloud upload and download',
      'Manual data backup and restore',
    ],
    screenshot: getCanonicalUrl('/images/xolvemanager-dashboard-showcase.png'),
  },
];

export default function Home() {
  return (
    <>
      {structuredData.map(schema => (
        <script
          key={schema['@type']}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <HomepageContent />
    </>
  );
}
