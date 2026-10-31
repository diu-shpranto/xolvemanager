# XolveManager Global Landing Page Content Strategy

**Prepared:** 2026-10-31  
**Product:** XolveManager  
**Brand hierarchy supplied for planning:** Xolve → XolveKart → XolveManager  
**Audience scope:** Worldwide; English  
**Mode:** Read-only product research and content planning. No routes, code, business logic, or deployment were changed.

## Executive summary

XolveManager has verified workflow depth for customer records, configurable services and plans, subscriptions, sales and quotations, invoices, payment recording and allocation, customer advance credit, customer statements, financial accounts and ledger, reporting, and backup/restore. Those connected workflows support a focused set of useful product pages.

The strongest content opportunity is not a generic “all-in-one business software” claim. It is explaining how a business can manage its own customer/service/subscription/sale records in a browser-based Local-First workspace, with explicit caveats: business data does not automatically sync; local sign-in is not server-side authentication; payment entries are records, not payment processing; subscription renewal is a user-managed workflow, not automatic recurring billing.

The wording “subscription management software” is ambiguous. Many searchers may mean software to manage subscriptions their company buys, or automated recurring billing for subscriptions they sell. The product’s verified fit is tracking services/plans and subscriptions sold or assigned to its customers. Any page using that head term must make that distinction immediately.

**Deployment prerequisite:** The prior [XOLVE_HOMEPAGE_AUDIT.md](./XOLVE_HOMEPAGE_AUDIT.md) recorded that production served `noindex, nofollow` and stale metadata while local source had an indexable homepage. Verify the production deployment before investing in public landing pages or assuming that they can be crawled.

No search volume, keyword difficulty, CPC, ranking, or conversion data is available in this repository. Priorities below are qualitative assessments of product fit, intent clarity, content differentiation, effort, and likely business usefulness—not forecasts.

## 1. Verified feature-to-keyword mapping

