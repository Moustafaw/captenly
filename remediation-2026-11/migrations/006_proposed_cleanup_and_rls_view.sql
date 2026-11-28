-- =============================================================================
-- CAPTENLY — PROPOSED Remediation Migration 006 (UNEXECUTED PROPOSAL ONLY)
-- DO NOT RUN AGAINST PRODUCTION WITHOUT EXPLICIT DBA REVIEW & DATABASE BACKUP.
--
-- Covers GAP-011:
--   (a) Safe one-time Google Plus Code sanitization on existing rows
--       (including "Captainly Academy" / "X529+F73" and similar OLC tokens)
--   (b) Restricting direct anonymous access to raw `payload` JSONB on
--       `public.captenly_facilities` and providing a sanitized public view.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- (a) One-time Plus Code sanitization in `public.captenly_facilities`
-- Strips Google Open Location Codes (e.g. X529+F73, 8G2Q+9X) from
-- `address_ar`, `district`, and `payload` JSONB address/district/locations.
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
-- Note: Server API routes (`/api/supabase/public-supply`) use `service_role`
--       and remain unaffected.
-- ---------------------------------------------------------------------------
drop policy if exists "captenly_facilities_public_select" on public.captenly_facilities;

-- Authenticated/admin server access remains governed by service_role or explicit policies;
-- revoke broad table-level SELECT from `anon` so raw `payload` (ownerMemberCode, staffMembers)
-- cannot be queried directly via PostgREST anon key.
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

-- notify pgrst, 'reload schema';
