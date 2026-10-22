-- AwehBet security hardening (PROPOSED - NOT APPLIED to any Supabase project).
-- Review before applying. Every statement is idempotent and can be rolled back
-- with supabase/rollback/20261022170000_security_hardening.rollback.sql.
--
-- Evidence this is safe (see repo inspection):
--   * All writes to the six public player tables go through createServiceSupabaseClient()
--     (service_role). The cookie/session client only performs SELECTs on them,
--     plus rpc('list_own_payout_accounts').
--   * create_player_wallet() is only invoked by the player_profile_wallet_trigger.
--     Postgres checks EXECUTE on a trigger function at CREATE TRIGGER time, not
--     when the trigger fires, so revoking EXECUTE does not break registration.
--   * get_admin_role() is already restricted to service_role and is untouched.
begin;

-- 1. Finding A: trigger function must not be callable through the API.
revoke all on function public.create_player_wallet() from public, anon, authenticated;

-- 1b. list_own_payout_accounts() is a legitimate authenticated RPC (filters by
--     auth.uid(), returns masked columns only, used by lib/account.ts).
--     Keep it for authenticated; make sure anon/public cannot execute it.
--     The Supabase advisor warning for this function is an accepted, documented risk.
revoke all on function public.list_own_payout_accounts() from public, anon;
grant execute on function public.list_own_payout_accounts() to authenticated;

-- 2. Finding D: least-privilege table grants. RLS stays as the second layer.
--    Players: SELECT only (own rows via existing policies). anon: nothing.
revoke all on table
  public.player_profiles,
  public.wallets,
  public.wallet_transactions,
  public.deposit_intents,
  public.withdrawal_requests,
  public.responsible_gaming_settings
from public, anon, authenticated;

grant select on table
  public.player_profiles,
  public.wallets,
  public.wallet_transactions,
  public.deposit_intents,
  public.withdrawal_requests,
  public.responsible_gaming_settings
to authenticated;

-- service_role keeps full access for server-controlled workflows.
grant select, insert, update, delete on table
  public.player_profiles,
  public.wallets,
  public.wallet_transactions,
  public.deposit_intents,
  public.withdrawal_requests,
  public.responsible_gaming_settings
to service_role;

-- 3. Finding B: defence in depth for the admin membership table.
--    No policies are created, so only roles that bypass RLS (service_role, and
--    the table owner used by SECURITY DEFINER get_admin_role) can read it.
alter table private.admin_members enable row level security;

commit;