| Product area / search theme | Verified capabilities in source | Safe, accurate content angle | Boundaries and unsupported claims | Evidence |
|---|---|---|---|---|
| Customer management | Customer and reseller records; contact details, tags, notes/history, status/archive, search/filtering, customer timelines and CRM metrics; related sales, subscriptions, invoices, payments; CSV export; printable customer statement with transaction history and balance summary. | Organize customer records and review associated business activity and balances. | Do not imply lead capture, marketing automation, pipeline forecasting, omnichannel CRM, or shared cloud contacts. Customer relationship/statement data is browser-local. | `src/components/views/CustomersView.tsx`; `src/utils/customerCrm.ts`; `src/utils/customerTimeline.ts`; `src/utils/customerStatement.ts`; `src/services/dataBackupService.ts` |
| Service management | Configurable service catalog, categories, plans/pricing/duration/currency, status, invoice settings, subscription/renewal reminders, service-account/profile assignment options, and service performance. | Configure services and plans, then relate them to customer sales and subscriptions. | “Service management” may imply field-service scheduling, dispatch, work orders, inventory, or technician management; none is verified here. | `src/components/views/ServicesView.tsx`; `src/types/index.ts`; `src/utils/reportMetrics.ts` |
| Subscription management / tracking | Subscription records have customer, service, plan, start, duration, expiry, status, payment status, renewal history; filters for active/expiring/expired/cancelled, expiry windows and payment status; reminders and renewal flow. Services can enable/disable subscription and renewal behavior and reminder settings. | Track customer subscriptions, expiry dates, status, renewal history, and follow-up reminders. | Renewal is a user-driven/manual workflow. Do not claim automatic recurring billing, automatic payment collection, provider-subscription cancellation, cloud sync, or “subscription billing platform.” | `src/components/views/SubscriptionsView.tsx`; `src/components/views/ServicesView.tsx`; `src/types/index.ts`; `src/services/reminderEngine.ts` |
| Sales management | Sales can relate customers, services, plans, subscriptions, invoices, payment status and amounts; quotation/order records can be resumed and converted through the sales workflow; sale lists support search, filters, status, sort, CSV. | Record and review sales connected to customers, services, invoices, and payment progress. | Do not imply POS hardware, online checkout, payment processing, inventory accounting, sales-team automation, or server collaboration. | `src/components/views/SalesView.tsx`; `src/components/modals/NewSaleModal.tsx`; `src/types/index.ts` |
| Invoice management | Invoices are linked to sales and customers; invoice list filters/search/status and outstanding view; due/partial/paid states, aging, reminders, preview, print, image download and share are implemented. An invoice can be ensured for a sale. | Create and share invoices linked to recorded sales, and review outstanding/partial balances. | Invoices are generated from application records; do not claim tax compliance, e-invoicing network access, automatic email delivery, accounting-platform sync, or automatic invoice payment. | `src/components/views/InvoicesView.tsx`; `src/utils/invoiceUtils.ts`; `src/utils/invoiceGenerator.ts` |
| Payment tracking | Payments can be recorded against sales/customers, with method, date, status, transaction reference, financial-account destination, allocation and refund records; filters and CSV export are available; due collection/follow-up workflows exist. | Track money received through other means and relate entries to business sales/invoices. | The app is not a payment gateway/processor and does not initiate or settle payments. No payment-provider integration is verified. | `src/components/views/PaymentsView.tsx`; `src/context/AppContext.tsx`; `src/utils/saleUtils.ts` |
| Partial payments | Sale payment state includes `partial`; payments can be allocated, remaining due is calculated, and invoice/subscription views can filter or display partial status. | Record partial payments and see the remaining balance on a sale/invoice. | Avoid implying installment contracts, automatic collection schedules, financing, or payment-plan automation. | `src/types/index.ts`; `src/utils/saleUtils.ts`; `src/utils/paymentAllocation.ts`; `src/components/views/PaymentsView.tsx` |
| Advance credit | Customer payments can leave an advance balance; available customer credit can be applied to a later sale; the UI shows advance created/applied/remaining; customer statements distinguish advance creation and application. | Record customer advances and apply available credit to a later sale, with the allocation visible in records. | Do not present this as wallet, stored-value regulation, escrow, or a separately held/guaranteed balance. It is a locally stored business record. | `src/context/AppContext.tsx`; `src/components/views/PaymentsView.tsx`; `src/utils/saleUtils.ts`; `src/utils/customerStatement.ts` |
| Customer ledger / statement | Customer statement builds dated invoice, discount, payment, advance-created, advance-applied, and refund entries with running balance, period summary, due and available advance; the UI can print it. | Review and print a customer transaction statement with running balance and recorded advance. | Call it a customer statement or transaction history, not a formal accounting subledger, audited statement, or statutory ledger. It reflects entered app data and can have unverified/missing linked records. | `src/utils/customerStatement.ts`; `src/components/views/CustomersView.tsx` |
| Accounts (service resources) | Service-linked accounts can store account usernames/email and password fields, with profile capacity, assignment and operational/expiry state; profiles can be assigned to customers/subscriptions. | If discussed, explain the app’s service-resource and profile assignment workflow. | Avoid “account management software” as a target: it is ambiguous and can imply user access/accounting. Do not market as a password manager; documentation warns credentials are ordinary browser data. | `src/components/views/AccountsView.tsx`; `src/types/index.ts`; `docs/LOCAL_FIRST_BETA_NOTICE.md` |
| Financial accounts and cashbook | Financial accounts, opening balances, income, expenses, transfers, adjustments, financial ledger, reconciliations, daily closings and financial periods are represented; account ledgers can be filtered/exported. | Review locally recorded business cash movement and account balances. | Avoid “accounting software,” bookkeeping compliance, bank feed, bank reconciliation integrations, tax calculations or audited financial statements. Manual records and user configuration are required. | `src/components/views/FinancialControlView.tsx`; `src/components/views/CashbookView.tsx`; `src/utils/financialLedger.ts`; `src/utils/accountingControls.ts` |
| Reports | Customer/service/plan/sales/subscription/payment metrics; revenue and cash-flow trends, receivable aging, reminder and renewal analysis, profitability views, comparisons/date filters, CSV exports. | Analyze recorded activity and export reports for a selected period. | Reports depend on local data and configured currency conversion; do not promise predictive analytics, external data consolidation, accounting/tax certification, or universal currency support. | `src/components/views/ReportsView.tsx`; `src/components/views/ProfitAnalyticsView.tsx`; `src/utils/reportMetrics.ts`; `src/utils/actualProfitAnalytics.ts` |
| Backup and restore | Versioned JSON backups include record collections and integrity checks; validation checks backup structure; Settings supports preview and merge/replace restore modes; selected collections also export CSV. | Create downloadable backups and restore/merge records deliberately. | Backups are user-managed, can contain sensitive data, and are not automatic cloud backup/sync. Do not promise recovery if no usable backup exists. | `src/services/dataBackupService.ts`; `src/components/views/SettingsView.tsx`; `docs/LOCAL_FIRST_BETA_NOTICE.md` |
| Local-First / data model | The technical notice says business records and local auth/session state are stored in browser LocalStorage on the current browser profile/device; no business-data backend or automatic device sync is provided. Demo and Production use separate browser-storage namespaces in the same profile. | Explain where data is stored, what no-sync means, and how users can export/restore backups. | Local-First is not a blanket privacy/security guarantee. Hosting, fonts and external services still make network requests; local sign-in is not a security boundary. Do not claim cloud backup or cross-device availability. | `docs/LOCAL_FIRST_BETA_NOTICE.md`; `docs/LOCAL_AUTH.md`; `src/services/localStorageStore.ts`; `src/services/dataBackupService.ts` |

