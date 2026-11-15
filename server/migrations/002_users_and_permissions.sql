-- NUVI Distribution Manager — Step 6B: users, roles and per-profile access
-- Run ONCE in Supabase → SQL Editor → New query → Run (after schema.sql).
--
-- Roles
--   ADMIN  : sees every profile, manages users, profiles, settings and backups.
--   MEMBER : sees ONLY the profiles listed in app_users.profile_ids.
-- The database enforces this (Row Level Security), not only the screens.

-- 1. Who may use the app, and what they may see -------------------------------
create table app_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null default '',
  role        text not null default 'MEMBER' check (role in ('ADMIN','MEMBER')),
  profile_ids bigint[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  invited_by  uuid references auth.users(id) on delete set null
);

-- Everyone who can already log in (you) becomes an ADMIN.
insert into app_users (user_id, email, name, role)
select id, email, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'ADMIN'
from auth.users
on conflict (user_id) do nothing;

-- 2. Helper functions used by the rules ---------------------------------------
-- SECURITY DEFINER so the rules can read app_users without looping on its own rules.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users
                 where user_id = auth.uid() and active and role = 'ADMIN');
$$;

create or replace function public.can_use_profile(pid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users
                 where user_id = auth.uid() and active
                   and (role = 'ADMIN' or pid = any(profile_ids)));
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users where user_id = auth.uid() and active);
$$;

revoke all on function public.is_admin(), public.can_use_profile(bigint), public.is_active_user() from public, anon;
grant execute on function public.is_admin(), public.can_use_profile(bigint), public.is_active_user() to authenticated;

-- 3. Replace the old "any logged-in user" rules -------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','groups','ads','campaigns','campaign_items','app_settings'] loop
    execute format('drop policy if exists "logged-in users" on %I', t);
  end loop;
end $$;

-- profiles: members read their own; only admins change
create policy "read allowed profiles" on profiles for select to authenticated
  using (can_use_profile(id));
create policy "admins manage profiles" on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- groups / ads / campaigns: full access inside allowed profiles
create policy "profile access" on groups for all to authenticated
  using (can_use_profile(profile_id)) with check (can_use_profile(profile_id));
create policy "profile access" on ads for all to authenticated
  using (can_use_profile(profile_id)) with check (can_use_profile(profile_id));
create policy "profile access" on campaigns for all to authenticated
  using (can_use_profile(profile_id)) with check (can_use_profile(profile_id));

-- campaign_items: through their campaign's profile
create policy "profile access" on campaign_items for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id and can_use_profile(c.profile_id)))
  with check (exists (select 1 from campaigns c where c.id = campaign_id and can_use_profile(c.profile_id)));

-- app_settings: everyone active reads; only admins change
create policy "active users read settings" on app_settings for select to authenticated
  using (is_active_user());
create policy "admins change settings" on app_settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- app_users: you read your own row; admins read all.
-- Changes go through the "admin-users" server function (service key), so no
-- insert/update/delete rule is given to the app: a member can never change
-- their own role or profiles.
alter table app_users enable row level security;
create policy "read own row or admin" on app_users for select to authenticated
  using (user_id = auth.uid() or is_admin());
grant select on app_users to authenticated;

-- 4. One running/paused campaign per USER (was: one for the whole company) ----
drop index if exists one_active_campaign;
create unique index one_active_campaign_per_user on campaigns (created_by)
  where status in ('IN_PROGRESS','PAUSED');

-- 5. Not-logged-in visitors get nothing at all --------------------------------
revoke all on all tables in schema public from anon;

-- Check: your account should be listed as ADMIN
select email, role, active from app_users;
