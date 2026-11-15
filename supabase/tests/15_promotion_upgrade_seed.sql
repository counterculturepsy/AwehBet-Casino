-- Seeds rows under the ORIGINAL shared promotion schema (before the forward migration). `upgrade` mode only.
-- Disposable database created by run_local.sh; never run this elsewhere.
\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('a0a0a0a0-0000-4000-8000-000000000001','legacy-admin@x.test'),
  ('a0a0a0a0-0000-4000-8000-000000000002','legacy-owner@x.test');
insert into private.admin_members(user_id,role) values
  ('a0a0a0a0-0000-4000-8000-000000000001','admin'),
  ('a0a0a0a0-0000-4000-8000-000000000002','owner');

insert into public.promotion_campaigns(id,title,description,kind,proposed_credits,status,created_by,reviewed_by,reviewed_at) values
  ('b0b0b0b0-0000-4000-8000-000000000001','Legacy draft','Created before the upgrade','banner',0,'draft',
   'a0a0a0a0-0000-4000-8000-000000000001',null,null),
  ('b0b0b0b0-0000-4000-8000-000000000002','Legacy submitted','Awaiting review','demo-credit',500,'submitted',
   'a0a0a0a0-0000-4000-8000-000000000001',null,null),
  ('b0b0b0b0-0000-4000-8000-000000000003','Legacy approved','Already approved','banner',0,'approved',
   'a0a0a0a0-0000-4000-8000-000000000001','a0a0a0a0-0000-4000-8000-000000000002',now());

insert into public.promotion_audit_events(campaign_id,actor_id,action,previous_status,new_status) values
  ('b0b0b0b0-0000-4000-8000-000000000001','a0a0a0a0-0000-4000-8000-000000000001','created',null,'draft'),
  ('b0b0b0b0-0000-4000-8000-000000000002','a0a0a0a0-0000-4000-8000-000000000001','created',null,'draft'),
  ('b0b0b0b0-0000-4000-8000-000000000002','a0a0a0a0-0000-4000-8000-000000000001','submitted','draft','submitted'),
  ('b0b0b0b0-0000-4000-8000-000000000003','a0a0a0a0-0000-4000-8000-000000000001','created',null,'draft'),
  ('b0b0b0b0-0000-4000-8000-000000000003','a0a0a0a0-0000-4000-8000-000000000001','submitted','draft','submitted'),
  ('b0b0b0b0-0000-4000-8000-000000000003','a0a0a0a0-0000-4000-8000-000000000002','approved','submitted','approved');