### Global audience caveats

- The application type definitions expose English/Bengali UI language and `BDT`/`USD` currencies. That is not evidence of full worldwide localization, tax, date/legal, payment-method, or currency coverage. See `src/types/index.ts`.
- English is suitable for the proposed initial content language; the existing Bengali UI does not itself establish a translated public SEO strategy.
- Do not imply multiple cloud users, remote team collaboration, or shared records: no multi-user permission model is documented; public registration beyond the local owner is disabled (`docs/LOCAL_AUTH.md`).

## 2. Opportunity and priority assessment

Qualitative scales: **Fit** = verified feature relevance; **Intent** = how clearly the query maps to the product; **Differentiation** = scope for useful, specific content versus generic competitor copy; **Effort** = research, original copy, screenshots, and maintenance. **Business value** is a hypothesis, not a traffic estimate.

| Rank | Proposed topic | Fit | Intent | Differentiation | Effort | Qualitative business value | Recommendation |
|---:|---|---|---|---|---|---|---|
| 1 | Subscription Management Software | High for customer subscription tracking; ambiguous head term | Medium | High if manual tracking and Local-First boundaries are prominent | Medium | High hypothesis: close to the product’s service/plan/renewal workflow | Prioritize, but consider a more exact page focus/title: **Subscription Tracking for Your Customers**. |
| 2 | Customer Management Software | High | High | High: connected customer timeline, transactions, statement, and local data | Medium | High hypothesis: broad foundational record workflow | Build a dedicated customer-records page if it can show a coherent real workflow, not a generic CRM claim. |
| 3 | Payment Tracking Software | High for recorded payments, partials and advances | High | High: transparent allocation and customer advance story; payment-processor caveat | Medium | High hypothesis: concrete business problem and feature depth | Build around recording and reconciling payment history; state prominently that the app does not process payments. |
| 4 | Invoice Management Software | High | High | Medium-high: linked sales, balance statuses, aging, print/share | Medium | Medium-high hypothesis: specific buying/evaluation intent | Build if current invoice output is visually credible and limitations (tax/delivery) are explicit. |
| 5 | Sales Management Software | Medium-high | High | Medium: connected records and quotations are useful, but category is broad | Medium | Medium hypothesis | Build after customer/payment/invoice pages; avoid POS/CRM/checkout implications. |
| 6 | Service Management Software | Medium; actual scope is a service/plan catalog and related subscription resources | Low-medium | Medium if scoped to digital services and plans; high category ambiguity | Medium | Medium-low hypothesis | Do not target generic service-management intent. Use a tightly scoped “services and plans” page only if real buyers use that terminology. |
| 7 | Business Management Software | Medium-high overall workflow coverage, but incomplete broad-suite expectations | High but extremely broad | Low-medium; substantial risk of generic/duplicate copy | High | Uncertain; broad search intent could be poorly qualified | Keep the homepage as the broad product overview; do not make a near-duplicate business-management landing page. |

