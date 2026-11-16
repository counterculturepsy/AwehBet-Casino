# Admin operations pages (read-only)

Added 2026-11-16. Five pages under `/admin`, all behind `requireAdmin()` (signed-out users go to login, signed-in non-admins get a 404).

| Page | Shows | Data source |
| --- | --- | --- |
| `/admin/players`, `/admin/players/[id]` | Search, verification filter, profile, wallet, limits, recent requests, history | `player_profiles`, `wallets`, `responsible_gaming_settings`, `deposit_intents`, `withdrawal_requests`, plus the two functions below |
| `/admin/payments` | Deposit and withdrawal requests with status filter | `deposit_intents`, `withdrawal_requests` |
| `/admin/verification` | Players waiting for KYC, latest review records | `player_profiles`, `admin_list_kyc_reviews` |
| `/admin/audit` | Audit events with event and player filters, keyset paging | `admin_list_audit_events` |
| `/admin/games` | The lobby catalogue, provider-site demo link status, launch authorisation | code (`slots-lobby-games.ts`, `official-demo-links.ts`, `provider-compliance.ts`) |

## Rules these pages follow
- Nothing writes. There are no forms that change data and no admin API routes were added.
- Identity documents, ID numbers and payout account details are never queried.
- The `viewer` role sees masked email and phone and no audit event details. `admin` and `owner` see them in full.
- Every filter value is checked against an allowlist or a strict pattern before it reaches a query.

## Database migration required
`supabase/migrations/20261116090000_admin_readonly_views.sql` adds `admin_list_audit_events` and `admin_list_kyc_reviews`. They are `security definer`, callable by `service_role` only, and re-check the acting user's admin role. Until the migration is applied the audit log, the review records and the per-player history show an "unavailable" message; every other page works without it.

Apply it through the normal release process, then run `supabase/tests/run_local.sh hardened` against a throwaway database to confirm.
