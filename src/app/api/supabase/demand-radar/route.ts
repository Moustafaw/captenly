import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller } from "@/lib/memberSession";
import { enforceRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const ALLOWED_SPORTS = new Set(["swimming", "fitness", "both", "other"]);

interface DemandRadarAdminRow {
  id: string;
  fullNameAr: string;
  phone: string;
  city: string;
  governorate: string;
  targetSport: string;
  targetFacilityId: string | null;
  targetFacilityNameAr: string | null;
  createdAt: string | null;
}

function mapDemandRadarRow(row: Record<string, unknown>): DemandRadarAdminRow {
  return {
    id: String(row.id || ""),
    fullNameAr: String(row.full_name_ar || ""),
    phone: String(row.phone || ""),
    city: String(row.city || ""),
    governorate: String(row.governorate || "مصر"),
    targetSport: String(row.target_sport || "swimming"),
    targetFacilityId:
      typeof row.target_facility_id === "string" && row.target_facility_id
        ? row.target_facility_id
        : null,
    targetFacilityNameAr:
      typeof row.target_facility_name_ar === "string" && row.target_facility_name_ar
        ? row.target_facility_name_ar
        : null,
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

export async function GET() {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json(
      { ok: false, items: [], error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
  if (!caller.isAdmin) {
    return NextResponse.json(
      { ok: false, items: [], error: "forbidden" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_demand_radar")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && Array.isArray(data)) {
        const items = data.map((r) => mapDemandRadarRow(r as Record<string, unknown>));
        return NextResponse.json(
          { ok: true, items, totalCount: items.length, source: "supabase" },
          { headers: NO_STORE_HEADERS }
        );
      }
    } catch {
      // fall through to pg fallback
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select id, full_name_ar, phone, city, governorate, target_sport, target_facility_id, target_facility_name_ar, created_at
       from public.captenly_demand_radar
       order by created_at desc
       limit 200`
    );
    return rows.map((r) => mapDemandRadarRow(r as Record<string, unknown>));
  });

  if (pgRes.ok) {
    return NextResponse.json(
      { ok: true, items: pgRes.value, totalCount: pgRes.value.length, source: "pg" },
      { headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    { ok: false, items: [], totalCount: 0, source: "unavailable", error: pgRes.errorCode || "db_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: Request) {
  const rl = await enforceRateLimit({
    bucket: "supabase:demand-radar",
    identifier: getClientIp(request),
    limit: 20,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSec);
  }

  const caller = await getServerCaller();

  try {
    const body = await request.json();
    const targetFacilityId =
      typeof body.targetFacilityId === "string" && body.targetFacilityId.trim()
        ? body.targetFacilityId.trim().slice(0, 120)
        : null;
    const targetFacilityNameAr =
      typeof body.targetFacilityNameAr === "string" && body.targetFacilityNameAr.trim()
        ? body.targetFacilityNameAr.trim().slice(0, 140)
        : null;
    const fullNameAr =
      (typeof body.fullNameAr === "string" ? body.fullNameAr.trim() : "") ||
      (targetFacilityId ? "طلب زائر لتوثيق أكاديمية" : "");
    const phone =
      (typeof body.phone === "string" ? body.phone.trim() : "") ||
      caller.phone ||
      (targetFacilityId ? caller.memberCode || "web_demand_vote" : "");
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const governorate = typeof body.governorate === "string" ? body.governorate.trim() : "";
    const targetSport =
      typeof body.targetSport === "string" && ALLOWED_SPORTS.has(body.targetSport)
        ? body.targetSport
        : "swimming";

    if (!fullNameAr || !phone || !city) {
      return NextResponse.json({ persisted: false, error: "missing_required_fields" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    if (admin) {
      const payloadWithFacility = {
        full_name_ar: fullNameAr,
        phone,
        city,
        governorate: governorate || "مصر",
        target_sport: targetSport,
        ...(targetFacilityId ? { target_facility_id: targetFacilityId } : {}),
        ...(targetFacilityNameAr ? { target_facility_name_ar: targetFacilityNameAr } : {}),
      };
      let { error } = await admin.from("captenly_demand_radar").insert(payloadWithFacility);
      if (error && (error.code === "42703" || error.code === "PGRST204" || error.code === "23514")) {
        const retry = await admin.from("captenly_demand_radar").insert({
          full_name_ar: fullNameAr,
          phone,
          city,
          governorate: governorate || "مصر",
          target_sport: targetSport === "other" ? "swimming" : targetSport,
        });
        error = retry.error;
      }
      if (!error) return NextResponse.json({ persisted: true });
    }

    const pgRes = await withPgClient(async (client) => {
      await client.query(
        `insert into public.captenly_demand_radar
          (full_name_ar, phone, city, governorate, target_sport, target_facility_id, target_facility_name_ar)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          fullNameAr,
          phone,
          city,
          governorate || "مصر",
          targetSport,
          targetFacilityId,
          targetFacilityNameAr,
        ]
      );
      return true;
    });

    return NextResponse.json({ persisted: pgRes.ok, reason: pgRes.ok ? undefined : pgRes.errorCode });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
