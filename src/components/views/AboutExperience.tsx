import React from 'react';
import {
  ArrowRight, Banknote, BookOpen, CalendarClock, CreditCard, Database,
  FileText, History, LayoutDashboard, Layers, Package, Receipt, ShieldCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ProductLogo } from '../common/BrandLockup';
import { productBrand } from '../../config/brand';
import type { NavSection } from '../navigation/Sidebar';

interface AboutExperienceProps {
  currentBusinessName: string;
  displayMode: string;
  isDark: boolean;
  onNavigate: (section: NavSection) => void;
  onOpenDataManagement: () => void;
}

const modules: {
  title: string;
  purpose: string;
  actions: string;
  related: string;
  icon: LucideIcon;
  destination: NavSection;
  linkLabel: string;
}[] = [
  {
    title: 'Dashboard',
    purpose: 'Get an overview of recorded business activity, subscription health, and recent items.',
    actions: 'Review date-range summaries, subscriptions ending soon, outstanding payments, sales, and recent activity.',
    related: 'Links to customers, services, sales, subscriptions, payments, invoices, reports, and activity history.',
    icon: LayoutDashboard,
    destination: 'dashboard',
    linkLabel: 'Open Dashboard',
  },
  {
    title: 'Customers',
    purpose: 'Keep customer contact information and related business records together.',
    actions: 'Add, search, edit, review customer activity, and archive or restore records.',
    related: 'Customer records connect to sales, subscriptions, payments, and invoices.',
    icon: Users,
    destination: 'customers',
    linkLabel: 'Open Customers',
  },
  {
    title: 'Services & Plans',
    purpose: 'Maintain the digital services offered by the business and their sale plans.',
    actions: 'Add or edit services and configure plan prices, currencies, durations, and active status.',
    related: 'Active services and plans can be selected when creating a sale.',
    icon: Package,
    destination: 'services',
    linkLabel: 'Open Services',
  },
  {
    title: 'Accounts',
    purpose: 'Organize service account inventory used to fulfill applicable subscriptions.',
    actions: 'Review account status, capacity, and associated profiles.',
    related: 'Accounts and profiles can be assigned during a sale when required by the service.',
    icon: Layers,
    destination: 'accounts',
    linkLabel: 'Open Accounts',
  },
  {
    title: 'Profiles',
    purpose: 'Manage profile slots associated with subscription accounts.',
    actions: 'Add, edit, and assign profiles to customers or subscriptions where supported.',
    related: 'Profile assignment is linked to account inventory and can be included in a sale.',
    icon: Users,
    destination: 'profiles',
    linkLabel: 'Open Profiles',
  },
  {
    title: 'Sales',
    purpose: 'Record a customer purchase and its service, plan, dates, and payment details.',
    actions: 'Start a New Sale, review the details, then confirm it in the sale workspace.',
    related: 'A confirmed sale creates or links subscription, payment, and invoice records.',
    icon: Banknote,
    destination: 'sales',
    linkLabel: 'Open Sales',
  },
  {
    title: 'Subscriptions',
    purpose: 'Track subscription periods, current status, expiry dates, and renewals.',
    actions: 'Search and filter subscriptions, review expiry details, and use the renewal workflow.',
    related: 'Subscriptions link the customer to a service and plan and may be connected to sales and payments.',
    icon: CalendarClock,
    destination: 'subscriptions',
    linkLabel: 'Open Subscriptions',
  },
  {
    title: 'Payments',
    purpose: 'Review and record customer payments against business sales.',
    actions: 'Search and filter payment records, review status and transaction details, and record eligible payments.',
    related: 'Payments can be associated with sales, customers, subscriptions, and invoices.',
    icon: CreditCard,
    destination: 'payments',
    linkLabel: 'Open Payments',
  },
  {
    title: 'Invoices',
    purpose: 'Review invoices and receipts associated with customer sales.',
    actions: 'Search and filter invoices, review balances and status, and create an invoice from an existing sale.',
    related: 'Each invoice must be connected to a sale and reflects its customer and payment progress.',
    icon: Receipt,
    destination: 'invoices',
    linkLabel: 'Open Invoices',
  },
  {
    title: 'Reports',
    purpose: 'Review available summaries of recorded sales, payments, subscriptions, and business activity.',
    actions: 'Use the available date, record, and status filters to review report summaries and details.',
    related: 'Reports summarize records maintained in the other business modules.',
    icon: FileText,
    destination: 'reports',
    linkLabel: 'Open Reports',
  },
  {
    title: 'Activity History',
    purpose: 'Find a chronological record of business actions and related entities.',
    actions: 'Search and filter activity by category, action, related record, and date.',
    related: 'History entries link back to the customer, sale, payment, or other record where available.',
    icon: History,
    destination: 'history',
    linkLabel: 'Open History',
  },
];

