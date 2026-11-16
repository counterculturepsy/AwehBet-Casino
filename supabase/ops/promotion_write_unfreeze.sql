-- OPERATIONAL SCRIPT, NOT A MIGRATION. Reopens promotion writes. Run only after the verification gate in the
-- release plan has passed. Safe to run when no freeze is active.
-- DROP TRIGGER takes an ACCESS EXCLUSIVE lock, so while a freeze is installed this script can briefly queue reads
-- as well as writes (at most the 5 second lock_timeout; if it times out nothing changed, re-run it). When no freeze
-- is installed it takes no table lock at all.
begin;
set local lock_timeout = '5s';
do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.promotion_campaigns'::regclass and tgname like 'promotion\_write\_freeze%') then
    drop trigger if exists promotion_write_freeze on public.promotion_campaigns;
    drop trigger if exists promotion_write_freeze_truncate on public.promotion_campaigns;
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.promotion_audit_events'::regclass and tgname like 'promotion\_write\_freeze%') then
    drop trigger if exists promotion_write_freeze on public.promotion_audit_events;
    drop trigger if exists promotion_write_freeze_truncate on public.promotion_audit_events;
  end if;
end $$;
drop function if exists private.promotion_write_freeze();
commit;
