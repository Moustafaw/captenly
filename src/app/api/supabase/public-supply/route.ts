import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import {
  callerHasAnyStaffRole,
  getCallerFacilityAccessRole,
  getServerCaller,
  hasFacilityStaffAccess,
} from "@/lib/memberSession";
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
    avgReplyMinutes: payload.avgReplyMinutes ?? 0,
    completenessScore: payload.completenessScore ?? 85,
    rating: Number(row.rating ?? payload.rating ?? 0),
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
    city: String(row.city || payload.city || "كل مصر"),
    sportSector: (payload.sportSector || row.sport_sector || "swimming") as Coach["sportSector"],
    rating: Number(row.rating ?? payload.rating ?? 0),
  };
}

async function ensureArticlesTableViaPg() {
  await withPgClient(async (client) => {
    await client.query(`
      create table if not exists public.captenly_articles (
        id text primary key,
        slug text unique,
        title_ar text not null,
        category_ar text,
        author_entity_id text,
        payload jsonb not null,
        updated_at timestamptz default now()
      );
      alter table public.captenly_articles enable row level security;
      drop policy if exists "captenly_articles_public_read" on public.captenly_articles;
      create policy "captenly_articles_public_read"
        on public.captenly_articles for select using (true);
    `);
    return true;
  });
}

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const [
        { data: facRows, error: facErr },
        { data: coachRows, error: coachErr },
        articleRes,
      ] = await Promise.all([
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
        admin
          .from("captenly_articles")
          .select("payload")
          .order("updated_at", { ascending: false })
          .limit(60),
      ]);

      if (!facErr && !coachErr) {
        const facilities = (facRows || [])
          .map((r) => mapFacilityRow(r as Record<string, unknown>))
          .filter((f): f is Facility => Boolean(f));
        const coaches = (coachRows || [])
          .map((r) => mapCoachRow(r as Record<string, unknown>))
          .filter((c): c is Coach => Boolean(c));
        const articles = !articleRes.error && Array.isArray(articleRes.data)
          ? articleRes.data.map((r) => (r as { payload: Record<string, unknown> }).payload).filter(Boolean)
          : [];
        return NextResponse.json({ ok: true, facilities, coaches, articles });
      }
    } catch {
      // Fall through to pg fallback
    }
  }

  await ensureSupplyTablesViaPg();
  await ensureArticlesTableViaPg();
  const pgRes = await withPgClient(async (client) => {
    const [facRes, coachRes, articleRes] = await Promise.all([
      client.query(
        `select * from public.captenly_facilities where supply_status <> 'seeded_unclaimed' order by updated_at desc limit 80`
      ),
      client.query(`select * from public.captenly_coaches order by updated_at desc limit 80`),
      client.query(`select payload from public.captenly_articles order by updated_at desc limit 60`),
    ]);
    return { facRows: facRes.rows, coachRows: coachRes.rows, articleRows: articleRes.rows };
  });

  if (pgRes.ok) {
    const facilities = pgRes.value.facRows
      .map((r) => mapFacilityRow(r as Record<string, unknown>))
      .filter((f): f is Facility => Boolean(f));
    const coaches = pgRes.value.coachRows
      .map((r) => mapCoachRow(r as Record<string, unknown>))
      .filter((c): c is Coach => Boolean(c));
    const articles = pgRes.value.articleRows
      .map((r) => r.payload as Record<string, unknown>)
      .filter(Boolean);
    return NextResponse.json({ ok: true, facilities, coaches, articles });
  }

  return NextResponse.json({
    ok: false,
    facilities: [],
    coaches: [],
    articles: [],
    reason: pgRes.errorCode || (admin ? "db_query_failed" : "supabase_not_configured"),
  });
}

const PROHIBITED_MEDICAL_TERMS = [
  "علاج طبيعي",
  "علاج طبي",
  "تأهيل طبي",
  "تشخيص",
  "وصفة طبية",
  "علاج الديسك",
  "علاج العمود الفقري",
  "rehabilitation therapy",
  "medical therapy",
];

function hasProhibitedMedicalClaims(coach: Coach): boolean {
  const hasMedicalPtBadge = Array.isArray(coach.badges)
    ? coach.badges.some((b) => b.code === "BADGE_06_MEDICAL_PT" && b.status === "active")
    : false;
  if (hasMedicalPtBadge) return false;
  const hay = `${coach.bioAr || ""} ${coach.titleAr || ""} ${(coach.specialties || [])
    .map((s) => s.nameAr)
    .join(" ")}`.toLowerCase();
  return PROHIBITED_MEDICAL_TERMS.some((term) => hay.includes(term.toLowerCase()));
}

