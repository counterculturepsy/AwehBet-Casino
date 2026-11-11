-- Promotion Studio database authorization and lifecycle tests.
-- Run only against the disposable database created by run_local.sh.
\set ON_ERROR_STOP on

create temp table _promotion_results(name text, ok boolean);
grant all on _promotion_results to public;

create or replace function pg_temp.expect_state(p_sql text, p_state text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into _promotion_results values (p_name, false);
  exception when others then
    insert into _promotion_results values (p_name, sqlstate = p_state);
  end;
end $$;

insert into auth.users(id,email) values
  ('cccccccc-0000-4000-8000-000000000001','admin@x.test'),
  ('dddddddd-0000-4000-8000-000000000002','owner@x.test'),
  ('eeeeeeee-0000-4000-8000-000000000003','viewer@x.test');
insert into private.admin_members(user_id,role) values
  ('cccccccc-0000-4000-8000-000000000001','admin'),
  ('dddddddd-0000-4000-8000-000000000002','owner'),
  ('eeeeeeee-0000-4000-8000-000000000003','viewer');

set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000003';
insert into _promotion_results
select 'viewer can list campaigns through the authorized RPC', count(*) = 0
from public.admin_list_promotions();
select pg_temp.expect_state(
  $q$select public.admin_create_promotion('Viewer draft','Denied','banner',0,'10000000-0000-4000-8000-000000000001',null,null)$q$,
  '42501', 'viewer cannot create a campaign');
select pg_temp.expect_state(
  $q$insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status) values(gen_random_uuid(),'eeeeeeee-0000-4000-8000-000000000003','created','draft')$q$,
  '42501', 'viewer cannot forge audit events');

set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000001';
select public.admin_create_promotion(
  'Admin draft','Free-to-play banner','banner',0,
  '10000000-0000-4000-8000-000000000002',null,null
) as admin_campaign_id \gset
select public.admin_create_promotion(
  'Admin draft','Free-to-play banner','banner',0,
  '10000000-0000-4000-8000-000000000002',null,null
) as admin_campaign_retry_id \gset
insert into _promotion_results values (
  'same idempotency key and payload returns the original campaign',
  :'admin_campaign_id'::uuid = :'admin_campaign_retry_id'::uuid
);
select pg_temp.expect_state(
  $q$select public.admin_create_promotion('Changed title','Free-to-play banner','banner',0,'10000000-0000-4000-8000-000000000002',null,null)$q$,
  '22023', 'idempotency key cannot be reused for different campaign data');
select public.admin_transition_promotion(:'admin_campaign_id'::uuid,'submit');
select pg_temp.expect_state(
  format('select public.admin_transition_promotion(%L::uuid,%L)', :'admin_campaign_id', 'submit'),
  '22023', 'duplicate submission is rejected by the state machine');

set request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000002';
select public.admin_transition_promotion(:'admin_campaign_id'::uuid,'approve');
select public.admin_create_promotion(
  'Owner draft','Owner-created campaign','banner',0,
  '10000000-0000-4000-8000-000000000003',null,null
) as owner_campaign_id \gset
select public.admin_transition_promotion(:'owner_campaign_id'::uuid,'submit');
select pg_temp.expect_state(
  format('select public.admin_transition_promotion(%L::uuid,%L)', :'owner_campaign_id', 'approve'),
  '42501', 'campaign creator cannot approve own campaign');
reset role;

insert into _promotion_results
select 'idempotent retry writes one campaign and one creation event',
  (select count(*) from public.promotion_campaigns where id=:'admin_campaign_id'::uuid) = 1
  and (select count(*) from public.promotion_audit_events where campaign_id=:'admin_campaign_id'::uuid and action='created') = 1;
insert into _promotion_results
select 'approval records separate reviewer and immutable lifecycle state',
  status='approved'
  and created_by='cccccccc-0000-4000-8000-000000000001'::uuid
  and reviewed_by='dddddddd-0000-4000-8000-000000000002'::uuid
  and reviewed_at is not null
from public.promotion_campaigns where id=:'admin_campaign_id'::uuid;
insert into _promotion_results
select 'campaign audit history contains created submitted and approved events',
  count(*)=3
from public.promotion_audit_events where campaign_id=:'admin_campaign_id'::uuid;

set role anon;
reset request.jwt.claim.sub;
select pg_temp.expect_state(
  $q$select * from public.admin_list_promotions()$q$,
  '42501', 'anonymous caller cannot list campaigns');
reset role;

select case when ok then 'PASS' else 'FAIL' end as result, name
from _promotion_results order by ok, name;
do $$
begin
  if exists (select 1 from _promotion_results where not ok) then
    raise exception 'PROMOTION SECURITY TESTS FAILED';
  end if;
end $$;
