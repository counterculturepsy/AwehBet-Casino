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

-- Rows that already exist (none on a fresh chain, the seeded legacy rows in upgrade mode) must all be listable.
select count(*) as preexisting_campaigns from public.promotion_campaigns \gset
set role authenticated;
set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000003';
insert into _promotion_results
select 'viewer can list campaigns through the authorized RPC', count(*) = :preexisting_campaigns
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
select public.admin_transition_promotion(:'admin_campaign_id'::uuid,'submit',1);
select pg_temp.expect_state(
  format('select public.admin_transition_promotion(%L::uuid,%L,2)', :'admin_campaign_id', 'submit'),
  '22023', 'duplicate submission is rejected by the state machine');

set request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000002';
select public.admin_transition_promotion(:'admin_campaign_id'::uuid,'approve');
select public.admin_create_promotion(
  'Owner draft','Owner-created campaign','banner',0,
  '10000000-0000-4000-8000-000000000003',null,null
) as owner_campaign_id \gset
select public.admin_transition_promotion(:'owner_campaign_id'::uuid,'submit',1);
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

-- =====================================================================================================
-- Milestone 2: draft editing, optimistic concurrency, duplication, search/pagination, history, roles
-- =====================================================================================================
\set admin  'cccccccc-0000-4000-8000-000000000001'
\set owner  'dddddddd-0000-4000-8000-000000000002'
\set viewer 'eeeeeeee-0000-4000-8000-000000000003'
\set admin2 'ffffffff-0000-4000-8000-000000000004'
\set nobody '99999999-0000-4000-8000-000000000005'
insert into auth.users(id,email) values
  (:'admin2','admin2@x.test'),
  (:'nobody','nobody@x.test');
-- :admin2 is a second, unrelated admin. :nobody is an authenticated user with NO admin role.
insert into private.admin_members(user_id,role) values (:'admin2','admin');

create or replace function pg_temp.check_actions(p_name text, p_campaign uuid, p_expected text[])
returns void language plpgsql as $$
begin
  insert into _promotion_results
  select p_name, coalesce((select s.allowed_actions from public.admin_search_promotions(p_search => p_campaign::text) s
                           where s.id = p_campaign) = p_expected, false);
end $$;

-- ---- Draft editing and optimistic concurrency ------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = :'admin';
select public.admin_create_promotion('Edit target','Original description','banner',0,'20000000-0000-4000-8000-000000000001',null,null) as edit_id \gset
select public.admin_update_promotion(:'edit_id'::uuid,1,'Edited title','Original description','banner',0,null,null) as v_after_edit \gset
reset role;
insert into _promotion_results
select 'authorised edit applies the change and advances the version 1 -> 2',
  :v_after_edit = 2 and c.version = 2 and c.title = 'Edited title' and c.status = 'draft'
  and c.created_by = :'admin'::uuid and c.reviewed_by is null and c.reviewed_at is null
from public.promotion_campaigns c where c.id = :'edit_id'::uuid;
insert into _promotion_results
select 'edit writes exactly one audit event naming only the changed field',
  count(*) = 1 and bool_and(changed_fields = array['title']::text[] and campaign_version = 2
    and actor_id = :'admin'::uuid and previous_status = 'draft' and new_status = 'draft')
from public.promotion_audit_events where campaign_id = :'edit_id'::uuid and action = 'edited';

set role authenticated;
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,1,%L,%L,%L,0,null,null)', :'edit_id', 'Stale overwrite', 'Original description', 'banner'),
  'PS409', 'stale edit is rejected with a version conflict');
reset role;
insert into _promotion_results
select 'stale edit changes nothing and writes no audit event',
  c.version = 2 and c.title = 'Edited title'
  and (select count(*) from public.promotion_audit_events where campaign_id = c.id and action = 'edited') = 1
from public.promotion_campaigns c where c.id = :'edit_id'::uuid;

-- Two editors read version 2. The owner saves first; the creator's save with the old version must lose.
set role authenticated;
set request.jwt.claim.sub = :'owner';
select public.admin_update_promotion(:'edit_id'::uuid,2,'Owner edit','Original description','banner',0,null,null) as v_owner_edit \gset
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,2,%L,%L,%L,0,null,null)', :'edit_id', 'Creator lost update', 'Original description', 'banner'),
  'PS409', 'second editor holding an old version cannot overwrite a newer edit');
reset role;
insert into _promotion_results
select 'first of two concurrent editors wins and creator identity is preserved',
  :v_owner_edit = 3 and c.version = 3 and c.title = 'Owner edit' and c.created_by = :'admin'::uuid and c.status = 'draft'
  and (select count(*) from public.promotion_audit_events where campaign_id = c.id and action = 'edited') = 2
from public.promotion_campaigns c where c.id = :'edit_id'::uuid;

set role authenticated;
set request.jwt.claim.sub = :'admin2';
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,3,%L,%L,%L,0,null,null)', :'edit_id', 'Not mine', 'Original description', 'banner'),
  '42501', 'admin who did not create the draft cannot edit it');
