begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create type public.kyc_status as enum ('not_started', 'pending', 'under_review', 'verified', 'rejected');
create type public.wallet_status as enum ('active', 'restricted', 'closed');
create type public.transaction_status as enum ('pending', 'completed', 'failed', 'cancelled', 'reversed');
create type public.transaction_direction as enum ('credit', 'debit');
create type public.withdrawal_status as enum ('pending', 'under_review', 'approved', 'rejected', 'cancelled', 'paid');

create table public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 2 and 80),
  last_name text not null check (char_length(last_name) between 2 and 80),
  date_of_birth date not null check (date_of_birth <= current_date - interval '18 years'),
  country_of_residence char(2) not null,
  mobile_phone text not null unique,
  email text not null unique,
  kyc_status public.kyc_status not null default 'not_started',
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  terms_accepted_at timestamptz not null,
  privacy_acknowledged_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.player_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('sa-id', 'passport')),
  encrypted_identifier text not null,
  identifier_fingerprint char(64) not null unique,
  identifier_last_four char(4) not null,
  issuing_country char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  available_minor bigint not null default 0 check (available_minor >= 0),
  pending_minor bigint not null default 0 check (pending_minor >= 0),
  status public.wallet_status not null default 'active',
  simulated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  direction public.transaction_direction not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal', 'adjustment', 'refund', 'wager', 'win')),
  status public.transaction_status not null,
  provider text not null default 'demo',
  provider_reference text,
  idempotency_key uuid not null,
  balance_after_minor bigint,
  simulated boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (wallet_id, idempotency_key)
);

create table public.deposit_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  method text not null check (method in ('instant-eft', 'fnb', 'capitec', 'nedbank', 'absa', 'card', 'voucher', 'apple-pay', 'google-pay')),
  amount_minor bigint not null check (amount_minor between 1000 and 500000),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  status public.transaction_status not null default 'pending',
  reference text not null unique,
  idempotency_key uuid not null,
  simulated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table private.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_code text not null,
  account_holder text not null,
  encrypted_account_number text not null,
  account_fingerprint char(64) not null,
  account_last_four char(4) not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, account_fingerprint)
);

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  payout_account_id uuid references private.payout_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 5000),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  status public.withdrawal_status not null default 'pending',
  idempotency_key uuid not null,
  simulated boolean not null default true,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check ((simulated and payout_account_id is null) or payout_account_id is not null)
);

create table public.responsible_gaming_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_deposit_limit_minor bigint check (daily_deposit_limit_minor is null or daily_deposit_limit_minor >= 0),
  weekly_deposit_limit_minor bigint check (weekly_deposit_limit_minor is null or weekly_deposit_limit_minor >= 0),
  monthly_deposit_limit_minor bigint check (monthly_deposit_limit_minor is null or monthly_deposit_limit_minor >= 0),
  cooling_off_until timestamptz,
  self_excluded_at timestamptz,
  self_exclusion_until timestamptz,
  updated_at timestamptz not null default now()
);

create table private.kyc_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.kyc_status not null,
  provider text,
  provider_reference text,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reason_code text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table private.rate_limit_buckets (
  key_hash char(64) not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (key_hash, action)
);

create index player_profiles_kyc_status_idx on public.player_profiles(kyc_status);
create index wallet_transactions_wallet_created_idx on public.wallet_transactions(wallet_id, created_at desc);
create index wallet_transactions_status_idx on public.wallet_transactions(status, created_at);
create index deposit_intents_user_created_idx on public.deposit_intents(user_id, created_at desc);
create index withdrawal_requests_user_created_idx on public.withdrawal_requests(user_id, created_at desc);
create index withdrawal_requests_status_idx on public.withdrawal_requests(status, created_at);
create index kyc_reviews_user_created_idx on private.kyc_reviews(user_id, created_at desc);
create index audit_events_subject_time_idx on private.audit_events(subject_user_id, occurred_at desc);

alter table public.player_profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.deposit_intents enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.responsible_gaming_settings enable row level security;

create policy player_profiles_select_own on public.player_profiles for select to authenticated using (user_id = auth.uid());
create policy wallets_select_own on public.wallets for select to authenticated using (user_id = auth.uid());
create policy wallet_transactions_select_own on public.wallet_transactions for select to authenticated using (exists (select 1 from public.wallets where wallets.id = wallet_id and wallets.user_id = auth.uid()));
create policy deposit_intents_select_own on public.deposit_intents for select to authenticated using (user_id = auth.uid());
create policy withdrawal_requests_select_own on public.withdrawal_requests for select to authenticated using (user_id = auth.uid());
create policy responsible_gaming_select_own on public.responsible_gaming_settings for select to authenticated using (user_id = auth.uid());

