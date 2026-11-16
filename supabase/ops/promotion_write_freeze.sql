-- OPERATIONAL SCRIPT, NOT A MIGRATION (lives outside supabase/migrations on purpose).
-- Freezes every write to the promotion tables until promotion_write_unfreeze.sql runs.
-- Reads are not blocked while it runs: CREATE OR REPLACE TRIGGER takes SHARE ROW EXCLUSIVE, which does not conflict
-- with the ACCESS SHARE lock of a SELECT (verified in the rehearsal while it waited for an in-flight writer).
-- It works at the table level, so it holds for any app version and survives migrations that re-grant function
-- privileges. Writers get SQLSTATE PS503 (the web API maps unknown codes to HTTP 503).
-- Only a session that is connected as the postgres role AND has set app.promotion_maintenance = 'on' may write
-- through it (the migration session); PostgREST connects as authenticator, so API traffic can never bypass.
-- BYPASS RULES. Run the migration from psql, connected directly or through a session-mode pooler, with
--   psql -X -v ON_ERROR_STOP=1 -c "set app.promotion_maintenance = 'on'" -f <migration.sql>
-- so the setting lives in that one session only. NEVER set it with ALTER ROLE or ALTER DATABASE: that lets every
-- postgres session through (dashboard SQL editor, pooled connections that outlive a reset). This script refuses to
-- freeze while such a persistent default exists. A client that logs in as another role and then SET ROLE postgres
-- (some CLI versions) does not satisfy the check; validate your migration path on the isolated backend first.
-- Creating the triggers waits for in-flight writers to finish (they hold ROW EXCLUSIVE); the lock_timeout makes the
-- script fail instead of queueing writers for long. If it times out, nothing changed: simply run it again.
begin;
set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from pg_db_role_setting s, unnest(s.setconfig) c where c like 'app.promotion\_maintenance=%') then
    raise exception 'app.promotion_maintenance is set as a persistent role/database default; reset it (alter role ... reset) and end the sessions that opened while it was set, then freeze again';
  end if;
end $$;

create or replace function private.promotion_write_freeze() returns trigger
language plpgsql set search_path = '' as $$
begin
  if session_user = 'postgres' and coalesce(current_setting('app.promotion_maintenance', true), '') = 'on' then
    if tg_level = 'STATEMENT' then return null; end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Promotion writes are frozen for maintenance' using errcode = 'PS503';
end; $$;
revoke all on function private.promotion_write_freeze() from public, anon, authenticated;

create or replace trigger promotion_write_freeze before insert or update or delete on public.promotion_campaigns
  for each row execute function private.promotion_write_freeze();
create or replace trigger promotion_write_freeze_truncate before truncate on public.promotion_campaigns
  for each statement execute function private.promotion_write_freeze();
create or replace trigger promotion_write_freeze before insert or update or delete on public.promotion_audit_events
  for each row execute function private.promotion_write_freeze();
create or replace trigger promotion_write_freeze_truncate before truncate on public.promotion_audit_events
  for each statement execute function private.promotion_write_freeze();

commit;
