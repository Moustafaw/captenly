import type { Metadata } from "next";
import { HomeScreenClient } from "@/components/screens/HomeScreenClient";
import { buildPageMetadata } from "@/lib/seo";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import type { Coach, Facility } from "@/types/captenly";

export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: "دليل المسابح وأكاديميات السباحة والكباتن الموثقين في مصر",
  description:
    "اكتشف أقرب المسابح المدفأة وأكاديميات السباحة والكباتن الموثقين في مصر، وقارن الباقات والأسعار بـ 0% عمولة وساطة مع دفتر حصص QR أوفلاين.",
  path: "/",
});

function externalizeMediaUrl(
  rawUrl: unknown,
  kind: "facility" | "coach",
  entityId: string,
  slot: "hero" | "avatar" | "gallery",
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

function mapPublicFacilityRow(row: Record<string, unknown>): Facility | null {
  const payload = (row.payload || {}) as Partial<Facility> & Record<string, unknown>;
  const sector = (payload.sportSector || row.sport_sector || "swimming") as Facility["sportSector"];
  if (sector === "fitness") return null;
  const facilityId = String(row.id || payload.id || "");
  if (!facilityId) return null;

  // Public SSR must never include internal staff PII or owner member codes
  const safePayload = { ...payload } as Partial<Facility> & Record<string, unknown>;
  delete safePayload.staffMembers;
  delete safePayload.ownerMemberCode;

  return {
    ...safePayload,
    id: facilityId,
    slug: String(row.slug || payload.slug || facilityId),
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
      lat: Number(row.lat ?? payload.coordinates?.lat ?? 30.0444),
      lng: Number(row.lng ?? payload.coordinates?.lng ?? 31.2357),
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
          : payload.supplyStatus || "self_listed_pending",
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
      externalizeMediaUrl(payload.heroImage, "facility", facilityId, "hero") ||
      "/screens/20b781f698f9.jpg",
    ...(Array.isArray(payload.gallery)
      ? {
          gallery: payload.gallery
            .map((g, idx) => externalizeMediaUrl(g, "facility", facilityId, "gallery", idx))
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

function mapPublicCoachRow(row: Record<string, unknown>): Coach | null {
  const payload = (row.payload || {}) as Partial<Coach>;
  if ((payload.sportSector || row.sport_sector) === "fitness") return null;
  if (!payload.fullNameAr && !row.full_name_ar) return null;
  const coachId = String(row.id || payload.id || "");
  if (!coachId) return null;
  const avatarUrl = externalizeMediaUrl(payload.avatarUrl, "coach", coachId, "avatar");
  return {
    ...(payload as Coach),
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    id: coachId,
    slug: String(row.slug || payload.slug || coachId),
    fullNameAr: String(row.full_name_ar || payload.fullNameAr || ""),
    city: String(row.city || payload.city || "كل مصر"),
    sportSector: (payload.sportSector || row.sport_sector || "swimming") as Coach["sportSector"],
    rating: Number(row.rating ?? payload.rating ?? 0),
  };
}

async function queryInitialHomeSupply(): Promise<{
  facilities: Facility[];
  coaches: Coach[];
}> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const [{ data: facRows, error: facErr }, { data: coachRows, error: coachErr }] =
        await Promise.all([
          admin
            .from("captenly_facilities")
            .select("*")
            .neq("supply_status", "seeded_unclaimed")
            .order("is_featured_tier", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(12),
          admin
            .from("captenly_coaches")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(8),
        ]);

      if (!facErr && !coachErr) {
        return {
          facilities: (facRows || [])
            .map((r) => mapPublicFacilityRow(r as Record<string, unknown>))
            .filter((f): f is Facility => Boolean(f)),
          coaches: (coachRows || [])
            .map((r) => mapPublicCoachRow(r as Record<string, unknown>))
            .filter((c): c is Coach => Boolean(c)),
        };
      }
    } catch {
      // Fall through to pg fallback
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const [facRes, coachRes] = await Promise.all([
      client.query(
        `select * from public.captenly_facilities where supply_status <> 'seeded_unclaimed' order by is_featured_tier desc, updated_at desc limit 12`
      ),
      client.query(`select * from public.captenly_coaches order by updated_at desc limit 8`),
    ]);
    return { facRows: facRes.rows, coachRows: coachRes.rows };
  });

  if (pgRes.ok) {
    return {
      facilities: pgRes.value.facRows
        .map((r) => mapPublicFacilityRow(r as Record<string, unknown>))
        .filter((f): f is Facility => Boolean(f)),
      coaches: pgRes.value.coachRows
        .map((r) => mapPublicCoachRow(r as Record<string, unknown>))
        .filter((c): c is Coach => Boolean(c)),
    };
  }

  return { facilities: [], coaches: [] };
}

async function loadInitialHomeSupply(): Promise<{
  facilities: Facility[];
  coaches: Coach[];
}> {
  try {
    return await Promise.race([
      queryInitialHomeSupply(),
      new Promise<{ facilities: Facility[]; coaches: Coach[] }>((resolve) =>
        setTimeout(() => resolve({ facilities: [], coaches: [] }), 900)
      ),
    ]);
  } catch {
    return { facilities: [], coaches: [] };
  }
}

export default async function HomePage() {
  const { facilities, coaches } = await loadInitialHomeSupply();

  return <HomeScreenClient initialFacilities={facilities} initialCoaches={coaches} />;
}
