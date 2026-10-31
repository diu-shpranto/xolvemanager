# XolveManager SEO Setup Guide

## Origin and deployment

The current configured origin is `https://xolvemanager.vercel.app`. `NEXT_PUBLIC_SITE_URL` can override it after a custom origin is verified.

1. Confirm domain ownership and the final HTTPS origin with the product owner.
2. Configure `NEXT_PUBLIC_SITE_URL` in the deployment environment as an origin only, for example `https://example.com`. Do not include a path, query, credentials, or fragment.
3. Set the value before the Next.js build and rebuild/redeploy so generated metadata, robots, and sitemap use the intended origin.
4. Leave the default in place if a custom domain has not been approved. Do not configure a guessed domain.

The origin parser permits HTTP only for localhost development; public origins must use HTTPS. Invalid configured values fail explicitly rather than generating malformed canonical links.

## Verify the generated public surfaces

After a reviewed deployment, check these routes in a browser and with an HTTP client:

- `/` - server-rendered homepage, canonical URL, indexable robots metadata, Open Graph/Twitter preview, and WebSite/SoftwareApplication JSON-LD
- `/robots.txt` - crawl policy and absolute sitemap URL
- `/sitemap.xml` - exactly the homepage, privacy disclosure, and data-backup disclosure
- `/legal/privacy` and `/legal/data-backup` - canonical URL and indexable metadata
- `/login`, `/signup`, app routes, `/support`, draft policy routes, and not-found route - noindex metadata
- `/manifest.webmanifest` - PWA start URL is `/login`

Robots directives are not access control. Do not put private business data or credentials in crawlable routes.

## Search Console

1. Create a property for the verified HTTPS origin in Google Search Console. Prefer a Domain property when the owner can verify DNS; otherwise use the exact URL-prefix property.
2. Complete Google's verification using the method selected by the owner. Do not commit verification tokens or secrets to the repository.
3. Submit `https://<verified-origin>/sitemap.xml`.
4. Inspect the homepage and technical disclosures. Confirm the selected canonical, rendered content, status code, and robots directives.
5. Monitor indexing and coverage reports; request indexing only after the owner has reviewed the public pages.

Search Console ownership, verification, sitemap submission, indexing, and rankings have not been completed by this source change.

## Analytics and previews

No analytics integration is added. Before selecting analytics or advertising tools, review the data collected, consent obligations, privacy notice, and any regional requirements.

The existing branded social image is used for previews; it is not a product screenshot. Replace it only with an accurate, sanitized image and verify the dimensions and rendered preview. Check Open Graph and Twitter metadata after deployment.

## Operational checks

- Keep public page content accurate when product storage or authentication behavior changes.
- Keep legal drafts noindex until they are owner-approved; do not represent technical notes as legal advice.
- Review mobile usability, keyboard access, image loading, and deployed Core Web Vitals.
- Search Console and external preview/debug tools are external manual steps; this guide does not claim successful verification or indexing.
