import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';

export interface ProductModulePreviewProps {
  title: string;
  icon: LucideIcon;
  focus: string;
  detail: string;
  previewType: 'dashboard' | 'customers' | 'services' | 'subscriptions' | 'sales' | 'invoices' | 'payments' | 'reports';
}

const previewContent: Record<ProductModulePreviewProps['previewType'], { imageSrc: string; imageAlt: string }> = {
  dashboard: {
    imageSrc: '/images/xolvemanager-preview-dashboard.png',
    imageAlt: 'Actual XolveManager dashboard with sample data, showing business summary cards and quick actions.',
  },
  customers: {
    imageSrc: '/images/xolvemanager-preview-customers.png',
    imageAlt: 'Actual XolveManager customer list with sample data, showing customer records and activity totals.',
  },
  services: {
    imageSrc: '/images/xolvemanager-preview-services.png',
    imageAlt: 'Actual XolveManager service catalog with sample data, showing services, prices, and active plans.',
  },
  subscriptions: {
    imageSrc: '/images/xolvemanager-preview-subscriptions.png',
    imageAlt: 'Actual XolveManager subscriptions screen with sample data, showing subscription statuses and renewals.',
  },
  sales: {
    imageSrc: '/images/xolvemanager-preview-sales.png',
    imageAlt: 'Actual XolveManager sales screen with sample data, showing sale totals and payment progress.',
  },
  invoices: {
    imageSrc: '/images/xolvemanager-preview-invoices.png',
    imageAlt: 'Actual XolveManager invoices screen with sample data, showing billed, collected, and outstanding amounts.',
  },
  payments: {
    imageSrc: '/images/xolvemanager-preview-payments.png',
    imageAlt: 'Actual XolveManager payments screen with sample data, showing payment history and balances by method.',
  },
  reports: {
    imageSrc: '/images/xolvemanager-preview-reports.png',
    imageAlt: 'Actual XolveManager business report with sample data, showing recorded activity summaries.',
  },
};

export function ProductModulePreview({ title, icon: Icon, focus, detail, previewType }: ProductModulePreviewProps) {
  const preview = previewContent[previewType];

  return (
    <article className="group rounded-2xl border border-violet-100 bg-white p-3 shadow-sm shadow-violet-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-950/[0.07] motion-reduce:transform-none sm:p-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8F7FC]">
        <Image
          src={preview.imageSrc}
          alt={preview.imageAlt}
          width={640}
          height={400}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
          className="block h-auto w-full"
        />
        <p className="border-t border-slate-200/80 px-2 py-1.5 text-[9px] font-medium text-slate-400">Actual screen · Sample data</p>
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{focus}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </article>
  );
}
