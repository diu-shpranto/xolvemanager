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
  FileText,
  HardDrive,
  Layers3,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  Shield,
  ShoppingCart,
  UsersRound,
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
const pageDescription = 'Manage customer records, services, subscriptions, sales, invoices, and recorded payments in one browser-based workspace for small businesses.';

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
      'Manual data backup and restore',
    ],
    screenshot: getCanonicalUrl('/images/xolvemanager-dashboard-showcase.png'),
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
    title: 'Backup & Restore',
    description: 'Create a manual data backup and restore a validated backup when needed.',
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
    question: 'Does XolveManager work offline?',
    answer: 'After you open the app while online and its files are cached, the installed web app can load offline. Your business records are stored in the browser. Keep a separate backup, and reconnect to the internet for app updates or external links.',
  },
  {
    question: 'Does my data sync between devices?',
    answer: 'No. Business records are stored in the browser profile where you use XolveManager and do not automatically sync to cloud servers or other devices. Use the manual backup and restore tools when moving data.',
  },
  {
    question: 'Can XolveManager process customer payments?',
    answer: 'No. XolveManager records payments you have received through other means. It is not a payment gateway and does not charge customers.',
  },
  {
    question: 'How do I back up my data?',
    answer: 'Use the backup and restore tools in the app settings to create a downloadable backup. Store it somewhere safe; clearing browser data or losing access to the browser profile can make local records unavailable.',
  },
  {
    question: 'How do I create an account?',
    answer: 'Choose “Create Free Account” to open the existing sign-up flow. Account access is local to this browser and is not server-side authentication.',
  },
  {
    question: 'How do existing users sign in?',
    answer: 'Choose “Sign In” in the browser profile where your local account and records are stored.',
  },
];

const privacyPoints = [
  {
    title: 'Browser-based storage',
    description: 'Your business records are stored in the browser profile where you use the app.',
    icon: HardDrive,
  },
  {
    title: 'No Automatic Cloud Sync',
    description: 'Records do not automatically sync to cloud servers or move between your devices.',
    icon: Shield,
  },
  {
    title: 'Manual backup & restore',
    description: 'Create and safely store your own downloadable backup. Restore is a deliberate action.',
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
        <section className={`overflow-hidden bg-[#F8F6FF] ${styles.sectionReveal}`}>
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-9 sm:px-8 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:py-14">
            <div className="relative z-10">
              <h1 className="mt-5 max-w-2xl text-[2.35rem] font-extrabold leading-[1.12] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.35rem]">
                Manage Customers, Subscriptions &amp; Sales in One Place.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                XolveManager helps small businesses organize customer details, service plans, subscriptions, sales, invoices, and recorded payments in one simple workspace.
              </p>
              <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row">
                <ActionLink href="/signup">
                  Create Free Account <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ActionLink>
                <ActionLink href="/login" secondary>Sign In</ActionLink>
              </div>
              <ul className="mt-6 grid gap-2 text-sm font-medium text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
                {['Works Offline After Initial Load', 'Your Data Stays in Your Browser', 'No Automatic Cloud Sync'].map(point => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Your business records are stored in your browser. Regular backups are recommended.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <div aria-hidden="true" className="absolute -inset-5 rounded-[3rem] bg-violet-200/45 blur-3xl" />
              <figure className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl shadow-violet-950/15 sm:rounded-3xl">
                <Image
                  src="/images/xolvemanager-dashboard-showcase.png"
                  alt="XolveManager demo dashboard showing sample business summaries, workspace navigation, and quick actions."
                  width={1400}
                  height={720}
                  sizes="(max-width: 1023px) 100vw, 55vw"
                  priority
                  className="h-auto w-full"
                />
              </figure>
              <div className="relative mt-3 flex flex-wrap justify-center gap-2">
                {['Add Customers', 'Create Services and Plans', 'Track Subscriptions', 'Record Sales and Payments'].map(label => (
                  <span key={label} className="rounded-full border border-violet-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm sm:text-xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <WorkflowWalkthrough />

        <section id="features" className="scroll-mt-24 bg-[#F8F6FF] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Everyday Business Records, Organized Together</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Keep related records in one workspace, from the first customer entry to payment tracking and reporting.
              </p>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, description, icon: Icon }) => (
                <article key={title} className="group rounded-2xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/[0.06] motion-reduce:transform-none sm:p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-800 transition-colors group-hover:bg-violet-700 group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
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
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">A Look Around the Workspace</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">A Preview of the Tools You Will Use</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                These illustrative previews use labels and placeholders—not customer, account, or financial data. Actual screens may change as the app evolves.
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
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Understand Your Data</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Your Business Records Stay in Your Browser.</h2>
              <p className="mt-5 leading-7 text-violet-100/85">
                XolveManager stores business records in your browser. They do not automatically sync to cloud servers or other devices. You stay in control of your local data and should keep regular backups.
              </p>
              <p className="mt-4 text-sm leading-6 text-violet-200/80">
                Clearing browser data or losing access to your browser profile may result in data loss. Local sign-in is not server-side authentication, and records are not a substitute for secure storage of highly sensitive information.
              </p>
              <Link href="/legal/privacy" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-violet-300 underline-offset-4 transition hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Read the Privacy &amp; Data Notice <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {privacyPoints.map(({ title, description, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-white/15 bg-white/[0.07] p-5">
                  <Icon className="h-6 w-6 text-violet-300" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-violet-100/75">{description}</p>
                </article>
              ))}
              <p className="sm:col-span-3 text-xs leading-5 text-violet-200/70">
                XolveManager records payments made through other means; it does not process customer payments or automatically bill subscriptions.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Who It Is For</p>
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
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Helpful Answers</p>
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
          <div className="mx-auto max-w-5xl rounded-3xl bg-violet-700 px-5 py-10 text-center text-white shadow-xl shadow-violet-900/15 sm:px-10 sm:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Your Workspace Starts Here</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to Organize Your Business?</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-violet-100">
              Create your workspace and start managing your customer and business records.
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
                A workspace for organizing customers, services, subscriptions, sales, invoices, and recorded payments.
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
