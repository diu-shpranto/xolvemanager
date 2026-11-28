import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import type { LandingLanguage } from './landingLanguage';

export interface ProductModulePreviewProps {
  title: string;
  icon: LucideIcon;
  focus: string;
  detail: string;
  previewType: 'dashboard' | 'customers' | 'services' | 'subscriptions' | 'sales' | 'invoices' | 'payments' | 'reports';
  language: LandingLanguage;
}

const previewContent: Record<
  ProductModulePreviewProps['previewType'],
  { imageSrc: string; imageAlt: string; imageAltBn: string }
> = {
  dashboard: {
    imageSrc: '/images/xolvemanager-preview-dashboard.png',
    imageAlt: 'Actual XolveManager dashboard with sample data, showing business summary cards and quick actions.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল ড্যাশবোর্ড — ব্যবসার সারাংশের কার্ড আর দ্রুত কাজের বোতাম।',
  },
  customers: {
    imageSrc: '/images/xolvemanager-preview-customers.png',
    imageAlt: 'Actual XolveManager customer list with sample data, showing customer records and activity totals.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল কাস্টমারের তালিকা — কাস্টমারের হিসাব আর মোট লেনদেন।',
  },
  services: {
    imageSrc: '/images/xolvemanager-preview-services.png',
    imageAlt: 'Actual XolveManager service catalog with sample data, showing services, prices, and active plans.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল সার্ভিসের তালিকা — সার্ভিস, দাম আর চালু প্ল্যান।',
  },
  subscriptions: {
    imageSrc: '/images/xolvemanager-preview-subscriptions.png',
    imageAlt: 'Actual XolveManager subscriptions screen with sample data, showing subscription statuses and renewals.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল সাবস্ক্রিপশনের পাতা — সাবস্ক্রিপশনের অবস্থা আর নবায়ন।',
  },
  sales: {
    imageSrc: '/images/xolvemanager-preview-sales.png',
    imageAlt: 'Actual XolveManager sales screen with sample data, showing sale totals and payment progress.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল বিক্রির পাতা — মোট বিক্রি আর টাকা পাওয়ার অগ্রগতি।',
  },
  invoices: {
    imageSrc: '/images/xolvemanager-preview-invoices.png',
    imageAlt: 'Actual XolveManager invoices screen with sample data, showing billed, collected, and outstanding amounts.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল ইনভয়েসের পাতা — বিল, পাওয়া টাকা আর বাকি টাকা।',
  },
  payments: {
    imageSrc: '/images/xolvemanager-preview-payments.png',
    imageAlt: 'Actual XolveManager payments screen with sample data, showing payment history and balances by method.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল পেমেন্টের পাতা — টাকার হিসাব আর মাধ্যম অনুযায়ী ব্যালান্স।',
  },
  reports: {
    imageSrc: '/images/xolvemanager-preview-reports.png',
    imageAlt: 'Actual XolveManager business report with sample data, showing recorded activity summaries.',
    imageAltBn: 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল ব্যবসার রিপোর্ট — লেখা হিসাবের সারাংশ।',
  },
};

export function ProductModulePreview({ title, icon: Icon, focus, detail, previewType, language }: ProductModulePreviewProps) {
  const preview = previewContent[previewType];

  return (
    <article className="group rounded-2xl border border-violet-100 bg-white p-3 shadow-sm shadow-violet-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/[0.07] motion-reduce:transform-none sm:p-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8F7FC]">
        <Image
          src={preview.imageSrc}
          alt={language === 'bn' ? preview.imageAltBn : preview.imageAlt}
          width={640}
          height={400}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
          className="block h-auto w-full"
        />
        <p className="border-t border-slate-200/80 px-2 py-1.5 text-[9px] font-medium text-slate-400">
          {language === 'bn' ? 'আসল স্ক্রিন · নমুনা হিসাব' : 'Actual screen · Sample data'}
        </p>
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{focus}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </article>
  );
}
