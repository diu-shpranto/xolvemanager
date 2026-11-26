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
    title: 'Upload when you choose',
    description: 'Your records move to your cloud account only when you tap Upload. Nothing is sent automatically.',
    icon: Upload,
  },
  {
    step: 'Step 3',
    title: 'Download on any device',
    description: 'Sign in on another device and download your records there. Switch accounts, and each one shows only its own data.',
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
    title: 'Backup, Upload & Download',
    description: 'Download a backup file any time, or upload your records to your cloud account and download them on another device — both are actions you choose.',
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
    answer: 'Open XolveManager on the other device and sign in with the same Google account or email. Then choose Download in the app to bring your records onto that device.',
  },
  {
    question: 'Does my data sync automatically?',
    answer: 'No. Nothing moves on its own. Upload from one device and download on the other — both are actions you choose in the app.',
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
    title: 'Sync on your terms',
    description: 'Upload and download are actions you choose. Nothing moves automatically.',
    icon: Upload,
  },
  {
    title: 'Backup you control',
    description: 'Download a backup file whenever you like and store it where you choose.',
    icon: ArchiveRestore,
  },
];

function ActionLink({ href, children, secondary = false }: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-600 motion-reduce:transform-none ${
        secondary
          ? 'border border-violet-200 bg-white text-violet-900 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50'
          : 'bg-violet-700 text-white shadow-lg shadow-violet-900/15 hover:-translate-y-0.5 hover:bg-violet-800'
      }`}
    >
      {children}
    </Link>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${dark ? 'text-violet-300' : 'text-violet-700'}`}>
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
        <section className={`relative overflow-hidden bg-gradient-to-b from-violet-100 via-[#F8F6FF] to-white ${styles.sectionReveal}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-violet-300/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-40%] left-[-8%] h-80 w-80 rounded-full bg-fuchsia-200/30 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:py-20">
            <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-violet-800 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-violet-600" aria-hidden="true" />
                Cloud account · Works on any device
              </p>
              <h1 className="mt-5 max-w-2xl text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.5rem]">
                Manage customers, subscriptions &amp; sales — on any device.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                XolveManager is a simple workspace for small businesses. Sign in with any Google account or email, and your customers, services, subscriptions, sales, invoices, and payments follow your account — not just one browser.
              </p>
              <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row">
                <ActionLink href="/signup">
                  Create Free Account <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ActionLink>
                <ActionLink href="/login" secondary>Sign In</ActionLink>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Free to start. No separate app to install — it runs in your browser.
              </p>
              <ul className="mt-7 grid gap-2.5 text-sm font-medium text-slate-700 sm:grid-cols-2">
                {[
                  { label: 'Sign in with Google or email', icon: LogIn },
                  { label: 'Your data follows your account', icon: Smartphone },
                  { label: 'Each account sees only its own data', icon: ShieldCheck },
                  { label: 'Works offline after first load', icon: WifiOff },
                ].map(({ label, icon: Icon }) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-violet-100 text-violet-700">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <div aria-hidden="true" className="absolute -inset-5 rounded-[3rem] bg-violet-300/40 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl shadow-violet-950/15 sm:rounded-3xl">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span className="ml-2 hidden min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 sm:block">
                    xolvemanager.vercel.app
                  </span>
                </div>
                <Image
                  src="/images/xolvemanager-dashboard-showcase.png"
                  alt="XolveManager demo dashboard showing sample business summaries, workspace navigation, and quick actions."
                  width={1400}
                  height={720}
                  sizes="(max-width: 1023px) 100vw, 55vw"
                  priority
                  className="h-auto w-full"
                />
              </div>
              <div className="relative -mt-5 ml-4 flex max-w-xs items-center gap-2.5 rounded-2xl border border-violet-100 bg-white/95 px-4 py-3 shadow-lg shadow-violet-950/10 backdrop-blur sm:ml-8">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs font-semibold leading-5 text-slate-700">
                  Your account · Your data follows you
                </p>
              </div>
              <div className="relative mt-5 flex flex-wrap justify-center gap-2">
                {['Add Customers', 'Create Services and Plans', 'Track Subscriptions', 'Record Sales and Payments'].map(label => (
                  <span key={label} className="rounded-full border border-violet-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm sm:text-xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
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
              <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-9 hidden h-0.5 bg-gradient-to-r from-violet-200 via-violet-300 to-violet-200 md:block" />
              {cloudSteps.map(({ step, title, description, icon: Icon }) => (
                <article key={title} className="relative rounded-3xl border border-violet-100 bg-[#FBFAFE] p-6 text-center sm:p-7">
                  <span className="relative mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-4 border-white bg-violet-700 text-white shadow-lg shadow-violet-900/20">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">{step}</p>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-6 text-slate-500">
              Prefer to keep everything on one device? A device-only account is still available on the sign-in page — your records stay in that browser.
            </p>
          </div>
        </section>

        <WorkflowWalkthrough />

        <section id="features" className="scroll-mt-24 bg-[#F8F6FF] py-16 sm:py-20">
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
                <article key={title} className="group rounded-3xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-950/[0.08] motion-reduce:transform-none sm:p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-md shadow-violet-900/20 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
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
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {productModules.map(module => <ProductModulePreview key={module.title} {...module} />)}
            </div>
          </div>
        </section>

        <section id="privacy-data" className="scroll-mt-24 bg-violet-950 py-16 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow dark>Privacy &amp; trust</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Your data is yours.</h2>
              <p className="mt-5 leading-7 text-violet-100/85">
                Your records belong to your cloud account. Each account has its own workspace, so another account never sees your data. Cloud upload and download happen only when you choose them — nothing moves in the background.
              </p>
              <p className="mt-4 text-sm leading-6 text-violet-200/80">
                You can also download a full backup file any time, and a device-only account keeps everything in one browser if you prefer that. Clearing browser data can remove records that exist only on that device, so keep a backup.
              </p>
              <Link href="/legal/privacy" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-violet-300 underline-offset-4 transition hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Read the Privacy &amp; Data Notice <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {privacyPoints.map(({ title, description, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-white/15 bg-white/[0.07] p-5">
                  <Icon className="h-6 w-6 text-violet-300" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-violet-100/75">{description}</p>
                </article>
              ))}
              <p className="text-xs leading-5 text-violet-200/70 sm:col-span-3">
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
                    <Check className="mt-1 h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 bg-[#F8F6FF] py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow>Helpful answers</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Frequently Asked Questions</h2>
            </div>
            <div className="mt-8 divide-y divide-violet-100 border-y border-violet-100">
              {faqs.map(({ question, answer }) => (
                <details key={question} className={`${styles.faqItem} group py-1`}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-bold text-slate-900 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 [&::-webkit-details-marker]:hidden">
                    {question}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-violet-700 transition-transform group-open:rotate-180">
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
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-800 to-violet-950 px-5 py-10 text-center text-white shadow-xl shadow-violet-900/20 sm:px-10 sm:py-14">
            <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-[-5%] h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-[-5%] h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="relative">
              <Eyebrow dark>Your workspace starts here</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to organize your business — on any device?</h2>
              <p className="mx-auto mt-4 max-w-2xl leading-7 text-violet-100">
                Create your free cloud account and start with your customers, services, and sales.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 min-[420px]:flex-row">
                <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-900 transition hover:-translate-y-0.5 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white motion-reduce:transform-none">
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

      <footer className="border-t border-slate-200 bg-[#FBFAFE]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-violet-600">
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
                <li><a href="#features" className="transition-colors hover:text-violet-800">Features</a></li>
                <li><a href="#how-it-works" className="transition-colors hover:text-violet-800">How it works</a></li>
                <li><a href="#faq" className="transition-colors hover:text-violet-800">FAQ</a></li>
                <li><a href="#privacy-data" className="transition-colors hover:text-violet-800">Privacy &amp; Data</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Data &amp; Trust</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><Link href="/legal/data-backup" className="transition-colors hover:text-violet-800">Data &amp; Backup</Link></li>
                <li><Link href="/legal" className="transition-colors hover:text-violet-800">Legal &amp; Trust Center</Link></li>
                <li><Link href="/legal/privacy" className="transition-colors hover:text-violet-800">Privacy Policy</Link></li>
                <li><Link href="/support" className="transition-colors hover:text-violet-800">Contact &amp; Support</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Your Account</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><Link href="/login" className="transition-colors hover:text-violet-800">Sign in</Link></li>
                <li><Link href="/signup" className="transition-colors hover:text-violet-800">Create Free Account</Link></li>
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
