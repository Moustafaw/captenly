import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set(["adult_athlete", "parent", "coach", "facility_manager"]);

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ persisted: false, reason: "supabase_not_configured" });
  }

  try {
    const body = await request.json();
    const memberCode = typeof body.memberCode === "string" ? body.memberCode.trim() : "";
    const fullNameAr = typeof body.fullNameAr === "string" ? body.fullNameAr.trim() : "";
    const role = typeof body.role === "string" && ALLOWED_ROLES.has(body.role) ? body.role : "adult_athlete";

    if (!memberCode || !fullNameAr) {
      return NextResponse.json({ persisted: false, error: "missing_required_fields" }, { status: 400 });
    }

    const email = typeof body.email === "string" && body.email.includes("@")
      ? body.email.trim().toLowerCase()
      : null;

    const record = {
      member_code: memberCode,
      email,
      full_name_ar: fullNameAr,
      role,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      city: typeof body.city === "string" ? body.city.trim() || null : null,
      governorate: typeof body.governorate === "string" ? body.governorate.trim() || null : null,
      avatar_url: typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null,
      auth_provider: typeof body.authProvider === "string" ? body.authProvider : "captenly",
      has_parent_supervision: Boolean(body.hasParentSupervision),
      needs_onboarding: Boolean(body.needsOnboarding),
      updated_at: new Date().toISOString(),
    };

    const onConflict = email ? "email" : "member_code";
    const { error } = await admin.from("captenly_profiles").upsert(record, { onConflict });

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.code || "db_error" });
    }

    return NextResponse.json({ persisted: true });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
