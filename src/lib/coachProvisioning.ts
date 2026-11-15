import type { Coach, PersonaAccount } from "@/types/captenly";

/**
 * Deterministic coach entity ID matching /api/supabase/role-claims approval format
 * so self-registered coaches and later verified claims update the same record.
 */
export function getDeterministicCoachId(memberCode: string): string {
  const normalized = memberCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `coach-${normalized || Date.now()}`;
}

export function getDeterministicCoachSlug(memberCode: string): string {
  const normalized = memberCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `coach-${normalized || Date.now()}`;
}

export function buildSelfRegisteredCoach(
  persona: Pick<
    PersonaAccount,
    "id" | "memberCode" | "fullNameAr" | "city" | "phone" | "email" | "avatarUrl" | "bioAr" | "socialLinks" | "linkedCoachId"
  >,
  existing?: Coach,
  governorate = "مصر"
): Coach {
  const cleanCode = (persona.memberCode || existing?.SingleCoachId || "CAP-M-0000").trim().toUpperCase();
  const coachId = persona.linkedCoachId || existing?.id || getDeterministicCoachId(cleanCode);
  const slug = existing?.slug || getDeterministicCoachSlug(cleanCode);
  const cleanCity =
    persona.city && persona.city.trim() && persona.city !== "مصر"
      ? persona.city.trim()
      : existing?.city || "كل مصر";

  return {
    id: coachId,
    slug,
    SingleCoachId: existing?.SingleCoachId || cleanCode,
    fullNameAr: persona.fullNameAr?.trim() || existing?.fullNameAr || "كابتن سباحة",
    titleAr: existing?.titleAr || "كابتن سباحة مسجل",
    sportSector: existing?.sportSector === "fitness" ? "swimming" : existing?.sportSector || "swimming",
    governorate: governorate || existing?.governorate || "مصر",
    city: cleanCity,
    district: existing?.district || cleanCity,
    yearsExperience: existing?.yearsExperience ?? 0,
    bioAr: persona.bioAr?.trim() || existing?.bioAr || "",
    avatarUrl: persona.avatarUrl || existing?.avatarUrl || "",
    whatsappNumber: persona.phone || existing?.whatsappNumber || "",
    facebookUrl: persona.socialLinks?.facebook ?? existing?.facebookUrl,
    instagramUrl: persona.socialLinks?.instagram ?? existing?.instagramUrl,
    socialLinks: persona.socialLinks ?? existing?.socialLinks,
    sessionOffers: existing?.sessionOffers,
    instapayHandle: existing?.instapayHandle || "",
    privatePackage8Egp: existing?.privatePackage8Egp ?? 0,
    privatePackage12Egp: existing?.privatePackage12Egp ?? 0,
    subscriptionTier: existing?.subscriptionTier || "free_founding",
    commissionRate: 0,
    qrCodeToken: existing?.qrCodeToken || `CAP-COACH-${cleanCode}`,
    priceLastVerifiedDaysAgo: existing?.priceLastVerifiedDaysAgo ?? 0,
    priceLastVerifiedDate:
      existing?.priceLastVerifiedDate ||
      (existing?.isVerifiedCoach ? "موثق عبر كابتنلي" : "مسجل على كابتنلي"),
    rating: existing?.rating ?? 0,
    verifiedReviewsCount: existing?.verifiedReviewsCount ?? 0,
    activeAthletesCount: existing?.activeAthletesCount ?? 0,
    isVerifiedCoach: Boolean(existing?.isVerifiedCoach),
    badges: existing?.badges || [],
    specialties:
      existing?.specialties && existing.specialties.length > 0
        ? existing.specialties
        : [{ nameAr: "تعليم السباحة والتأسيس", credibilityTier: "self_declared" }],
    affiliations: existing?.affiliations || [],
  };
}
