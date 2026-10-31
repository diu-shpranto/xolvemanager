# XolveManager SEO Audit

## Scope and evidence

This source-level audit covers the Next.js App Router, route metadata, public legal and support pages, product configuration, PWA behavior, and the Local-First product disclosures. It does not represent a crawl of a production deployment, a backlink analysis, a Core Web Vitals measurement, or a legal review.

The configured default public origin is `https://xolvemanager.vercel.app`. A custom origin is not assumed; it must be verified before it is configured.

## Findings and implementation

| Area | Finding before implementation | Resolution |
|---|---|---|
| Public entry page | `/` rendered the client application shell, which depends on browser-side rendering and local sign-in. | `/` is now a server-rendered, crawlable product landing page. Application entry remains available at `/login`. |
| Metadata and canonical origin | The site origin and social image metadata were conditional on `NEXT_PUBLIC_SITE_URL`; canonical metadata was not consistently available. | A validated HTTPS origin defaults to the current Vercel URL. The homepage, legal pages, sitemap, robots route, and social metadata share this origin. |
| Indexing controls | The root layout marked all child routes `noindex,nofollow`; there were no robots or sitemap routes. | Homepage and the technical privacy/data-backup disclosures are indexable. App, support, legal drafts, and not-found pages remain noindex. A sitemap allowlist contains only the three approved public URLs. |
| Structured data | No public product page or structured data was present. | The homepage emits WebSite and SoftwareApplication JSON-LD using verified product fields. Organization ownership, pricing, ratings, reviews, and contact details are intentionally omitted. |
| Product claims | Product capabilities need to be described consistently with the actual Local-First implementation. | Landing-page copy distinguishes payment records from payment processing and states that business data does not automatically sync to cloud servers. It also explains local authentication and backup limitations. |
| App launch | The PWA manifest launched at `/`, which becomes the public marketing page. | The manifest starts at `/login`; offline navigation tries a cached app entry before the public homepage. |
| Contact and ownership | No verified support email, social destination, feedback endpoint, legal entity, or custom domain is configured. | No such details are invented or added to metadata or structured data. Manual owner review remains required. |

## Current indexation policy

Indexable:

- `/`
- `/legal/privacy`
- `/legal/data-backup`

Not indexable:

- App routes, including authentication and business-record routes
- `/support` and the legal center
- Draft policy pages, including terms, refunds, and disclaimer drafts
- Not-found pages

The app's `noindex` metadata is a crawl/indexing directive, not access control. The current authentication model is local to the browser and is not server-side authorization.

## Technical and content risks

- Records remain in browser storage, can be lost when browser data is removed, and do not automatically synchronize between devices.
- Downloaded backups can include sensitive business and service-account data; users must protect them.
- Product screenshots suitable for search and social previews were not available during this implementation. The existing branded social image is used instead.
- Google Fonts are loaded from Google-hosted domains. No production network, hosting-log, analytics, or consent audit was performed here.
- Search volumes, keyword difficulty, competitor rankings, backlinks, and Search Console performance were not measured. Keyword choices in `SEO_KEYWORD_MAP.md` are hypotheses, not metric-backed forecasts.
- Policy disclosures are technical summaries and are not a substitute for product-owner and legal review.

## Follow-up before relying on search traffic

1. Verify the canonical domain and hosting/DNS configuration with the product owner.
2. Review privacy, contact, and policy disclosures with the responsible owner and legal counsel.
3. Configure Google Search Console for the verified origin, submit `/sitemap.xml`, and inspect the rendered canonical and robots directives.
4. Capture real, sanitized product screenshots and replace the preview image only after review.
5. Measure deployed performance and accessibility on representative mobile devices.
6. Revisit keyword priorities after collecting real query and conversion data.
