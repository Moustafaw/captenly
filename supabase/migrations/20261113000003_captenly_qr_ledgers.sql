-- =============================================================================
-- CAPTENLY — Cross-Device Session Ledgers & QR Attendance Sync
-- Idempotent migration: creates public.captenly_session_ledgers + indexes + RLS
-- =============================================================================

create table if not exists public.captenly_session_ledgers (
  id text primary key,
  ledger_code text not null unique,
  member_code text,
  athlete_id text not null,
  athlete_name_ar text not null,
  coach_id text not null,
  facility_id text not null,
  pin_code text not null,
  total_sessions integer not null,
  completed_sessions integer not null default 0,
  status text not null default 'active' check (status in ('active', 'renewal_due', 'completed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_session_ledgers_member_code
  on public.captenly_session_ledgers (member_code);

create index if not exists idx_captenly_session_ledgers_athlete_id
  on public.captenly_session_ledgers (athlete_id);

create index if not exists idx_captenly_session_ledgers_coach_id
  on public.captenly_session_ledgers (coach_id);

create index if not exists idx_captenly_session_ledgers_facility_id
  on public.captenly_session_ledgers (facility_id);

alter table public.captenly_session_ledgers enable row level security;
