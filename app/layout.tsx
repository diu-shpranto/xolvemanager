import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { productBrand } from '../src/config/brand';
import './globals.css';

const productTitle = `${productBrand.name} — ${productBrand.description}`;
const productDescription = 'XolveManager is a business management dashboard for customer records, subscriptions, sales, payments, service accounts, renewals, notifications, and reports.';

export const metadata: Metadata = {
  title: productTitle,
  description: productDescription,
  applicationName: productBrand.shortName,
  manifest: '/manifest.webmanifest',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: productBrand.faviconUrl, type: 'image/svg+xml' },
      { url: '/icons/xolve-manager-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/icons/xolve-manager-180.png', sizes: '180x180' }],
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
  },
  twitter: {
    card: 'summary',
    title: productTitle,
    description: productDescription,
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
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-violet-600 selection:text-white dark:bg-[#0B0F17] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
