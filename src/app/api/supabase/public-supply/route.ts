import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import {
  callerHasAnyStaffRole,
  getCallerFacilityAccessRole,
  getServerCaller,
  hasFacilityStaffAccess,
  type ServerCallerContext,
} from "@/lib/memberSession";
import { findExistingCoachById } from "@/lib/server/coachDb";
import type { Coach, Facility } from "@/types/captenly";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

function externalizeLargeDataUrl(
  rawUrl: unknown,
  kind: "facility" | "coach" | "article",
  entityId: string,
  slot: "hero" | "avatar" | "image" | "gallery",
  index?: number
): string | undefined {
  if (typeof rawUrl !== "string") return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:image/") && trimmed.length > 256 && entityId) {
    const idxPart = typeof index === "number" ? `&index=${index}` : "";
    return `/api/supabase/media?kind=${kind}&id=${encodeURIComponent(entityId)}&slot=${slot}${idxPart}`;
  }
  return trimmed;
}

function sanitizeArticlePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const id = typeof raw.id === "string" ? raw.id : "";
  const safeImageUrl = externalizeLargeDataUrl(raw.imageUrl, "article", id, "image");
  return safeImageUrl ? { ...raw, imageUrl: safeImageUrl } : raw;
}

function sanitizeFacilityAccessFields(
  facilityId: string,
  payload: Partial<Facility> & Record<string, unknown>,
  caller?: ServerCallerContext
): {
  staffMembers?: Facility["staffMembers"];
  ownerMemberCode?: string;
} {
  const rawStaff = Array.isArray(payload.staffMembers) ? payload.staffMembers : undefined;
  const rawOwnerCode =
    typeof payload.ownerMemberCode === "string" ? payload.ownerMemberCode : undefined;

  if (!caller || !caller.authenticated) {
    return { staffMembers: undefined, ownerMemberCode: undefined };
  }

  const callerCode = (caller.memberCode || "").trim().toUpperCase();
  const callerEmail = (caller.email || "").trim().toLowerCase();
  const isOwner =
    caller.isAdmin ||
    (caller.linkedFacilityId && caller.linkedFacilityId === facilityId) ||
    Boolean(callerCode && rawOwnerCode && rawOwnerCode.trim().toUpperCase() === callerCode);

  const isGeneralManager = Boolean(
    callerCode &&
      rawStaff?.some(
        (st) =>
          (!st.invitationStatus || st.invitationStatus === "accepted") &&
          st.linkedMemberCode?.trim().toUpperCase() === callerCode &&
          st.role === "general_staff"
      )
  );

  if (isOwner || isGeneralManager) {
    return {
      staffMembers: rawStaff,
      ownerMemberCode: rawOwnerCode,
    };
  }

  // Invited / accepted staff members receive ONLY their own staff record (for workspace switching),
  // never other staff members' PII (emails/phones/memberCodes).
  if (rawStaff && (callerCode || callerEmail)) {
    const selfStaffOnly = rawStaff.filter((st) => {
      const codeMatch = Boolean(
        callerCode && st.linkedMemberCode && st.linkedMemberCode.trim().toUpperCase() === callerCode
      );
      const emailMatch = Boolean(
        callerEmail && st.email && st.email.trim().toLowerCase() === callerEmail
      );
      return codeMatch || emailMatch;
    });
    if (selfStaffOnly.length > 0) {
      return { staffMembers: selfStaffOnly, ownerMemberCode: undefined };
    }
  }

  return { staffMembers: undefined, ownerMemberCode: undefined };
}

