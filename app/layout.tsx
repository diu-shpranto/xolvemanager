import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { productBrand } from '../src/config/brand';
import './globals.css';

const productTitle = productBrand.name;
const productDescription = 'XolveManager is a business management dashboard for customer records, subscriptions, sales, payments, service accounts, renewals, notifications, and reports.';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;

export const metadata: Metadata = {
  title: productTitle,
  description: productDescription,
  applicationName: productBrand.shortName,
  ...(metadataBase ? { metadataBase } : {}),
  manifest: '/manifest.webmanifest',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: '/icons/xolvemanager-violet-16.png', type: 'image/png', sizes: '16x16' },
      { url: productBrand.faviconUrl, type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/icons/xolvemanager-violet-180.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: productBrand.shortName,
    statusBarStyle: 'default',
  },
  openGraph: {
    title: productTitle,
    description: productDescription,
    type: 'website',
    siteName: productBrand.name,
    ...(metadataBase ? {
      images: [{
        url: '/xolvemanager-social.png',
        width: 1200,
        height: 630,
        alt: 'XolveManager — Business, in better focus',
      }],
    } : {}),
  },
  twitter: {
    card: metadataBase ? 'summary_large_image' : 'summary',
    title: productTitle,
    description: productDescription,
    ...(metadataBase ? { images: ['/xolvemanager-social.png'] } : {}),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: productBrand.primaryColor,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[#F8FAFC] text-slate-900 antialiased selection:bg-violet-600 selection:text-white dark:bg-[#0B0B1B] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
