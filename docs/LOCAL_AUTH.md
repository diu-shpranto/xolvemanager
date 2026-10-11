# Local authentication

XolveManager stores its single owner account and sign-in sessions in separate, versioned browser-storage keys. The first valid sign-up creates the owner; additional public registrations are disabled because the application does not have a multi-user permission model. Existing business records are not touched by account creation, sign-in, sign-out, or password recovery.

Passwords and recovery keys are verified using PBKDF2-SHA-256 with a unique 128-bit random salt and 600,000 iterations. A random recovery key is shown only after account creation or successful password recovery. Save the current key securely: it is not stored in plaintext and cannot be emailed or retrieved later. Recovery rotates the key, replaces the password verifier, and invalidates existing sessions.

Sign-in persists until explicit sign-out. A local session identifier is generated with the Web Crypto API; it is not derived from the email address or password. Explicit sign-out is synchronized to other open tabs where browser storage events are available.

**This is not server-side authentication.** Account and session data exist only in this browser profile. Someone with access to the device/profile or execution of same-origin script can bypass or alter this local-only gate. Clearing or losing browser storage may make the account unrecoverable. Use device-level protection and keep a recovery key outside this browser. Authentication records are not part of business-data exports.

The login, setup, and recovery screens use the saved English/Bangla language preference. For environments without browser storage or secure Web Crypto, authentication reports that it is unavailable instead of silently creating an account.