create or replace function public.create_player_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.wallets (user_id) values (new.user_id) on conflict (user_id) do nothing;
  insert into public.responsible_gaming_settings (user_id) values (new.user_id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger player_profile_wallet_trigger
after insert on public.player_profiles
for each row execute function public.create_player_wallet();

create or replace function public.consume_rate_limit(
  p_key_hash char(64),
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
  current_bucket private.rate_limit_buckets%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into private.rate_limit_buckets(key_hash, action, window_started_at, request_count)
  values (p_key_hash, p_action, now(), 1)
  on conflict (key_hash, action) do update
    set request_count = case
      when private.rate_limit_buckets.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else private.rate_limit_buckets.request_count + 1
    end,
    window_started_at = case
      when private.rate_limit_buckets.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else private.rate_limit_buckets.window_started_at
    end
  returning * into current_bucket;
  return current_bucket.request_count <= p_limit;
end;
$$;

create or replace function public.post_wallet_transaction(
  p_wallet_id uuid,
  p_direction public.transaction_direction,
  p_amount_minor bigint,
  p_transaction_type text,
  p_status public.transaction_status,
  p_provider text,
  p_provider_reference text,
  p_idempotency_key uuid,
  p_simulated boolean default true
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_wallet public.wallets%rowtype;
  existing_transaction public.wallet_transactions%rowtype;
  new_balance bigint;
  result public.wallet_transactions%rowtype;
begin
  if p_amount_minor <= 0 then raise exception 'amount must be positive'; end if;
  select * into existing_transaction from public.wallet_transactions
    where wallet_id = p_wallet_id and idempotency_key = p_idempotency_key;
  if found then return existing_transaction; end if;

  select * into target_wallet from public.wallets where id = p_wallet_id for update;
  if not found or target_wallet.status <> 'active' then raise exception 'wallet unavailable'; end if;
  if not p_simulated then raise exception 'real-money transactions are disabled'; end if;

  new_balance := target_wallet.available_minor;
  if p_status = 'completed' then
    new_balance := new_balance + case when p_direction = 'credit' then p_amount_minor else -p_amount_minor end;
    if new_balance < 0 then raise exception 'insufficient balance'; end if;
    update public.wallets set available_minor = new_balance, updated_at = now() where id = p_wallet_id;
  end if;

  insert into public.wallet_transactions (
    wallet_id, direction, amount_minor, transaction_type, status, provider,
    provider_reference, idempotency_key, balance_after_minor, simulated, completed_at
  ) values (
    p_wallet_id, p_direction, p_amount_minor, p_transaction_type, p_status, p_provider,
    p_provider_reference, p_idempotency_key,
    case when p_status = 'completed' then new_balance else null end,
    p_simulated, case when p_status = 'completed' then now() else null end
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.register_player_profile(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_country_of_residence char(2),
  p_mobile_phone text,
  p_email text,
  p_marketing_consent boolean,
  p_document_type text,
  p_encrypted_identifier text,
  p_identifier_fingerprint char(64),
  p_identifier_last_four char(4),
  p_issuing_country char(2)
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.player_profiles (
    user_id, first_name, last_name, date_of_birth, country_of_residence,
    mobile_phone, email, marketing_consent, marketing_consent_at,
    terms_accepted_at, privacy_acknowledged_at
  ) values (
    p_user_id, p_first_name, p_last_name, p_date_of_birth, upper(p_country_of_residence),
    p_mobile_phone, lower(p_email), p_marketing_consent,
    case when p_marketing_consent then now() else null end, now(), now()
  );

  insert into private.player_identities (
    user_id, document_type, encrypted_identifier, identifier_fingerprint,
    identifier_last_four, issuing_country
  ) values (
    p_user_id, p_document_type, p_encrypted_identifier, p_identifier_fingerprint,
    p_identifier_last_four, upper(p_issuing_country)
  );

  insert into private.audit_events(actor_user_id, subject_user_id, event_type, entity_type, entity_id)
  values (p_user_id, p_user_id, 'player.registered', 'player_profile', p_user_id);
end;
$$;

create or replace function public.record_audit_event(
  p_actor_user_id uuid,
  p_subject_user_id uuid,
  p_event_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = private, pg_temp
as $$
  insert into private.audit_events(actor_user_id, subject_user_id, event_type, entity_type, entity_id, metadata)
  values (p_actor_user_id, p_subject_user_id, p_event_type, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.save_payout_account(
  p_user_id uuid,
  p_bank_code text,
  p_account_holder text,
  p_encrypted_account_number text,
  p_account_fingerprint char(64),
  p_account_last_four char(4)
)
returns uuid
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
  result_id uuid;
begin
  insert into private.payout_accounts(user_id, bank_code, account_holder, encrypted_account_number, account_fingerprint, account_last_four)
  values (p_user_id, p_bank_code, p_account_holder, p_encrypted_account_number, p_account_fingerprint, p_account_last_four)
  on conflict (user_id, account_fingerprint) do update
    set bank_code = excluded.bank_code, account_holder = excluded.account_holder,
        encrypted_account_number = excluded.encrypted_account_number, verified_at = null
  returning id into result_id;
  insert into private.audit_events(actor_user_id, subject_user_id, event_type, entity_type, entity_id)
  values (p_user_id, p_user_id, 'payout_account.saved', 'payout_account', result_id);
  return result_id;
end;
$$;

create or replace function public.list_own_payout_accounts()
returns table(id uuid, bank_code text, account_holder text, account_last_four char(4), verified_at timestamptz)
language sql
security definer
set search_path = private, public, pg_temp
stable
as $$
  select p.id, p.bank_code, p.account_holder, p.account_last_four, p.verified_at
  from private.payout_accounts p
  where p.user_id = auth.uid()
  order by p.created_at desc;
$$;

create or replace function public.create_simulated_withdrawal(
  p_user_id uuid,
  p_payout_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key uuid
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_wallet public.wallets%rowtype;
  target_payout private.payout_accounts%rowtype;
  existing_request public.withdrawal_requests%rowtype;
  result public.withdrawal_requests%rowtype;
begin
  select * into existing_request from public.withdrawal_requests
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return existing_request; end if;
  if not exists (select 1 from public.player_profiles where user_id = p_user_id and kyc_status = 'verified') then
    raise exception 'identity verification required';
  end if;
  select * into target_payout from private.payout_accounts
    where id = p_payout_account_id and user_id = p_user_id and verified_at is not null;
  if not found then raise exception 'verified payout account required'; end if;
  select * into target_wallet from public.wallets where user_id = p_user_id and status = 'active' for update;
  if not found or p_amount_minor > target_wallet.available_minor then raise exception 'insufficient available balance'; end if;
  insert into public.withdrawal_requests(user_id, wallet_id, payout_account_id, amount_minor, idempotency_key, simulated)
  values (p_user_id, target_wallet.id, p_payout_account_id, p_amount_minor, p_idempotency_key, true)
  returning * into result;
  insert into private.audit_events(actor_user_id, subject_user_id, event_type, entity_type, entity_id)
  values (p_user_id, p_user_id, 'withdrawal.simulated_requested', 'withdrawal_request', result.id);
  return result;
end;
$$;

revoke all on function public.consume_rate_limit(char(64), text, integer, integer) from public, anon, authenticated;
revoke all on function public.post_wallet_transaction(uuid, public.transaction_direction, bigint, text, public.transaction_status, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.register_player_profile(uuid, text, text, date, char(2), text, text, boolean, text, text, char(64), char(4), char(2)) from public, anon, authenticated;
revoke all on function public.record_audit_event(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_payout_account(uuid, text, text, text, char(64), char(4)) from public, anon, authenticated;
revoke all on function public.create_simulated_withdrawal(uuid, uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.list_own_payout_accounts() from public, anon;
grant execute on function public.consume_rate_limit(char(64), text, integer, integer) to service_role;
grant execute on function public.post_wallet_transaction(uuid, public.transaction_direction, bigint, text, public.transaction_status, text, text, uuid, boolean) to service_role;
grant execute on function public.register_player_profile(uuid, text, text, date, char(2), text, text, boolean, text, text, char(64), char(4), char(2)) to service_role;
grant execute on function public.record_audit_event(uuid, uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.save_payout_account(uuid, text, text, text, char(64), char(4)) to service_role;
grant execute on function public.create_simulated_withdrawal(uuid, uuid, bigint, uuid) to service_role;
grant execute on function public.list_own_payout_accounts() to authenticated;

grant all on all tables in schema private to service_role;
grant all on all sequences in schema private to service_role;

commit;
