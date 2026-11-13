import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Coach, Facility } from "@/types/captenly";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, facilities: [], coaches: [], reason: "supabase_not_configured" });
  }

  try {
    const [{ data: facRows }, { data: coachRows }] = await Promise.all([
      admin
        .from("captenly_facilities")
        .select("*")
        .neq("supply_status", "seeded_unclaimed")
        .order("updated_at", { ascending: false })
        .limit(60),
      admin
        .from("captenly_coaches")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(60),
    ]);

    const facilities: Facility[] = (facRows || [])
      .map((row: Record<string, unknown>): Facility | null => {
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
            row.supply_status === "verified_claimed"
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
      })
      .filter((f): f is Facility => Boolean(f));

    const coaches: Coach[] = (coachRows || [])
      .map((row: Record<string, unknown>): Coach | null => {
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
      })
      .filter((c): c is Coach => Boolean(c));

    return NextResponse.json({ ok: true, facilities, coaches });
  } catch {
    return NextResponse.json({ ok: false, facilities: [], coaches: [], reason: "db_query_failed" });
  }
}
