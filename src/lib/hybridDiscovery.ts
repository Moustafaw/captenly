import { Facility } from "@/types/captenly";

export interface HybridPartitionedFacilities {
  featured: Facility[];
  registered: Facility[];
  unclaimedDirectory: Facility[];
}

/**
 * Deduplicates external Google Places against Captenly registered accounts
 * matching the same googlePlaceId (so registered accounts with custom photos
 * and contact channels always override external listings), excludes gym-only
 * venues, and partitions results into clean 3-tier order.
 */
export function partitionFacilities3Tier(
  facilities: Facility[],
  rotationSeed = 0
): HybridPartitionedFacilities {
  const swimmingOnly = facilities.filter((f) => f.sportSector !== "fitness");

  // Map claimed/registered googlePlaceIds so unclaimed duplicates are suppressed
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

  const featured = deduped.filter(
    (f) => Boolean(f.isFeaturedTier) && f.supplyStatus !== "seeded_unclaimed"
  );
  const featuredIds = new Set(featured.map((f) => f.id));

  const rawRegistered = deduped.filter(
    (f) => f.supplyStatus !== "seeded_unclaimed" && !featuredIds.has(f.id)
  );

  // Smart rotation across cities/registrations when more than 3 registered items exist
  let registered = rawRegistered;
  if (rawRegistered.length > 1 && rotationSeed > 0) {
    const shift = rotationSeed % rawRegistered.length;
    registered = [...rawRegistered.slice(shift), ...rawRegistered.slice(0, shift)];
  }

  const unclaimedDirectory = deduped.filter((f) => f.supplyStatus === "seeded_unclaimed");

  return { featured, registered, unclaimedDirectory };
}
