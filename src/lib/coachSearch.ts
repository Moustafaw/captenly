import type { Coach } from "@/types/captenly";

export interface CoachExploreFilterInput {
  searchQuery: string;
  city: string;
  heatedOnly?: boolean;
  ladiesOnly?: boolean;
  lifeguardOnly?: boolean;
}

export interface CoachLocationPreference {
  isSpecified?: boolean;
  city?: string;
  governorate?: string;
}

function getLocationMatchScore(coach: Coach, loc?: CoachLocationPreference): number {
  if (!loc?.isSpecified) return 0;
  const targetCity = (loc.city || "").trim();
  const targetGov = (loc.governorate || "").trim();
  if (
    targetCity &&
    (coach.city === targetCity ||
      coach.city.includes(targetCity) ||
      coach.district.includes(targetCity))
  ) {
    return 2;
  }
  if (targetGov && (coach.governorate === targetGov || coach.governorate.includes(targetGov))) {
    return 1;
  }
  return 0;
}

/**
 * Sorts coaches with verified green-badge coaches strictly prioritized above
 * unverified self-registered coaches, then local city/governorate relevance,
 * then rating and active athlete count.
 */
export function sortCoachesWithVerificationPriority(
  coaches: Coach[],
  userLocation?: CoachLocationPreference
): Coach[] {
  return [...coaches].sort((a, b) => {
    const verifiedDiff = Number(Boolean(b.isVerifiedCoach)) - Number(Boolean(a.isVerifiedCoach));
    if (verifiedDiff !== 0) return verifiedDiff;

    const locDiff =
      getLocationMatchScore(b, userLocation) - getLocationMatchScore(a, userLocation);
    if (locDiff !== 0) return locDiff;

    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.activeAthletesCount - a.activeAthletesCount;
  });
}

/**
 * Filters and ranks registered swimming coaches for Explore (/explore) search
 * and city views.
 */
export function filterAndSortExploreCoaches(
  coaches: Coach[],
  filters: CoachExploreFilterInput,
  userLocation?: CoachLocationPreference
): Coach[] {
  if (filters.heatedOnly || filters.ladiesOnly || filters.lifeguardOnly) {
    return [];
  }

  const q = filters.searchQuery.trim().toLowerCase();
  const cityNorm = (filters.city || "الكل").trim();

  const matching = coaches.filter((c) => {
    if (c.sportSector === "fitness") return false;
    if (q) {
      const hay = [
        c.fullNameAr,
        c.titleAr,
        c.city,
        c.governorate,
        c.district,
        c.bioAr,
        c.SingleCoachId,
        ...(c.specialties || []).map((s) => s.nameAr),
        ...(c.affiliations || []).flatMap((a) => [a.facilityNameAr, a.city, a.roleAr]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    }

    if (cityNorm && cityNorm !== "الكل") {
      return (
        c.city === cityNorm ||
        c.city.includes(cityNorm) ||
        c.governorate.includes(cityNorm) ||
        c.district.includes(cityNorm) ||
        (c.affiliations || []).some(
          (aff) =>
            aff.city === cityNorm ||
            aff.city.includes(cityNorm) ||
            aff.facilityNameAr.includes(cityNorm),
        )
      );
    }

    return true;
  });

  return sortCoachesWithVerificationPriority(matching, userLocation);
}
