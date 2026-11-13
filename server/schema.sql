-- NUVI Distribution Manager — database (run once in Supabase SQL Editor)

-- 1. Profiles (NUVI Engineering, NUVI IT, more later)
create table profiles (
  id          bigint generated always as identity primary key,
  name        text not null,
  short_name  text not null unique,
  tag         text not null check (char_length(tag) between 1 and 4),
  color       text not null default '#64748b',
  ad_types    text[] not null default '{Product,Service,Other}',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 2. Facebook groups
create table groups (
  id          bigint generated always as identity primary key,
  profile_id  bigint not null references profiles(id) on delete restrict,
  name        text not null check (char_length(name) <= 150),
  url         text not null,
  url_key     text not null,            -- normalised URL for the duplicate check
  category    text,
  status      text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  notes       text check (char_length(notes) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, url_key)          -- same group only once per profile
);

-- 3. Advertisements (master Facebook posts)
create table ads (
  id          bigint generated always as identity primary key,
  profile_id  bigint not null references profiles(id) on delete restrict,
  name        text not null check (char_length(name) <= 120),
  post_url    text not null,
  type        text,
  description text check (char_length(description) <= 500),
  status      text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','ARCHIVED')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index ads_unique_name on ads (profile_id, lower(name));

-- 4. Campaigns (one distribution session). Shown in the app as CAM-001, CAM-002, ...
create table campaigns (
  id            bigint generated always as identity primary key,
  profile_id    bigint not null references profiles(id) on delete restrict,
  ad_id         bigint references ads(id) on delete set null,
  ad_name       text not null,          -- snapshot: history keeps the name
  ad_url        text not null,
  status        text not null default 'IN_PROGRESS'
                check (status in ('IN_PROGRESS','PAUSED','STOPPED','COMPLETED')),
  current_index int  not null default 0,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_by    uuid default auth.uid()
);
-- Only ONE running or paused campaign at a time (BR-018)
create unique index one_active_campaign on campaigns ((true))
  where status in ('IN_PROGRESS','PAUSED');

-- 5. Campaign items (one row per group in a campaign)
create table campaign_items (
  id          bigint generated always as identity primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  group_id    bigint references groups(id) on delete set null,
  group_name  text not null,            -- snapshot
  group_url   text not null,
  position    int  not null,
  status      text not null default 'PENDING'
              check (status in ('PENDING','IN_PROGRESS','PUBLISHED','SKIPPED','APPROVAL_REQUIRED','FAILED')),
  reason      text check (char_length(reason) <= 200),
  log         jsonb not null default '[]',   -- [{s:'PUBLISHED', at:'...', r:'...'}]
  updated_at  timestamptz not null default now(),
  unique (campaign_id, group_id)        -- a group only once per campaign
);

-- 6. App settings (a single row)
create table app_settings (
  id                       int primary key default 1 check (id = 1),
  categories               text[] not null default '{Property,IT & Software,Online Selling,Business,Community,Other}',
  posting_gap_seconds      int not null default 0,
  recent_post_warning_days int not null default 0,
  backup_reminder_days     int not null default 7,
  last_backup_at           timestamptz
);

-- Security: only logged-in users can read or write. Sign-ups are OFF,
-- so only the people you add in Supabase can log in.
do $$
declare t text;
begin
  foreach t in array array['profiles','groups','ads','campaigns','campaign_items','app_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "logged-in users" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Allow logged-in users to use the tables through the Supabase API
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Starting data
insert into profiles (name, short_name, tag, color, ad_types, sort_order) values
  ('NUVI Engineering (Pvt) Ltd', 'NUVI Engineering', 'ENG', '#d97706', '{House,Land,Construction,Property Project,Other}', 1),
  ('NUVI IT (Pvt) Ltd',          'NUVI IT',          'IT',  '#6d28d9', '{Software,Website,Inventory System,Business Software,Other}', 2);
insert into app_settings (id) values (1);

-- Check: should list 6 tables and 2 profiles
select table_name from information_schema.tables where table_schema = 'public' order by table_name;
select id, short_name, tag from profiles order by sort_order;
