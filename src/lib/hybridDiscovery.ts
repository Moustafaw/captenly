import { facilityMatchesCity, getFacilityDistanceKm } from "@/lib/maps";
import { Facility } from "@/types/captenly";

export interface HybridPartitionedFacilities {
  featured: Facility[];
  registered: Facility[];
  unclaimedDirectory: Facility[];
  allSorted: Facility[];
}

export interface UserGeoContext {
  lat: number;
  lng: number;
  city?: string;
  isSpecified?: boolean;
}

function rotateArray<T>(items: T[], seed: number): T[] {
  if (items.length <= 1 || seed <= 0) return items;
  const shift = seed % items.length;
  if (shift === 0) return items;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/**
 * Deterministic Egypt-wide shuffle when user has NOT specified a city/location,
 * so academies & clubs rotate organically across all governorates.
 */
function seededDiversify<T>(items: T[], seed: number): T[] {
  if (items.length <= 1) return items;
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const hash = Math.abs((seed + 1) * 2654435761 + i * 31) % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[hash];
    copy[hash] = tmp;
  }
  return copy;
}

/**
 * Deduplicates external Google Places against Captenly registered accounts,
 * excludes gym-only venues.
 * - When `userGeo.isSpecified === true`: sorts closest to user's location first
 *   (prioritizing matching city / <= 25km radius) and rotates nearby venues.
 * - When location is NOT specified ("كل مصر"): diversifies across Egypt organically.
 */
export function partitionFacilities3Tier(
  facilities: Facility[],
  rotationSeed = 0,
  userGeo?: UserGeoContext
): HybridPartitionedFacilities {
  const swimmingOnly = facilities.filter((f) => f.sportSector !== "fitness");

  // Keep public geographic search results (/api/places/search) completely independent of account registration,
  // deduplicating only by identical record id.
  const seenIds = new Set<string>();
  const deduped: Facility[] = [];
  for (const f of swimmingOnly) {
    if (seenIds.has(f.id)) continue;
    seenIds.add(f.id);
    deduped.push(f);
  }

  const cleanUserCity = (userGeo?.city || "")
    .replace(/\s*\(GPS\)/g, "")
    .replace(/موقعك الحالي/g, "")
    .replace(/موقع محدد على الخريطة/g, "")
    .replace(/كل مصر/g, "")
    .replace(/^الكل$/g, "")
    .trim();

  const hasSpecificLocation = Boolean(userGeo?.isSpecified);

  const isLocalMatch = (f: Facility): boolean => {
    if (cleanUserCity && facilityMatchesCity(f, cleanUserCity)) {
      return true;
    }
    if (userGeo && Number.isFinite(userGeo.lat) && Number.isFinite(userGeo.lng)) {
      return getFacilityDistanceKm(f, userGeo) <= 28;
    }
    return false;
  };

  const scopedPool = hasSpecificLocation ? deduped.filter(isLocalMatch) : deduped;

  const verificationRank = (f: Facility) => (f.supplyStatus === "verified_active" ? 0 : 1);

  const sortByProximity = (list: Facility[]): Facility[] => {
    if (!userGeo || !hasSpecificLocation) {
      const diversified = seededDiversify(list, rotationSeed);
      return diversified.sort((a, b) => verificationRank(a) - verificationRank(b));
    }
    return [...list].sort((a, b) => {
      const aCityMatch = cleanUserCity && facilityMatchesCity(a, cleanUserCity) ? 0 : 1;
      const bCityMatch = cleanUserCity && facilityMatchesCity(b, cleanUserCity) ? 0 : 1;
      if (aCityMatch !== bCityMatch) return aCityMatch - bCityMatch;
      const rankDiff = verificationRank(a) - verificationRank(b);
      if (rankDiff !== 0) return rankDiff;
      const distA = getFacilityDistanceKm(a, userGeo);
      const distB = getFacilityDistanceKm(b, userGeo);
      return distA - distB;
    });
  };

  const maybeRotateLocal = (list: Facility[]): Facility[] =>
    hasSpecificLocation && rotationSeed > 0 ? rotateArray(list, rotationSeed) : list;

  const featured = maybeRotateLocal(
    sortByProximity(
      scopedPool.filter((f) => Boolean(f.isFeaturedTier) && f.supplyStatus !== "seeded_unclaimed")
    )
  );
  const featuredIds = new Set(featured.map((f) => f.id));

  const registered = maybeRotateLocal(
    sortByProximity(
      scopedPool.filter((f) => f.supplyStatus !== "seeded_unclaimed" && !featuredIds.has(f.id))
    )
  );

  const unclaimedDirectory = maybeRotateLocal(
    sortByProximity(scopedPool.filter((f) => f.supplyStatus === "seeded_unclaimed"))
  );

  return {
    featured,
    registered,
    unclaimedDirectory,
    allSorted: [...featured, ...registered, ...unclaimedDirectory],
  };
}
