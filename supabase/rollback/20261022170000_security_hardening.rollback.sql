-- Rollback for 20261022170000_security_hardening.sql (restores the previous, broader grants).
-- Only use if the hardening breaks a verified legitimate flow; prefer fixing forward.
begin;
alter table private.admin_members disable row level security;
grant all on table
  public.player_profiles, public.wallets, public.wallet_transactions,
  public.deposit_intents, public.withdrawal_requests, public.responsible_gaming_settings
to anon, authenticated;
grant execute on function public.create_player_wallet() to anon, authenticated;
commit;
