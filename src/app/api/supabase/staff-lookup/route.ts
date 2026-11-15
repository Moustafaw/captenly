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

function maskPhone(raw: unknown): string {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  if (digits.length < 7) return digits ? "••••" : "";
  return `${digits.slice(0, 3)}••••${digits.slice(-4)}`;
}

function maskEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.includes("@")) return undefined;
  const [local, domain] = raw.split("@");
  if (!domain) return undefined;
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}•••@${domain}`;
}

function mapCandidate(row: Record<string, unknown>, revealFullPii: boolean): StaffCandidateResult {
  return {
    memberCode: String(row.member_code || ""),
    fullNameAr: String(row.full_name_ar || "عضو كابتنلي"),
    phone: revealFullPii ? (typeof row.phone === "string" ? row.phone : "") : maskPhone(row.phone),
    email: revealFullPii ? (typeof row.email === "string" ? row.email : undefined) : maskEmail(row.email),
    city: typeof row.city === "string" ? row.city : "مصر",
    role: String(row.role || "adult_athlete"),
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : undefined,
  };
}

/**
 * Exact lookup for a Captenly account by exact memberCode, exact email, or full phone number for verified facility owners.
 */
export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized", candidates: [] }, { status: 401 });
  }
  if (!caller.isAdmin && !caller.linkedFacilityId) {
    return NextResponse.json({ ok: false, error: "forbidden", candidates: [] }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = sanitizeFilterToken(searchParams.get("q") || "");
  if (q.length < 5) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  const isMemberCodeQuery = /^CAP-(M|JR)-[A-Z0-9-]+$/i.test(q);
  const isEmailQuery = q.includes("@") && q.includes(".");
  const normalizedDigits = q.replace(/\D/g, "");
  const isPhoneQuery = normalizedDigits.length >= 10;
  if (!isMemberCodeQuery && !isEmailQuery && !isPhoneQuery) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  const phoneTail = normalizedDigits.slice(-10);
  const admin = getSupabaseAdminClient();

  if (admin) {
    try {
      let query = admin
        .from("captenly_profiles")
        .select("member_code, full_name_ar, phone, email, city, role, avatar_url")
        .limit(5);

      if (isMemberCodeQuery) {
        query = query.eq("member_code", q.toUpperCase());
      } else if (isEmailQuery) {
        query = query.eq("email", q.toLowerCase());
      } else {
        query = query.ilike("phone", `%${phoneTail}`);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        return NextResponse.json({
          ok: true,
          candidates: data.map((r) => mapCandidate(r as Record<string, unknown>, caller.isAdmin)),
        });
      }
    } catch {
      // fall through to pg
    }
  }

  const pgRes = await withPgClient(async (client) => {
    if (isMemberCodeQuery) {
      const { rows } = await client.query(
        `select member_code, full_name_ar, phone, email, city, role, avatar_url
         from public.captenly_profiles
         where upper(member_code) = upper($1)
         limit 5`,
        [q]
      );
      return rows;
    }
    if (isEmailQuery) {
      const { rows } = await client.query(
        `select member_code, full_name_ar, phone, email, city, role, avatar_url
         from public.captenly_profiles
         where lower(coalesce(email, '')) = lower($1)
         limit 5`,
        [q]
      );
      return rows;
    }
    const { rows } = await client.query(
      `select member_code, full_name_ar, phone, email, city, role, avatar_url
       from public.captenly_profiles
       where right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $1
       limit 5`,
      [phoneTail]
    );
    return rows;
  });

  if (pgRes.ok) {
    return NextResponse.json({
      ok: true,
      candidates: pgRes.value.map((r) => mapCandidate(r as Record<string, unknown>, caller.isAdmin)),
    });
  }

  return NextResponse.json({ ok: false, candidates: [] });
}
