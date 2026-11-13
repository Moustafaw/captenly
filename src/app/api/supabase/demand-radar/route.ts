import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_SPORTS = new Set(["swimming", "fitness", "both"]);

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ persisted: false, reason: "supabase_not_configured" });
  }

  try {
    const body = await request.json();
    const fullNameAr = typeof body.fullNameAr === "string" ? body.fullNameAr.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const governorate = typeof body.governorate === "string" ? body.governorate.trim() : "";
    const targetSport =
      typeof body.targetSport === "string" && ALLOWED_SPORTS.has(body.targetSport)
        ? body.targetSport
        : "swimming";

    if (!fullNameAr || !phone || !city) {
      return NextResponse.json({ persisted: false, error: "missing_required_fields" }, { status: 400 });
    }

    const { error } = await admin.from("captenly_demand_radar").insert({
      full_name_ar: fullNameAr,
      phone,
      city,
      governorate: governorate || "مصر",
      target_sport: targetSport,
    });

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.code || "db_error" });
    }

    return NextResponse.json({ persisted: true });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