No ranking implies search volume, low competition, or likelihood of ranking. This ordering favors accurate fit and explainable product workflows over unverified demand.

## 3. Page-by-page content outlines

All SEO titles and descriptions below are drafts for owner approval, not implemented metadata. Proposed URL paths are illustrative only; **no routes currently exist for these pages, and none were created**. Keep the existing homepage as the principal broad product page. Before publishing, verify that production serves indexable metadata.

### 1. Subscription tracking for customer businesses

- **Candidate path:** `/features/subscription-tracking/`
- **Audience:** Businesses that sell or assign time-bound services/plans to their own customers and need to monitor periods, expiry, payment status, and renewals.
- **Search intent / keywords:** Commercial investigation. Primary: `subscription tracking software`; secondary: `subscription management software`, `customer subscription tracking`, `subscription renewal tracking`, `subscription expiry reminders`.
- **Verified support:** Service plans with price/duration; customer subscriptions with start/expiry/status/payment status; renewal history and manual renewal; expiry filters and reminders.
- **Value proposition:** A browser-local record workflow connects a customer’s service plan, subscription dates, renewal activity, and payment status.
- **Problems addressed:** Expiry dates scattered across notes; uncertainty about which customer subscriptions need follow-up; difficulty reviewing renewal history.
- **Outline:** (1) Define whose subscriptions are tracked (customers’ subscriptions sold by the business). (2) Show service/plan setup. (3) Show subscription record: start, duration, expiry and status. (4) Explain reminders, filtering and manual renewal. (5) Explain payment-status tracking without billing automation. (6) Local-First storage, backup and security limitations. (7) FAQ comparing tracking with recurring billing and vendor-subscription management.
- **Screenshot:** A sanitized service-plan setup and subscription detail/list with dates and status; do not include live customer or credential data.
- **Internal links:** Homepage; customer records; sales; payment tracking; backup/data notice; demo or local-account flow.
- **CTA:** `Try the Demo`, followed by `Create a local account` with the browser-storage caveat.
- **SEO title:** `Subscription Tracking Software for Customer Businesses | XolveManager`
- **Meta description:** `Track customer service plans, subscription periods, expiry dates, renewal history and payment status in XolveManager. Renewals are manual; records stay in this browser.`
- **SEO risks:** Broad “subscription management” may attract people seeking vendor-spend management or recurring billing. Lead with the exact customer-subscription meaning; do not claim automatic renewal, recurring billing, or collection.

### 2. Customer records and customer management

- **Candidate path:** `/features/customer-management/`
- **Audience:** Small businesses that need a customer list connected to sales, subscriptions, invoices, and payment history.
- **Search intent / keywords:** Commercial investigation. Primary: `customer management software for small business`; secondary: `customer records software`, `customer transaction history`, `customer payment statement`, `local-first customer management`.
- **Verified support:** Customer/reseller contact records, search/filter, tags, notes/history, archive/status, timeline/metrics, related records, printable statement and CSV export.
- **Value proposition:** Review customer details and related transactions in a single locally stored record workflow.
- **Problems addressed:** Re-entering customer details; fragmented transaction history; difficulty checking a customer’s due or advance balance.
- **Outline:** (1) Customer record fields and types. (2) Search, filtering, notes and archive. (3) Timeline across sales/subscriptions/invoices/payments. (4) Customer statement and running balance, clearly described as generated from app records. (5) Export. (6) Browser-local data and backup warning. (7) FAQ on security, access and data portability.
- **Screenshot:** Sanitized customer profile with notes/timeline and a sample generated statement using synthetic data.
- **Internal links:** Subscription tracking; sales; invoices; payment tracking; data/backup; homepage.
- **CTA:** `Try the Demo` or create a local account after the no-cloud-sync notice.
- **SEO title:** `Customer Management Software for Small Businesses | XolveManager`
- **Meta description:** `Keep customer contact records, notes and related sales, subscriptions, invoices and payment history together. XolveManager stores records in this browser.`
- **SEO risks:** “CRM” can imply pipeline, lead automation and marketing features. Position this as customer records and transaction history, not a full sales CRM.

