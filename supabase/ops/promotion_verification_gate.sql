-- OPERATIONAL SCRIPT, NOT A MIGRATION. Read-only verification gate for the promotion release window.
-- It changes nothing and fails (non-zero exit with ON_ERROR_STOP) on the first violated condition.
--
--   psql -X -v ON_ERROR_STOP=1 -v expect=new -v freeze=on -v min_campaigns=N -v min_events=M \
--        -f supabase/ops/promotion_verification_gate.sql
--
--   expect         new     the Studio schema (forward migration applied)
--                  legacy  the Studio schema carrying the legacy-app shims (promotion_m2_legacy_app_compat.sql)
--   freeze         on      the write freeze must be installed (4 triggers)  |  off  it must be gone (0 triggers)
--   min_campaigns  row counts are LOWER bounds: take them from the baseline recorded before the window. Legitimate
--   min_events     writes after a recovery raise the counts and versions, so equality would be the wrong test.
select set_config('promotion_gate.expect', :'expect', false) as a, set_config('promotion_gate.freeze', :'freeze', false) as b,
       set_config('promotion_gate.min_campaigns', :'min_campaigns', false) as c,
       set_config('promotion_gate.min_events', :'min_events', false) as d \gset

do $$
declare
  v_expect text := current_setting('promotion_gate.expect');
  v_freeze text := current_setting('promotion_gate.freeze');
  v_min_campaigns bigint := current_setting('promotion_gate.min_campaigns')::bigint;
  v_min_events bigint := current_setting('promotion_gate.min_events')::bigint;
  v_invoker_wrapper oid := to_regprocedure('public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz)');
  v_rpcs bigint; v_triggers bigint;
  f record; n bigint;
begin
  v_rpcs := case v_expect when 'new' then 8 else 9 end;
  v_triggers := case v_freeze when 'on' then 4 else 0 end;
  if v_expect not in ('new', 'legacy') then raise exception 'gate: expect must be new or legacy'; end if;
  if v_freeze not in ('on', 'off') then raise exception 'gate: freeze must be on or off'; end if;

  -- Data: nothing was lost.
  select count(*) into n from public.promotion_campaigns;
  if n < v_min_campaigns then raise exception 'gate: % campaigns, expected at least %', n, v_min_campaigns; end if;
  select count(*) into n from public.promotion_audit_events;
  if n < v_min_events then raise exception 'gate: % audit events, expected at least %', n, v_min_events; end if;
  select count(*) into n from public.promotion_campaigns where version < 1 or idempotency_key is null;
  if n <> 0 then raise exception 'gate: % campaigns without a valid version or idempotency key', n; end if;

  -- Every promotion RPC: pinned search_path, SECURITY DEFINER (the legacy create wrapper is the one deliberate
  -- SECURITY INVOKER forwarder), no execute for anon or PUBLIC, execute for authenticated.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion','admin_update_promotion',
     'admin_duplicate_promotion','admin_list_promotions','admin_search_promotions','admin_get_promotion','admin_promotion_history');
  if n <> v_rpcs then raise exception 'gate: % promotion RPCs present, expected % for state %', n, v_rpcs, v_expect; end if;
  for f in select p.oid, p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig
             from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
            where ns.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion','admin_update_promotion',
              'admin_duplicate_promotion','admin_list_promotions','admin_search_promotions','admin_get_promotion','admin_promotion_history')
  loop
    if f.proconfig is null or not ('search_path=""' = any (f.proconfig)) then raise exception 'gate: % must pin an empty search_path', f.sig; end if;
    if not f.prosecdef and f.oid is distinct from v_invoker_wrapper then raise exception 'gate: % must be security definer', f.sig; end if;
    if has_function_privilege('anon', f.oid, 'execute') or has_function_privilege('public', f.oid, 'execute') then
      raise exception 'gate: % is executable by anon or PUBLIC', f.sig;
    end if;
    if not has_function_privilege('authenticated', f.oid, 'execute') then raise exception 'gate: % is not executable by authenticated', f.sig; end if;
  end loop;

  -- Signature state.
  if to_regprocedure('public.admin_create_promotion(text,text,text,integer,uuid,timestamptz,timestamptz)') is null
     or to_regprocedure('public.admin_update_promotion(uuid,integer,text,text,text,integer,timestamptz,timestamptz)') is null then
    raise exception 'gate: Studio create/update RPCs are missing';
  end if;
  if v_expect = 'new' then
    if to_regprocedure('public.admin_transition_promotion(uuid,text,integer)') is null
       or to_regprocedure('public.admin_transition_promotion(uuid,text)') is not null
       or v_invoker_wrapper is not null then
      raise exception 'gate: expected the versioned transition only, with no legacy shims';
    end if;
  else
    if to_regprocedure('public.admin_transition_promotion(uuid,text)') is null
       or to_regprocedure('public.admin_transition_promotion(uuid,text,integer)') is not null
       or v_invoker_wrapper is null then
      raise exception 'gate: expected the legacy shims and no 3-argument transition';
    end if;
  end if;

  -- Freeze state, and no persistent bypass: a role/database default would let every postgres session through.
  select count(*) into n from pg_trigger where tgname like 'promotion\_write\_freeze%' and not tgisinternal;
  if n <> v_triggers then raise exception 'gate: % freeze triggers, expected % for freeze=%', n, v_triggers, v_freeze; end if;
  if exists (select 1 from pg_db_role_setting s, unnest(s.setconfig) c where c like 'app.promotion\_maintenance=%') then
    raise exception 'gate: app.promotion_maintenance is set as a persistent role/database default';
  end if;
  raise notice 'GATE PASSED (expect=%, freeze=%)', v_expect, v_freeze;
end $$;
