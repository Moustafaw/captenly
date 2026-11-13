import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicConfigured = hasSupabasePublicConfig();
  const adminConfigured = hasSupabaseAdminConfig();

  if (!publicConfigured && !adminConfigured) {
    return NextResponse.json({
      configured: false,
      publicConfigured: false,
      adminConfigured: false,
      schemaReady: false,
      provider: "supabase",
    });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({
      configured: true,
      publicConfigured,
      adminConfigured: false,
      schemaReady: false,
      provider: "supabase",
    });
  }

  try {
    const { count: profilesCount, error: profilesErr } = await admin
      .from("captenly_profiles")
      .select("id", { count: "exact", head: true });

    if (profilesErr) {
      return NextResponse.json({
        configured: true,
        publicConfigured,
        adminConfigured: true,
        schemaReady: false,
        provider: "supabase",
        note: "Supabase connected. Run supabase/migrations/20261113000001_captenly_core.sql in SQL Editor to initialize tables.",
      });
    }

    const { count: facilitiesCount } = await admin
      .from("captenly_facilities")
      .select("id", { count: "exact", head: true });

    const { count: leadsCount } = await admin
      .from("captenly_leads")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      configured: true,
      publicConfigured,
      adminConfigured: true,
      schemaReady: true,
      provider: "supabase",
      counts: {
        profiles: profilesCount ?? 0,
        facilities: facilitiesCount ?? 0,
        leads: leadsCount ?? 0,
      },
    });
  } catch {
    return NextResponse.json({
      configured: true,
      publicConfigured,
      adminConfigured,
      schemaReady: false,
      provider: "supabase",
    });
  }
}
