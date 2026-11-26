import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArchiveRestore,
  ArrowDownRight,
  ArrowRight,
  BookOpenText,
  CalendarClock,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  Layers3,
  LockKeyhole,
  LogIn,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Upload,
  UsersRound,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HomepageNavigation } from '../src/components/marketing/HomepageNavigation';
import { WorkflowWalkthrough } from '../src/components/marketing/WorkflowWalkthrough';
import {
  ProductModulePreview,
  type ProductModulePreviewProps,
} from '../src/components/marketing/HomepagePreviews';
import { productBrand } from '../src/config/brand';
import { getCanonicalUrl, SITE_ORIGIN } from '../src/config/seo';
import styles from './homepage.module.css';

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

const cloudSteps: Array<{
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    step: 'Step 1',
    title: 'Sign in with Google or email',
    description: 'Use the Google account you already have, or create an account with an email and password. No separate app to install.',
    icon: LogIn,
  },
  {
    step: 'Step 2',
    title: 'Syncs automatically',
    description: 'When you are signed in, your records upload to your cloud account a few seconds after you change them. Nothing leaves your device except to your own account.',
    icon: RefreshCw,
  },
  {
    step: 'Step 3',
    title: 'Restored on any device',
    description: 'Sign in on another device and your records are restored there automatically. Switch accounts, and each one shows only its own data.',
    icon: Download,
  },
];

const features: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Customer Management',
    description: 'Keep customer details connected to sales, subscriptions, invoices, and payment history.',
    icon: UsersRound,
  },
  {
    title: 'Services and Plans',
    description: 'Organize the services and plans you offer, including their prices and durations.',
    icon: Layers3,
  },
  {
    title: 'Subscription Tracking',
    description: 'Review subscription periods, statuses, renewal dates, and upcoming expiries.',
    icon: CalendarClock,
  },
  {
    title: 'Sales Management',
    description: 'Create and review sales records for your customers and services.',
    icon: ShoppingCart,
  },
  {
    title: 'Invoice Management',
    description: 'Keep invoices and their balances connected to the related sale.',
    icon: FileText,
  },
  {
    title: 'Payment Tracking',
    description: 'Record payments received through other means and review what remains due.',
    icon: CreditCard,
  },
  {
    title: 'Partial Payments',
    description: 'Record payments in stages and keep the remaining sale balance visible.',
    icon: CircleDollarSign,
  },
  {
    title: 'Advance Credit',
    description: 'Record customer advance credit and apply it to eligible sales.',
    icon: RefreshCw,
  },
  {
    title: 'Customer Ledger',
    description: 'Review a customer statement with invoices, payments, credits, and balances.',
    icon: BookOpenText,
  },
  {
    title: 'Business Reports',
    description: 'Review sales, payments, subscriptions, and other recorded business activity.',
    icon: ChartNoAxesCombined,
  },
  {
    title: 'Accounts and Profiles',
    description: 'Organize service accounts and their available profiles alongside your services.',
    icon: LockKeyhole,
  },
  {
    title: 'Separate Workspaces',
    description: 'Each cloud account has its own workspace. Switching accounts switches the records you see.',
    icon: ShieldCheck,
  },
  {
    title: 'Automatic Sync & Backup',
    description: 'Your records sync to your cloud account automatically when you are signed in, and you can download a backup file any time.',
    icon: ArchiveRestore,
  },
];