set request.jwt.claim.sub = :'viewer';
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,3,%L,%L,%L,0,null,null)', :'edit_id', 'Viewer edit', 'Original description', 'banner'),
  '42501', 'viewer cannot edit a draft');
set request.jwt.claim.sub = :'nobody';
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,3,%L,%L,%L,0,null,null)', :'edit_id', 'Unknown role edit', 'Original description', 'banner'),
  '42501', 'authenticated user without an admin role cannot edit a draft');
set role anon;
reset request.jwt.claim.sub;
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,3,%L,%L,%L,0,null,null)', :'edit_id', 'Anon edit', 'Original description', 'banner'),
  '42501', 'anonymous caller cannot edit a draft');
set role authenticated;
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state(
  $q$select public.admin_update_promotion(gen_random_uuid(),1,'Ghost','Ghost','banner',0,null,null)$q$,
  'P0002', 'editing a campaign that does not exist reports it as unavailable');
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,null,%L,%L,%L,0,null,null)', :'edit_id', 'No version', 'Original description', 'banner'),
  '22023', 'edit without an expected version is rejected');

-- Invalid data is rejected by table constraints and leaves no trace.
select public.admin_create_promotion('Invalid target','Constraint check','banner',0,'20000000-0000-4000-8000-000000000002',null,null) as invalid_id \gset
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,1,%L,%L,%L,5,null,null)', :'invalid_id', 'Invalid target', 'Constraint check', 'banner'),
  '23514', 'banner with proposed credits violates the credit constraint');
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,1,%L,%L,%L,0,%L::timestamptz,%L::timestamptz)', :'invalid_id', 'Invalid target', 'Constraint check', 'banner', '2030-02-01T00:00:00Z', '2030-01-01T00:00:00Z'),
  '23514', 'end date before start date violates the schedule constraint');
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,1,%L,%L,%L,0,null,null)', :'invalid_id', '   ', 'Constraint check', 'banner'),
  '23514', 'blank title violates the title constraint');
-- An unchanged save succeeds without advancing the version or writing an audit event.
select public.admin_update_promotion(:'invalid_id'::uuid,1,'Invalid target','Constraint check','banner',0,null,null) as v_noop \gset
reset role;
insert into _promotion_results
select 'rejected and unchanged edits leave version and audit history untouched',
  :v_noop = 1 and c.version = 1
  and (select count(*) from public.promotion_audit_events where campaign_id = c.id) = 1
from public.promotion_campaigns c where c.id = :'invalid_id'::uuid;

-- Submitted, approved and rejected campaigns are not editable: editing cannot bypass the approval workflow.
reset role;
select version as edit_version from public.promotion_campaigns where id = :'edit_id'::uuid \gset
set role authenticated;
set request.jwt.claim.sub = :'admin';
select public.admin_transition_promotion(:'edit_id'::uuid,'submit',:edit_version);
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,4,%L,%L,%L,0,null,null)', :'edit_id', 'Edit after submit', 'Original description', 'banner'),
  '22023', 'submitted campaign is not editable by its creator');
set request.jwt.claim.sub = :'owner';
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,4,%L,%L,%L,0,null,null)', :'edit_id', 'Owner edit after submit', 'Original description', 'banner'),
  '22023', 'submitted campaign is not editable by an owner');
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,%s,%L,%L,%L,0,null,null)', :'admin_campaign_id', 4, 'Edit approved', 'Free-to-play banner', 'banner'),
  '22023', 'approved campaign is not editable');
set request.jwt.claim.sub = :'admin';
select public.admin_create_promotion('Will be rejected','Rejected fixture','banner',0,'20000000-0000-4000-8000-000000000003',null,null) as rejected_id \gset
select public.admin_transition_promotion(:'rejected_id'::uuid,'submit',1);
set request.jwt.claim.sub = :'owner';
select public.admin_transition_promotion(:'rejected_id'::uuid,'reject');
select pg_temp.expect_state(
  format('select public.admin_update_promotion(%L::uuid,3,%L,%L,%L,0,null,null)', :'rejected_id', 'Edit rejected', 'Rejected fixture', 'banner'),
  '22023', 'rejected campaign is not editable');
reset role;
insert into _promotion_results
select 'blocked edits did not alter campaign state or audit history',
  (select status from public.promotion_campaigns where id = :'edit_id'::uuid) = 'submitted'
  and (select title from public.promotion_campaigns where id = :'edit_id'::uuid) = 'Owner edit'
  and (select status from public.promotion_campaigns where id = :'admin_campaign_id'::uuid) = 'approved'
  and (select count(*) from public.promotion_audit_events where campaign_id = :'edit_id'::uuid and action = 'edited') = 2;
insert into _promotion_results
select 'transition advances the version and records it in the audit event',
  c.version = 4 and (select campaign_version from public.promotion_audit_events where campaign_id = c.id and action = 'submitted') = 4
from public.promotion_campaigns c where c.id = :'edit_id'::uuid;

