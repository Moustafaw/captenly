import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller, hasFacilityStaffAccess } from "@/lib/memberSession";

export const runtime = "nodejs";

async function ensureLeadsTableViaPg() {
  await withPgClient(async (client) => {
    await client.query(`
      create table if not exists public.captenly_leads (
        id uuid default gen_random_uuid() primary key,
        facility_id text not null,
        facility_name_ar text,
        member_code text,
        member_name_ar text,
        phone text,
        package_name_ar text,
        estimated_total_egp integer,
        status text default 'whatsapp_initiated',
        notes text,
        created_at timestamptz default now()
      );
    `);
    return true;
  });
}

function mapLeadRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || `lead-${Date.now()}`),
    facilityId: String(row.facility_id || ""),
    facilityNameAr: String(row.facility_name_ar || ""),
    memberCode: typeof row.member_code === "string" ? row.member_code : undefined,
    memberNameAr: String(row.member_name_ar || "متدرب"),
    phone: typeof row.phone === "string" ? row.phone : "",
    packageNameAr: String(row.package_name_ar || ""),
    estimatedTotalEgp: row.estimated_total_egp ? Number(row.estimated_total_egp) : undefined,
    status: String(row.status || "whatsapp_initiated"),
    notes: typeof row.notes === "string" ? row.notes : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized", leads: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetId = (searchParams.get("targetId") || "").trim();
  const memberCode = (searchParams.get("memberCode") || "").trim().toUpperCase();

  if (!caller.isAdmin) {
    if (targetId) {
      const canReadTarget =
        caller.linkedCoachId === targetId ||
        caller.linkedFacilityId === targetId ||
        (await hasFacilityStaffAccess(targetId, caller));
      if (!canReadTarget) {
        return NextResponse.json({ ok: false, error: "forbidden", leads: [] }, { status: 403 });
      }
    } else if (memberCode) {
      if (!caller.memberCode || caller.memberCode.toUpperCase() !== memberCode) {
        return NextResponse.json({ ok: false, error: "forbidden", leads: [] }, { status: 403 });
      }
    } else {
      return NextResponse.json({ ok: false, error: "forbidden", leads: [] }, { status: 403 });
    }
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin
        .from("captenly_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (targetId) {
        query = query.eq("facility_id", targetId);
      } else if (memberCode) {
        query = query.eq("member_code", memberCode);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return NextResponse.json({
          ok: true,
          leads: data.map((r) => mapLeadRow(r as Record<string, unknown>)),
        });
      }
    } catch {
      // fall through to pg
    }
  }

  await ensureLeadsTableViaPg();
  const pgRes = await withPgClient(async (client) => {
    if (targetId) {
      const { rows } = await client.query(
        `select * from public.captenly_leads where facility_id = $1 order by created_at desc limit 80`,
        [targetId]
      );
      return rows;
    }
    if (memberCode) {
      const { rows } = await client.query(
        `select * from public.captenly_leads where upper(coalesce(member_code, '')) = $1 order by created_at desc limit 80`,
        [memberCode]
      );
      return rows;
    }
    const { rows } = await client.query(
      `select * from public.captenly_leads order by created_at desc limit 80`
    );
    return rows;
  });

  if (pgRes.ok) {
    return NextResponse.json({
      ok: true,
      leads: pgRes.value.map((r) => mapLeadRow(r as Record<string, unknown>)),
    });
  }

  return NextResponse.json({ ok: false, leads: [] });
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const resolvedMemberCode =
      caller.isAdmin && body.memberCode
        ? String(body.memberCode)
        : caller.memberCode || (body.memberCode ? String(body.memberCode) : null);
    const row = {
      facility_id: String(body.facilityId || ""),
      facility_name_ar: body.facilityNameAr ? String(body.facilityNameAr) : null,
      member_code: resolvedMemberCode,
      member_name_ar: body.memberNameAr ? String(body.memberNameAr) : null,
      phone: body.phone ? String(body.phone) : null,
      package_name_ar: body.packageNameAr ? String(body.packageNameAr) : null,
      estimated_total_egp:
        body.estimatedTotalEgp !== undefined && body.estimatedTotalEgp !== null
          ? Number(body.estimatedTotalEgp)
          : null,
      status: body.status ? String(body.status) : "whatsapp_initiated",
      notes: body.notes ? String(body.notes) : null,
    };

    const admin = getSupabaseAdminClient();
    if (admin) {
      const { error } = await admin.from("captenly_leads").insert(row);
      if (!error) return NextResponse.json({ persisted: true });
    }

    await ensureLeadsTableViaPg();
    const pgRes = await withPgClient(async (client) => {
      await client.query(
        `insert into public.captenly_leads
          (facility_id, facility_name_ar, member_code, member_name_ar, phone, package_name_ar, estimated_total_egp, status, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          row.facility_id,
          row.facility_name_ar,
          row.member_code,
          row.member_name_ar,
          row.phone,
          row.package_name_ar,
          row.estimated_total_egp,
          row.status,
          row.notes,
        ]
      );
      return true;
    });

    return NextResponse.json({ persisted: pgRes.ok });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
