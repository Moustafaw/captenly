import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller, sanitizeFilterToken } from "@/lib/memberSession";

export const runtime = "nodejs";

export interface StaffCandidateResult {
  memberCode: string;
  fullNameAr: string;
  phone: string;
  email?: string;
  city: string;
  role: string;
  avatarUrl?: string;
}

function mapCandidate(row: Record<string, unknown>): StaffCandidateResult {
  return {
    memberCode: String(row.member_code || ""),
    fullNameAr: String(row.full_name_ar || "عضو كابتنلي"),
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : undefined,
    city: typeof row.city === "string" ? row.city : "مصر",
    role: String(row.role || "adult_athlete"),
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : undefined,
  };
}

/**
 * Searches registered Captenly accounts by memberCode, email, phone, or Arabic name for facility staff assignment.
 */
export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized", candidates: [] }, { status: 401 });
  }
  if (!caller.isAdmin && caller.role !== "facility_manager" && !caller.linkedFacilityId) {
    return NextResponse.json({ ok: false, error: "forbidden", candidates: [] }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = sanitizeFilterToken(searchParams.get("q") || "");
  if (q.length < 2) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  const normalizedDigits = q.replace(/\D/g, "");
  const phoneTail = normalizedDigits.length >= 8 ? normalizedDigits.slice(-10) : normalizedDigits;
  const admin = getSupabaseAdminClient();

  if (admin) {
    try {
      const filters = [
        `member_code.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `full_name_ar.ilike.%${q}%`,
      ];
      if (phoneTail.length >= 6) {
        filters.push(`phone.ilike.%${phoneTail}%`);
      }
      const { data, error } = await admin
        .from("captenly_profiles")
        .select("member_code, full_name_ar, phone, email, city, role, avatar_url")
        .or(filters.join(","))
        .order("updated_at", { ascending: false })
        .limit(8);

      if (!error && Array.isArray(data)) {
        return NextResponse.json({
          ok: true,
          candidates: data.map((r) => mapCandidate(r as Record<string, unknown>)),
        });
      }
    } catch {
      // fall through to pg
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const likePattern = `%${q}%`;
    const phonePattern = phoneTail.length >= 6 ? `%${phoneTail}%` : likePattern;
    const { rows } = await client.query(
      `select member_code, full_name_ar, phone, email, city, role, avatar_url
       from public.captenly_profiles
       where upper(member_code) like upper($1)
          or lower(coalesce(email, '')) like lower($1)
          or full_name_ar ilike $1
          or regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like $2
       order by updated_at desc
       limit 8`,
      [likePattern, phonePattern]
    );
    return rows;
  });

  if (pgRes.ok) {
    return NextResponse.json({
      ok: true,
      candidates: pgRes.value.map((r) => mapCandidate(r as Record<string, unknown>)),
    });
  }

  return NextResponse.json({ ok: false, candidates: [] });
}