const gettingStarted: {
  title: string;
  description: string;
  destination: NavSection;
  linkLabel: string;
}[] = [
  {
    title: 'Understand the Dashboard',
    description: 'Start with date-range summaries, subscription health, items ending soon, outstanding payments, and recent activity.',
    destination: 'dashboard',
    linkLabel: 'Open Dashboard',
  },
  {
    title: 'Add or review customers',
    description: 'Create customer records and keep their contact details and related business history organized.',
    destination: 'customers',
    linkLabel: 'Open Customers',
  },
  {
    title: 'Set up services and plans',
    description: 'Add services, then configure active plans with a price, currency, and duration.',
    destination: 'services',
    linkLabel: 'Open Services',
  },
  {
    title: 'Organize accounts',
    description: 'Add service accounts and review their status, capacity, and linked profiles.',
    destination: 'accounts',
    linkLabel: 'Open Accounts',
  },
  {
    title: 'Set up profiles',
    description: 'Add and organize account profiles, then review assignment and availability where supported.',
    destination: 'profiles',
    linkLabel: 'Open Profiles',
  },
  {
    title: 'Create a sale',
    description: 'In Sales, start a New Sale, choose the customer and active service plan, complete the details, and review before confirming.',
    destination: 'sales',
    linkLabel: 'Open Sales',
  },
  {
    title: 'Track subscriptions and expiry',
    description: 'Review subscription status, start and expiry dates, and renewal options.',
    destination: 'subscriptions',
    linkLabel: 'Open Subscriptions',
  },
  {
    title: 'Record payments and review invoices',
    description: 'Record eligible payments or review payment status and transaction details. Invoices are linked to sales and can be created from an existing sale.',
    destination: 'payments',
    linkLabel: 'Open Payments',
  },
  {
    title: 'Review reports',
    description: 'Use available report summaries and filters to review recorded business activity.',
    destination: 'reports',
    linkLabel: 'Open Reports',
  },
  {
    title: 'Review activity history',
    description: 'Search and filter previous actions by category, action, related record, and date.',
    destination: 'history',
    linkLabel: 'Open History',
  },
];

const questions: {
  question: string;
  answer: string;
  destination?: NavSection;
  linkLabel?: string;
  openDataManagement?: boolean;
}[] = [
  {
    question: 'Where do I find customer records?',
    answer: 'Open Customers from the main navigation. Search or adjust the status filters to find active or archived records.',
    destination: 'customers',
    linkLabel: 'Open Customers',
  },
  {
    question: 'How do I review a sale or payment?',
    answer: 'Use Sales to review sale records and Payments to search payment status, method, and transaction details. The Dashboard also shows recent sales and payments.',
    destination: 'sales',
    linkLabel: 'Open Sales',
  },
  {
    question: 'Where are subscription start and expiry dates shown?',
    answer: 'Open Subscriptions and select a record to review its dates, status, and expiry information. The list also includes status and quick expiry filters.',
    destination: 'subscriptions',
    linkLabel: 'Open Subscriptions',
  },
  {
    question: 'What should I check if a record seems to be missing?',
    answer: 'Check the current business shown in the app header, the search text, date ranges, and status or archive filters. If it is still not visible, review saved records in Data Integrity. Do not clear browser storage as a troubleshooting step.',
    destination: 'data-integrity',
    linkLabel: 'Open Data Integrity',
  },
  {
    question: 'Where can I create or restore a backup?',
    answer: 'Open Settings, then Data & Storage. Create a downloadable JSON backup there. A restore starts with a validation preview and requires confirmation; the app creates a safety backup before applying it.',
    openDataManagement: true,
    linkLabel: 'Open Data & Storage',
  },
  {
    question: 'Are Demo and Production records separated?',
    answer: 'No. Demo records share the same browser business store as other records in this build. Installing demo records does not create an isolated Demo environment.',
  },
  {
    question: 'Do records remain after refreshing the page?',
    answer: 'Business records are saved to browser LocalStorage and normally remain available in the same browser profile after a refresh. They are not cloud-synced, and browser or device changes can affect local data, so keep a separate backup.',
  },
];

