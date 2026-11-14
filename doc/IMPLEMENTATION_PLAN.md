# NUVI Distribution Manager — Implementation Plan

**Stack:** Chrome extension (frontend) + Supabase (backend: login + database) + GitHub
**Cost:** free
**How we use this file:** we do one step at a time. When a step is finished, Claude ticks it
(`[x]`), changes its status to ✅ in the tracker and adds a line to the Change Log at the bottom.

---

## Progress tracker

| # | Step | Status |
|---|---|---|
| 0 | Install the tools | ✅ Done |
| 1 | Project folder + GitHub | ✅ Done |
| 2 | Create the Supabase project | ✅ Done |
| 3 | Create the database tables | ✅ Done |
| 4 | Extension skeleton (connect to Supabase) | ✅ Done |
| 5 | Login screen | ✅ Done |
| 5A | Publish as a website (Cloudflare) | ✅ Done |
| 6 | Profiles | 🟡 Built — you test it |
| 7 | Facebook groups (+ CSV) | ⬜ Not started |
| 8 | Advertisements | ⬜ Not started |
| 9 | Distribution (the main feature) | ⬜ Not started |
| 10 | Campaign history | ⬜ Not started |
| 11 | Settings + backup | ⬜ Not started |
| 12 | Testing | ⬜ Not started |
| 13 | Install and daily use | ⬜ Not started |

Status icons: ⬜ Not started · 🟡 In progress · ✅ Done

---

## The big picture (1 minute)

```
client/  = FRONTEND  → Chrome extension (HTML + CSS + JS). Installed into Chrome.
server/  = BACKEND   → Supabase SQL files (tables + security). Run once in Supabase.

Chrome extension  ──internet──▶  Supabase (Login + PostgreSQL database + auto API)
```

There is no Node.js, no EC2 and no Docker. The prototype in `prototype/` is the starting point
for the screens.

---

## Step 0 — Install the tools

**Who:** you · **Time:** 15 min

- [x] Google Chrome (version 116 or newer)
- [x] VS Code — https://code.visualstudio.com
- [x] Git — https://git-scm.com
- [x] A free GitHub account — https://github.com
- [x] A free Supabase account — https://supabase.com (sign in with GitHub)

**Done when:** `git --version` works in a terminal and you can log in to GitHub and Supabase.

---

## Step 1 — Project folder + GitHub

**Who:** Claude + you · **Time:** 10 min

- [x] Use this folder structure (the empty `client/` and `server/` folders already exist):
  ```
  Social Media Distribution Manager/
    doc/          ← BRD, Tech Doc, Architecture, this plan
    prototype/    ← the clickable prototype (kept for reference)
    client/       ← the real Chrome extension
    server/       ← Supabase SQL files
    .gitignore
    README.md
  ```
- [x] `git init`, then make the first commit.
- [x] Create a **private** repository on GitHub and push to it.

> ✅ Repo: https://github.com/avhitigegit/nuvi-distribution-manager (private, branch `main`).
> `.gitignore` keeps out the `input` notes file, backup JSON files and `client/js/config.js` (Supabase keys).

**Done when:** the code is visible in your private GitHub repo.

---

## Step 2 — Create the Supabase project

**Who:** you (Claude guides) · **Time:** 10 min

- [x] In Supabase, click **New project**.
  - Name: `nuvi-distribution`
  - Region: **Southeast Asia (Singapore)**, the closest to Sri Lanka
    > ✅ Created as `nuvi-distribution` in **Northeast Asia (Seoul)**. This is fine to keep.
  - Database password: create a strong one and keep it safe
- [x] Go to **Project Settings → API** and copy two values:
  - **Project URL** (like `https://abcd.supabase.co`)
  - **anon public key**
  > ✅ URL: `https://yuwvfgnytetrzfqjqdjx.supabase.co` · Key: the new-style **publishable key** (`sb_publishable_…`) = the anon key.
  > The anon key is safe to use inside the extension. **Never** use the `service_role` key in the extension.
- [x] Go to **Authentication → Users → Add user** and create your own login (email + password).
- [x] Go to **Authentication → Sign In / Providers** and turn **OFF** "Allow new users to sign up".
  Only people you add can then log in.

**Done when:** you have the URL + anon key, and your user appears in the Users list.

---

## Step 3 — Create the database tables

**Who:** Claude writes the SQL, you run it · **Time:** 10 min

- [x] Claude saves the SQL from **Appendix A** as `server/schema.sql`.
- [x] In Supabase, open **SQL Editor → New query**, paste the file and click **Run**.
- [x] Check **Table Editor**. You should see 6 tables: `profiles`, `groups`, `ads`, `campaigns`,
      `campaign_items`, `app_settings`.

**Done when:** all 6 tables exist, and `profiles` contains NUVI Engineering + NUVI IT.

---

## Step 4 — Extension skeleton (connect to Supabase)

**Who:** Claude · **Time:** 30 min

- [x] Copy the prototype screens into `client/`.
- [x] Download the Supabase JS library **into** the extension at `client/lib/supabase.js`.
  (Chrome extensions cannot load code from the internet.)
  > ✅ supabase-js **2.118.0** (UMD build) bundled.