-- ---- Duplication and idempotency -------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = :'admin';
select public.admin_duplicate_promotion(:'admin_campaign_id'::uuid,'30000000-0000-4000-8000-000000000001') as dup_id \gset
select public.admin_duplicate_promotion(:'admin_campaign_id'::uuid,'30000000-0000-4000-8000-000000000001') as dup_retry_id \gset
reset role;
insert into _promotion_results
select 'duplicating an approved campaign creates a fresh unreviewed draft owned by the caller',
  d.id <> :'admin_campaign_id'::uuid and d.status = 'draft' and d.version = 1 and d.created_by = :'admin'::uuid
  and d.duplicated_from = :'admin_campaign_id'::uuid and d.reviewed_by is null and d.reviewed_at is null
  and d.title = 'Admin draft (copy)' and d.description = 'Free-to-play banner'
  and d.idempotency_key = '30000000-0000-4000-8000-000000000001'::uuid
from public.promotion_campaigns d where d.id = :'dup_id'::uuid;
insert into _promotion_results
select 'duplicate starts its own history with a single duplicated event and copies no audit rows',
  count(*) = 1 and bool_and(action = 'duplicated' and previous_status is null and new_status = 'draft'
    and related_campaign_id = :'admin_campaign_id'::uuid and actor_id = :'admin'::uuid and campaign_version = 1)
from public.promotion_audit_events where campaign_id = :'dup_id'::uuid;
insert into _promotion_results
select 'duplicating leaves the source campaign and its history unchanged',
  s.status = 'approved' and s.version = 3 and s.reviewed_by = :'owner'::uuid
  and (select count(*) from public.promotion_audit_events where campaign_id = s.id) = 3
from public.promotion_campaigns s where s.id = :'admin_campaign_id'::uuid;
insert into _promotion_results
select 'duplicate retry with the same key returns the original copy and writes nothing new',
  :'dup_id'::uuid = :'dup_retry_id'::uuid
  and (select count(*) from public.promotion_campaigns where duplicated_from = :'admin_campaign_id'::uuid) = 1
  and (select count(*) from public.promotion_audit_events where campaign_id = :'dup_id'::uuid) = 1;

set role authenticated;
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state(
  format('select public.admin_duplicate_promotion(%L::uuid,%L::uuid)', :'owner_campaign_id', '30000000-0000-4000-8000-000000000001'),
  '22023', 'duplicate idempotency key cannot be reused for a different source campaign');
select pg_temp.expect_state(
  $q$select public.admin_create_promotion('Admin draft (copy)','Free-to-play banner','banner',0,'30000000-0000-4000-8000-000000000001',null,null)$q$,
  '22023', 'create cannot silently adopt a key already used by a duplicate');
select pg_temp.expect_state(
  format('select public.admin_duplicate_promotion(%L::uuid,null)', :'admin_campaign_id'),
  '22023', 'duplicate without an idempotency key is rejected');
select pg_temp.expect_state(
  $q$select public.admin_duplicate_promotion(gen_random_uuid(),'30000000-0000-4000-8000-000000000002')$q$,
  'P0002', 'duplicating a campaign that does not exist reports it as unavailable');
-- Content that should carry over, and the title length boundary.
select public.admin_create_promotion('Credit source','Virtual credits concept','demo-credit',500,'20000000-0000-4000-8000-000000000004','2031-01-01T00:00:00Z','2031-02-01T00:00:00Z') as credit_source_id \gset
select public.admin_duplicate_promotion(:'credit_source_id'::uuid,'30000000-0000-4000-8000-000000000003') as credit_dup_id \gset
select public.admin_create_promotion(repeat('x',100),'Maximum title length','banner',0,'20000000-0000-4000-8000-000000000005',null,null) as long_source_id \gset
select public.admin_duplicate_promotion(:'long_source_id'::uuid,'30000000-0000-4000-8000-000000000004') as long_dup_id \gset
set request.jwt.claim.sub = :'viewer';
select pg_temp.expect_state(
  format('select public.admin_duplicate_promotion(%L::uuid,%L::uuid)', :'admin_campaign_id', '30000000-0000-4000-8000-000000000005'),
  '42501', 'viewer cannot duplicate a campaign');
set request.jwt.claim.sub = :'nobody';
select pg_temp.expect_state(
  format('select public.admin_duplicate_promotion(%L::uuid,%L::uuid)', :'admin_campaign_id', '30000000-0000-4000-8000-000000000006'),
  '42501', 'authenticated user without an admin role cannot duplicate a campaign');
set role anon;
reset request.jwt.claim.sub;
select pg_temp.expect_state(
  format('select public.admin_duplicate_promotion(%L::uuid,%L::uuid)', :'admin_campaign_id', '30000000-0000-4000-8000-000000000007'),
  '42501', 'anonymous caller cannot duplicate a campaign');
reset role;
insert into _promotion_results
select 'duplicate carries over credits and schedule but not review state',
  d.kind = 'demo-credit' and d.proposed_credits = 500 and d.starts_at = '2031-01-01T00:00:00Z'::timestamptz
  and d.ends_at = '2031-02-01T00:00:00Z'::timestamptz and d.status = 'draft' and d.title = 'Credit source (copy)'
