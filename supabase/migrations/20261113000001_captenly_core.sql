-- =============================================================================
-- CAPTENLY — Core PostgreSQL & Supabase Schema
-- Compatible with Supabase Marketplace Integration on Vercel (Frankfurt / fra1)
-- Security: RLS enabled on all public tables; no SECURITY DEFINER in public
-- =============================================================================

create extension if not exists pgcrypto;

-- 1) Profiles & Members Directory (synced with Google OAuth + Captenly Member Codes)
create table if not exists public.captenly_profiles (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique,
  email text unique,
  full_name_ar text not null,
  role text not null check (role in ('adult_athlete', 'parent', 'coach', 'facility_manager')),
  phone text,
  city text,
  governorate text,
  avatar_url text,
  auth_provider text not null default 'captenly',
  has_parent_supervision boolean not null default false,
  needs_onboarding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_profiles_member_code
  on public.captenly_profiles (member_code);
create index if not exists idx_captenly_profiles_email
  on public.captenly_profiles (email)
  where email is not null;

-- 2) Verified & Seeded Sports Facilities Directory
create table if not exists public.captenly_facilities (
  id text primary key,
  slug text not null unique,
  name_ar text not null,
  name_en text,
  sport_sector text not null check (sport_sector in ('swimming', 'fitness', 'both')),
  supply_status text not null check (supply_status in ('verified_claimed', 'seeded_unclaimed')),
  city text not null,
  district text not null,
  governorate text not null,
  address_ar text,
  lat double precision not null,
  lng double precision not null,
  rating numeric(3, 2) not null default 0,
  reviews_count integer not null default 0,
  whatsapp_phone text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_facilities_city_sector
  on public.captenly_facilities (city, sport_sector);

-- 3) Coaches Directory
create table if not exists public.captenly_coaches (
  id text primary key,
  slug text not null unique,
  full_name_ar text not null,
  city text not null,
  sport_sector text not null check (sport_sector in ('swimming', 'fitness', 'both')),
  trust_tier text not null,
  rating numeric(3, 2) not null default 0,
  reviews_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_coaches_city_sector
  on public.captenly_coaches (city, sport_sector);

-- 4) Structured Booking & WhatsApp Leads
create table if not exists public.captenly_leads (
  id uuid primary key default gen_random_uuid(),
  facility_id text not null,
  facility_name_ar text,
  member_code text,
  member_name_ar text,
  phone text,
  package_name_ar text,
  estimated_total_egp integer,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_captenly_leads_facility_created
  on public.captenly_leads (facility_id, created_at desc);

-- 5) Demand Radar Expansion Requests (Uncovered Cities)
create table if not exists public.captenly_demand_radar (
  id uuid primary key default gen_random_uuid(),
  full_name_ar text not null,
  phone text not null,
  city text not null,
  governorate text not null,
  target_sport text not null check (target_sport in ('swimming', 'fitness', 'both')),
  created_at timestamptz not null default now()
);

create index if not exists idx_captenly_demand_radar_city
  on public.captenly_demand_radar (governorate, city);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
alter table public.captenly_profiles enable row level security;
alter table public.captenly_facilities enable row level security;
alter table public.captenly_coaches enable row level security;
alter table public.captenly_leads enable row level security;
alter table public.captenly_demand_radar enable row level security;

-- Public read-only catalog access for facilities & coaches (no PII exposed)
drop policy if exists "captenly_facilities_public_select" on public.captenly_facilities;
create policy "captenly_facilities_public_select"
  on public.captenly_facilities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "captenly_coaches_public_select" on public.captenly_coaches;
create policy "captenly_coaches_public_select"
  on public.captenly_coaches
  for select
  to anon, authenticated
  using (true);

-- Explicit deny on direct anon/client reads of PII tables (handled server-side via secret/service_role key)
-- Authenticated Supabase users can only read their own profile row if linked by email claim
drop policy if exists "captenly_profiles_self_select" on public.captenly_profiles;
create policy "captenly_profiles_self_select"
  on public.captenly_profiles
  for select
  to authenticated
  using (email = (select auth.jwt() ->> 'email'));
