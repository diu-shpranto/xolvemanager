import Link from 'next/link';
import {
  BookText,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { ProductLogo } from '../common/BrandLockup';
import { productBrand } from '../../config/brand';
import { supportConfig } from '../../config/supportConfig';

const documentationLinks = [
  { title: 'Getting Started', description: 'Review the main workflows and business modules.', href: '/dashboard' },
  { title: 'Customer Management', description: 'Search and maintain customer records.', href: '/customers' },
  { title: 'Service Management', description: 'Review services and pricing plans.', href: '/services' },
  { title: 'Sales & Invoices', description: 'Open sales and invoice workflows.', href: '/invoices' },
  { title: 'Payments & Due Collection', description: 'Track payment status and due activity.', href: '/payments' },
  { title: 'Backup & Restore', description: 'Use Data & Storage settings to backup and restore data.', href: '/settings' },
  { title: 'Privacy & Data Storage', description: 'Review the Local-First privacy details.', href: '/legal/privacy' },
] as const;

const faqItems = [
  {
    question: 'What is XolveManager?',
    answer: 'XolveManager is a Local-First subscription business management app for organizing customers, services, accounts, sales, subscriptions, payments, invoices, and business activity in one place.',
  },
  {
    question: 'Where is my business data stored?',
    answer: 'In the inspected application, business records are stored in the browser LocalStorage for the active browser profile and are not automatically synchronized to a cloud database or remote server.',
  },
  {
    question: 'Does XolveManager support cloud synchronization?',
    answer: 'No. The current Local-First implementation does not include automatic cloud synchronization or app-managed server-side data storage.',
  },
  {
    question: 'How do I back up my data?',
    answer: 'Open Settings and use the Data & Storage area to create a downloadable JSON backup and selected CSV exports. Keep the backup file separate from the device.',
  },
  {
    question: 'How do I restore my data?',
    answer: 'Use the restore flow in Settings > Data & Storage. The app validates the backup and requires confirmation before applying it, and it creates a safety backup before restore.',
  },
  {
    question: 'What happens if I clear my browser data?',
    answer: 'Browser clearing or loss of the browser profile can remove the locally stored records. For important business data, keep regular backups and avoid relying on a single browser profile as the only copy.',
  },
  {
    question: 'Is local authentication the same as server-side authentication?',
    answer: 'No. Local sign-in is browser-local and is not server-side identity verification. Protect the device and browser profile because local access can grant access to the app and stored business records.',
  },
  {
    question: 'How can I contact support?',
    answer: 'Use this support page to review the currently available channels. Email and Messenger support are not configured yet in the verified project setup, so they remain disabled until an official destination is provided and approved.',
  },
] as const;

const supportEmailSubject = encodeURIComponent('XolveManager support request');
const supportEmailBody = encodeURIComponent('Please describe the issue, the relevant module, and any steps already taken.\n\nPlease remove or redact sensitive business data before sharing screenshots.');

const emailHref = supportConfig.supportEmail ? `mailto:${supportConfig.supportEmail}?subject=${supportEmailSubject}&body=${supportEmailBody}` : null;
const messengerHref = supportConfig.messengerUrl || supportConfig.facebookPageUrl || null;

function SupportChannelCard({
  title,
  description,
  href,
  hrefLabel,
  icon: Icon,
  configured,
}: {
  title: string;
  description: string;
  href: string | null;
  hrefLabel: string;
  icon: typeof Mail;
  configured: boolean;
}) {
  const isAvailable = Boolean(href && configured);

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/90 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${configured ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
          {configured ? 'Available' : 'Setup pending'}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>

      {isAvailable ? (
        <a
          href={href ?? '#'}
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noreferrer noopener' : undefined}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          {hrefLabel}
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </a>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          {title === 'Email Support' ? 'Email support is being set up.' : 'Messenger support is being set up.'}
        </div>
      )}
    </article>
  );
}

export function SupportExperience() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(91,33,182,0.14),_transparent_25%),linear-gradient(180deg,#070b14_0%,#0f172a_100%)] dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/login" aria-label="XolveManager home" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <ProductLogo size="compact" />
          </Link>
          <Link href="/legal" className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-violet-300 sm:inline-flex">
            Legal &amp; Trust Center <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </Link>
        </header>

        <section className="relative isolate mt-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 px-6 py-10 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.22)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 sm:px-10 sm:py-14 lg:px-14">
          <div aria-hidden="true" className="absolute -right-12 -top-14 -z-10 h-64 w-64 rounded-full bg-violet-200/80 blur-3xl dark:bg-violet-900/50" />
          <div aria-hidden="true" className="absolute right-20 top-12 -z-10 h-28 w-28 rotate-12 rounded-[1.75rem] border border-violet-200/80 bg-white/80 shadow-[0_18px_50px_-15px_rgba(124,58,237,0.45)] dark:border-violet-800 dark:bg-violet-950/50" />
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
              <Sparkles aria-hidden="true" className="h-4 w-4" /> Support center
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
              How can we help?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
              Choose a support channel or explore our resources to get help with XolveManager.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <SupportChannelCard
            title="Email Support"
            description="Get assistance with technical issues, product questions, and feedback."
            href={emailHref}
            hrefLabel="Email support"
            icon={Mail}
            configured={Boolean(supportConfig.supportEmail)}
          />
          <SupportChannelCard
            title="Facebook Messenger"
            description="Connect with the XolveKart team through Facebook Messenger."
            href={messengerHref}
            hrefLabel="Open Messenger"
            icon={MessageSquareText}
            configured={Boolean(supportConfig.messengerUrl || supportConfig.facebookPageUrl)}
          />
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-900/90 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <BookText aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Resources</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Knowledge base</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {documentationLinks.map(({ title, description, href }) => (
                <Link key={title} href={href} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-violet-800 dark:hover:bg-violet-950/20">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-900/90 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Feedback</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Bug reporting</h2>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Feedback is not connected yet.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    There is no verified submission endpoint in the inspected app. We do not create a fake form or send feedback without an approved destination.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/60">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Before sharing screenshots</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Remove sensitive information, passwords, payment credentials, and personal customer data that should not be shared publicly.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-900/90 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <FileText aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">FAQ</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Common questions</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {faqItems.map(({ question, answer }) => (
              <details key={question} className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-violet-200 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-violet-800">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-white [&::-webkit-details-marker]:hidden">
                  <span>{question}</span>
                  <ChevronDown aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-violet-700 transition-transform duration-200 group-open:rotate-180 dark:text-violet-300" strokeWidth={2} />
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200/80 pt-7 dark:border-slate-800">
          <nav aria-label="Footer support links" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <Link href="/legal" className="rounded-lg text-violet-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:text-violet-300">Legal &amp; Trust Center</Link>
            <Link href="/legal/privacy" className="rounded-lg text-violet-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:text-violet-300">Privacy Policy</Link>
            <Link href="/settings" className="rounded-lg text-violet-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:text-violet-300">Data &amp; Storage</Link>
            <Link href="/login" className="rounded-lg text-violet-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:text-violet-300">Back to app</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}

export default SupportExperience;
