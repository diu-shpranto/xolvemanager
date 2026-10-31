# XolveManager SEO Content Strategy

## Positioning

Describe XolveManager as a browser-based, Local-First business records and workflow application. The differentiator is that business records are stored in the user's browser rather than automatically synchronized to a cloud backend. Present this as a product architecture with practical backup and device limitations, not as a blanket security or privacy guarantee.

## Audience and intent

Initial audience hypothesis: small businesses that manage customers, services, subscriptions, sales, invoices, and payment records. No specific geography, industry, or customer size has been validated by search data.

1. **Discovery:** Understand the product and its supported workflows on the homepage.
2. **Evaluation:** Check whether customer, subscription, invoice, and payment-record workflows fit.
3. **Trust:** Understand browser storage, local sign-in, data export, backup, and restore limitations.
4. **Action:** Start through the existing local sign-up flow, with clear notice that this is a beta and not a cloud-synchronized service.

## Implemented content map

| URL | Role | Publication status |
|---|---|---|
| `/` | Product overview, verified workflow features, data-location notice, and FAQs | Public and indexable |
| `/legal/privacy` | Technical account of local storage, network use, backups, and owner-review gaps | Indexable technical disclosure; legal review still needed |
| `/legal/data-backup` | Technical backup, restore, deletion, and storage guidance | Indexable technical disclosure |
| `/support` | Existing help surface without a verified contact channel | Noindex |
| `/legal` and draft policies | Policy center and unapproved legal drafts | Noindex |
| App and authentication routes | Local application experience | Noindex; no change to access controls |

## Editorial roadmap

Prioritize these only when the corresponding workflow is stable and the page can provide substantial original help:

1. A practical guide to organizing customer and subscription records.
2. A transparent guide to exporting, protecting, and restoring browser-stored business data.
3. A workflow guide explaining how sales, invoices, balances, and manually recorded payments relate.
4. A product walkthrough using real, sanitized screenshots and clear beta limitations.
5. A reviewed Bengali-language overview if the product owner confirms localization scope and maintains equivalent disclosures.

Each article should answer a real user task, link to the relevant product route or technical disclosure, and be updated when the implementation changes. Avoid thin keyword pages, generated location pages, and unsupported comparisons.

## Trust and claim governance

- Distinguish a payment record from payment processing and a local sign-in from server-side authentication.
- State that browser records do not automatically sync, and that backups are the user's responsibility.
- Warn users that service-account credentials entered into records are ordinary browser data.
- Treat privacy and backup pages as technical descriptions until legal review is complete.
- Publish contact, organization, pricing, customer, performance, or compliance details only after owner verification.
- Do not add analytics or advertising tracking without the appropriate privacy, consent, and legal review.

## Measurement

After domain verification, use Search Console to monitor indexed pages, query impressions, clicks, and crawl issues. Track sign-up completion only with an owner-approved, privacy-reviewed measurement design. Reassess targets with actual data rather than assumed keyword metrics.
