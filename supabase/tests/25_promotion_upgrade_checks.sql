-- Post-upgrade checks: data seeded by 15_promotion_upgrade_seed.sql under the original shared schema must
-- survive the forward migration and work through the Studio RPCs. `upgrade` mode only, disposable database.
\set ON_ERROR_STOP on

create temp table _upgrade_results(name text, ok boolean);
grant all on _upgrade_results to public;

create or replace function pg_temp.expect_state(p_sql text, p_state text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into _upgrade_results values (p_name, false);
  exception when others then
    insert into _upgrade_results values (p_name, sqlstate = p_state);
  end;
end $$;

-- ---- Data and schema as seen by a superuser ------------------------------------------------------------
insert into _upgrade_results
select 'legacy campaigns are preserved with their status and reviewer',
  (select count(*) from public.promotion_campaigns) = 3
  and (select status from public.promotion_campaigns where id = 'b0b0b0b0-0000-4000-8000-000000000001') = 'draft'
  and (select status from public.promotion_campaigns where id = 'b0b0b0b0-0000-4000-8000-000000000002') = 'submitted'
  and (select reviewed_by from public.promotion_campaigns where id = 'b0b0b0b0-0000-4000-8000-000000000003') = 'a0a0a0a0-0000-4000-8000-000000000002';
insert into _upgrade_results
select 'legacy campaigns start at version 1 with distinct non-null idempotency keys, no provenance',
  bool_and(version = 1 and idempotency_key is not null and duplicated_from is null) and count(distinct idempotency_key) = 3
from public.promotion_campaigns;
insert into _upgrade_results
select 'legacy audit events are preserved and their new columns are empty',
  count(*) = 6 and bool_and(campaign_version is null and changed_fields is null and related_campaign_id is null)
from public.promotion_audit_events;
insert into _upgrade_results
select 'new columns have exactly the expected definitions',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and (table_name, column_name, data_type, is_nullable) in (
      ('promotion_campaigns','idempotency_key','uuid','NO'), ('promotion_campaigns','duplicated_from','uuid','YES'),
      ('promotion_campaigns','version','integer','NO'), ('promotion_audit_events','campaign_version','integer','YES'),
      ('promotion_audit_events','changed_fields','ARRAY','YES'), ('promotion_audit_events','related_campaign_id','uuid','YES'))) = 6
  and (select column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'promotion_campaigns' and column_name = 'version') = '1';
insert into _upgrade_results
select 'idempotency uniqueness is enforced per creator',
  exists (select 1 from pg_constraint where conrelid = 'public.promotion_campaigns'::regclass
          and conname = 'promotion_campaign_creator_idempotency' and contype = 'u');
insert into _upgrade_results
select 'audit action allowlist now includes edited and duplicated',
  pg_get_constraintdef(oid) like '%edited%' and pg_get_constraintdef(oid) like '%duplicated%'
from pg_constraint where conrelid = 'public.promotion_audit_events'::regclass and conname = 'promotion_audit_events_action_check';
insert into _upgrade_results
select 'campaign and audit indexes were rebuilt with the keyset ordering',
  (select indexdef from pg_indexes where indexname = 'promotion_campaigns_created_idx') like '%(created_at DESC, id DESC)'
  and (select indexdef from pg_indexes where indexname = 'promotion_campaigns_updated_idx') like '%(updated_at DESC, id DESC)'
  and (select indexdef from pg_indexes where indexname = 'promotion_audit_campaign_idx') like '%(campaign_id, id DESC)';
insert into _upgrade_results
select 'superseded overloads are gone and the new ones exist',
  to_regprocedure('public.admin_transition_promotion(uuid,text)') is null
  and to_regprocedure('public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz)') is null
  and to_regprocedure('public.admin_transition_promotion(uuid,text,integer)') is not null
  and to_regprocedure('public.admin_create_promotion(text,text,text,integer,uuid,timestamptz,timestamptz)') is not null;

