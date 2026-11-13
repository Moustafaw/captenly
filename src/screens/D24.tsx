"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { partitionFacilities3Tier } from "@/lib/hybridDiscovery";

type HomeCategoryKey = "all" | "swimming" | "ladies" | "kids" | "heated";

export default function Desktop24() {
  const {
    facilities,
    coaches,
    articles,
    userLocation,
    isFavorite,
    toggleFavorite,
    compareFacilityIds,
    placesHydrating,
  } = useCaptenly();

  const [selectedCat, setSelectedCat] = useState<HomeCategoryKey>("all");
  const [compareNotice, setCompareNotice] = useState<string | null>(null);
  const [rotationSeed, setRotationSeed] = useState<number>(() => Math.floor(Date.now() / 30000) % 24);

  // Automatic gentle rotation across nearby swimming pools in user's city/area
  useEffect(() => {
    const timer = setInterval(() => {
      setRotationSeed((prev) => prev + 1);
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  const swimmingFacilities = useMemo(
    () => facilities.filter((f) => f.sportSector !== "fitness"),
    [facilities]
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
      }),
    [filteredFacilities, rotationSeed, userLocation.lat, userLocation.lng, userLocation.city, userLocation.isSpecified]
  );

  // Home always showcases up to 3 rotating suggestions (diversified across Egypt if no location selected, or nearest when selected)
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

  const categories: { key: HomeCategoryKey; label: string; icon?: string }[] = [
    { key: "all", label: `الكل (${swimmingFacilities.length} مسبح وأكاديمية)` },
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
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased selection:bg-lime-tint selection:text-primary">
      <div className="w-full bg-canvas-alabaster min-h-screen pt-6">
        <div className="flex flex-col w-full">
          <div className="max-w-[1280px] w-full mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-xl">
            {/* Hero */}
            <section className="relative w-full rounded-[20px] bg-dark-slate overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-l from-dark-slate via-dark-slate/90 to-transparent z-10 pointer-events-none" />
              <div className="relative z-20 grid grid-cols-12 min-h-[340px] items-center">
                <div className="col-span-12 lg:col-span-7 p-space-xl flex flex-col justify-center gap-space-md">
                  <h1 className="font-hero-headline text-hero-headline text-surface-card leading-tight max-w-xl">
                    اكتشف أفضل الأندية والمدارس الرياضية الموثقة حولك في مصر
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-space-md gap-y-2 text-surface-container-high font-body-compact text-body-compact">
                    <span className="flex items-center gap-1.5">
                      <Icon name="check_circle" className="text-[16px] text-electric-volt" /> أسعار واضحة دون عمولات وساطة
                    </span>
                    <span className="text-secondary">•</span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="workspace_premium" className="text-[16px] text-electric-volt" /> كباتن معتمدون بالشارات فقط
                    </span>
                    <span className="text-secondary">•</span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="qr_code_2" className="text-[16px] text-electric-volt" /> دفتر حصص QR أوفلاين
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                    <Link
                      className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full bg-electric-volt text-dark-slate font-card-title text-card-title hover:brightness-105 transition-all shadow-md"
                      href="/explore"
                    >
                      <span>استكشف المنشآت القريبة منك</span>
                      <Icon name="arrow_back" className="text-[20px]" />
                    </Link>
                    <Link
                      href="/claim"
                      className="inline-flex items-center justify-center gap-2 px-5 h-12 rounded-full bg-white/10 text-surface-card font-card-title-sm hover:bg-white/20 transition-all"
                    >
                      <span>وثّق ناديك أو سجّل ككابتن</span>
                    </Link>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 h-[340px] relative overflow-hidden hidden lg:block">
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{ backgroundImage: "url('/screens/2c0d763d9374.jpg')" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-slate/80 via-transparent to-transparent" />
                  </div>
                  <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-slate/90 backdrop-blur-md shadow-lg">
                    <Icon name="thermostat" className="text-[18px] text-electric-volt" />
                    <div className="flex flex-col">
                      <span className="font-micro-caption text-micro-caption text-surface-variant">
                        معايير التدفئة والأمان
                      </span>
                      <span className="font-badge-label text-badge-label text-surface-card">
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
                <h2 className="font-section-title text-section-title text-dark-slate">
                  التصنيفات الرياضية المتاحة
                </h2>
                <span className="font-body-compact text-body-compact text-text-muted">
                  {userLocation.isSpecified
                    ? `النطاق الحالي: ${userLocation.city}، ${userLocation.governorate}`
                    : "النطاق الحالي: كل مصر (نتائج متنوعة — اضغط لتحديد منطقتك)"}
                </span>
              </div>
              <div className="flex items-center gap-space-xs overflow-x-auto pb-2 scrollbar-none" id="categoryFilters">
                {categories.map((cat) => {
                  const active = selectedCat === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCat(cat.key)}
                      className={`px-4 py-2.5 rounded-full font-badge-label text-badge-label transition-all shrink-0 flex items-center gap-1.5 shadow-sm ${
                        active
                          ? "bg-primary text-on-primary"
                          : "bg-surface-card text-on-surface hover:bg-lime-tint hover:text-primary"
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
                    {userLocation.isSpecified
                      ? "يتم عرض أقرب 3 مسابح وأكاديميات لنطاقك الجغرافي وتتبدل تلقائياً — اضغط للتصفح الكامل"
                      : "تظهر 3 منشآت متنوعة من مختلف محافظات مصر لعدم تحديد نطاق جغرافي — حدّد موقعك لترتيب الأقرب لك"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRotationSeed((s) => s + 1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-card hover:bg-lime-tint text-dark-slate border border-surface-container font-badge-label text-xs transition-colors"
                  >
                    <Icon name="autorenew" className="text-[15px] text-deep-olive" />
                    <span>تدوير المقترحات</span>
                  </button>
                  {compareFacilityIds.length > 0 && (
                    <Link
                      href="/compare"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs"
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
                        ? `عرض كل المسابح في ${cleanCityLabel} (${filteredFacilities.length})`
                        : `تصفح كل المسابح في مصر (${filteredFacilities.length})`}
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

              {placesHydrating && homeSuggestions.length === 0 && (
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

              {homeFeatured.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="verified" className="text-[17px] text-deep-olive" />
                    <h3 className="font-card-title-sm text-dark-slate">ترشيحات كابتنلي المختارة</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
                    {homeFeatured.map((facility) => (
                      <FacilityCard
                        key={facility.id}
                        facility={facility}
                        onSelectCompareFeedback={handleCompareNotice}
                      />
                    ))}
                  </div>
                </div>
              )}

              {homeRegistered.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
                  {homeRegistered.map((facility) => (
                    <FacilityCard
                      key={facility.id}
                      facility={facility}
                      onSelectCompareFeedback={handleCompareNotice}
                    />
                  ))}
                </div>
              )}

              {homeDirectory.length > 0 && (
                <div className="flex flex-col gap-3">
                  {homeRegistered.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Icon name="explore" className="text-[17px] text-text-muted" />
                      <h3 className="font-card-title-sm text-text-muted">أقرب المسابح من خرائط Google في نطاقك</h3>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
                    {homeDirectory.map((facility) => (
                      <FacilityCard
                        key={facility.id}
                        facility={facility}
                        onSelectCompareFeedback={handleCompareNotice}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!placesHydrating && homeSuggestions.length === 0 && (
                <div className="p-6 rounded-2xl bg-surface-card border border-surface-container text-center text-sm text-text-muted">
                  لم نجد نتائج مطابقة لهذا التصنيف حالياً في {cleanCityLabel} — جرّب تصنيف الكل أو افتح صفحة الاستكشاف.
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Link
                  href={exploreCityHref}
                  className="px-6 py-3 rounded-full bg-surface-card hover:bg-lime-tint text-dark-slate font-card-title-sm shadow-sm transition-colors border border-surface-container"
                >
                  {filteredFacilities.length > homeSuggestions.length
                    ? `تصفح باقي المسابح والأكاديميات في ${cleanCityLabel} (${filteredFacilities.length - homeSuggestions.length} إضافية) ←`
                    : `استكشف جميع مسابح وأكاديميات ${cleanCityLabel} على الخريطة ←`}
                </Link>
              </div>
            </section>

            {/* Verified Coaches Section — Zero Fake Coaches Rule */}
            <section className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    نخبة الكباتن المعتمدين والموثقين شخصياً
                  </h2>
                  <p className="font-body-compact text-body-compact text-text-muted mt-0.5">
                    لا ننشئ أي ملف كابتن وهمي — يظهر الكابتن هنا فور تسجيله برقم موبايله وتوثيق شهاداته للشارات الخضراء
                  </p>
                </div>
                <Link
                  href="/claim?mode=coach"
                  className="px-4 py-2 rounded-full bg-lime-tint text-deep-olive font-badge-label text-badge-label hover:brightness-95"
                >
                  + سجّل ووثّق ككابتن الآن
                </Link>
              </div>

              {verifiedCoaches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop">
                  {verifiedCoaches.map((coach) => (
                    <VerifiedCoachCard key={coach.id} coach={coach} />
                  ))}
                </div>
              ) : (
                <div className="bg-surface-card rounded-[20px] p-8 shadow-sm border border-surface-container flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
                      <Icon name="verified" className="text-[24px]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-card-title text-dark-slate">
                        مساحة الكباتن الموثقين مفتوحة للانضمام المباشر
                      </h3>
                      <p className="font-body-compact text-text-muted max-w-2xl">
                        سياسة كابتنلي تمنع نشر أي بروفايل مدرب من الفراغ. إذا كنت كابتن سباحة أو إنقاذ مائي، سجّل برقم هاتفك وارفع مرجع نقابة المهن الرياضية أو شهادة الاتحاد للحصول على الشارات الخضراء وظهور ملفك للأهالي والسباحين مجاناً.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/claim?mode=coach"
                    className="px-6 py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm shrink-0 hover:opacity-95 shadow-sm"
                  >
                    وثّق ملفك ككابتن الآن
                  </Link>
                </div>
              )}
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
                    title: "6. الالتزام المهني (القانون 3/1985)",
                    desc: "فلترة آلية تحظر المسميات الطبية وتضمن جودة الإنقاذ والإسعافات الأولية.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-space-sm items-start p-space-md rounded-xl bg-surface-snow">
                    <div className="w-10 h-10 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
                      <Icon name={item.icon} className="text-[20px]" />
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-card-title-sm text-card-title-sm text-dark-slate">{item.title}</h4>
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
                    أحدث الأدلة الرياضية من مجلة كابتنلي ({articles.length})
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
                {articles.slice(0, 3).map((art) => {
                  const saved = isFavorite(art.id);
                  return (
                    <article
                      key={art.id}
                      className="bg-surface-card rounded-[16px] overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow"
                    >
                      <div>
                        <div className="relative w-full h-44 overflow-hidden bg-surface-container">
                          <Link href={`/magazine/${art.slug}`}>
                            <img
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              alt={art.titleAr}
                              src={art.imageUrl}
                            />
                          </Link>
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-dark-slate text-electric-volt font-badge-label text-badge-label">
                            {art.categoryAr}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(art.id)}
                            aria-label="حفظ المقال"
                            className={`absolute top-3 left-3 w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-colors shadow-sm ${
                              saved
                                ? "bg-electric-volt text-dark-slate"
                                : "bg-surface-card/90 text-dark-slate hover:text-deep-olive"
                            }`}
                          >
                            <Icon name={saved ? "bookmark" : "bookmark_border"} className="text-[18px]" />
                          </button>
                        </div>
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

            {/* Bottom Claim CTA */}
            <section className="rounded-[20px] bg-surface-snow p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <Icon name="sports_score" className="text-[24px]" />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-card-title text-card-title text-dark-slate">
                    هل أنت كابتن أو صاحب نادي / أكاديمية رياضية؟
                  </h3>
                  <p className="font-body-compact text-body-compact text-text-muted">
                    طالب بإدارة صفحتك أو سجّل ككابتن معتمد مجاناً، واربط السباحين بكود العضوية لتفعيل دفاتر الـ QR بدون عمولة.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-space-sm shrink-0">
                <Link
                  className="px-6 py-2.5 rounded-full bg-dark-slate text-electric-volt font-card-title-sm text-card-title-sm hover:opacity-90 transition-opacity"
                  href="/claim"
                >
                  طالب بصفحتك ووثّقها مجاناً
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
