'use client';

import { useEffect, useState } from 'react';
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
import { HomepageNavigation } from './HomepageNavigation';
import { WorkflowWalkthrough } from './WorkflowWalkthrough';
import { ProductModulePreview } from './HomepagePreviews';
import { productBrand } from '../../config/brand';
import styles from '../../../app/homepage.module.css';
import {
  readStoredLandingLanguage,
  storeLandingLanguage,
  toBanglaDigits,
  type LandingLanguage,
} from './landingLanguage';

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${dark ? 'text-violet-300' : 'text-violet-700'}`}>
      {children}
    </p>
  );
}

export function HomepageContent() {
  const [language, setLanguage] = useState<LandingLanguage>('bn');

  useEffect(() => {
    setLanguage(readStoredLandingLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    const next: LandingLanguage = language === 'bn' ? 'en' : 'bn';
    storeLandingLanguage(next);
    setLanguage(next);
  };

  const t = (bn: string, en: string) => (language === 'bn' ? bn : en);
  const bn = language === 'bn';
  const year = new Date().getFullYear();

  const cloudSteps: Array<{ step: string; title: string; description: string; icon: LucideIcon }> = [
    {
      step: t('ধাপ ১', 'Step 1'),
      title: t('Google বা ইমেইল দিয়ে সাইন-ইন করুন', 'Sign in with Google or email'),
      description: t(
        'আপনার Google অ্যাকাউন্ট দিয়েই হবে, বা ইমেইল-পাসওয়ার্ড দিয়ে অ্যাকাউন্ট বানান। আলাদা কোনো অ্যাপ বসাতে হবে না।',
        'Use the Google account you already have, or create an account with an email and password. No separate app to install.'
      ),
      icon: LogIn,
    },
    {
      step: t('ধাপ ২', 'Step 2'),
      title: t('নিজে থেকেই সিঙ্ক হয়', 'Syncs automatically'),
      description: t(
        'সাইন-ইন থাকলে কিছু লিখলেই কয়েক সেকেন্ডের মধ্যে আপনার ক্লাউড অ্যাকাউন্টে উঠে যাবে। আপনার হিসাব আপনার অ্যাকাউন্ট ছাড়া আর কোথাও যায় না।',
        'When you are signed in, your records upload to your cloud account a few seconds after you change them. Nothing leaves your device except to your own account.'
      ),
      icon: RefreshCw,
    },
    {
      step: t('ধাপ ৩', 'Step 3'),
      title: t('যেকোনো ডিভাইসে ফিরে পাবেন', 'Restored on any device'),
      description: t(
        'অন্য ফোন বা কম্পিউটারে সাইন-ইন করলেই আপনার সব হিসাব নিজে থেকেই চলে আসবে। অ্যাকাউন্ট বদলালে প্রত্যেকে শুধু নিজের হিসাব দেখবে।',
        'Sign in on another device and your records are restored there automatically. Switch accounts, and each one shows only its own data.'
      ),
      icon: Download,
    },
  ];

  const features: Array<{ title: string; description: string; icon: LucideIcon }> = [
    {
      title: t('কাস্টমার ব্যবস্থাপনা', 'Customer Management'),
      description: t(
        'কাস্টমারের সব তথ্য — বিক্রি, সাবস্ক্রিপশন, ইনভয়েস আর টাকার হিসাব — একসাথে থাকে।',
        'Keep customer details connected to sales, subscriptions, invoices, and payment history.'
      ),
      icon: UsersRound,
    },
    {
      title: t('সার্ভিস আর প্ল্যান', 'Services and Plans'),
      description: t(
        'আপনার সার্ভিস আর প্ল্যানগুলো দাম আর মেয়াদসহ সাজিয়ে রাখুন।',
        'Organize the services and plans you offer, including their prices and durations.'
      ),
      icon: Layers3,
    },
    {
      title: t('সাবস্ক্রিপশনের হিসাব', 'Subscription Tracking'),
      description: t(
        'সাবস্ক্রিপশনের মেয়াদ, অবস্থা, নবায়নের তারিখ আর কবে শেষ হবে — সব দেখুন।',
        'Review subscription periods, statuses, renewal dates, and upcoming expiries.'
      ),
      icon: CalendarClock,
    },
    {
      title: t('বিক্রির হিসাব', 'Sales Management'),
      description: t(
        'কাস্টমার আর সার্ভিস অনুযায়ী বিক্রির হিসাব লিখুন আর দেখুন।',
        'Create and review sales records for your customers and services.'
      ),
      icon: ShoppingCart,
    },
    {
      title: t('ইনভয়েসের হিসাব', 'Invoice Management'),
      description: t(
        'ইনভয়েস আর তার বাকি টাকা বিক্রির সাথেই জোড়া থাকে।',
        'Keep invoices and their balances connected to the related sale.'
      ),
      icon: FileText,
    },
    {
      title: t('টাকা পাওয়ার হিসাব', 'Payment Tracking'),
      description: t(
        'bKash, নগদ বা ব্যাংকে পাওয়া টাকা লিখে রাখুন, আর কত বাকি আছে দেখুন।',
        'Record payments received through other means and review what remains due.'
      ),
      icon: CreditCard,
    },
    {
      title: t('আংশিক পেমেন্ট', 'Partial Payments'),
      description: t(
        'টাকা কিস্তিতে পেলে ধাপে ধাপে লিখুন — বাকি কত আছে সবসময় চোখে থাকবে।',
        'Record payments in stages and keep the remaining sale balance visible.'
      ),
      icon: CircleDollarSign,
    },
    {
      title: t('অগ্রিম টাকা', 'Advance Credit'),
      description: t(
        'কাস্টমার আগাম টাকা দিলে লিখে রাখুন, পরে বিক্রির বাকি থেকে কেটে নিন।',
        'Record customer advance credit and apply it to eligible sales.'
      ),
      icon: RefreshCw,
    },
    {
      title: t('কাস্টমারের খাতা', 'Customer Ledger'),
      description: t(
        'একজন কাস্টমারের পুরো হিসাব — ইনভয়েস, পেমেন্ট, অগ্রিম আর বাকি — এক পাতায় দেখুন।',
        'Review a customer statement with invoices, payments, credits, and balances.'
      ),
      icon: BookOpenText,
    },
    {
      title: t('ব্যবসার রিপোর্ট', 'Business Reports'),
      description: t(
        'বিক্রি, পেমেন্ট, সাবস্ক্রিপশন — সব হিসাবের রিপোর্ট দেখুন।',
        'Review sales, payments, subscriptions, and other recorded business activity.'
      ),
      icon: ChartNoAxesCombined,
    },
    {
      title: t('অ্যাকাউন্ট আর প্রোফাইল', 'Accounts and Profiles'),
      description: t(
        'সার্ভিসের অ্যাকাউন্ট আর তার প্রোফাইলগুলো সার্ভিসের পাশেই সাজিয়ে রাখুন।',
        'Organize service accounts and their available profiles alongside your services.'
      ),
      icon: LockKeyhole,
    },
    {
      title: t('আলাদা আলাদা হিসাব', 'Separate Workspaces'),
      description: t(
        'প্রতিটা ক্লাউড অ্যাকাউন্টের হিসাব আলাদা থাকে। অ্যাকাউন্ট বদলালে শুধু সেই অ্যাকাউন্টের হিসাব দেখবেন।',
        'Each cloud account has its own workspace. Switching accounts switches the records you see.'
      ),
      icon: ShieldCheck,
    },
    {
      title: t('নিজে থেকে সিঙ্ক আর ব্যাকআপ', 'Automatic Sync & Backup'),
      description: t(
        'সাইন-ইন থাকলে আপনার হিসাব নিজে থেকেই ক্লাউডে উঠে যায়, আর যেকোনো সময় ব্যাকআপ ফাইল ডাউনলোড করে রাখতে পারবেন।',
        'Your records sync to your cloud account automatically when you are signed in, and you can download a backup file any time.'
      ),
      icon: ArchiveRestore,
    },
  ];

  const productModules = [
    {
      title: t('ড্যাশবোর্ড', 'Dashboard'),
      icon: ChartNoAxesCombined,
      focus: t('ব্যবসার এক নজরে সারাংশ', 'A quick business overview'),
      detail: t('আপনার হিসাবের সারাংশ এক পাতায় দেখুন।', 'See a summary of the activity recorded in your workspace.'),
      previewType: 'dashboard' as const,
    },
    {
      title: t('কাস্টমার', 'Customers'),
      icon: UsersRound,
      focus: t('কাস্টমারের হিসাব এক জায়গায়', 'Customer records in one place'),
      detail: t('কাস্টমারের তথ্য খুঁজুন, আর তার সব লেনদেন দেখুন।', 'Find customer details and review their related activity.'),
      previewType: 'customers' as const,
    },
    {
      title: t('সার্ভিস', 'Services'),
      icon: Layers3,
      focus: t('সার্ভিস আর প্ল্যান', 'Services and plans'),
      detail: t('সার্ভিস, প্ল্যান, দাম আর মেয়াদ সাজিয়ে রাখুন।', 'Organize service details, plans, prices, and durations.'),
      previewType: 'services' as const,
    },
    {
      title: t('সাবস্ক্রিপশন', 'Subscriptions'),
      icon: CalendarClock,
      focus: t('সাবস্ক্রিপশনের মেয়াদ আর অবস্থা', 'Subscription periods and status'),
      detail: t('মেয়াদ, শেষের তারিখ আর অবস্থা দেখুন।', 'Review terms, expiry dates, and subscription status.'),
      previewType: 'subscriptions' as const,
    },
    {
      title: t('বিক্রি', 'Sales'),
      icon: ShoppingCart,
      focus: t('বিক্রি আর টাকা পাওয়ার অগ্রগতি', 'Sales and payment progress'),
      detail: t('বিক্রি, বাকি টাকা আর পাওয়া টাকা দেখুন।', 'Review sales, amounts due, and recorded payments.'),
      previewType: 'sales' as const,
    },
    {
      title: t('ইনভয়েস', 'Invoices'),
      icon: ReceiptText,
      focus: t('বিক্রির সাথে জোড়া ইনভয়েস', 'Invoices linked to sales'),
      detail: t('ইনভয়েসের বিবরণ আর বাকি টাকা প্রতিটা বিক্রির সাথেই থাকে।', 'Keep invoice details and balances connected to each sale.'),
      previewType: 'invoices' as const,
    },
    {
      title: t('পেমেন্ট', 'Payments'),
      icon: CreditCard,
      focus: t('আপনার লেখা টাকার হিসাব', 'Payments recorded by you'),
      detail: t('পাওয়া টাকা আর কিস্তির অগ্রগতি দেখুন।', 'Track received payments and partial-payment progress.'),
      previewType: 'payments' as const,
    },
    {
      title: t('রিপোর্ট', 'Reports'),
      icon: ChartNoAxesCombined,
      focus: t('লেখা হিসাব বুঝে নিন', 'Understand recorded activity'),
      detail: t('রিপোর্ট আর সারাংশ দিয়ে ব্যবসার হিসাব দেখুন।', 'Review business records through reports and summaries.'),
      previewType: 'reports' as const,
    },
  ];

  const faqs = [
    {
      question: t('XolveManager কী?', 'What is XolveManager?'),
      answer: t(
        'XolveManager হলো কাস্টমার, সার্ভিস, সাবস্ক্রিপশন, বিক্রি, ইনভয়েস আর টাকার হিসাব এক জায়গায় গুছিয়ে রাখার একটা অ্যাপ।',
        'XolveManager is a workspace for organizing customer, service, subscription, sales, invoice, and payment records in one place.'
      ),
    },
    {
      question: t('কে ব্যবহার করতে পারবে?', 'Who can use XolveManager?'),
      answer: t(
        'ছোট সার্ভিস ব্যবসা, সাবস্ক্রিপশন বিক্রেতা, ফ্রিল্যান্সার আর ছোট টিম — ব্যবসার হিসাব গোছাতে চায় যারা, তাদের জন্য।',
        'It is designed for small service businesses, subscription providers, freelancers, and small teams who want to organize their business records.'
      ),
    },
    {
      question: t('অ্যাকাউন্ট কীভাবে বানাব?', 'How do I create an account?'),
      answer: t(
        '“ফ্রি অ্যাকাউন্ট বানান” চাপুন, তারপর Google অ্যাকাউন্ট বা ইমেইল-পাসওয়ার্ড দিয়ে সাইন-আপ করুন। আপনার ক্লাউড অ্যাকাউন্টেই হিসাব থাকবে, আর যেকোনো ডিভাইসে একই অ্যাকাউন্ট দিয়ে ঢুকতে পারবেন।',
        'Choose “Create Free Account”, then sign up with your Google account or an email and password. Your cloud account keeps your records, and you can sign in with the same account on any device.'
      ),
    },
    {
      question: t('অন্য ডিভাইসে হিসাব কীভাবে দেখব?', 'How do I see my records on another device?'),
      answer: t(
        'অন্য ডিভাইসে XolveManager খুলে একই Google অ্যাকাউন্ট বা ইমেইল দিয়ে সাইন-ইন করুন। আপনার হিসাব নিজে থেকেই চলে আসবে। সেটিংস থেকে নিজে ডাউনলোডও করতে পারবেন।',
        'Open XolveManager on the other device and sign in with the same Google account or email. Your records are restored automatically. You can also download them manually from Settings.'
      ),
    },
    {
      question: t('আমার হিসাব কি নিজে থেকেই সিঙ্ক হবে?', 'Does my data sync automatically?'),
      answer: t(
        'হ্যাঁ। সাইন-ইন থাকলে কিছু লিখলেই কয়েক সেকেন্ডের মধ্যে আপনার ক্লাউড অ্যাকাউন্টে উঠে যাবে, আর অন্য ডিভাইসে সাইন-ইন করলে সেখানেও চলে আসবে।',
        'Yes. When you are signed in, your changes upload to your cloud account a few seconds after you make them, and signing in on another device restores them there.'
      ),
    },
    {
      question: t('আমার হিসাব কি অন্য কেউ দেখতে পারবে?', 'Can someone else see my records?'),
      answer: t(
        'না। প্রতিটা অ্যাকাউন্টের হিসাব আলাদা। অন্য অ্যাকাউন্ট দিয়ে ঢুকলে শুধু সেই অ্যাকাউন্টের হিসাবই দেখা যাবে।',
        'No. Each account has its own workspace. Signing in with a different account shows only that account’s records.'
      ),
    },
    {
      question: t('XolveManager কি অফলাইনে চলবে?', 'Does XolveManager work offline?'),
      answer: t(
        'একবার অনলাইনে অ্যাপ খুললে ওই ডিভাইসের হিসাব অফলাইনেও দেখা যাবে। হিসাব আপলোড বা ডাউনলোড করতে ইন্টারনেট লাগবে।',
        'After you open the app once while online, the records on that device stay available offline. Uploading or downloading your records needs an internet connection.'
      ),
    },
    {
      question: t('XolveManager দিয়ে কি কাস্টমারের টাকা নেওয়া যাবে?', 'Can XolveManager process customer payments?'),
      answer: t(
        'না। bKash, নগদ বা ব্যাংকে যে টাকা পেয়েছেন, XolveManager শুধু তার হিসাব রাখে। এটা পেমেন্ট নেওয়ার মাধ্যম নয়, কাস্টমারের কাছ থেকে টাকা কাটে না।',
        'No. XolveManager records payments you have received through other means. It is not a payment gateway and does not charge customers.'
      ),
    },
    {
      question: t('হিসাবের ব্যাকআপ কীভাবে নেব?', 'How do I back up my data?'),
      answer: t(
        'সেটিংসে গিয়ে ব্যাকআপ টুল দিয়ে ফাইল ডাউনলোড করে নিরাপদ জায়গায় রাখুন। ক্লাউড অ্যাকাউন্টে উঠলে আরেকটা কপিও থাকে, পরে ডাউনলোড করতে পারবেন। ব্রাউজারের ডেটা মুছলে শুধু ওই ডিভাইসের হিসাব মুছে যেতে পারে, তাই ব্যাকআপ রাখুন।',
        'Use the backup tools in Settings to download a backup file and store it somewhere safe. Uploading to your cloud account keeps another copy you can download later. Clearing browser data can remove records that exist only on that device, so keep a backup.'
      ),
    },
  ];

  const privacyPoints = [
    {
      title: t('অ্যাকাউন্ট অনুযায়ী আলাদা', 'Separate by account'),
      description: t(
        'প্রতিটা অ্যাকাউন্টের হিসাব আলাদা। অ্যাকাউন্ট বদলালে সেই অ্যাকাউন্টের হিসাবই দেখবেন।',
        'Every account has its own workspace. Switching accounts switches the records you see.'
      ),
      icon: ShieldCheck,
    },
    {
      title: t('নিজে থেকে সিঙ্ক, তবুও গোপন', 'Automatic sync, private by default'),
      description: t(
        'সাইন-ইন থাকলে আপনার হিসাব নিজে থেকেই আপনার ক্লাউড অ্যাকাউন্টে যায় — আর শুধু আপনার অ্যাকাউন্টই তা দেখতে পারে।',
        'Your records sync to your own cloud account automatically when you are signed in — and only your account can see them.'
      ),
      icon: Upload,
    },
    {
      title: t('ব্যাকআপ আপনার হাতে', 'Backup you control'),
      description: t(
        'যখন খুশি ব্যাকআপ ফাইল ডাউনলোড করুন, আপনার পছন্দের জায়গায় রাখুন।',
        'Download a backup file whenever you like and store it where you choose.'
      ),
      icon: ArchiveRestore,
    },
  ];

  return (
    <div className={styles.homepage}>
      <HomepageNavigation language={language} onToggleLanguage={toggleLanguage} />
      <main className="scroll-smooth motion-reduce:scroll-auto">
        {/* Hero */}
        <section className={`relative overflow-hidden bg-gradient-to-b from-violet-100 via-[#F8F7FF] to-white ${styles.sectionReveal}`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(124,58,237,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-violet-300/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-40%] left-[-8%] h-80 w-80 rounded-full bg-fuchsia-200/30 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-8 sm:py-20 lg:py-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-violet-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-violet-600" aria-hidden="true" />
              {t('ক্লাউড অ্যাকাউন্ট · যেকোনো ডিভাইসে চলবে', 'Cloud account · Works on any device')}
            </p>
            <h1 className="mx-auto mt-5 max-w-3xl text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.75rem]">
              {t('ফেসবুকের কাস্টমার, সাবস্ক্রিপশন আর বিক্রি', 'Manage customers, subscriptions & sales')}{' '}
              <span className="bg-gradient-to-r from-violet-600 via-[#6d28d9] to-blue-600 bg-clip-text text-transparent">
                {t('— সব হিসাব এক জায়গায়।', '— on any device.')}
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {t(
                'Google বা ইমেইল দিয়ে সাইন-ইন করুন। ইনবক্সের অর্ডার, bKash-এ পাওয়া টাকা, কার কত বাকি — সব হিসাব আপনার অ্যাকাউন্টেই থাকবে, যেকোনো ডিভাইসে।',
                'Sign in with Google or email, and your business records follow your account — not just one browser.'
              )}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
              <Link href="/signup" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-[#6d28d9] to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-900/25 transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 motion-reduce:transform-none min-[420px]:w-auto">
                {t('ফ্রিতে শুরু করুন', 'Get started free')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-300 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 min-[420px]:w-auto">
                {t('সাইন-ইন করুন', 'Sign in')}
              </Link>
            </div>
            <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 text-left text-sm font-medium text-slate-700 lg:grid-cols-4">
              {[
                { label: t('Google বা ইমেইল দিয়ে সাইন-ইন', 'Sign in with Google or email'), icon: LogIn },
                { label: t('হিসাব থাকে আপনার অ্যাকাউন্টেই', 'Your data follows your account'), icon: Smartphone },
                { label: t('প্রতিটা অ্যাকাউন্ট দেখে শুধু নিজের হিসাব', 'Each account sees only its own data'), icon: ShieldCheck },
                { label: t('একবার খুললেই অফলাইনেও চলবে', 'Works offline after first load'), icon: WifiOff },
              ].map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white/80 p-3.5 shadow-sm shadow-violet-950/[0.03]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
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
              <Eyebrow>{t('আপনার ক্লাউড অ্যাকাউন্ট', 'Your cloud account')}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {t('একবার সাইন-ইন করলেই হবে। ব্যবসার হিসাব যাবে আপনার সাথে।', 'Sign in once. Your business follows you.')}
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                {t(
                  'Google অ্যাকাউন্ট বা ইমেইল-পাসওয়ার্ড দিয়ে ক্লাউড অ্যাকাউন্ট বানান। আপনার হিসাব আপনার অ্যাকাউন্টেরই — প্রতিটা অ্যাকাউন্টের হিসাব আলাদা জায়গায় থাকে।',
                  'Create a cloud account with your Google account or an email and password. Your records belong to your account, and each account has its own separate workspace.'
                )}
              </p>
            </div>
            <div className="relative mt-10 grid gap-4 md:grid-cols-3">
              <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-9 hidden h-0.5 bg-gradient-to-r from-violet-200 via-violet-300 to-violet-200 md:block" />
              {cloudSteps.map(({ step, title, description, icon: Icon }) => (
                <article key={title} className="relative rounded-3xl border border-violet-100 bg-[#F8FBFF] p-6 text-center sm:p-7">
                  <span className="relative mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-4 border-white bg-gradient-to-br from-violet-600 to-blue-700 text-white shadow-lg shadow-violet-900/20">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">{step}</p>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <WorkflowWalkthrough language={language} />

        <section id="features" className="scroll-mt-24 bg-[#F0F7FF] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow>{t('এক জায়গায় সব হিসাব', 'Everything in one workspace')}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {t('প্রতিদিনের ব্যবসার হিসাব, একসাথে গোছানো', 'Everyday Business Records, Organized Together')}
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                {t(
                  'প্রথম কাস্টমার লেখা থেকে টাকার হিসাব আর রিপোর্ট — সব এক জায়গায়, যেকোনো ডিভাইসে সাইন-ইন করলেই পাবেন।',
                  'Keep related records in one workspace, from the first customer entry to payment tracking and reporting — available wherever you sign in.'
                )}
              </p>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, description, icon: Icon }) => (
                <article key={title} className="group rounded-3xl border border-violet-100 bg-white p-5 shadow-sm shadow-violet-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-950/[0.08] motion-reduce:transform-none sm:p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-700 text-white shadow-md shadow-violet-900/20 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
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
              <Eyebrow>{t('অ্যাপের ভেতরটা দেখে নিন', 'A look around the workspace')}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {t('যেসব টুল ব্যবহার করবেন, তার এক ঝলক', 'A Preview of the Tools You Will Use')}
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {t(
                  'এগুলো অ্যাপের আসল স্ক্রিনশট, নমুনা হিসাব দিয়ে দেখানো। যেকোনো ডিভাইসে সাইন-ইন করলেই একই স্ক্রিন পাবেন। অ্যাপ বদলালে স্ক্রিনও কিছুটা বদলাতে পারে।',
                  'These are real screenshots from the app, using sample records. The same screens open on any device you sign in from. Actual screens may change as the app evolves.'
                )}
              </p>
            </div>
            <div className="relative mx-auto mt-10 w-full max-w-4xl">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[3rem] bg-violet-300/40 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl shadow-violet-950/15 sm:rounded-3xl">
                <Image
                  src="/images/xolvemanager-dashboard-showcase.png"
                  alt={t(
                    'XolveManager-এর ড্যাশবোর্ড — ব্যবসার সারাংশ, মেনু আর দ্রুত কাজের বোতাম, নমুনা হিসাব দিয়ে দেখানো।',
                    'XolveManager dashboard showing business summaries, workspace navigation, and quick actions, with sample data.'
                  )}
                  width={1400}
                  height={720}
                  sizes="(max-width: 1023px) 100vw, 896px"
                  className="h-auto w-full"
                />
              </div>
              <div className="relative -mt-5 ml-4 flex max-w-xs items-center gap-2.5 rounded-2xl border border-violet-100 bg-white/95 px-4 py-3 shadow-lg shadow-violet-950/10 backdrop-blur sm:ml-8">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs font-semibold leading-5 text-slate-700">
                  {t('আপনার অ্যাকাউন্ট · হিসাব থাকবে আপনার সাথেই', 'Your account · Your data follows you')}
                </p>
              </div>
              <div className="relative mt-5 flex flex-wrap justify-center gap-2">
                {[
                  t('কাস্টমার যোগ করুন', 'Add Customers'),
                  t('সার্ভিস আর প্ল্যান বানান', 'Create Services and Plans'),
                  t('সাবস্ক্রিপশনের হিসাব রাখুন', 'Track Subscriptions'),
                  t('বিক্রি আর টাকার হিসাব লিখুন', 'Record Sales and Payments'),
                ].map(label => (
                  <span key={label} className="rounded-full border border-violet-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm sm:text-xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {productModules.map(module => <ProductModulePreview key={module.title} {...module} language={language} />)}
            </div>
          </div>
        </section>

        <section id="privacy-data" className="scroll-mt-24 bg-violet-950 py-16 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow dark>{t('গোপনীয়তা আর বিশ্বাস', 'Privacy & trust')}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t('আপনার হিসাব আপনারই।', 'Your data is yours.')}
              </h2>
              <p className="mt-5 leading-7 text-violet-100/85">
                {t(
                  'আপনার হিসাব আপনার ক্লাউড অ্যাকাউন্টেরই। প্রতিটা অ্যাকাউন্টের হিসাব আলাদা, তাই অন্য কেউ আপনার হিসাব দেখতে পারে না। সাইন-ইন থাকলে আপনার হিসাব নিজে থেকেই আপনার ক্লাউড অ্যাকাউন্টে যায় — শুধু আপনার অ্যাকাউন্টেই।',
                  'Your records belong to your cloud account. Each account has its own workspace, so another account never sees your data. When you are signed in, your records sync to your cloud account automatically — and only to your account.'
                )}
              </p>
              <p className="mt-4 text-sm leading-6 text-violet-200/80">
                {t(
                  'যেকোনো সময় পুরো হিসাবের ব্যাকআপ ফাইল ডাউনলোড করে রাখতে পারবেন। ব্রাউজারের ডেটা মুছলে শুধু ওই ডিভাইসের হিসাব মুছে যেতে পারে, তাই ব্যাকআপ রাখুন।',
                  'You can also download a full backup file any time. Clearing browser data can remove records that exist only on that device, so keep a backup.'
                )}
              </p>
              <Link href="/legal/privacy" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-violet-300 underline-offset-4 transition hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                {t('গোপনীয়তা আর ডেটার নোটিশ পড়ুন', 'Read the Privacy & Data Notice')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
                {t(
                  'XolveManager শুধু অন্য মাধ্যমে পাওয়া টাকার হিসাব রাখে; কাস্টমারের কাছ থেকে টাকা নেয় না, আর সাবস্ক্রিপশনের বিলও নিজে থেকে কাটে না।',
                  'XolveManager records payments made through other means; it does not process customer payments or automatically bill subscriptions.'
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <Eyebrow>{t('এটা কাদের জন্য', 'Who it is for')}</Eyebrow>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  {t('নিজের ব্যবসার হিসাব নিজে রাখেন যারা, তাদের জন্য', 'Made for People Who Manage the Details Themselves')}
                </h2>
                <p className="mt-4 leading-7 text-slate-600">
                  {t(
                    'কাস্টমার, সার্ভিসের প্ল্যান, সাবস্ক্রিপশন, বিক্রি বা টাকার হিসাব — যেকোনো একটা রাখলেও XolveManager সেসব এক জায়গায় গুছিয়ে দেবে।',
                    'If you keep track of customers, service plans, subscriptions, sales, or payments, XolveManager can help organize those records in a single workspace.'
                  )}
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  t('ছোট সার্ভিস ব্যবসা — ফেসবুকে বিক্রি করেন যারা', 'Small service businesses organizing customers and offerings'),
                  t('সাবস্ক্রিপশন বিক্রি করেন যারা — মেয়াদ আর নবায়নের হিসাব রাখতে', 'Subscription providers tracking periods and renewals'),
                  t('ফ্রিল্যান্সার — কাস্টমার আর বিক্রির হিসাব রাখতে', 'Freelancers managing customer and sales records'),
                  t('ছোট টিম — টাকা আর ইনভয়েসের হিসাব একসাথে রাখতে', 'Small teams keeping payment and invoice records together'),
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

        <section id="faq" className="scroll-mt-24 bg-[#F0F7FF] py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <Eyebrow>{t('দরকারি উত্তর', 'Helpful answers')}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {t('সচরাচর জিজ্ঞাসা', 'Frequently Asked Questions')}
              </h2>
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
            <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-[-5%] h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-[-5%] h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div className="relative">
              <Eyebrow dark>{t('আপনার হিসাবের শুরু এখানেই', 'Your workspace starts here')}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t('ব্যবসা গোছাতে তৈরি তো? — যেকোনো ডিভাইসে।', 'Ready to organize your business — on any device?')}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl leading-7 text-violet-100">
                {t(
                  'ফ্রি ক্লাউড অ্যাকাউন্ট বানান, আর কাস্টমার, সার্ভিস আর বিক্রি দিয়ে শুরু করুন।',
                  'Create your free cloud account and start with your customers, services, and sales.'
                )}
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 min-[420px]:flex-row">
                <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-violet-900 transition hover:-translate-y-0.5 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white motion-reduce:transform-none">
                  {t('ফ্রি অ্যাকাউন্ট বানান', 'Create Free Account')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
                  {t('সাইন-ইন করুন', 'Sign in')}
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
                {t(
                  'কাস্টমার, সার্ভিস, সাবস্ক্রিপশন, বিক্রি, ইনভয়েস আর টাকার হিসাব গোছানোর জায়গা — ক্লাউড অ্যাকাউন্ট আপনার সাথেই থাকবে।',
                  'A workspace for organizing customers, services, subscriptions, sales, invoices, and recorded payments — with a cloud account that follows you.'
                )}
              </p>
              <p className="mt-3 text-xs font-semibold text-slate-500">XolveKart → XolveManager</p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('ঘুরে দেখুন', 'Explore')}</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><a href="#features" className="transition-colors hover:text-violet-800">{t('সুবিধা', 'Features')}</a></li>
                <li><a href="#how-it-works" className="transition-colors hover:text-violet-800">{t('কীভাবে কাজ করে', 'How it works')}</a></li>
                <li><a href="#faq" className="transition-colors hover:text-violet-800">{t('সচরাচর জিজ্ঞাসা', 'FAQ')}</a></li>
                <li><a href="#privacy-data" className="transition-colors hover:text-violet-800">{t('গোপনীয়তা আর ডেটা', 'Privacy & Data')}</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('ডেটা আর বিশ্বাস', 'Data & Trust')}</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><Link href="/legal/data-backup" className="transition-colors hover:text-violet-800">{t('ডেটা আর ব্যাকআপ', 'Data & Backup')}</Link></li>
                <li><Link href="/legal" className="transition-colors hover:text-violet-800">{t('আইনি আর বিশ্বাসের পাতা', 'Legal & Trust Center')}</Link></li>
                <li><Link href="/legal/privacy" className="transition-colors hover:text-violet-800">{t('গোপনীয়তা নীতি', 'Privacy Policy')}</Link></li>
                <li><Link href="/support" className="transition-colors hover:text-violet-800">{t('যোগাযোগ আর সাহায্য', 'Contact & Support')}</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('আপনার অ্যাকাউন্ট', 'Your Account')}</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li><Link href="/login" className="transition-colors hover:text-violet-800">{t('সাইন-ইন করুন', 'Sign in')}</Link></li>
                <li><Link href="/signup" className="transition-colors hover:text-violet-800">{t('ফ্রি অ্যাকাউন্ট বানান', 'Create Free Account')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-9 flex justify-center border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500">
            <span>
              {bn
                ? `© ${toBanglaDigits(year)} ${productBrand.name}। সর্বস্বত্ব সংরক্ষিত।`
                : `© ${year} ${productBrand.name}. All rights reserved.`}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
