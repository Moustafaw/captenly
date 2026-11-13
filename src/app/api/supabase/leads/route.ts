import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ persisted: false, reason: "supabase_not_configured" });
  }

  try {
    const body = await request.json();
    const facilityId = typeof body.facilityId === "string" ? body.facilityId.trim() : "";
    if (!facilityId) {
      return NextResponse.json({ persisted: false, error: "missing_facility_id" }, { status: 400 });
    }

    const { error } = await admin.from("captenly_leads").insert({
      facility_id: facilityId,
      facility_name_ar: typeof body.facilityNameAr === "string" ? body.facilityNameAr : null,
      member_code: typeof body.memberCode === "string" ? body.memberCode : null,
      member_name_ar: typeof body.memberNameAr === "string" ? body.memberNameAr : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      package_name_ar: typeof body.packageNameAr === "string" ? body.packageNameAr : null,
      estimated_total_egp:
        typeof body.estimatedTotalEgp === "number" ? Math.round(body.estimatedTotalEgp) : null,
      status: "pending",
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.code || "db_error" });
    }

    return NextResponse.json({ persisted: true });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