const productModules: ProductModulePreviewProps[] = [
  {
    title: 'Dashboard',
    icon: ChartNoAxesCombined,
    focus: 'A quick business overview',
    detail: 'See a summary of the activity recorded in your workspace.',
    previewType: 'dashboard',
  },
  {
    title: 'Customers',
    icon: UsersRound,
    focus: 'Customer records in one place',
    detail: 'Find customer details and review their related activity.',
    previewType: 'customers',
  },
  {
    title: 'Services',
    icon: Layers3,
    focus: 'Services and plans',
    detail: 'Organize service details, plans, prices, and durations.',
    previewType: 'services',
  },
  {
    title: 'Subscriptions',
    icon: CalendarClock,
    focus: 'Subscription periods and status',
    detail: 'Review terms, expiry dates, and subscription status.',
    previewType: 'subscriptions',
  },
  {
    title: 'Sales',
    icon: ShoppingCart,
    focus: 'Sales and payment progress',
    detail: 'Review sales, amounts due, and recorded payments.',
    previewType: 'sales',
  },
  {
    title: 'Invoices',
    icon: ReceiptText,
    focus: 'Invoices linked to sales',
    detail: 'Keep invoice details and balances connected to each sale.',
    previewType: 'invoices',
  },
  {
    title: 'Payments',
    icon: CreditCard,
    focus: 'Payments recorded by you',
    detail: 'Track received payments and partial-payment progress.',
    previewType: 'payments',
  },
  {
    title: 'Reports',
    icon: ChartNoAxesCombined,
    focus: 'Understand recorded activity',
    detail: 'Review business records through reports and summaries.',
    previewType: 'reports',
  },
];

const faqs = [
  {
    question: 'What is XolveManager?',
    answer: 'XolveManager is a workspace for organizing customer, service, subscription, sales, invoice, and payment records in one place.',
  },
  {
    question: 'Who can use XolveManager?',
    answer: 'It is designed for small service businesses, subscription providers, freelancers, and small teams who want to organize their business records.',
  },
  {
    question: 'How do I create an account?',
    answer: 'Choose “Create Free Account”, then sign up with your Google account or an email and password. Your cloud account keeps your records, and you can sign in with the same account on any device.',
  },
  {
    question: 'How do I see my records on another device?',
    answer: 'Open XolveManager on the other device and sign in with the same Google account or email. Your records are restored automatically. You can also download them manually from Settings.',
  },
  {
    question: 'Does my data sync automatically?',
    answer: 'Yes. When you are signed in, your changes upload to your cloud account a few seconds after you make them, and signing in on another device restores them there.',
  },
  {
    question: 'Can someone else see my records?',
    answer: 'No. Each account has its own workspace. Signing in with a different account shows only that account’s records.',
  },
  {
    question: 'Does XolveManager work offline?',
    answer: 'After you open the app once while online, the records on that device stay available offline. Uploading or downloading your records needs an internet connection.',
  },
  {
    question: 'Can XolveManager process customer payments?',
    answer: 'No. XolveManager records payments you have received through other means. It is not a payment gateway and does not charge customers.',
  },
  {
    question: 'How do I back up my data?',
    answer: 'Use the backup tools in Settings to download a backup file and store it somewhere safe. Uploading to your cloud account keeps another copy you can download later. Clearing browser data can remove records that exist only on that device, so keep a backup.',
  },
];