from public.promotion_campaigns d where d.id = :'credit_dup_id'::uuid;
insert into _promotion_results
select 'duplicate of a maximum-length title still fits the 100 character limit',
  char_length(d.title) = 100 and d.title like '%x (copy)'
from public.promotion_campaigns d where d.id = :'long_dup_id'::uuid;

-- ---- Search, filters and cursor pagination ---------------------------------------------------------
-- Fixtures: 7 rows with identical timestamps (tie-break) and 60 bulk rows (page-size clamp).
insert into public.promotion_campaigns(id,title,description,kind,proposed_credits,status,created_by,idempotency_key,created_at,updated_at)
select ('aaaaaaaa-0000-4000-8000-00000000000' || g)::uuid, 'Tie ' || g, 'tie-break fixture', 'banner', 0, 'draft',
       :'admin'::uuid, ('40000000-0000-4000-8000-00000000000' || g)::uuid, '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z'
from generate_series(1,7) g;
insert into public.promotion_campaigns(title,description,kind,proposed_credits,status,created_by,idempotency_key,created_at,updated_at)
select 'Bulk ' || g, 'bulk fixture', 'banner', 0, 'draft', :'owner'::uuid, gen_random_uuid(),
       '2020-02-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval, '2020-02-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval
from generate_series(1,60) g;

set role authenticated;
set request.jwt.claim.sub = :'admin';
do $$
declare
  r record; v_ts timestamptz; v_id uuid; v_got uuid[]; v_pages integer; v_n integer; v_expected uuid[]; v_sort text;
begin
  foreach v_sort in array array['created_desc','created_asc','updated_desc','updated_asc'] loop
    v_got := '{}'; v_pages := 0; v_ts := null; v_id := null;
    loop
      v_n := 0;
      for r in select * from public.admin_search_promotions(p_search => 'tie-break fixture', p_sort => v_sort, p_limit => 3, p_cursor_ts => v_ts, p_cursor_id => v_id) loop
        v_got := v_got || r.id; v_n := v_n + 1; v_id := r.id;
        v_ts := case when v_sort like 'updated%' then r.updated_at else r.created_at end;
      end loop;
      v_pages := v_pages + 1;
      exit when v_n < 3;
    end loop;
    select case when v_sort like '%desc' then array_agg(('aaaaaaaa-0000-4000-8000-00000000000' || g)::uuid order by g desc)
                else array_agg(('aaaaaaaa-0000-4000-8000-00000000000' || g)::uuid order by g) end
    into v_expected from generate_series(1,7) g;
    insert into _promotion_results values
      ('cursor pagination (' || v_sort || ') visits every tied row once in id order across 3 pages', v_got = v_expected and v_pages = 3);
  end loop;
  select count(*) into v_n from public.admin_search_promotions(p_search => 'tie-break fixture', p_limit => 3,
    p_cursor_ts => '2020-01-01T00:00:00Z', p_cursor_id => 'aaaaaaaa-0000-4000-8000-000000000001');
  insert into _promotion_results values ('cursor past the final row yields an empty page', v_n = 0);
  select count(*) into v_n from public.admin_search_promotions(p_search => 'tie-break fixture', p_limit => 7);
  insert into _promotion_results values ('first page can hold every row when limit equals the result size', v_n = 7);
end $$;
insert into _promotion_results
select 'page size is clamped to 51 rows however large the request',
  (select count(*) from public.admin_search_promotions(p_search => 'bulk fixture', p_limit => 1000)) = 51;
insert into _promotion_results
select 'page size below 1 is raised to 1 and a null page size defaults to 25',
  (select count(*) from public.admin_search_promotions(p_search => 'bulk fixture', p_limit => 0)) = 1
  and (select count(*) from public.admin_search_promotions(p_search => 'bulk fixture', p_limit => null)) = 25;
insert into _promotion_results
select 'status filter returns only the requested status',
  count(*) >= 1 and bool_and(status = 'approved') from public.admin_search_promotions(p_status => 'approved');
insert into _promotion_results
select 'kind filter returns only the requested kind',
  count(*) >= 1 and bool_and(kind = 'demo-credit') from public.admin_search_promotions(p_kind => 'demo-credit');
insert into _promotion_results
select 'text search is case-insensitive over title',
  exists (select 1 from public.admin_search_promotions(p_search => 'ADMIN DRAFT') where id = :'admin_campaign_id'::uuid);
insert into _promotion_results
select 'search matches a campaign id prefix',
  exists (select 1 from public.admin_search_promotions(p_search => left(:'admin_campaign_id', 8)) where id = :'admin_campaign_id'::uuid);
