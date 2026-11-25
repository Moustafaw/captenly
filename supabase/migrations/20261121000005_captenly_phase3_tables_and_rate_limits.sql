-- =============================================================================
-- CAPTENLY — Phase 3 Additive Security & Schema Completeness Migration (005)
-- Non-destructive & idempotent: preserves all existing tables, columns, rows,
-- indexes, and constraints. Adds the 6 tables previously missing from migrations
-- plus shared persistent rate limiting storage for Vercel serverless instances.
-- Note: Do not execute against Production without explicit DBA review & backup.
-- =============================================================================

-- 1. Articles (editorial content — previously created lazily in public-supply)
create table if not exists public.captenly_articles (
  id text primary key,
  slug text unique,
  title_ar text not null,
  category_ar text,
  author_entity_id text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.captenly_articles enable row level security;

drop policy if exists "captenly_articles_public_read" on public.captenly_articles;
create policy "captenly_articles_public_read"
  on public.captenly_articles
  for select
  using (true);

-- 2. Personal Best Swimming Records (previously created lazily in user-state)
create table if not exists public.captenly_pb_records (
  id text primary key,
  member_code text not null,
  athlete_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_pb_records_member_code
  on public.captenly_pb_records (member_code);
create index if not exists idx_captenly_pb_records_athlete_id
  on public.captenly_pb_records (athlete_id);

alter table public.captenly_pb_records enable row level security;

-- 3. Five-Point Skill Evaluations (previously created lazily in user-state)
create table if not exists public.captenly_skill_evaluations (
  athlete_id text primary key,
  member_code text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_skill_evaluations_member_code
  on public.captenly_skill_evaluations (member_code);

alter table public.captenly_skill_evaluations enable row level security;

-- 4. Minor / Child Athletes Profiles (Law 151/2020 — previously lazy in user-state)
create table if not exists public.captenly_minor_athletes (
  id text primary key,
  parent_member_code text not null,
  child_member_code text,
  full_name_ar text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.captenly_minor_athletes
  add column if not exists child_member_code text,
  add column if not exists full_name_ar text;

create index if not exists idx_captenly_minor_athletes_parent
  on public.captenly_minor_athletes (parent_member_code);
create unique index if not exists idx_captenly_minor_athletes_child_code
  on public.captenly_minor_athletes (child_member_code)
  where child_member_code is not null;

alter table public.captenly_minor_athletes enable row level security;

-- 5. User Preferences (Favorites, Compare IDs, Location, UI Settings)
create table if not exists public.captenly_user_prefs (
  member_code text primary key,
  favorites jsonb default '[]'::jsonb,
  compare_ids jsonb default '[]'::jsonb,
  user_settings jsonb default '{}'::jsonb,
  user_location jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.captenly_user_prefs enable row level security;

-- 6. Facility Coach/Academy Affiliations (Pool Desk — previously lazy in facilityLinksDb)
create table if not exists public.captenly_facility_links (
  id text primary key,
  facility_id text not null,
  linked_coach_id text,
  linked_facility_id text,
  linked_member_code text,
  direction text not null default 'added_by_facility',
  status text not null default 'pending',
  can_scan_group_qr boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_facility_links_fac
  on public.captenly_facility_links (facility_id);
create index if not exists idx_captenly_facility_links_coach
  on public.captenly_facility_links (linked_coach_id);
create index if not exists idx_captenly_facility_links_code
  on public.captenly_facility_links (linked_member_code);

alter table public.captenly_facility_links enable row level security;

-- 7. Additive Column & RLS Parity Guards for Tables from Migrations 001..004
alter table if exists public.captenly_profiles
  add column if not exists bio_ar text,
  add column if not exists social_links jsonb default '{}'::jsonb,
  add column if not exists governorate text,
  add column if not exists password_hash text,
  add column if not exists otp_code_hash text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists account_intent text;

alter table if exists public.captenly_facilities
  add column if not exists google_place_id text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists is_featured_tier boolean default false;

alter table if exists public.captenly_demand_radar
  add column if not exists target_facility_id text,
  add column if not exists target_facility_name_ar text;

alter table if exists public.captenly_profiles enable row level security;
alter table if exists public.captenly_facilities enable row level security;
alter table if exists public.captenly_coaches enable row level security;
alter table if exists public.captenly_leads enable row level security;
alter table if exists public.captenly_demand_radar enable row level security;
alter table if exists public.captenly_notifications enable row level security;
alter table if exists public.captenly_session_ledgers enable row level security;
alter table if exists public.captenly_role_claims enable row level security;

do $$
begin
  if to_regclass('public.captenly_notifications') is not null then
    drop policy if exists "captenly_notifications_public_read" on public.captenly_notifications;
  end if;
end $$;

-- 8. Shared Persistent Rate Limiting Table (Serverless-Safe Across Vercel Instances)
create table if not exists public.captenly_rate_limits (
  key text primary key,
  hit_count integer not null default 1,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_rate_limits_reset_at
  on public.captenly_rate_limits (reset_at);

alter table public.captenly_rate_limits enable row level security;

-- Refresh PostgREST schema cache immediately so new tables are visible without transient PGRST205
notify pgrst, 'reload schema';