### 3. Payment tracking and payment records

- **Candidate path:** `/features/payment-tracking/`
- **Audience:** Businesses that receive payment through external methods and want to record amounts, allocate payments to sales, review what remains due, and track advances.
- **Search intent / keywords:** Commercial investigation. Primary: `payment tracking software for small business`; secondary: `record customer payments`, `track partial payments`, `customer advance payment tracking`, `payment allocation by invoice`.
- **Verified support:** Manual payment entry, configurable methods, sale/invoice allocations, paid/partial/due status, advance credit, applying advances, refund entries, due follow-up, and CSV export.
- **Value proposition:** Keep the history and allocation of money received visible alongside sale and invoice balances.
- **Problems addressed:** Unclear partial balances; advance payments not linked to future sales; payment history separated from customer invoices.
- **Outline:** (1) Distinguish recording from processing. (2) Record a receipt and its method/reference. (3) Allocate to a sale/invoice and explain partial due. (4) Record and later apply customer advance credit. (5) Review refunds/follow-ups and exports. (6) Financial-account assignment. (7) Local data, no gateway, no sync, backups. (8) FAQ on gateway/card payments and automated collection.
- **Screenshot:** Synthetic payment entry and allocation view showing a partial allocation and separate advance; mask transaction references.
- **Internal links:** Invoice management; sales; customer management; financial accounts/reports (in-app); backup notice.
- **CTA:** `Try the Demo` to see payment records; do not label it `Accept Payments` or `Start Processing Payments`.
- **SEO title:** `Small Business Payment Tracking Software | XolveManager`
- **Meta description:** `Record payments against sales, track partial balances and customer advances, and review payment history. XolveManager does not process payments.`
- **SEO risks:** Payment software searches often imply gateway integrations, card acceptance or automated collections. State “record payments made elsewhere” above the fold and do not use gateway logos.

### 4. Invoice management

- **Candidate path:** `/features/invoice-management/`
- **Audience:** Businesses that create invoices from recorded sales and need to monitor payment status and outstanding balances.
- **Search intent / keywords:** Commercial investigation. Primary: `invoice management software for small business`; secondary: `track unpaid invoices`, `partial invoice payment tracking`, `sales invoice records`, `printable business invoices`.
- **Verified support:** Sale-linked invoices; invoice preview, print, image download/share; status and outstanding views; due aging, reminders and payment linkages.
- **Value proposition:** Connect invoice presentation to the underlying sale and the amounts recorded as received or still due.
- **Problems addressed:** Invoice copies separated from sales; uncertainty about paid/partial/due status; finding older outstanding invoices.
- **Outline:** (1) Explain invoice-from-sale flow. (2) Show invoice fields and preview. (3) Show paid/partial/due states and aging. (4) Show print/download/share workflow. (5) Explain reminders and manual follow-up. (6) State no tax-compliance, e-invoice-network, automatic email, or payment-processing claim. (7) Local-First data and backup.
- **Screenshot:** A generated invoice using synthetic business/customer details and a separate outstanding-invoice view.
- **Internal links:** Sales management; payment tracking; customer records; privacy/backup.
- **CTA:** `Explore the Demo`; secondary local account CTA.
- **SEO title:** `Invoice Management Software for Small Businesses | XolveManager`
- **Meta description:** `Create sale-linked invoices, review paid, partial and due balances, and print or share invoice records. Payment collection and tax compliance are not provided.`
- **SEO risks:** Do not imply invoicing compliance for any country, tax calculation, e-invoicing certification, automatic email delivery, or invoice payment links unless separately verified.

