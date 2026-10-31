import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { productBrand } from '../src/config/brand';
import { SITE_ORIGIN } from '../src/config/seo';

export const metadata: Metadata = {
  title: 'XolveManager | Local-First Business Management Software',
  description: 'Organize customer records, service plans, subscriptions, sales, invoices, and payment history with XolveManager. Your business data stays in your browser; keep regular backups.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'XolveManager | Local-First Business Management Software',
    description: 'Organize customer records, subscriptions, sales, invoices, and payment history in one local-first workspace.',
    type: 'website',
    url: '/',
    siteName: productBrand.name,
    images: [{
      url: '/xolvemanager-social.png',
      width: 1200,
      height: 630,
      alt: 'XolveManager business management software',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XolveManager | Local-First Business Management Software',
    description: 'Organize customer records, subscriptions, sales, invoices, and payment history in one local-first workspace.',
    images: ['/xolvemanager-social.png'],
  },
};

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: productBrand.name,
    url: SITE_ORIGIN,
    inLanguage: 'en',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_ORIGIN}/#software`,
    name: productBrand.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'A Local-First browser application for managing customer records, services, subscriptions, sales, invoices, payment records, reminders, reports, and backups.',
    url: SITE_ORIGIN,
    image: `${SITE_ORIGIN}/xolvemanager-social.png`,
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="min-h-screen overflow-hidden bg-[#faf9fc] text-slate-950">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="XolveManager home" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <Image src={productBrand.iconUrl} alt="" width={40} height={40} priority />
            <span className="text-lg font-extrabold tracking-tight">{productBrand.name}</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-3 text-sm font-semibold sm:gap-6">
            <a href="#features" className="hidden text-slate-600 hover:text-violet-700 sm:inline">Features</a>
            <Link href="/legal/privacy" className="hidden text-slate-600 hover:text-violet-700 sm:inline">Privacy &amp; data</Link>
            <Link href="/login" className="whitespace-nowrap rounded-lg px-3 py-2 text-slate-700 hover:bg-violet-50">Sign in</Link>
            <Link href="/signup" className="whitespace-nowrap rounded-lg bg-violet-700 px-4 py-2.5 text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
              Get started
            </Link>
          </nav>
        </header>

        <section className="relative isolate mx-auto max-w-7xl px-5 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-16">
          <div aria-hidden="true" className="absolute -right-36 -top-20 -z-10 h-96 w-96 rounded-full bg-violet-200/60 blur-3xl" />
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-violet-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Local-First business management beta
          </p>
          <div className="mt-7 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Keep customer, subscription, and sales records in one place.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                XolveManager helps small businesses organize customer details, service plans, subscription periods, sales, invoices, and recorded payments in a clear browser-based workspace.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white shadow-lg shadow-violet-900/15 transition hover:-translate-y-0.5 hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
                  Create a local account
                </Link>
                <Link href="/legal/privacy" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-800">
                  How your data works
                </Link>
              </div>
              <p className="mt-4 max-w-xl text-xs leading-5 text-slate-500">
                Local-First beta: business records are stored in this browser and do not automatically sync to cloud servers. Keep regular backups.
              </p>
            </div>

            <div className="rounded-[2rem] border border-violet-100 bg-white p-3 shadow-[0_30px_90px_-40px_rgba(76,29,149,0.38)] sm:p-5">
              <Image
                src="/xolvemanager-social.png"
                alt="XolveManager product identity"
                width={1200}
                height={630}
                sizes="(max-width: 1024px) 100vw, 48vw"
                priority
                className="h-auto w-full rounded-2xl"
              />
              <p className="px-2 pb-1 pt-3 text-center text-xs text-slate-500">
                Business, simplified. Manage records with a clearer view.
              </p>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-6 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">One workspace for everyday records</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Business management tools for subscription-based work.</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Keep related customer, service, sale, and payment records connected—without mistaking record tracking for payment processing or cloud synchronization.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Customer records', 'Store customer contact details and review related sales, subscriptions, invoices, and payment history.'],
                ['Services and plans', 'Maintain service offerings and plans with their prices, durations, currencies, and availability.'],
                ['Subscription tracking', 'Review subscription periods, status, expiry dates, renewals, and upcoming reminders.'],
                ['Sales and invoices', 'Record sales and review invoices, balances, and payment progress associated with a sale.'],
                ['Payment records', 'Record payments against sales and review payment progress. XolveManager is not a payment gateway.'],
                ['Reports and backups', 'Review business activity and create downloadable backups or selected exports for safekeeping.'],
              ].map(([title, description], index) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-[#fdfcff] p-5 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-sm font-extrabold text-violet-800">0{index + 1}</span>
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Know where your data lives</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Local-First by design. Backups remain important.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              XolveManager stores business records in browser storage on the device and profile where they are entered. It does not automatically synchronize those records between devices or to a cloud database.
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-600" />Clearing browser data or losing access to the profile can make records unavailable.</li>
              <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-600" />Local sign-in is not server-side authentication or a security boundary.</li>
              <li className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-600" />Maintain secure downloadable backups and avoid storing highly sensitive information.</li>
            </ul>
            <Link href="/legal/privacy" className="mt-6 inline-flex font-bold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:decoration-violet-700">
              Read the verified privacy and data notice
            </Link>
          </div>
          <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <h3 className="text-xl font-extrabold text-amber-950">Important product limits</h3>
            <p className="mt-3 text-sm leading-6 text-amber-950/80">
              The current beta is a browser-based records and workflow tool. It does not provide automatic cloud sync, server-side user authentication, or payment processing. Payments are business records entered by the user.
            </p>
            <p className="mt-4 text-sm leading-6 text-amber-950/80">
              Service-account credentials entered into records are stored as ordinary browser data. Do not use XolveManager as a password manager.
            </p>
          </aside>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-5 sm:px-8">
            <h2 className="text-3xl font-extrabold tracking-tight">Frequently asked questions</h2>
            <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
              <details className="group py-5">
                <summary className="cursor-pointer font-bold marker:text-violet-700">Does XolveManager sync data between devices?</summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">No. Business records are stored in the browser and do not automatically sync to cloud servers or other devices. Use the backup and restore tools to move records deliberately.</p>
              </details>
              <details className="group py-5">
                <summary className="cursor-pointer font-bold marker:text-violet-700">Can XolveManager process customer payments?</summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">No. It records payments made through other means and helps relate them to business sales. It is not a payment gateway or processor.</p>
              </details>
              <details className="group py-5">
                <summary className="cursor-pointer font-bold marker:text-violet-700">What should I do to protect my business records?</summary>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Keep regular downloadable backups in a secure place, protect the browser profile and device, and avoid entering highly sensitive information. Browser storage can be cleared or become unavailable.</p>
              </details>
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-slate-600 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p><span className="font-bold text-slate-900">XolveManager</span> · Local-First business management.</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/legal/privacy" className="hover:text-violet-800">Privacy &amp; data</Link>
            <Link href="/legal/data-backup" className="hover:text-violet-800">Data &amp; backup</Link>
            <Link href="/support" className="hover:text-violet-800">Support information</Link>
            <Link href="/login" className="hover:text-violet-800">Open XolveManager</Link>
          </nav>
        </footer>
      </main>
    </>
  );
}