insert into _promotion_results
select 'LIKE wildcards and injection text in search are treated as literal text',
  (select count(*) from public.admin_search_promotions(p_search => '%')) = 0
  and (select count(*) from public.admin_search_promotions(p_search => '_')) = 0
  and (select count(*) from public.admin_search_promotions(p_search => $s$'; drop table public.promotion_campaigns; --$s$)) = 0;
insert into _promotion_results
select 'creator filter returns only that creator',
  count(*) >= 1 and bool_and(created_by = :'owner'::uuid) from public.admin_search_promotions(p_created_by => :'owner'::uuid, p_limit => 10);
insert into _promotion_results
select 'created-date range selects only rows inside the window',
  count(*) = 7 and bool_and(description = 'tie-break fixture')
from public.admin_search_promotions(p_created_from => '2019-12-31T00:00:00Z', p_created_to => '2020-01-02T00:00:00Z', p_limit => 50);
insert into _promotion_results
select 'updated-date range selects only rows inside the window',
  count(*) = 7 and bool_and(description = 'tie-break fixture')
from public.admin_search_promotions(p_updated_from => '2019-12-31T00:00:00Z', p_updated_to => '2020-01-02T00:00:00Z', p_limit => 50);
select pg_temp.expect_state($q$select * from public.admin_search_promotions(p_sort => 'title; drop table x')$q$, '22023', 'sort outside the allowlist is rejected');
select pg_temp.expect_state($q$select * from public.admin_search_promotions(p_status => 'published')$q$, '22023', 'unknown status filter is rejected');
select pg_temp.expect_state($q$select * from public.admin_search_promotions(p_kind => 'cash')$q$, '22023', 'unknown kind filter is rejected');
select pg_temp.expect_state(format('select * from public.admin_search_promotions(p_search => %L)', repeat('a',81)), '22023', 'search longer than 80 characters is rejected');
select pg_temp.expect_state($q$select * from public.admin_search_promotions(p_cursor_id => gen_random_uuid())$q$, '22023', 'half-specified cursor is rejected');

set request.jwt.claim.sub = :'viewer';
insert into _promotion_results
select 'viewer can search but is offered no actions',
  count(*) >= 1 and bool_and(allowed_actions = '{}'::text[]) from public.admin_search_promotions(p_limit => 20);
set request.jwt.claim.sub = :'nobody';
select pg_temp.expect_state($q$select * from public.admin_search_promotions()$q$, '42501', 'authenticated user without an admin role cannot search campaigns');
set role anon;
reset request.jwt.claim.sub;
select pg_temp.expect_state($q$select * from public.admin_search_promotions()$q$, '42501', 'anonymous caller cannot search campaigns');
reset role;

-- ---- Role-aware actions match what the mutation RPCs enforce ---------------------------------------
set role authenticated;
set request.jwt.claim.sub = :'admin';
select public.admin_create_promotion('Parity draft','Role parity fixture','banner',0,'20000000-0000-4000-8000-000000000006',null,null) as parity_id \gset
select pg_temp.check_actions('creator admin is offered edit, submit and duplicate on own draft', :'parity_id'::uuid, array['edit','submit','duplicate']);
select pg_temp.check_actions('creator admin is offered only duplicate on own submitted campaign', :'edit_id'::uuid, array['duplicate']);
set request.jwt.claim.sub = :'admin2';
select pg_temp.check_actions('non-creator admin is offered only duplicate on another admin draft', :'parity_id'::uuid, array['duplicate']);
select pg_temp.check_actions('non-creator admin cannot approve or reject a submitted campaign', :'edit_id'::uuid, array['duplicate']);
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,1)', :'parity_id', 'submit'), '42501', 'enforcement matches: non-creator admin cannot submit another admin draft');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L)', :'edit_id', 'approve'), '22023', 'enforcement matches: admin role cannot approve');
set request.jwt.claim.sub = :'owner';
select pg_temp.check_actions('owner is offered edit, submit and duplicate on any draft', :'parity_id'::uuid, array['edit','submit','duplicate']);
select pg_temp.check_actions('owner is offered approve and reject on another creator submitted campaign', :'edit_id'::uuid, array['approve','reject','duplicate']);
select pg_temp.check_actions('owner cannot approve or reject own submitted campaign', :'owner_campaign_id'::uuid, array['duplicate']);
select pg_temp.check_actions('approved campaign offers only duplicate', :'admin_campaign_id'::uuid, array['duplicate']);
set request.jwt.claim.sub = :'viewer';
select pg_temp.check_actions('viewer is offered no actions on a draft', :'parity_id'::uuid, array[]::text[]);
select pg_temp.check_actions('viewer is offered no actions on a submitted campaign', :'edit_id'::uuid, array[]::text[]);
reset role;
insert into _promotion_results
select 'role helper fails closed for unknown roles, missing actor and unknown status',
  private.promotion_allowed_actions('superuser', :'admin'::uuid, 'draft', :'admin'::uuid) = '{}'::text[]
  and private.promotion_allowed_actions(null, null, 'draft', :'admin'::uuid) = '{}'::text[]
  and private.promotion_allowed_actions('owner', null, 'submitted', :'admin'::uuid) = array['duplicate']
  and private.promotion_allowed_actions('owner', :'owner'::uuid, 'archived', :'admin'::uuid) = array['duplicate'];

-- ---- Immutable, role-scoped campaign history -------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = :'admin';
insert into _promotion_results
select 'exact lookup returns only the requested campaign with trusted actions',
  g.id = :'edit_id'::uuid and g.allowed_actions = array['duplicate']