### 5. Sales management

- **Candidate path:** `/features/sales-management/`
- **Audience:** Businesses recording service sales and wanting to relate customers, plans, subscriptions, invoices, and payment progress.
- **Search intent / keywords:** Commercial investigation. Primary: `sales management software for small business`; secondary: `service sales tracking`, `sales invoice records`, `sales payment tracking`, `sales quotation management`.
- **Verified support:** Sales linked to customer/service/plan, sale line items, subscription, invoice and payments; quotation/order records can be resumed; search/filter/sort; exports and reports.
- **Value proposition:** Trace a recorded service sale through its invoice and payment records in one browser-local workflow.
- **Problems addressed:** Sale totals, invoices and payment status maintained in unrelated lists; difficulty finding a sale and its related records.
- **Outline:** (1) Define sales scope as service/sale recordkeeping. (2) Create or resume a quotation/order where supported. (3) Record a sale and link customer/service/plan. (4) Follow invoice/subscription/payment status. (5) Review/search/export and sales reports. (6) State no checkout/POS/payment processing. (7) Local storage and backup.
- **Screenshot:** Synthetic sale with a linked invoice and payment status.
- **Internal links:** Service/plan management; customer management; invoice management; payment tracking; reports in app; backup notice.
- **CTA:** `Try the Demo`; secondary create a local account.
- **SEO title:** `Sales Management Software for Service Businesses | XolveManager`
- **Meta description:** `Record service sales and connect customers, plans, invoices and payment progress in a Local-First business workspace. XolveManager does not process checkout payments.`
- **SEO risks:** “Sales management” is broad and may imply CRM pipelines, team performance or POS. Avoid those representations unless features are separately verified.

### 6. Services and plans

- **Candidate path:** `/features/service-management/`
- **Audience:** Businesses that sell configurable services or time-bound plans and need to connect these offerings to customer sales and subscriptions.
- **Search intent / keywords:** Commercial investigation. Primary: `service plan management software`; secondary: `service catalog management for small business`, `manage service plans and subscriptions`, `service pricing and renewal tracking`.
- **Verified support:** Service categories, plans/pricing/duration/currency, active status, invoice and renewal settings, reminders, optional service account/profile assignment, performance measures.
- **Value proposition:** Maintain a service/plan catalog that feeds the app’s customer sale, subscription and invoice workflows.
- **Problems addressed:** Repeatedly setting service/plan details; inconsistent durations/prices; service-related subscriptions disconnected from offerings.
- **Outline:** (1) Define the supported catalog and plans. (2) Configure price, currency, duration and status. (3) Explain subscription/renewal settings. (4) Optional account/profile resource assignment with security warning. (5) Link to sale, subscription, invoice and reporting workflows. (6) Explicitly distinguish from field-service dispatch/work orders. (7) Local-First and backup.
- **Screenshot:** Synthetic service catalog and plan settings; omit real credentials and service-account data.
- **Internal links:** Subscription tracking; sales; invoice management; customer management; backup.
- **CTA:** `Explore service plans in the Demo`.
- **SEO title:** `Manage Service Plans and Renewals | XolveManager`
- **Meta description:** `Configure service plans, prices and durations, then connect them to customer sales and subscription tracking. This is not field-service dispatch software.`
- **SEO risks:** Generic “service management software” commonly signals dispatch, scheduling, work orders, or ITSM. Target the actual catalog/plan use case rather than that broad category alone.

### 7. Business management (homepage coverage, not a duplicate page)

