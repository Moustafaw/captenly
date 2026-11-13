"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard, resolveFacilityImage } from "@/components/editorial/FacilityCard";
import { DemandRadarFallback } from "@/components/editorial/DemandRadarFallback";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import { getFacilityDistanceKm } from "@/lib/maps";

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
  } = useCaptenly();

  const isPoolsRoute = pathname.startsWith("/pools");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedMapId, setSelectedMapId] = useState<string>(facilities[0]?.id || "");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams?.get("q");
    const sport = searchParams?.get("sport");
    const ladies = searchParams?.get("ladies");
    const patch: Partial<typeof smartFilters> = {};
    if (q !== null) patch.searchQuery = q;
    if (sport === "swimming" || sport === "fitness" || sport === "all") patch.sportCategory = sport;
    if (isPoolsRoute && !sport) patch.sportCategory = "swimming";
    if (ladies === "1") patch.ladiesOnly = true;
    if (Object.keys(patch).length > 0) updateSmartFilters(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isPoolsRoute]);

  const filtered = useMemo(() => {
    const q = smartFilters.searchQuery.trim().toLowerCase();
    const list = facilities.filter((f) => {
      if (q) {
        const hay = `${f.nameAr} ${f.city} ${f.district} ${f.specialtiesAr.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (smartFilters.city !== "الكل" && f.city !== smartFilters.city) return false;
      if (smartFilters.sportCategory === "swimming" && f.sportSector === "fitness") return false;
      if (smartFilters.sportCategory === "fitness" && f.sportSector === "swimming") return false;
      if (smartFilters.heatedOnly && !f.poolSpecs?.isHeatedWinter) return false;
      if (
        smartFilters.ladiesOnly &&
        !f.poolSpecs?.hasLadiesOnlySlots &&
        !f.gymSpecs?.hasLadiesOnlySlots
      ) {
        return false;
      }
      const basePrice = f.pricePackages[0]?.baseMonthlyEgp || 600;
      if (basePrice > smartFilters.maxPriceEgp) return false;
      return true;
    });
    if (smartFilters.sortBy === "price_asc") {
      return [...list].sort(
        (a, b) =>
          (a.pricePackages[0]?.baseMonthlyEgp || 9999) -
          (b.pricePackages[0]?.baseMonthlyEgp || 9999)
      );
    }
    if (smartFilters.sortBy === "nearest") {
      return [...list].sort(
        (a, b) =>
          getFacilityDistanceKm(a, userLocation) - getFacilityDistanceKm(b, userLocation)
      );
    }
    return [...list].sort((a, b) => b.rating - a.rating);
  }, [facilities, smartFilters, userLocation]);

  const activeMapFac = filtered.find((f) => f.id === selectedMapId) || filtered[0];

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-section-title-mobile text-dark-slate">
            {isPoolsRoute ? "المسابح ومدارس السباحة" : "استكشف المنشآت"} ({filtered.length})
          </h1>
          <p className="text-[11px] text-text-muted">مقارنة شفافة وتواصل مباشر عبر واتساب</p>
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
        {["الكل", "المحلة الكبرى", "طنطا", "زفتى"].map((c) => (
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

      {filtered.length === 0 ? (
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
        <div className="flex flex-col gap-4">
          {filtered.map((fac) => (
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
