-- Sprint 1: explicitly enforce privileged RPC execution grants.
-- Idempotent: may be applied after the two baseline migrations.
begin;
-- Trigger function must not be callable through the public API.
revoke all on function public.create_player_wallet() from public, anon, authenticated;
revoke all on function public.consume_rate_limit(char(64), text, integer, integer) from public, anon, authenticated;
revoke all on function public.post_wallet_transaction(uuid, public.transaction_direction, bigint, text, public.transaction_status, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.register_player_profile(uuid, text, text, date, char(2), text, text, boolean, text, text, char(64), char(4), char(2)) from public, anon, authenticated;
revoke all on function public.record_audit_event(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_payout_account(uuid, text, text, text, char(64), char(4)) from public, anon, authenticated;
revoke all on function public.create_simulated_withdrawal(uuid, uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.get_admin_role(uuid) from public, anon, authenticated;
revoke all on function public.list_own_payout_accounts() from public, anon;
grant execute on function public.list_own_payout_accounts() to authenticated;
-- Supabase service_role retains EXECUTE as granted by baseline migrations.
commit;
