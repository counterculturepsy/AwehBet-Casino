-- Run after 10_security_tests.sql (reuses its two seeded players). Each check RAISEs on failure.
\set ON_ERROR_STOP on
create temp table _a(name text, ok boolean);
grant all on _a to public;
create or replace function pg_temp.a_denied(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into _a values (p_name, false);
  exception when others then
    if sqlstate = '42501' then insert into _a values (p_name, true);
    else insert into _a values (p_name || ' [unexpected ' || sqlstate || ': ' || sqlerrm || ']', false); end if;
  end;
end $$;

insert into auth.users(id,email) values
  ('cccccccc-0000-0000-0000-000000000003','owner@x.test'),('dddddddd-0000-0000-0000-000000000004','viewer@x.test');
insert into private.admin_members(user_id, role) values
  ('cccccccc-0000-0000-0000-000000000003','owner'),('dddddddd-0000-0000-0000-000000000004','viewer');
insert into private.audit_events(actor_user_id, subject_user_id, event_type, metadata) values
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','deposit.demo_created','{"amount_minor":5000}'),
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','profile.updated','{}'),
  ('bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','deposit.demo_created','{"amount_minor":9000}');
insert into private.kyc_reviews(user_id, status, provider, reason_code) values
  ('aaaaaaaa-0000-0000-0000-000000000001','pending','manual',null),
  ('bbbbbbbb-0000-0000-0000-000000000002','rejected','manual','document_unreadable');

set role authenticated; set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';
select pg_temp.a_denied($q$select * from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003')$q$, 'authenticated (even an owner) cannot call admin_list_audit_events directly');
select pg_temp.a_denied($q$select * from public.admin_list_kyc_reviews('cccccccc-0000-0000-0000-000000000003')$q$, 'authenticated cannot call admin_list_kyc_reviews directly');
select pg_temp.a_denied($q$select * from private.audit_events$q$, 'authenticated cannot read private.audit_events');
reset role; reset request.jwt.claim.sub;

set role anon;
select pg_temp.a_denied($q$select * from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003')$q$, 'anon cannot call admin_list_audit_events');
select pg_temp.a_denied($q$select * from public.admin_list_kyc_reviews('cccccccc-0000-0000-0000-000000000003')$q$, 'anon cannot call admin_list_kyc_reviews');
reset role;

set role service_role;
select pg_temp.a_denied($q$select * from public.admin_list_audit_events('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'service call with a non-admin actor is refused (audit)');
select pg_temp.a_denied($q$select * from public.admin_list_kyc_reviews('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'service call with a non-admin actor is refused (kyc)');
select pg_temp.a_denied($q$select * from public.admin_list_audit_events(null)$q$, 'service call with a null actor is refused');
insert into _a select 'owner sees every matching audit event, newest first',
  (select array_agg(event_type order by id desc) = array_agg(event_type) and count(*) >= 3
   from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003'));
insert into _a select 'owner receives audit metadata',
  exists (select 1 from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003','deposit.') where metadata ? 'amount_minor');
insert into _a select 'viewer never receives audit metadata',
  (select bool_and(metadata = '{}'::jsonb) and count(*) >= 3 from public.admin_list_audit_events('dddddddd-0000-0000-0000-000000000004'));
insert into _a select 'event prefix filter is a literal prefix',
  (select bool_and(event_type like 'deposit.%') and count(*) = 2 from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003','deposit.'));
insert into _a select 'subject filter limits to one player',
  (select bool_and(subject_user_id = 'bbbbbbbb-0000-0000-0000-000000000002') and count(*) = 1
   from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003', null, 'bbbbbbbb-0000-0000-0000-000000000002'));
insert into _a select 'keyset cursor returns only older events',
  (select count(*) = 0 from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003', null, null,
     (select min(id) from private.audit_events)));
insert into _a select 'limit is clamped to 1..100',
  (select count(*) = 1 from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003', null, null, null, -5))
  and (select count(*) <= 100 from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003', null, null, null, 100000));
do $$ begin
  begin perform * from public.admin_list_audit_events('cccccccc-0000-0000-0000-000000000003', 'deposit%');
    insert into _a values ('wildcard event filter is rejected', false);
  exception when others then insert into _a values ('wildcard event filter is rejected', sqlstate = '22023'); end;
end $$;
insert into _a select 'viewer can list KYC reviews', (select count(*) = 2 from public.admin_list_kyc_reviews('dddddddd-0000-0000-0000-000000000004'));
insert into _a select 'KYC subject filter limits to one player',
  (select count(*) = 1 and bool_and(status = 'rejected') from public.admin_list_kyc_reviews('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002'));
reset role;

insert into _a select 'admin read functions write nothing',
  (select count(*) from private.audit_events) = 3 + (select count(*) from private.audit_events where event_type not in ('deposit.demo_created','profile.updated'))
  and (select count(*) from private.kyc_reviews) = 2;

select case when ok then 'PASS' else 'FAIL' end as result, name from _a order by ok, name;
do $$ begin if exists (select 1 from _a where not ok) then raise exception 'ADMIN READ-ONLY TESTS FAILED'; end if; end $$;
