"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";
import { sortCoachesWithVerificationPriority } from "@/lib/coachSearch";
import { CaptenlyImage } from "@/components/CaptenlyImage";
import type { Coach, Facility } from "@/types/captenly";

type MobileCat = "all" | "swimming" | "kids" | "heated" | "ladies";

interface Phone21Props {
  initialFacilities?: Facility[];
  initialCoaches?: Coach[];
  omitHero?: boolean;
  controlledCat?: MobileCat;
}

export default function Phone21({
  initialFacilities = [],
  initialCoaches = [],
  omitHero = false,
  controlledCat,
}: Phone21Props = {}) {
  const router = useRouter();
  const {
    facilities,
    coaches,
    articles,
    compareFacilityIds,
    isFavorite,
    toggleFavorite,
    setFilterModalOpen,
    userLocation,
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

  const [q, setQ] = useState("");
  const [catState, setCat] = useState<MobileCat>("all");
  const cat = controlledCat ?? catState;
  const [toast, setToast] = useState<string | null>(null);
  const [rotationSeed, setRotationSeed] = useState<number>(0);

  useEffect(() => {
    setRotationSeed(0);
  }, [userLocation.isSpecified, userLocation.city, userLocation.lat, userLocation.lng]);

  useEffect(() => {
    if (userLocation.isSpecified) return;
    const timer = setInterval(() => {
      setRotationSeed((prev) => prev + 1);
    }, 45000);
    return () => clearInterval(timer);
  }, [userLocation.isSpecified]);
  const articlesRailRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ down: boolean; startX: number; scrollLeft: number }>({
    down: false,
    startX: 0,
    scrollLeft: 0,
  });

  const scrollArticlesBy = (dir: "next" | "prev") => {
    const el = articlesRailRef.current;
    if (!el) return;
    // In RTL, scrolling toward older/more articles is negative scrollLeft
    const step = 285;
    el.scrollBy({ left: dir === "next" ? -step : step, behavior: "smooth" });
  };

  const effectiveFacilities = facilities.length > 0 ? facilities : initialFacilities;
  const effectiveCoaches = coaches.length > 0 ? coaches : initialCoaches;
  const isFacilitiesLoading =
    (placesHydrating || !publicSupplyHydrated) && effectiveFacilities.length === 0;

  const swimmingFacilities = useMemo(
    () => effectiveFacilities.filter((f) => f.sportSector !== "fitness"),
    [effectiveFacilities]
  );

  const filtered = useMemo(() => {
    return swimmingFacilities.filter((f) => {
      if (cat === "swimming") return f.sportSector !== "fitness";
      if (cat === "ladies") {
        return Boolean(f.poolSpecs?.hasLadiesOnlySlots);
      }
      if (cat === "kids") {
        return f.specialtiesAr.some((s) => s.includes("أطفال") || s.includes("تأسيس"));
      }
      if (cat === "heated") return Boolean(f.poolSpecs?.isHeatedWinter);
      return true;
    });
  }, [swimmingFacilities, cat]);

  const partitioned = useMemo(
    () =>
      partitionFacilities3Tier(filtered, rotationSeed, {
        lat: userLocation.lat,
        lng: userLocation.lng,
        city: userLocation.city,
        isSpecified: userLocation.isSpecified,
        maxDistanceKm: userLocation.isSpecified ? smartFilters.maxDistanceKm : undefined,
      }),
    [filtered, rotationSeed, userLocation.lat, userLocation.lng, userLocation.city, userLocation.isSpecified, smartFilters.maxDistanceKm]
  );

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
      return "جاري تحميل المسابح والأكاديميات القريبة...";
    }
    if (shownFacilitiesCount === 0) {
      return cat === "all"
        ? "لا توجد منشآت مسجّلة في هذا النطاق حالياً — استكشف الخريطة أو سجّل منشأتك"
        : "لا توجد نتائج مطابقة لهذا التصنيف — جرّب «الكل» أو سجّل منشأتك";
    }
    if (shownFacilitiesCount === 1) {
      return userLocation.isSpecified
        ? `منشأة واحدة متاحة حالياً في ${cleanCityLabel}`
        : "منشأة واحدة مسجّلة حالياً في مصر — حدّد مدينتك للأقرب";
    }
    if (shownFacilitiesCount === 2) {
      return userLocation.isSpecified
        ? `أقرب منشأتين لنطاقك في ${cleanCityLabel}`
        : "منشأتان مسجّلتان من مصر — حدّد مدينتك للأقرب";
    }
    return userLocation.isSpecified
      ? `أقرب ${shownFacilitiesCount} مسابح وأكاديميات لنطاقك الجغرافي`
      : `تظهر ${shownFacilitiesCount} منشآت متنوعة من مختلف المحافظات`;
  }, [isFacilitiesLoading, shownFacilitiesCount, cat, userLocation.isSpecified, cleanCityLabel]);

  const cats: { key: MobileCat; label: string; icon?: string }[] = [
    { key: "all", label: totalFacilitiesCount > 0 ? `الكل (${totalFacilitiesCount})` : "الكل" },
    { key: "swimming", label: "سباحة", icon: "pool" },
    { key: "kids", label: "تأسيس أطفال", icon: "child_care" },
    { key: "heated", label: "مدفأ شتاءً", icon: "thermostat" },
    { key: "ladies", label: "ساعات سيدات", icon: "female" },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
  };

  return (
    <div
      className={
        omitHero
          ? "font-body-default text-[#0F172A] px-margin pb-24 flex flex-col gap-5"
          : "screen-root bg-[#F7F9FA] font-body-default text-[#0F172A] min-h-screen px-margin pt-4 pb-24 flex flex-col gap-5"
      }
    >
      {!omitHero && (
        <>
          {/* Mobile Search + Filter Pill */}
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 bg-white rounded-full px-3.5 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.04)] border border-[#0F172A]/8"
          >
            <Icon name="search" className="text-[#64748B] text-[18px] shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن كابتن سباحة، نادي، أو مسبح..."
              className="flex-1 min-w-0 bg-transparent outline-none text-xs text-[#0F172A] placeholder:text-[#64748B]"
            />
            <button
              type="button"
              onClick={() => setFilterModalOpen(true)}
              aria-label="فلاتر البحث"
              className="w-8 h-8 rounded-full bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center shrink-0"
            >
              <Icon name="tune" className="text-[16px]" />
            </button>
          </form>

          {/* Scrollable Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-margin px-margin">
            {cats.map((item) => {
              const active = cat === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCat(item.key)}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-all border ${
                    active
                      ? "bg-[#1D6E7D] border-[#1D6E7D] text-white shadow-sm"
                      : "bg-white border-[#0F172A]/8 text-[#475569] hover:text-[#1D6E7D]"
                  }`}
                >
                  {item.icon && <Icon name={item.icon} className="text-[14px]" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Bright Photo-First Mobile Hero Card — Option B Luxury */}
          <section className="rounded-[24px] bg-white border border-[#0F172A]/6 overflow-hidden shadow-[0_8px_28px_rgba(15,23,42,0.05)] flex flex-col">
            <div className="relative h-44 w-full overflow-hidden bg-[#EAF4F8]">
              <CaptenlyImage
                src="/screens/2c0d763d9374.jpg"
                alt="حوض سباحة أولمبي معتمد"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/25 via-transparent to-transparent pointer-events-none" />
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-[#1D6E7D] text-[11px] font-bold shadow-sm inline-flex items-center gap-1">
                <Icon name="thermostat" className="text-[13px]" />
                <span>فحص 28.5°C شتاءً</span>
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <h1 className="font-hero-headline-mobile text-hero-headline-mobile text-[#0F172A] leading-snug">
                اكتشف أفضل الأندية والمدارس الرياضية حولك
              </h1>
              <p className="text-xs text-[#475569] leading-relaxed">
                أسعار واضحة، كباتن مسجلون ومعتمدون، ودفتر حصص QR يعمل أوفلاين عند المسبح.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/explore"
                  className="w-full py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <span>استكشف المنشآت القريبة منك</span>
                  <Icon name="arrow_back" className="text-[15px]" />
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
                  className="w-full py-2.5 rounded-full bg-white border border-[#0F172A]/12 text-[#0F172A] text-xs font-bold text-center hover:border-[#1D6E7D] hover:text-[#1D6E7D] transition-colors"
                >
                  {isFacilityManager
                    ? "لوحة إدارة منشأتك"
                    : isCoachRole
                    ? "لوحة الكابتن والشهادات"
                    : isAthleteOrParent
                    ? "حسابي ودفتر الحصص"
                    : "وثّق ناديك أو سجّل ككابتن"}
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Facilities Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-section-title-mobile text-section-title-mobile text-[#0F172A]">
              {userLocation.isSpecified
                ? `مقترحات قريبة في ${cleanCityLabel}`
                : "أندية ومسابح مقترحة في مصر"}
            </h2>
            <p className="text-[11px] text-[#64748B]">
              {facilitiesSubtitleAr}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {compareFacilityIds.length > 0 && (
              <Link
                href="/compare"
                className="px-3 py-1.5 rounded-full bg-[#1D6E7D] text-white text-[11px] font-bold shadow-xs"
              >
                قارن ({compareFacilityIds.length})
              </Link>
            )}
          </div>
        </div>

        {toast && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
            {toast}
          </div>
        )}

        {isFacilitiesLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="h-48 rounded-2xl bg-surface-card border border-surface-container animate-pulse" />
            ))}
          </div>
        )}

        {!isFacilitiesLoading && homeSuggestions.length > 0 && (
          <div className="flex flex-col gap-3">
            {homeSuggestions.map((fac) => (
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

        {!isFacilitiesLoading && shownFacilitiesCount < 3 && (
          <article className="rounded-[20px] bg-gradient-to-br from-[#EAF4F8] via-white to-[#F7F9FA] border border-[#1D6E7D]/20 p-4 shadow-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-[#1D6E7D] border border-[#1D6E7D]/15 text-[10px] font-extrabold">
                <Icon name={isAthleteOrParent ? "explore" : "verified"} className="text-[13px]" />
                <span>{isAthleteOrParent ? "اكتشاف أوسع" : "0% عمولة وساطة"}</span>
              </span>
              <span className="w-8 h-8 rounded-xl bg-[#1D6E7D] text-white flex items-center justify-center shrink-0">
                <Icon
                  name={isFacilityManager ? "stadium" : isCoachRole ? "sports" : isAthleteOrParent ? "map" : "add_business"}
                  className="text-[17px]"
                />
              </span>
            </div>
            <h3 className="font-card-title-sm text-sm text-[#0F172A]">
              {isFacilityManager
                ? "أضف فرعاً جديداً أو حدّث مواعيد منشأتك"
                : isCoachRole
                ? "اربط نشاطك بأقرب مسبح مضيف"
                : isAthleteOrParent
                ? "استكشف الخريطة الكاملة وقارن الباقات"
                : "أضف منشأتك أو طالب بصفحتك مجاناً"}
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              {isFacilityManager
                ? "أدر المشتركين وتسعير المياه ودفاتر حضور الـ QR الأوفلاين من لوحة واحدة."
                : isCoachRole
                ? "وثّق ربطك بالأندية المضيفة واظهر للسباحين بالشارات المعتمدة."
                : isAthleteOrParent
                ? "تصفح جميع المسابح المدفأة وساعات السيدات في نطاقك مباشرة."
                : "سجّل مسبحك أو أكاديميتك مجاناً وفعّل دفاتر حضور الـ QR بدون عمولة."}
            </p>
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
              className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold text-center shadow-xs transition-colors"
            >
              {isFacilityManager
                ? "فتح لوحة المنشأة"
                : isCoachRole
                ? "إدارة الأندية المضيفة"
                : isAthleteOrParent
                ? "فتح صفحة الاستكشاف ←"
                : "سجّل ووثّق منشأتك الآن ←"}
            </Link>
          </article>
        )}

        <Link
          href={exploreCityHref}
          className="w-full py-3 rounded-full bg-surface-card text-dark-slate text-xs font-bold text-center shadow-sm border border-surface-container"
        >
          {totalFacilitiesCount > homeSuggestions.length
            ? `تصفح باقي المسابح في ${cleanCityLabel} (${totalFacilitiesCount - homeSuggestions.length} إضافية) ←`
            : `عرض كل مسابح ${cleanCityLabel} والخريطة ←`}
        </Link>
      </section>

      {/* Coaches Section — Verified First, Registered Live Immediately */}
      {!(isAthleteOrParent && visibleCoaches.length === 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-section-title-mobile text-section-title-mobile text-dark-slate">
              الكباتن والمدربون
            </h2>
            <Link href="/coaches" className="text-xs font-bold text-deep-olive">
              عرض الدليل ←
            </Link>
          </div>

          {visibleCoaches.length > 0 ? (
            <div className="flex flex-col gap-3">
              {visibleCoaches.map((coach) => (
                <VerifiedCoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl p-5 shadow-sm border border-surface-container flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-deep-olive font-bold text-sm">
                <Icon name="verified" className="text-[18px]" />
                <span>
                  {isFacilityManager
                    ? "أضف كباتن منشأتك مباشرة"
                    : "لا نعرض أي كابتن دون توثيق فعلي"}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {isFacilityManager
                  ? "يمكنك من تبويب كباتن الأكاديمية في لوحة منشأتك إضافة مدربي السباحة والإنقاذ وشهاداتهم."
                  : "لا ننشر بروفايلات كباتن من الفراغ؛ يظهر الكابتن هنا فور تسجيله بنفسه برقم موبايله وتوثيق شهاداته للشارات الخضراء."}
              </p>
              <Link
                href={isFacilityManager ? "/dashboard/facility" : isCoachRole ? "/dashboard/coach" : "/claim?mode=coach"}
                className="px-4 py-2.5 rounded-full bg-[#1D6E7D] text-white text-xs font-bold w-fit shadow-xs"
              >
                {isFacilityManager ? "إدارة كباتن المنشأة" : isCoachRole ? "لوحة الكابتن" : "سجّل ووثّق ملفك ككابتن الآن"}
              </Link>
            </div>
          )}
        </section>
      )}

      {/* 3-Step Visual Offline QR Ledger Journey */}
      <section
        aria-labelledby="mobile-qr-journey-heading"
        className="rounded-[24px] bg-gradient-to-br from-[#EAF4F8] via-white to-[#F7F9FA] border border-[#1D6E7D]/18 p-4 shadow-sm flex flex-col gap-3.5"
      >
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-[#1D6E7D] border border-[#1D6E7D]/20 text-[10px] font-extrabold w-fit">
            <Icon name="qr_code_2" className="text-[13px]" />
            <span>يعمل أوفلاين عند المسبح (PWA + IndexedDB)</span>
          </span>
          <h2 id="mobile-qr-journey-heading" className="font-section-title-mobile text-section-title-mobile text-[#0F172A]">
            كيف يعمل دفتر الحصص QR أوفلاين في 3 خطوات؟
          </h2>
          <p className="text-xs text-[#475569] leading-relaxed">
            تتبّع رصيد حصصك بوضوح تام وسجّل حضورك على بوابة المسبح حتى بدون إنترنت.
          </p>
        </div>

        <ol className="flex flex-col gap-2.5">
          {[
            {
              step: "01",
              icon: "badge",
              title: "سجّل واستلم كود عضويتك وبطاقة QR",
              desc: "احصل على كود عضوية فريد (CAP-M-*) وباركود QR خاص بك وبأبنائك فور التسجيل المجاني.",
            },
            {
              step: "02",
              icon: "qr_code_2",
              title: "فعّل باقتك مع الكابتن أو المسبح بـ 0% عمولة",
              desc: "قدّم الكود عند الاشتراك ليُنشأ لك دفتر حصص مستقل بعدد الحصص وتفاصيل التكلفة.",
            },
            {
              step: "03",
              icon: "wifi_off",
              title: "امسح الحضور أوفلاين عند البوابة بمزامنة تلقائية",
              desc: "تُخصم الحصة لحظياً بالـ QR أو كود الاشتراك دون حاجة لشبكة بالمسبح وتُزامَن تلقائياً.",
            },
          ].map((item) => (
            <li
              key={item.step}
              className="rounded-2xl bg-white p-3.5 border border-[#0F172A]/8 flex items-start gap-3"
            >
              <span className="w-8 h-8 rounded-xl bg-[#1D6E7D] text-white font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                {item.step}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon name={item.icon} className="text-[15px] text-[#1D6E7D] shrink-0" />
                  <h3 className="font-card-title-sm text-xs text-[#0F172A]">{item.title}</h3>
                </div>
                <p className="text-[11px] text-[#475569] leading-relaxed mt-1">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <Link
          href="/dashboard/ledger"
          className="w-full py-2.5 rounded-full bg-[#0F4C5C] hover:bg-[#1D6E7D] text-white text-xs font-extrabold text-center flex items-center justify-center gap-1.5 transition-colors"
        >
          <Icon name="qr_code_scanner" className="text-[16px]" />
          <span>افتح دفتر الحصص الآن</span>
        </Link>
      </section>

      {/* Magazine Articles Carousel (All articles, swipe + drag + arrow buttons) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-section-title-mobile text-section-title-mobile text-dark-slate">
            أدلة مجلة كابتنلي{articles.length > 0 ? ` (${articles.length})` : ""}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollArticlesBy("prev")}
              aria-label="المقال السابق"
              className="w-7 h-7 rounded-full bg-surface-card border border-surface-container text-dark-slate flex items-center justify-center shadow-sm active:scale-95"
            >
              <Icon name="chevron_right" className="text-[16px]" />
            </button>
            <button
              type="button"
              onClick={() => scrollArticlesBy("next")}
              aria-label="المقال التالي"
              className="w-7 h-7 rounded-full bg-surface-card border border-surface-container text-dark-slate flex items-center justify-center shadow-sm active:scale-95"
            >
              <Icon name="chevron_left" className="text-[16px]" />
            </button>
            <Link href="/magazine" className="text-xs font-bold text-[#1D6E7D] mr-1">
              الكل ←
            </Link>
          </div>
        </div>

        <div
          ref={articlesRailRef}
          onMouseDown={(e) => {
            const el = articlesRailRef.current;
            if (!el) return;
            dragState.current = {
              down: true,
              startX: e.pageX - el.offsetLeft,
              scrollLeft: el.scrollLeft,
            };
          }}
          onMouseLeave={() => {
            dragState.current.down = false;
          }}
          onMouseUp={() => {
            dragState.current.down = false;
          }}
          onMouseMove={(e) => {
            const el = articlesRailRef.current;
            if (!dragState.current.down || !el) return;
            e.preventDefault();
            const x = e.pageX - el.offsetLeft;
            el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
          }}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth scrollbar-none cursor-grab active:cursor-grabbing select-none"
        >
          {articles.map((art) => {
            const fav = isFavorite(art.id);
            return (
              <article
                key={art.id}
                className="w-[276px] shrink-0 snap-start bg-white rounded-[20px] overflow-hidden shadow-sm border border-[#0F172A]/6 flex flex-col justify-between"
              >
                <div>
                  {art.imageUrl ? (
                    <div className="relative h-32">
                      <Link href={`/magazine/${art.slug}`} className="block relative w-full h-full">
                        <CaptenlyImage
                          src={art.imageUrl}
                          alt={art.titleAr}
                          fill
                          sizes="276px"
                          className="object-cover"
                        />
                      </Link>
                      <button
                        type="button"
                        aria-label={fav ? `إزالة ${art.titleAr} من المفضلة` : `حفظ ${art.titleAr} في المفضلة`}
                        onClick={() => toggleFavorite(art.id)}
                        className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center shadow ${
                          fav ? "bg-[#1D6E7D] text-white" : "bg-white/90 text-[#0F172A]"
                        }`}
                      >
                        <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[14px]" />
                      </button>
                    </div>
                  ) : (
                    <div className="px-3.5 pt-3.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D]">
                        {art.categoryAr}
                      </span>
                      <button
                        type="button"
                        aria-label={fav ? `إزالة ${art.titleAr} من المفضلة` : `حفظ ${art.titleAr} في المفضلة`}
                        onClick={() => toggleFavorite(art.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center border border-[#0F172A]/8 ${
                          fav ? "bg-[#1D6E7D] text-white" : "bg-[#F7F9FA] text-[#0F172A]"
                        }`}
                      >
                        <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[14px]" />
                      </button>
                    </div>
                  )}
                  <div className="p-3.5 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#1D6E7D]">{art.categoryAr}</span>
                    <Link href={`/magazine/${art.slug}`} className="font-card-title-sm text-xs text-[#0F172A] line-clamp-2">
                      {art.titleAr}
                    </Link>
                  </div>
                </div>
                <Link href={`/magazine/${art.slug}`} className="px-3.5 pb-3 text-[11px] font-bold text-[#1D6E7D]">
                  اقرأ الدليل ←
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* Bottom Mobile Claim Banner (hidden for logged-in athletes/parents) */}
      {!isAthleteOrParent && (
        <section className="rounded-[24px] bg-gradient-to-br from-[#EAF4F8] via-[#F7F9FA] to-white p-5 shadow-sm border border-[#1D6E7D]/15 flex flex-col gap-2.5">
          <h3 className="font-card-title-sm text-[#0F172A] font-extrabold">
            {isFacilityManager ? "أدر منشأتك وفريق الكباتن والمشتركين" : "هل أنت كابتن أو صاحب أكاديمية؟"}
          </h3>
          <p className="text-xs text-[#475569] leading-relaxed">
            {isFacilityManager
              ? "تابع مواعيد المدارس، فعّل اشتراكات الـ QR، ومنح صلاحيات الموظفين من لوحة المنشأة."
              : "طالب بإدارة صفحتك أو سجّل ككابتن معتمد مجاناً وفعّل دفاتر الـ QR لمشتركيك."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={isFacilityManager ? "/dashboard/facility" : isCoachRole ? "/dashboard/coach" : "/claim"}
              className="px-5 py-2.5 rounded-full bg-[#1D6E7D] text-white text-xs font-extrabold shadow-xs"
            >
              {isFacilityManager ? "افتح لوحة المنشأة" : isCoachRole ? "افتح لوحة الكابتن" : "طالب بصفحتك مجاناً"}
            </Link>
            <Link href="/about" className="px-4 py-2.5 rounded-full bg-white border border-[#0F172A]/10 text-[#0F172A] text-xs font-bold">
              عن المنصة
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
