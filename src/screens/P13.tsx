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

export default function Phone13() {
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
    isAuthenticated,
    openAuthGateModal,
    userLocation,
    placesHydrating,
    mergeExternalPlacesFacilities,
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

  const [tab, setTab] = useState<"packages" | "specs" | "coaches" | "safety">("packages");
  const [selectedLocIndex, setSelectedLocIndex] = useState(0);

  if (!facility) {
    return (
      <div className="screen-root bg-[#F7F9FA] font-body-default min-h-screen flex items-center justify-center p-5">
        <div className="w-full rounded-3xl bg-white border border-[#0F172A]/8 p-6 text-center flex flex-col items-center gap-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center">
            <Icon
              name={gplaceLoading || placesHydrating ? "travel_explore" : "pool"}
              className={`text-[30px] ${gplaceLoading || placesHydrating ? "animate-pulse" : ""}`}
            />
          </div>
          <h1 className="font-card-title text-[#0F172A]">
            {gplaceLoading || placesHydrating ? "جاري تحميل بيانات المنشأة..." : "لم نجد هذه المنشأة"}
          </h1>
          <p className="text-xs text-[#64748B]">
            {gplaceLoading || placesHydrating
              ? "يتم جلب تفاصيل المسبح القريب الآن."
              : "يمكنك استعراض جميع المسابح والأكاديميات القريبة من مدينتك."}
          </p>
          {!gplaceLoading && !placesHydrating && (
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors"
            >
              تصفح المسابح ←
            </Link>
          )}
        </div>
      </div>
    );
  }

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
  const isVerifiedOfficial = facility.supplyStatus === "verified_active";
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
        c.affiliations.some((a) => a.facilityId === facility.id))
  );
  const rosterCoaches = facility.coachRoster || [];
  const totalCoachesCount =
    rosterCoaches.length +
    affiliatedCoaches.filter((c) => !rosterCoaches.some((r) => r.linkedCoachId === c.id)).length;
  const facilityArticles = articles.filter((a) => a.authorEntityId === facility.id);

  const handleWhatsapp = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: facility.id,
      targetNameAr: facility.nameAr,
      whatsappNumber: facility.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: 10,
      requestedSpecialtyAr: schoolPrograms[0]?.titleAr || facility.specialtiesAr[0] || "اشتراك",
      preferredScheduleAr: "بالتنسيق مع الإدارة",
    });
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleShareWhatsapp = () => {
    const text = `صفحة ${facility.nameAr} (${facility.city}) على كابتنلي: ${
      typeof window !== "undefined" ? window.location.href : ""
    }`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-[#0B1C2E] min-h-screen px-4 py-4 flex flex-col gap-4 pb-24">
      {/* Verified text status only (zero unclaimed amber banner) */}
      {!isUnclaimed && (
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/25 px-3 py-1.5 text-[11px] font-black text-[#1D6E7D]">
          <Icon name={isVerifiedOfficial ? "verified" : "pool"} className="text-[16px] text-[#00ACC1]" />
          <span>
            {isVerifiedOfficial
              ? "صفحة منشأة موثقة وتُدار رسمياً"
              : "صفحة مُسجَّلة وتُدار عبر مسؤوليها على كابتنلي"}
          </span>
        </div>
      )}

      {/* Hero Photo */}
      <div className="relative rounded-3xl overflow-hidden h-52 bg-white border border-[#E2E8F0] shadow-[0_8px_28px_rgba(11,28,46,0.06)]">
        <FacilityImageOrFallback
          facility={facility}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => toggleFavorite(facility.id)}
            aria-label={fav ? "إزالة من المفضلة" : "حفظ المنشأة"}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition cursor-pointer ${
              fav
                ? "bg-[#1D6E7D] text-white"
                : "bg-white/95 text-[#0B1C2E] border border-[#E2E8F0] hover:bg-[#EAF4F8]"
            }`}
          >
            <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[17px]" />
          </button>
          <button
            type="button"
            onClick={() => toggleCompareFacility(facility.id)}
            aria-label="إضافة للمقارنة"
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition cursor-pointer ${
              inCompare
                ? "bg-[#0B1C2E] text-white"
                : "bg-white/95 text-[#0B1C2E] border border-[#E2E8F0] hover:bg-[#EAF4F8]"
            }`}
          >
            <Icon name="compare_arrows" className="text-[16px]" />
          </button>
          <button
            type="button"
            onClick={handleShareWhatsapp}
            aria-label="مشاركة المنشأة"
            className="w-9 h-9 rounded-full bg-white/95 text-[#0B1C2E] border border-[#E2E8F0] hover:bg-[#EAF4F8] flex items-center justify-center shadow transition cursor-pointer"
          >
            <Icon name="share" className="text-[15px]" />
          </button>
        </div>
      </div>

      {/* Info Header + Schedule + Non-Activated Note */}
      <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-[0_8px_28px_rgba(11,28,46,0.05)] flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-black text-[#1D6E7D] inline-flex items-center gap-1">
            <Icon name="location_on" className="text-[14px] text-[#00ACC1]" />
            <span>
              {facility.city}
              {facility.district ? ` • ${facility.district}` : ""}
            </span>
          </span>
          {facility.rating > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 font-black">
              <Icon name="star" className="text-[13px] text-amber-500" />
              <span>
                {facility.rating}
                {facility.reviewsCount > 0 ? ` (${facility.reviewsCount})` : ""}
              </span>
            </span>
          ) : null}
        </div>
        <h1 className="font-section-title-mobile text-[#0B1C2E] font-black leading-snug">{facility.nameAr}</h1>
        <p className="text-xs text-[#64748B] font-semibold">
          {activeBranch ? activeBranch.addressAr : facility.addressAr}
        </p>
        {branchLocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {branchLocations.map((loc, idx) => {
              const active = idx === selectedLocIndex;
              return (
                <button
                  key={loc.id || idx}
                  type="button"
                  onClick={() => setSelectedLocIndex(idx)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                    active
                      ? "bg-[#1D6E7D] text-white border-[#1D6E7D] shadow-sm"
                      : "bg-[#F7F9FA] text-[#0B1C2E] border-[#E2E8F0] hover:bg-[#EAF4F8]"
                  }`}
                >
                  {loc.labelAr || `${loc.city}${loc.district ? ` — ${loc.district}` : ""}`}
                </button>
              );
            })}
          </div>
        )}
        {(facility.publicDescriptionAr || facility.scheduleSummaryAr) && (
          <div className="text-[11px] bg-[#F7F9FA] border border-[#E2E8F0] p-3 rounded-2xl text-[#0B1C2E] font-semibold flex items-start gap-2">
            <Icon name={isUnclaimed ? "info" : "schedule"} className="text-[14px] text-[#00ACC1] shrink-0 mt-0.5" />
            <span>{facility.publicDescriptionAr || facility.scheduleSummaryAr}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { key: "packages", label: `المدارس (${schoolPrograms.length})` },
          { key: "specs", label: "المواصفات" },
          { key: "coaches", label: `الكباتن (${totalCoachesCount})` },
          { key: "safety", label: "الأمان والحصص" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
              tab === t.key
                ? "bg-[#1D6E7D] text-white border-[#1D6E7D] shadow-sm"
                : "bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#0B1C2E]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "packages" && (
        <div className="flex flex-col gap-3">
          {!hasRealScheduleOrPricing ? (
            <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-sm text-center flex flex-col items-center gap-1.5">
              <Icon name="info" className="text-[24px] text-[#64748B]" />
              <div className="font-bold text-sm text-[#0B1C2E]">لا توجد بيانات متوفرة الآن</div>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                {isUnclaimed
                  ? "هذه المنشأة غير مسجلة على منصة Captenly بعد — لم تُضف أي باقات أو مواعيد حصص حتى الآن."
                  : "لم تقم إدارة المنشأة بنشر بطاقات المواعيد والأسعار بعد."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-[0_6px_22px_rgba(11,28,46,0.04)] flex flex-col gap-2.5">
              <div className="font-black text-sm text-[#0B1C2E]">
                بطاقات المواعيد والمدارس ({schoolPrograms.length})
              </div>
              {schoolPrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="rounded-2xl bg-[#F7F9FA] p-3.5 border border-[#E2E8F0] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black text-[#1D6E7D]">
                        {prog.trackLabelAr} {prog.ageRangeAr ? `• ${prog.ageRangeAr}` : ""}
                      </div>
                      <div className="font-black text-xs text-[#0B1C2E]">{prog.titleAr}</div>
                    </div>
                    <div className="text-base font-black text-[#1D6E7D] shrink-0">{prog.priceEgp} ج.م</div>
                  </div>
                  <div className="text-[11px] text-[#0B1C2E]/85 font-semibold flex items-center gap-1">
                    <Icon name="schedule" className="text-[13px] text-[#00ACC1]" />
                    <span>{prog.sessionTimeAr || prog.scheduleAr}</span>
                  </div>
                  <div className="text-[10px] text-[#64748B] font-semibold">
                    مدة الحصة: {prog.durationMinutes || 60} دقيقة
                    {prog.sessionsPerMonth ? ` • ${prog.sessionsPerMonth} حصة` : ""}
                  </div>
                  {prog.notesAr && (
                    <p className="text-[11px] text-[#64748B] bg-white border border-[#E2E8F0] p-2.5 rounded-xl leading-relaxed">
                      {prog.notesAr}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "specs" && (
        <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col gap-2 text-xs">
          {facility.poolSpecs && (
            <>
              <div className="flex justify-between py-2 border-b border-[#E2E8F0]">
                <span className="text-[#64748B] font-semibold">نوع المسبح</span>
                <span className="font-black text-[#0B1C2E]">{facility.poolSpecs.poolType}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E2E8F0]">
                <span className="text-[#64748B] font-semibold">التدفئة الشتوية</span>
                <span className="font-black text-[#1D6E7D]">
                  {facility.poolSpecs.isHeatedWinter ? "مدفأ شتاءً ✓" : "غير مدفأ"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#64748B] font-semibold">ساعات للسيدات</span>
                <span className="font-black text-[#1D6E7D]">
                  {facility.poolSpecs.hasLadiesOnlySlots ? "متوفرة ✓" : "مختلط"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "coaches" && (
        <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-sm">
          {totalCoachesCount > 0 ? (
            <div className="flex flex-col gap-3">
              {rosterCoaches.map((rc) => (
                <div
                  key={rc.id}
                  className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#E2E8F0] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-black text-xs text-[#0B1C2E]">{rc.fullNameAr}</div>
                      <div className="text-[11px] text-[#1D6E7D] font-bold">
                        {rc.roleTitleAr} • {rc.specialtyAr}
                      </div>
                    </div>
                    {rc.linkedCoachSlug && (
                      <Link
                        href={`/c/${rc.linkedCoachSlug}`}
                        className="px-3 py-1 rounded-full bg-[#1D6E7D] hover:bg-[#165966] text-white text-[10px] font-bold transition"
                      >
                        ملف الكابتن ←
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#E2E8F0]">
                    {rc.certificatesAr.map((cert, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20 text-[10px] font-bold text-[#1D6E7D]"
                      >
                        <Icon name="workspace_premium" className="text-[12px] text-[#00ACC1]" />
                        <span>{cert}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {affiliatedCoaches
                .filter((c) => !rosterCoaches.some((r) => r.linkedCoachId === c.id))
                .map((c) => (
                  <VerifiedCoachCard key={c.id} coach={c} />
                ))}
            </div>
          ) : (
            <div className="text-center py-3 flex flex-col items-center gap-2">
              <p className="text-xs text-[#64748B]">لم تُضف قائمة كباتن لهذه المنشأة بعد.</p>
            </div>
          )}
        </div>
      )}

      {tab === "safety" && (
        <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col gap-2.5">
          <h3 className="font-black text-sm text-[#0B1C2E]">
            كيف تفعّل دفتر الحصص وكود الاشتراك هنا؟
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            عند اشتراكك مع الإدارة أو الكابتن، يصدر لك كود اشتراك خاص بالباقة (مثل SUB-XXXX-XX) يعمل بالـ QR أو بالإدخال اليدوي حتى بدون إنترنت.
          </p>
          <Link
            href="/dashboard/ledger"
            className="w-fit px-4 py-2 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/25 text-[#1D6E7D] text-xs font-black hover:bg-[#1D6E7D] hover:text-white transition"
          >
            فتح دفتر الحصص ←
          </Link>
        </div>
      )}

      {facilityArticles.length > 0 && (
        <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col gap-2">
          <div className="font-black text-sm text-[#0B1C2E]">
            مقالات ومنشورات المنشأة ({facilityArticles.length})
          </div>
          {facilityArticles.map((art) => (
            <Link
              key={art.id}
              href={`/magazine/${art.slug}`}
              className="rounded-2xl bg-[#F7F9FA] hover:bg-[#EAF4F8] p-3 border border-[#E2E8F0] flex flex-col gap-1 transition"
            >
              <span className="text-[10px] font-black text-[#1D6E7D]">{art.categoryAr}</span>
              <span className="font-bold text-xs text-[#0B1C2E] line-clamp-1">{art.titleAr}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Location & Google Maps */}
      <div className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#0B1C2E] flex items-center gap-1.5">
            <Icon name="location_on" className="text-[15px] text-[#00ACC1]" />
            <span>الموقع والوصول عبر خرائط Google</span>
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

      {/* Action Buttons */}
      {!isUnclaimed && (
        <div className="flex flex-col gap-2.5 pt-1">
          <ContactChannelsBar
            supplyStatus={facility.supplyStatus}
            whatsappNumber={facility.whatsappNumber}
            facebookUrl={facility.facebookUrl}
            instagramUrl={facility.instagramUrl}
            onWhatsappClick={handleWhatsapp}
            fullWidthPrimary
          />
          <Link
            href={`/booking?facility=${facility.slug}`}
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                openAuthGateModal("تجهيز الحجز والتسجيل");
              }
            }}
            className="py-3 rounded-full bg-[#1D6E7D] hover:bg-[#165966] text-white text-xs font-black text-center shadow-sm transition"
          >
            تجهيز الحجز ←
          </Link>
        </div>
      )}
      <GuestFloatingAuthBar contextLabelAr={`أنشئ حسابك على Captenly لحفظ ${facility.nameAr} أو مقارنتها والتواصل المباشر`} />
    </div>
  );
}
