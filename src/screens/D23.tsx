"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard, FacilityImageOrFallback } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { DemandRadarFallback } from "@/components/editorial/DemandRadarFallback";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import {
  EGYPT_CITY_PRESETS,
  cleanPublicAddressAr,
  facilityMatchesCity,
  facilityMatchesSearch,
  getFacilityDistanceKm,
} from "@/lib/maps";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";
import { filterAndSortExploreCoaches } from "@/lib/coachSearch";
import { getFacilityStartingPriceEgp } from "@/lib/facilityPricing";
import type { Facility } from "@/types/captenly";

function Desktop23Inner() {
  const searchParams = useSearchParams();
  const {
    facilities,
    coaches,
    smartFilters,
    updateSmartFilters,
    resetSmartFilters,
    setFilterModalOpen,
    compareFacilityIds,
    userLocation,
    placesHydrating,
    mergeExternalPlacesFacilities,
  } = useCaptenly();

  const [selectedMapFacId, setSelectedMapFacId] = useState<string>(facilities[0]?.id || "");
  const [compareToast, setCompareToast] = useState<string | null>(null);
  const [googlePlacesResults, setGooglePlacesResults] = useState<Facility[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  // Sync URL query params cleanly once / on change
  useEffect(() => {
    const q = searchParams?.get("q");
    const sport = searchParams?.get("sport");
    const ladies = searchParams?.get("ladies");
    const city = searchParams?.get("city");
    const filtersOpen = searchParams?.get("filters");

    const patch: Partial<typeof smartFilters> = {};
    if (q !== null) {
      patch.searchQuery = q;
      if (q.trim() && !city) patch.city = "الكل";
    }
    if (sport === "swimming" || sport === "fitness" || sport === "all") patch.sportCategory = sport;
    if (city) patch.city = city;
    if (ladies === "1") patch.ladiesOnly = true;
    if (Object.keys(patch).length > 0) updateSmartFilters(patch);
    if (filtersOpen === "1") setFilterModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Hybrid Google Places search on query or city selection
  useEffect(() => {
    const q = smartFilters.searchQuery.trim();
    const city = smartFilters.city;
    if (q.length < 2 && city === "الكل" && !userLocation.isSpecified) {
      setGooglePlacesResults([]);
      setPlacesLoading(false);
      return;
    }

    let cancelled = false;
    setPlacesLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) {
        params.set("q", q);
        // Searching by text query searches across all of Egypt regardless of user's current city
        params.set("scope", "egypt");
      } else if (city && city !== "الكل") {
        params.set("city", city);
        if (city === userLocation.city) {
          params.set("lat", String(userLocation.lat));
          params.set("lng", String(userLocation.lng));
          if (smartFilters.maxDistanceKm > 0) {
            params.set("radius", String(smartFilters.maxDistanceKm));
          }
        } else {
          const preset = EGYPT_CITY_PRESETS.find((p) => p.city === city);
          if (preset) {
            params.set("lat", String(preset.lat));
            params.set("lng", String(preset.lng));
          }
        }
      } else if (userLocation.isSpecified) {
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
        if (smartFilters.maxDistanceKm > 0) {
          params.set("radius", String(smartFilters.maxDistanceKm));
        }
      } else {
        params.set("scope", "egypt");
      }

      fetch(`/api/places/search?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          const places = Array.isArray(data?.places) ? (data.places as Facility[]) : [];
          setGooglePlacesResults(places);
          if (places.length > 0) {
            mergeExternalPlacesFacilities(places);
          }
        })
        .catch(() => {
          if (!cancelled) setGooglePlacesResults([]);
        })
        .finally(() => {
          if (!cancelled) setPlacesLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartFilters.searchQuery, smartFilters.city, smartFilters.maxDistanceKm, userLocation.isSpecified, userLocation.city, userLocation.lat, userLocation.lng]);

  const filtered = useMemo(() => {
    const q = smartFilters.searchQuery.trim().toLowerCase();
    const list = facilities.filter((f) => {
      if (q) {
        if (!facilityMatchesSearch(f, q)) return false;
      } else if (smartFilters.city !== "الكل") {
        if (!facilityMatchesCity(f, smartFilters.city)) return false;
      }
      if (f.sportSector === "fitness") return false;
      if (smartFilters.heatedOnly && !f.poolSpecs?.isHeatedWinter) return false;
      if (smartFilters.ladiesOnly && !f.poolSpecs?.hasLadiesOnlySlots) return false;
      if (smartFilters.lifeguardOnly && !f.poolSpecs?.hasEdlfLifeguard) return false;
      const basePrice = getFacilityStartingPriceEgp(f);
      if (basePrice > 0 && basePrice > smartFilters.maxPriceEgp) return false;
      if (
        userLocation.isSpecified &&
        smartFilters.maxDistanceKm > 0 &&
        getFacilityDistanceKm(f, userLocation) > smartFilters.maxDistanceKm
      ) {
        return false;
      }
      return true;
    });

    // Keep public geographic search results (/api/places/search) independent of registered accounts
    const mergedList = [...list];
    if (!smartFilters.heatedOnly && !smartFilters.ladiesOnly && !smartFilters.lifeguardOnly && googlePlacesResults.length > 0) {
      const seenIds = new Set(mergedList.map((f) => f.id));
      for (const ext of googlePlacesResults) {
        if (seenIds.has(ext.id)) continue;
        if (
          userLocation.isSpecified &&
          smartFilters.maxDistanceKm > 0 &&
          getFacilityDistanceKm(ext, userLocation) > smartFilters.maxDistanceKm
        ) {
          continue;
        }
        mergedList.push(ext);
      }
    }

    if (smartFilters.sortBy === "price_asc") {
      return [...mergedList].sort(
        (a, b) =>
          (getFacilityStartingPriceEgp(a) || 9999) -
          (getFacilityStartingPriceEgp(b) || 9999)
      );
    }
    if (smartFilters.sortBy === "nearest" && userLocation.isSpecified) {
      return [...mergedList].sort(
        (a, b) =>
          getFacilityDistanceKm(a, userLocation) - getFacilityDistanceKm(b, userLocation)
      );
    }
    return [...mergedList].sort((a, b) => b.rating - a.rating);
  }, [facilities, googlePlacesResults, smartFilters, userLocation]);

  const partitioned = useMemo(
    () =>
      partitionFacilities3Tier(filtered, 0, {
        ...userLocation,
        maxDistanceKm: userLocation.isSpecified ? smartFilters.maxDistanceKm : undefined,
      }),
    [filtered, userLocation, smartFilters.maxDistanceKm]
  );

  const matchingCoaches = useMemo(
    () => filterAndSortExploreCoaches(coaches, smartFilters, userLocation),
    [coaches, smartFilters, userLocation]
  );

  const activeMapFacility =
    filtered.find((f) => f.id === selectedMapFacId) || filtered[0] || facilities[0];

  const activeFilterChips: { label: string; clear: () => void }[] = [];
  if (smartFilters.searchQuery.trim()) {
    activeFilterChips.push({
      label: `بحث: ${smartFilters.searchQuery}`,
      clear: () => updateSmartFilters({ searchQuery: "" }),
    });
  }
  if (smartFilters.city !== "الكل") {
    activeFilterChips.push({
      label: `المدينة: ${smartFilters.city}`,
      clear: () => updateSmartFilters({ city: "الكل" }),
    });
  }
  if (smartFilters.sportCategory !== "all") {
    activeFilterChips.push({
      label: "السباحة",
      clear: () => updateSmartFilters({ sportCategory: "all" }),
    });
  }
  if (smartFilters.heatedOnly) {
    activeFilterChips.push({
      label: "مدفأ شتاءً",
      clear: () => updateSmartFilters({ heatedOnly: false }),
    });
  }
  if (smartFilters.ladiesOnly) {
    activeFilterChips.push({
      label: "ساعات سيدات",
      clear: () => updateSmartFilters({ ladiesOnly: false }),
    });
  }

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0F172A] antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-md">
        {/* Top Search & Controls — Option B Luxury Bright Card */}
        <section className="bg-white rounded-[24px] p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] border border-[#0F172A]/6 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-section-title text-[24px] text-[#0F172A]">
                  استكشف المسابح وأكاديميات السباحة
                </h1>
                <span className="px-3 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-extrabold">
                  {filtered.length} منشأة
                </span>
              </div>
              <p className="font-body-compact text-[#64748B] mt-0.5">
                ابحث في مسابح وأكاديميات كابتنلي المسجلة بالإضافة إلى دليل الأماكن من خرائط Google
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-[#F7F9FA] rounded-full px-4 py-2 border border-[#0F172A]/10 focus-within:border-[#1D6E7D] focus-within:bg-white transition-colors">
                <Icon name="search" className="text-[#64748B] ml-2 text-[17px]" />
                <input
                  aria-label="ابحث بالاسم أو المنطقة"
                  value={smartFilters.searchQuery}
                  onChange={(e) => updateSmartFilters({ searchQuery: e.target.value })}
                  placeholder="ابحث بالاسم أو المنطقة..."
                  className="bg-transparent outline-none text-sm w-48 text-[#0F172A] placeholder:text-[#475569]"
                />
              </div>

              <button
                type="button"
                onClick={() => setFilterModalOpen(true)}
                className="px-4 py-2 rounded-full bg-[#EAF4F8] hover:bg-[#1D6E7D] text-[#1D6E7D] hover:text-white font-badge-label text-xs font-bold flex items-center gap-1.5 border border-[#1D6E7D]/15 transition-colors"
              >
                <Icon name="tune" className="text-[16px]" />
                <span>الفلاتر الذكية</span>
              </button>

              <select
                aria-label="ترتيب المنشآت"
                value={smartFilters.sortBy}
                onChange={(e) =>
                  updateSmartFilters({
                    sortBy: e.target.value as "rating" | "price_asc" | "nearest",
                  })
                }
                className="rounded-full bg-[#F7F9FA] px-4 py-2 text-xs font-bold text-[#0F172A] outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
              >
                <option value="nearest">الأقرب لموقعك</option>
                <option value="rating">الأعلى تقييماً</option>
                <option value="price_asc">الأقل سعراً</option>
              </select>

              {compareFacilityIds.length > 0 && (
                <Link
                  href="/compare"
                  className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Icon name="compare_arrows" className="text-[15px]" />
                  <span>جدول المقارنة ({compareFacilityIds.length} من 4)</span>
                </Link>
              )}
            </div>
          </div>

          {/* Removable Chips + Price Slider */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0F172A]/6 pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-bold border border-[#1D6E7D]/15 hover:bg-[#1D6E7D] hover:text-white transition-colors"
                >
                  <span>{chip.label}</span>
                  <Icon name="close" className="text-[13px]" />
                </button>
              ))}
              {activeFilterChips.length > 0 && (
                <button
                  type="button"
                  onClick={resetSmartFilters}
                  className="text-xs font-bold text-[#64748B] hover:text-[#1D6E7D] underline"
                >
                  مسح الكل
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-[#475569]">
              <label htmlFor="explore-max-price">الحد الأقصى للسعر الشهري:</label>
              <input
                id="explore-max-price"
                aria-label="الحد الأقصى للسعر الشهري"
                type="range"
                min={400}
                max={2500}
                step={50}
                value={smartFilters.maxPriceEgp}
                onChange={(e) => updateSmartFilters({ maxPriceEgp: Number(e.target.value) })}
                className="accent-[#1D6E7D] cursor-pointer"
              />
              <span className="font-extrabold text-[#1D6E7D]">{smartFilters.maxPriceEgp} ج.م</span>
            </div>
          </div>
        </section>

        {compareToast && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 text-xs font-bold">
            {compareToast}
          </div>
        )}

        {(placesLoading || placesHydrating) && (
          <div className="px-4 py-2.5 rounded-xl bg-surface-card border border-surface-container text-xs font-bold text-text-muted flex items-center gap-2">
            <Icon name="travel_explore" className="text-[16px] text-deep-olive animate-pulse" />
            <span>
              {userLocation.isSpecified
                ? `جاري البحث في مسابح خرائط Google القريبة من نطاقك (${userLocation.city})...`
                : "جاري استكشاف مسابح وأكاديميات مصر على خرائط Google..."}
            </span>
          </div>
        )}

        {filtered.length === 0 && (placesLoading || placesHydrating) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-72 rounded-[20px] bg-surface-card border border-surface-container animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 && matchingCoaches.length === 0 ? (
          <DemandRadarFallback
            queryText={smartFilters.searchQuery}
            onResetFilters={resetSmartFilters}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
            {/* Cards Column */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {partitioned.featured.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="verified" className="text-[17px] text-deep-olive" />
                    <h2 className="font-card-title-sm text-dark-slate">ترشيحات كابتنلي المختارة</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop">
                    {partitioned.featured.map((fac) => (
                      <FacilityCard
                        key={fac.id}
                        facility={fac}
                        onSelectCompareFeedback={(msg) => {
                          setCompareToast(msg);
                          setTimeout(() => setCompareToast(null), 3000);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {partitioned.registered.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="pool" className="text-[17px] text-dark-slate" />
                    <h2 className="font-card-title-sm text-dark-slate">
                      الأندية والأكاديميات المسجلة على كابتنلي ({partitioned.registered.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop">
                    {partitioned.registered.map((fac) => (
                      <FacilityCard
                        key={fac.id}
                        facility={fac}
                        onSelectCompareFeedback={(msg) => {
                          setCompareToast(msg);
                          setTimeout(() => setCompareToast(null), 3000);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {matchingCoaches.length > 0 && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Icon name="sports" className="text-[17px] text-dark-slate" />
                    <h2 className="font-card-title-sm text-dark-slate">
                      الكباتن والمدربون المطابقون ({matchingCoaches.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop">
                    {matchingCoaches.map((coach) => (
                      <VerifiedCoachCard key={coach.id} coach={coach} />
                    ))}
                  </div>
                </div>
              )}

              {partitioned.unclaimedDirectory.length > 0 && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Icon name="explore" className="text-[17px] text-text-muted" />
                    <h2 className="font-card-title-sm text-text-muted">
                      دليل الأماكن من خرائط Google — بدون أزرار تواصل ({partitioned.unclaimedDirectory.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop">
                    {partitioned.unclaimedDirectory.map((fac) => (
                      <FacilityCard
                        key={fac.id}
                        facility={fac}
                        onSelectCompareFeedback={(msg) => {
                          setCompareToast(msg);
                          setTimeout(() => setCompareToast(null), 3000);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Sticky Map Column */}
            <aside className="lg:col-span-4 lg:sticky lg:top-[124px] flex flex-col gap-4">
              <div className="bg-white rounded-[24px] p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] border border-[#0F172A]/6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-card-title text-[#0F172A]">خريطة التوزيع الميداني</h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D]">
                    {filtered.length} مواقع
                  </span>
                </div>

                {/* Live Google Map + Interactive Facility Switcher */}
                <CaptenlyGoogleMap
                  facilities={filtered}
                  selectedFacilityId={activeMapFacility?.id}
                  onSelectFacility={setSelectedMapFacId}
                  userCoordinates={{ lat: userLocation.lat, lng: userLocation.lng }}
                  heightClass="h-64"
                />

                {activeMapFacility && (
                  <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <FacilityImageOrFallback
                        facility={activeMapFacility}
                        compact
                        className="w-16 h-16 rounded-xl shrink-0"
                        imgClassName="w-16 h-16 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-[#1D6E7D]">
                          {cleanPublicAddressAr(activeMapFacility.city)}
                          {cleanPublicAddressAr(activeMapFacility.district)
                            ? ` • ${cleanPublicAddressAr(activeMapFacility.district)}`
                            : ""}
                        </div>
                        <h3 className="font-card-title-sm text-[#0F172A] truncate">
                          {activeMapFacility.nameAr}
                        </h3>
                        <span className="text-[11px] font-bold text-[#1D6E7D]">
                          {activeMapFacility.supplyStatus === "seeded_unclaimed"
                            ? "بانتظار تفعيل الإدارة المباشر"
                            : "موثقة رسمياً ✓"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/academy/${activeMapFacility.slug}`}
                        className="flex-1 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold text-center transition-colors shadow-xs"
                      >
                        فتح صفحة المنشأة ←
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Desktop23() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas-alabaster pt-6 text-center text-text-muted">
          جاري تحميل دليل المنشآت...
        </div>
      }
    >
      <Desktop23Inner />
    </Suspense>
  );
}
