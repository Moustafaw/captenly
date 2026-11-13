import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ persisted: false, items: [], reason: "supabase_not_configured" });
  }

  const { searchParams } = new URL(request.url);
  const memberCode = (searchParams.get("memberCode") || "").trim();
  if (!memberCode) {
    return NextResponse.json({ persisted: false, items: [] });
  }

  try {
    const { data, error } = await admin
      .from("captenly_notifications")
      .select("id, member_code, title_ar, message_ar, notif_type, action_label_ar, action_href, is_read, created_at")
      .eq("member_code", memberCode)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ persisted: false, items: [], reason: error.code || "db_error" });
    }

    return NextResponse.json({ persisted: true, items: data || [] });
  } catch {
    return NextResponse.json({ persisted: false, items: [], reason: "query_error" });
  }
}

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ persisted: false, reason: "supabase_not_configured" });
  }

  try {
    const body = await request.json();
    if (typeof body.markReadId === "string" && body.markReadId.trim()) {
      const { error } = await admin
        .from("captenly_notifications")
        .update({ is_read: true })
        .eq("id", body.markReadId.trim());
      return NextResponse.json({ persisted: !error });
    }

    const memberCode = typeof body.memberCode === "string" ? body.memberCode.trim() : "";
    const titleAr = typeof body.titleAr === "string" ? body.titleAr.trim() : "";
    const messageAr = typeof body.messageAr === "string" ? body.messageAr.trim() : "";

    if (!memberCode || !titleAr || !messageAr) {
      return NextResponse.json({ persisted: false, error: "missing_fields" }, { status: 400 });
    }

    const { error } = await admin.from("captenly_notifications").insert({
      member_code: memberCode,
      title_ar: titleAr,
      message_ar: messageAr,
      notif_type: typeof body.type === "string" ? body.type : "system",
      action_label_ar: typeof body.actionLabelAr === "string" ? body.actionLabelAr : null,
      action_href: typeof body.actionHref === "string" ? body.actionHref : null,
    });

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.code || "db_error" });
    }
    return NextResponse.json({ persisted: true });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
