# XolveKart product directory

The About page's **Part of the XolveKart Ecosystem** section currently reads from the typed configuration in `src/config/productDirectory.ts` through the provider interface in `src/services/productDirectoryService.ts`.

This repository contains no shared XolveKart directory API, parent-brand logo, or verified product URLs. The local directory therefore lists only XolveManager, uses its existing configured product icon, and renders a text-and-icon fallback for the parent brand. Unverified products such as Xolve Drift are intentionally not listed.

To add a locally configured product, add a stable ID, accurate description, status (`active`, `planned`, or `coming-soon`), and only a verified HTTPS URL and available logo to the `products` array. The change ships with this application; it does not propagate to other product websites automatically.

When XolveKart provides a real shared directory, implement a `ProductDirectoryProvider` in `src/services/productDirectoryService.ts` that maps its documented response into the existing `ProductDirectory` type, then make that provider the default. Do not add a guessed API URL or credentials to this client-side application. Central editing should use the actual shared persistence service with server-side authorization; this page is read-only and does not provide an admin interface.
