import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, hasSupabasePublicConfig } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getServerCaller } from "@/lib/memberSession";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const caller = await getServerCaller();
  const isAdmin = caller.authenticated && caller.isAdmin;

  const publicConfigured = hasSupabasePublicConfig();
  const adminConfigured = hasSupabaseAdminConfig();

  if (!publicConfigured && !adminConfigured) {
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, status: "unconfigured" },
        { headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      {
        configured: false,
        publicConfigured: false,
        adminConfigured: false,
        schemaReady: false,
        provider: "supabase",
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, status: "degraded" },
        { headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      {
        configured: true,
        publicConfigured,
        adminConfigured: false,
        schemaReady: false,
        provider: "supabase",
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  try {
    const { count: profilesCount, error: profilesErr } = await admin
      .from("captenly_profiles")
      .select("id", { count: "exact", head: true });

    if (profilesErr) {
      if (!isAdmin) {
        return NextResponse.json(
          { ok: false, status: "degraded" },
          { headers: NO_STORE_HEADERS }
        );
      }
      return NextResponse.json(
        {
          configured: true,
          publicConfigured,
          adminConfigured: true,
          schemaReady: false,
          provider: "supabase",
          note: "Supabase connected. Apply migrations in supabase/migrations/ to initialize tables.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        { ok: true, status: "healthy" },
        { headers: NO_STORE_HEADERS }
      );
    }

    const { count: facilitiesCount } = await admin
      .from("captenly_facilities")
      .select("id", { count: "exact", head: true });

    const { count: leadsCount } = await admin
      .from("captenly_leads")
      .select("id", { count: "exact", head: true });

    return NextResponse.json(
      {
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
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, status: "degraded" },
        { headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      {
        configured: true,
        publicConfigured,
        adminConfigured,
        schemaReady: false,
        provider: "supabase",
      },
      { headers: NO_STORE_HEADERS }
    );
  }
}
