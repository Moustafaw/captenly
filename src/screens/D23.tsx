"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard, resolveFacilityImage } from "@/components/editorial/FacilityCard";
import { DemandRadarFallback } from "@/components/editorial/DemandRadarFallback";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import { EGYPT_CITY_PRESETS, getFacilityDistanceKm } from "@/lib/maps";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";
import type { Facility } from "@/types/captenly";

function Desktop23Inner() {
  const searchParams = useSearchParams();
  const {
    facilities,
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
    if (q !== null) patch.searchQuery = q;
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
    if (q.length < 2 && city === "الكل") {
      setGooglePlacesResults([]);
      setPlacesLoading(false);
      return;
    }

    let cancelled = false;
    setPlacesLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (city && city !== "الكل") {
        params.set("city", city);
        if (city === userLocation.city) {
          params.set("lat", String(userLocation.lat));
          params.set("lng", String(userLocation.lng));
        } else {
          const preset = EGYPT_CITY_PRESETS.find((p) => p.city === city);
          if (preset) {
            params.set("lat", String(preset.lat));
            params.set("lng", String(preset.lng));
          }
        }
      } else {
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
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
  }, [smartFilters.searchQuery, smartFilters.city, userLocation.city, userLocation.lat, userLocation.lng]);

  const filtered = useMemo(() => {
    const q = smartFilters.searchQuery.trim().toLowerCase();
    const list = facilities.filter((f) => {
      if (q) {
        const hay = `${f.nameAr} ${f.nameEn} ${f.city} ${f.district} ${f.addressAr || ""} ${f.specialtiesAr.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (smartFilters.city !== "الكل") {
        const cityNorm = smartFilters.city.trim();
        const matchesCity =
          f.city === cityNorm ||
          (f.city && f.city.includes(cityNorm)) ||
          (f.addressAr && f.addressAr.includes(cityNorm)) ||
          (f.district && f.district.includes(cityNorm));
        if (!matchesCity) return false;
      }
      if (f.sportSector === "fitness") return false;
      if (smartFilters.heatedOnly && !f.poolSpecs?.isHeatedWinter) return false;
      if (smartFilters.ladiesOnly && !f.poolSpecs?.hasLadiesOnlySlots) return false;
      if (smartFilters.lifeguardOnly && !f.poolSpecs?.hasEdlfLifeguard) return false;
      const basePrice = f.pricePackages[0]?.baseMonthlyEgp ?? null;
      if (basePrice != null && basePrice > smartFilters.maxPriceEgp) return false;
      return true;
    });

    // Merge active Google Places matches when technical boolean filters aren't excluding directory entries
    const mergedList = [...list];
    if (!smartFilters.heatedOnly && !smartFilters.ladiesOnly && !smartFilters.lifeguardOnly && googlePlacesResults.length > 0) {
      const seenIds = new Set(mergedList.map((f) => f.id));
      const seenPlaceIds = new Set(mergedList.map((f) => f.googlePlaceId).filter(Boolean));
      for (const ext of googlePlacesResults) {
        if (seenIds.has(ext.id)) continue;
        if (ext.googlePlaceId && seenPlaceIds.has(ext.googlePlaceId)) continue;
        mergedList.push(ext);
      }
    }

    if (smartFilters.sortBy === "price_asc") {
      return [...mergedList].sort(
        (a, b) =>
          (a.pricePackages[0]?.baseMonthlyEgp || 9999) -
          (b.pricePackages[0]?.baseMonthlyEgp || 9999)
      );
    }
    if (smartFilters.sortBy === "nearest") {
      return [...mergedList].sort(
        (a, b) =>
          getFacilityDistanceKm(a, userLocation) - getFacilityDistanceKm(b, userLocation)
      );
    }
    return [...mergedList].sort((a, b) => b.rating - a.rating);
  }, [facilities, googlePlacesResults, smartFilters, userLocation]);

  const partitioned = useMemo(
    () => partitionFacilities3Tier(filtered, 0, userLocation),
    [filtered, userLocation]
  );

  const quickCities = useMemo(() => {
    const base = [
      "الكل",
      userLocation.city,
      smartFilters.city !== "الكل" ? smartFilters.city : "",
      "المحلة الكبرى",
      "طنطا",
      "القاهرة",
      "الإسكندرية",
      "المنصورة",
    ];
    return Array.from(new Set(base.filter(Boolean))).slice(0, 6);
  }, [userLocation.city, smartFilters.city]);

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
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-md">
        {/* Top Search & Controls */}
        <section className="bg-surface-card rounded-[20px] p-5 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="font-section-title text-[24px] text-dark-slate">
                استكشف المسابح وأكاديميات السباحة ({filtered.length} منشأة)
              </h1>
              <p className="font-body-compact text-text-muted mt-0.5">
                ابحث في مسابح وأكاديميات كابتنلي المسجلة بالإضافة إلى دليل الأماكن من خرائط Google
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-surface-snow rounded-full px-4 py-2 border border-surface-container">
                <Icon name="search" className="text-text-muted ml-2 text-[17px]" />
                <input
                  value={smartFilters.searchQuery}
                  onChange={(e) => updateSmartFilters({ searchQuery: e.target.value })}
                  placeholder="ابحث بالاسم أو المنطقة..."
                  className="bg-transparent outline-none text-sm w-48 text-dark-slate"
                />
              </div>

              <button
                type="button"
                onClick={() => setFilterModalOpen(true)}
                className="px-4 py-2 rounded-full bg-surface-snow hover:bg-lime-tint text-dark-slate font-badge-label text-xs flex items-center gap-1.5 border border-surface-container"
              >
                <Icon name="tune" className="text-[16px]" />
                <span>الفلاتر الذكية</span>
              </button>

              <select
                value={smartFilters.sortBy}
                onChange={(e) =>
                  updateSmartFilters({
                    sortBy: e.target.value as "rating" | "price_asc" | "nearest",
                  })
                }
                className="rounded-full bg-surface-snow px-4 py-2 text-xs font-bold text-dark-slate outline-none border border-surface-container"
              >
                <option value="nearest">الأقرب لموقعك</option>
                <option value="rating">الأعلى تقييماً</option>
                <option value="price_asc">الأقل سعراً</option>
              </select>
            </div>
          </div>

          {/* Quick Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {quickCities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateSmartFilters({ city: c })}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    smartFilters.city === c
                      ? "bg-dark-slate text-electric-volt"
                      : "bg-surface-snow text-text-muted hover:text-dark-slate"
                  }`}
                >
                  {c}
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  updateSmartFilters({
                    sportCategory: smartFilters.sportCategory === "swimming" ? "all" : "swimming",
                  })
                }
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                  smartFilters.sportCategory === "swimming"
                    ? "bg-lime-tint text-deep-olive"
                    : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="pool" className="text-[14px]" />
                <span>السباحة والمسابح</span>
              </button>

              <button
                type="button"
                onClick={() => updateSmartFilters({ heatedOnly: !smartFilters.heatedOnly })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                  smartFilters.heatedOnly
                    ? "bg-lime-tint text-deep-olive"
                    : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="thermostat" className="text-[14px]" />
                <span>مدفأ شتاءً</span>
              </button>

              <button
                type="button"
                onClick={() => updateSmartFilters({ ladiesOnly: !smartFilters.ladiesOnly })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                  smartFilters.ladiesOnly
                    ? "bg-lime-tint text-deep-olive"
                    : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="female" className="text-[14px]" />
                <span>ساعات سيدات</span>
              </button>
            </div>

            {compareFacilityIds.length > 0 && (
              <Link
                href="/compare"
                className="px-4 py-1.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold flex items-center gap-1.5"
              >
                <Icon name="compare_arrows" className="text-[15px]" />
                <span>جدول المقارنة ({compareFacilityIds.length} من 4)</span>
              </Link>
            )}
          </div>

          {/* Removable Chips + Price Slider */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-container pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-xs font-bold"
                >
                  <span>{chip.label}</span>
                  <Icon name="close" className="text-[13px]" />
                </button>
              ))}
              {activeFilterChips.length > 0 && (
                <button
                  type="button"
                  onClick={resetSmartFilters}
                  className="text-xs font-bold text-text-muted hover:text-dark-slate underline"
                >
                  مسح الكل
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>الحد الأقصى للسعر الشهري:</span>
              <input
                type="range"
                min={400}
                max={2500}
                step={50}
                value={smartFilters.maxPriceEgp}
                onChange={(e) => updateSmartFilters({ maxPriceEgp: Number(e.target.value) })}
                className="accent-deep-olive cursor-pointer"
              />
              <span className="font-bold text-deep-olive">{smartFilters.maxPriceEgp} ج.م</span>
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
            <span>جاري البحث في مسابح خرائط Google القريبة من نطاقك ({userLocation.city})...</span>
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
        ) : filtered.length === 0 ? (
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
              <div className="bg-surface-card rounded-[20px] p-5 shadow-sm border border-surface-container flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-card-title text-dark-slate">خريطة التوزيع الميداني</h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-lime-tint text-deep-olive">
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
                  <div className="rounded-2xl bg-surface-snow p-4 flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveFacilityImage(activeMapFacility.heroImage)}
                        alt={activeMapFacility.nameAr}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-deep-olive">
                          {activeMapFacility.city} • {activeMapFacility.district}
                        </div>
                        <h3 className="font-card-title-sm text-dark-slate truncate">
                          {activeMapFacility.nameAr}
                        </h3>
                        <span className="text-[11px] font-bold text-deep-olive">
                          {activeMapFacility.supplyStatus === "seeded_unclaimed"
                            ? "بانتظار تفعيل الإدارة المباشر"
                            : "موثقة رسمياً ✓"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/academy/${activeMapFacility.slug}`}
                        className="flex-1 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold text-center"
                      >
                        فتح صفحة المنشأة
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
