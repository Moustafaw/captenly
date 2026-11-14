"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard, resolveFacilityImage } from "@/components/editorial/FacilityCard";
import { DemandRadarFallback } from "@/components/editorial/DemandRadarFallback";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import { EGYPT_CITY_PRESETS, getFacilityDistanceKm } from "@/lib/maps";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";
import type { Facility } from "@/types/captenly";

function Phone6Inner() {
  const pathname = usePathname() || "/explore";
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

  const isPoolsRoute = pathname.startsWith("/pools");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedMapId, setSelectedMapId] = useState<string>(facilities[0]?.id || "");
  const [toast, setToast] = useState<string | null>(null);
  const [googlePlacesResults, setGooglePlacesResults] = useState<Facility[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  useEffect(() => {
    const q = searchParams?.get("q");
    const sport = searchParams?.get("sport");
    const ladies = searchParams?.get("ladies");
    const city = searchParams?.get("city");
    const patch: Partial<typeof smartFilters> = {};
    if (q !== null) {
      patch.searchQuery = q;
      if (q.trim() && !city) patch.city = "الكل";
    }
    if (sport === "swimming" || sport === "fitness" || sport === "all") patch.sportCategory = sport;
    if (isPoolsRoute && !sport) patch.sportCategory = "swimming";
    if (city) patch.city = city;
    if (ladies === "1") patch.ladiesOnly = true;
    if (Object.keys(patch).length > 0) updateSmartFilters(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isPoolsRoute]);

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
      if (q) {
        params.set("q", q);
        params.set("scope", "egypt");
      } else if (city && city !== "الكل") {
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
      } else if (userLocation.isSpecified) {
        params.set("lat", String(userLocation.lat));
        params.set("lng", String(userLocation.lng));
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
  }, [smartFilters.searchQuery, smartFilters.city, userLocation.isSpecified, userLocation.city, userLocation.lat, userLocation.lng]);

  const filtered = useMemo(() => {
    const q = smartFilters.searchQuery.trim().toLowerCase();
    const list = facilities.filter((f) => {
      if (q) {
        const hay = `${f.nameAr} ${f.nameEn} ${f.city} ${f.governorate} ${f.district} ${f.addressAr || ""} ${f.specialtiesAr.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      } else if (smartFilters.city !== "الكل") {
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
      const basePrice = f.pricePackages[0]?.baseMonthlyEgp ?? null;
      if (basePrice != null && basePrice > smartFilters.maxPriceEgp) return false;
      return true;
    });

    const mergedList = [...list];
    if (!smartFilters.heatedOnly && !smartFilters.ladiesOnly && googlePlacesResults.length > 0) {
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
    if (smartFilters.sortBy === "nearest" && userLocation.isSpecified) {
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
      userLocation.isSpecified ? userLocation.city : "",
      smartFilters.city !== "الكل" ? smartFilters.city : "",
      "القاهرة",
      "الإسكندرية",
      "المحلة الكبرى",
      "طنطا",
      "المنصورة",
    ];
    return Array.from(new Set(base.filter(Boolean))).slice(0, 6);
  }, [userLocation.isSpecified, userLocation.city, smartFilters.city]);

  const activeMapFac = filtered.find((f) => f.id === selectedMapId) || filtered[0];

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-section-title-mobile text-dark-slate">
            {isPoolsRoute ? "المسابح ومدارس السباحة" : "استكشف المسابح والأكاديميات"} ({filtered.length})
          </h1>
          <p className="text-[11px] text-text-muted">مقارنة شفافة للمسابح والمدربين المعتمدين</p>
        </div>

        <div className="flex items-center bg-surface-card p-1 rounded-full shadow-sm border border-surface-container shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 rounded-full text-[11px] font-bold ${
              viewMode === "list" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
            }`}
          >
            القائمة
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`px-3 py-1 rounded-full text-[11px] font-bold ${
              viewMode === "map" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
            }`}
          >
            الخريطة
          </button>
        </div>
      </div>

      {/* Search + Smart Filters */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-surface-card rounded-full px-3.5 py-2 shadow-sm border border-surface-container">
          <Icon name="search" className="text-text-muted ml-1.5 text-[16px]" />
          <input
            value={smartFilters.searchQuery}
            onChange={(e) => updateSmartFilters({ searchQuery: e.target.value })}
            placeholder="ابحث بالاسم أو المنطقة..."
            className="w-full bg-transparent outline-none text-xs text-dark-slate"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterModalOpen(true)}
          className="px-3.5 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold flex items-center gap-1 shrink-0"
        >
          <Icon name="tune" className="text-[15px]" />
          <span>فلاتر</span>
        </button>
      </div>

      {/* Horizontal Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-margin px-margin scrollbar-none">
        {quickCities.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => updateSmartFilters({ city: c })}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold ${
              smartFilters.city === c ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-text-muted"
            }`}
          >
            {c}
          </button>
        ))}

        <button
          type="button"
          onClick={() => updateSmartFilters({ heatedOnly: !smartFilters.heatedOnly })}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
            smartFilters.heatedOnly ? "bg-lime-tint text-deep-olive" : "bg-surface-card text-text-muted"
          }`}
        >
          <Icon name="thermostat" className="text-[13px]" />
          <span>مدفأ شتاءً</span>
        </button>

        <button
          type="button"
          onClick={() => updateSmartFilters({ ladiesOnly: !smartFilters.ladiesOnly })}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
            smartFilters.ladiesOnly ? "bg-lime-tint text-deep-olive" : "bg-surface-card text-text-muted"
          }`}
        >
          <Icon name="female" className="text-[13px]" />
          <span>ساعات سيدات</span>
        </button>

        {compareFacilityIds.length > 0 && (
          <Link
            href="/compare"
            className="shrink-0 px-3 py-1.5 rounded-full bg-electric-volt text-dark-slate text-[11px] font-bold"
          >
            قارن ({compareFacilityIds.length} من 4)
          </Link>
        )}
      </div>

      {toast && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
          {toast}
        </div>
      )}

      {(placesLoading || placesHydrating) && (
        <div className="p-2.5 rounded-xl bg-surface-card border border-surface-container text-xs font-bold text-text-muted flex items-center gap-2">
          <Icon name="travel_explore" className="text-[16px] text-deep-olive animate-pulse" />
          <span>
            {userLocation.isSpecified
              ? `جاري البحث في مسابح خرائط Google القريبة من ${userLocation.city}...`
              : "جاري استكشاف مسابح وأكاديميات مصر على خرائط Google..."}
          </span>
        </div>
      )}

      {filtered.length === 0 && (placesLoading || placesHydrating) ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-60 rounded-2xl bg-surface-card border border-surface-container animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <DemandRadarFallback queryText={smartFilters.searchQuery} onResetFilters={resetSmartFilters} />
      ) : viewMode === "map" ? (
        <div className="flex flex-col gap-4">
          <div className="bg-surface-card rounded-2xl p-3.5 shadow-sm border border-surface-container">
            <CaptenlyGoogleMap
              facilities={filtered}
              selectedFacilityId={activeMapFac?.id}
              onSelectFacility={setSelectedMapId}
              userCoordinates={{ lat: userLocation.lat, lng: userLocation.lng }}
              heightClass="h-64"
            />
          </div>

          {activeMapFac && (
            <div className="bg-surface-card rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={resolveFacilityImage(activeMapFac.heroImage)}
                  alt={activeMapFac.nameAr}
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-deep-olive">
                    {activeMapFac.city} • {activeMapFac.district}
                  </div>
                  <div className="font-card-title-sm text-dark-slate truncate">{activeMapFac.nameAr}</div>
                </div>
              </div>
              <Link
                href={`/academy/${activeMapFac.slug}`}
                className="w-full py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold text-center"
              >
                فتح تفاصيل المنشأة ←
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {partitioned.featured.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <Icon name="verified" className="text-[15px] text-deep-olive" />
                <span className="text-xs font-bold text-dark-slate">ترشيحات كابتنلي المختارة</span>
              </div>
              <div className="flex flex-col gap-3">
                {partitioned.featured.map((fac) => (
                  <FacilityCard
                    key={fac.id}
                    facility={fac}
                    onSelectCompareFeedback={(msg) => {
                      setToast(msg);
                      setTimeout(() => setToast(null), 2800);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {partitioned.registered.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <Icon name="pool" className="text-[15px] text-dark-slate" />
                <span className="text-xs font-bold text-dark-slate">
                  الحسابات المسجلة على كابتنلي ({partitioned.registered.length})
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {partitioned.registered.map((fac) => (
                  <FacilityCard
                    key={fac.id}
                    facility={fac}
                    onSelectCompareFeedback={(msg) => {
                      setToast(msg);
                      setTimeout(() => setToast(null), 2800);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {partitioned.unclaimedDirectory.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <Icon name="explore" className="text-[15px] text-text-muted" />
                <span className="text-xs font-bold text-text-muted">
                  دليل الأماكن من خرائط Google — بدون أزرار تواصل ({partitioned.unclaimedDirectory.length})
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {partitioned.unclaimedDirectory.map((fac) => (
                  <FacilityCard
                    key={fac.id}
                    facility={fac}
                    onSelectCompareFeedback={(msg) => {
                      setToast(msg);
                      setTimeout(() => setToast(null), 2800);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Phone6() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster p-6 text-center text-xs">جاري التحميل...</div>}>
      <Phone6Inner />
    </Suspense>
  );
}
