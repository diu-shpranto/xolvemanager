import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Mail, MessageSquareText, ShieldCheck, Sparkles, TriangleAlert, BookText, FileText, ExternalLink } from 'lucide-react';
import { ProductLogo } from '../../src/components/common/BrandLockup';
import { supportConfig } from '../../src/config/supportConfig';
import {
  getLegalPolicy,
  LEGAL_POLICY_UPDATED_AT,
  legalPolicies,
  type LegalPolicy,
} from '../../src/config/legalPolicies';

const linkClass =
  'rounded-lg text-violet-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:text-violet-300';

const PageFooter = () => (
  <footer className="mt-16 border-t border-slate-200/80 pt-7 dark:border-slate-800">
    <nav aria-label="Legal footer" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
      <Link href="/legal" className={linkClass}>Legal &amp; Trust Center</Link>
      <Link href="/support" className={linkClass}>Contact &amp; Support</Link>
      <Link href="/legal/privacy" className={linkClass}>Privacy Policy</Link>
      <Link href="/legal/data-backup" className={linkClass}>Data &amp; Backup</Link>
      <Link href="/login" className={linkClass}>Return to XolveManager</Link>
    </nav>
    <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
      Draft policies are for owner review and are not established company terms.
    </p>
  </footer>
);

const LocalFirstBanner = () => (
  <aside className="overflow-hidden rounded-[28px] border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 shadow-[0_20px_60px_-35px_rgba(91,33,182,0.45)] dark:border-violet-900/80 dark:from-violet-950/40 dark:via-slate-950 dark:to-indigo-950/40 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/20 dark:bg-violet-500 dark:text-violet-50">
        <ShieldCheck aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Local-First by design</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700 dark:border-violet-800 dark:bg-slate-900/70 dark:text-violet-200">
            <Sparkles aria-hidden="true" className="h-3 w-3" /> Trusted
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
          XolveManager is currently a Local-First application. Your business data is stored in your browser and is not automatically synchronized to cloud servers. Please maintain regular backups.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/60">No cloud sync</span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/60">Local storage only</span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/60">Backup responsibility</span>
        </div>
      </div>
    </div>
  </aside>
);

export function LegalCenterPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(91,33,182,0.14),_transparent_25%),linear-gradient(180deg,#070b14_0%,#0f172a_100%)] dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/login" aria-label="XolveManager home" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <ProductLogo size="compact" />
          </Link>
          <Link href="/legal/privacy" className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-violet-300 sm:inline-flex">
            Privacy details <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </header>

        <section className="relative isolate mt-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 px-6 py-10 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.22)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 sm:px-10 sm:py-14 lg:px-14">
          <div aria-hidden="true" className="absolute -right-10 -top-14 -z-10 h-64 w-64 rounded-full bg-violet-200/80 blur-3xl dark:bg-violet-900/50" />
          <div aria-hidden="true" className="absolute right-20 top-12 -z-10 h-28 w-28 rotate-12 rounded-[1.75rem] border border-violet-200/80 bg-white/80 shadow-[0_18px_50px_-15px_rgba(124,58,237,0.45)] dark:border-violet-800 dark:bg-violet-950/50" />
          <div aria-hidden="true" className="absolute inset-y-0 left-0 -z-10 w-px bg-gradient-to-b from-transparent via-violet-200 to-transparent dark:via-violet-800" />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                <BadgeCheck aria-hidden="true" className="h-4 w-4" /> Transparency Center
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
                Legal &amp; Trust Center
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
                Transparency, clarity, and trust are important to us. Find information about how XolveManager works, your data, and your rights.
              </p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 sm:grid-cols-3 lg:min-w-[28rem]">
              <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Verified</div>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">Privacy notice</p>
              </div>
              <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Local-first</div>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">No cloud sync</p>
              </div>
              <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Updated</div>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">{LEGAL_POLICY_UPDATED_AT}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6"><LocalFirstBanner /></div>

        <section className="mt-12" aria-labelledby="policy-list-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Policies &amp; information</p>
              <h2 id="policy-list-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Explore the documents</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Document date · {LEGAL_POLICY_UPDATED_AT}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {legalPolicies.map(policy => <PolicyCard key={policy.slug} policy={policy} />)}
          </div>
        </section>

        <section className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[26px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_80px_-38px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-900/90 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
              <BookOpen aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">A note about draft policies</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              The Privacy, Cookie, and Data &amp; Backup pages describe technical behavior found in the application. Other documents are structured drafts because approved legal terms and business-specific details were not available to verify. Drafts are clearly marked and need owner confirmation and, where appropriate, legal review.
            </p>
          </div>
          <div className="rounded-[26px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_80px_-38px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-900/90 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">Contact &amp; Support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              A public XolveManager support or privacy contact has not been verified. We do not list unconfirmed contact details.
            </p>
            <Link href="/support" className={`${linkClass} mt-4 inline-flex items-center gap-2 text-sm font-semibold`}>
              View support options <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <PageFooter />
      </div>
    </main>
  );
}

