-- AwehBet Promotion Studio (milestones 1-2): forward migration.
-- Upgrades the schema created by the already-shared 20261111030000_promotion_workflow.sql (draft/submit/approve/
-- reject with a plain audit trail) to the Studio schema: idempotent create, optimistic-concurrency versions,
-- draft editing, duplication, search/pagination, history, append-only audit and role-aware actions, and a
-- version-checked submit. It runs after the original migration on a fresh database and on one that already
-- applied it. Nothing is dropped except superseded function overloads and indexes that are rebuilt.
begin;

-- 1. Explicit compatibility check. A column this migration adds may already exist (for example from an
-- earlier local draft of this change). That is accepted only when its definition is exactly the expected one;
-- anything else stops the migration so a human can reconcile it instead of it being silently accepted.
do $$
declare
  r record; v record;
begin
  if to_regclass('public.promotion_campaigns') is null or to_regclass('public.promotion_audit_events') is null then
    raise exception 'promotion tables are missing: apply 20261111030000_promotion_workflow.sql first';
  end if;
  for r in select * from (values
    ('promotion_campaigns', 'idempotency_key', 'uuid', true, null),
    ('promotion_campaigns', 'duplicated_from', 'uuid', false, null),
    ('promotion_campaigns', 'version', 'integer', true, '1'),
    ('promotion_audit_events', 'campaign_version', 'integer', false, null),
    ('promotion_audit_events', 'changed_fields', 'text[]', false, null),
    ('promotion_audit_events', 'related_campaign_id', 'uuid', false, null)
  ) as t(tbl, col, typ, not_null, dflt)
  loop
    select format_type(a.atttypid, a.atttypmod) as typ, a.attnotnull as not_null,
           pg_get_expr(d.adbin, d.adrelid) as dflt, a.attgenerated as generated, a.attidentity as identity
      into v
    from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = format('public.%I', r.tbl)::regclass and a.attname = r.col and a.attnum > 0 and not a.attisdropped;
    if found and (v.typ is distinct from r.typ or v.not_null is distinct from r.not_null
                  or v.dflt is distinct from r.dflt or v.generated <> '' or v.identity <> '') then
      raise exception 'public.%.% already exists with an incompatible definition (type %, not null %, default %); reconcile it manually before applying this migration',
        r.tbl, r.col, v.typ, v.not_null, coalesce(v.dflt, 'none');
    end if;
  end loop;
end $$;

-- 2. Columns. Existing campaigns get a random idempotency key (they predate retries) and version 1.
alter table public.promotion_campaigns add column if not exists idempotency_key uuid;
alter table public.promotion_campaigns add column if not exists duplicated_from uuid;
alter table public.promotion_campaigns add column if not exists version integer not null default 1;
update public.promotion_campaigns set idempotency_key = gen_random_uuid() where idempotency_key is null;
alter table public.promotion_campaigns alter column idempotency_key set not null;
alter table public.promotion_audit_events add column if not exists campaign_version integer;
alter table public.promotion_audit_events add column if not exists changed_fields text[];
alter table public.promotion_audit_events add column if not exists related_campaign_id uuid;

-- 3. Constraints and indexes. Each is dropped by name and recreated with the exact expected definition, so a
-- same-named object with a different definition is replaced rather than accepted. Existing rows are validated,
-- so incompatible data fails the migration loudly.
alter table public.promotion_campaigns drop constraint if exists promotion_campaigns_duplicated_from_fkey;
alter table public.promotion_campaigns add constraint promotion_campaigns_duplicated_from_fkey
  foreign key (duplicated_from) references public.promotion_campaigns(id);
alter table public.promotion_campaigns drop constraint if exists promotion_campaigns_version_check;
alter table public.promotion_campaigns add constraint promotion_campaigns_version_check check (version >= 1);
alter table public.promotion_campaigns drop constraint if exists promotion_campaign_creator_idempotency;
alter table public.promotion_campaigns add constraint promotion_campaign_creator_idempotency unique (created_by, idempotency_key);

alter table public.promotion_audit_events drop constraint if exists promotion_audit_events_action_check;
alter table public.promotion_audit_events add constraint promotion_audit_events_action_check
  check (action in ('created','submitted','approved','rejected','edited','duplicated'));