- [x] Create `client/js/config.js` containing your Project URL and anon key.
- [x] Update `manifest.json`: allow `https://YOUR-PROJECT.supabase.co/*`.
- [x] Load it in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → choose `client/`.

**Done when:** the extension opens and the browser console shows "Connected to Supabase".

---

## Step 5 — Login screen

**Who:** Claude · **Time:** 30 min

- [x] Replace the local login with **Supabase Auth** (email + password).
- [x] Stay logged in after Chrome restarts (session saved in `chrome.storage`).
- [x] Log out button.
- [x] Remove the prototype's local "Users" screen. Users are managed in the Supabase dashboard.
  > ✅ Replaced by **Settings → My account** (change name, change password).

**Done when:** you log in with the user from Step 2, close Chrome, reopen it, and are still logged in.

---

## Step 5A — Publish as a website (Cloudflare Pages)

**Who:** Claude prepares the files, you connect Cloudflare once · **Time:** 15 min · **Cost:** free

**Why:** open the app from any computer (or phone) with a link and a login. Nothing to install,
no folder to carry, and every `git push` updates the site automatically. The Chrome extension
still works from the same `client/` folder as a backup.

- [x] `client/js/config.js` is committed (URL + publishable key only — safe; data is protected by login + RLS).
- [x] `client/_headers`: security headers (CSP allows only this site + Supabase, no framing, no referrer).
- [x] `client/robots.txt` + `noindex`: search engines do not list the site.
- [x] Group pages open with `opener` removed, so Facebook tabs cannot control the app tab.
- [x] Create a free Cloudflare account: https://dash.cloudflare.com/sign-up
- [x] **Workers & Pages → Create → Pages → Connect to Git** → allow GitHub → choose repo `nuvi-distribution-manager`.
- [x] Build settings: Project name `nuvi-distribution` · Production branch `main` · Framework preset **None** ·
      Build command **(empty)** · Build output directory **`client`** → **Save and Deploy**.
- [x] Open `https://nuvi-distribution.pages.dev` (the exact link is shown after deploy) and sign in.

> ✅ Deployed as a Cloudflare **Worker** (static assets) instead of Pages:
> **https://nuvi-distribution-manager.nuviengineering.workers.dev/** · auto-deploys on push to `main`.

**Done when:** you sign in on the website from two different computers.

**Domain (optional, later):** the free `*.pages.dev` link is enough. Cloudflare does not give free
domains. If NUVI already owns a domain, a sub-domain such as `distribution.<your-domain>` can be
added free under **Custom domains**. A new `.com` costs about USD 10/year from Cloudflare Registrar.

---

## Step 6 — Profiles

**Who:** Claude · **Time:** 30 min

- [x] Load profiles from the `profiles` table into the sidebar.
- [x] Settings → Profiles: add / edit (name, short name, tag, colour, ad types).
- [x] Delete is allowed only if the profile has no groups, ads or campaigns.

**Done when:** you add "NUVI Test" and it appears in the sidebar, and still appears after a reload.

---

## Step 7 — Facebook groups (+ CSV)

**Who:** Claude · **Time:** 1 hour

- [ ] List, search, filter (category, status).
- [ ] Add / edit / delete. Fields: **Name\***, **URL\***, **Status\***, Category (optional), Notes (optional).
- [ ] URL check + duplicate check (the database also blocks duplicates).
- [ ] CSV import with preview (Valid / Invalid / Duplicate) and CSV export.

**Done when:** you import your real list of 39 Engineering groups from CSV.

---

## Step 8 — Advertisements

**Who:** Claude · **Time:** 45 min

- [ ] List: name, type, created date, status, "published in n groups".
- [ ] Add / edit. Facebook post URL check (tracking parameters removed).
- [ ] Delete → suggest **Archive** if the ad has campaign history.

**Done when:** you add a real advertisement from the NUVI Facebook Page.

---

## Step 9 — Distribution (the main feature)

**Who:** Claude · **Time:** 2–3 hours

- [ ] Choose an ad + choose groups → **START DISTRIBUTION** creates a campaign.
- [ ] Groups open one by one in **one** separate tab.
- [ ] Buttons: Published → Next, Approval Required, Failed (with reason), Skip, Prev, Pause, Stop.
- [ ] Copy Ad Link · Open Original (separate tab).
- [ ] Duplicate warning if the ad was already published in that group.
- [ ] Every click is saved to Supabase **before** the next group opens.
- [ ] Only one campaign can run at a time (the database enforces it).
- [ ] Resume after closing Chrome.

**Done when:** you run a real campaign on 5 groups, close Chrome halfway, and can resume.

---

## Step 10 — Campaign history

**Who:** Claude · **Time:** 45 min

- [ ] List of campaigns: ID, ad, date, Published / Selected, status.
- [ ] Campaign detail: every group with status, reason and time.
- [ ] Change a status later (e.g. Approval Required → Published).
- [ ] **Reuse groups** → starts a new campaign with the same groups.
- [ ] Completion summary screen.

**Done when:** you open last week's campaign and change one group to Published.

