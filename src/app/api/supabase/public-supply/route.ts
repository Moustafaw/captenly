import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import type { Coach, Facility } from "@/types/captenly";

export const dynamic = "force-dynamic";

let supplyTablesBootstrapped = false;

const SUPPLY_BOOTSTRAP_STATEMENTS = [
  `create table if not exists public.captenly_facilities (
    id text primary key,
    slug text not null unique,
    name_ar text not null,
    name_en text,
    sport_sector text not null check (sport_sector in ('swimming', 'fitness', 'both')),
    supply_status text not null check (supply_status in ('verified_claimed', 'seeded_unclaimed')),
    city text not null,
    district text not null,
    governorate text not null,
    address_ar text,
    lat double precision not null,
    lng double precision not null,
    rating numeric(3, 2) not null default 0,
    reviews_count integer not null default 0,
    whatsapp_phone text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists public.captenly_coaches (
    id text primary key,
    slug text not null unique,
    full_name_ar text not null,
    city text not null,
    sport_sector text not null check (sport_sector in ('swimming', 'fitness', 'both')),
    trust_tier text not null,
    rating numeric(3, 2) not null default 0,
    reviews_count integer not null default 0,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table public.captenly_facilities enable row level security`,
  `alter table public.captenly_coaches enable row level security`,
];

async function ensureSupplyTablesViaPg() {
  if (supplyTablesBootstrapped) return;
  const res = await withPgClient(async (client) => {
    for (const stmt of SUPPLY_BOOTSTRAP_STATEMENTS) {
      await client.query(stmt);
    }
    return true;
  });
  if (res.ok) supplyTablesBootstrapped = true;
}

function mapFacilityRow(row: Record<string, unknown>): Facility | null {
  const payload = (row.payload || {}) as Partial<Facility>;
  const sector = (payload.sportSector || row.sport_sector || "swimming") as Facility["sportSector"];
  if (sector === "fitness") return null;
  return {
    ...payload,
    id: String(row.id || payload.id || ""),
    slug: String(row.slug || payload.slug || row.id || ""),
    googlePlaceId: (row.google_place_id as string) || payload.googlePlaceId,
    nameAr: String(row.name_ar || payload.nameAr || "أكاديمية سباحة"),
    nameEn: String(row.name_en || payload.nameEn || row.name_ar || "Swimming Academy"),
    facilityType: payload.facilityType || "swimming_academy",
    sportSector: sector,
    governorate: String(row.governorate || payload.governorate || "مصر"),
    city: String(row.city || payload.city || "مصر"),
    district: String(row.district || payload.district || ""),
    addressAr: String(row.address_ar || payload.addressAr || ""),
    coordinates: {
      lat: Number(row.lat ?? payload.coordinates?.lat ?? 30.9706),
      lng: Number(row.lng ?? payload.coordinates?.lng ?? 31.1656),
    },
    whatsappNumber: (row.whatsapp_phone as string) || payload.whatsappNumber,
    facebookUrl: (row.facebook_url as string) || payload.facebookUrl,
    instagramUrl: (row.instagram_url as string) || payload.instagramUrl,
    instapayHandle: payload.instapayHandle || "",
    vodafoneCashNumber: payload.vodafoneCashNumber || "",
    supplyStatus:
      payload.supplyStatus && payload.supplyStatus !== "seeded_unclaimed"
        ? payload.supplyStatus
        : row.supply_status === "verified_claimed"
        ? "verified_active"
        : (payload.supplyStatus || "self_listed_pending"),
    subscriptionTier: payload.subscriptionTier || "free_founding",
    isFeaturedTier: Boolean(row.is_featured_tier ?? payload.isFeaturedTier),
    isSponsored: Boolean(payload.isSponsored),
    priceLastVerifiedDaysAgo: payload.priceLastVerifiedDaysAgo ?? 0,
    priceLastVerifiedDate: payload.priceLastVerifiedDate || "موثق عبر كابتنلي",
    avgReplyMinutes: payload.avgReplyMinutes ?? 30,
    completenessScore: payload.completenessScore ?? 85,
    rating: Number(row.rating ?? payload.rating ?? 4.8),
    reviewsCount: Number(row.reviews_count ?? payload.reviewsCount ?? 0),
    heroImage: payload.heroImage || "/screens/20b781f698f9.jpg",
    badges: Array.isArray(payload.badges) ? payload.badges : [],
    specialtiesAr: Array.isArray(payload.specialtiesAr) ? payload.specialtiesAr : ["تعليم السباحة"],
    pricePackages: Array.isArray(payload.pricePackages) ? payload.pricePackages : [],
    affiliatedCoachIds: Array.isArray(payload.affiliatedCoachIds) ? payload.affiliatedCoachIds : [],
    monthlyMetrics: payload.monthlyMetrics || {
      profileViews: 0,
      comparisonAppearances: 0,
      verifiedWhatsappLeads: 0,
      activeSessionLedgers: 0,
    },
  };
}

