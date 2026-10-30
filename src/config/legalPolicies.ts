import {
  BookOpenCheck,
  Cookie,
  Database,
  FileCheck2,
  LifeBuoy,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LegalPolicySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalPolicy {
  slug: string;
  title: string;
  description: string;
  introduction: string;
  icon: LucideIcon;
  reviewState: 'technical' | 'draft';
  sections: LegalPolicySection[];
}

const localFirstNotice =
  'XolveManager is currently a Local-First application. Business records are stored in this browser and are not automatically synchronized to cloud servers. Please maintain regular backups.';

export const LEGAL_POLICY_UPDATED_AT = '31 October 2026';

export const legalPolicies: LegalPolicy[] = [
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    description: 'A draft outline of the terms that need product-owner and legal review.',
    introduction: 'No approved Terms & Conditions were found in the application or project policy documents. This page is an outline for review, not an agreement or established company policy.',
    icon: Scale,
    reviewState: 'draft',
    sections: [
      { id: 'status', title: 'Draft status', paragraphs: ['This page does not create or describe binding terms. No verified legal entity, contracting party, jurisdiction, eligibility rules, or dispute process is configured in the inspected product.'] },
      { id: 'owner-review', title: 'Decisions required', paragraphs: ['Before publishing terms, the product owner and legal counsel should define the contracting party, permitted users, service description, account responsibilities, acceptable use, intellectual property, liability, termination, dispute handling, governing law, and effective-date process. These items are intentionally not invented here.'] },
      { id: 'product-model', title: 'Current product model', paragraphs: ['XolveManager is a Local-First browser application. It has no application backend, cloud database, or automatic business-data synchronization. This technical description is not a promise of availability, support, or any particular service level.'] },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'What the application stores locally and when information may be shared outside the browser.',
    introduction: 'This technical privacy disclosure reflects the inspected application implementation. It is not a complete jurisdiction-specific legal privacy policy; the product owner must review legal obligations and provide a contact and rights process.',
    icon: ShieldCheck,
    reviewState: 'technical',
    sections: [
      { id: 'local-data', title: 'Business information stored locally', paragraphs: ['Business records are stored in browser LocalStorage in the browser profile where you use the app. Records can include customer names and contact details, service and subscription records, service-account usernames and passwords entered by users, sales, invoices, payment and financial entries, reminders, activity history, and business settings.', localFirstNotice], bullets: ['Demo and Production records use separate storage keys in the same browser profile; this is not a separate account or security boundary.', 'Theme and language preferences are shared between the Demo and Production environments.'] },
      { id: 'local-auth', title: 'Local sign-in and security', paragraphs: ['Owner sign-in credentials and session state are stored separately in browser storage. Password and recovery-key verifiers use PBKDF2-SHA-256. Sign-in is not server-side identity verification or a security boundary. A person with access to the browser profile or device may access or change local records.', 'Service-account passwords saved in business records are ordinary business data, not protected by the local sign-in verifier. Do not treat the application as a password manager.'] },
      { id: 'network', title: 'Network requests and third parties', paragraphs: ['Business records are not automatically synchronized or sent to an XolveManager business-data backend by the application. Network requests do occur: the application loads Google Fonts and is delivered by its hosting provider. Users may configure remote logo URLs, open external service or social links, or open WhatsApp reminder links. A WhatsApp link includes the selected recipient phone number and prepared message; the user decides whether to send it. Hosting may receive record identifiers included in direct record-detail URLs. Hosting and third-party processing and retention were not established by this source review.', 'No analytics or advertising SDK, direct payment processor, or application cookie API was identified in the reviewed source. This is not a complete deployed-network or hosting-log audit.'] },
      { id: 'browser-storage', title: 'Browser storage and offline cache', paragraphs: ['The application uses LocalStorage for business data, SessionStorage for environment selection and some session state, and a service worker with Cache Storage for app pages and static assets. Browser settings, private browsing, storage pressure, profile changes, or device changes can make local records unavailable. The service-worker cache is not a business-data backup.'] },
      { id: 'backup-delete', title: 'Backups, restore, and deletion', paragraphs: ['Data & Storage settings can create a downloadable JSON backup and selected CSV exports. Backups can include customer, financial, and service-account information, including passwords entered in account records. Keep backup files secure and separate from the device.', 'Restore validates a backup and requires confirmation; the application creates a safety backup before applying it. Clear Business Data requires a successful downloadable safety backup and confirmation, and clears business records in the active Demo or Production environment while retaining business identity/settings and the separate local sign-in account. Browser-level deletion may also remove authentication state. Deletion does not erase downloaded backup files or information already shared with third parties.'] },
      { id: 'owner-review', title: 'Owner review and privacy contact', paragraphs: ['A privacy contact, legal entity, jurisdiction, complaint procedure, retention schedule, and process for privacy-rights requests are not configured in the inspected application. These details require product-owner confirmation and legal review before this notice is treated as a complete legal policy.'] },
    ],
  },
  {
    slug: 'refunds',
    title: 'Refund Policy',
    description: 'Refund rules are not established in the inspected application; this section is an owner-review draft.',
    introduction: 'No product purchase, XolveManager payment processor, or approved refund terms were identified in the inspected application. This draft does not promise a refund or define eligibility.',
    icon: FileCheck2,
    reviewState: 'draft',
    sections: [
      { id: 'status', title: 'No established refund terms', paragraphs: ['The application records business sales and payments for the user’s own business. Those tools do not establish that XolveManager itself sells a paid service or processes customer payments. No refund period, eligibility rule, method, or processing time is verified.'] },
      { id: 'owner-review', title: 'Owner decisions required', paragraphs: ['If XolveManager offers paid products or subscriptions, the owner must provide the applicable products, regions, refund eligibility and exclusions, request process, timing, payment provider, and contact destination. Obtain legal review before publishing a final policy.'] },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    description: 'A clear explanation of application storage and the limits of this source review.',
    introduction: 'No application code using browser cookies was identified in the reviewed source. XolveManager does use browser storage and service-worker caches; this page distinguishes those technologies without making claims about hosting or third-party providers.',
    icon: Cookie,
    reviewState: 'technical',
    sections: [
      { id: 'application-storage', title: 'Storage used by XolveManager', paragraphs: ['LocalStorage holds business records and local account information. SessionStorage holds the active Demo/Production selection and some session state. Cache Storage is used by the service worker for application pages and static assets. These are browser storage mechanisms and are not the same as browser cookies.'] },
      { id: 'third-parties', title: 'External services', paragraphs: ['The application loads Google Fonts and can request user-configured remote logos. User-initiated external links may open WhatsApp or other third-party websites. This source review does not determine whether those providers or the hosting platform use cookies or other tracking technologies.'] },
      { id: 'review-limits', title: 'Review limitations', paragraphs: ['No application cookie API was found in the reviewed source. This is not confirmation of the behavior of deployed hosting infrastructure, browser extensions, or third-party services. The product owner should review deployed network behavior and vendor configurations before treating this as a complete cookie policy.'] },
    ],
  },
  {
    slug: 'data-backup',
    title: 'Data & Backup Policy',
    description: 'How local records, exports, restore, and clearing business data work.',
    introduction: 'This technical summary is based on the existing local-storage and backup workflows. Users are responsible for keeping secure, current backup copies outside their browser.',
    icon: Database,
    reviewState: 'technical',
    sections: [
      { id: 'where-data-lives', title: 'Where records live', paragraphs: [localFirstNotice, 'Business information remains in the browser profile on the device where it is entered. Demo and Production records have separate storage keys in that profile. Neither is a cloud account or an independent security boundary.'] },
      { id: 'backup', title: 'Create and protect backups', paragraphs: ['Data & Storage settings can download a versioned JSON business backup and export selected records to CSV. Full backup contents can include customer information, financial history, and service-account credentials saved in business records. Protect backup files, restrict access to them, and keep a copy somewhere separate from the device.'] },
      { id: 'restore', title: 'Restore data', paragraphs: ['The restore workflow validates the selected backup, presents a preview, requires confirmation, and requires a downloadable safety backup before applying changes. A restore replaces current business records in the selected environment; users should check the backup and environment carefully before confirming.'] },
      { id: 'delete', title: 'Clear or remove data', paragraphs: ['Clear Business Data requires typing DELETE, confirmation, and a successful downloadable safety backup. It clears business records for the active environment while retaining business identity/settings and the separate local authentication account. Clearing browser storage can remove business records and authentication state; this does not remove downloaded backups or data already shared with other services.'] },
      { id: 'limits', title: 'Storage limitations', paragraphs: ['Browser storage can be cleared or become unavailable, and records do not automatically sync across browsers or devices. The app does not provide a recovery service for lost local data. Keep regular backups and avoid using browser storage as the only copy of important records.'] },
    ],
  },
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    description: 'A draft disclosure outline requiring owner confirmation and legal review.',
    introduction: 'No approved legal disclaimer was found. This page identifies product limitations that are visible in the implementation and flags legal statements that have not been established.',
    icon: TriangleAlert,
    reviewState: 'draft',
    sections: [
      { id: 'verified-limitations', title: 'Verified product limitations', paragraphs: ['XolveManager is Local-First, uses browser storage, has no automatic cloud synchronization, and uses local rather than server-side authentication. Browser data can be lost, and the application cache is not a business-data backup. These limitations should be considered when deciding whether the app is suitable for a particular workflow.'] },
      { id: 'owner-review', title: 'Legal review required', paragraphs: ['No warranty, limitation-of-liability, professional-advice, service-availability, or fitness-for-purpose wording is established by the inspected code. The product owner and legal counsel must determine any such terms; this draft does not create them.'] },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description: 'A structured draft; permitted use and enforcement rules require owner approval.',
    introduction: 'No approved Acceptable Use Policy was found in the application or project policy documents. This draft does not define enforceable usage rules.',
    icon: BookOpenCheck,
    reviewState: 'draft',
    sections: [
      { id: 'status', title: 'Draft status', paragraphs: ['The application provides local tools for managing business and customer records. A user’s ability to enter or export data is not a statement that every use is permitted or lawful.'] },
      { id: 'owner-review', title: 'Owner decisions required', paragraphs: ['The owner should define prohibited conduct, user responsibility for data and credentials, intellectual-property and third-party service constraints, security reporting, enforcement and appeals, and applicable law. Legal review is recommended before publishing a final policy.'] },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact & Support',
    description: 'How to reach support, and what contact information still needs confirmation.',
    introduction: 'No public support destination or privacy contact is configured in the inspected application. The project currently exposes a support landing page that stays ready for owner-approved channels without inventing or pretending that email or Messenger support is active.',
    icon: LifeBuoy,
    reviewState: 'draft',
    sections: [
      { id: 'configured-support', title: 'Configured support channels', paragraphs: ['The inspected app has no verified public support email, support form endpoint, or official Facebook Page destination. A dedicated support page is available for future owner-approved channels, but no unverified contact details are presented as active.'] },
      { id: 'owner-review', title: 'Owner confirmation required', paragraphs: ['The owner must provide and approve a support email address, a verified Messenger/Facebook destination, a public contact process, and any business-specific support hours or complaint procedure before a final support policy is published.'] },
    ],
  },
];

export const getLegalPolicy = (slug: string): LegalPolicy | undefined =>
  legalPolicies.find(policy => policy.slug === slug);
