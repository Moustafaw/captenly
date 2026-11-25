import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import type { Facility, FacilitySchoolProgram, PricePackage } from "@/types/captenly";

export type UnifiedProgramTrack = "school" | "buds" | "prep" | "team" | "ladies";

export interface UnifiedBookablePackage {
  id: string;
  source: "schoolProgram" | "pricePackage";
  trackType: UnifiedProgramTrack;
  trackLabelAr: string;
  nameAr: string;
  sessionsCount: number;
  sessionsPerWeek: number;
  durationMinutes: number;
  baseMonthlyEgp: number;
  assessmentFeeEgp: number;
  membershipCardFeeEgp: number;
  mandatoryKitFeeEgp: number;
  companionFeeEgp: number;
  scheduleAr?: string;
  ageRangeAr?: string;
  sessionTimeAr?: string;
  notesAr?: string;
}

const TRACK_LABELS: Record<UnifiedProgramTrack, string> = {
  school: "المدرسة الأساسية",
  buds: "البراعم",
  prep: "التجهيزي",
  team: "فريق / نجوم",
  ladies: "مواعيد السيدات",
};

function normalizePackageKey(titleAr: unknown, priceEgp: unknown): string {
  const safeTitle = typeof titleAr === "string" ? titleAr.trim() : "";
  const safePrice = Number(priceEgp) || 0;
  return `${safeTitle.toLowerCase().replace(/\s+/g, " ")}::${Math.round(safePrice)}`;
}

/**
 * Resolves the Egyptian governorate for a city preset without hardcoding a single city fallback.
 */
export function resolveGovernorateFromCity(city?: string, fallback = "مصر"): string {
  const clean = (city || "").trim();
  if (!clean || clean === "كل مصر" || clean === "مصر") {
    return fallback;
  }
  const exact = EGYPT_CITY_PRESETS.find((p) => p.city === clean || p.governorate === clean);
  if (exact) return exact.governorate;
  const fuzzy = EGYPT_CITY_PRESETS.find(
    (p) => clean.includes(p.city) || p.city.includes(clean)
  );
  return fuzzy ? fuzzy.governorate : fallback;
}

/**
 * Converts any monthly session count to the nearest ledger pack bucket supported by SessionLedger.
 */
export function toLedgerSessionBucket(sessions?: number): 8 | 12 | 24 {
  const count = Number(sessions || 8);
  if (count >= 20) return 24;
  if (count >= 10) return 12;
  return 8;
}

/**
 * Converts a FacilitySchoolProgram into a PricePackage shape so comparison/booking tables stay synced.
 */
export function schoolProgramToPricePackage(program: FacilitySchoolProgram): PricePackage {
  const sessionsCount = Math.max(1, Number(program.sessionsPerMonth || 8));
  return {
    id: `pkg_prog_${program.id}`,
    nameAr: program.titleAr,
    sessionsCount,
    sessionsPerWeek: Math.max(1, Math.round(sessionsCount / 4)),
    durationMinutes: Math.max(30, Number(program.durationMinutes || 60)),
    baseMonthlyEgp: Math.max(0, Number(program.priceEgp || 0)),
    assessmentFeeEgp: 0,
    membershipCardFeeEgp: 0,
    mandatoryKitFeeEgp: 0,
    companionFeeEgp: 0,
  };
}

/**
 * Unifies `schoolPrograms` and `pricePackages` into a single deduplicated booking/display list.
 */
export function getFacilityBookablePackages(
  facility: Pick<Facility, "schoolPrograms" | "pricePackages">
): UnifiedBookablePackage[] {
  const items: UnifiedBookablePackage[] = [];
  const seen = new Set<string>();

  for (const prog of facility.schoolPrograms || []) {
    const price = Math.max(0, Number(prog.priceEgp || 0));
    const safeTitle =
      typeof prog.titleAr === "string" && prog.titleAr.trim()
        ? prog.titleAr.trim()
        : "برنامج تدريب سباحة";
    const key = normalizePackageKey(safeTitle, price);
    if (seen.has(key)) continue;
    seen.add(key);

    const sessionsCount = Math.max(1, Number(prog.sessionsPerMonth || 8));
    const trackType: UnifiedProgramTrack = prog.trackType || "school";
    items.push({
      id: prog.id,
      source: "schoolProgram",
      trackType,
      trackLabelAr: prog.trackLabelAr || TRACK_LABELS[trackType],
      nameAr: safeTitle,
      sessionsCount,
      sessionsPerWeek: Math.max(1, Math.round(sessionsCount / 4)),
      durationMinutes: Math.max(30, Number(prog.durationMinutes || 60)),
      baseMonthlyEgp: price,
      assessmentFeeEgp: 0,
      membershipCardFeeEgp: 0,
      mandatoryKitFeeEgp: 0,
      companionFeeEgp: 0,
      scheduleAr: prog.scheduleAr,
      ageRangeAr: prog.ageRangeAr,
      sessionTimeAr: prog.sessionTimeAr,
      notesAr: prog.notesAr,
    });
  }

  for (const pkg of facility.pricePackages || []) {
    const price = Math.max(0, Number(pkg.baseMonthlyEgp || 0));
    const safeName =
      typeof pkg.nameAr === "string" && pkg.nameAr.trim()
        ? pkg.nameAr.trim()
        : "باقة منشأة";
    const key = normalizePackageKey(safeName, price);
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: pkg.id,
      source: "pricePackage",
      trackType: "school",
      trackLabelAr: "باقة منشأة",
      nameAr: safeName,
      sessionsCount: Math.max(1, Number(pkg.sessionsCount || 8)),
      sessionsPerWeek: Math.max(1, Number(pkg.sessionsPerWeek || 2)),
      durationMinutes: Math.max(30, Number(pkg.durationMinutes || 60)),
      baseMonthlyEgp: price,
      assessmentFeeEgp: Math.max(0, Number(pkg.assessmentFeeEgp || 0)),
      membershipCardFeeEgp: Math.max(0, Number(pkg.membershipCardFeeEgp || 0)),
      mandatoryKitFeeEgp: Math.max(0, Number(pkg.mandatoryKitFeeEgp || 0)),
      companionFeeEgp: Math.max(0, Number(pkg.companionFeeEgp || 0)),
    });
  }

  return items;
}

/**
 * Computes the true minimum monthly price across schoolPrograms and pricePackages.
 */
export function getFacilityStartingPriceEgp(
  facility: Pick<Facility, "schoolPrograms" | "pricePackages">
): number {
  const candidates: number[] = [];
  for (const prog of facility.schoolPrograms || []) {
    if (Number(prog.priceEgp) > 0) {
      candidates.push(Number(prog.priceEgp));
    }
  }
  for (const pkg of facility.pricePackages || []) {
    if (Number(pkg.baseMonthlyEgp) > 0) {
      candidates.push(Number(pkg.baseMonthlyEgp));
    }
  }
  if (candidates.length === 0) {
    return 0;
  }
  return Math.min(...candidates);
}