alter table public.promotion_audit_events drop constraint if exists promotion_audit_events_campaign_version_check;
alter table public.promotion_audit_events add constraint promotion_audit_events_campaign_version_check
  check (campaign_version is null or campaign_version >= 1);
alter table public.promotion_audit_events drop constraint if exists promotion_audit_events_changed_fields_check;
alter table public.promotion_audit_events add constraint promotion_audit_events_changed_fields_check
  check (changed_fields is null or changed_fields <@ array['title','description','kind','credits','starts_at','ends_at']::text[]);
alter table public.promotion_audit_events drop constraint if exists promotion_audit_events_related_campaign_id_fkey;
alter table public.promotion_audit_events add constraint promotion_audit_events_related_campaign_id_fkey
  foreign key (related_campaign_id) references public.promotion_campaigns(id);
alter table public.promotion_audit_events drop constraint if exists promotion_audit_edit_fields;
alter table public.promotion_audit_events add constraint promotion_audit_edit_fields
  check ((action = 'edited') = (changed_fields is not null and cardinality(changed_fields) > 0));

drop index if exists public.promotion_campaigns_created_idx;
create index promotion_campaigns_created_idx on public.promotion_campaigns (created_at desc, id desc);
drop index if exists public.promotion_campaigns_updated_idx;
create index promotion_campaigns_updated_idx on public.promotion_campaigns (updated_at desc, id desc);
drop index if exists public.promotion_audit_campaign_idx;
create index promotion_audit_campaign_idx on public.promotion_audit_events (campaign_id, id desc);

alter table public.promotion_campaigns enable row level security;
alter table public.promotion_audit_events enable row level security;
revoke all on public.promotion_campaigns from public, anon, authenticated;
revoke all on public.promotion_audit_events from public, anon, authenticated;
revoke all on sequence public.promotion_audit_events_id_seq from public, anon, authenticated;
grant select, insert, update on public.promotion_campaigns to service_role;
grant select, insert on public.promotion_audit_events to service_role;
grant usage, select on sequence public.promotion_audit_events_id_seq to service_role;
-- Supabase default privileges grant service_role ALL on new tables, so the narrow grants above do not
-- remove anything by themselves. Take away what this feature never needs: campaigns are never deleted,
-- and audit events are never changed.
revoke delete, truncate on public.promotion_campaigns from service_role;
revoke update, delete, truncate on public.promotion_audit_events from service_role;

-- Audit history is append-only for every ordinary role, service_role and the table owner included: the
-- triggers below reject UPDATE, DELETE and TRUNCATE. Only a superuser deliberately dropping or disabling
-- the trigger, or setting session_replication_role, can get around them.
create or replace function private.promotion_audit_is_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Promotion audit events are immutable' using errcode = '42501';
end; $$;
revoke all on function private.promotion_audit_is_immutable() from public, anon, authenticated;
drop trigger if exists promotion_audit_events_immutable on public.promotion_audit_events;
create trigger promotion_audit_events_immutable before update or delete on public.promotion_audit_events
  for each row execute function private.promotion_audit_is_immutable();
drop trigger if exists promotion_audit_events_no_truncate on public.promotion_audit_events;
create trigger promotion_audit_events_no_truncate before truncate on public.promotion_audit_events
  for each statement execute function private.promotion_audit_is_immutable();

-- Single source of truth for which actions a role may take on a campaign. The list RPC returns this
-- per row so the UI never re-implements the rules; the mutation RPCs below enforce the same rules.
create or replace function private.promotion_allowed_actions(p_role text, p_actor uuid, p_status text, p_created_by uuid)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_remove(array[
    case when p_role in ('owner','admin') and p_status = 'draft' and (p_role = 'owner' or p_created_by = p_actor) then 'edit' end,
    case when p_role in ('owner','admin') and p_status = 'draft' and (p_role = 'owner' or p_created_by = p_actor) then 'submit' end,
    case when p_role = 'owner' and p_status = 'submitted' and p_created_by <> p_actor then 'approve' end,
    case when p_role = 'owner' and p_status = 'submitted' and p_created_by <> p_actor then 'reject' end,
    case when p_role in ('owner','admin') then 'duplicate' end
  ], null), '{}'::text[]);
