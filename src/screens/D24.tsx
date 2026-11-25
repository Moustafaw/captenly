"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";
import { sortCoachesWithVerificationPriority } from "@/lib/coachSearch";
import { CaptenlyImage } from "@/components/CaptenlyImage";
import type { Coach, Facility } from "@/types/captenly";

type HomeCategoryKey = "all" | "swimming" | "ladies" | "kids" | "heated";

interface Desktop24Props {
  initialFacilities?: Facility[];
  initialCoaches?: Coach[];
}

export default function Desktop24({
  initialFacilities = [],
  initialCoaches = [],
}: Desktop24Props = {}) {
  const {
    facilities,
    coaches,
    articles,
    userLocation,
    setLocationModalOpen,
    isFavorite,
    toggleFavorite,
    compareFacilityIds,
    placesHydrating,
    publicSupplyHydrated,
    smartFilters,
    currentPersona,
    isAuthenticated,
  } = useCaptenly();

  const isFacilityManager = isAuthenticated && currentPersona.role === "facility_manager";
  const isCoachRole = isAuthenticated && currentPersona.role === "coach";
  const isAthleteOrParent =
    isAuthenticated &&
    (currentPersona.role === "adult_athlete" || currentPersona.role === "parent");

  const [selectedCat, setSelectedCat] = useState<HomeCategoryKey>("all");
  const [compareNotice, setCompareNotice] = useState<string | null>(null);
  const [rotationSeed, setRotationSeed] = useState<number>(0);

  useEffect(() => {
    setRotationSeed(0);
  }, [userLocation.isSpecified, userLocation.city, userLocation.lat, userLocation.lng]);

  const effectiveFacilities = facilities.length > 0 ? facilities : initialFacilities;
  const effectiveCoaches = coaches.length > 0 ? coaches : initialCoaches;
  const isFacilitiesLoading =
    (placesHydrating || !publicSupplyHydrated) && effectiveFacilities.length === 0;

  const swimmingFacilities = useMemo(
    () => effectiveFacilities.filter((f) => f.sportSector !== "fitness"),
    [effectiveFacilities]
  );

  const filteredFacilities = useMemo(() => {
    return swimmingFacilities.filter((f) => {
      if (selectedCat === "swimming") return f.sportSector !== "fitness";
      if (selectedCat === "ladies") {
        return Boolean(f.poolSpecs?.hasLadiesOnlySlots);
      }
      if (selectedCat === "kids") {
        return f.specialtiesAr.some((s) => s.includes("أطفال") || s.includes("تأسيس"));
      }
      if (selectedCat === "heated") return Boolean(f.poolSpecs?.isHeatedWinter);
      return true;
    });
  }, [swimmingFacilities, selectedCat]);

  const partitioned = useMemo(
    () =>
      partitionFacilities3Tier(filteredFacilities, rotationSeed, {
        lat: userLocation.lat,
        lng: userLocation.lng,
        city: userLocation.city,
        isSpecified: userLocation.isSpecified,
        maxDistanceKm: userLocation.isSpecified ? smartFilters.maxDistanceKm : undefined,
      }),
    [filteredFacilities, rotationSeed, userLocation.lat, userLocation.lng, userLocation.city, userLocation.isSpecified, smartFilters.maxDistanceKm]
  );

  // Home always showcases up to 3 rotating suggestions (diversified across Egypt if no location selected, or nearest when selected)
  const homeSuggestions = useMemo(
    () => partitioned.allSorted.slice(0, 3),
    [partitioned.allSorted]
  );

  const cleanCityLabel = userLocation.city.replace(/\s*\(GPS\)/g, "").trim();
  const exploreCityHref =
    userLocation.isSpecified && cleanCityLabel && cleanCityLabel !== "موقعك الحالي" && cleanCityLabel !== "كل مصر"
      ? `/explore?city=${encodeURIComponent(cleanCityLabel)}`
      : "/explore";

  const visibleCoaches = useMemo(
    () =>
      sortCoachesWithVerificationPriority(
        effectiveCoaches.filter((c) => c.sportSector !== "fitness"),
        userLocation
      ),
    [effectiveCoaches, userLocation]
  );

  const totalFacilitiesCount = partitioned.allSorted.length;
  const shownFacilitiesCount = homeSuggestions.length;

  const facilitiesSubtitleAr = useMemo(() => {
    if (isFacilitiesLoading) {
      return "جاري تحميل المسابح والأكاديميات الموثقة في نطاقك...";
    }
    if (shownFacilitiesCount === 0) {
      return selectedCat === "all"
        ? "لا توجد منشآت مسجّلة في هذا النطاق حالياً — يمكنك استكشاف الخريطة أو تسجيل منشأتك مجاناً"
        : "لا توجد نتائج مطابقة لهذا التصنيف حالياً — جرّب تصنيف «الكل» أو سجّل منشأتك مجاناً";
    }
    if (shownFacilitiesCount === 1) {
      return userLocation.isSpecified
        ? `يتم عرض منشأة واحدة متاحة حالياً في ${cleanCityLabel} — يمكنك تحديث الترشيحات أو التصفح الكامل`
        : "يتم عرض منشأة واحدة مسجّلة حالياً في مصر — حدّد موقعك أو سجّل منشأتك مجاناً";
    }
    if (shownFacilitiesCount === 2) {
      return userLocation.isSpecified
        ? `يتم عرض أقرب منشأتين لنطاقك في ${cleanCityLabel} — اضغط للتحديث أو التصفح الكامل`
        : "يتم عرض منشأتين مسجّلتين من مصر — حدّد موقعك لترتيب الأقرب لك";
    }
    return userLocation.isSpecified
      ? `يتم عرض أقرب ${shownFacilitiesCount} مسابح وأكاديميات لنطاقك الجغرافي — اضغط للتحديث أو التصفح الكامل`
      : `تظهر ${shownFacilitiesCount} منشآت متنوعة من مختلف محافظات مصر — حدّد موقعك لترتيب الأقرب لك`;
  }, [isFacilitiesLoading, shownFacilitiesCount, selectedCat, userLocation.isSpecified, cleanCityLabel]);

  const showFacilityCtaInGrid = !isFacilitiesLoading && shownFacilitiesCount < 3;
  const facilitiesGridClass =
    shownFacilitiesCount <= 1 ? "grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop" : "grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop";

  const coachesGridClass =
    visibleCoaches.length === 1
      ? "grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop"
      : visibleCoaches.length === 2
      ? "grid grid-cols-1 sm:grid-cols-2 gap-gutter-desktop"
      : visibleCoaches.length === 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop";

  const categories: { key: HomeCategoryKey; label: string; icon?: string }[] = [
    {
      key: "all",
      label:
        totalFacilitiesCount > 0
          ? `الكل (${totalFacilitiesCount} مسبح وأكاديمية)`
          : "الكل",
    },
    { key: "swimming", label: "مدارس السباحة", icon: "pool" },
    { key: "kids", label: "أطفال وتأسيس", icon: "child_care" },
    { key: "heated", label: "مسابح مدفأة شتاءً", icon: "thermostat" },
    { key: "ladies", label: "مواعيد للسيدات", icon: "female" },
  ];

  const handleCompareNotice = (msg: string) => {
    setCompareNotice(msg);
    setTimeout(() => setCompareNotice(null), 3500);
  };

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0F172A] antialiased selection:bg-[#EAF4F8] selection:text-[#1D6E7D]">
      <div className="w-full bg-[#F7F9FA] min-h-screen pt-6">
        <div className="flex flex-col w-full">
          <div className="max-w-[1280px] w-full mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-xl">
            {/* Hero — Option B Deep Ocean Teal & Ice Aqua Luxury Bright Architecture */}
            <section className="relative w-full rounded-[24px] bg-white border border-[#0F172A]/6 overflow-hidden shadow-[0_12px_40px_rgba(15,23,42,0.05)] p-5 lg:p-7">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#EAF4F8]/80 blur-3xl"
              />
              <div className="relative z-10 grid grid-cols-12 gap-6 lg:gap-8 min-h-[340px] items-center">
                <div className="col-span-12 lg:col-span-7 flex flex-col justify-center gap-5 p-2 lg:p-4">
                  <h1 className="font-hero-headline text-hero-headline text-[#0F172A] leading-tight max-w-xl">
                    اكتشف أفضل الأندية والمدارس الرياضية الموثقة حولك في مصر
                  </h1>
                  <div className="flex flex-wrap items-center gap-2.5 text-[#0F172A] font-body-compact text-[12.5px]">
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 font-bold">
                      <Icon name="check_circle" className="text-[16px] text-[#1D6E7D]" />
                      <span>أسعار واضحة دون عمولات وساطة</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 font-bold">
                      <Icon name="workspace_premium" className="text-[16px] text-[#1D6E7D]" />
                      <span>كباتن مسجلون وموثقون بالشارات</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 font-bold">
                      <Icon name="qr_code_2" className="text-[16px] text-[#1D6E7D]" />
                      <span>دفتر حصص QR أوفلاين</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      className="inline-flex items-center justify-center gap-2 px-7 h-12 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title text-card-title transition-all shadow-[0_8px_20px_rgba(29,110,125,0.22)]"
                      href="/explore"
                    >
                      <span>استكشف المنشآت القريبة منك</span>
                      <Icon name="arrow_back" className="text-[20px]" />
                    </Link>
                    <Link
                      href={
                        isFacilityManager
                          ? "/dashboard/facility"
                          : isCoachRole
                          ? "/dashboard/coach"
                          : isAthleteOrParent
                          ? "/dashboard/athlete"
                          : "/claim"
                      }
                      className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-white border border-[#0F172A]/12 text-[#0F172A] hover:border-[#1D6E7D] hover:text-[#1D6E7D] font-card-title-sm transition-all"
                    >
                      <span>
                        {isFacilityManager
                          ? "إدارة منشأتك والمشتركين"
                          : isCoachRole
                          ? "لوحة الكابتن والشهادات"
                          : isAthleteOrParent
                          ? "حسابي ودفتر الحصص"
                          : "وثّق ناديك أو سجّل ككابتن"}
                      </span>
                    </Link>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 h-[340px] rounded-[20px] relative overflow-hidden hidden lg:block border border-[#0F172A]/6">
                  <CaptenlyImage
                    src="/screens/2c0d763d9374.jpg"
                    alt="حوض سباحة أولمبي معتمد"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/45 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-3.5 right-3.5 z-20 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md shadow-sm text-[11px] font-bold text-[#1D6E7D] flex items-center gap-1.5">
                    <Icon name="pool" className="text-[14px]" />
                    <span>حوض أولمبي معتمد</span>
                  </div>
                  <div className="absolute bottom-3.5 left-3.5 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-[#0F172A]/5">
                    <Icon name="thermostat" className="text-[18px] text-[#1D6E7D]" />
                    <div className="flex flex-col">
                      <span className="font-micro-caption text-[10px] text-[#64748B]">
                        معايير التدفئة والأمان
                      </span>
                      <span className="font-badge-label text-xs font-extrabold text-[#0F172A]">
                        فحص 28.5°C شتاءً
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Category Filters */}
            <section className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-section-title text-section-title text-[#0F172A]">
                  التصنيفات الرياضية المتاحة
                </h2>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 font-body-compact text-body-compact text-[#1D6E7D] font-bold hover:underline cursor-pointer"
                >
                  <Icon name="location_on" className="text-[16px]" />
                  <span>
                    {userLocation.isSpecified
                      ? `النطاق الحالي: ${userLocation.city}، ${userLocation.governorate} (تغيير)`
                      : "النطاق الحالي: كل مصر — اضغط لتحديد مدينتك"}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-space-xs overflow-x-auto pb-2 scrollbar-none" id="categoryFilters">
                {categories.map((cat) => {
                  const active = selectedCat === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCat(cat.key)}
                      className={`px-4 py-2.5 rounded-full font-badge-label text-badge-label transition-all shrink-0 flex items-center gap-1.5 border ${
                        active
                          ? "bg-[#1D6E7D] border-[#1D6E7D] text-white shadow-sm"
                          : "bg-white border-[#0F172A]/8 text-[#475569] hover:bg-[#EAF4F8] hover:text-[#1D6E7D]"
                      }`}
                    >
                      {cat.icon && <Icon name={cat.icon} className="text-[15px]" />}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Facilities Grid */}
            <section className="flex flex-col gap-space-md" id="explore">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    {userLocation.isSpecified
                      ? `مقترحات السباحة القريبة منك في ${cleanCityLabel}`
                      : "أندية وأكاديميات السباحة المقترحة في مصر"}
                  </h2>
                  <p className="font-body-compact text-body-compact text-text-muted mt-0.5">
                    {facilitiesSubtitleAr}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRotationSeed((prev) => prev + 1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-[#0F172A]/10 text-[#0F172A] hover:border-[#1D6E7D] hover:text-[#1D6E7D] text-xs font-bold transition-colors"
                  >
                    <Icon name="refresh" className="text-[15px]" />
                    <span>تحديث الترشيحات</span>
                  </button>
                  {compareFacilityIds.length > 0 && (
                    <Link
                      href="/compare"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D6E7D] text-white font-badge-label text-xs font-bold"
                    >
                      <Icon name="compare_arrows" className="text-[15px]" />
                      <span>جدول المقارنة ({compareFacilityIds.length} من 4)</span>
                    </Link>
                  )}
                  <Link
                    className="inline-flex items-center gap-1 font-card-title-sm text-card-title-sm text-deep-olive hover:underline"
                    href={exploreCityHref}
                  >
                    <span>
                      {userLocation.isSpecified
                        ? totalFacilitiesCount > 0
                          ? `عرض كل المسابح في ${cleanCityLabel} (${totalFacilitiesCount})`
                          : `عرض كل المسابح في ${cleanCityLabel}`
                        : totalFacilitiesCount > 0
                        ? `تصفح كل المسابح في مصر (${totalFacilitiesCount})`
                        : "تصفح كل المسابح في مصر"}
                    </span>
                    <Icon name="chevron_left" className="text-[16px]" />
                  </Link>
                </div>
              </div>

              {compareNotice && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-badge-label text-xs">
                  {compareNotice}
                </div>
              )}

              {isFacilitiesLoading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
                  {[1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="h-72 rounded-[20px] bg-surface-card border border-surface-container animate-pulse p-5 flex flex-col justify-between"
                    >
                      <div className="h-36 rounded-xl bg-surface-snow" />
                      <div className="space-y-2">
                        <div className="h-4 w-3/4 rounded bg-surface-snow" />
                        <div className="h-3 w-1/2 rounded bg-surface-snow" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isFacilitiesLoading && (homeSuggestions.length > 0 || showFacilityCtaInGrid) && (
                <div className={facilitiesGridClass}>
                  {homeSuggestions.map((facility) => (
                    <FacilityCard
                      key={facility.id}
                      facility={facility}
                      onSelectCompareFeedback={handleCompareNotice}
                    />
                  ))}

                  {homeSuggestions.length === 0 && (
                    <div className="bg-white rounded-[20px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="w-11 h-11 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center">
                          <Icon name="explore" className="text-[22px]" />
                        </div>
                        <h3 className="font-card-title text-[#0F172A]">
                          {selectedCat === "all"
                            ? `لا توجد منشآت مسجّلة في ${cleanCityLabel} بعد`
                            : `لا توجد نتائج مطابقة لتصنيف هذا القسم في ${cleanCityLabel}`}
                        </h3>
                        <p className="font-body-compact text-[#475569] leading-relaxed">
                          جرّب اختيار تصنيف «الكل» أو تصفح الخريطة الكاملة لاكتشاف أقرب المسابح والأكاديميات المتاحة.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedCat !== "all" && (
                          <button
                            type="button"
                            onClick={() => setSelectedCat("all")}
                            className="px-4 py-2 rounded-full bg-[#1D6E7D] text-white text-xs font-bold hover:bg-[#155460] transition-colors"
                          >
                            عرض جميع التصنيفات
                          </button>
                        )}
                        <Link
                          href={exploreCityHref}
                          className="px-4 py-2 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-bold hover:bg-[#d7ecf4] transition-colors"
                        >
                          فتح الخريطة والاستكشاف ←
                        </Link>
                      </div>
                    </div>
                  )}

                  {showFacilityCtaInGrid && (
                    <article className="rounded-[20px] bg-gradient-to-br from-[#EAF4F8] via-white to-[#F7F9FA] border border-[#1D6E7D]/20 p-6 shadow-[0_4px_20px_rgba(29,110,125,0.06)] flex flex-col justify-between gap-5">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#1D6E7D] border border-[#1D6E7D]/15 text-[11px] font-extrabold">
                            <Icon name={isAthleteOrParent ? "map" : "verified"} className="text-[14px]" />
                            <span>{isAthleteOrParent ? "اكتشاف أوسع" : "0% عمولة وساطة"}</span>
                          </span>
                          <span className="w-10 h-10 rounded-2xl bg-[#1D6E7D] text-white flex items-center justify-center shrink-0">
                            <Icon
                              name={isFacilityManager ? "stadium" : isCoachRole ? "sports" : isAthleteOrParent ? "explore" : "add_business"}
                              className="text-[20px]"
                            />
                          </span>
                        </div>
                        <h3 className="font-card-title text-[#0F172A] leading-snug">
                          {isFacilityManager
                            ? "أضف فرعاً جديداً أو حدّث مواعيد منشأتك"
                            : isCoachRole
                            ? "اربط نشاطك التدريبي بأقرب مسبح مضيف"
                            : isAthleteOrParent
                            ? "استكشف الخريطة وقارن جميع المسابح"
                            : "أضف منشأتك أو طالب بصفحتك مجاناً"}
                        </h3>
                        <p className="font-body-compact text-[#475569] leading-relaxed">
                          {isFacilityManager
                            ? "أدر المشتركين، تسعير المياه، الكباتن المعتمدين ودفاتر حضور الـ QR الأوفلاين من لوحة واحدة."
                            : isCoachRole
                            ? "سجّل ربطك بالأندية المضيفة واظهر للسباحين والأهالي بالشارات الموثقة في نطاقك."
                            : isAthleteOrParent
                            ? "تصفح المسابح المدفأة ومواعيد السيدات وقارن الأسعار والباقات بشفافية كاملة."
                            : "هل تدير مسبحاً أو أكاديمية سباحة؟ سجّل صفحتك الموثقة وابدأ تفعيل دفاتر الحصص QR أوفلاين مجاناً."}
                        </p>
                      </div>
                      <Link
                        href={
                          isFacilityManager
                            ? "/dashboard/facility"
                            : isCoachRole
                            ? "/dashboard/coach"
                            : isAthleteOrParent
                            ? "/explore"
                            : "/claim"
                        }
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold transition-colors shadow-sm"
                      >
                        <span>
                          {isFacilityManager
                            ? "فتح لوحة المنشأة"
                            : isCoachRole
                            ? "إدارة الأندية المضيفة"
                            : isAthleteOrParent
                            ? "فتح صفحة الاستكشاف"
                            : "سجّل ووثّق منشأتك الآن"}
                        </span>
                        <Icon name="arrow_back" className="text-[16px]" />
                      </Link>
                    </article>
                  )}
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Link
                  href={exploreCityHref}
                  className="px-6 py-3 rounded-full bg-surface-card hover:bg-lime-tint text-dark-slate font-card-title-sm shadow-sm transition-colors border border-surface-container"
                >
                  {totalFacilitiesCount > homeSuggestions.length
                    ? `تصفح باقي المسابح والأكاديميات في ${cleanCityLabel} (${totalFacilitiesCount - homeSuggestions.length} إضافية) ←`
                    : `استكشف جميع مسابح وأكاديميات ${cleanCityLabel} على الخريطة ←`}
                </Link>
              </div>
            </section>

            {/* Coaches Section — Verified First, Registered Live Immediately */}
            {!(isAthleteOrParent && visibleCoaches.length === 0) && (
              <section className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="font-section-title text-section-title text-dark-slate">
                      نخبة الكباتن والمدربين على كابتنلي
                    </h2>
                    <p className="font-body-compact text-body-compact text-text-muted mt-0.5">
                      يتصدر الترتيب الكباتن الموثقون بالشارات الخضراء، مع ظهور جميع الكباتن المسجلين مباشرة.
                    </p>
                  </div>
                  {!isAthleteOrParent && (
                    <Link
                      href={isFacilityManager ? "/dashboard/facility" : isCoachRole ? "/dashboard/coach" : "/claim?mode=coach"}
                      className="px-4 py-2 rounded-full bg-lime-tint text-deep-olive font-badge-label text-badge-label hover:brightness-95"
                    >
                      {isFacilityManager ? "إدارة كباتن منشأتك" : isCoachRole ? "ملفك في لوحة الكابتن" : "+ سجّل ووثّق ككابتن الآن"}
                    </Link>
                  )}
                </div>

                {visibleCoaches.length > 0 ? (
                  <div className={coachesGridClass}>
                    {visibleCoaches.map((coach) => (
                      <VerifiedCoachCard key={coach.id} coach={coach} />
                    ))}
                    {visibleCoaches.length === 1 && (
                      <article className="rounded-[20px] bg-gradient-to-br from-[#EAF4F8] via-white to-[#F7F9FA] border border-[#1D6E7D]/20 p-6 shadow-sm flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-2.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#1D6E7D] border border-[#1D6E7D]/15 text-[11px] font-extrabold w-fit">
                            <Icon name="verified" className="text-[14px]" />
                            <span>{isAthleteOrParent ? "دليل الكباتن" : "توثيق مجاني للكباتن"}</span>
                          </span>
                          <h3 className="font-card-title text-[#0F172A]">
                            {isFacilityManager
                              ? "أضف كباتن منشأتك ليظهروا هنا"
                              : isAthleteOrParent
                              ? "تصفح الدليل الكامل للكباتن المعتمدين"
                              : "هل أنت كابتن سباحة أو إنقاذ مائي؟"}
                          </h3>
                          <p className="font-body-compact text-[#475569] leading-relaxed">
                            {isFacilityManager
                              ? "أدرج مدربي السباحة المعتمدين في منشأتك وشهاداتهم ليتمكن الأهالي من متابعتهم."
                              : isAthleteOrParent
                              ? "استعرض التخصصات والشهادات المعتمدة وقارن المدربين في مختلف محافظات مصر."
                              : "سجّل برقم هاتفك ووثّق شهادات النقابة والاتحاد للحصول على الشارات الخضراء وظهور ملفك للأهالي مجاناً."}
                          </p>
                        </div>
                        <Link
                          href={
                            isFacilityManager
                              ? "/dashboard/facility"
                              : isAthleteOrParent
                              ? "/coaches"
                              : isCoachRole
                              ? "/dashboard/coach"
                              : "/claim?mode=coach"
                          }
                          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold transition-colors"
                        >
                          <span>
                            {isFacilityManager
                              ? "إدارة كباتن المنشأة"
                              : isAthleteOrParent
                              ? "عرض كل الكباتن"
                              : isCoachRole
                              ? "لوحة الكابتن"
                              : "وثّق ملفك ككابتن الآن"}
                          </span>
                          <Icon name="arrow_back" className="text-[16px]" />
                        </Link>
                      </article>
                    )}
                  </div>
                ) : (
                  <div className="bg-surface-card rounded-[20px] p-8 shadow-sm border border-surface-container flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
                        <Icon name="verified" className="text-[24px]" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-card-title text-dark-slate">
                          {isFacilityManager
                            ? "يمكنك إضافة وتوثيق كباتن منشأتك مباشرة"
                            : "مساحة الكباتن الموثقين مفتوحة للانضمام المباشر"}
                        </h3>
                        <p className="font-body-compact text-text-muted max-w-2xl">
                          {isFacilityManager
                            ? "من داخل تبويب «كباتن الأكاديمية والشهادات» في لوحة منشأتك يمكنك إدراج مدربي السباحة والإنقاذ المعتمدين وتحديد التخصصات والشهادات ليظهروا للمشتركين."
                            : "سياسة كابتنلي تمنع نشر أي بروفايل مدرب من الفراغ. إذا كنت كابتن سباحة أو إنقاذ مائي، سجّل برقم هاتفك وارفع مرجع نقابة المهن الرياضية أو شهادة الاتحاد للحصول على الشارات الخضراء وظهور ملفك للأهالي والسباحين مجاناً."}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={isFacilityManager ? "/dashboard/facility" : "/claim?mode=coach"}
                      className="px-6 py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm shrink-0 transition-colors shadow-sm"
                    >
                      {isFacilityManager ? "أضف كباتن المنشأة الآن" : "وثّق ملفك ككابتن الآن"}
                    </Link>
                  </div>
                )}
              </section>
            )}

            {/* 3-Step Visual Offline QR Ledger Journey */}
            <section
              aria-labelledby="qr-journey-heading"
              className="rounded-[24px] bg-gradient-to-br from-[#EAF4F8] via-white to-[#F7F9FA] border border-[#1D6E7D]/18 p-6 lg:p-8 shadow-[0_8px_32px_rgba(29,110,125,0.06)] flex flex-col gap-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#1D6E7D] border border-[#1D6E7D]/20 text-[11px] font-extrabold w-fit">
                    <Icon name="qr_code_2" className="text-[15px]" />
                    <span>يعمل أوفلاين عند المسبح (PWA + IndexedDB)</span>
                  </span>
                  <h2 id="qr-journey-heading" className="font-section-title text-section-title text-[#0F172A]">
                    كيف يعمل دفتر الحصص QR أوفلاين في 3 خطوات؟
                  </h2>
                  <p className="font-body-compact text-body-compact text-[#475569] max-w-2xl">
                    نظام متكامل لمتابعة رصيد الحصص بين السباح وولي الأمر والكابتن والمنشأة حتى داخل الصالات المغطاة بدون شبكة إنترنت.
                  </p>
                </div>
                <Link
                  href="/dashboard/ledger"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F4C5C] hover:bg-[#1D6E7D] text-white text-xs font-extrabold transition-colors shrink-0 w-fit shadow-sm"
                >
                  <Icon name="qr_code_scanner" className="text-[17px]" />
                  <span>افتح دفتر الحصص الآن</span>
                </Link>
              </div>

              <ol className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
                {[
                  {
                    step: "01",
                    icon: "badge",
                    tag: "كود عضوية فريد CAP-M-*",
                    title: "سجّل واستلم كود عضويتك وبطاقة QR",
                    desc: "أنشئ حسابك مجاناً في ثوانٍ (أو أضف أبناءك) للحصول على كود عضوية دائم وباركود QR جاهز للمسح أو الطباعة.",
                  },
                  {
                    step: "02",
                    icon: "qr_code_2",
                    tag: "0% عمولة وساطة",
                    title: "فعّل باقتك مع الكابتن أو إدارة المسبح",
                    desc: "شارك كود العضوية عند الاشتراك ليصدر لك دفتر حصص مستقل يعرض عدد الحصص وتفاصيل المياه والتدريب بشفافية.",
                  },
                  {
                    step: "03",
                    icon: "wifi_off",
                    tag: "مزامنة سحابية تلقائية",
                    title: "امسح الحضور أوفلاين عند بوابة المسبح",
                    desc: "يُخصم الحضور لحظياً بالـ QR أو كود الاشتراك حتى بدون إنترنت بالمسبح، وتُحفظ العملية وتُزامن تلقائياً عند عودة الشبكة.",
                  },
                ].map((item) => (
                  <li
                    key={item.step}
                    className="bg-white rounded-[20px] p-5 border border-[#0F172A]/8 shadow-[0_4px_16px_rgba(15,23,42,0.03)] flex flex-col gap-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-[#1D6E7D] text-white font-mono text-xs font-black flex items-center justify-center shrink-0">
                          {item.step}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[10px] font-extrabold">
                          {item.tag}
                        </span>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-[#F7F9FA] text-[#1D6E7D] flex items-center justify-center shrink-0 border border-[#0F172A]/6">
                        <Icon name={item.icon} className="text-[19px]" />
                      </div>
                    </div>
                    <h3 className="font-card-title-sm text-[#0F172A] leading-snug">{item.title}</h3>
                    <p className="font-body-compact text-[#475569] leading-relaxed">{item.desc}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* 6 Pillars */}
            <section className="bg-surface-card rounded-[20px] p-space-xl shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm mb-space-lg">
                <div>
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    ضمانات كابتنلي الميدانية الـ 6
                  </h2>
                  <p className="font-body-compact text-body-compact text-text-muted">
                    معايير التوثيق التي تمنح الثقة للمتدرب وولي الأمر دون رسوم مستترة
                  </p>
                </div>
                <Link
                  href="/badges"
                  className="font-card-title-sm text-card-title-sm text-deep-olive flex items-center gap-1 hover:underline"
                >
                  <Icon name="security" className="text-[18px]" />
                  <span>تفاصيل نظام الشارات الـ 6</span>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
                {[
                  {
                    icon: "badge",
                    title: "1. التحقق من الهوية ورقم الهاتف",
                    desc: "مطابقة هوية المدرب ومسؤولي المنشأة برقم الهاتف والوثائق الرسمية.",
                  },
                  {
                    icon: "school",
                    title: "2. اعتماد النقابة والاتحادات",
                    desc: "توثيق قيد نقابة المهن الرياضية أو شهادات الاتحاد المصري للسباحة.",
                  },
                  {
                    icon: "water",
                    title: "3. فحص تدفئة ونقاء المسابح",
                    desc: "توضيح مواصفات المسبح المدفأ شتاءً، التغطية، ومواعيد السيدات المستقلة.",
                  },
                  {
                    icon: "payments",
                    title: "4. أسعار واضحة و 0% عمولة",
                    desc: "شفافية كاملة للباقات وتكاليف الاشتراك مع 0% عمولة وساطة من كابتنلي.",
                  },
                  {
                    icon: "qr_code_2",
                    title: "5. دفتر حصص QR يعمل أوفلاين",
                    desc: "تفعيل رصيد الحصص بكود العضوية مع تسجيل الحضور حتى بدون إنترنت بالمسبح.",
                  },
                  {
                    icon: "medical_services",
                    title: "6. السلامة المهنية ومعايير الإنقاذ",
                    desc: "التزام مهني واضح بنطاق التدريب الرياضي والإنقاذ المائي والإسعافات الأولية.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-space-sm items-start p-space-md rounded-xl bg-surface-snow">
                    <div className="w-10 h-10 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
                      <Icon name={item.icon} className="text-[20px]" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-card-title-sm text-card-title-sm text-dark-slate">{item.title}</h3>
                      <p className="font-body-compact text-body-compact text-text-muted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Latest Articles */}
            <section className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    أحدث الأدلة الرياضية من مجلة كابتنلي{articles.length > 0 ? ` (${articles.length})` : ""}
                  </h2>
                  <p className="font-body-compact text-body-compact text-text-muted mt-0.5">
                    مقالات توعوية لإرشاد الرياضيين وأولياء الأمور لاختيار التدريب الأنسب
                  </p>
                </div>
                <Link
                  className="inline-flex items-center gap-1 font-card-title-sm text-card-title-sm text-deep-olive hover:underline"
                  href="/magazine"
                >
                  <span>تصفح كل مقالات المجلة</span>
                  <Icon name="chevron_left" className="text-[16px]" />
                </Link>
              </div>
              <div
                className={
                  articles.slice(0, 3).length <= 2
                    ? "grid grid-cols-1 md:grid-cols-2 gap-gutter-desktop"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop"
                }
              >
                {articles.slice(0, 3).map((art) => {
                  const saved = isFavorite(art.id);
                  return (
                    <article
                      key={art.id}
                      className="bg-surface-card rounded-[16px] overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow"
                    >
                      <div>
                        {art.imageUrl ? (
                          <div className="relative w-full h-44 overflow-hidden bg-[#EAF4F8]">
                            <Link href={`/magazine/${art.slug}`} className="block relative w-full h-full">
                              <CaptenlyImage
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                alt={art.titleAr}
                                src={art.imageUrl}
                              />
                            </Link>
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-[#1D6E7D] font-badge-label text-[11px] font-bold shadow-sm">
                              {art.categoryAr}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleFavorite(art.id)}
                              aria-label="حفظ المقال"
                              className={`absolute top-3 left-3 w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-colors shadow-sm ${
                                saved
                                  ? "bg-[#1D6E7D] text-white"
                                  : "bg-white/90 text-[#0F172A] hover:text-[#1D6E7D]"
                              }`}
                            >
                              <Icon name={saved ? "bookmark" : "bookmark_border"} className="text-[18px]" />
                            </button>
                          </div>
                        ) : (
                          <div className="px-space-md pt-space-md flex items-center justify-between gap-2">
                            <div className="px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] font-badge-label text-[11px] font-bold">
                              {art.categoryAr}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleFavorite(art.id)}
                              aria-label="حفظ المقال"
                              className={`w-8 h-8 rounded-full border border-[#0F172A]/8 flex items-center justify-center transition-colors ${
                                saved
                                  ? "bg-[#1D6E7D] text-white"
                                  : "bg-[#F7F9FA] text-[#0F172A] hover:text-[#1D6E7D]"
                              }`}
                            >
                              <Icon name={saved ? "bookmark" : "bookmark_border"} className="text-[18px]" />
                            </button>
                          </div>
                        )}
                        <div className="p-space-md flex flex-col gap-2">
                          <div className="flex items-center justify-between text-text-muted font-micro-caption text-micro-caption">
                            <span>{art.authorNameAr}</span>
                            <span className="flex items-center gap-1">
                              <Icon name="schedule" className="text-[14px]" /> قراءة {art.readingMinutes} دقائق
                            </span>
                          </div>
                          <Link href={`/magazine/${art.slug}`}>
                            <h3 className="font-card-title text-card-title text-dark-slate leading-snug group-hover:text-deep-olive transition-colors">
                              {art.titleAr}
                            </h3>
                          </Link>
                          <p className="font-body-compact text-body-compact text-text-muted line-clamp-2">
                            {art.excerptAr}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/magazine/${art.slug}`}
                        className="px-space-md pb-space-md pt-1 flex items-center justify-between font-body-compact text-body-compact text-deep-olive font-bold"
                      >
                        <span>اقرأ الدليل الكامل</span>
                        <Icon name="arrow_back" className="text-[18px]" />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Bottom Claim CTA (hidden for logged-in athletes/parents; they can upgrade quietly from Settings) */}
            {!isAthleteOrParent && (
              <section className="rounded-[24px] bg-gradient-to-br from-[#EAF4F8] via-[#F7F9FA] to-white border border-[#1D6E7D]/15 p-space-xl flex flex-col md:flex-row items-center justify-between gap-space-md shadow-[0_8px_30px_rgba(29,110,125,0.06)]">
                <div className="flex items-center gap-space-md">
                  <div className="w-12 h-12 rounded-2xl bg-[#1D6E7D] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Icon name={isFacilityManager ? "stadium" : "sports_score"} className="text-[24px]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-card-title text-card-title text-[#0F172A]">
                      {isFacilityManager
                        ? "أدر منشأتك ومواعيد مدارس السباحة والمشتركين"
                        : "هل أنت كابتن أو صاحب نادي / أكاديمية رياضية؟"}
                    </h3>
                    <p className="font-body-compact text-body-compact text-[#475569]">
                      {isFacilityManager
                        ? "حدّث كروت المواعيد، أضف طاقم الكباتن وموظفي الاشتراكات، وامسح رموز QR الحصص بـ 0% عمولة."
                        : "طالب بإدارة صفحتك أو سجّل ككابتن معتمد مجاناً، واربط السباحين بكود العضوية لتفعيل دفاتر الـ QR بدون عمولة."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-space-sm shrink-0">
                  <Link
                    className="px-7 py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm text-card-title-sm transition-colors shadow-sm"
                    href={isFacilityManager ? "/dashboard/facility" : isCoachRole ? "/dashboard/coach" : "/claim"}
                  >
                    {isFacilityManager
                      ? "افتح لوحة المنشأة الآن"
                      : isCoachRole
                      ? "افتح لوحة الكابتن"
                      : "طالب بصفحتك ووثّقها مجاناً"}
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
