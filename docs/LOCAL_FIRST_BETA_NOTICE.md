# XolveManager Local-First Beta Privacy Notice

XolveManager is a local-first beta. Business records are stored in the browser's
LocalStorage on the device and browser profile where they are entered. The
application does not provide a business-data backend or automatic
synchronization across devices. This does not mean that the application makes
no network requests: the app loads Google Fonts, is delivered by its hosting
provider, and can request remote logos or open external services.
Opening or reloading a record-detail URL can also send its record identifier
to the host as part of the ordinary page request.

Activity and audit history is stored in the same local browser storage and is
not automatically synchronized by the application. If you choose to share
information through an external service, that service receives the information
included in the link or message.

Sign-in and session state are also local to the browser. Local sign-in is a
convenience gate, not server-side authentication, access control, or a security
boundary. Anyone with access to the browser profile or device may be able to
access local records.

Demo and Production records use separate browser storage namespaces in this
browser profile. Demo mode is not a separate cloud account, device, or
server-side security boundary. Theme and language preferences are shared.

Create and retain regular downloadable backups using Data & Storage settings.
Keep backup files in a secure location; they may contain customer and business
records. Avoid storing highly sensitive information such as payment-card
numbers or government identifiers, and protect devices and browser profiles
that contain business data. Service-account usernames and passwords entered in
account records are also stored as ordinary browser data and may be included in
downloaded backups; do not treat the app as a secure password manager.

The public Privacy & Data Notice is available at `/legal/privacy` and the
Legal & Trust Center is at `/legal`. The privacy and data-backup pages describe
verified technical behavior; other policy pages are drafts that require
product-owner confirmation and appropriate legal review.
