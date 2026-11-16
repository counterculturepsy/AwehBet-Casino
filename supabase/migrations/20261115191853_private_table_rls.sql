-- Row level security on the server-only private.* tables created by 20261016140000_player_accounts.sql.
-- The hosted Development project already has this through a migration recorded only there (version 20261016131151,
-- enable_private_table_rls). The repository never contained it, so a database built from the repository alone left
-- these five tables without RLS. This forward migration closes that gap. It is idempotent: on a database that already
-- has RLS enabled it changes nothing. No policies are added on purpose: API roles must have no access, and the service
-- role and the SECURITY DEFINER functions (owned by the table owner, who bypasses RLS unless it is forced) are unaffected.
begin;

alter table private.player_identities enable row level security;
alter table private.payout_accounts enable row level security;
alter table private.kyc_reviews enable row level security;
alter table private.audit_events enable row level security;
alter table private.rate_limit_buckets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['player_identities','payout_accounts','kyc_reviews','audit_events','rate_limit_buckets'] loop
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'private' and c.relname = t) then
      raise exception 'row level security is not enabled on private.%', t;
    end if;
  end loop;
end $$;

commit;
