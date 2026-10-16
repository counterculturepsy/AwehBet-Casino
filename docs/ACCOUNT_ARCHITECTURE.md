# AwehBet player-account architecture

## Status

This branch is a secure development-stage foundation. Supabase credentials and the migration are required for end-to-end authentication. The application deliberately cannot accept or pay real money.

| Capability | Current state |
| --- | --- |
| Registration and email/password auth | Implemented against Supabase Auth; requires project configuration and email templates |
| Email verification and recovery | Implemented using PKCE callback and cookie-backed SSR sessions |
| Player profile | Implemented; public-schema record is owner-readable, sensitive identity data is separate |
| Identity document | Format validation plus AES-256-GCM encryption at rest in the private schema; this is not KYC proof |
| KYC | Status model and fail-closed UI implemented; uploads and provider transitions disabled |
| Wallet | One ZAR wallet per user, integer minor units, owner-read-only RLS, atomic idempotent ledger function |
| Deposits | Simulated intent/reference records only; no provider calls and no wallet credit |
| Withdrawals | Simulated request architecture; requires verified KYC, verified payout account, and balance |
| Responsible gaming | Deposit limits, cooling-off, and self-exclusion persistence implemented |
| Real payments/wagering | Disabled and not implemented |

## Trust boundaries

The browser never receives the Supabase service-role key, encryption key, identity fingerprint secret, full identity number after submission, wallet mutation capability, full bank-account number after submission, or KYC-review capability.

Authenticated browser and Server Component reads are restricted by PostgreSQL row-level security. Server routes verify the Supabase user with `auth.getUser()`, require same-origin requests, validate input with Zod, and consume a database-backed rate-limit bucket before privileged operations. Service-role access is limited to server-only modules.

Identity and payout-account numbers are encrypted in the application before storage with AES-256-GCM. A separate HMAC-SHA256 fingerprint supports duplicate detection without deterministic encryption. Encryption and fingerprint keys must be unrelated, rotated under an approved key-management plan, and never logged.

## Authentication flow

1. Registration is validated server-side, including adult date, document format, phone, email, password strength, terms, and privacy acknowledgement.
2. Supabase Auth creates the unverified user and sends the configured verification email.
3. A service-only database function atomically creates the public profile, private identity record, wallet, responsible-gaming settings, and audit event.
4. If profile creation fails, the route attempts to remove the newly created Auth user so no partial account remains.
5. The `/auth/callback` route exchanges the PKCE code for a cookie-backed session.
6. Middleware refreshes sessions and denies unauthenticated `/account/*` access.

Supabase Auth controls password hashing, verification tokens, recovery tokens, session expiry, and refresh rotation. Production configuration must set appropriate password policy, CAPTCHA/abuse controls, email templates, redirect allowlists, and session timeouts.

## Wallet and payment invariants

- Every amount is an integer number of cents and every current record is ZAR.
- The browser has no insert/update/delete policy for wallets or ledger entries.
- `post_wallet_transaction` locks the wallet row, rejects non-positive or overdrawn entries, rejects non-simulated entries, and returns the original ledger entry for a repeated wallet/idempotency-key pair.
- A deposit preview creates only a simulated `deposit_intent`; it does not create a completed transaction or credit a wallet.
- A withdrawal request cannot be created unless KYC and payout-account verification were completed by an authorised workflow.
- Provider callbacks are intentionally absent. A future adapter must verify its signature, compare server-authoritative amount/currency/ownership, store the raw provider event outside logs, deduplicate it, and reconcile uncertain states before calling the ledger function.

## KYC and staff operations still required

No public API can transition `kyc_status` to `verified`. Before enabling KYC uploads, implement an approved provider, private object storage, malware scanning, short retention, deletion schedules, a staff role/claims model, least-privilege review screens, immutable decisions, access audits, data-subject workflows, and incident response.

## Integration discipline

The account branch does not edit `apps/web/src/app/slots/page.tsx` or provider-game API code. Future integration should merge Slots Masters work into this branch or a fresh integration branch, resolve only homepage/auth entry-point ancestry, and rerun the complete verification suite.
