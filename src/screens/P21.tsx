"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";

type MobileCat = "all" | "swimming" | "kids" | "heated" | "ladies";

export default function Phone21() {
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
    currentPersona,
    isAuthenticated,
  } = useCaptenly();

  const isFacilityManager = isAuthenticated && currentPersona.role === "facility_manager";
  const isCoachRole = isAuthenticated && currentPersona.role === "coach";

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MobileCat>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [rotationSeed, setRotationSeed] = useState<number>(() => Math.floor(Date.now() / 30000) % 24);

  useEffect(() => {
    const timer = setInterval(() => {
      setRotationSeed((prev) => prev + 1);
    }, 45000);
    return () => clearInterval(timer);
  }, []);
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

  const swimmingFacilities = useMemo(
    () => facilities.filter((f) => f.sportSector !== "fitness"),
    [facilities]
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
      }),
    [filtered, rotationSeed, userLocation.lat, userLocation.lng, userLocation.city, userLocation.isSpecified]
  );

  const homeSuggestions = useMemo(
    () => partitioned.allSorted.slice(0, 3),
    [partitioned.allSorted]
  );
  const homeFeatured = useMemo(
    () => homeSuggestions.filter((f) => Boolean(f.isFeaturedTier) && f.supplyStatus !== "seeded_unclaimed"),
    [homeSuggestions]
  );
  const homeRegistered = useMemo(
    () => homeSuggestions.filter((f) => f.supplyStatus !== "seeded_unclaimed" && !f.isFeaturedTier),
    [homeSuggestions]
  );
  const homeDirectory = useMemo(
    () => homeSuggestions.filter((f) => f.supplyStatus === "seeded_unclaimed"),
    [homeSuggestions]
  );
  const cleanCityLabel = userLocation.city.replace(/\s*\(GPS\)/g, "").trim();
  const exploreCityHref =
    userLocation.isSpecified && cleanCityLabel && cleanCityLabel !== "موقعك الحالي" && cleanCityLabel !== "كل مصر"
      ? `/explore?city=${encodeURIComponent(cleanCityLabel)}`
      : "/explore";

  const verifiedCoaches = useMemo(
    () => coaches.filter((c) => c.isVerifiedCoach && c.sportSector !== "fitness"),
    [coaches]
  );

  const cats: { key: MobileCat; label: string; icon?: string }[] = [
    { key: "all", label: `الكل (${swimmingFacilities.length})` },
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
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-5">
      {/* Mobile Search + Filter Pill */}
      <form
        onSubmit={handleSearch}
        className="flex items-center gap-2 bg-surface-card rounded-full px-3.5 py-2 shadow-sm border border-surface-container"
      >
        <Icon name="search" className="text-text-muted text-[18px] shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن كابتن سباحة، نادي، أو مسبح..."
          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-dark-slate"
        />
        <button
          type="button"
          onClick={() => setFilterModalOpen(true)}
          aria-label="فلاتر البحث"
          className="w-8 h-8 rounded-full bg-surface-snow text-dark-slate flex items-center justify-center shrink-0"
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
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-sm ${
                active ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-dark-slate"
              }`}
            >
              {item.icon && <Icon name={item.icon} className="text-[14px]" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Compact Mobile Hero Card */}
      <section className="relative rounded-[20px] bg-dark-slate text-surface-card overflow-hidden shadow-lg p-5 flex flex-col gap-3">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
          style={{ backgroundImage: "url('/screens/2c0d763d9374.jpg')" }}
        />
        <div className="relative z-10 flex flex-col gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-electric-volt text-dark-slate text-[11px] font-bold w-fit">
            منصتك الرياضية الموثقة • 0% عمولة
          </span>
          <h1 className="font-hero-headline-mobile text-hero-headline-mobile text-surface-card leading-snug">
            اكتشف أفضل الأندية والمدارس الرياضية حولك
          </h1>
          <p className="text-xs text-surface-container-high leading-relaxed">
            أسعار واضحة، كباتن معتمدون بالشارات الخضراء فقط، ودفتر حصص QR يعمل أوفلاين عند المسبح.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href="/explore"
              className="px-4 py-2.5 rounded-full bg-electric-volt text-dark-slate text-xs font-bold flex items-center gap-1"
            >
              <span>استكشف المنشآت</span>
              <Icon name="arrow_back" className="text-[15px]" />
            </Link>
            <Link
              href={
                isFacilityManager
                  ? "/dashboard/facility"
                  : isCoachRole
                  ? "/dashboard/coach"
                  : "/claim"
              }
              className="px-4 py-2.5 rounded-full bg-white/15 text-surface-card text-xs font-bold"
            >
              {isFacilityManager
                ? "لوحة إدارة منشأتك"
                : isCoachRole
                ? "لوحة الكابتن والشهادات"
                : "وثّق ناديك أو سجّل ككابتن"}
            </Link>
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-section-title-mobile text-section-title-mobile text-dark-slate">
              {userLocation.isSpecified
                ? `مقترحات قريبة في ${cleanCityLabel}`
                : "أندية ومسابح مقترحة في مصر"}
            </h2>
            <p className="text-[11px] text-text-muted">
              {userLocation.isSpecified
                ? "أقرب 3 مسابح وأكاديميات لنطاقك الجغرافي (تدوير تلقائي)"
                : "تظهر 3 منشآت متنوعة من مختلف المحافظات لعدم تحديد نطاق بعد"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {compareFacilityIds.length > 0 && (
              <Link
                href="/compare"
                className="px-3 py-1.5 rounded-full bg-dark-slate text-electric-volt text-[11px] font-bold"
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

        {placesHydrating && homeSuggestions.length === 0 && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="h-48 rounded-2xl bg-surface-card border border-surface-container animate-pulse" />
            ))}
          </div>
        )}

        {homeFeatured.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 px-1">
              <Icon name="verified" className="text-[15px] text-deep-olive" />
              <span className="text-xs font-bold text-dark-slate">ترشيحات كابتنلي المختارة</span>
            </div>
            <div className="flex flex-col gap-3">
              {homeFeatured.map((fac) => (
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

        {homeRegistered.length > 0 && (
          <div className="flex flex-col gap-4">
            {homeRegistered.map((fac) => (
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

        {homeDirectory.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            {homeRegistered.length > 0 && (
              <div className="flex items-center gap-1.5 px-1">
                <Icon name="explore" className="text-[15px] text-text-muted" />
                <span className="text-xs font-bold text-text-muted">أقرب المسابح من خرائط Google</span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {homeDirectory.map((fac) => (
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

        <Link
          href={exploreCityHref}
          className="w-full py-3 rounded-full bg-surface-card text-dark-slate text-xs font-bold text-center shadow-sm border border-surface-container"
        >
          {filtered.length > homeSuggestions.length
            ? `تصفح باقي المسابح في ${cleanCityLabel} (${filtered.length - homeSuggestions.length} إضافية) ←`
            : `عرض كل مسابح ${cleanCityLabel} والخريطة ←`}
        </Link>
      </section>

      {/* Verified Coaches — Zero Fake Coaches Rule */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-section-title-mobile text-section-title-mobile text-dark-slate">
            الكباتن الموثقون
          </h2>
          <Link href="/coaches" className="text-xs font-bold text-deep-olive">
            عرض الدليل ←
          </Link>
        </div>

        {verifiedCoaches.length > 0 ? (
          <div className="flex flex-col gap-3">
            {verifiedCoaches.map((coach) => (
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
              className="px-4 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold w-fit"
            >
              {isFacilityManager ? "إدارة كباتن المنشأة" : isCoachRole ? "لوحة الكابتن" : "سجّل ووثّق ملفك ككابتن الآن"}
            </Link>
          </div>
        )}
      </section>

      {/* Magazine Articles Carousel (All articles, swipe + drag + arrow buttons) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-section-title-mobile text-section-title-mobile text-dark-slate">
            أدلة مجلة كابتنلي ({articles.length})
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
            <Link href="/magazine" className="text-xs font-bold text-[#65A30D] mr-1">
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
                className="w-[276px] shrink-0 snap-start bg-surface-card rounded-2xl overflow-hidden shadow-sm border border-surface-container flex flex-col justify-between"
              >
                <div>
                  {art.imageUrl ? (
                    <div className="relative h-32">
                      <Link href={`/magazine/${art.slug}`}>
                        <img src={art.imageUrl} alt={art.titleAr} className="w-full h-full object-cover" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(art.id)}
                        className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center shadow ${
                          fav ? "bg-electric-volt text-dark-slate" : "bg-surface-card/90 text-dark-slate"
                        }`}
                      >
                        <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[14px]" />
                      </button>
                    </div>
                  ) : (
                    <div className="px-3.5 pt-3.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lime-tint text-deep-olive">
                        {art.categoryAr}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(art.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center border border-surface-container ${
                          fav ? "bg-electric-volt text-dark-slate" : "bg-surface-snow text-dark-slate"
                        }`}
                      >
                        <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[14px]" />
                      </button>
                    </div>
                  )}
                  <div className="p-3.5 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-deep-olive">{art.categoryAr}</span>
                    <Link href={`/magazine/${art.slug}`} className="font-card-title-sm text-xs text-dark-slate line-clamp-2">
                      {art.titleAr}
                    </Link>
                  </div>
                </div>
                <Link href={`/magazine/${art.slug}`} className="px-3.5 pb-3 text-[11px] font-bold text-deep-olive">
                  اقرأ الدليل ←
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* Bottom Mobile Claim Banner */}
      <section className="rounded-2xl bg-surface-card p-5 shadow-sm border border-surface-container flex flex-col gap-2">
        <h3 className="font-card-title-sm text-dark-slate">
          {isFacilityManager ? "أدر منشأتك وفريق الكباتن والمشتركين" : "هل أنت كابتن أو صاحب أكاديمية؟"}
        </h3>
        <p className="text-xs text-text-muted">
          {isFacilityManager
            ? "تابع مواعيد المدارس، فعّل اشتراكات الـ QR، ومنح صلاحيات الموظفين من لوحة المنشأة."
            : "طالب بإدارة صفحتك أو سجّل ككابتن معتمد مجاناً وفعّل دفاتر الـ QR لمشتركيك."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={isFacilityManager ? "/dashboard/facility" : isCoachRole ? "/dashboard/coach" : "/claim"}
            className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
          >
            {isFacilityManager ? "افتح لوحة المنشأة" : isCoachRole ? "افتح لوحة الكابتن" : "طالب بصفحتك مجاناً"}
          </Link>
          <Link href="/about" className="px-4 py-2 rounded-full bg-surface-snow text-dark-slate text-xs font-bold">
            عن المنصة
          </Link>
        </div>
      </section>
    </div>
  );
}
