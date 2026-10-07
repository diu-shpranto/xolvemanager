import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const productTitle = 'XolveManager — Business Management Platform';

export const metadata: Metadata = {
  title: productTitle,
  description: 'Business Management Platform',
  applicationName: 'XolveManager',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/xolve-manager-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/icons/xolve-manager-180.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'XolveManager',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: productTitle,
    description: 'Business Management Platform',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#059669',
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
      <body className="h-full bg-[#F8FAFC] font-sans text-slate-900 antialiased selection:bg-emerald-600 selection:text-white dark:bg-[#0B0F17] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