const workflow = [
  'Add or select a customer.',
  'Choose an available service and plan.',
  'Set the subscription period and sale details.',
  'Assign an account or profile when the service calls for one.',
  'Enter payment status, method, and transaction details.',
  'Review the sale details before confirming.',
  'Confirm the sale, then review its linked records and business activity.',
];

export const AboutExperience: React.FC<AboutExperienceProps> = ({
  currentBusinessName,
  displayMode,
  isDark,
  onNavigate,
  onOpenDataManagement,
}) => (
  <div className="about-page">
    <header className="about-page-header">
      <ProductLogo
        size="compact"
        tone={isDark ? 'inverse' : 'default'}
        showTagline
        className="about-page-header__brand"
      />
      <div className="about-page-header__copy">
        <p className="about-page-kicker">Product overview</p>
        <h2>About XolveManager</h2>
        <p>A platform for managing digital subscription businesses.</p>
      </div>
    </header>

    <section className="about-page-section" aria-labelledby="about-what-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">What is XolveManager?</p>
        <h3 id="about-what-title">Essential business records, together.</h3>
      </div>
      <div className="about-page-copy">
        <p>
          XolveManager is a subscription business management platform designed to help organize customers, digital services, accounts, profiles, sales, subscriptions, payments, invoices, and business records in one place.
        </p>
        <p>
          It helps business owners keep records organized and review day-to-day subscription operations more easily.
        </p>
      </div>
    </section>

    <section className="about-page-section" aria-labelledby="about-why-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">Why XolveManager exists</p>
        <h3 id="about-why-title">Bring scattered work into a clearer view.</h3>
        <p>
          Subscription operations can involve many records and repeated lookups. XolveManager is designed to bring these workflows into a more organized interface.
        </p>
      </div>
      <ul className="about-page-challenges">
        <li><Users aria-hidden="true" /><span>Customer information scattered across different places.</span></li>
        <li><CalendarClock aria-hidden="true" /><span>Difficulty tracking subscription start and expiry dates.</span></li>
        <li><Layers aria-hidden="true" /><span>Challenges organizing service accounts and profiles.</span></li>
        <li><CreditCard aria-hidden="true" /><span>Keeping sales and payment records consistent.</span></li>
        <li><History aria-hidden="true" /><span>Finding previous transactions and customer history.</span></li>
      </ul>
    </section>

    <section className="about-page-section" aria-labelledby="about-getting-started-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">Getting started</p>
        <h3 id="about-getting-started-title">A practical path through your first workflows.</h3>
        <p>Each link opens an existing workspace; this guide does not change business records.</p>
      </div>
      <ol className="about-page-start-list">
        {gettingStarted.map(({ title, description, destination, linkLabel }, index) => (
          <li key={title}>
            <span className="about-page-start-list__number" aria-hidden="true">{index + 1}</span>
            <div>
              <h4>{title}</h4>
              <p>{description}</p>
              <button type="button" onClick={() => onNavigate(destination)}>
                {linkLabel}<ArrowRight aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>

    <section className="about-page-section" aria-labelledby="about-manage-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">Product guide</p>
        <h3 id="about-manage-title">What each workspace is for.</h3>
        <p>Learn the main actions in each module and how its records relate to the rest of the app.</p>
      </div>
      <div className="about-page-feature-grid">
        {modules.map(({ title, purpose, actions, related, icon: Icon, destination, linkLabel }) => (
          <article className="about-page-feature" key={title}>
            <span className="about-page-feature__icon"><Icon aria-hidden="true" /></span>
            <div className="about-page-feature__body">
              <h4>{title}</h4>
              <p><strong>Use it for:</strong> {purpose}</p>
              <p><strong>Actions:</strong> {actions}</p>
              <p><strong>Connected to:</strong> {related}</p>
              <button type="button" onClick={() => onNavigate(destination)}>
                {linkLabel}<ArrowRight aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="about-page-section" aria-labelledby="about-workflow-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">How it works</p>
        <h3 id="about-workflow-title">A straightforward sale and record flow.</h3>
        <p>
          The sale workspace connects the customer, service, subscription, payment, and invoice records. Account and profile assignment is available where relevant.
        </p>
      </div>
      <ol className="about-page-workflow">
        {workflow.map((step, index) => (
          <li key={step}>
            <span aria-hidden="true">{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      <p className="about-page-caption">
        This is an explanation only; viewing this page does not create or change business records.
      </p>
    </section>

    <section className="about-page-section about-page-audience" aria-labelledby="about-audience-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">Who is it for?</p>
        <h3 id="about-audience-title">Built for people managing subscription work day to day.</h3>
      </div>
      <ul>
        <li>Digital subscription resellers</li>
        <li>Small subscription-based businesses</li>
        <li>Entrepreneurs managing multiple customers, services, and subscription records</li>
      </ul>
    </section>

    <section className="about-page-section about-page-data" aria-labelledby="about-data-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">Data management & transparency</p>
        <h3 id="about-data-title">Know where your records live.</h3>
      </div>
      <div className="about-page-data__copy">
        <p>
          Business records use this browser’s LocalStorage. They are not cloud-synced or automatically available on another device. Browser storage can be cleared or affected by browser and device changes, so keep a separate backup.
        </p>
        <p>
          Data &amp; Storage settings provide a downloadable JSON backup and a validated restore preview. A restore is applied only after confirmation and a safety backup. Demo records share the business store; this app does not provide isolated Demo and Production environments.
        </p>
        <div className="about-page-actions">
          <button type="button" onClick={onOpenDataManagement}>
            <Database aria-hidden="true" /> Open Data &amp; Storage
          </button>
          <button type="button" onClick={() => onNavigate('data-integrity')}>
            <ShieldCheck aria-hidden="true" /> Open Data Integrity Center
          </button>
        </div>
      </div>
    </section>

    <section className="about-page-section" aria-labelledby="about-faq-title">
      <div className="about-page-section__heading">
        <p className="about-page-kicker">FAQ &amp; troubleshooting</p>
        <h3 id="about-faq-title">Quick answers for common tasks.</h3>
      </div>
      <div className="about-page-faq">
        {questions.map(({ question, answer, destination, linkLabel, openDataManagement }) => (
          <details key={question}>
            <summary>{question}</summary>
            <div>
              <p>{answer}</p>
              {destination && linkLabel && (
                <button type="button" onClick={() => onNavigate(destination)}>
                  {linkLabel}<ArrowRight aria-hidden="true" />
                </button>
              )}
              {openDataManagement && linkLabel && (
                <button type="button" onClick={onOpenDataManagement}>
                  {linkLabel}<ArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>

    <section className="about-page-mission" aria-labelledby="about-mission-title">
      <p className="about-page-kicker">Our mission</p>
      <h3 id="about-mission-title">
        Our goal is to make digital subscription business management more organized, transparent, and straightforward by bringing essential business records and workflows into one place.
      </h3>
    </section>

    <footer className="about-page-product" aria-labelledby="about-product-title">
      <div className="about-page-product__heading">
        <span><BookOpen aria-hidden="true" /></span>
        <div>
          <h3 id="about-product-title">Product information</h3>
          <p>Reference details for this installation.</p>
        </div>
      </div>
      <dl>
        <div><dt>Application</dt><dd>{productBrand.name}</dd></div>
        <div><dt>Version</dt><dd>{productBrand.version}</dd></div>
        <div><dt>Business</dt><dd>{currentBusinessName || 'Not set'}</dd></div>
        <div><dt>Running as</dt><dd>{displayMode}</dd></div>
        <div><dt>Help &amp; support</dt><dd>No external guide or support destination is configured.</dd></div>
      </dl>
      <p className="about-page-caption">
        <FileText aria-hidden="true" /> In-app data and backup guidance is available in Data &amp; Storage settings.
      </p>
    </footer>
  </div>
);
