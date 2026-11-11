-- AwehBet demo-only promotion review workflow. No public publication or wallet credits.
create table if not exists public.promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null check (char_length(btrim(description)) between 1 and 300),
  kind text not null check (kind in ('banner', 'demo-credit')),
  proposed_credits integer not null default 0 check (proposed_credits between 0 and 100000),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_credit_kind check ((kind = 'banner' and proposed_credits = 0) or (kind = 'demo-credit' and proposed_credits between 1 and 100000)),
  constraint promotion_date_order check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create table if not exists public.promotion_audit_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.promotion_campaigns(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('created','submitted','approved','rejected')),
  previous_status text,
  new_status text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists promotion_campaigns_created_idx on public.promotion_campaigns (created_at desc);
create index if not exists promotion_audit_campaign_idx on public.promotion_audit_events (campaign_id, occurred_at desc);
alter table public.promotion_campaigns enable row level security;
alter table public.promotion_audit_events enable row level security;
revoke all on public.promotion_campaigns from anon, authenticated;
revoke all on public.promotion_audit_events from anon, authenticated;
revoke all on sequence public.promotion_audit_events_id_seq from anon, authenticated;

create or replace function public.admin_create_promotion(
  p_title text, p_description text, p_kind text, p_credits integer,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_actor uuid := auth.uid(); v_role text;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  insert into public.promotion_campaigns(title,description,kind,proposed_credits,starts_at,ends_at,created_by)
  values (btrim(p_title),btrim(p_description),p_kind,p_credits,p_starts_at,p_ends_at,v_actor) returning id into v_id;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status)
  values(v_id,v_actor,'created','draft');
  return v_id;
end; $$;

create or replace function public.admin_transition_promotion(p_campaign_id uuid,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_campaign public.promotion_campaigns%rowtype; v_next text;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_campaign from public.promotion_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Campaign not found'; end if;
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
    reviewed_at=case when p_action='submit' then null else now() end,updated_at=now() where id=p_campaign_id;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,previous_status,new_status)
  values(p_campaign_id,v_actor,case when p_action='submit' then 'submitted' else v_next end,v_campaign.status,v_next);
end; $$;

create or replace function public.admin_list_promotions()
returns table(id uuid,title text,description text,kind text,proposed_credits integer,status text,starts_at timestamptz,ends_at timestamptz,created_by uuid,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.get_admin_role(auth.uid()) not in ('owner','admin','viewer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query select c.id,c.title,c.description,c.kind,c.proposed_credits,c.status,c.starts_at,c.ends_at,c.created_by,c.created_at
  from public.promotion_campaigns c order by c.created_at desc limit 100;
end; $$;
revoke all on function public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz) from public,anon;
revoke all on function public.admin_transition_promotion(uuid,text) from public,anon;
revoke all on function public.admin_list_promotions() from public,anon;
grant execute on function public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_transition_promotion(uuid,text) to authenticated;
grant execute on function public.admin_list_promotions() to authenticated;