async function fetchExistingFacilityPayload(facilityId: string): Promise<Partial<Facility> | null> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from("captenly_facilities")
        .select("payload")
        .eq("id", facilityId)
        .limit(1);
      if (Array.isArray(data) && data[0] && (data[0] as { payload?: unknown }).payload) {
        return (data[0] as { payload: Partial<Facility> }).payload;
      }
    } catch {
      // fall through
    }
  }
  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(`select payload from public.captenly_facilities where id = $1 limit 1`, [
      facilityId,
    ]);
    return (rows[0] as { payload?: Partial<Facility> } | undefined)?.payload || null;
  });
  return pg.ok ? pg.value : null;
}

async function authorizePublicSupplyPost(params: {
  caller: Awaited<ReturnType<typeof getServerCaller>>;
  facility?: Facility;
  coach?: Coach;
  article?: Record<string, unknown>;
  deleteArticleId?: string;
}): Promise<{ allowed: boolean; facilityAccessRole?: string | null }> {
  const { caller, facility, coach, article, deleteArticleId } = params;
  if (!caller.authenticated) return { allowed: false };
  if (caller.isAdmin) return { allowed: true, facilityAccessRole: "admin" };

  const admin = getSupabaseAdminClient();

  if (facility?.id) {
    const accessRole = await getCallerFacilityAccessRole(facility.id, caller);
    if (
      accessRole === "owner" ||
      accessRole === "general_staff" ||
      accessRole === "accounts_manager"
    ) {
      return { allowed: true, facilityAccessRole: accessRole };
    }
    // Never allow hijacking unverified/seeded_unclaimed or creating unreviewed facilities directly;
    // ownership claims must be submitted to /api/supabase/role-claims and approved by admin.
    return { allowed: false };
  }

  if (coach?.id) {
    if (caller.linkedCoachId && caller.linkedCoachId === coach.id) {
      return { allowed: true };
    }
    // Check existing coach row only when linked via DB SingleCoachId matching verified caller memberCode
    let existingPayload: Partial<Coach> | null = null;
    if (admin) {
      const { data } = await admin.from("captenly_coaches").select("payload").eq("id", coach.id).limit(1);
      if (Array.isArray(data) && data[0]) {
        existingPayload = (data[0] as { payload?: Partial<Coach> }).payload || null;
      }
    }
    if (!existingPayload) {
      const pg = await withPgClient(async (client) => {
        const { rows } = await client.query(`select payload from public.captenly_coaches where id = $1 limit 1`, [
          coach.id,
        ]);
        return (rows[0] as { payload?: Partial<Coach> } | undefined)?.payload || null;
      });
      if (pg.ok) existingPayload = pg.value;
    }
    if (
      existingPayload?.SingleCoachId &&
      caller.memberCode &&
      existingPayload.SingleCoachId.toUpperCase() === caller.memberCode.toUpperCase()
    ) {
      return { allowed: true };
    }
    return { allowed: false };
  }

  if (deleteArticleId) {
    let authorEntityId: string | null = null;
    if (admin) {
      const { data } = await admin
        .from("captenly_articles")
        .select("author_entity_id")
        .eq("id", deleteArticleId)
        .limit(1);
      if (Array.isArray(data) && data[0]) {
        authorEntityId = (data[0] as { author_entity_id?: string | null }).author_entity_id || null;
      }
    }
    if (!authorEntityId) {
      const pg = await withPgClient(async (client) => {
        const { rows } = await client.query(
          `select author_entity_id from public.captenly_articles where id = $1 limit 1`,
          [deleteArticleId]
        );
        return rows[0] as { author_entity_id?: string | null } | undefined;
      });
      if (pg.ok && pg.value) authorEntityId = pg.value.author_entity_id || null;
    }
    if (!authorEntityId) {
      return { allowed: false };
    }
    if (
      authorEntityId === caller.linkedCoachId ||
      authorEntityId === caller.linkedFacilityId ||
      (await hasFacilityStaffAccess(authorEntityId, caller, ["general_staff"]))
    ) {
      return { allowed: true };
    }
    return { allowed: false };
  }

  if (article?.id) {
    const canPublish =
      Boolean(caller.linkedCoachId) ||
      Boolean(caller.linkedFacilityId) ||
      (await callerHasAnyStaffRole(caller, ["general_staff"]));
    return { allowed: canPublish };
  }

  return { allowed: false };
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const facility = body?.facility as Facility | undefined;
    const coach = body?.coach as Coach | undefined;
    const article = body?.article as Record<string, unknown> | undefined;
    const deleteArticleId = typeof body?.deleteArticleId === "string" ? body.deleteArticleId : undefined;

    if (!facility?.id && !coach?.id && !article?.id && !deleteArticleId) {
      return NextResponse.json({ persisted: false, error: "missing_entity" }, { status: 400 });
    }

    const authz = await authorizePublicSupplyPost({
      caller,
      facility,
      coach,
      article,
      deleteArticleId,
    });
    if (!authz.allowed) {
      return NextResponse.json({ persisted: false, error: "forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    if (facility?.id) {
      let safeFacility: Facility = facility;
      // Non-owners cannot self-elevate badges, staff roster, or core ownership metadata
      if (!caller.isAdmin && authz.facilityAccessRole === "accounts_manager") {
        const existing = await fetchExistingFacilityPayload(facility.id);
        if (!existing) {
          return NextResponse.json({ persisted: false, error: "forbidden" }, { status: 403 });
        }
        safeFacility = {
          ...(existing as Facility),
          pricePackages: Array.isArray(facility.pricePackages)
            ? facility.pricePackages
            : (existing.pricePackages || []),
          schoolPrograms: facility.schoolPrograms ?? existing.schoolPrograms,
          instapayHandle: facility.instapayHandle ?? existing.instapayHandle ?? "",
          vodafoneCashNumber: facility.vodafoneCashNumber ?? existing.vodafoneCashNumber ?? "",
          priceLastVerifiedDaysAgo: 0,
        };
      } else if (!caller.isAdmin && authz.facilityAccessRole === "general_staff") {
        const existing = await fetchExistingFacilityPayload(facility.id);
        if (existing) {
          safeFacility = {
            ...facility,
            badges: existing.badges || facility.badges,
            supplyStatus: existing.supplyStatus || facility.supplyStatus,
            subscriptionTier: existing.subscriptionTier || facility.subscriptionTier,
            isSponsored: Boolean(existing.isSponsored),
            staffMembers: existing.staffMembers || facility.staffMembers,
          };
        }
      }

      const sportSector =
        safeFacility.sportSector === "fitness" || safeFacility.sportSector === "both"
          ? safeFacility.sportSector
          : "swimming";
      const supplyStatus =
        safeFacility.supplyStatus === "seeded_unclaimed" ? "seeded_unclaimed" : "verified_claimed";
      const row = {
        id: safeFacility.id,
        slug: safeFacility.slug || safeFacility.id,
        name_ar: safeFacility.nameAr || "منشأة سباحة",
        name_en: safeFacility.nameEn || safeFacility.nameAr || "Swimming Facility",
        sport_sector: sportSector,
        supply_status: supplyStatus,
        city: safeFacility.city || "مصر",
        district: safeFacility.district || "عام",
        governorate: safeFacility.governorate || "مصر",
        address_ar: safeFacility.addressAr || "",
        lat: Number(safeFacility.coordinates?.lat ?? 30.0444),
        lng: Number(safeFacility.coordinates?.lng ?? 31.2357),
        rating: Number(safeFacility.rating ?? 4.8),
        reviews_count: Number(safeFacility.reviewsCount ?? 0),
        whatsapp_phone: safeFacility.whatsappNumber || null,
        payload: safeFacility,
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
            JSON.stringify(safeFacility),
          ]
        );
        return true;
      });
      return NextResponse.json({ persisted: pgRes.ok, type: "facility" });
    }

    if (coach?.id) {
      if (hasProhibitedMedicalClaims(coach)) {
        return NextResponse.json(
          {
            persisted: false,
            error: "law_3_1985_prohibited_medical_claims",
            messageAr:
              "مخالف لقانون 3 لسنة 1985: لا يُسمح بعبارات العلاج أو التأهيل الطبي بدون شارة ترخيص علاج طبيعي موثقة.",
          },
          { status: 400 }
        );
      }
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

    if (deleteArticleId) {
      if (admin) {
        const { error } = await admin.from("captenly_articles").delete().eq("id", deleteArticleId);
        if (!error) return NextResponse.json({ persisted: true, type: "article_delete" });
      }
      await ensureArticlesTableViaPg();
      const pgRes = await withPgClient(async (client) => {
        await client.query(`delete from public.captenly_articles where id = $1`, [deleteArticleId]);
        return true;
      });
      return NextResponse.json({ persisted: pgRes.ok, type: "article_delete" });
    }

    if (article?.id) {
      const id = String(article.id);
      const row = {
        id,
        slug: String(article.slug || id),
        title_ar: String(article.titleAr || "مقال تدريبي"),
        category_ar: String(article.categoryAr || "تعليم السباحة"),
        author_entity_id: typeof article.authorEntityId === "string" ? article.authorEntityId : null,
        payload: article,
        updated_at: new Date().toISOString(),
      };
      if (admin) {
        const { error } = await admin.from("captenly_articles").upsert(row, { onConflict: "id" });
        if (!error) return NextResponse.json({ persisted: true, type: "article" });
      }
      await ensureArticlesTableViaPg();
      const pgRes = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_articles (id, slug, title_ar, category_ar, author_entity_id, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6::jsonb,now())
           on conflict (id) do update set
             slug = excluded.slug,
             title_ar = excluded.title_ar,
             category_ar = excluded.category_ar,
             author_entity_id = excluded.author_entity_id,
             payload = excluded.payload,
             updated_at = now()`,
          [row.id, row.slug, row.title_ar, row.category_ar, row.author_entity_id, JSON.stringify(article)]
        );
        return true;
      });
      return NextResponse.json({ persisted: pgRes.ok, type: "article" });
    }

    return NextResponse.json({ persisted: false });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
