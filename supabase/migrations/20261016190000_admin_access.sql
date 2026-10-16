begin;
create table if not exists private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','viewer')),
  created_at timestamptz not null default now()
);
revoke all on private.admin_members from public, anon, authenticated;
grant select on private.admin_members to service_role;
create index if not exists admin_members_role_idx on private.admin_members(role);
-- Bootstrap an owner only through an authenticated Supabase SQL admin session:
-- insert into private.admin_members(user_id, role) values ('<verified-auth-user-uuid>', 'owner');
-- Never insert users based on a browser-provided role, email claim or client input.
commit;
