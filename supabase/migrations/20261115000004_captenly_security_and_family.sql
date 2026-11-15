-- Captenly Security Hardening, Role Claims Queue, and Hybrid Swimmer+Parent Child Sub-Codes
-- Migration 004

-- 1. Remove permissive anonymous read on notifications
drop policy if exists "captenly_notifications_public_read" on public.captenly_notifications;
alter table if exists public.captenly_notifications enable row level security;

-- 2. Enable RLS on user-state tables (if already created)
alter table if exists public.captenly_pb_records enable row level security;
alter table if exists public.captenly_skill_evaluations enable row level security;
alter table if exists public.captenly_minor_athletes enable row level security;
alter table if exists public.captenly_user_prefs enable row level security;

-- 3. Enable RLS on articles with explicit public read policy (editorial content is public)
do $$
begin
  if to_regclass('public.captenly_articles') is not null then
    alter table public.captenly_articles enable row level security;
    drop policy if exists "captenly_articles_public_read" on public.captenly_articles;
    create policy "captenly_articles_public_read"
      on public.captenly_articles
      for select
      using (true);
  end if;
end $$;

-- 4. Model D: Unique child sub-code (CAP-JR-XXXX-NN) + full name column on minor athletes
do $$
begin
  if to_regclass('public.captenly_minor_athletes') is not null then
    alter table public.captenly_minor_athletes
      add column if not exists child_member_code text,
      add column if not exists full_name_ar text;
    create unique index if not exists idx_captenly_minor_athletes_child_code
      on public.captenly_minor_athletes (child_member_code)
      where child_member_code is not null;
  end if;
end $$;

-- 5. Profiles auth & intent columns
alter table if exists public.captenly_profiles
  add column if not exists password_hash text,
  add column if not exists otp_code_hash text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists account_intent text;

-- 6. Demand Radar: allow 'other' sport and unclaimed facility demand target
alter table if exists public.captenly_demand_radar
  add column if not exists target_facility_id text,
  add column if not exists target_facility_name_ar text;

create index if not exists idx_captenly_demand_radar_facility
  on public.captenly_demand_radar (target_facility_id)
  where target_facility_id is not null;

do $$
declare
  c_name text;
begin
  if to_regclass('public.captenly_demand_radar') is not null then
    for c_name in
      select conname
      from pg_constraint
      where conrelid = 'public.captenly_demand_radar'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%target_sport%'
    loop
      execute format('alter table public.captenly_demand_radar drop constraint if exists %I', c_name);
    end loop;
    alter table public.captenly_demand_radar
      add constraint captenly_demand_radar_target_sport_check
      check (target_sport in ('swimming', 'fitness', 'both', 'other'));
  end if;
end $$;

-- 7. Leads status constraint alignment (pending + whatsapp_initiated + confirmed + completed + cancelled)
do $$
declare
  c_name text;
begin
  if to_regclass('public.captenly_leads') is not null then
    for c_name in
      select conname
      from pg_constraint
      where conrelid = 'public.captenly_leads'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
    loop
      execute format('alter table public.captenly_leads drop constraint if exists %I', c_name);
    end loop;
    alter table public.captenly_leads
      add constraint captenly_leads_status_check
      check (status in ('pending', 'whatsapp_initiated', 'confirmed', 'completed', 'cancelled'));
  end if;
end $$;

-- 8. Pending Role & Facility Ownership Claims Queue (Admin-Reviewed Transitions)
create table if not exists public.captenly_role_claims (
  id text primary key,
  applicant_member_code text not null,
  applicant_name_ar text not null default '',
  applicant_phone text not null default '',
  applicant_email text not null default '',
  claim_type text not null check (claim_type in ('coach', 'facility')),
  target_facility_id text,
  target_facility_name_ar text,
  city_ar text,
  governorate_ar text,
  proof_document_url text,
  proof_notes_ar text,
  proposed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'withdrawn')),
  reviewer_note_ar text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.captenly_role_claims enable row level security;

create index if not exists idx_captenly_role_claims_applicant
  on public.captenly_role_claims (applicant_member_code);
create index if not exists idx_captenly_role_claims_status
  on public.captenly_role_claims (status);