-- ---- Grants, ownership and append-only audit ----------------------------------------------------------
insert into _upgrade_results
select 'API roles have no direct table access; service_role has only the narrow grants',
  not has_table_privilege('anon', 'public.promotion_campaigns', 'select')
  and not has_table_privilege('authenticated', 'public.promotion_campaigns', 'select')
  and not has_table_privilege('authenticated', 'public.promotion_audit_events', 'insert')
  and has_table_privilege('service_role', 'public.promotion_campaigns', 'update')
  and not has_table_privilege('service_role', 'public.promotion_campaigns', 'delete')
  and has_table_privilege('service_role', 'public.promotion_audit_events', 'insert')
  and not has_table_privilege('service_role', 'public.promotion_audit_events', 'update')
  and not has_table_privilege('service_role', 'public.promotion_audit_events', 'delete');
insert into _upgrade_results
select 'every RPC is security definer with an empty search_path and no anon/public execute',
  count(*) = 8
  and bool_and(p.prosecdef and coalesce(p.proconfig, '{}') @> array['search_path=""']
               and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('public', p.oid, 'execute')
               and has_function_privilege('authenticated', p.oid, 'execute'))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion','admin_update_promotion',
  'admin_duplicate_promotion','admin_list_promotions','admin_search_promotions','admin_get_promotion','admin_promotion_history');
insert into _upgrade_results
select 'all promotion RPCs share one owner (replaced and new functions alike)',
  count(distinct p.proowner) = 1
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion','admin_update_promotion',
  'admin_duplicate_promotion','admin_list_promotions','admin_search_promotions','admin_get_promotion','admin_promotion_history');
select pg_temp.expect_state($q$update public.promotion_audit_events set new_status = new_status$q$, '42501', 'legacy audit rows are now immutable (update)');
select pg_temp.expect_state($q$delete from public.promotion_audit_events$q$, '42501', 'legacy audit rows are now immutable (delete)');
select pg_temp.expect_state($q$truncate public.promotion_audit_events$q$, '42501', 'legacy audit rows are now immutable (truncate)');

-- ---- Legacy rows through the Studio RPCs ----------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'a0a0a0a0-0000-4000-8000-000000000001';
insert into _upgrade_results
select 'creator admin can read a legacy draft with version 1 and edit/submit offered',
  g.version = 1 and g.allowed_actions @> array['edit','submit']
from public.admin_get_promotion('b0b0b0b0-0000-4000-8000-000000000001') g;
select public.admin_update_promotion('b0b0b0b0-0000-4000-8000-000000000001', 1, 'Legacy draft edited', 'Created before the upgrade', 'banner', 0, null, null) as legacy_v \gset
insert into _upgrade_results values ('editing a legacy draft advances it to version 2', :legacy_v = 2);
select pg_temp.expect_state($q$select public.admin_transition_promotion('b0b0b0b0-0000-4000-8000-000000000001','submit',1)$q$,
  'PS409', 'submitting a legacy draft with its pre-edit version is a version conflict');
select pg_temp.expect_state($q$select public.admin_transition_promotion('b0b0b0b0-0000-4000-8000-000000000001','submit')$q$,
  '22023', 'submitting a legacy draft without a version is rejected');
select public.admin_transition_promotion('b0b0b0b0-0000-4000-8000-000000000001', 'submit', 2);
set request.jwt.claim.sub = 'a0a0a0a0-0000-4000-8000-000000000002';
select public.admin_transition_promotion('b0b0b0b0-0000-4000-8000-000000000002', 'approve');
select pg_temp.expect_state($q$select public.admin_transition_promotion('b0b0b0b0-0000-4000-8000-000000000003','approve')$q$,
  '22023', 'an already approved legacy campaign cannot be approved again');
insert into _upgrade_results
select 'history of a legacy campaign shows old and new events together',
  count(*) = 3 and bool_or(action = 'approved' and campaign_version = 2) and bool_or(action = 'created' and campaign_version is null)
from public.admin_promotion_history('b0b0b0b0-0000-4000-8000-000000000002');
reset role;
insert into _upgrade_results
select 'legacy campaign edit was audited with field names only',
  exists (select 1 from public.promotion_audit_events
          where campaign_id = 'b0b0b0b0-0000-4000-8000-000000000001' and action = 'edited'
            and campaign_version = 2 and changed_fields = array['title']);

select case when ok then 'PASS' else 'FAIL' end as result, name from _upgrade_results order by ok, name;
do $$
begin
  if exists (select 1 from _upgrade_results where not ok) then
    raise exception 'PROMOTION UPGRADE CHECKS FAILED';
  end if;
end $$;
