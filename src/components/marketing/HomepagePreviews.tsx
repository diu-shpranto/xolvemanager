import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CalendarClock,
  ChartNoAxesCombined,
  CreditCard,
  Layers3,
  MoreHorizontal,
  ReceiptText,
  Search,
  ShoppingCart,
  UsersRound,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ProductModulePreviewProps {
  title: string;
  icon: LucideIcon;
  focus: string;
  detail: string;
  previewType: 'dashboard' | 'customers' | 'services' | 'subscriptions' | 'sales' | 'invoices' | 'payments' | 'reports';
}

function PreviewToolbar({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[9px] font-bold text-slate-700">{title}</span>
        <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[7px] font-semibold text-blue-700">Preview</span>
      </div>
      <span className="shrink-0 rounded-md bg-blue-700 px-2 py-1 text-[7px] font-bold text-white">{action}</span>
    </div>
  );
}

function DashboardMini() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Customers', icon: UsersRound, color: 'text-blue-700', value: '24' },
          { label: 'Subscriptions', icon: CalendarClock, color: 'text-blue-700', value: '12' },
          { label: 'Sales', icon: Banknote, color: 'text-emerald-700', value: '08' },
        ].map(({ label, icon: Icon, color, value }) => (
          <div key={label} className="rounded-lg border border-slate-100 bg-white p-1.5">
            <Icon className={`h-3 w-3 ${color}`} aria-hidden="true" />
            <p className="mt-1 text-[7px] font-medium text-slate-500">{label}</p>
            <p className="text-[11px] font-extrabold text-slate-800">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-2">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold text-slate-700">Business activity</span>
          <span className="text-[7px] text-slate-400">Sample view</span>
        </div>
        <div className="mt-2 flex h-10 items-end gap-1">
          {[35, 54, 43, 76, 57, 91, 67, 82, 61, 96, 73, 88].map((height, index) => (
            <span key={index} className="w-full rounded-t-sm bg-blue-200" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomersMini() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1.5">
        <span className="text-[8px] font-bold text-slate-700">Customer list</span>
        <Search className="h-3 w-3 text-slate-400" aria-hidden="true" />
      </div>
      {[
        ['SA', 'Sample customer A', 'Active'],
        ['SB', 'Sample customer B', 'Active'],
        ['SC', 'Sample customer C', 'New'],
      ].map(([initials, name, status], index) => (
        <div key={name} className={`flex items-center gap-1.5 px-2 py-1.5 ${index ? 'border-t border-slate-50' : ''}`}>
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[7px] font-bold ${index === 1 ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'}`}>{initials}</span>
          <span className="min-w-0 flex-1 truncate text-[7px] font-semibold text-slate-600">{name}</span>
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[6px] font-semibold text-emerald-700">{status}</span>
        </div>
      ))}
    </div>
  );
}

function ServicesMini() {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[
        ['Streaming', 'Monthly plan', 'bg-blue-100 text-blue-700'],
        ['Productivity', 'Annual plan', 'bg-sky-100 text-sky-700'],
        ['Design tools', 'Team plan', 'bg-sky-100 text-sky-700'],
        ['AI tools', 'Flexible plan', 'bg-amber-100 text-amber-700'],
      ].map(([name, plan, color]) => (
        <div key={name} className="rounded-lg border border-slate-100 bg-white p-2">
          <span className={`grid h-6 w-6 place-items-center rounded-md ${color}`}><Layers3 className="h-3 w-3" aria-hidden="true" /></span>
          <p className="mt-1 text-[7px] font-bold text-slate-700">{name}</p>
          <p className="text-[6px] text-slate-500">{plan}</p>
        </div>
      ))}
    </div>
  );
}

function SubscriptionsMini() {
  return (
    <div className="space-y-1.5">
      {[
        ['Active', 'bg-emerald-100 text-emerald-700', 82],
        ['Renewing soon', 'bg-amber-100 text-amber-700', 58],
        ['Completed', 'bg-slate-100 text-slate-600', 100],
      ].map(([label, color, progress]) => (
        <div key={label as string} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-semibold text-slate-600">{label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-bold ${color}`}>{label}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <span className={`block h-full rounded-full ${label === 'Active' ? 'bg-blue-500' : label === 'Renewing soon' ? 'bg-amber-400' : 'bg-slate-300'}`} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[6px] text-slate-400"><CalendarDays className="h-2.5 w-2.5" aria-hidden="true" />Subscription period</div>
        </div>
      ))}
    </div>
  );
}

function SalesMini() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-100 bg-slate-50 px-2 py-1.5 text-[6px] font-bold uppercase text-slate-400">
        <span>Sale</span><span>Payment</span><span>Status</span>
      </div>
      {[
        ['Sample sale A', 'Recorded', 'Paid'],
        ['Sample sale B', 'Partial', 'Due'],
        ['Sample sale C', 'Recorded', 'Paid'],
      ].map(([sale, payment, status], index) => (
        <div key={sale} className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-2 ${index ? 'border-t border-slate-50' : ''}`}>
          <div className="flex min-w-0 items-center gap-1"><ShoppingCart className="h-3 w-3 shrink-0 text-blue-600" aria-hidden="true" /><span className="truncate text-[7px] font-semibold text-slate-600">{sale}</span></div>
          <span className="text-[6px] text-slate-500">{payment}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-bold ${status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status}</span>
        </div>
      ))}
    </div>
  );
}

function InvoicesMini() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-100 bg-white p-2.5">
      <div className="absolute right-2 top-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[6px] font-bold text-amber-700">BALANCE DUE</div>
      <div className="flex items-center gap-1.5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-100 text-blue-700"><ReceiptText className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <div><p className="text-[7px] font-bold text-slate-700">Invoice preview</p><p className="text-[6px] text-slate-400">Sample document</p></div>
      </div>
      <div className="mt-2 space-y-1.5 rounded-md bg-slate-50 p-2">
        <div className="flex justify-between"><span className="text-[6px] text-slate-500">Service</span><span className="h-1 w-8 rounded bg-slate-300" /></div>
        <div className="flex justify-between"><span className="text-[6px] text-slate-500">Recorded payment</span><span className="h-1 w-6 rounded bg-slate-300" /></div>
        <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-[6px] font-bold text-slate-700">Remaining balance</span><span className="h-1 w-8 rounded bg-blue-300" /></div>
      </div>
    </div>
  );
}

function PaymentsMini() {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-slate-100 bg-white p-2.5">
      <div className="relative grid h-16 w-16 place-items-center rounded-full" style={{ background: 'conic-gradient(#2563eb 0deg 230deg, #93c5fd 230deg 292deg, #dbeafe 292deg 360deg)' }}>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white"><CreditCard className="h-4 w-4 text-blue-700" aria-hidden="true" /></div>
      </div>
      <div className="space-y-2">
        <div><p className="text-[7px] text-slate-500">Payment progress</p><p className="text-[10px] font-extrabold text-slate-800">Illustrative</p></div>
        <div className="space-y-1 text-[6px]">
          <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-600" />Received</div>
          <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-300" />Partial payment</div>
          <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-100" />Remaining due</div>
        </div>
      </div>
    </div>
  );
}

function ReportsMini() {
  const bars = [34, 52, 43, 69, 58, 88, 63, 76, 48, 94, 72, 84];
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2.5">
      <div className="flex items-start justify-between">
        <div><p className="text-[7px] font-bold text-slate-700">Business activity</p><p className="text-[6px] text-slate-400">Illustrative report</p></div>
        <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[6px] font-bold text-emerald-700"><ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" /> Activity</span>
      </div>
      <div className="mt-2 flex h-12 items-end gap-1 border-b border-l border-slate-100 px-1 pb-1">
        {bars.map((height, index) => <span key={index} className={`w-full rounded-t-[2px] ${index === 9 ? 'bg-blue-600' : 'bg-blue-200'}`} style={{ height: `${height}%` }} />)}
      </div>
      <div className="mt-1 flex justify-between text-[6px] text-slate-400"><span>Period start</span><span>Period end</span></div>
    </div>
  );
}

const previewContent: Record<ProductModulePreviewProps['previewType'], { title: string; action: string; imageLabel: string; component: ComponentType; }> = {
  dashboard: { title: 'Business overview', action: 'Overview', imageLabel: 'Illustrative dashboard with summary cards and a business activity chart', component: DashboardMini },
  customers: { title: 'Customer records', action: 'Add customer', imageLabel: 'Illustrative customer list with sample-only labels', component: CustomersMini },
  services: { title: 'Service catalog', action: 'Add service', imageLabel: 'Illustrative service and plan cards', component: ServicesMini },
  subscriptions: { title: 'Subscription status', action: 'View all', imageLabel: 'Illustrative subscription statuses and timeline progress bars', component: SubscriptionsMini },
  sales: { title: 'Recent sales', action: 'New sale', imageLabel: 'Illustrative sales list with payment progress and statuses', component: SalesMini },
  invoices: { title: 'Invoice details', action: 'View invoice', imageLabel: 'Illustrative invoice with service line and balance sections', component: InvoicesMini },
  payments: { title: 'Payment records', action: 'Record payment', imageLabel: 'Illustrative payment progress chart for received, partial, and due amounts', component: PaymentsMini },
  reports: { title: 'Activity report', action: 'This period', imageLabel: 'Illustrative business activity bar chart', component: ReportsMini },
};

export function ProductModulePreview({ title, icon: Icon, focus, detail, previewType }: ProductModulePreviewProps) {
  const preview = previewContent[previewType];
  const Preview = preview.component;

  return (
    <article className="group rounded-2xl border border-blue-100 bg-white p-3 shadow-sm shadow-blue-950/[0.03] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/[0.07] motion-reduce:transform-none sm:p-4">
      <div
        role="img"
        aria-label={`${preview.imageLabel}. All values and records shown are illustrative.`}
        className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8F7FC] p-2"
      >
        <PreviewToolbar title={preview.title} action={preview.action} />
        <div className="mt-2.5" aria-hidden="true"><Preview /></div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-200/80 pt-1.5">
          <span className="text-[6px] font-medium text-slate-400">Illustrative sample data</span>
          <MoreHorizontal className="h-3 w-3 text-slate-400" aria-hidden="true" />
        </div>
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{focus}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </article>
  );
}