$$;
revoke all on function private.promotion_allowed_actions(text, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.admin_create_promotion(
  p_title text, p_description text, p_kind text, p_credits integer, p_idempotency_key uuid,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_actor uuid := auth.uid(); v_role text; v_existing public.promotion_campaigns%rowtype;
begin
  v_role := public.get_admin_role(v_actor);
  -- v_role is NULL for a user with no admin row; a NULL comparison alone would not raise, so test it explicitly.
  if v_actor is null or v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode='22023'; end if;
  insert into public.promotion_campaigns(title,description,kind,proposed_credits,starts_at,ends_at,created_by,idempotency_key)
  values (btrim(p_title),btrim(p_description),p_kind,p_credits,p_starts_at,p_ends_at,v_actor,p_idempotency_key)
  on conflict (created_by,idempotency_key) do nothing returning id into v_id;
  if v_id is null then
    select * into strict v_existing from public.promotion_campaigns
    where created_by=v_actor and idempotency_key=p_idempotency_key;
    if v_existing.title is distinct from btrim(p_title)
      or v_existing.description is distinct from btrim(p_description)
      or v_existing.kind is distinct from p_kind
      or v_existing.proposed_credits is distinct from p_credits
      or v_existing.starts_at is distinct from p_starts_at
      or v_existing.ends_at is distinct from p_ends_at
      or v_existing.duplicated_from is not null then
      raise exception 'Idempotency key already used with different campaign data' using errcode='22023';
    end if;
    return v_existing.id;
  end if;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status,campaign_version)
  values(v_id,v_actor,'created','draft',1);
  return v_id;
end; $$;

-- Submitting locks a draft into review, so the caller must state the version it reviewed; the check runs under the
-- same row lock as the state change. Approve and reject act on a submitted campaign, which can no longer be edited,
-- so they may omit the version; when supplied it is enforced for them too.
-- Errors: 42501 not authorized, 22023 missing/invalid version or invalid transition, P0002 not available,
-- PS409 stale version (no state change and no audit event).
create or replace function public.admin_transition_promotion(p_campaign_id uuid, p_action text, p_expected_version integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_campaign public.promotion_campaigns%rowtype; v_next text;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  if (p_expected_version is not null and p_expected_version < 1)
    or (p_action = 'submit' and p_expected_version is null) then
    raise exception 'Valid expected version required' using errcode='22023';
  end if;
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
  if p_expected_version is not null and v_campaign.version <> p_expected_version then
    raise exception 'Campaign was changed by another editor' using errcode='PS409';
  end if;
  update public.promotion_campaigns set status=v_next,reviewed_by=case when p_action='submit' then null else v_actor end,
    reviewed_at=case when p_action='submit' then null else now() end,version=version+1,updated_at=clock_timestamp() where id=p_campaign_id;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,previous_status,new_status,campaign_version)
  values(p_campaign_id,v_actor,case when p_action='submit' then 'submitted' else v_next end,v_campaign.status,v_next,v_campaign.version+1);
end; $$;

-- Edits draft content only. Status, creator, reviewer and creation timestamp are never touched.
-- Errors: 42501 not authorized, P0002 campaign not available, 22023 not editable / bad request,
-- PS409 stale version (no mutation and no audit event), 23xxx table constraint violations.
create or replace function public.admin_update_promotion(
  p_campaign_id uuid, p_expected_version integer,
  p_title text, p_description text, p_kind text, p_credits integer,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_role text; v_campaign public.promotion_campaigns%rowtype;
  v_title text := btrim(p_title); v_description text := btrim(p_description);
  v_changed text[] := '{}'::text[]; v_version integer;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_campaign_id is null or p_expected_version is null or p_expected_version < 1 then raise exception 'Invalid request' using errcode='22023'; end if;
  select * into v_campaign from public.promotion_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaign not available' using errcode='P0002'; end if;
  if v_campaign.created_by <> v_actor and v_role <> 'owner' then raise exception 'Not authorized' using errcode='42501'; end if;
  if v_campaign.status <> 'draft' then raise exception 'Campaign is not editable' using errcode='22023'; end if;
  if v_campaign.version <> p_expected_version then raise exception 'Campaign was changed by another editor' using errcode='PS409'; end if;
  if v_title is distinct from v_campaign.title then v_changed := array_append(v_changed, 'title'); end if;
  if v_description is distinct from v_campaign.description then v_changed := array_append(v_changed, 'description'); end if;
  if p_kind is distinct from v_campaign.kind then v_changed := array_append(v_changed, 'kind'); end if;
  if p_credits is distinct from v_campaign.proposed_credits then v_changed := array_append(v_changed, 'credits'); end if;
  if p_starts_at is distinct from v_campaign.starts_at then v_changed := array_append(v_changed, 'starts_at'); end if;
  if p_ends_at is distinct from v_campaign.ends_at then v_changed := array_append(v_changed, 'ends_at'); end if;
  -- Nothing changed: succeed without advancing the version or writing a misleading audit event.
  if cardinality(v_changed) = 0 then return v_campaign.version; end if;
  update public.promotion_campaigns
  set title = v_title, description = v_description, kind = p_kind, proposed_credits = p_credits,
      starts_at = p_starts_at, ends_at = p_ends_at, version = version + 1, updated_at = clock_timestamp()
  where id = p_campaign_id returning version into v_version;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,previous_status,new_status,campaign_version,changed_fields)
  values(p_campaign_id,v_actor,'edited',v_campaign.status,v_campaign.status,v_version,v_changed);
  return v_version;
end; $$;

-- Copies campaign content into a brand-new draft. Review state, audit history and approvals are never copied.
-- Idempotent per (actor, key): an identical retry returns the original copy, a different request is rejected (22023).
create or replace function public.admin_duplicate_promotion(p_campaign_id uuid, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_role text; v_source public.promotion_campaigns%rowtype;
  v_id uuid; v_existing public.promotion_campaigns%rowtype;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_campaign_id is null or p_idempotency_key is null then raise exception 'Invalid request' using errcode='22023'; end if;
  select * into v_source from public.promotion_campaigns where id = p_campaign_id for share;
  if not found then raise exception 'Campaign not available' using errcode='P0002'; end if;
  insert into public.promotion_campaigns(title,description,kind,proposed_credits,starts_at,ends_at,created_by,idempotency_key,duplicated_from)
  values (left(btrim(v_source.title), 93) || ' (copy)', v_source.description, v_source.kind, v_source.proposed_credits,
          v_source.starts_at, v_source.ends_at, v_actor, p_idempotency_key, v_source.id)
  on conflict (created_by, idempotency_key) do nothing returning id into v_id;
  if v_id is null then
    select * into strict v_existing from public.promotion_campaigns
    where created_by = v_actor and idempotency_key = p_idempotency_key;
    if v_existing.duplicated_from is distinct from v_source.id then
      raise exception 'Idempotency key already used for a different request' using errcode='22023';
    end if;
    return v_existing.id;
  end if;
  insert into public.promotion_audit_events(campaign_id,actor_id,action,new_status,campaign_version,related_campaign_id)
  values(v_id,v_actor,'duplicated','draft',1,v_source.id);
  return v_id;
end; $$;

create or replace function public.admin_list_promotions()
returns table(id uuid,title text,description text,kind text,proposed_credits integer,status text,starts_at timestamptz,ends_at timestamptz,created_by uuid,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(public.get_admin_role(auth.uid()), '') not in ('owner','admin','viewer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query select c.id,c.title,c.description,c.kind,c.proposed_credits,c.status,c.starts_at,c.ends_at,c.created_by,c.created_at
  from public.promotion_campaigns c order by c.created_at desc limit 100;
end; $$;

-- Filtered, keyset-paginated campaign search. No dynamic SQL: the sort is an allowlist mapped onto two
-- static query branches. Ordering is (sort timestamp, id) so equal timestamps never skip or repeat rows.
-- Returns at most 51 rows; callers request page size + 1 to learn whether another page exists.
-- Cursor timestamps must be passed back exactly as returned (microsecond precision).
create or replace function public.admin_search_promotions(
  p_search text default null, p_status text default null, p_kind text default null, p_created_by uuid default null,
  p_created_from timestamptz default null, p_created_to timestamptz default null,
  p_updated_from timestamptz default null, p_updated_to timestamptz default null,
  p_sort text default 'created_desc', p_limit integer default 25,
  p_cursor_ts timestamptz default null, p_cursor_id uuid default null
) returns table(
  id uuid, title text, description text, kind text, proposed_credits integer, status text,
  starts_at timestamptz, ends_at timestamptz, created_by uuid, created_at timestamptz, updated_at timestamptz,
  version integer, duplicated_from uuid, allowed_actions text[]
) language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_role text; v_needle text; v_limit integer;
  v_by_updated boolean; v_desc boolean;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin','viewer') then raise exception 'Not authorized' using errcode='42501'; end if;
  v_needle := lower(nullif(btrim(coalesce(p_search, '')), ''));
  if v_needle is not null and char_length(v_needle) > 80 then raise exception 'Search too long' using errcode='22023'; end if;
  if p_status is not null and p_status not in ('draft','submitted','approved','rejected') then raise exception 'Invalid status filter' using errcode='22023'; end if;
  if p_kind is not null and p_kind not in ('banner','demo-credit') then raise exception 'Invalid kind filter' using errcode='22023'; end if;
  if p_sort is null or p_sort not in ('created_desc','created_asc','updated_desc','updated_asc') then raise exception 'Invalid sort' using errcode='22023'; end if;
  if (p_cursor_ts is null) <> (p_cursor_id is null) then raise exception 'Invalid cursor' using errcode='22023'; end if;
  v_limit := least(greatest(coalesce(p_limit, 25), 1), 51);
  v_by_updated := p_sort in ('updated_desc','updated_asc');
  v_desc := p_sort in ('created_desc','updated_desc');
  if v_desc then
    return query
    select c.id, c.title, c.description, c.kind, c.proposed_credits, c.status, c.starts_at, c.ends_at, c.created_by,
           c.created_at, c.updated_at, c.version, c.duplicated_from,
           private.promotion_allowed_actions(v_role, v_actor, c.status, c.created_by)
    from public.promotion_campaigns c
    where (v_needle is null or strpos(lower(c.title), v_needle) > 0 or strpos(lower(c.description), v_needle) > 0
           or left(c.id::text, char_length(v_needle)) = v_needle)
      and (p_status is null or c.status = p_status)
      and (p_kind is null or c.kind = p_kind)
      and (p_created_by is null or c.created_by = p_created_by)
      and (p_created_from is null or c.created_at >= p_created_from)
      and (p_created_to is null or c.created_at < p_created_to)
      and (p_updated_from is null or c.updated_at >= p_updated_from)
      and (p_updated_to is null or c.updated_at < p_updated_to)
      and (p_cursor_id is null or (case when v_by_updated then c.updated_at else c.created_at end, c.id) < (p_cursor_ts, p_cursor_id))
    order by (case when v_by_updated then c.updated_at else c.created_at end) desc, c.id desc
    limit v_limit;
  else
    return query
    select c.id, c.title, c.description, c.kind, c.proposed_credits, c.status, c.starts_at, c.ends_at, c.created_by,
           c.created_at, c.updated_at, c.version, c.duplicated_from,
           private.promotion_allowed_actions(v_role, v_actor, c.status, c.created_by)
    from public.promotion_campaigns c
    where (v_needle is null or strpos(lower(c.title), v_needle) > 0 or strpos(lower(c.description), v_needle) > 0
           or left(c.id::text, char_length(v_needle)) = v_needle)
      and (p_status is null or c.status = p_status)
      and (p_kind is null or c.kind = p_kind)
      and (p_created_by is null or c.created_by = p_created_by)
      and (p_created_from is null or c.created_at >= p_created_from)
      and (p_created_to is null or c.created_at < p_created_to)
      and (p_updated_from is null or c.updated_at >= p_updated_from)
      and (p_updated_to is null or c.updated_at < p_updated_to)
      and (p_cursor_id is null or (case when v_by_updated then c.updated_at else c.created_at end, c.id) > (p_cursor_ts, p_cursor_id))
    order by (case when v_by_updated then c.updated_at else c.created_at end) asc, c.id asc
    limit v_limit;
  end if;
end; $$;

-- Exact campaign lookup for editing and post-mutation refreshes. This is separate from free-text search so
-- a campaign whose description happens to contain another campaign UUID can never displace the requested row.
create or replace function public.admin_get_promotion(p_campaign_id uuid)
returns table(
  id uuid, title text, description text, kind text, proposed_credits integer, status text,
  starts_at timestamptz, ends_at timestamptz, created_by uuid, created_at timestamptz, updated_at timestamptz,
  version integer, duplicated_from uuid, allowed_actions text[]
) language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin','viewer') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_campaign_id is null then raise exception 'Campaign not available' using errcode='P0002'; end if;
  return query
  select c.id, c.title, c.description, c.kind, c.proposed_credits, c.status, c.starts_at, c.ends_at,
         c.created_by, c.created_at, c.updated_at, c.version, c.duplicated_from,
         private.promotion_allowed_actions(v_role, v_actor, c.status, c.created_by)
  from public.promotion_campaigns c where c.id = p_campaign_id;
  if not found then raise exception 'Campaign not available' using errcode='P0002'; end if;
end; $$;

-- Read-only history for one campaign, newest first by event id (events for a campaign are serialized by the
-- campaign row lock, so id order is logical order). Capped at the 200 most recent events. Exposes ids and
-- statuses only: no emails, no free-form payloads, and field names but never field values.
create or replace function public.admin_promotion_history(p_campaign_id uuid)
returns table(
  id bigint, action text, occurred_at timestamptz, previous_status text, new_status text,
  campaign_version integer, changed_fields text[], related_campaign_id uuid,
  actor_id uuid, actor_kind text, is_self boolean
) language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text;
begin
  v_role := public.get_admin_role(v_actor);
  if v_actor is null or v_role is null or v_role not in ('owner','admin','viewer') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_campaign_id is null or not exists (select 1 from public.promotion_campaigns c where c.id = p_campaign_id) then
    raise exception 'Campaign not available' using errcode='P0002';
  end if;
  return query
  select e.id, e.action, e.occurred_at, e.previous_status, e.new_status, e.campaign_version, e.changed_fields,
         e.related_campaign_id, e.actor_id,
         -- actor_id is currently mandatory, so every event is human. A null actor is reserved for future system events.
         case when e.actor_id is null then 'system' else 'administrator' end,
         (e.actor_id is not null and e.actor_id = v_actor)
  from public.promotion_audit_events e
  where e.campaign_id = p_campaign_id
  order by e.id desc
  limit 200;
end; $$;

-- Superseded overloads. create or replace with a new argument list adds a function instead of replacing, so the
-- unversioned transition and the create without an idempotency key must be removed explicitly or they stay callable.
drop function if exists public.admin_create_promotion(text,text,text,integer,timestamptz,timestamptz);
drop function if exists public.admin_transition_promotion(uuid,text);

revoke all on function public.admin_create_promotion(text,text,text,integer,uuid,timestamptz,timestamptz) from public,anon;
revoke all on function public.admin_transition_promotion(uuid,text,integer) from public,anon;
revoke all on function public.admin_update_promotion(uuid,integer,text,text,text,integer,timestamptz,timestamptz) from public,anon;
revoke all on function public.admin_duplicate_promotion(uuid,uuid) from public,anon;
revoke all on function public.admin_list_promotions() from public,anon;
revoke all on function public.admin_search_promotions(text,text,text,uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer,timestamptz,uuid) from public,anon;
revoke all on function public.admin_get_promotion(uuid) from public,anon;
revoke all on function public.admin_promotion_history(uuid) from public,anon;
grant execute on function public.admin_create_promotion(text,text,text,integer,uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_transition_promotion(uuid,text,integer) to authenticated;
grant execute on function public.admin_update_promotion(uuid,integer,text,text,text,integer,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_duplicate_promotion(uuid,uuid) to authenticated;
grant execute on function public.admin_list_promotions() to authenticated;
grant execute on function public.admin_search_promotions(text,text,text,uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer,timestamptz,uuid) to authenticated;
grant execute on function public.admin_get_promotion(uuid) to authenticated;
grant execute on function public.admin_promotion_history(uuid) to authenticated;

-- Post-conditions: fail the migration rather than leave a wrong privilege or a stale overload behind.
do $$
declare f record;
begin
  for f in select p.oid, p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion','admin_update_promotion',
             'admin_duplicate_promotion','admin_list_promotions','admin_search_promotions','admin_get_promotion','admin_promotion_history')
  loop
    if not f.prosecdef or f.proconfig is null or not ('search_path=""' = any (f.proconfig)) then
      raise exception '% must be security definer with an empty search_path', f.sig;
    end if;
    if has_function_privilege('anon', f.oid, 'EXECUTE') or not has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      raise exception '% has the wrong execute grants', f.sig;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('admin_create_promotion','admin_transition_promotion')) <> 2 then
    raise exception 'a superseded create/transition overload is still present';
  end if;
end $$;

commit;
