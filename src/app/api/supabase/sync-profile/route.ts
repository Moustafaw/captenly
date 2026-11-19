import { NextResponse } from "next/server";
import type { AccountRole, UserSocialLinks } from "@/types/captenly";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { attachMemberSessionCookie, getServerCaller } from "@/lib/memberSession";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";
import { ensureSelfRegisteredCoachInDb } from "@/lib/server/coachDb";
import { ensureSingleOwnerAccountBaseline } from "@/lib/server/accountPurge";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["adult_athlete", "parent", "coach", "facility_manager"]);
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function toDbSafeRole(candidate: unknown, fallback = "adult_athlete"): string {
  const clean = typeof candidate === "string" ? candidate.trim() : "";
  if (ALLOWED_ROLES.has(clean)) return clean;
  if (ALLOWED_ROLES.has(fallback)) return fallback;
  return "adult_athlete";
}

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
  `alter table public.captenly_profiles add column if not exists password_hash text`,
  `alter table public.captenly_profiles add column if not exists otp_code_hash text`,
  `alter table public.captenly_profiles add column if not exists otp_expires_at timestamptz`,
  `alter table public.captenly_profiles add column if not exists account_intent text`,
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
  const accountIntent =
    typeof rawSocial._accountIntent === "string"
      ? rawSocial._accountIntent
      : typeof row.account_intent === "string"
        ? row.account_intent
        : undefined;
  const cleanSocialLinks: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawSocial)) {
    if (!k.startsWith("_") && typeof v === "string" && v.trim()) {
      cleanSocialLinks[k] = v;
    }
  }

  return {
    id: String(row.id || `member-${rawCode || Date.now()}`),
    dbProfileKey: rawCode,
    memberCode: rawCode,
    email: typeof row.email === "string" ? row.email : undefined,
    fullNameAr: String(row.full_name_ar || "عضو كابتنلي"),
    role,
    accountIntent,
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
  await ensureSingleOwnerAccountBaseline();
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, found: false, profile: null, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const emailParam = (searchParams.get("email") || "").trim().toLowerCase();
  const memberCodeParam = (searchParams.get("memberCode") || "").trim().toUpperCase();
  const phoneRaw = (searchParams.get("phone") || "").trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  const phoneTail10 = phoneDigits.length >= 9 ? phoneDigits.slice(-10) : "";

  if (!emailParam && !memberCodeParam && !phoneTail10) {
    return NextResponse.json({ ok: false, found: false, profile: null, error: "missing_lookup_query" }, { status: 400 });
  }

  if (!caller.isAdmin) {
    const emailMatches = Boolean(emailParam && caller.email && caller.email.toLowerCase() === emailParam);
    const codeMatches = Boolean(memberCodeParam && caller.memberCode && caller.memberCode.toUpperCase() === memberCodeParam);
    const callerTail10 = (caller.phone || "").replace(/\D/g, "").slice(-10);
    const phoneMatches = Boolean(phoneTail10 && callerTail10.length >= 9 && callerTail10 === phoneTail10);
    if (!emailMatches && !codeMatches && !phoneMatches) {
      return NextResponse.json({ ok: false, found: false, profile: null, error: "forbidden" }, { status: 403 });
    }
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let row: Record<string, unknown> | undefined;
      if (emailParam) {
        const { data, error } = await admin
          .from("captenly_profiles")
          .select("*")
          .ilike("email", emailParam)
          .limit(1);
        if (!error && Array.isArray(data) && data.length > 0) {
          row = data[0] as Record<string, unknown>;
        }
      }
      if (!row && memberCodeParam) {
        const { data, error } = await admin
          .from("captenly_profiles")
          .select("*")
          .eq("member_code", memberCodeParam)
          .limit(1);
        if (!error && Array.isArray(data) && data.length > 0) {
          row = data[0] as Record<string, unknown>;
        }
      }
      if (!row && phoneTail10) {
        const { data, error } = await admin
          .from("captenly_profiles")
          .select("*")
          .ilike("phone", `%${phoneTail10}`)
          .limit(1);
        if (!error && Array.isArray(data) && data.length > 0) {
          row = data[0] as Record<string, unknown>;
        }
      }
      if (row) {
        return NextResponse.json(
          {
            ok: true,
            found: true,
            profile: normalizeRowToProfile(row),
          },
          { headers: NO_STORE_HEADERS }
        );
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
      if (rows[0]) return rows[0];
    }
    if (memberCodeParam) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where upper(member_code) = $1 limit 1`,
        [memberCodeParam]
      );
      if (rows[0]) return rows[0];
    }
    if (phoneTail10) {
      const { rows } = await client.query(
        `select * from public.captenly_profiles where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like $1 order by updated_at desc limit 1`,
        [`%${phoneTail10}`]
      );
      if (rows[0]) return rows[0];
    }
    return null;
  });

  if (pgRes.ok && pgRes.value) {
    return NextResponse.json(
      {
        ok: true,
        found: true,
        profile: normalizeRowToProfile(pgRes.value as Record<string, unknown>),
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: pgRes.ok || Boolean(admin),
      found: false,
      profile: null,
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: Request) {
  await ensureSingleOwnerAccountBaseline();
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawMemberCode = typeof body.memberCode === "string" ? body.memberCode.trim().toUpperCase() : "";
    const callerCode = typeof caller.memberCode === "string" ? caller.memberCode.trim().toUpperCase() : "";
    const lookupMemberCode =
      (!rawMemberCode || rawMemberCode.startsWith("FAC-")) && callerCode ? callerCode : rawMemberCode;
    const fullNameAr = typeof body.fullNameAr === "string" ? body.fullNameAr.trim() : "";
    const rawRequestedRole = typeof body.role === "string" ? body.role.trim() : "adult_athlete";
    const requestedRole = ALLOWED_ROLES.has(rawRequestedRole) ? rawRequestedRole : "adult_athlete";

    const bodyEmail =
      typeof body.email === "string" && body.email.includes("@")
        ? body.email.trim().toLowerCase()
        : null;
    const effectiveLookupEmail =
      bodyEmail || (!caller.isAdmin && caller.email ? caller.email.trim().toLowerCase() : null);

    if ((!lookupMemberCode && !effectiveLookupEmail) || !fullNameAr) {
      return NextResponse.json(
        { persisted: false, error: "missing_required_fields", messageAr: "بيانات الحساب المطلوبة غير مكتملة." },
        { status: 400 }
      );
    }

    if (!caller.isAdmin) {
      const codeMatches = Boolean(
        callerCode &&
          ((lookupMemberCode && callerCode === lookupMemberCode) ||
            (rawMemberCode && callerCode === rawMemberCode))
      );
      const emailMatches = Boolean(
        effectiveLookupEmail && caller.email && caller.email.toLowerCase() === effectiveLookupEmail
      );
      if (!codeMatches && !emailMatches) {
        return NextResponse.json(
          { persisted: false, error: "forbidden", messageAr: "لا تملك صلاحية تعديل هذا الحساب." },
          { status: 403 }
        );
      }
    }

    const admin = getSupabaseAdminClient();
    const selectCols =
      "id, member_code, email, role, needs_onboarding, social_links, phone, city, governorate, avatar_url, bio_ar";
    let existingRow: Record<string, unknown> | undefined;

    if (admin) {
      if (effectiveLookupEmail) {
        const lookupByEmail = await admin
          .from("captenly_profiles")
          .select(selectCols)
          .ilike("email", effectiveLookupEmail)
          .limit(1);
        if (!lookupByEmail.error && Array.isArray(lookupByEmail.data) && lookupByEmail.data[0]) {
          existingRow = lookupByEmail.data[0] as Record<string, unknown>;
        }
      }
      if (!existingRow && lookupMemberCode) {
        const lookupByCode = await admin
          .from("captenly_profiles")
          .select(selectCols)
          .eq("member_code", lookupMemberCode)
          .limit(1);
        if (!lookupByCode.error && Array.isArray(lookupByCode.data) && lookupByCode.data[0]) {
          existingRow = lookupByCode.data[0] as Record<string, unknown>;
        }
      }
      if (!existingRow && callerCode && callerCode !== lookupMemberCode) {
        const lookupByCallerCode = await admin
          .from("captenly_profiles")
          .select(selectCols)
          .eq("member_code", callerCode)
          .limit(1);
        if (!lookupByCallerCode.error && Array.isArray(lookupByCallerCode.data) && lookupByCallerCode.data[0]) {
          existingRow = lookupByCallerCode.data[0] as Record<string, unknown>;
        }
      }
    }

    if (!existingRow) {
      const pgExisting = await withPgClient(async (client) => {
        if (effectiveLookupEmail) {
          const { rows } = await client.query(
            `select ${selectCols} from public.captenly_profiles where lower(email) = lower($1) limit 1`,
            [effectiveLookupEmail]
          );
          if (rows[0]) return rows[0] as Record<string, unknown>;
        }
        const codeCandidates = [lookupMemberCode, callerCode].filter(Boolean);
        for (const cand of codeCandidates) {
          const { rows } = await client.query(
            `select ${selectCols} from public.captenly_profiles where upper(member_code) = upper($1) limit 1`,
            [cand]
          );
          if (rows[0]) return rows[0] as Record<string, unknown>;
        }
        return undefined;
      });
      if (pgExisting.ok && pgExisting.value) existingRow = pgExisting.value;
    }

    // Preserve existing member_code so returning users never receive a new code
    const effectiveMemberCode =
      typeof existingRow?.member_code === "string" && existingRow.member_code.trim()
        ? existingRow.member_code.trim().toUpperCase()
        : lookupMemberCode || callerCode || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`;

    const existingEmail =
      typeof existingRow?.email === "string" && existingRow.email.trim()
        ? existingRow.email.trim().toLowerCase()
        : null;
    const effectiveEmail = bodyEmail || existingEmail || effectiveLookupEmail || null;

    const existingSocial =
      existingRow?.social_links && typeof existingRow.social_links === "object"
        ? (existingRow.social_links as Record<string, unknown>)
        : {};
    const existingRole = typeof existingRow?.role === "string" ? existingRow.role : undefined;
    const existingNeedsOnboarding = existingRow ? Boolean(existingRow.needs_onboarding) : true;

    let effectiveRole: string = requestedRole;
    let effectiveLinkedFacilityId: string | undefined;
    let effectiveLinkedCoachId: string | undefined;

    if (caller.isAdmin) {
      effectiveRole = ALLOWED_ROLES.has(rawRequestedRole)
        ? rawRequestedRole
        : toDbSafeRole(existingRole, "adult_athlete");
      effectiveLinkedFacilityId =
        typeof body.linkedFacilityId === "string" && body.linkedFacilityId.trim()
          ? body.linkedFacilityId.trim()
          : typeof existingSocial._linkedFacilityId === "string"
            ? existingSocial._linkedFacilityId
            : caller.linkedFacilityId;
      effectiveLinkedCoachId =
        typeof body.linkedCoachId === "string" && body.linkedCoachId.trim()
          ? body.linkedCoachId.trim()
          : typeof existingSocial._linkedCoachId === "string"
            ? existingSocial._linkedCoachId
            : caller.linkedCoachId;
    } else {
      const isOnboardingCompletion = !existingRow || existingNeedsOnboarding;
      if (isOnboardingCompletion) {
        effectiveRole = ALLOWED_ROLES.has(requestedRole) ? requestedRole : "adult_athlete";
      } else if (
        existingRole === "coach" ||
        existingRole === "facility_manager" ||
        existingRole === "super_admin"
      ) {
        effectiveRole = existingRole;
      } else {
        effectiveRole = requestedRole === "parent" ? "parent" : "adult_athlete";
      }

      effectiveLinkedFacilityId =
        typeof existingSocial._linkedFacilityId === "string"
          ? existingSocial._linkedFacilityId
          : caller.linkedFacilityId;
      effectiveLinkedCoachId =
        typeof existingSocial._linkedCoachId === "string" && existingSocial._linkedCoachId.trim()
          ? existingSocial._linkedCoachId.trim()
          : caller.linkedCoachId ||
            (effectiveRole === "coach" ? getDeterministicCoachId(effectiveMemberCode) : undefined);
    }

    const dbRole = toDbSafeRole(
      effectiveRole,
      toDbSafeRole(
        existingRole,
        effectiveLinkedFacilityId
          ? "facility_manager"
          : effectiveLinkedCoachId
            ? "coach"
            : "adult_athlete"
      )
    );

    const incomingPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const existingPhone = typeof existingRow?.phone === "string" ? existingRow.phone : "";
    const effectivePhone = incomingPhone || existingPhone || null;

    const incomingCity = typeof body.city === "string" ? body.city.trim() : "";
    const existingCity = typeof existingRow?.city === "string" ? existingRow.city : "";
    const effectiveCity = incomingCity || existingCity || null;

    const incomingGov = typeof body.governorate === "string" ? body.governorate.trim() : "";
    const existingGov = typeof existingRow?.governorate === "string" ? existingRow.governorate : "";
    const effectiveGov = incomingGov || existingGov || null;

    const sessionCookieInput = {
      memberCode: effectiveMemberCode,
      role: (effectiveRole === "super_admin" ? "super_admin" : dbRole) as AccountRole,
      email: effectiveEmail || caller.email,
      phone: effectivePhone || caller.phone,
      linkedFacilityId: effectiveLinkedFacilityId,
      linkedCoachId: effectiveLinkedCoachId,
    };

    const incomingIntent =
      typeof body.accountIntent === "string" &&
      ["self_athlete", "parent_only", "both_self_and_parent"].includes(body.accountIntent)
        ? body.accountIntent
        : typeof existingSocial._accountIntent === "string"
          ? existingSocial._accountIntent
          : undefined;

    const cleanIncomingSocial: Record<string, string> = {};
    if (body.socialLinks && typeof body.socialLinks === "object") {
      for (const [k, v] of Object.entries(body.socialLinks as Record<string, unknown>)) {
        if (!k.startsWith("_") && typeof v === "string") {
          cleanIncomingSocial[k] = v;
        }
      }
    } else {
      for (const [k, v] of Object.entries(existingSocial)) {
        if (!k.startsWith("_") && typeof v === "string") {
          cleanIncomingSocial[k] = v;
        }
      }
    }

    const mergedSocialLinks: Record<string, unknown> = {
      ...cleanIncomingSocial,
      ...(effectiveLinkedFacilityId ? { _linkedFacilityId: effectiveLinkedFacilityId } : {}),
      ...(effectiveLinkedCoachId ? { _linkedCoachId: effectiveLinkedCoachId } : {}),
      ...(incomingIntent ? { _accountIntent: incomingIntent } : {}),
    };

    const effectiveNeedsOnboarding =
      body.needsOnboarding === false
        ? false
        : existingRow
          ? Boolean(existingRow.needs_onboarding)
          : false;

    const baseRecord: Record<string, unknown> = {
      member_code: effectiveMemberCode,
      email: effectiveEmail,
      full_name_ar: fullNameAr,
      role: dbRole,
      phone: effectivePhone,
      city: effectiveCity,
      governorate: effectiveGov,
      auth_provider: typeof body.authProvider === "string" ? body.authProvider : "captenly",
      has_parent_supervision: Boolean(body.hasParentSupervision),
      needs_onboarding: effectiveNeedsOnboarding,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.avatarUrl === "string" && body.avatarUrl.trim()) {
      baseRecord.avatar_url = body.avatarUrl.trim();
    } else if (typeof existingRow?.avatar_url === "string" && existingRow.avatar_url.trim()) {
      baseRecord.avatar_url = existingRow.avatar_url.trim();
    }

    const extendedRecord: Record<string, unknown> = {
      ...baseRecord,
      ...(typeof body.bioAr === "string"
        ? { bio_ar: body.bioAr.trim() || null }
        : typeof existingRow?.bio_ar === "string"
          ? { bio_ar: existingRow.bio_ar }
          : {}),
      social_links: mergedSocialLinks,
    };

    let lastAdminError: string | undefined;

    if (admin) {
      let error: { code?: string; message?: string } | null = null;

      if (existingRow) {
        const updateBase: Record<string, unknown> = { ...baseRecord };
        delete updateBase.member_code;
        if (!bodyEmail || existingEmail === effectiveEmail) {
          delete updateBase.email;
        }
        const updateExtended: Record<string, unknown> = { ...extendedRecord };
        delete updateExtended.member_code;
        if (!bodyEmail || existingEmail === effectiveEmail) {
          delete updateExtended.email;
        }

        const existingKeyCode = String(existingRow.member_code || effectiveMemberCode);
        const updRes = await admin
          .from("captenly_profiles")
          .update(updateExtended)
          .eq("member_code", existingKeyCode);
        error = updRes.error;

        if (error && (error.code === "42703" || error.code === "PGRST204")) {
          const retry = await admin
            .from("captenly_profiles")
            .update(updateBase)
            .eq("member_code", existingKeyCode);
          error = retry.error;
        }
      } else {
        const onConflict = effectiveEmail ? "email" : "member_code";
        const upsRes = await admin.from("captenly_profiles").upsert(extendedRecord, { onConflict });
        error = upsRes.error;

        if (error && (error.code === "42703" || error.code === "PGRST204")) {
          const retry = await admin.from("captenly_profiles").upsert(baseRecord, { onConflict });
          error = retry.error;
        }

        // Cross-column unique collision fallback (e.g. email matched/changed on existing member_code)
        if (error?.code === "23505") {
          const fallbackUpdate: Record<string, unknown> = { ...extendedRecord };
          delete fallbackUpdate.member_code;
          delete fallbackUpdate.email;
          const retryByCode = await admin
            .from("captenly_profiles")
            .update(fallbackUpdate)
            .eq("member_code", effectiveMemberCode);
          error = retryByCode.error;
        }
      }

      if (!error) {
        if (dbRole === "coach") {
          await ensureSelfRegisteredCoachInDb({
            memberCode: effectiveMemberCode,
            fullNameAr,
            city: effectiveCity || undefined,
            governorate: effectiveGov || undefined,
            phone: effectivePhone || undefined,
            email: effectiveEmail || caller.email || undefined,
            avatarUrl: typeof baseRecord.avatar_url === "string" ? baseRecord.avatar_url : undefined,
            bioAr: typeof extendedRecord.bio_ar === "string" ? extendedRecord.bio_ar : undefined,
            socialLinks: cleanIncomingSocial as UserSocialLinks,
            linkedCoachId: effectiveLinkedCoachId,
          }).catch(() => {});
        }
        return attachMemberSessionCookie(
          NextResponse.json({
            persisted: true,
            memberCode: effectiveMemberCode,
            role: sessionCookieInput.role,
            avatarUrl: typeof baseRecord.avatar_url === "string" ? baseRecord.avatar_url : undefined,
            linkedCoachId: effectiveLinkedCoachId,
            linkedFacilityId: effectiveLinkedFacilityId,
          }),
          sessionCookieInput
        );
      }
      lastAdminError = error.message || error.code || "supabase_error";
    }

    await ensureProfileTableViaPg();
    const pgRes = await withPgClient(async (client) => {
      const avatarVal = typeof baseRecord.avatar_url === "string" ? baseRecord.avatar_url : null;
      const bioVal =
        typeof body.bioAr === "string"
          ? body.bioAr.trim() || null
          : typeof existingRow?.bio_ar === "string"
            ? existingRow.bio_ar
            : null;
      const socialVal = JSON.stringify(mergedSocialLinks);

      if (existingRow?.member_code) {
        await client.query(
          `update public.captenly_profiles set
            full_name_ar = $2,
            role = $3,
            phone = coalesce($4, public.captenly_profiles.phone),
            city = coalesce($5, public.captenly_profiles.city),
            governorate = coalesce($6, public.captenly_profiles.governorate),
            avatar_url = coalesce($7, public.captenly_profiles.avatar_url),
            auth_provider = $8,
            has_parent_supervision = $9,
            needs_onboarding = $10,
            bio_ar = coalesce($11, public.captenly_profiles.bio_ar),
            social_links = $12::jsonb,
            updated_at = now()
           where upper(member_code) = upper($1)`,
          [
            String(existingRow.member_code),
            fullNameAr,
            dbRole,
            baseRecord.phone,
            baseRecord.city,
            baseRecord.governorate,
            avatarVal,
            baseRecord.auth_provider,
            baseRecord.has_parent_supervision,
            effectiveNeedsOnboarding,
            bioVal,
            socialVal,
          ]
        );
      } else if (effectiveEmail) {
        await client.query(
          `insert into public.captenly_profiles
            (member_code, email, full_name_ar, role, phone, city, governorate, avatar_url, auth_provider, has_parent_supervision, needs_onboarding, bio_ar, social_links, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, now())
           on conflict (email) do update set
            member_code = coalesce(nullif(public.captenly_profiles.member_code, ''), excluded.member_code),
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
            social_links = excluded.social_links,
            updated_at = now()`,
          [
            effectiveMemberCode,
            effectiveEmail,
            fullNameAr,
            dbRole,
            baseRecord.phone,
            baseRecord.city,
            baseRecord.governorate,
            avatarVal,
            baseRecord.auth_provider,
            baseRecord.has_parent_supervision,
            effectiveNeedsOnboarding,
            bioVal,
            socialVal,
          ]
        );
      } else {
        await client.query(
          `insert into public.captenly_profiles
            (member_code, email, full_name_ar, role, phone, city, governorate, avatar_url, auth_provider, has_parent_supervision, needs_onboarding, bio_ar, social_links, updated_at)
           values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, now())
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
            social_links = excluded.social_links,
            updated_at = now()`,
          [
            effectiveMemberCode,
            fullNameAr,
            dbRole,
            baseRecord.phone,
            baseRecord.city,
            baseRecord.governorate,
            avatarVal,
            baseRecord.auth_provider,
            baseRecord.has_parent_supervision,
            effectiveNeedsOnboarding,
            bioVal,
            socialVal,
          ]
        );
      }
      return true;
    });

    if (pgRes.ok) {
      if (dbRole === "coach") {
        await ensureSelfRegisteredCoachInDb({
          memberCode: effectiveMemberCode,
          fullNameAr,
          city: effectiveCity || undefined,
          governorate: effectiveGov || undefined,
          phone: effectivePhone || undefined,
          email: effectiveEmail || caller.email || undefined,
          avatarUrl: typeof baseRecord.avatar_url === "string" ? baseRecord.avatar_url : undefined,
          bioAr: typeof extendedRecord.bio_ar === "string" ? extendedRecord.bio_ar : undefined,
          socialLinks: cleanIncomingSocial as UserSocialLinks,
          linkedCoachId: effectiveLinkedCoachId,
        }).catch(() => {});
      }
      return attachMemberSessionCookie(
        NextResponse.json({
          persisted: true,
          memberCode: effectiveMemberCode,
          role: sessionCookieInput.role,
          avatarUrl: typeof baseRecord.avatar_url === "string" ? baseRecord.avatar_url : undefined,
          linkedCoachId: effectiveLinkedCoachId,
          linkedFacilityId: effectiveLinkedFacilityId,
        }),
        sessionCookieInput
      );
    }

    const isUnconfigured = !admin && pgRes.errorCode === "db_not_configured";
    return NextResponse.json(
      {
        persisted: false,
        error: pgRes.errorCode || lastAdminError || "db_error",
        messageAr: "تعذر حفظ بيانات وصورة الحساب على الخادم حالياً.",
      },
      { status: isUnconfigured ? 503 : 500 }
    );
  } catch {
    return NextResponse.json(
      { persisted: false, reason: "invalid_payload", messageAr: "بيانات الطلب غير صالحة." },
      { status: 400 }
    );
  }
}
