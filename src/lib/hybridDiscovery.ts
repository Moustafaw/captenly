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
}

function rotateArray<T>(items: T[], seed: number): T[] {
  if (items.length <= 1 || seed <= 0) return items;
  const shift = seed % items.length;
  if (shift === 0) return items;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/**
 * Deduplicates external Google Places against Captenly registered accounts,
 * excludes gym-only venues, sorts closest to user's location first (prioritizing
 * matching city / nearby radius), and rotates pools cleanly across nearby venues.
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
    .trim();

  const sortByProximity = (list: Facility[]): Facility[] => {
    if (!userGeo) return list;
    return [...list].sort((a, b) => {
      const aCityMatch =
        cleanUserCity && (a.city === cleanUserCity || (a.addressAr || "").includes(cleanUserCity))
          ? 0
          : 1;
      const bCityMatch =
        cleanUserCity && (b.city === cleanUserCity || (b.addressAr || "").includes(cleanUserCity))
          ? 0
          : 1;
      const distA = calculateDistanceKm(userGeo.lat, userGeo.lng, a.coordinates.lat, a.coordinates.lng);
      const distB = calculateDistanceKm(userGeo.lat, userGeo.lng, b.coordinates.lat, b.coordinates.lng);
      // Prioritize same-city or nearby <= 25km first, then ascending distance
      const tierA = distA <= 25 || aCityMatch === 0 ? 0 : 1;
      const tierB = distB <= 25 || bCityMatch === 0 ? 0 : 1;
      if (tierA !== tierB) return tierA - tierB;
      return distA - distB;
    });
  };

  const featured = sortByProximity(
    deduped.filter((f) => Boolean(f.isFeaturedTier) && f.supplyStatus !== "seeded_unclaimed")
  );
  const featuredIds = new Set(featured.map((f) => f.id));

  const registeredSorted = sortByProximity(
    deduped.filter((f) => f.supplyStatus !== "seeded_unclaimed" && !featuredIds.has(f.id))
  );
  const registered = rotateArray(registeredSorted, rotationSeed);

  const unclaimedSorted = sortByProximity(
    deduped.filter((f) => f.supplyStatus === "seeded_unclaimed")
  );
  // Rotate within top nearby pool pool-window so nearby suggestions refresh automatically while staying close
  const nearbyPoolWindow = unclaimedSorted.slice(0, 8);
  const restDirectory = unclaimedSorted.slice(8);
  const unclaimedDirectory = [...rotateArray(nearbyPoolWindow, rotationSeed), ...restDirectory];

  return {
    featured,
    registered,
    unclaimedDirectory,
    allSorted: [...featured, ...registered, ...unclaimedDirectory],
  };
}