from public.admin_get_promotion(:'edit_id'::uuid) g;
insert into _promotion_results
select 'history lists the campaign events newest first',
  (select array_agg(h.action) from public.admin_promotion_history(:'edit_id'::uuid) h) = array['submitted','edited','edited','created'];
insert into _promotion_results
select 'history attributes each event to its real actor and marks only the caller as self',
  (select array_agg(h.is_self) from public.admin_promotion_history(:'edit_id'::uuid) h) = array[true,false,true,true]
  and (select bool_and(h.actor_kind = 'administrator') from public.admin_promotion_history(:'edit_id'::uuid) h);
insert into _promotion_results
select 'history records status transitions, versions and changed field names only',
  (select h.previous_status = 'draft' and h.new_status = 'submitted' and h.campaign_version = 4 from public.admin_promotion_history(:'edit_id'::uuid) h where h.action = 'submitted')
  and (select array_agg(h.changed_fields order by h.id) from public.admin_promotion_history(:'edit_id'::uuid) h where h.action = 'edited') = array[array['title'],array['title']];
insert into _promotion_results
select 'history of a duplicate is scoped to that campaign and links to its source',
  (select count(*) from public.admin_promotion_history(:'dup_id'::uuid)) = 1
  and (select h.related_campaign_id = :'admin_campaign_id'::uuid from public.admin_promotion_history(:'dup_id'::uuid) h);
select pg_temp.expect_state(format('select * from public.admin_promotion_history(%L::uuid)', '00000000-0000-4000-8000-0000000000ff'), 'P0002', 'history of an unknown campaign reports it as unavailable');
set request.jwt.claim.sub = :'viewer';
insert into _promotion_results
select 'viewer can read campaign history', (select count(*) from public.admin_promotion_history(:'edit_id'::uuid)) = 4;
insert into _promotion_results
select 'viewer can read one campaign but receives no mutation actions',
  g.id = :'edit_id'::uuid and g.allowed_actions = '{}'::text[]
from public.admin_get_promotion(:'edit_id'::uuid) g;
set request.jwt.claim.sub = :'nobody';
select pg_temp.expect_state(format('select * from public.admin_promotion_history(%L::uuid)', :'edit_id'), '42501', 'authenticated user without an admin role cannot read history');
select pg_temp.expect_state(format('select * from public.admin_get_promotion(%L::uuid)', :'edit_id'), '42501', 'authenticated user without an admin role cannot read one campaign');
set role anon;
reset request.jwt.claim.sub;
select pg_temp.expect_state(format('select * from public.admin_promotion_history(%L::uuid)', :'edit_id'), '42501', 'anonymous caller cannot read history');
select pg_temp.expect_state(format('select * from public.admin_get_promotion(%L::uuid)', :'edit_id'), '42501', 'anonymous caller cannot read one campaign');
reset role;

insert into _promotion_results
select 'history and search expose only the approved columns',
  pg_get_function_result('public.admin_promotion_history(uuid)'::regprocedure) =
    'TABLE(id bigint, action text, occurred_at timestamp with time zone, previous_status text, new_status text, campaign_version integer, changed_fields text[], related_campaign_id uuid, actor_id uuid, actor_kind text, is_self boolean)'
  and pg_get_function_result('public.admin_search_promotions(text,text,text,uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer,timestamptz,uuid)'::regprocedure) =
    'TABLE(id uuid, title text, description text, kind text, proposed_credits integer, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, version integer, duplicated_from uuid, allowed_actions text[])'
  and pg_get_function_result('public.admin_get_promotion(uuid)'::regprocedure) =
    'TABLE(id uuid, title text, description text, kind text, proposed_credits integer, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, version integer, duplicated_from uuid, allowed_actions text[])';

-- Audit events cannot be altered through any role. The trigger is the only barrier for the table owner.
select count(*) as audit_rows_before, coalesce(sum(id), 0) as audit_id_sum_before from public.promotion_audit_events \gset
set role authenticated;
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state($q$update public.promotion_audit_events set action = 'approved'$q$, '42501', 'authenticated role cannot update audit events');
select pg_temp.expect_state($q$delete from public.promotion_audit_events$q$, '42501', 'authenticated role cannot delete audit events');
set role anon;
select pg_temp.expect_state($q$delete from public.promotion_audit_events$q$, '42501', 'anon role cannot delete audit events');
set role service_role;
select pg_temp.expect_state($q$update public.promotion_audit_events set new_status = 'x'$q$, '42501', 'service role cannot update audit events');
select pg_temp.expect_state($q$delete from public.promotion_audit_events$q$, '42501', 'service role cannot delete audit events');
select pg_temp.expect_state($q$truncate public.promotion_audit_events$q$, '42501', 'service role cannot truncate audit events');
reset role;
select pg_temp.expect_state($q$update public.promotion_audit_events set new_status = 'x'$q$, '42501', 'table owner cannot update audit events (trigger)');
select pg_temp.expect_state($q$delete from public.promotion_audit_events$q$, '42501', 'table owner cannot delete audit events (trigger)');
select pg_temp.expect_state($q$truncate public.promotion_audit_events$q$, '42501', 'table owner cannot truncate audit events (trigger)');
insert into _promotion_results
select 'blocked audit tampering left every event in place',
  count(*) = :audit_rows_before and coalesce(sum(id), 0) = :audit_id_sum_before and :audit_rows_before > 0
