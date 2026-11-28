-- =============================================================================
-- CAPTENLY — Migration 006: Plus Code Cleanup & Sanitized Public Facility View
-- Idempotent & non-destructive to user/facility accounts.
--
-- Covers GAP-011:
--   (a) One-time Google Plus Code sanitization on existing rows in
--       `public.captenly_facilities` (`address_ar`, `district`, `payload`).
--   (b) Revokes broad `anon` table SELECT on `public.captenly_facilities` so
--       raw `payload` (ownerMemberCode, staffMembers) cannot be queried via the
--       public PostgREST anon key, and provides `public.captenly_facilities_public`.
-- Note: Server API routes use `service_role` and remain unaffected.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- (a) One-time Plus Code sanitization in `public.captenly_facilities`
-- ---------------------------------------------------------------------------
update public.captenly_facilities
set
  address_ar = nullif(
    trim(
      both ' ،,-•/'
      from regexp_replace(
        coalesce(address_ar, ''),
        '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}',
        '',
        'gi'
      )
    ),
    ''
  ),
  district = coalesce(
    nullif(
      trim(
        both ' ،,-•/'
        from regexp_replace(
          coalesce(district, ''),
          '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}',
          '',
          'gi'
        )
      ),
      ''
    ),
    city
  ),
  payload = jsonb_set(
    jsonb_set(
      payload,
      '{addressAr}',
      to_jsonb(
        coalesce(
          nullif(
            trim(
              both ' ،,-•/'
              from regexp_replace(
                coalesce(payload->>'addressAr', address_ar, ''),
                '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}',
                '',
                'gi'
              )
            ),
            ''
          ),
          city
        )
      ),
      true
    ),
    '{district}',
    to_jsonb(
      coalesce(
        nullif(
          trim(
            both ' ،,-•/'
            from regexp_replace(
              coalesce(payload->>'district', district, ''),
              '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}',
              '',
              'gi'
            )
          ),
          ''
        ),
        city
      )
    ),
    true
  ),
  updated_at = now()
where
  coalesce(address_ar, '') ~* '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}'
  or coalesce(district, '') ~* '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}'
  or coalesce(payload->>'addressAr', '') ~* '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}'
  or coalesce(payload->>'district', '') ~* '[02-9CFGHJMPQRVWX]{4,8}\s*\+\s*[02-9CFGHJMPQRVWX]{2,5}';

-- ---------------------------------------------------------------------------
-- (b) Restrict direct `anon` SELECT on raw `captenly_facilities.payload`
--     and expose a sanitized public catalog view without owner/staff PII.
-- ---------------------------------------------------------------------------
drop policy if exists "captenly_facilities_public_select" on public.captenly_facilities;
drop policy if exists "captenly_facilities_public_read" on public.captenly_facilities;

revoke select on public.captenly_facilities from anon;

create or replace view public.captenly_facilities_public
with (security_invoker = false) as
select
  id,
  slug,
  name_ar,
  name_en,
  sport_sector,
  supply_status,
  city,
  district,
  governorate,
  address_ar,
  lat,
  lng,
  rating,
  reviews_count,
  google_place_id,
  facebook_url,
  instagram_url,
  is_featured_tier,
  (
    payload
    - 'ownerMemberCode'
    - 'staffMembers'
    - 'coachRoster'
    - 'whatsappNumber'
    - 'phone'
  ) as sanitized_payload,
  created_at,
  updated_at
from public.captenly_facilities;

grant select on public.captenly_facilities_public to anon, authenticated;

commit;

notify pgrst, 'reload schema';