- **Recommended location:** Keep the existing homepage as the broad product overview; avoid a separate near-duplicate page unless distinct user research supports it.
- **Audience:** Small businesses evaluating a single place for customer/service/subscription/sales/invoice/payment records.
- **Search intent / keywords:** Commercial investigation. Primary: `business management software`; secondary: `local-first business management software`, `small business customer and subscription records`.
- **Verified support:** Combined verified workflows in the feature matrix and app views.
- **Value proposition:** A browser-based, Local-First workspace for a defined set of business records—not a cloud ERP or an all-in-one system.
- **Problems addressed:** Related customer, service, sale, invoice and payment records are hard to review together.
- **Outline:** (1) Product category and audience. (2) A real connected workflow. (3) Core records/features, linked to more focused pages if approved. (4) Product preview. (5) Local-First architecture and limitations. (6) Demo and account CTAs. (7) FAQ and help/data links.
- **Screenshot:** One current end-to-end workflow using synthetic data, not a collage of unverified features.
- **Internal links:** Focused pages only after they exist; existing privacy/data-backup and support pages; demo/login.
- **CTA:** Demo first, local account second.
- **SEO title:** `Local-First Business Management Software | XolveManager`
- **Meta description:** `Organize customer, service, subscription, sales, invoice and payment records in a browser-based workspace. Records stay in this browser and do not sync automatically.`
- **SEO risks:** Broad “business management” expectations include payroll, inventory, accounting, HR, project management and cloud collaboration. State exact scope and exclusions; do not repeat the same text across a separate business page and homepage.

## 4. Recommended internal linking structure

Candidate links below are planning only; new target routes do not exist yet.

```text
Homepage (broad product overview)
├── Customer management
│   ├── Subscription tracking
│   ├── Sales management
│   ├── Invoice management
│   └── Payment tracking
├── Service plans
│   ├── Subscription tracking
│   └── Sales management
├── Sales management
│   ├── Invoice management
│   └── Payment tracking
├── Local-First / data explanation
│   └── Existing privacy and data-backup disclosures
└── Demo / local account
```

Rules:

- Link from a feature page to a related page only where the actual workflow crosses those features; use descriptive, non-repetitive anchors.
- Link all public feature pages to the data/backup explanation and state no-sync limitations near the CTA, not only in the footer.
- Link to existing demo/login/signup flow; do not imply that sign-up creates a cloud account.
- Do not link the public SEO strategy into private app route content as if those screens were crawlable public documentation. Current app routes are marked `noindex`.
- Retain the homepage as the canonical broad overview; avoid doorway pages or cloned templates where only the keyword changes.

## 5. Recommended delivery order and gates

1. **Production visibility gate (required):** Confirm production serves intended homepage content and indexable metadata. Prior audit observed `noindex, nofollow` and stale production metadata; resolve/verify before investing in landing-page publication.
2. **Content proof (required):** Capture current sanitized screens for subscription, customer statement, payment allocation, and invoice workflows. Use synthetic data and redact transaction references/credentials.
3. **First new-page pilot:** Subscription tracking, scoped to subscriptions that a business manages for its own customers and manual renewal. This is a strong feature-fit hypothesis, not a volume-backed forecast.
4. **Second pilot:** Customer records and connected transaction history.
5. **Third pilot:** Payment tracking, including partial balances and advance-credit application, with a clear no-payment-processing notice.
6. **Expand if useful and maintainable:** Invoice and sales pages.
7. **Defer generic “service management” and separate “business management” pages:** Category ambiguity and overlap with the homepage weaken content differentiation.
8. **Measure after release:** Search Console query/impression/click data for the verified origin, page engagement and demo starts using an owner-approved measurement/privacy design. Reprioritize based on observed data, not invented volume estimates.

## 6. SEO titles and meta descriptions summary

