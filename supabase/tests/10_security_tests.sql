-- Run after migrations. Each check RAISEs on failure. Run via psql -v ON_ERROR_STOP=1.
\set ON_ERROR_STOP on
create temp table _r(name text, ok boolean);
grant all on _r to public;
create or replace function pg_temp.expect_denied(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into _r values (p_name, false);
  exception when insufficient_privilege or others then
    if sqlstate in ('42501') then insert into _r values (p_name, true); else insert into _r values (p_name || ' [unexpected '||sqlstate||': '||sqlerrm||']', false); end if;
  end;
end $$;
-- seed two players via service role path
insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','a@x.test'),('bbbbbbbb-0000-0000-0000-000000000002','b@x.test');
insert into public.player_profiles(user_id,first_name,last_name,date_of_birth,country_of_residence,mobile_phone,email,terms_accepted_at,privacy_acknowledged_at)
values ('aaaaaaaa-0000-0000-0000-000000000001','Aa','Aa','1990-01-01','ZA','+27711111111','a@x.test',now(),now()),
       ('bbbbbbbb-0000-0000-0000-000000000002','Bb','Bb','1990-01-01','ZA','+27722222222','b@x.test',now(),now());
insert into _r select 'trigger still creates wallet+RG settings on profile insert', (select count(*) from public.wallets)=2 and (select count(*) from public.responsible_gaming_settings)=2;

set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into _r select 'Player A reads only own profile', (select count(*) from public.player_profiles)=1 and (select user_id from public.player_profiles)='aaaaaaaa-0000-0000-0000-000000000001';
insert into _r select 'Player A cannot read B wallet/transactions/limits', (select count(*) from public.wallets where user_id<>auth.uid())=0 and (select count(*) from public.responsible_gaming_settings where user_id<>auth.uid())=0;
select pg_temp.expect_denied($q$update public.player_profiles set kyc_status='verified' where user_id=auth.uid()$q$, 'Player cannot self-approve KYC');
select pg_temp.expect_denied($q$update public.wallets set available_minor=999999999 where user_id=auth.uid()$q$, 'Player cannot alter wallet balance');
select pg_temp.expect_denied($q$insert into public.wallet_transactions(wallet_id,direction,amount_minor,transaction_type,status) select id,'credit',100000,'deposit','completed' from public.wallets where user_id=auth.uid()$q$, 'Player cannot forge ledger entry');
select pg_temp.expect_denied($q$update public.responsible_gaming_settings set daily_deposit_limit_minor=null where user_id=auth.uid()$q$, 'Player cannot directly edit RG limits');
select pg_temp.expect_denied($q$select public.create_player_wallet()$q$, 'authenticated cannot EXECUTE create_player_wallet');
select pg_temp.expect_denied($q$select * from private.admin_members$q$, 'authenticated cannot read private.admin_members');
select pg_temp.expect_denied($q$select * from private.player_identities$q$, 'authenticated cannot read player identities');
select pg_temp.expect_denied($q$select public.get_admin_role('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'authenticated cannot call get_admin_role');
insert into _r select 'authenticated list_own_payout_accounts still works (own rows, none yet)', (select count(*) from public.list_own_payout_accounts())=0;
reset role;

set role anon; reset request.jwt.claim.sub;
select pg_temp.expect_denied($q$select * from public.player_profiles$q$, 'anon cannot read profiles');
select pg_temp.expect_denied($q$select public.create_player_wallet()$q$, 'anon cannot EXECUTE create_player_wallet');
select pg_temp.expect_denied($q$select * from public.list_own_payout_accounts()$q$, 'anon cannot EXECUTE list_own_payout_accounts');
reset role;

set role service_role;
insert into _r select 'service_role can read profiles', (select count(*) from public.player_profiles)=2;
insert into _r select 'service_role get_admin_role works (null for non-admin)', public.get_admin_role('aaaaaaaa-0000-0000-0000-000000000001') is null;
reset role;

select case when ok then 'PASS' else 'FAIL' end as result, name from _r order by ok, name;
do $$ begin if exists (select 1 from _r where not ok) then raise exception 'SECURITY TESTS FAILED'; end if; end $$;
