-- NUVI Distribution Manager — profile details (logo, Facebook page, contacts, page admins)
-- Run ONCE after 002. Only ADDS columns; existing data is not changed.

alter table profiles
  add column if not exists logo         text,             -- small image (data:image/..., resized in the app to 256 px)
  add column if not exists fb_page_url  text,             -- the business Facebook Page
  add column if not exists website      text,
  add column if not exists email        text,
  add column if not exists phone        text,
  add column if not exists whatsapp     text,
  add column if not exists address      text,
  add column if not exists about        text,             -- short description / tagline used in posts
  add column if not exists page_admins  jsonb not null default '[]'::jsonb;  -- [{ "name": "", "role": "", "contact": "" }]

alter table profiles
  add constraint profiles_logo_chk        check (logo is null or (logo like 'data:image/%' and char_length(logo) <= 300000)),
  add constraint profiles_fb_page_url_chk check (fb_page_url is null or fb_page_url ~* '^https://([a-z0-9-]+\.)?(facebook|fb)\.com/'),
  add constraint profiles_website_chk     check (website is null or website ~* '^https?://'),
  add constraint profiles_about_chk       check (about is null or char_length(about) <= 1000),
  add constraint profiles_admins_chk      check (jsonb_typeof(page_admins) = 'array' and jsonb_array_length(page_admins) <= 20);

-- Check
select id, short_name, fb_page_url, jsonb_array_length(page_admins) as admins from profiles order by id;