| Page/topic | Draft SEO title | Draft meta description |
|---|---|---|
| Subscription tracking | Subscription Tracking Software for Customer Businesses \| XolveManager | Track customer service plans, subscription periods, expiry dates, renewal history and payment status in XolveManager. Renewals are manual; records stay in this browser. |
| Customer records | Customer Management Software for Small Businesses \| XolveManager | Keep customer contact records, notes and related sales, subscriptions, invoices and payment history together. XolveManager stores records in this browser. |
| Payment tracking | Small Business Payment Tracking Software \| XolveManager | Record payments against sales, track partial balances and customer advances, and review payment history. XolveManager does not process payments. |
| Invoice management | Invoice Management Software for Small Businesses \| XolveManager | Create sale-linked invoices, review paid, partial and due balances, and print or share invoice records. Payment collection and tax compliance are not provided. |
| Sales management | Sales Management Software for Service Businesses \| XolveManager | Record service sales and connect customers, plans, invoices and payment progress in a Local-First business workspace. XolveManager does not process checkout payments. |
| Service plans | Manage Service Plans and Renewals \| XolveManager | Configure service plans, prices and durations, then connect them to customer sales and subscription tracking. This is not field-service dispatch software. |
| Business overview (homepage) | Local-First Business Management Software \| XolveManager | Organize customer, service, subscription, sales, invoice and payment records in a browser-based workspace. Records stay in this browser and do not sync automatically. |

Character lengths and rendered snippets should be checked after content approval and in actual search results; Google may rewrite titles/snippets.

## 7. Missing information and limitations

- No verified search volume, competition, keyword difficulty, CPC, SERP ranking, conversion, or Search Console data. Earlier keyword research also marked these unavailable.
- No confirmed primary customer segment, industry specialization, geography priority, pricing model, or willingness-to-pay evidence.
- No approved sanitized product screenshots identified in the checked-in public image assets; those assets are brand graphics and app icons rather than feature screenshots.
- No confirmed public support email, feedback endpoint, or social channel. Do not add these to page trust copy without owner verification.
- No approved customer testimonials, customer counts, case studies, measured time savings, or performance claims.
- No automatic recurring billing, payment gateway, automatic cloud synchronization/backup, server-side authentication, multi-user cloud access, provider billing management, tax compliance, or bank-feed integration verified.
- App records are browser-local; backups are user-managed. Local authentication is a convenience gate, not server-side security. See `docs/LOCAL_FIRST_BETA_NOTICE.md` and `docs/LOCAL_AUTH.md`.
- The product supports a limited set of language/currency types in source; worldwide availability does not establish full localization or compliance.
- “Customer ledger” is safest to describe as an app-generated customer statement based on stored transaction records; it is not an independently audited accounting ledger.
- Candidate paths are not existing routes. No route or page should be created before approval.
- Production deployment inconsistency remains an SEO blocker documented in `XOLVE_HOMEPAGE_AUDIT.md`.

## 8. Source references

- Homepage and current public metadata: `app/page.tsx`, `app/layout.tsx`
- App route mapping: `src/utils/appRoutes.ts`
- Customers/statements: `src/components/views/CustomersView.tsx`, `src/utils/customerStatement.ts`, `src/utils/customerCrm.ts`
- Services/plans: `src/components/views/ServicesView.tsx`, `src/types/index.ts`
- Subscriptions: `src/components/views/SubscriptionsView.tsx`, `src/services/reminderEngine.ts`
- Sales: `src/components/views/SalesView.tsx`, `src/components/modals/NewSaleModal.tsx`
- Invoices: `src/components/views/InvoicesView.tsx`, `src/utils/invoiceUtils.ts`, `src/utils/invoiceGenerator.ts`
- Payments/partial/advance: `src/components/views/PaymentsView.tsx`, `src/context/AppContext.tsx`, `src/utils/saleUtils.ts`, `src/utils/paymentAllocation.ts`
- Financial accounts/reports: `src/components/views/FinancialControlView.tsx`, `src/components/views/ReportsView.tsx`, `src/utils/financialLedger.ts`, `src/utils/reportMetrics.ts`
- Backup and restore: `src/services/dataBackupService.ts`, `src/components/views/SettingsView.tsx`
- Local-First and auth limits: `docs/LOCAL_FIRST_BETA_NOTICE.md`, `docs/LOCAL_AUTH.md`
- Earlier query/brand research and production observation: `XOLVE_GLOBAL_KEYWORD_RESEARCH.md`, `XOLVE_HOMEPAGE_AUDIT.md`

This deliverable is strategy only. Wait for explicit approval before implementing or creating public routes.
