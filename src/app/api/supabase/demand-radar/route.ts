import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller } from "@/lib/memberSession";

const ALLOWED_SPORTS = new Set(["swimming", "fitness", "both", "other"]);

async function ensureDemandRadarTableViaPg() {
  await withPgClient(async (client) => {
    await client.query(`
      create table if not exists public.captenly_demand_radar (
        id uuid default gen_random_uuid() primary key,
        full_name_ar text not null,
        phone text not null,
        city text not null,
        governorate text not null default 'مصر',
        target_sport text not null default 'swimming',
        target_facility_id text,
        target_facility_name_ar text,
        created_at timestamptz not null default now()
      );
      alter table public.captenly_demand_radar enable row level security;
      alter table public.captenly_demand_radar add column if not exists target_facility_id text;
      alter table public.captenly_demand_radar add column if not exists target_facility_name_ar text;
    `);
    return true;
  });
}

export async function POST(request: Request) {
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

    await ensureDemandRadarTableViaPg();
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
