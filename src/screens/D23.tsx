"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard, resolveFacilityImage } from "@/components/editorial/FacilityCard";
import { DemandRadarFallback } from "@/components/editorial/DemandRadarFallback";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import { getFacilityDistanceKm } from "@/lib/maps";

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
  } = useCaptenly();

  const [selectedMapFacId, setSelectedMapFacId] = useState<string>(facilities[0]?.id || "");
  const [compareToast, setCompareToast] = useState<string | null>(null);

  // Sync URL query params cleanly once / on change
  useEffect(() => {
    const q = searchParams?.get("q");
    const sport = searchParams?.get("sport");
    const ladies = searchParams?.get("ladies");
    const filtersOpen = searchParams?.get("filters");

    const patch: Partial<typeof smartFilters> = {};
    if (q !== null) patch.searchQuery = q;
    if (sport === "swimming" || sport === "fitness" || sport === "all") patch.sportCategory = sport;
    if (ladies === "1") patch.ladiesOnly = true;
    if (Object.keys(patch).length > 0) updateSmartFilters(patch);
    if (filtersOpen === "1") setFilterModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = smartFilters.searchQuery.trim().toLowerCase();
    const list = facilities.filter((f) => {
      if (q) {
        const hay = `${f.nameAr} ${f.nameEn} ${f.city} ${f.district} ${f.specialtiesAr.join(" ")}`.toLowerCase();
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
      if (smartFilters.lifeguardOnly && !f.poolSpecs?.hasEdlfLifeguard) return false;
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
      label: smartFilters.sportCategory === "swimming" ? "السباحة" : "الجيم واللياقة",
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
                استكشف الأندية والمسابح وصالات اللياقة ({filtered.length} منشأة)
              </h1>
              <p className="font-body-compact text-text-muted mt-0.5">
                قارن الأندية والمسابح وصالات اللياقة المتاحة في نطاقك وتواصل مع الإدارة عبر واتساب مباشرة
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
                <option value="rating">الأعلى تقييماً</option>
                <option value="price_asc">الأقل سعراً</option>
                <option value="nearest">حسب المدينة</option>
              </select>
            </div>
          </div>

          {/* Quick Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {["الكل", "المحلة الكبرى", "طنطا", "زفتى"].map((c) => (
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
                <span>سباحة</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSmartFilters({
                    sportCategory: smartFilters.sportCategory === "fitness" ? "all" : "fitness",
                  })
                }
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                  smartFilters.sportCategory === "fitness"
                    ? "bg-lime-tint text-deep-olive"
                    : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="fitness_center" className="text-[14px]" />
                <span>جيم ولياقة</span>
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

        {filtered.length === 0 ? (
          <DemandRadarFallback
            queryText={smartFilters.searchQuery}
            onResetFilters={resetSmartFilters}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
            {/* Cards Column */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop">
              {filtered.map((fac) => (
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
