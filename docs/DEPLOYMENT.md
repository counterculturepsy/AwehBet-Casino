# Development deployment and verification

## Required configuration

Copy `.env.example` to `.env.local` for local development and provide values through the hosting platform for previews. Never commit `.env.local`.

- `NEXT_PUBLIC_SUPABASE_URL`: development Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: project anon/publishable key. This is the only Supabase key allowed in browser code.
- `NEXT_PUBLIC_SITE_URL`: exact HTTPS origin in deployed environments.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only administrative key.
- `PLAYER_DATA_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hexadecimal characters.
- `PLAYER_IDENTITY_HASH_SECRET`: separate random secret of at least 32 characters.
- `PAYMENTS_ENABLED`, `WITHDRAWALS_ENABLED`, `KYC_UPLOADS_ENABLED`: keep `false`. Setting payment flags true does not enable a provider; routes fail closed.

## Supabase setup

1. Create a dedicated non-production project in an approved region after the data-residency assessment.
2. Apply `supabase/migrations/20261016140000_player_accounts.sql` through the Supabase CLI or reviewed migration pipeline.
3. Configure the Site URL and redirect allowlist for `/auth/callback` on localhost and each exact Vercel preview/production origin.
4. Require email confirmation, configure a verified email sender, set expiry/session controls, and enable Supabase abuse/CAPTCHA protections.
5. Confirm the Data API exposes only the intended public schema. Do not expose the `private` schema.
6. Verify RLS with two test users: neither can read the other’s profile, wallet, transactions, deposits, withdrawals, or responsible-gaming settings.
7. Verify that authenticated users cannot insert/update/delete wallet or KYC records through the Data API.

## Local checks

```text
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

Browser journeys to verify after Supabase is configured:

1. Register with a fictional adult test identity; confirm the email; sign in; sign out.
2. Reject invalid email, weak/mismatched password, underage date, invalid ID checksum, duplicate email, duplicate identity, and duplicate phone.
3. Request and complete password recovery; verify old recovery links expire as configured.
4. Confirm `/account` redirects when signed out and persists securely after refresh when signed in.
5. Confirm profile/dashboard values come from the authenticated user, not fixtures.
6. Create a demo deposit reference and verify that balance remains unchanged and no external request occurs.
7. Confirm withdrawal remains blocked without verified KYC, verified payout account, and available simulated balance.
8. Confirm responsible-gaming restrictions persist and cannot be shortened through the player route.
9. Re-test `/`, `/slots`, registration, dashboard, deposit and withdrawal layouts on mobile and desktop.

## Production blockers

No production deployment may enable real-money functionality until the legal/licensing position, FIC registration and RMCP, POPIA governance, KYC provider, payment/acquiring approval, responsible-gambling operations, private file storage, staff authorization, webhook/reconciliation implementation, penetration test, incident response, and end-to-end live-provider certification are complete.
