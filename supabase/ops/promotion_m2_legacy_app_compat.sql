-- OPERATIONAL RECOVERY SCRIPT, NOT A MIGRATION. Run only while promotion writes are frozen.
-- Restores the function signatures the ALREADY-SHARED web app (design5-master) calls, on top of the upgraded
-- schema, so that deployment can be put back without losing data or downgrading the schema:
--   admin_create_promotion(title, description, kind, credits, starts_at, ends_at)  -- 6 args, no idempotency key
--   admin_transition_promotion(campaign_id, action)                                 -- 2 args, no version
-- Both still advance the campaign version and write audit events; submit simply has no stale-version protection,
-- which is the pre-fix behaviour. The 3-argument transition is dropped because a defaulted 3-argument function and
-- the 2-argument one would make every 2-argument call ambiguous. Re-applying the forward migration
-- (20261115120000_promotion_studio_workflow.sql) rolls forward again: it drops both shims and restores the new RPCs.
begin;
set local lock_timeout = '5s';
drop function if exists public.admin_transition_promotion(uuid,text,integer);

create or replace function public.admin_transition_promotion(p_campaign_id uuid,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_campaign public.promotion_campaigns%rowtype; v_next text;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_campaign from public.promotion_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Campaign not available' using errcode='P0002'; end if;
  if p_action='submit' and v_campaign.status='draft' then
    if v_campaign.created_by<>v_actor and v_role<>'owner' then raise exception 'Not authorized' using errcode='42501'; end if;
    v_next:='submitted';
  elsif p_action in ('approve','reject') and v_campaign.status='submitted' and v_role='owner' then
    if v_campaign.created_by=v_actor then raise exception 'Creator cannot approve or reject own campaign' using errcode='42501'; end if;
    v_next:=case when p_action='approve' then 'approved' else 'rejected' end;
  else
    raise exception 'Invalid campaign transition' using errcode='22023';
  end if;
  update public.promotion_campaigns set status=v_next,reviewed_by=case when p_action='submit' then null else v_actor end,
    reviewed_at=case when p_action='submit' then null else now() end,version=version+1,updated_at=clock_timestamp() where id=p_campaign_id;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,previous_status,new_status,campaign_version)
  values(p_campaign_id,v_actor,case when p_action='submit' then 'submitted' else v_next end,v_campaign.status,v_next,v_campaign.version+1);
end; $$;

-- Legacy create: a fresh idempotency key per call, exactly like the original behaviour (no retry safety).
-- SECURITY INVOKER on purpose: it only forwards to the SECURITY DEFINER RPC, which performs all authorization.
create or replace function public.admin_create_promotion(
  p_title text, p_description text, p_kind text, p_credits integer,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
) returns uuid language sql security invoker set search_path = '' as $$
  select public.admin_create_promotion(p_title, p_description, p_kind, p_credits, gen_random_uuid(), p_starts_at, p_ends_at);
$$;

revoke all on function public.admin_transition_promotion(uuid,text) from public,anon;
revoke all on function public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_transition_promotion(uuid,text) to authenticated;
grant execute on function public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz) to authenticated;
commit;
