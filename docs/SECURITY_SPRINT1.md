# Security Sprint 1 verification

## Trusted proxy rate limiting
The application intentionally ignores generic `x-forwarded-for` and `x-real-ip` headers.
Set `TRUSTED_PROXY_IP_HEADER` only when the deployment's **trusted edge** strips client-supplied copies and overwrites the selected header.
Allowed header names: `x-vercel-forwarded-for`, `cf-connecting-ip`, `true-client-ip`.
Without a trusted header, all callers share an `unknown` bucket. This fails closed but can cause broad rate limiting; verify edge configuration before production.

## Database
Apply the third migration after the two baseline migrations in a staging Supabase project.
Verify `anon` and `authenticated` cannot execute privileged functions (wallet posting, registration, withdrawal, admin role, rate limiting, audit events and payout account writes). Verify `authenticated` can only list its own payout accounts.

With two independent test accounts A and B, verify that A cannot SELECT or mutate B's player profile, wallet, wallet transactions, deposit intents, withdrawal requests, or responsible gaming settings. Repeat with B against A. Confirm service-role keys never reach the browser.

## Administrative access
Verify unauthenticated requests to /admin redirect; authenticated non-admins receive 404; viewer/admin/owner see only the read-only dashboard. Require explicit permission checks before adding any mutation routes.

## Financial integrity
Simulated withdrawal requests do not reserve balance; do not interpret multiple pending requests as settled funds. Test concurrent idempotency keys and balance conservation before implementing real payouts. Live payment adapters and provider game sessions remain disabled.

## Verification
Run `pnpm test`, `pnpm typecheck`, `pnpm build` and Playwright. Database isolation and concurrency require a separate staging Supabase environment; source tests alone cannot prove them.