---

## Step 11 — Settings + backup

**Who:** Claude · **Time:** 45 min

- [ ] Group categories list (short list: Property, IT & Software, Online Selling, Business, Community, Other).
- [ ] Posting gap (seconds) and "recently posted" warning (days).
- [ ] **Backup** → download all data as a JSON file (save it to Google Drive).
- [ ] **Restore** from a JSON file (with a warning).
- [ ] Reminder if there has been no backup for 7 days.
  > The Supabase free plan has **no automatic backups**, so this button is your safety copy.

**Done when:** you download a backup and can restore it into a test profile.

---

## Step 12 — Testing

**Who:** you + Claude · **Time:** 1 hour

Test each item and tick it:

- [ ] Switching profile shows only that profile's groups, ads and campaigns
- [ ] Add, edit and delete a group
- [ ] CSV with bad and duplicate rows → those rows are rejected with clear reasons
- [ ] Start a distribution → the first group opens
- [ ] Published / Skip / Failed / Approval Required each save and move to the next group
- [ ] Pause → Resume continues from the same group
- [ ] Close Chrome mid-campaign → Resume works
- [ ] Close the group tab → the next click opens one new tab
- [ ] Duplicate warning appears for an already-published group
- [ ] Copy Ad Link puts the URL in the clipboard
- [ ] Log out → log in again → the data is still there
- [ ] Use a second computer → log in → the same data appears
- [ ] Backup → Restore works

**Done when:** every box above is ticked.

---

## Step 13 — Install and daily use

**Who:** you · **Time:** 10 min

- [ ] Final install: `chrome://extensions` → **Load unpacked** → `client/`.
- [ ] Pin the extension icon to the Chrome toolbar.
- [ ] Each update: `git pull` (if needed) → **Reload** on `chrome://extensions`.
- [ ] Back up once a week to Google Drive.
- [ ] ⚠ The Supabase free plan **pauses a project after 7 days with no use**. Using the app every week
      prevents this. If it does pause, click **Restore project** in the Supabase dashboard (no data is lost).

**Done when:** you use the app for a real week of sharing.

---

## Later (only when needed)

| Idea | How (still free) |
|---|---|
| Side panel next to Facebook (no tab switching) | Chrome Side Panel API |
| Team members use it too | Add them in Supabase → Authentication → Users |
| Reports / charts | New screen that reads the `campaigns` tables |
| Server tasks (emails, schedules) | Supabase Edge Functions |
| Share with others easily | Chrome Web Store (USD 5 one-time fee) |

---

## Appendix A — Database SQL (`server/schema.sql`)

```sql
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
```

---

## Change Log

| Date | Step | What was done |
|---|---|---|
| 13/11/2026 | — | Plan created |
| 13/11/2026 | 1 | Git repo set up, `.gitignore` + README added, first commit pushed to private GitHub repo `nuvi-distribution-manager` |
| 13/11/2026 | 2 | Supabase project `nuvi-distribution` created (Free, Seoul). URL and publishable key received |
| 13/11/2026 | 3 | `server/schema.sql` written (Appendix A + API grants + check queries) |
| 14/11/2026 | 0 | Tools confirmed in use (Chrome, VS Code, Git, GitHub, Supabase) |
| 14/11/2026 | 2 | Login user created in Supabase Auth. Check of `/auth/v1/settings` shows sign-ups still ON (`disable_signup: false`) |
| 14/11/2026 | 3 | `schema.sql` run in SQL Editor; 6 tables created; profiles NUVI Engineering (ENG) + NUVI IT (IT) confirmed |
| 14/11/2026 | 4 | `client/` built: prototype screens + supabase-js 2.118.0 + `js/db.js` + git-ignored `config.js` + host permission. Headless test logs "Connected to Supabase" |
| 14/11/2026 | 2 | Sign-ups confirmed OFF (`disable_signup: true`) |
| 14/11/2026 | 4 | Loaded unpacked in Chrome by owner; app opens |
| 14/11/2026 | 5 | Supabase Auth login (email + password), session in `chrome.storage.local`, log out, Settings → My account; local Users screen and old local password hashes removed. Headless test: wrong password shows "Wrong email or password." |
| 14/11/2026 | 5A | Owner chose a website over carrying the extension. `client/` made ready for Cloudflare Pages: config committed, `_headers` (CSP etc.), robots/noindex, favicon, `opener` removed on opened tabs. Local test under the same CSP: connects and login errors show correctly |
| 14/11/2026 | 5A | Repo made **public** at owner's request (history scanned first: no secrets). Includes the 3 PDFs in `doc/` |
| 14/11/2026 | 5A | Live at https://nuvi-distribution-manager.nuviengineering.workers.dev/ (Cloudflare Worker, static assets). Git link + build token reconnected by owner |
| 14/11/2026 | 5 | Login tested by owner on the website |
| 14/11/2026 | 6 | Profiles load from / save to Supabase (`Store.syncProfiles`). Old local ids (B001…) re-linked by tag; local-only profiles with data are created online; restore/reset re-sync. Loading screen + offline fallback. Mock-DB tests pass |
