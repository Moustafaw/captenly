-- =============================================================================
-- CAPTENLY — Migration 007: WhatsApp Dispatches, Newsletter & Law 151 Compliance
-- Strictly additive & idempotent. Zero destructive operations.
-- =============================================================================

begin;

-- 1. Server-side WhatsApp Notification Dispatches (delivery status, retries, dedupe)
create table if not exists public.captenly_whatsapp_dispatches (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique not null,
  event_type text not null,
  recipient_member_code text not null,
  recipient_phone_e164 text,
  facility_id text,
  ledger_id text,
  template_name text,
  message_preview_ar text not null,
  provider text not null default 'meta_whatsapp_cloud',
  provider_message_id text,
  delivery_status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz,
  last_error_code text,
  last_error_detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captenly_wa_dispatches_recipient
  on public.captenly_whatsapp_dispatches (recipient_member_code, created_at desc);
create index if not exists idx_captenly_wa_dispatches_facility
  on public.captenly_whatsapp_dispatches (facility_id, created_at desc);
create index if not exists idx_captenly_wa_dispatches_retry
  on public.captenly_whatsapp_dispatches (delivery_status, next_retry_at);
create index if not exists idx_captenly_wa_dispatches_provider_msg
  on public.captenly_whatsapp_dispatches (provider_message_id)
  where provider_message_id is not null;

alter table public.captenly_whatsapp_dispatches enable row level security;
revoke all on public.captenly_whatsapp_dispatches from anon, authenticated;

-- 2. Magazine Newsletter Subscribers (GAP-017)
create table if not exists public.captenly_newsletter_subscribers (
  email text primary key,
  member_code text,
  status text not null default 'active',
  source text not null default 'magazine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.captenly_newsletter_subscribers enable row level security;
revoke all on public.captenly_newsletter_subscribers from anon, authenticated;

-- 3. Immutable Guardian Consent Logs (Law 151/2020 — GAP-021)
create table if not exists public.captenly_consent_logs (
  id uuid primary key default gen_random_uuid(),
  parent_member_code text not null,
  child_athlete_id text not null,
  child_member_code text,
  consent_version text not null default 'law_151_2020_v1',
  consent_text_ar text not null,
  granted boolean not null default true,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_captenly_consent_logs_parent
  on public.captenly_consent_logs (parent_member_code, created_at desc);

alter table public.captenly_consent_logs enable row level security;
revoke all on public.captenly_consent_logs from anon, authenticated;

-- 4. 12h SLA Abuse / Safety Reports (GAP-021)
create table if not exists public.captenly_abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_member_code text,
  target_entity_type text not null,
  target_entity_id text not null,
  reason_ar text not null,
  status text not null default 'open',
  sla_due_at timestamptz not null default (now() + interval '12 hours'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_captenly_abuse_reports_status
  on public.captenly_abuse_reports (status, sla_due_at);

alter table public.captenly_abuse_reports enable row level security;
revoke all on public.captenly_abuse_reports from anon, authenticated;

commit;

notify pgrst, 'reload schema';