from public.promotion_audit_events;
insert into _promotion_results
select 'every audit event keeps a non-null actor, status and action',
  bool_and(actor_id is not null and new_status is not null and action is not null) from public.promotion_audit_events;

-- Supabase grants service_role ALL on new tables by default; the migration must take back what is never needed.
set role service_role;
select pg_temp.expect_state($q$delete from public.promotion_campaigns$q$, '42501', 'service role cannot delete campaigns');
select pg_temp.expect_state($q$truncate public.promotion_campaigns$q$, '42501', 'service role cannot truncate campaigns');
reset role;
insert into _promotion_results
select 'service role holds no update, delete or truncate privilege on audit events',
  not has_table_privilege('service_role', 'public.promotion_audit_events', 'update')
  and not has_table_privilege('service_role', 'public.promotion_audit_events', 'delete')
  and not has_table_privilege('service_role', 'public.promotion_audit_events', 'truncate')
  and has_table_privilege('service_role', 'public.promotion_audit_events', 'insert');
-- An edit event must name its fields, no other event may carry a field list, and only known fields are allowed.
select pg_temp.expect_state(
  format('insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status) values (%L::uuid,%L::uuid,%L,%L)', :'edit_id', :'admin', 'edited', 'draft'),
  '23514', 'an edited audit event without changed fields is rejected');
select pg_temp.expect_state(
  format('insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status,changed_fields) values (%L::uuid,%L::uuid,%L,%L,array[%L])', :'edit_id', :'admin', 'created', 'draft', 'title'),
  '23514', 'a non-edit audit event carrying changed fields is rejected');
select pg_temp.expect_state(
  format('insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status,changed_fields) values (%L::uuid,%L::uuid,%L,%L,array[%L])', :'edit_id', :'admin', 'edited', 'draft', 'password'),
  '23514', 'changed fields outside the allowlist are rejected');
set role authenticated;
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state(
  $q$select public.admin_transition_promotion(gen_random_uuid(),'submit',1)$q$,
  'P0002', 'transition on an unknown campaign reports it as unavailable, like the other RPCs');
reset role;

-- ---- Every RPC refuses an authenticated user with NO admin role ------------------------------------
-- get_admin_role() returns NULL for such a user, and a NULL comparison must never be read as "allowed".
set role authenticated;
set request.jwt.claim.sub = :'nobody';
select pg_temp.expect_state(
  $q$select public.admin_create_promotion('NoRole probe','Must never exist','banner',0,'50000000-0000-4000-8000-000000000001',null,null)$q$,
  '42501', 'no-role user cannot create a campaign');
select pg_temp.expect_state(
  format('select public.admin_transition_promotion(%L::uuid,%L,1)', :'parity_id', 'submit'),
  '42501', 'no-role user cannot submit another user''s draft');
select pg_temp.expect_state(
  $q$select * from public.admin_list_promotions()$q$,
  '42501', 'no-role user cannot list campaigns through the legacy list RPC');
reset role;
insert into _promotion_results
select 'refused no-role attempts wrote nothing and changed nothing',
  (select count(*) from public.promotion_campaigns where idempotency_key = '50000000-0000-4000-8000-000000000001'::uuid) = 0
  and (select status from public.promotion_campaigns where id = :'parity_id'::uuid) = 'draft';

-- ---- Function privileges ---------------------------------------------------------------------------
insert into _promotion_results
select 'new promotion RPCs are executable by authenticated and not by anon',
  bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
from unnest(array[
  'public.admin_update_promotion(uuid,integer,text,text,text,integer,timestamptz,timestamptz)',
  'public.admin_duplicate_promotion(uuid,uuid)',
  'public.admin_search_promotions(text,text,text,uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer,timestamptz,uuid)',
  'public.admin_get_promotion(uuid)',
  'public.admin_promotion_history(uuid)']) f;
insert into _promotion_results
select 'internal promotion helpers are not executable by API roles',
  bool_and(not has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
from unnest(array['private.promotion_allowed_actions(text,uuid,text,uuid)','private.promotion_audit_is_immutable()']) f;
insert into _promotion_results
select 'every promotion RPC pins an empty search_path',
  count(*) = 8 and bool_and(coalesce(p.proconfig, '{}') @> array['search_path=""'])
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion','admin_update_promotion','admin_duplicate_promotion','admin_list_promotions','admin_search_promotions','admin_get_promotion','admin_promotion_history');

-- ---- Version-checked submit --------------------------------------------------------------------------
-- Submitting freezes a draft into review, so the caller must name the version it reviewed.
set role authenticated;
set request.jwt.claim.sub = :'admin';
select public.admin_create_promotion('Versioned submit','Submit version fixture','banner',0,'60000000-0000-4000-8000-000000000001',null,null) as vs_id \gset
select public.admin_update_promotion(:'vs_id'::uuid, 1, 'Versioned submit v2', 'Submit version fixture', 'banner', 0, null, null);
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L)', :'vs_id', 'submit'),
  '22023', 'submit without an expected version is rejected');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,null)', :'vs_id', 'submit'),
  '22023', 'submit with a null expected version is rejected');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,0)', :'vs_id', 'submit'),
  '22023', 'submit with version 0 is rejected as invalid');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,-1)', :'vs_id', 'submit'),
  '22023', 'submit with a negative version is rejected as invalid');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,1)', :'vs_id', 'submit'),
  'PS409', 'submit with a stale (older) version is rejected as a version conflict');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,3)', :'vs_id', 'submit'),
  'PS409', 'submit with a version the draft has not reached is rejected as a version conflict');
