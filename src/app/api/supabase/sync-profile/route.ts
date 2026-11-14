import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["adult_athlete", "parent", "coach", "facility_manager"]);

let profileSchemaBootstrapped = false;

const PROFILE_BOOTSTRAP_STATEMENTS = [
  `create table if not exists public.captenly_profiles (
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
    bio_ar text,
    social_links jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table public.captenly_profiles add column if not exists bio_ar text`,
  `alter table public.captenly_profiles add column if not exists social_links jsonb default '{}'::jsonb`,
  `alter table public.captenly_profiles add column if not exists governorate text`,
  `alter table public.captenly_profiles enable row level security`,
];

async function ensureProfileTableViaPg() {
  if (profileSchemaBootstrapped) return;
  const res = await withPgClient(async (client) => {
    for (const stmt of PROFILE_BOOTSTRAP_STATEMENTS) {
      await client.query(stmt);
    }
    return true;
  });
  if (res.ok) profileSchemaBootstrapped = true;
}

function normalizeRowToProfile(row: Record<string, unknown>) {
  const role = String(row.role || "adult_athlete");
  const rawCode = String(row.member_code || "");
  const rawSocial =
    row.social_links && typeof row.social_links === "object"
      ? (row.social_links as Record<string, unknown>)
      : {};
  const linkedFacilityId =
    typeof rawSocial._linkedFacilityId === "string" ? rawSocial._linkedFacilityId : undefined;
  const linkedCoachId =
    typeof rawSocial._linkedCoachId === "string" ? rawSocial._linkedCoachId : undefined;
  const cleanSocialLinks: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawSocial)) {
    if (!k.startsWith("_") && typeof v === "string" && v.trim()) {
      cleanSocialLinks[k] = v;
    }
  }

  return {
    id: String(row.id || `member-${rawCode || Date.now()}`),
    dbProfileKey: rawCode,
    memberCode: role === "facility_manager" ? "" : rawCode,
    email: typeof row.email === "string" ? row.email : undefined,
    fullNameAr: String(row.full_name_ar || "عضو كابتنلي"),
    role,
    phone: typeof row.phone === "string" ? row.phone : "",
    city: typeof row.city === "string" ? row.city : "مصر",
    governorate: typeof row.governorate === "string" ? row.governorate : undefined,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : undefined,
    authProvider:
      row.auth_provider === "google" ? ("google" as const) : ("phone" as const),
    hasParentSupervision: Boolean(row.has_parent_supervision),
    needsOnboarding: Boolean(row.needs_onboarding),
    bioAr: typeof row.bio_ar === "string" ? row.bio_ar : undefined,
    socialLinks: Object.keys(cleanSocialLinks).length > 0 ? cleanSocialLinks : undefined,
    linkedFacilityId,
    linkedCoachId,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const emailParam = (searchParams.get("email") || "").trim().toLowerCase();
  const memberCodeParam = (searchParams.get("memberCode") || "").trim().toUpperCase();
  const phoneRaw = (searchParams.get("phone") || "").trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  const phoneTail10 = phoneDigits.length >= 9 ? phoneDigits.slice(-10) : "";

  if (!emailParam && !memberCodeParam && !phoneTail10) {
    return NextResponse.json({ ok: false, found: false, profile: null, error: "missing_lookup_query" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin.from("captenly_profiles").select("*").limit(1);
      if (emailParam) {
        query = query.eq("email", emailParam);
      } else if (memberCodeParam) {
        query = query.eq("member_code", memberCodeParam);
      } else if (phoneTail10) {
        query = query.ilike("phone", `%${phoneTail10}`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json({
          ok: true,
          found: true,
          profile: normalizeRowToProfile(data[0] as Record<string, unknown>),
        });
      }
    } catch {
      // Fall through to pg fallback
    }
  }

  await ensureProfileTableViaPg();
  const pgRes = await withPgClient(async (client) => {
    if (emailParam) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where lower(email) = $1 limit 1`,
        [emailParam]
      );
      return rows[0] || null;
    }
    if (memberCodeParam) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where upper(member_code) = $1 limit 1`,
        [memberCodeParam]
      );
      return rows[0] || null;
    }
    if (phoneTail10) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like $1 order by updated_at desc limit 1`,
        [`%${phoneTail10}`]
      );
      return rows[0] || null;
    }
    return null;
  });

  if (pgRes.ok && pgRes.value) {
    return NextResponse.json({
      ok: true,
      found: true,
      profile: normalizeRowToProfile(pgRes.value as Record<string, unknown>),
    });
  }

  return NextResponse.json({
    ok: pgRes.ok || Boolean(admin),
    found: false,
    profile: null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const memberCode = typeof body.memberCode === "string" ? body.memberCode.trim() : "";
    const fullNameAr = typeof body.fullNameAr === "string" ? body.fullNameAr.trim() : "";
    const role = typeof body.role === "string" && ALLOWED_ROLES.has(body.role) ? body.role : "adult_athlete";

    if (!memberCode || !fullNameAr) {
      return NextResponse.json({ persisted: false, error: "missing_required_fields" }, { status: 400 });
    }

    const email =
      typeof body.email === "string" && body.email.includes("@")
        ? body.email.trim().toLowerCase()
        : null;

    const mergedSocialLinks: Record<string, unknown> | undefined =
      (body.socialLinks && typeof body.socialLinks === "object") ||
      typeof body.linkedFacilityId === "string" ||
      typeof body.linkedCoachId === "string"
        ? {
            ...(body.socialLinks && typeof body.socialLinks === "object" ? body.socialLinks : {}),
            ...(typeof body.linkedFacilityId === "string" && body.linkedFacilityId
              ? { _linkedFacilityId: body.linkedFacilityId }
              : {}),
            ...(typeof body.linkedCoachId === "string" && body.linkedCoachId
              ? { _linkedCoachId: body.linkedCoachId }
              : {}),
          }
        : undefined;

    const baseRecord: Record<string, unknown> = {
      member_code: memberCode,
      email,
      full_name_ar: fullNameAr,
      role,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      city: typeof body.city === "string" ? body.city.trim() || null : null,
      governorate: typeof body.governorate === "string" ? body.governorate.trim() || null : null,
      auth_provider: typeof body.authProvider === "string" ? body.authProvider : "captenly",
      has_parent_supervision: Boolean(body.hasParentSupervision),
      needs_onboarding: Boolean(body.needsOnboarding),
      updated_at: new Date().toISOString(),
    };

    if (typeof body.avatarUrl === "string" && body.avatarUrl.trim()) {
      baseRecord.avatar_url = body.avatarUrl.trim();
    }

    const extendedRecord: Record<string, unknown> = {
      ...baseRecord,
      ...(typeof body.bioAr === "string" ? { bio_ar: body.bioAr.trim() || null } : {}),
      ...(mergedSocialLinks ? { social_links: mergedSocialLinks } : {}),
    };

    const admin = getSupabaseAdminClient();
    if (admin) {
      const onConflict = email ? "email" : "member_code";
      let { error } = await admin.from("captenly_profiles").upsert(extendedRecord, { onConflict });

      // Graceful fallback if migration 000002 hasn't been executed yet in Supabase
      if (error && (error.code === "42703" || error.code === "PGRST204")) {
        const retry = await admin.from("captenly_profiles").upsert(baseRecord, { onConflict });
        error = retry.error;
      }

      if (!error) {
        return NextResponse.json({ persisted: true });
      }
    }

    await ensureProfileTableViaPg();
    const pgRes = await withPgClient(async (client) => {
      const avatarVal = typeof body.avatarUrl === "string" && body.avatarUrl.trim() ? body.avatarUrl.trim() : null;
      const bioVal = typeof body.bioAr === "string" ? body.bioAr.trim() || null : null;
      const socialVal = mergedSocialLinks ? JSON.stringify(mergedSocialLinks) : null;

      if (email) {
        await client.query(
          `insert into public.captenly_profiles
            (member_code, email, full_name_ar, role, phone, city, governorate, avatar_url, auth_provider, has_parent_supervision, needs_onboarding, bio_ar, social_links, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13::jsonb, '{}'::jsonb), now())
           on conflict (email) where email is not null do update set
            member_code = excluded.member_code,
            full_name_ar = excluded.full_name_ar,
            role = excluded.role,
            phone = coalesce(excluded.phone, public.captenly_profiles.phone),
            city = coalesce(excluded.city, public.captenly_profiles.city),
            governorate = coalesce(excluded.governorate, public.captenly_profiles.governorate),
            avatar_url = coalesce(excluded.avatar_url, public.captenly_profiles.avatar_url),
            auth_provider = excluded.auth_provider,
            has_parent_supervision = excluded.has_parent_supervision,
            needs_onboarding = excluded.needs_onboarding,
            bio_ar = coalesce(excluded.bio_ar, public.captenly_profiles.bio_ar),
            social_links = case when $13 is not null then $13::jsonb else public.captenly_profiles.social_links end,
            updated_at = now()`,
          [
            memberCode,
            email,
            fullNameAr,
            role,
            baseRecord.phone,
            baseRecord.city,
            baseRecord.governorate,
            avatarVal,
            baseRecord.auth_provider,
            baseRecord.has_parent_supervision,
            baseRecord.needs_onboarding,
            bioVal,
            socialVal,
          ]
        );
      } else {
        await client.query(
          `insert into public.captenly_profiles
            (member_code, email, full_name_ar, role, phone, city, governorate, avatar_url, auth_provider, has_parent_supervision, needs_onboarding, bio_ar, social_links, updated_at)
           values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, coalesce($12::jsonb, '{}'::jsonb), now())
           on conflict (member_code) do update set
            full_name_ar = excluded.full_name_ar,
            role = excluded.role,
            phone = coalesce(excluded.phone, public.captenly_profiles.phone),
            city = coalesce(excluded.city, public.captenly_profiles.city),
            governorate = coalesce(excluded.governorate, public.captenly_profiles.governorate),
            avatar_url = coalesce(excluded.avatar_url, public.captenly_profiles.avatar_url),
            auth_provider = excluded.auth_provider,
            has_parent_supervision = excluded.has_parent_supervision,
            needs_onboarding = excluded.needs_onboarding,
            bio_ar = coalesce(excluded.bio_ar, public.captenly_profiles.bio_ar),
            social_links = case when $12 is not null then $12::jsonb else public.captenly_profiles.social_links end,
            updated_at = now()`,
          [
            memberCode,
            fullNameAr,
            role,
            baseRecord.phone,
            baseRecord.city,
            baseRecord.governorate,
            avatarVal,
            baseRecord.auth_provider,
            baseRecord.has_parent_supervision,
            baseRecord.needs_onboarding,
            bioVal,
            socialVal,
          ]
        );
      }
      return true;
    });

    if (pgRes.ok) {
      return NextResponse.json({ persisted: true });
    }

    return NextResponse.json({
      persisted: false,
      reason: pgRes.errorCode || (admin ? "db_error" : "supabase_not_configured"),
    });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
