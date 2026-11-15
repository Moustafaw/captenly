import { calculateDistanceKm } from "@/lib/maps";
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

  const registeredPlaceIds = new Set(
    swimmingOnly
      .filter((f) => f.supplyStatus !== "seeded_unclaimed" && f.googlePlaceId)
      .map((f) => f.googlePlaceId as string)
  );

  const deduped = swimmingOnly.filter((f) => {
    if (f.supplyStatus === "seeded_unclaimed" && f.googlePlaceId) {
      return !registeredPlaceIds.has(f.googlePlaceId);
    }
    return true;
  });

  const cleanUserCity = (userGeo?.city || "")
    .replace(/\s*\(GPS\)/g, "")
    .replace(/موقعك الحالي/g, "")
    .replace(/موقع محدد على الخريطة/g, "")
    .replace(/كل مصر/g, "")
    .replace(/^الكل$/g, "")
    .trim();

  const hasSpecificLocation = Boolean(userGeo?.isSpecified);

  const isLocalMatch = (f: Facility): boolean => {
    if (cleanUserCity) {
      const hay = `${f.city || ""} ${f.governorate || ""} ${f.district || ""} ${f.addressAr || ""}`;
      if (hay.includes(cleanUserCity)) return true;
    }
    if (userGeo && Number.isFinite(userGeo.lat) && Number.isFinite(userGeo.lng)) {
      return calculateDistanceKm(userGeo.lat, userGeo.lng, f.coordinates.lat, f.coordinates.lng) <= 28;
    }
    return false;
  };

  const scopedPool = hasSpecificLocation ? deduped.filter(isLocalMatch) : deduped;

  const sortByProximity = (list: Facility[]): Facility[] => {
    if (!userGeo || !hasSpecificLocation) {
      return seededDiversify(list, rotationSeed);
    }
    return [...list].sort((a, b) => {
      const aCityMatch =
        cleanUserCity &&
        (a.city === cleanUserCity ||
          (a.addressAr || "").includes(cleanUserCity) ||
          (a.governorate || "") === cleanUserCity)
          ? 0
          : 1;
      const bCityMatch =
        cleanUserCity &&
        (b.city === cleanUserCity ||
          (b.addressAr || "").includes(cleanUserCity) ||
          (b.governorate || "") === cleanUserCity)
          ? 0
          : 1;
      if (aCityMatch !== bCityMatch) return aCityMatch - bCityMatch;
      const distA = calculateDistanceKm(userGeo.lat, userGeo.lng, a.coordinates.lat, a.coordinates.lng);
      const distB = calculateDistanceKm(userGeo.lat, userGeo.lng, b.coordinates.lat, b.coordinates.lng);
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
