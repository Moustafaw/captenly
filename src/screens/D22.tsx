"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityImageOrFallback } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";
import { GuestFloatingAuthBar } from "@/components/auth/GuestFloatingAuthBar";
import { ShareButton } from "@/components/editorial/ShareButton";
import { cleanPublicAddressAr } from "@/lib/maps";

export default function Desktop22() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";

  const {
    facilities,
    coaches,
    articles,
    isFavorite,
    toggleFavorite,
    compareFacilityIds,
    toggleCompareFacility,
    createStructuredWhatsappLead,
    currentPersona,
    minorAthletes,
    isAuthenticated,
    openAuthGateModal,
    userLocation,
    placesHydrating,
    mergeExternalPlacesFacilities,
    myStaffAssignments,
  } = useCaptenly();

  const facility = useMemo(
    () => (slug ? facilities.find((f) => f.slug === slug || f.id === slug) : facilities[0]),
    [facilities, slug]
  );

  const [gplaceLoading, setGplaceLoading] = useState(false);

  useEffect(() => {
    if (facility || !slug || (!slug.startsWith("gplace-") && !slug.startsWith("osm-"))) return;
    let cancelled = false;
    setGplaceLoading(true);
    fetch(`/api/places/search?placeId=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const places = Array.isArray(data?.places) ? data.places : [];
        if (places.length > 0) {
          mergeExternalPlacesFacilities(places);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setGplaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [facility, slug, mergeExternalPlacesFacilities]);

  const [activeTab, setActiveTab] = useState<"packages" | "specs" | "coaches" | "safety">("packages");
  const [selectedLocIndex, setSelectedLocIndex] = useState(0);

  if (!facility) {
    return (
      <div className="screen-root bg-[#F7F9FA] font-body-default min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[24px] bg-white border border-[#0F172A]/8 p-8 text-center flex flex-col items-center gap-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center">
            <Icon
              name={gplaceLoading || placesHydrating ? "travel_explore" : "pool"}
              className={`text-[32px] ${gplaceLoading || placesHydrating ? "animate-pulse" : ""}`}
            />
          </div>
          <h1 className="font-section-title text-[#0F172A]">
            {gplaceLoading || placesHydrating ? "جاري تحميل بيانات المنشأة..." : "لم نجد هذه المنشأة"}
          </h1>
          <p className="text-xs text-[#64748B] leading-relaxed">
            {gplaceLoading || placesHydrating
              ? "يتم جلب تفاصيل المسبح من خرائط Google وقاعدة كابتنلي الآن."
              : "قد يكون الرابط قديماً أو لم يتم تفعيل المنشأة في نطاق البحث الحالي بعد."}
          </p>
          {!gplaceLoading && !placesHydrating && (
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors"
            >
              تصفح المسابح القريبة منك ←
            </Link>
          )}
        </div>
      </div>
    );
  }

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
  const isVerifiedOfficial = facility.supplyStatus === "verified_active";
  const canManageThisFacility =
    isAuthenticated &&
    (currentPersona.role === "super_admin" ||
      currentPersona.linkedFacilityId === facility.id ||
      myStaffAssignments.some(
        (st) =>
          st.facilityId === facility.id &&
          (!st.invitationStatus || st.invitationStatus === "accepted")
      ));
  const branchLocations =
    Array.isArray(facility.locations) && facility.locations.length > 0
      ? facility.locations
      : [];
  const activeBranch = branchLocations[selectedLocIndex] || branchLocations[0];
  const mapTargetFacility = activeBranch
    ? {
        ...facility,
        nameAr: activeBranch.labelAr ? `${facility.nameAr} — ${activeBranch.labelAr}` : facility.nameAr,
        city: activeBranch.city,
        district: activeBranch.district,
        governorate: activeBranch.governorate,
        addressAr: activeBranch.addressAr,
        coordinates: activeBranch.coordinates,
      }
    : facility;
  const fav = isFavorite(facility.id);
  const inCompare = compareFacilityIds.includes(facility.id);
  const schoolPrograms = facility.schoolPrograms || [];
  const hasRealScheduleOrPricing = !isUnclaimed && schoolPrograms.length > 0;
  const affiliatedCoaches = coaches.filter(
    (c) =>
      c.isVerifiedCoach &&
      (facility.affiliatedCoachIds.includes(c.id) ||
        c.affiliations.some((a) => a.facilityId === facility.id && a.status === "active_mutual"))
  );
  const rosterCoaches = facility.coachRoster || [];
  const totalCoachesCount =
    rosterCoaches.length +
    affiliatedCoaches.filter((c) => !rosterCoaches.some((r) => r.linkedCoachId === c.id)).length;
  const facilityArticles = articles.filter((a) => a.authorEntityId === facility.id);

  const handleDirectWhatsapp = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: facility.id,
      targetNameAr: facility.nameAr,
      whatsappNumber: facility.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: minorAthletes[0]?.age || 25,
      requestedSpecialtyAr: schoolPrograms[0]?.titleAr || facility.specialtiesAr[0] || "اشتراك شهري",
      preferredScheduleAr: "بالتنسيق مع الإدارة",
    });
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0F172A] antialiased min-h-screen pt-6 pb-28">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-6">
        {/* Verified Notice — Visible only to authorized facility owner/staff */}
        {!isUnclaimed && canManageThisFacility && (
          <div className="rounded-2xl bg-[#EAF4F8]/85 border border-[#1D6E7D]/15 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-xs md:text-sm text-[#0F172A]">
              <Icon name={isVerifiedOfficial ? "verified" : "pool"} className="text-[19px] text-[#1D6E7D] shrink-0" />
              <span>
                {isVerifiedOfficial
                  ? `صفحة موثقة وتُدار رسمياً من إدارة ${facility.nameAr} (${facility.verifiedClaimDateAr || "محدثة"})`
                  : `صفحة مُسجَّلة وتُدار عبر مسؤولي ${facility.nameAr} على كابتنلي`}
              </span>
            </div>
            <Link href="/dashboard/facility" className="text-xs font-extrabold text-[#1D6E7D] hover:underline shrink-0">
              لوحة إدارة المنشأة ←
            </Link>
          </div>
        )}

        {/* Main Hero */}
        <section className="rounded-[24px] bg-white overflow-hidden shadow-[0_8px_28px_rgba(15,23,42,0.04)] border border-[#0F172A]/8 grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 relative min-h-[280px] lg:min-h-[360px] bg-[#EAF4F8]">
            <FacilityImageOrFallback
              facility={facility}
              className="w-full h-full min-h-[280px] lg:min-h-[360px]"
              imgClassName="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 flex flex-wrap gap-1.5">
              {facility.poolSpecs?.isHeatedWinter && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-[#1D6E7D] text-xs font-bold shadow-sm">
                  <Icon name="thermostat" className="text-[14px]" />
                  <span>مدفأ شتاءً</span>
                </span>
              )}
              {(facility.poolSpecs?.hasLadiesOnlySlots || facility.gymSpecs?.hasLadiesOnlySlots) && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0F172A]/80 backdrop-blur-md text-white text-xs font-bold shadow-sm">
                  <Icon name="female" className="text-[14px]" />
                  <span>ساعات للسيدات</span>
                </span>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold text-[#1D6E7D] inline-flex items-center gap-1">
                  <Icon name="location_on" className="text-[14px]" />
                  <span>
                    {facility.governorate} • {facility.city}
                    {facility.district ? ` • ${facility.district}` : ""}
                  </span>
                </span>
                {facility.rating > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7]/70 text-[#92400E] font-bold text-xs">
                    <Icon name="star" className="text-[14px] text-[#92400E]" />
                    <span className="text-[#0F172A]">{facility.rating}</span>
                    {facility.reviewsCount > 0 ? <span className="text-[#475569]">({facility.reviewsCount} تقييم)</span> : null}
                  </span>
                ) : null}
              </div>

              <h1 className="font-hero-headline text-[26px] md:text-[32px] text-[#0F172A] leading-tight">
                {facility.nameAr}
              </h1>
              <p className="font-body-default text-[#475569]">
                {cleanPublicAddressAr(activeBranch ? activeBranch.addressAr : facility.addressAr) ||
                  `${facility.city}${facility.district ? ` • ${facility.district}` : ""}`}
              </p>
              {branchLocations.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[#0F172A]">
                    {branchLocations.length > 1
                      ? `مواقع وفروع التدريب (${branchLocations.length} مواقع):`
                      : facility.isAcademyInHostClubs
                      ? "النادي / الموقع المستضيف للأكاديمية:"
                      : "موقع المنشأة:"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {branchLocations.map((loc, idx) => {
                      const active = idx === selectedLocIndex;
                      return (
                        <button
                          key={loc.id || idx}
                          type="button"
                          onClick={() => setSelectedLocIndex(idx)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                            active
                              ? "bg-[#1D6E7D] text-white border-[#1D6E7D] shadow-sm"
                              : "bg-[#F7F9FA] text-[#0F172A] border-[#0F172A]/10 hover:border-[#1D6E7D]/40 hover:bg-[#EAF4F8]/50"
                          }`}
                        >
                          <Icon name="location_on" className="text-[13px] inline ml-1" />
                          <span>{loc.labelAr || `${loc.city}${loc.district ? ` — ${loc.district}` : ""}`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(facility.publicDescriptionAr || facility.scheduleSummaryAr) && (
                <p className="text-xs font-semibold text-[#0F172A] bg-[#F7F9FA] border border-[#0F172A]/6 px-3.5 py-2.5 rounded-xl w-fit inline-flex items-center gap-1.5">
                  <Icon name={isUnclaimed ? "info" : "schedule"} className="text-[15px] text-[#1D6E7D]" />
                  <span>{facility.publicDescriptionAr || facility.scheduleSummaryAr}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {facility.specialtiesAr.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 rounded-full bg-[#EAF4F8]/80 text-[#1D6E7D] text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span>{s}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#0F172A]/8">
              <div className="flex flex-wrap items-center gap-2.5">
                <ContactChannelsBar
                  supplyStatus={facility.supplyStatus}
                  whatsappNumber={facility.whatsappNumber}
                  facebookUrl={facility.facebookUrl}
                  instagramUrl={facility.instagramUrl}
                  onWhatsappClick={handleDirectWhatsapp}
                />

                {!isUnclaimed && (
                  <Link
                    href={`/booking?facility=${facility.slug}`}
                    onClick={(e) => {
                      if (!isAuthenticated) {
                        e.preventDefault();
                        openAuthGateModal("تجهيز بيانات التسجيل والحجز");
                      }
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm shadow-sm transition-colors"
                  >
                    تجهيز الحجز والانضمام
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(facility.id)}
                  aria-label={fav ? "إزالة من المفضلة" : "حفظ المنشأة"}
                  title={fav ? "محفوظة" : "حفظ المنشأة"}
                  className={`px-3.5 py-2 rounded-full font-badge-label text-xs flex items-center gap-1.5 border transition-colors ${
                    fav
                      ? "bg-[#1D6E7D] border-[#1D6E7D] text-white"
                      : "bg-[#F7F9FA] border-[#0F172A]/10 text-[#0F172A] hover:bg-[#EAF4F8]"
                  }`}
                >
                  <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[16px]" />
                  <span>{fav ? "محفوظة" : "حفظ"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleCompareFacility(facility.id)}
                  aria-label="أضف للمقارنة"
                  title={inCompare ? "في المقارنة" : "أضف للمقارنة"}
                  className={`px-3.5 py-2 rounded-full font-badge-label text-xs flex items-center gap-1.5 border transition-colors ${
                    inCompare
                      ? "bg-[#1D6E7D] border-[#1D6E7D] text-white"
                      : "bg-[#F7F9FA] border-[#0F172A]/10 text-[#0F172A] hover:bg-[#EAF4F8]"
                  }`}
                >
                  <Icon name="compare_arrows" className="text-[16px]" />
                  <span>{inCompare ? "بالمقارنة ✓" : "مقارنة"}</span>
                </button>

                <ShareButton
                  title={`${facility.nameAr} — ${facility.city} | كابتنلي`}
                  text={`تعرّف على مواعيد وباقات ${facility.nameAr} على منصة كابتنلي`}
                  ariaLabel="مشاركة الصفحة"
                  variant="icon"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto bg-white p-1.5 rounded-2xl border border-[#0F172A]/8 shadow-[0_2px_12px_rgba(15,23,42,0.02)] w-fit max-w-full">
          {[
            { key: "packages", label: `المدارس والمواعيد (${schoolPrograms.length})` },
            { key: "specs", label: "المواصفات الهندسية والمواعيد" },
            { key: "coaches", label: `الكباتن الموثقون (${totalCoachesCount})` },
            { key: "safety", label: "معايير الأمان ودليل الحصص" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`px-5 py-2.5 rounded-xl font-badge-label text-xs shrink-0 transition-all ${
                activeTab === t.key
                  ? "bg-[#1D6E7D] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#1D6E7D] hover:bg-[#EAF4F8]/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content + Sticky Cost Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 flex flex-col gap-4">
            {activeTab === "packages" && (
              <div className="flex flex-col gap-3">
                {!hasRealScheduleOrPricing ? (
                  <div className="rounded-[24px] bg-white p-8 border border-[#0F172A]/8 text-center flex flex-col items-center gap-2 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
                    <Icon name="info" className="text-[28px] text-[#64748B]" />
                    <h2 className="font-card-title text-[#0F172A]">لا توجد بيانات متوفرة الآن</h2>
                    <p className="text-xs text-[#475569] max-w-md leading-relaxed">
                      {isUnclaimed
                        ? "هذه المنشأة غير مسجلة أو مفعّلة على منصة Captenly بعد — لذلك لا تتوفر باقات أو مواعيد حصص معلنة حتى الآن."
                        : "لم تقم إدارة المنشأة بإضافة بطاقات المواعيد والأسعار بعد."}
                    </p>
                  </div>
                ) : (
                  <>
                    {schoolPrograms.length > 0 && (
                      <div className="rounded-[24px] bg-white p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-4">
                        <h2 className="font-card-title text-[#0F172A] flex items-center gap-2">
                          <Icon name="school" className="text-[19px] text-[#1D6E7D]" />
                          <span>بطاقات المواعيد والمدارس ({schoolPrograms.length})</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {schoolPrograms.map((prog) => (
                            <div
                              key={prog.id}
                              className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#0F172A]/8 flex flex-col justify-between gap-2"
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-card-title-sm text-[#0F172A]">{prog.titleAr}</span>
                                  <span className="font-black text-[#1D6E7D] text-base shrink-0">
                                    {prog.priceEgp} ج.م
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-[#1D6E7D]">
                                  {prog.trackLabelAr} {prog.ageRangeAr ? `• ${prog.ageRangeAr}` : ""}
                                </div>
                                <div className="text-xs text-[#334155] flex items-center gap-1.5">
                                  <Icon name="schedule" className="text-[14px] text-[#1D6E7D]" />
                                  <span>{prog.sessionTimeAr || prog.scheduleAr}</span>
                                </div>
                                <div className="text-[11px] text-[#64748B]">
                                  مدة الحصة: {prog.durationMinutes || 60} دقيقة
                                  {prog.sessionsPerMonth ? ` • ${prog.sessionsPerMonth} حصة` : ""}
                                </div>
                                {prog.notesAr && (
                                  <p className="text-[11px] text-[#475569] bg-white p-2.5 rounded-xl border border-[#0F172A]/6 mt-1 leading-relaxed">
                                    {prog.notesAr}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "specs" && (
              <div className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                {facility.poolSpecs && (
                  <>
                    <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4">
                      <span className="text-xs text-[#64748B]">نوع ومقاس المسبح</span>
                      <div className="font-card-title text-[#0F172A] mt-1">{facility.poolSpecs.poolType}</div>
                    </div>
                    <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4">
                      <span className="text-xs text-[#64748B]">العمق وكثافة الحارة</span>
                      <div className="font-card-title text-[#0F172A] mt-1">
                        {facility.poolSpecs.depthRange} • حتى {facility.poolSpecs.maxSwimmersPerLane} سباح/حارة
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4">
                      <span className="text-xs text-[#64748B]">التدفئة والتغطية الشتوية</span>
                      <div className="font-card-title text-[#0F172A] mt-1">
                        {facility.poolSpecs.isHeatedWinter ? "مدفأ شتاءً ✓" : "غير مدفأ"} •{" "}
                        {facility.poolSpecs.isCoveredIndoor ? "مغطى داخلي" : "مكشوف"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 p-4">
                      <span className="text-xs text-[#64748B]">الإنقاذ وساعات السيدات</span>
                      <div className="font-card-title text-[#0F172A] mt-1">
                        {facility.poolSpecs.hasEdlfLifeguard ? "منقذ مائي متواجد ✓" : "غير مؤكد"} •{" "}
                        {facility.poolSpecs.hasLadiesOnlySlots ? "ساعات سيدات متاحة ✓" : "مختلط"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "coaches" && (
              <div className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-4">
                {totalCoachesCount > 0 ? (
                  <>
                    <h2 className="sr-only">الكباتن والمدربون بالمكان</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rosterCoaches.map((rc) => (
                      <div
                        key={rc.id}
                        className="rounded-2xl bg-[#F7F9FA] p-5 border border-[#0F172A]/8 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-card-title text-[#0F172A]">{rc.fullNameAr}</h3>
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                  rc.linkedCoachId
                                    ? "bg-[#EAF4F8] text-[#1D6E7D]"
                                    : "bg-amber-50 border border-amber-200 text-amber-800"
                                }`}
                              >
                                <Icon name={rc.linkedCoachId ? "verified" : "info"} className="text-[13px]" />
                                <span>
                                  {rc.linkedCoachId
                                    ? "حساب كابتن مسجّل"
                                    : "مُضاف من إدارة المنشأة (غير موثق بالمنصة بعد)"}
                                </span>
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#1D6E7D] mt-1">
                              {rc.roleTitleAr} • {rc.specialtyAr}
                            </div>
                            {rc.scheduleAr && (
                              <div className="text-xs text-[#64748B] mt-1 flex items-center gap-1">
                                <Icon name="schedule" className="text-[14px] text-[#1D6E7D]" />
                                <span>{rc.scheduleAr}</span>
                              </div>
                            )}
                          </div>
                          {rc.linkedCoachSlug && (
                            <Link
                              href={`/c/${rc.linkedCoachSlug}`}
                              className="px-3 py-1.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-[11px] font-bold shrink-0 transition-colors"
                            >
                              ملف الكابتن ←
                            </Link>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#0F172A]/8">
                          <span className="text-[11px] font-extrabold text-[#0F172A]">
                            البيانات والشهادات المُدخلة من الإدارة (قيد المراجعة):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rc.certificatesAr.map((cert, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#0F172A]/8 text-[11px] font-bold text-[#475569]"
                              >
                                <Icon name={rc.linkedCoachId ? "workspace_premium" : "assignment"} className="text-[14px]" />
                                <span>{cert}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {affiliatedCoaches
                      .filter((c) => !rosterCoaches.some((r) => r.linkedCoachId === c.id))
                      .map((c) => (
                        <VerifiedCoachCard key={c.id} coach={c} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 flex flex-col items-center gap-3">
                    <Icon name="verified" className="text-[28px] text-[#1D6E7D]" />
                    <h2 className="font-card-title text-[#0F172A]">
                      لم تُضف قائمة كباتن لهذه المنشأة بعد
                    </h2>
                    <p className="text-xs text-[#475569] max-w-md">
                      يمكن لإدارة المنشأة إضافة الكباتن وشهاداتهم مباشرة من لوحة تحكم المنشأة ليظهروا هنا تلقائياً.
                    </p>
                  </div>
                )}
              </div>
            )}

            {facilityArticles.length > 0 && (
              <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-3">
                <h2 className="font-card-title text-[#0F172A] flex items-center gap-2">
                  <Icon name="article" className="text-[18px] text-[#1D6E7D]" />
                  <span>مقالات ومنشورات {facility.nameAr} ({facilityArticles.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {facilityArticles.map((art) => (
                    <Link
                      key={art.id}
                      href={`/magazine/${art.slug}`}
                      className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#0F172A]/8 hover:border-[#1D6E7D]/35 flex flex-col gap-1.5 transition-colors"
                    >
                      <span className="text-[10px] font-bold text-[#1D6E7D]">{art.categoryAr}</span>
                      <div className="font-bold text-sm text-[#0F172A] line-clamp-1">{art.titleAr}</div>
                      <p className="text-xs text-[#64748B] line-clamp-2">{art.excerptAr}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "safety" && (
              <div className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-3">
                <h2 className="font-card-title text-[#0F172A]">
                  كيف تحفظ حقك وتفعّل دفتر الحصص الرقمي هنا؟
                </h2>
                <p className="font-body-compact text-[#475569] leading-relaxed">
                  بمجرد اشتراكك مع الإدارة أو الكابتن الموثق بالمكان، اعطهم كود عضويتك الفريد (مثال: {currentPersona.memberCode}) لإضافتك إلى دفتر الحصص الرقمي وتفعيل كود الـ QR الذي يعمل حتى في حالة ضعف أو انقطاع الإنترنت داخل صالة المسبح.
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard/ledger"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#EAF4F8] hover:bg-[#DCEEF5] text-[#1D6E7D] text-xs font-bold transition-colors"
                  >
                    <Icon name="qr_code_2" className="text-[16px]" />
                    <span>عرض كود عضويتي ودفتر الحصص</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Left Sticky Column: Dynamic Schedule/Pricing Cards + Contact + Google Maps */}
          <aside className="lg:col-span-4 lg:sticky lg:top-[124px] bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-4">
            <h2 className="font-card-title text-[#0F172A]">الباقات ومواعيد الحصص</h2>

            {!hasRealScheduleOrPricing ? (
              <div className="rounded-xl bg-[#F7F9FA] p-4 text-center flex flex-col items-center gap-1.5 border border-[#0F172A]/8">
                <Icon name="info" className="text-[22px] text-[#64748B]" />
                <div className="font-bold text-xs text-[#0F172A]">لا توجد بيانات متوفرة الآن</div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {isUnclaimed
                    ? "هذه المنشأة غير مسجلة على المنصة بعد — لم تُضف أي مواعيد أو أسعار."
                    : "لم تُنشر بطاقات مواعيد وأسعار لهذه المنشأة حتى الآن."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-0.5">
                {schoolPrograms.map((prog) => (
                  <div
                    key={prog.id}
                    className="rounded-2xl bg-[#F7F9FA] p-3.5 border border-[#0F172A]/8 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#0F172A]">{prog.titleAr}</span>
                      <span className="font-black text-base text-[#1D6E7D] shrink-0">
                        {prog.priceEgp} ج.م
                      </span>
                    </div>
                    <div className="text-[11px] text-[#334155] flex items-center gap-1">
                      <Icon name="schedule" className="text-[13px] text-[#1D6E7D]" />
                      <span>{prog.sessionTimeAr || prog.scheduleAr}</span>
                    </div>
                    <div className="text-[10px] text-[#64748B]">
                      مدة الحصة: {prog.durationMinutes || 60} دقيقة
                      {prog.sessionsPerMonth ? ` • ${prog.sessionsPerMonth} حصة` : ""}
                    </div>
                    {prog.notesAr && (
                      <p className="text-[11px] text-[#475569] bg-white rounded-xl p-2 mt-1 border border-[#0F172A]/6 leading-relaxed">
                        {prog.notesAr}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isUnclaimed ? (
              <>
                <ContactChannelsBar
                  supplyStatus={facility.supplyStatus}
                  whatsappNumber={facility.whatsappNumber}
                  facebookUrl={facility.facebookUrl}
                  instagramUrl={facility.instagramUrl}
                  onWhatsappClick={handleDirectWhatsapp}
                  fullWidthPrimary
                />
                <Link
                  href={`/booking?facility=${facility.slug}`}
                  onClick={(e) => {
                    if (!isAuthenticated) {
                      e.preventDefault();
                      openAuthGateModal("تجهيز بيانات التسجيل والحجز");
                    }
                  }}
                  className="w-full py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm text-center shadow-sm transition-colors"
                >
                  تجهيز بيانات التسجيل ←
                </Link>
              </>
            ) : (
              facility.publicDescriptionAr && (
                <p className="text-xs text-[#475569] leading-relaxed bg-[#F7F9FA] rounded-xl p-3">
                  {facility.publicDescriptionAr}
                </p>
              )
            )}

            <div className="pt-2 border-t border-[#0F172A]/8 flex flex-col gap-2">
              <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Icon name="location_on" className="text-[15px] text-[#1D6E7D]" />
                <span>
                  {branchLocations.length > 1
                    ? `الموقع على الخريطة (${activeBranch?.labelAr || activeBranch?.city})`
                    : "الموقع على خرائط Google"}
                </span>
              </div>
              <CaptenlyGoogleMap
                facilities={[mapTargetFacility]}
                selectedFacilityId={mapTargetFacility.id}
                userCoordinates={{ lat: userLocation.lat, lng: userLocation.lng }}
                heightClass="h-44"
                compact
                showPinStrip={false}
              />
            </div>
          </aside>
        </div>
      </div>
      <GuestFloatingAuthBar contextLabelAr={`سجّل أو أنشئ حسابك على Captenly لمقارنة ${facility.nameAr} أو حفظها والتواصل المباشر`} />
    </div>
  );
}