reset role;
insert into _promotion_results
select 'rejected submits changed nothing: still a draft at version 2 with no submitted event',
  c.status = 'draft' and c.version = 2
  and (select count(*) from public.promotion_audit_events e where e.campaign_id = c.id and e.action = 'submitted') = 0
from public.promotion_campaigns c where c.id = :'vs_id'::uuid;

-- Authorization is decided before the version is compared, so a caller who may not submit learns nothing about it.
set role authenticated;
set request.jwt.claim.sub = :'admin2';
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,2)', :'vs_id', 'submit'),
  '42501', 'non-creator admin cannot submit even with the current version');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,1)', :'vs_id', 'submit'),
  '42501', 'non-creator admin gets 42501, not a version conflict, with a stale version');
set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000003';
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,2)', :'vs_id', 'submit'),
  '42501', 'viewer cannot submit even with the current version');
set request.jwt.claim.sub = :'admin';
select public.admin_transition_promotion(:'vs_id'::uuid, 'submit', 2);
reset role;
insert into _promotion_results
select 'submit with the current version succeeds, advances the version and audits it at that version',
  c.status = 'submitted' and c.version = 3
  and (select count(*) from public.promotion_audit_events e
       where e.campaign_id = c.id and e.action = 'submitted' and e.campaign_version = 3 and e.previous_status = 'draft') = 1
from public.promotion_campaigns c where c.id = :'vs_id'::uuid;
set role authenticated;
set request.jwt.claim.sub = :'admin';
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,3)', :'vs_id', 'submit'),
  '22023', 'a second submit with the then-current version is rejected by the state machine');

-- Approve and reject keep working without a version; if a version is supplied it is enforced too.
select public.admin_create_promotion('Review versions','Review version fixture','banner',0,'60000000-0000-4000-8000-000000000002',null,null) as rv_id \gset
select public.admin_transition_promotion(:'rv_id'::uuid, 'submit', 1);
set request.jwt.claim.sub = :'owner';
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,0)', :'rv_id', 'approve'),
  '22023', 'approve with an invalid version is rejected');
select pg_temp.expect_state(format('select public.admin_transition_promotion(%L::uuid,%L,1)', :'rv_id', 'approve'),
  'PS409', 'approve with a stale version is rejected as a version conflict');
reset role;
insert into _promotion_results
select 'a stale approve changed nothing: still submitted at version 2',
  c.status = 'submitted' and c.version = 2
  and (select count(*) from public.promotion_audit_events e where e.campaign_id = c.id and e.action = 'approved') = 0
from public.promotion_campaigns c where c.id = :'rv_id'::uuid;
set role authenticated;
set request.jwt.claim.sub = :'owner';
select public.admin_transition_promotion(:'rv_id'::uuid, 'approve', 2);
reset role;
insert into _promotion_results
select 'approve with the current version succeeds',
  c.status = 'approved' and c.version = 3 from public.promotion_campaigns c where c.id = :'rv_id'::uuid;

-- The unversioned transition and the key-less create must not survive as callable overloads.
insert into _promotion_results
select 'superseded unversioned transition and key-less create overloads no longer exist',
  to_regprocedure('public.admin_transition_promotion(uuid,text)') is null
  and to_regprocedure('public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz)') is null;
insert into _promotion_results
select 'versioned transition is executable by authenticated and not by anon',
  has_function_privilege('authenticated', 'public.admin_transition_promotion(uuid,text,integer)', 'execute')
  and not has_function_privilege('anon', 'public.admin_transition_promotion(uuid,text,integer)', 'execute')
  and not has_function_privilege('public', 'public.admin_transition_promotion(uuid,text,integer)', 'execute');

-- Server-only player tables must enforce RLS from the repository chain alone (20261115191853_private_table_rls.sql).
insert into _promotion_results
select 'every private player table enforces row level security',
  count(*) = 5 and bool_and(c.relrowsecurity)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private' and c.relname in ('player_identities','payout_accounts','kyc_reviews','audit_events','rate_limit_buckets');

select case when ok then 'PASS' else 'FAIL' end as result, name
from _promotion_results order by ok, name;
do $$
begin
  if exists (select 1 from _promotion_results where not ok) then
    raise exception 'PROMOTION SECURITY TESTS FAILED';
  end if;
end $$;