const privacyPoints = [
  {
    title: 'Separate by account',
    description: 'Every account has its own workspace. Switching accounts switches the records you see.',
    icon: ShieldCheck,
  },
  {
    title: 'Automatic sync, private by default',
    description: 'Your records sync to your own cloud account automatically when you are signed in — and only your account can see them.',
    icon: Upload,
  },
  {
    title: 'Backup you control',
    description: 'Download a backup file whenever you like and store it where you choose.',
    icon: ArchiveRestore,
  },
];

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${dark ? 'text-blue-300' : 'text-blue-700'}`}>
      {children}
    </p>
  );
}

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
      <div className={styles.homepage}>
      <HomepageNavigation />
      <main className="scroll-smooth motion-reduce:scroll-auto">
        {/* Hero */}
        <section className={`relative overflow-hidden bg-gradient-to-b from-sky-100 via-[#F0F7FF] to-white ${styles.sectionReveal}`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(37,99,235,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-blue-300/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-40%] left-[-8%] h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-8 sm:py-20 lg:py-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-blue-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
              Cloud account · Works on any device
            </p>
            <h1 className="mx-auto mt-5 max-w-3xl text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.75rem]">
              Manage customers, subscriptions &amp; sales <span className="text-blue-600">— on any device.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Sign in with Google or email, and your business records follow your account — not just one browser.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
              <Link href="/signup" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-900/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transform-none min-[420px]:w-auto">
                Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-blue-300 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 min-[420px]:w-auto">
                Sign in
              </Link>
            </div>
            <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 text-left text-sm font-medium text-slate-700 lg:grid-cols-4">
              {[
                { label: 'Sign in with Google or email', icon: LogIn },
                { label: 'Your data follows your account', icon: Smartphone },
                { label: 'Each account sees only its own data', icon: ShieldCheck },
                { label: 'Works offline after first load', icon: WifiOff },
              ].map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-white/80 p-3.5 shadow-sm shadow-blue-950/[0.03]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="leading-6">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cloud account — how your data moves */}
        <section id="cloud-account" className="scroll-mt-24 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Your cloud account</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Sign in once. Your business follows you.</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Create a cloud account with your Google account or an email and password. Your records belong to your account, and each account has its own separate workspace.
              </p>
            </div>
            <div className="relative mt-10 grid gap-4 md:grid-cols-3">
              <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-9 hidden h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 md:block" />
              {cloudSteps.map(({ step, title, description, icon: Icon }) => (
                <article key={title} className="relative rounded-3xl border border-blue-100 bg-[#F8FBFF] p-6 text-center sm:p-7">
                  <span className="relative mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-4 border-white bg-blue-700 text-white shadow-lg shadow-blue-900/20">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">{step}</p>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <WorkflowWalkthrough />

        <section id="features" className="scroll-mt-24 bg-[#F0F7FF] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow>Everything in one workspace</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Everyday Business Records, Organized Together</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Keep related records in one workspace, from the first customer entry to payment tracking and reporting — available wherever you sign in.
              </p>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, description, icon: Icon }) => (
                <article key={title} className="group rounded-3xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-950/[0.08] motion-reduce:transform-none sm:p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md shadow-blue-900/20 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
                    <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product-preview" className="scroll-mt-24 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>A look around the workspace</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">A Preview of the Tools You Will Use</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                These illustrative previews use labels and placeholders—not customer, account, or financial data. The same screens open on any device you sign in from. Actual screens may change as the app evolves.
              </p>
            </div>
            <div className="relative mx-auto mt-10 w-full max-w-4xl">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[3rem] bg-blue-300/40 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-blue-950/15 sm:rounded-3xl">
                <Image
                  src="/images/xolvemanager-dashboard-showcase.png"
                  alt="XolveManager demo dashboard showing sample business summaries, workspace navigation, and quick actions."
                  width={1400}
                  height={720}
                  sizes="(max-width: 1023px) 100vw, 896px"
                  className="h-auto w-full"
                />
              </div>
              <div className="relative -mt-5 ml-4 flex max-w-xs items-center gap-2.5 rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-lg shadow-blue-950/10 backdrop-blur sm:ml-8">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs font-semibold leading-5 text-slate-700">
                  Your account · Your data follows you
                </p>
              </div>
              <div className="relative mt-5 flex flex-wrap justify-center gap-2">
                {['Add Customers', 'Create Services and Plans', 'Track Subscriptions', 'Record Sales and Payments'].map(label => (
                  <span key={label} className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm sm:text-xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {productModules.map(module => <ProductModulePreview key={module.title} {...module} />)}
            </div>
          </div>
        </section>

        <section id="privacy-data" className="scroll-mt-24 bg-blue-950 py-16 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow dark>Privacy &amp; trust</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Your data is yours.</h2>
              <p className="mt-5 leading-7 text-blue-100/85">
                Your records belong to your cloud account. Each account has its own workspace, so another account never sees your data. When you are signed in, your records sync to your cloud account automatically — and only to your account.
              </p>
              <p className="mt-4 text-sm leading-6 text-blue-200/80">
                You can also download a full backup file any time. Clearing browser data can remove records that exist only on that device, so keep a backup.
              </p>
              <Link href="/legal/privacy" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-blue-300 underline-offset-4 transition hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Read the Privacy &amp; Data Notice <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {privacyPoints.map(({ title, description, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-white/15 bg-white/[0.07] p-5">
                  <Icon className="h-6 w-6 text-blue-300" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-blue-100/75">{description}</p>
                </article>
              ))}
              <p className="text-xs leading-5 text-blue-200/70 sm:col-span-3">
                XolveManager records payments made through other means; it does not process customer payments or automatically bill subscriptions.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <Eyebrow>Who it is for</Eyebrow>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Made for People Who Manage the Details Themselves</h2>
                <p className="mt-4 leading-7 text-slate-600">
                  If you keep track of customers, service plans, subscriptions, sales, or payments, XolveManager can help organize those records in a single workspace.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  'Small service businesses organizing customers and offerings',
                  'Subscription providers tracking periods and renewals',
                  'Freelancers managing customer and sales records',
                  'Small teams keeping payment and invoice records together',
                ].map(item => (
                  <li key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-medium leading-6 text-slate-700">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 bg-[#F0F7FF] py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow>Helpful answers</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Frequently Asked Questions</h2>
            </div>
            <div className="mt-8 divide-y divide-blue-100 border-y border-blue-100">
              {faqs.map(({ question, answer }) => (
                <details key={question} className={`${styles.faqItem} group py-1`}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-bold text-slate-900 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
                    {question}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-blue-700 transition-transform group-open:rotate-180">
                      <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </summary>
                  <div className={styles.faqAnswer}>
                    <div className={styles.faqAnswerInner}>
                      <p className="max-w-3xl pb-4 pr-9 text-sm leading-6 text-slate-600">{answer}</p>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-8 sm:py-20">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 px-5 py-10 text-center text-white shadow-xl shadow-blue-900/20 sm:px-10 sm:py-14">
            <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-[-5%] h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-[-5%] h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative">
              <Eyebrow dark>Your workspace starts here</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to organize your business — on any device?</h2>
              <p className="mx-auto mt-4 max-w-2xl leading-7 text-blue-100">
                Create your free cloud account and start with your customers, services, and sales.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 min-[420px]:flex-row">
                <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-900 transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white motion-reduce:transform-none">
                  Create Free Account <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#F8FBFF]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600">
                <Image
                  src={productBrand.wordmarkLightUrl}
                  alt=""
                  width={1080}
                  height={200}
                  className="h-auto w-[160px]"
                />
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">
                A workspace for organizing customers, services, subscriptions, sales, invoices, and recorded payments — with a cloud account that follows you.
              </p>
              <p className="mt-3 text-xs font-semibold text-slate-500">XolveKart → XolveManager</p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Explore</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><a href="#features" className="transition-colors hover:text-blue-800">Features</a></li>
                <li><a href="#how-it-works" className="transition-colors hover:text-blue-800">How it works</a></li>
                <li><a href="#faq" className="transition-colors hover:text-blue-800">FAQ</a></li>
                <li><a href="#privacy-data" className="transition-colors hover:text-blue-800">Privacy &amp; Data</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Data &amp; Trust</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><Link href="/legal/data-backup" className="transition-colors hover:text-blue-800">Data &amp; Backup</Link></li>
                <li><Link href="/legal" className="transition-colors hover:text-blue-800">Legal &amp; Trust Center</Link></li>
                <li><Link href="/legal/privacy" className="transition-colors hover:text-blue-800">Privacy Policy</Link></li>
                <li><Link href="/support" className="transition-colors hover:text-blue-800">Contact &amp; Support</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Your Account</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><Link href="/login" className="transition-colors hover:text-blue-800">Sign in</Link></li>
                <li><Link href="/signup" className="transition-colors hover:text-blue-800">Create Free Account</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-9 flex justify-center border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500">
            <span>© {new Date().getFullYear()} {productBrand.name}. All rights reserved.</span>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
