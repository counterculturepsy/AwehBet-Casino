-- Read-only admin access to two server-only private tables: the audit log and KYC review history.
-- Both functions are callable by the service role only (the web server), and each still checks that the acting
-- user is an admin member, so a leaked service call cannot be used with a non-admin user id. Nothing here writes.
-- Viewers do not receive audit metadata. Idempotent: safe to re-apply.
begin;

create index if not exists audit_events_id_desc_idx on private.audit_events (id desc);
create index if not exists kyc_reviews_user_time_idx on private.kyc_reviews (user_id, created_at desc);

create or replace function public.admin_list_audit_events(
  p_actor uuid, p_event_prefix text default null, p_subject uuid default null,
  p_before_id bigint default null, p_limit integer default 50
) returns table(
  id bigint, occurred_at timestamptz, event_type text, entity_type text, entity_id uuid,
  actor_user_id uuid, subject_user_id uuid, metadata jsonb
) language plpgsql stable security definer set search_path = '' as $$
declare v_role text; v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  v_role := public.get_admin_role(p_actor);
  if p_actor is null or v_role is null or v_role not in ('owner','admin','viewer') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_event_prefix is not null and p_event_prefix !~ '^[a-z][a-z0-9_.]{0,59}$' then
    raise exception 'Invalid event filter' using errcode = '22023';
  end if;
  return query
  select e.id, e.occurred_at, e.event_type, e.entity_type, e.entity_id, e.actor_user_id, e.subject_user_id,
         case when v_role in ('owner','admin') then e.metadata else '{}'::jsonb end
  from private.audit_events e
  where (p_event_prefix is null or left(e.event_type, length(p_event_prefix)) = p_event_prefix)
    and (p_subject is null or e.subject_user_id = p_subject)
    and (p_before_id is null or e.id < p_before_id)
  order by e.id desc
  limit v_limit;
end; $$;

create or replace function public.admin_list_kyc_reviews(
  p_actor uuid, p_subject uuid default null, p_limit integer default 50
) returns table(
  id uuid, user_id uuid, status public.kyc_status, provider text, reason_code text,
  reviewer_user_id uuid, created_at timestamptz, decided_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare v_role text; v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  v_role := public.get_admin_role(p_actor);
  if p_actor is null or v_role is null or v_role not in ('owner','admin','viewer') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select r.id, r.user_id, r.status, r.provider, r.reason_code, r.reviewer_user_id, r.created_at, r.decided_at
  from private.kyc_reviews r
  where (p_subject is null or r.user_id = p_subject)
  order by r.created_at desc, r.id desc
  limit v_limit;
end; $$;

revoke all on function public.admin_list_audit_events(uuid, text, uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.admin_list_kyc_reviews(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_list_audit_events(uuid, text, uuid, bigint, integer) to service_role;
grant execute on function public.admin_list_kyc_reviews(uuid, uuid, integer) to service_role;

-- Post-conditions: fail the migration rather than leave a wrong privilege behind.
do $$
declare f record;
begin
  for f in select p.oid, p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig, p.provolatile
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('admin_list_audit_events','admin_list_kyc_reviews')
  loop
    if not f.prosecdef or f.proconfig is null or not ('search_path=""' = any (f.proconfig)) or f.provolatile <> 's' then
      raise exception '% must be stable, security definer, with an empty search_path', f.sig;
    end if;
    if has_function_privilege('anon', f.oid, 'EXECUTE') or has_function_privilege('authenticated', f.oid, 'EXECUTE')
       or not has_function_privilege('service_role', f.oid, 'EXECUTE') then
      raise exception '% has the wrong execute grants', f.sig;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('admin_list_audit_events','admin_list_kyc_reviews')) <> 2 then
    raise exception 'unexpected overloads of the admin read functions';
  end if;
end $$;

commit;