function PolicyCard({ policy }: { policy: LegalPolicy }) {
  const Icon = policy.icon;
  return (
    <article className="group flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <ReviewBadge state={policy.reviewState} />
      </div>
      <h3 className="mt-5 text-base font-bold text-slate-950 dark:text-white">{policy.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{policy.description}</p>
      <Link href={`/legal/${policy.slug}`} className={`${linkClass} mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold`}>
        {policy.reviewState === 'draft' ? 'Review draft' : 'Read policy'}
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </article>
  );
}

function ReviewBadge({ state }: { state: LegalPolicy['reviewState'] }) {
  const label = state === 'technical' ? 'Technical disclosure' : 'Draft for review';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${state === 'technical'
      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
      {label}
    </span>
  );
}

const supportEmailSubject = encodeURIComponent('XolveManager support request');
const supportEmailBody = encodeURIComponent('Please describe the issue, the relevant module, and any steps already taken.\n\nPlease remove or redact sensitive business data before sharing screenshots.');
const emailHref = supportConfig.supportEmail ? `mailto:${supportConfig.supportEmail}?subject=${supportEmailSubject}&body=${supportEmailBody}` : null;
const messengerHref = supportConfig.messengerUrl || supportConfig.facebookPageUrl || null;

function SupportContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B0B1B] dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/login" aria-label="XolveManager home" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <ProductLogo size="compact" />
          </Link>
          <Link href="/legal" className={`${linkClass} inline-flex items-center gap-2 text-sm font-semibold`}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Legal Center
          </Link>
        </header>

        <nav aria-label="Breadcrumb" className="mt-8 text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
            <li><Link href="/legal" className={linkClass}>Legal &amp; Trust Center</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-slate-800 dark:text-slate-200">Contact &amp; Support</li>
          </ol>
        </nav>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-12">
          <aside className="lg:sticky lg:top-6">
            <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 hover:border-violet-200 focus-within:border-violet-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800 lg:hidden" aria-label="Toggle legal section navigation">
              <summary aria-expanded="false" aria-controls="legal-page-nav-mobile" className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-white [&::-webkit-details-marker]:hidden">
                <span>On this page</span>
                <ChevronDown aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-violet-700 transition-transform duration-200 group-open:rotate-180 dark:text-violet-300" strokeWidth={2} />
              </summary>
              <div id="legal-page-nav-mobile" className="pt-3">
                <nav aria-label="Legal documents" className="grid gap-1">
                  {legalPolicies.map(item => (
                    <Link key={item.slug} href={`/legal/${item.slug}`} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      {item.title}
                    </Link>
                  ))}
                </nav>
              </div>
            </details>
            <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
              <nav aria-label="Legal documents" className="grid gap-1">
                <h2 className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Legal documents</h2>
                {legalPolicies.map(item => (
                  <Link key={item.slug} href={`/legal/${item.slug}`} aria-current={item.slug === 'contact' ? 'page' : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-600 ${item.slug === 'contact' ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
                    {item.title}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <article className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-200 p-5 sm:p-8 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  <ShieldCheck aria-hidden="true" className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Draft for review</span>
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Contact &amp; Support</h1>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Draft for owner review · {LEGAL_POLICY_UPDATED_AT}</p>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                No public support destination or privacy contact is configured in the inspected application. We do not present an unverified email address, business address, or phone number as an established support channel.
              </p>
            </header>

            <div className="space-y-8 p-5 sm:p-8">
              <div className="grid gap-5 lg:grid-cols-2">
                <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      <Mail aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${supportConfig.supportEmail ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                      {supportConfig.supportEmail ? 'Available' : 'Setup pending'}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">Email Support</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Get assistance with technical issues, product questions, and feedback.</p>
                  {supportConfig.supportEmail && emailHref ? (
                    <a href={emailHref} className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
                      Email support
                      <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                      Email support is being set up.
                    </div>
                  )}
                </article>

                <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      <MessageSquareText aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${messengerHref ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                      {messengerHref ? 'Available' : 'Setup pending'}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">Facebook Messenger</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Connect with the XolveKart team through Facebook Messenger.</p>
                  {messengerHref ? (
                    <a href={messengerHref} target="_blank" rel="noreferrer noopener" className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
                      Open Messenger
                      <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                      Messenger support is being set up.
                    </div>
                  )}
                </article>
              </div>

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <BookText aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Help &amp; documentation</h2>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Getting Started', '/dashboard'],
                    ['Customer Management', '/customers'],
                    ['Service Management', '/services'],
                    ['Sales & Invoices', '/invoices'],
                    ['Payments & Due Collection', '/payments'],
                    ['Backup & Restore', '/settings'],
                    ['Privacy & Data Storage', '/legal/privacy'],
                  ].map(([title, href]) => (
                    <Link key={title} href={href} className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-800 dark:hover:text-violet-300">
                      {title}
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                    <TriangleAlert aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Feedback &amp; bug reporting</h2>
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    There is no verified submission endpoint in the inspected app. We do not create a fake form or send feedback without an approved destination.
                  </p>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <FileText aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Frequently asked questions</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ['What is XolveManager?', 'XolveManager is a Local-First subscription business management app for organizing customers, services, accounts, sales, subscriptions, payments, invoices, and business activity in one place.'],
                    ['Where is my business data stored?', 'In the inspected application, business records are stored in the browser LocalStorage for the active browser profile and are not automatically synchronized to a cloud database or remote server.'],
                    ['Does XolveManager support cloud synchronization?', 'No. The current Local-First implementation does not include automatic cloud synchronization or app-managed server-side data storage.'],
                    ['How do I back up my data?', 'Open Settings and use the Data & Storage area to create a downloadable JSON backup and selected CSV exports. Keep the backup file separate from the device.'],
                    ['How do I restore my data?', 'Use the restore flow in Settings > Data & Storage. The app validates the backup and requires confirmation before applying it, and it creates a safety backup before restore.'],
                    ['What happens if I clear my browser data?', 'Browser clearing or loss of the browser profile can remove the locally stored records. For important business data, keep regular backups and avoid relying on a single browser profile as the only copy.'],
                    ['Is local authentication the same as server-side authentication?', 'No. Local sign-in is browser-local and is not server-side identity verification. Protect the device and browser profile because local access can grant access to the app and stored business records.'],
                    ['How can I contact support?', 'Use this support page to review the currently available channels. Email and Messenger support are not configured yet in the verified project setup, so they remain disabled until an official destination is provided and approved.'],
                  ].map(([question, answer]) => (
                    <details key={question} className="group rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-white [&::-webkit-details-marker]:hidden">
                        <span>{question}</span>
                        <ChevronDown aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-violet-700 transition-transform duration-200 group-open:rotate-180 dark:text-violet-300" strokeWidth={2} />
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          </article>
        </div>
        <PageFooter />
      </div>
    </main>
  );
}

export function LegalPolicyPage({ slug }: { slug: string }) {
  const policy = getLegalPolicy(slug);
  if (!policy) return null;
  if (policy.slug === 'contact') return <SupportContactPage />;
  const Icon = policy.icon;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B0B1B] dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/login" aria-label="XolveManager home" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            <ProductLogo size="compact" />
          </Link>
          <Link href="/legal" className={`${linkClass} inline-flex items-center gap-2 text-sm font-semibold`}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Legal Center
          </Link>
        </header>

        <nav aria-label="Breadcrumb" className="mt-8 text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
            <li><Link href="/legal" className={linkClass}>Legal &amp; Trust Center</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-slate-800 dark:text-slate-200">{policy.title}</li>
          </ol>
        </nav>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-12">
          <aside className="lg:sticky lg:top-6">
            <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 hover:border-violet-200 focus-within:border-violet-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800 lg:hidden" aria-label="Toggle legal section navigation">
              <summary aria-expanded="false" aria-controls="legal-page-nav-mobile" className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-white [&::-webkit-details-marker]:hidden">
                <span>On this page</span>
                <ChevronDown aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-violet-700 transition-transform duration-200 group-open:rotate-180 dark:text-violet-300" strokeWidth={2} />
              </summary>
              <div id="legal-page-nav-mobile" className="pt-3">
                <PolicyNavigation activeSlug={policy.slug} policy={policy} />
              </div>
            </details>
            <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
              <PolicyNavigation activeSlug={policy.slug} policy={policy} />
            </div>
          </aside>

          <article className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-200 p-5 sm:p-8 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <ReviewBadge state={policy.reviewState} />
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{policy.title}</h1>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {policy.reviewState === 'draft' ? 'Draft for owner review' : 'Technical disclosure reviewed'} · {LEGAL_POLICY_UPDATED_AT}
              </p>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{policy.introduction}</p>
            </header>

            {policy.reviewState === 'draft' && (
              <div role="note" className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 sm:mx-8">
                Draft only: owner confirmation and professional legal review may be required. This is not an established company policy.
              </div>
            )}
            {policy.slug === 'privacy' && (
              <div className="mx-5 mt-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100 sm:mx-8">
                <strong>Local-First:</strong> Business records stay in this browser profile and are not automatically synchronized to cloud servers. Maintain regular backups.
              </div>
            )}

            <div className="space-y-9 p-5 sm:p-8">
              {policy.sections.map(section => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-8">
                  <h2 id={`${section.id}-heading`} className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">{section.title}</h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                    {section.paragraphs.map((paragraph, index) => <p key={`${section.id}-p-${index}`}>{paragraph}</p>)}
                    {section.bullets && (
                      <ul className="list-disc space-y-2 pl-5">
                        {section.bullets.map(item => <li key={item}>{item}</li>)}
                      </ul>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
        <PageFooter />
      </div>
    </main>
  );
}

function PolicyNavigation({ activeSlug, policy }: { activeSlug: string; policy: LegalPolicy }) {
  return (
    <div className="grid gap-5">
      <nav aria-label="Legal documents" className="grid gap-1">
        <h2 className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Legal documents</h2>
        {legalPolicies.map(item => (
          <Link
            key={item.slug}
            href={`/legal/${item.slug}`}
            aria-current={item.slug === activeSlug ? 'page' : undefined}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-600 ${
              item.slug === activeSlug
                ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            {item.title}
          </Link>
        ))}
      </nav>
      <nav aria-label="On this policy" className="grid gap-1 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h2 className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">On this policy</h2>
        {policy.sections.map(section => (
          <Link
            key={section.id}
            href={`#${section.id}`}
            className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {section.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