function mapFacilityRow(row: Record<string, unknown>, caller?: ServerCallerContext): Facility | null {
  const payload = (row.payload || {}) as Partial<Facility> & Record<string, unknown>;
  const sector = (payload.sportSector || row.sport_sector || "swimming") as Facility["sportSector"];
  if (sector === "fitness") return null;
  const facilityId = String(row.id || payload.id || "");
  const safePayload = { ...payload } as Partial<Facility> & Record<string, unknown>;
  delete safePayload.staffMembers;
  delete safePayload.ownerMemberCode;
  const scopedAccess = sanitizeFacilityAccessFields(facilityId, payload, caller);
  return {
    ...safePayload,
    id: facilityId,
    ...(scopedAccess.staffMembers ? { staffMembers: scopedAccess.staffMembers } : {}),
    ...(scopedAccess.ownerMemberCode ? { ownerMemberCode: scopedAccess.ownerMemberCode } : {}),
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
    heroImage:
      externalizeLargeDataUrl(payload.heroImage, "facility", facilityId, "hero") ||
      "/screens/20b781f698f9.jpg",
    ...(Array.isArray(payload.gallery)
      ? {
          gallery: payload.gallery
            .map((g, idx) => externalizeLargeDataUrl(g, "facility", facilityId, "gallery", idx))
            .filter((g): g is string => Boolean(g)),
        }
      : {}),
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
  const coachId = String(row.id || payload.id || "");
  const avatarUrl = externalizeLargeDataUrl(payload.avatarUrl, "coach", coachId, "avatar");
  return {
    ...(payload as Coach),
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    id: coachId,
    slug: String(row.slug || payload.slug || row.id || ""),
    fullNameAr: String(row.full_name_ar || payload.fullNameAr || ""),
    city: String(row.city || payload.city || "كل مصر"),
    sportSector: (payload.sportSector || row.sport_sector || "swimming") as Coach["sportSector"],
    rating: Number(row.rating ?? payload.rating ?? 0),
  };
}

const ARTICLES_BOOTSTRAP_SQL = `
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
`;

async function ensureArticlesTableViaPg(existingClient?: import("pg").Client) {
  if (existingClient) {
    await existingClient.query(ARTICLES_BOOTSTRAP_SQL);
    return;
  }
  await withPgClient(async (client) => {
    await client.query(ARTICLES_BOOTSTRAP_SQL);
    return true;
  });
}

export async function GET() {
  const caller = await getServerCaller();
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
          .map((r) => mapFacilityRow(r as Record<string, unknown>, caller))
          .filter((f): f is Facility => Boolean(f));
        const coaches = (coachRows || [])
          .map((r) => mapCoachRow(r as Record<string, unknown>))
          .filter((c): c is Coach => Boolean(c));
        const articles = !articleRes.error && Array.isArray(articleRes.data)
          ? articleRes.data
              .map((r) => (r as { payload: Record<string, unknown> }).payload)
              .filter(Boolean)
              .map(sanitizeArticlePayload)
          : [];
        return NextResponse.json(
          { ok: true, facilities, coaches, articles },
          { headers: NO_STORE_HEADERS }
        );
      }
    } catch {
      // Fall through to pg fallback
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const facRes = await client.query(
      `select * from public.captenly_facilities where supply_status <> 'seeded_unclaimed' order by updated_at desc limit 80`
    );
    const coachRes = await client.query(
      `select * from public.captenly_coaches order by updated_at desc limit 80`
    );
    let articleRows: Record<string, unknown>[] = [];
    try {
      const artRes = await client.query(`select payload from public.captenly_articles order by updated_at desc limit 60`);
      articleRows = artRes.rows;
    } catch (err) {
      if ((err as { code?: string })?.code === "42P01") {
        await ensureArticlesTableViaPg(client);
        const retryArt = await client.query(`select payload from public.captenly_articles order by updated_at desc limit 60`);
        articleRows = retryArt.rows;
      } else {
        throw err;
      }
    }
    return { facRows: facRes.rows, coachRows: coachRes.rows, articleRows };
  });

  if (pgRes.ok) {
    const facilities = pgRes.value.facRows
      .map((r) => mapFacilityRow(r as Record<string, unknown>, caller))
      .filter((f): f is Facility => Boolean(f));
    const coaches = pgRes.value.coachRows
      .map((r) => mapCoachRow(r as Record<string, unknown>))
      .filter((c): c is Coach => Boolean(c));
    const articles = pgRes.value.articleRows
      .map((r) => r.payload as Record<string, unknown>)
      .filter(Boolean)
      .map(sanitizeArticlePayload);
    return NextResponse.json(
      { ok: true, facilities, coaches, articles },
      { headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      facilities: [],
      coaches: [],
      articles: [],
      reason: pgRes.errorCode || (admin ? "db_query_failed" : "supabase_not_configured"),
    },
    { headers: NO_STORE_HEADERS }
  );
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

function hasFacilityMedicalRosterViolation(facility: Facility): boolean {
  const hasMedicalPtBadge = Array.isArray(facility.badges)
    ? facility.badges.some((b) => b.code === "BADGE_06_MEDICAL_PT" && b.status === "active")
    : false;
  if (hasMedicalPtBadge) return false;
  const rosterText = Array.isArray(facility.coachRoster)
    ? facility.coachRoster
        .map((r) => `${r.roleTitleAr || ""} ${r.specialtyAr || ""} ${(r.certificatesAr || []).join(" ")}`)
        .join(" ")
    : "";
  const hay = `${facility.publicDescriptionAr || ""} ${rosterText}`.toLowerCase();
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
    if (
      caller.role === "coach" &&
      caller.memberCode &&
      coach.SingleCoachId?.toUpperCase() === caller.memberCode.toUpperCase()
    ) {
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
    const id = String(article.id);
    let existingArticleFound = false;
    let existingAuthorEntityId: string | null = null;
    if (admin) {
      const { data } = await admin
        .from("captenly_articles")
        .select("author_entity_id")
        .eq("id", id)
        .limit(1);
      if (Array.isArray(data) && data[0]) {
        existingArticleFound = true;
        existingAuthorEntityId =
          (data[0] as { author_entity_id?: string | null }).author_entity_id || null;
      }
    }
    if (!existingArticleFound) {
      const pg = await withPgClient(async (client) => {
        const { rows } = await client.query(
          `select author_entity_id from public.captenly_articles where id = $1 limit 1`,
          [id]
        );
        return rows[0] as { author_entity_id?: string | null } | undefined;
      });
      if (pg.ok && pg.value) {
        existingArticleFound = true;
        existingAuthorEntityId = pg.value.author_entity_id || null;
      }
    }

    if (existingArticleFound) {
      const ownsExisting = Boolean(
        existingAuthorEntityId &&
          (existingAuthorEntityId === caller.linkedCoachId ||
            existingAuthorEntityId === caller.linkedFacilityId ||
            (await hasFacilityStaffAccess(existingAuthorEntityId, caller, ["general_staff"])))
      );
      if (!ownsExisting) {
        return { allowed: false };
      }
    }

    const requestedAuthorId =
      typeof article.authorEntityId === "string" && article.authorEntityId.trim()
        ? article.authorEntityId.trim()
        : undefined;
    if (requestedAuthorId) {
      const ownsTarget =
        requestedAuthorId === caller.linkedCoachId ||
        requestedAuthorId === caller.linkedFacilityId ||
        (await hasFacilityStaffAccess(requestedAuthorId, caller, ["general_staff"]));
      if (!ownsTarget) {
        return { allowed: false };
      }
    }

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
      if (hasFacilityMedicalRosterViolation(facility)) {
        return NextResponse.json(
          {
            persisted: false,
            error: "law_3_1985_prohibited_medical_claims",
            messageAr:
              "مخالف لقانون 3 لسنة 1985: لا يُسمح بعبارات العلاج أو التأهيل الطبي في بيانات المنشأة أو قائمة المدربين بدون ترخيص علاج طبيعي موثق.",
          },
          { status: 400 }
        );
      }

      let safeFacility: Facility = facility;
      // Non-admins can never self-elevate badges, verification status, or subscription tier
      if (!caller.isAdmin) {
        const existing = await fetchExistingFacilityPayload(facility.id);
        if (authz.facilityAccessRole === "accounts_manager") {
          if (!existing) {
            return NextResponse.json({ persisted: false, error: "forbidden" }, { status: 403 });
          }
          safeFacility = {
            ...(existing as Facility),
            pricePackages: Array.isArray(facility.pricePackages)
              ? facility.pricePackages
              : (existing.pricePackages || []),
            schoolPrograms: facility.schoolPrograms ?? existing.schoolPrograms,
            poolDeskConfig: facility.poolDeskConfig
              ? {
                  ...facility.poolDeskConfig,
                  linkedEntities:
                    existing.poolDeskConfig?.linkedEntities ||
                    facility.poolDeskConfig.linkedEntities ||
                    [],
                }
              : existing.poolDeskConfig,
            instapayHandle: facility.instapayHandle ?? existing.instapayHandle ?? "",
            vodafoneCashNumber: facility.vodafoneCashNumber ?? existing.vodafoneCashNumber ?? "",
            priceLastVerifiedDaysAgo: 0,
          };
        } else {
          const fallbackStatus: Facility["supplyStatus"] =
            existing?.supplyStatus === "verified_active" ? "verified_active" : "self_listed_pending";
          safeFacility = {
            ...facility,
            badges: existing?.badges || [],
            supplyStatus: fallbackStatus,
            subscriptionTier: existing?.subscriptionTier || "free_founding",
            isSponsored: Boolean(existing?.isSponsored),
            staffMembers:
              authz.facilityAccessRole === "general_staff" && existing?.staffMembers
                ? existing.staffMembers
                : facility.staffMembers,
          };
        }
      }

      let existingFacSlug = "";
      if (admin) {
        const { data: slugRows } = await admin
          .from("captenly_facilities")
          .select("slug")
          .eq("id", safeFacility.id)
          .limit(1);
        if (Array.isArray(slugRows) && slugRows[0] && typeof (slugRows[0] as { slug?: unknown }).slug === "string") {
          existingFacSlug = (slugRows[0] as { slug: string }).slug;
        }
      }

      const sportSector =
        safeFacility.sportSector === "fitness" || safeFacility.sportSector === "both"
          ? safeFacility.sportSector
          : "swimming";
      const supplyStatus =
        safeFacility.supplyStatus === "seeded_unclaimed" ? "seeded_unclaimed" : "verified_claimed";
      const resolvedSlug = existingFacSlug || safeFacility.slug || safeFacility.id;
      const payloadWithStableSlug: Facility = { ...safeFacility, slug: resolvedSlug };
      const row = {
        id: safeFacility.id,
        slug: resolvedSlug,
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
        payload: payloadWithStableSlug,
        updated_at: new Date().toISOString(),
      };

      let lastError: string | undefined;
      if (admin) {
        const { error } = await admin.from("captenly_facilities").upsert(row, { onConflict: "id" });
        if (!error) return NextResponse.json({ persisted: true, type: "facility" });
        lastError = error.message || error.code || "supabase_error";
      }

      const pgRes = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_facilities
            (id, slug, name_ar, name_en, sport_sector, supply_status, city, district, governorate, address_ar, lat, lng, rating, reviews_count, whatsapp_phone, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,now())
           on conflict (id) do update set
            slug = coalesce(nullif(public.captenly_facilities.slug, ''), excluded.slug),
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
            JSON.stringify(payloadWithStableSlug),
          ]
        );
        return true;
      });
      if (pgRes.ok) {
        return NextResponse.json({ persisted: true, type: "facility" });
      }
      return NextResponse.json(
        {
          persisted: false,
          type: "facility",
          error: pgRes.errorCode || lastError || "db_error",
          messageAr: "تعذر حفظ بيانات أو صورة المنشأة على الخادم حالياً.",
        },
        { status: !admin && pgRes.errorCode === "db_not_configured" ? 503 : 500 }
      );
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
      let safeCoach: Coach = coach;
      const existingCoach = await findExistingCoachById(coach.id);
      if (!caller.isAdmin) {
        safeCoach = {
          ...coach,
          slug: existingCoach?.slug || coach.slug || coach.id,
          isVerifiedCoach: Boolean(existingCoach?.isVerifiedCoach),
          badges: existingCoach?.badges || [],
          rating: existingCoach ? existingCoach.rating : 0,
          verifiedReviewsCount: existingCoach ? existingCoach.verifiedReviewsCount : 0,
          activeAthletesCount: existingCoach ? existingCoach.activeAthletesCount : 0,
        };
      } else if (existingCoach?.slug) {
        safeCoach = { ...coach, slug: existingCoach.slug };
      }
      const sportSector =
        safeCoach.sportSector === "fitness" || safeCoach.sportSector === "both"
          ? safeCoach.sportSector
          : "swimming";
      const trustTier = safeCoach.isVerifiedCoach ? "verified_6_badges" : "self_registered";
      const row = {
        id: safeCoach.id,
        slug: safeCoach.slug || safeCoach.id,
        full_name_ar: safeCoach.fullNameAr || "كابتن سباحة",
        city: safeCoach.city || "مصر",
        sport_sector: sportSector,
        trust_tier: trustTier,
        rating: Number(safeCoach.rating ?? 0),
        reviews_count: Number(safeCoach.verifiedReviewsCount ?? 0),
        payload: safeCoach,
        updated_at: new Date().toISOString(),
      };

      let lastCoachError: string | undefined;
      if (admin) {
        const { error } = await admin.from("captenly_coaches").upsert(row, { onConflict: "id" });
        if (!error) return NextResponse.json({ persisted: true, type: "coach" });
        lastCoachError = error.message || error.code || "supabase_error";
      }

      const pgRes = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_coaches
            (id, slug, full_name_ar, city, sport_sector, trust_tier, rating, reviews_count, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
           on conflict (id) do update set
            slug = coalesce(nullif(public.captenly_coaches.slug, ''), excluded.slug),
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
            JSON.stringify(safeCoach),
          ]
        );
        return true;
      });
      if (pgRes.ok) {
        return NextResponse.json({ persisted: true, type: "coach" });
      }
      return NextResponse.json(
        {
          persisted: false,
          type: "coach",
          error: pgRes.errorCode || lastCoachError || "db_error",
          messageAr: "تعذر حفظ بيانات أو صورة الكابتن على الخادم حالياً.",
        },
        { status: !admin && pgRes.errorCode === "db_not_configured" ? 503 : 500 }
      );
    }

    if (deleteArticleId) {
      if (admin) {
        const { error } = await admin.from("captenly_articles").delete().eq("id", deleteArticleId);
        if (!error) return NextResponse.json({ persisted: true, type: "article_delete" });
      }
      const runDelete = () =>
        withPgClient(async (client) => {
          await client.query(`delete from public.captenly_articles where id = $1`, [deleteArticleId]);
          return true;
        });
      let pgRes = await runDelete();
      if (!pgRes.ok && pgRes.errorCode === "42P01") {
        await ensureArticlesTableViaPg();
        pgRes = await runDelete();
      }
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
      const runUpsert = () =>
        withPgClient(async (client) => {
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
      let pgRes = await runUpsert();
      if (!pgRes.ok && pgRes.errorCode === "42P01") {
        await ensureArticlesTableViaPg();
        pgRes = await runUpsert();
      }
      return NextResponse.json({ persisted: pgRes.ok, type: "article" });
    }

    return NextResponse.json({ persisted: false });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
