-- Captenly v2 Schema Migration (Safe / Additive)
-- Run in Supabase SQL Editor after 20261113000001_captenly_core.sql

alter table if exists public.captenly_profiles
  add column if not exists bio_ar text,
  add column if not exists social_links jsonb default '{}'::jsonb;

alter table if exists public.captenly_facilities
  add column if not exists google_place_id text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists is_featured_tier boolean default false;

create index if not exists idx_captenly_facilities_google_place_id
  on public.captenly_facilities (google_place_id)
  where google_place_id is not null;

create table if not exists public.captenly_notifications (
  id uuid primary key default gen_random_uuid(),
  member_code text not null,
  title_ar text not null,
  message_ar text not null,
  notif_type text not null default 'system',
  action_label_ar text,
  action_href text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_captenly_notifications_member
  on public.captenly_notifications (member_code, created_at desc);

alter table public.captenly_notifications enable row level security;

drop policy if exists "captenly_notifications_public_read" on public.captenly_notifications;
create policy "captenly_notifications_public_read"
  on public.captenly_notifications for select
  using (true);