function mapCoachRow(row: Record<string, unknown>): Coach | null {
  const payload = (row.payload || {}) as Partial<Coach>;
  if ((payload.sportSector || row.sport_sector) === "fitness") return null;
  if (!payload.fullNameAr && !row.full_name_ar) return null;
  return {
    ...(payload as Coach),
    id: String(row.id || payload.id || ""),
    slug: String(row.slug || payload.slug || row.id || ""),
    fullNameAr: String(row.full_name_ar || payload.fullNameAr || ""),
    city: String(row.city || payload.city || "مصر"),
    sportSector: (payload.sportSector || row.sport_sector || "swimming") as Coach["sportSector"],
    rating: Number(row.rating ?? payload.rating ?? 4.8),
  };
}

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const [{ data: facRows, error: facErr }, { data: coachRows, error: coachErr }] =
        await Promise.all([
          admin
            .from("captenly_facilities")
            .select("*")
            .neq("supply_status", "seeded_unclaimed")
            .order("updated_at", { ascending: false })
            .limit(80),
          admin
            .from("captenly_coaches")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(80),
        ]);

      if (!facErr && !coachErr) {
        const facilities = (facRows || [])
          .map((r) => mapFacilityRow(r as Record<string, unknown>))
          .filter((f): f is Facility => Boolean(f));
        const coaches = (coachRows || [])
          .map((r) => mapCoachRow(r as Record<string, unknown>))
          .filter((c): c is Coach => Boolean(c));
        return NextResponse.json({ ok: true, facilities, coaches });
      }
    } catch {
      // Fall through to pg fallback
    }
  }

  await ensureSupplyTablesViaPg();
  const pgRes = await withPgClient(async (client) => {
    const [facRes, coachRes] = await Promise.all([
      client.query(
        `select * from public.captenly_facilities where supply_status <> 'seeded_unclaimed' order by updated_at desc limit 80`
      ),
      client.query(`select * from public.captenly_coaches order by updated_at desc limit 80`),
    ]);
    return { facRows: facRes.rows, coachRows: coachRes.rows };
  });

  if (pgRes.ok) {
    const facilities = pgRes.value.facRows
      .map((r) => mapFacilityRow(r as Record<string, unknown>))
      .filter((f): f is Facility => Boolean(f));
    const coaches = pgRes.value.coachRows
      .map((r) => mapCoachRow(r as Record<string, unknown>))
      .filter((c): c is Coach => Boolean(c));
    return NextResponse.json({ ok: true, facilities, coaches });
  }

  return NextResponse.json({
    ok: false,
    facilities: [],
    coaches: [],
    reason: pgRes.errorCode || (admin ? "db_query_failed" : "supabase_not_configured"),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const facility = body?.facility as Facility | undefined;
    const coach = body?.coach as Coach | undefined;

    if (!facility?.id && !coach?.id) {
      return NextResponse.json({ persisted: false, error: "missing_entity" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    if (facility?.id) {
      const sportSector =
        facility.sportSector === "fitness" || facility.sportSector === "both"
          ? facility.sportSector
          : "swimming";
      const supplyStatus =
        facility.supplyStatus === "seeded_unclaimed" ? "seeded_unclaimed" : "verified_claimed";
      const row = {
        id: facility.id,
        slug: facility.slug || facility.id,
        name_ar: facility.nameAr || "منشأة سباحة",
        name_en: facility.nameEn || facility.nameAr || "Swimming Facility",
        sport_sector: sportSector,
        supply_status: supplyStatus,
        city: facility.city || "مصر",
        district: facility.district || "عام",
        governorate: facility.governorate || "مصر",
        address_ar: facility.addressAr || "",
        lat: Number(facility.coordinates?.lat ?? 30.0444),
        lng: Number(facility.coordinates?.lng ?? 31.2357),
        rating: Number(facility.rating ?? 4.8),
        reviews_count: Number(facility.reviewsCount ?? 0),
        whatsapp_phone: facility.whatsappNumber || null,
        payload: facility,
        updated_at: new Date().toISOString(),
      };

      if (admin) {
        const { error } = await admin.from("captenly_facilities").upsert(row, { onConflict: "id" });
        if (!error) return NextResponse.json({ persisted: true, type: "facility" });
      }

      await ensureSupplyTablesViaPg();
      const pgRes = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_facilities
            (id, slug, name_ar, name_en, sport_sector, supply_status, city, district, governorate, address_ar, lat, lng, rating, reviews_count, whatsapp_phone, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,now())
           on conflict (id) do update set
            slug = excluded.slug,
            name_ar = excluded.name_ar,
            name_en = excluded.name_en,
            sport_sector = excluded.sport_sector,
            supply_status = excluded.supply_status,
            city = excluded.city,
            district = excluded.district,
            governorate = excluded.governorate,
            address_ar = excluded.address_ar,
            lat = excluded.lat,
            lng = excluded.lng,
            rating = excluded.rating,
            reviews_count = excluded.reviews_count,
            whatsapp_phone = excluded.whatsapp_phone,
            payload = excluded.payload,
            updated_at = now()`,
          [
            row.id,
            row.slug,
            row.name_ar,
            row.name_en,
            row.sport_sector,
            row.supply_status,
            row.city,
            row.district,
            row.governorate,
            row.address_ar,
            row.lat,
            row.lng,
            row.rating,
            row.reviews_count,
            row.whatsapp_phone,
            JSON.stringify(facility),
          ]
        );
        return true;
      });
      return NextResponse.json({ persisted: pgRes.ok, type: "facility" });
    }

    if (coach?.id) {
      const sportSector =
        coach.sportSector === "fitness" || coach.sportSector === "both"
          ? coach.sportSector
          : "swimming";
      const trustTier = coach.isVerifiedCoach ? "verified_6_badges" : "self_registered";
      const row = {
        id: coach.id,
        slug: coach.slug || coach.id,
        full_name_ar: coach.fullNameAr || "كابتن سباحة",
        city: coach.city || "مصر",
        sport_sector: sportSector,
        trust_tier: trustTier,
        rating: Number(coach.rating ?? 4.8),
        reviews_count: Number(coach.verifiedReviewsCount ?? 0),
        payload: coach,
        updated_at: new Date().toISOString(),
      };

      if (admin) {
        const { error } = await admin.from("captenly_coaches").upsert(row, { onConflict: "id" });
        if (!error) return NextResponse.json({ persisted: true, type: "coach" });
      }

      await ensureSupplyTablesViaPg();
      const pgRes = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_coaches
            (id, slug, full_name_ar, city, sport_sector, trust_tier, rating, reviews_count, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
           on conflict (id) do update set
            slug = excluded.slug,
            full_name_ar = excluded.full_name_ar,
            city = excluded.city,
            sport_sector = excluded.sport_sector,
            trust_tier = excluded.trust_tier,
            rating = excluded.rating,
            reviews_count = excluded.reviews_count,
            payload = excluded.payload,
            updated_at = now()`,
          [
            row.id,
            row.slug,
            row.full_name_ar,
            row.city,
            row.sport_sector,
            row.trust_tier,
            row.rating,
            row.reviews_count,
            JSON.stringify(coach),
          ]
        );
        return true;
      });
      return NextResponse.json({ persisted: pgRes.ok, type: "coach" });
    }

    return NextResponse.json({ persisted: false });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
