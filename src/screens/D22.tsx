"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { resolveFacilityImage } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";

export default function Desktop22() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";

  const {
    facilities,
    coaches,
    isFavorite,
    toggleFavorite,
    compareFacilityIds,
    toggleCompareFacility,
    createStructuredWhatsappLead,
    currentPersona,
    userLocation,
  } = useCaptenly();

  const facility = useMemo(
    () => facilities.find((f) => f.slug === slug || f.id === slug) || facilities[0],
    [facilities, slug]
  );

  const [activeTab, setActiveTab] = useState<"packages" | "specs" | "coaches" | "safety">("packages");
  const [selectedPkgId, setSelectedPkgId] = useState<string>(facility?.pricePackages[0]?.id || "");

  if (!facility) return null;

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
  const fav = isFavorite(facility.id);
  const inCompare = compareFacilityIds.includes(facility.id);
  const selectedPkg =
    facility.pricePackages.find((p) => p.id === selectedPkgId) || facility.pricePackages[0];
  const affiliatedCoaches = coaches.filter(
    (c) =>
      c.isVerifiedCoach &&
      (facility.affiliatedCoachIds.includes(c.id) ||
        c.affiliations.some((a) => a.facilityId === facility.id && a.status === "active_mutual"))
  );

  const totalFirstMonth = selectedPkg
    ? selectedPkg.baseMonthlyEgp +
      selectedPkg.assessmentFeeEgp +
      selectedPkg.membershipCardFeeEgp +
      selectedPkg.mandatoryKitFeeEgp
    : 700;

  const handleDirectWhatsapp = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: facility.id,
      targetNameAr: facility.nameAr,
      whatsappNumber: facility.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: 10,
      requestedSpecialtyAr: selectedPkg?.nameAr || facility.specialtiesAr[0] || "اشتراك شهري",
      preferredScheduleAr: "بالتنسيق مع الإدارة",
    });
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareWhatsapp = () => {
    const text = `باقة ${facility.nameAr} (${facility.city}) على كابتنلي — ${
      selectedPkg ? `${selectedPkg.nameAr} بسعر ${selectedPkg.baseMonthlyEgp} ج.م` : ""
    }: ${typeof window !== "undefined" ? window.location.href : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Verified Notice (Clean dark-olive text, zero unclaimed top banner) */}
        {!isUnclaimed && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-surface-container/60">
            <div className="flex items-center gap-2 text-deep-olive font-bold text-sm">
              <Icon name="verified" className="text-[20px]" />
              <span>
                صفحة موثقة وتُدار رسمياً من إدارة {facility.nameAr} ({facility.verifiedClaimDateAr || "محدثة"})
              </span>
            </div>
            <Link href="/dashboard/facility" className="text-xs font-bold text-dark-slate hover:text-deep-olive underline">
              لوحة إدارة المنشأة ←
            </Link>
          </div>
        )}

        {/* Main Hero */}
        <section className="rounded-[20px] bg-surface-card overflow-hidden shadow-sm border border-surface-container grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 relative min-h-[280px] lg:min-h-[340px]">
            <img
              src={resolveFacilityImage(facility.heroImage)}
              alt={facility.nameAr}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 flex flex-wrap gap-1.5">
              {facility.poolSpecs?.isHeatedWinter && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-dark-slate/90 text-electric-volt text-xs font-bold">
                  <Icon name="thermostat" className="text-[14px]" />
                  <span>مدفأ شتاءً</span>
                </span>
              )}
              {(facility.poolSpecs?.hasLadiesOnlySlots || facility.gymSpecs?.hasLadiesOnlySlots) && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-dark-slate/90 text-white text-xs font-bold">
                  <Icon name="female" className="text-[14px]" />
                  <span>ساعات للسيدات</span>
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-deep-olive">
                  {facility.governorate} • {facility.city} • {facility.district}
                </span>
                <span className="flex items-center gap-1 text-status-warning font-bold text-sm">
                  <Icon name="star" className="text-[16px]" />
                  {facility.rating} ({facility.reviewsCount} تقييم)
                </span>
              </div>

              <h1 className="font-hero-headline text-[26px] md:text-[32px] text-dark-slate leading-tight">
                {facility.nameAr}
              </h1>
              <p className="font-body-default text-text-muted">{facility.addressAr}</p>
              {facility.scheduleSummaryAr && (
                <p className="text-xs font-semibold text-dark-slate bg-surface-snow px-3.5 py-2 rounded-xl w-fit inline-flex items-center gap-1.5">
                  <Icon name="schedule" className="text-[15px] text-deep-olive" />
                  <span>{facility.scheduleSummaryAr}</span>
                </p>
              )}

              {isUnclaimed && (
                <p className="text-xs font-bold text-deep-olive flex items-start gap-1.5 pt-1 leading-relaxed">
                  <Icon name="info" className="text-[15px] shrink-0 mt-0.5" />
                  <span>
                    لا تتوفر حالياً بيانات أو باقات محدثة مقدمة مباشرة من «{facility.nameAr}» لعدم تفعيل حسابها على المنصة حتى الآن.
                  </span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1">
                {facility.specialtiesAr.map((s, idx) => (
                  <span
                    key={s}
                    className="text-deep-olive text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    {idx > 0 && <span className="text-surface-variant">•</span>}
                    <span>{s}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={handleDirectWhatsapp}
                className="px-6 py-3 rounded-full bg-action-whatsapp text-white font-card-title-sm flex items-center gap-2 hover:opacity-95 shadow-sm"
              >
                <Icon name="chat" className="text-[18px]" />
                <span>تواصل مباشر عبر واتساب</span>
              </button>

              <Link
                href={`/booking?facility=${facility.slug}&pkg=${selectedPkg?.id || ""}`}
                className="px-5 py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm hover:opacity-95"
              >
                تجهيز الحجز والانضمام
              </Link>

              <button
                type="button"
                onClick={() => toggleFavorite(facility.id)}
                className={`px-4 py-3 rounded-full font-badge-label text-xs flex items-center gap-1.5 ${
                  fav ? "bg-electric-volt text-dark-slate" : "bg-surface-snow text-dark-slate"
                }`}
              >
                <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[16px]" />
                <span>{fav ? "محفوظة" : "حفظ"}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleCompareFacility(facility.id)}
                className={`px-4 py-3 rounded-full font-badge-label text-xs flex items-center gap-1.5 ${
                  inCompare ? "bg-dark-slate text-electric-volt" : "bg-surface-snow text-dark-slate"
                }`}
              >
                <Icon name="compare_arrows" className="text-[16px]" />
                <span>{inCompare ? "في المقارنة ✓" : "أضف للمقارنة"}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsapp}
                className="px-4 py-3 rounded-full bg-surface-snow text-dark-slate font-badge-label text-xs flex items-center gap-1.5 hover:bg-lime-tint"
              >
                <Icon name="share" className="text-[15px]" />
                <span>مشاركة الباقة</span>
              </button>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: "packages", label: `الباقات والأسعار (${facility.pricePackages.length})` },
            { key: "specs", label: "المواصفات الهندسية والمواعيد" },
            { key: "coaches", label: `الكباتن الموثقون (${affiliatedCoaches.length})` },
            { key: "safety", label: "معايير الأمان ودليل الحصص" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`px-5 py-2.5 rounded-full font-badge-label text-xs shrink-0 transition-colors ${
                activeTab === t.key
                  ? "bg-dark-slate text-electric-volt shadow-sm"
                  : "bg-surface-card text-text-muted hover:text-dark-slate"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content + Sticky Cost Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-8 flex flex-col gap-4">
            {activeTab === "packages" && (
              <div className="flex flex-col gap-3">
                {facility.pricePackages.map((pkg) => {
                  const selected = selectedPkg?.id === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`cursor-pointer rounded-2xl p-5 bg-surface-card border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        selected ? "border-deep-olive shadow-md" : "border-transparent shadow-sm"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-card-title text-dark-slate">{pkg.nameAr}</h3>
                        </div>
                        <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="calendar_month" className="text-[14px] text-deep-olive" />
                            <span>{pkg.sessionsCount} حصة</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icon name="schedule" className="text-[14px] text-deep-olive" />
                            <span>{pkg.durationMinutes} دقيقة/حصة</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icon name="sync" className="text-[14px] text-deep-olive" />
                            <span>{pkg.sessionsPerWeek} حصص أسبوعياً</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-2xl font-black text-deep-olive">
                          {pkg.baseMonthlyEgp} <span className="text-xs">ج.م</span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                          مرافق: {pkg.companionFeeEgp ? `${pkg.companionFeeEgp} ج.م` : "مشمول / غير مطلوب"}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isUnclaimed && (
                  <p className="text-xs font-semibold text-text-muted pt-1 leading-relaxed flex items-start gap-1.5">
                    <Icon name="info" className="text-[15px] text-deep-olive shrink-0 mt-0.5" />
                    <span>
                      ملحوظة: هذه المنشأة ({facility.nameAr}) لم تقم بتفعيل حسابها وإدارة بياناتها على كابتنلي حتى الآن، لذا لا تتوفر حالياً باقات أو أسعار محدثة مقدمة مباشرة منها.
                    </span>
                  </p>
                )}
              </div>
            )}

            {activeTab === "specs" && (
              <div className="bg-surface-card rounded-2xl p-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                {facility.poolSpecs && (
                  <>
                    <div className="rounded-xl bg-surface-snow p-4">
                      <span className="text-xs text-text-muted">نوع ومقاس المسبح</span>
                      <div className="font-card-title text-dark-slate mt-1">{facility.poolSpecs.poolType}</div>
                    </div>
                    <div className="rounded-xl bg-surface-snow p-4">
                      <span className="text-xs text-text-muted">العمق وكثافة الحارة</span>
                      <div className="font-card-title text-dark-slate mt-1">
                        {facility.poolSpecs.depthRange} • حتى {facility.poolSpecs.maxSwimmersPerLane} سباح/حارة
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-snow p-4">
                      <span className="text-xs text-text-muted">التدفئة والتغطية الشتوية</span>
                      <div className="font-card-title text-dark-slate mt-1">
                        {facility.poolSpecs.isHeatedWinter ? "مدفأ شتاءً ✓" : "غير مدفأ"} •{" "}
                        {facility.poolSpecs.isCoveredIndoor ? "مغطى داخلي" : "مكشوف"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-snow p-4">
                      <span className="text-xs text-text-muted">الإنقاذ وساعات السيدات</span>
                      <div className="font-card-title text-dark-slate mt-1">
                        {facility.poolSpecs.hasEdlfLifeguard ? "منقذ مائي متواجد ✓" : "غير مؤكد"} •{" "}
                        {facility.poolSpecs.hasLadiesOnlySlots ? "ساعات سيدات متاحة ✓" : "مختلط"}
                      </div>
                    </div>
                  </>
                )}

                {facility.gymSpecs && (
                  <>
                    <div className="rounded-xl bg-surface-snow p-4">
                      <span className="text-xs text-text-muted">مساحة الصالة والتكييف</span>
                      <div className="font-card-title text-dark-slate mt-1">
                        {facility.gymSpecs.areaSqm} م² •{" "}
                        {facility.gymSpecs.isAirConditioned ? "تكييف مركزي ✓" : "تهوية طبيعية"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-snow p-4">
                      <span className="text-xs text-text-muted">ساعات السيدات والمدربات</span>
                      <div className="font-card-title text-dark-slate mt-1">
                        {facility.gymSpecs.ladiesScheduleAr}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "coaches" && (
              <div className="bg-surface-card rounded-2xl p-6 shadow-sm">
                {affiliatedCoaches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {affiliatedCoaches.map((c) => (
                      <VerifiedCoachCard key={c.id} coach={c} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 flex flex-col items-center gap-3">
                    <Icon name="verified" className="text-[28px] text-deep-olive" />
                    <h3 className="font-card-title text-dark-slate">
                      لم يسجل كباتن مستقلون مرتبطون بهذه المنشأة بعد
                    </h3>
                    <p className="text-xs text-text-muted max-w-md">
                      لا نعرض أسماء كباتن غير مسجلين. إذا كنت مدرباً معتمداً داخل {facility.nameAr} يمكنك توثيق ملفك مجاناً وربطه بالمكان.
                    </p>
                    <Link
                      href="/claim?mode=coach"
                      className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
                    >
                      تسجيل وتوثيق كابتن في هذا المكان
                    </Link>
                  </div>
                )}
              </div>
            )}

            {activeTab === "safety" && (
              <div className="bg-surface-card rounded-2xl p-6 shadow-sm flex flex-col gap-3">
                <h3 className="font-card-title text-dark-slate">
                  كيف تحفظ حقك وتفعّل دفتر الحصص الرقمي هنا؟
                </h3>
                <p className="font-body-compact text-text-muted leading-relaxed">
                  بمجرد اشتراكك مع الإدارة أو الكابتن الموثق بالمكان، اعطهم كود عضويتك الفريد (مثال: {currentPersona.memberCode}) لإضافتك إلى دفتر الحصص الرقمي وتفعيل كود الـ QR الذي يعمل حتى في حالة ضعف أو انقطاع الإنترنت داخل صالة المسبح.
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard/ledger"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-lime-tint text-deep-olive text-xs font-bold"
                  >
                    <Icon name="qr_code_2" className="text-[16px]" />
                    <span>عرض كود عضويتي ودفتر الحصص</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Summary Sidebar */}
          <aside className="lg:col-span-4 lg:sticky lg:top-[124px] bg-surface-card rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col gap-4">
            <h3 className="font-card-title text-dark-slate">ملخص التكلفة والباقة المختارة</h3>
            <div className="rounded-xl bg-surface-snow p-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">الباقة</span>
                <span className="font-bold text-dark-slate">{selectedPkg?.nameAr || "شهرية"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">الاشتراك الأساسي</span>
                <span className="font-bold">{selectedPkg?.baseMonthlyEgp || 700} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">رسوم إضافية معلنة</span>
                <span className="font-bold">
                  {(selectedPkg?.assessmentFeeEgp || 0) + (selectedPkg?.membershipCardFeeEgp || 0)} ج.م
                </span>
              </div>
              <div className="border-t border-surface-container pt-2 mt-1 flex justify-between items-center">
                <span className="font-bold text-dark-slate">
                  {isUnclaimed ? "الاشتراك الشهري المتداول" : "الإجمالي التقديري"}
                </span>
                <span className="text-xl font-black text-deep-olive">{totalFirstMonth} ج.م</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDirectWhatsapp}
              className="w-full py-3 rounded-full bg-action-whatsapp text-white font-card-title-sm flex items-center justify-center gap-2"
            >
              <Icon name="chat" className="text-[17px]" />
              <span>اسأل الإدارة على واتساب</span>
            </button>

            <Link
              href={`/booking?facility=${facility.slug}&pkg=${selectedPkg?.id || ""}`}
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm text-center"
            >
              تجهيز بيانات التسجيل ←
            </Link>

            <div className="pt-2 border-t border-surface-container flex flex-col gap-2">
              <div className="text-xs font-bold text-dark-slate flex items-center gap-1.5">
                <Icon name="location_on" className="text-[15px] text-deep-olive" />
                <span>الموقع على خرائط Google</span>
              </div>
              <CaptenlyGoogleMap
                facilities={[facility]}
                selectedFacilityId={facility.id}
                userCoordinates={{ lat: userLocation.lat, lng: userLocation.lng }}
                heightClass="h-44"
                compact
                showPinStrip={false}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
