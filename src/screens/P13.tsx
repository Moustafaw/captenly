"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { resolveFacilityImage } from "@/components/editorial/FacilityCard";
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
    if (facility || !slug || !slug.startsWith("gplace-")) return;
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

  if (!facility) {
    return (
      <div className="screen-root bg-canvas-alabaster font-body-default min-h-screen flex items-center justify-center p-5">
        <div className="w-full rounded-3xl bg-surface-card border border-surface-container p-6 text-center flex flex-col items-center gap-3 shadow-sm">
          <Icon
            name={gplaceLoading || placesHydrating ? "travel_explore" : "pool"}
            className={`text-[32px] text-deep-olive ${gplaceLoading || placesHydrating ? "animate-pulse" : ""}`}
          />
          <h1 className="font-card-title text-dark-slate">
            {gplaceLoading || placesHydrating ? "جاري تحميل بيانات المنشأة..." : "لم نجد هذه المنشأة"}
          </h1>
          <p className="text-xs text-text-muted">
            {gplaceLoading || placesHydrating
              ? "يتم جلب تفاصيل المسبح القريب الآن."
              : "يمكنك استعراض جميع المسابح والأكاديميات القريبة من مدينتك."}
          </p>
          {!gplaceLoading && !placesHydrating && (
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
            >
              تصفح المسابح ←
            </Link>
          )}
        </div>
      </div>
    );
  }

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
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
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin py-4 flex flex-col gap-4 pb-24">
      {/* Verified text status only (zero unclaimed amber banner) */}
      {!isUnclaimed && (
        <div className="text-deep-olive text-xs font-extrabold flex items-center gap-2">
          <Icon name="verified" className="text-[17px]" />
          <span>صفحة منشأة موثقة وتُدار رسمياً</span>
        </div>
      )}

      {/* Hero Photo */}
      <div className="relative rounded-2xl overflow-hidden h-52 bg-surface-container shadow-sm">
        <img
          src={resolveFacilityImage(facility.heroImage)}
          alt={facility.nameAr}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => toggleFavorite(facility.id)}
            aria-label={fav ? "إزالة من المفضلة" : "حفظ المنشأة"}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow ${
              fav ? "bg-electric-volt text-dark-slate" : "bg-surface-card/90 text-dark-slate"
            }`}
          >
            <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[17px]" />
          </button>
          <button
            type="button"
            onClick={() => toggleCompareFacility(facility.id)}
            aria-label="إضافة للمقارنة"
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow ${
              inCompare ? "bg-dark-slate text-electric-volt" : "bg-surface-card/90 text-dark-slate"
            }`}
          >
            <Icon name="compare_arrows" className="text-[16px]" />
          </button>
          <button
            type="button"
            onClick={handleShareWhatsapp}
            aria-label="مشاركة المنشأة"
            className="w-9 h-9 rounded-full bg-surface-card/90 text-dark-slate flex items-center justify-center shadow"
          >
            <Icon name="share" className="text-[15px]" />
          </button>
        </div>
      </div>

      {/* Info Header + Schedule + Non-Activated Note */}
      <div className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-deep-olive">
            {facility.city} • {facility.district}
          </span>
          <span className="text-status-warning font-bold inline-flex items-center gap-1">
            <Icon name="star" className="text-[14px]" />
            <span>
              {facility.rating} ({facility.reviewsCount})
            </span>
          </span>
        </div>
        <h1 className="font-section-title-mobile text-dark-slate leading-snug">{facility.nameAr}</h1>
        <p className="text-xs text-text-muted">{facility.addressAr}</p>
        {(facility.publicDescriptionAr || facility.scheduleSummaryAr) && (
          <div className="text-[11px] bg-surface-snow p-2.5 rounded-xl text-dark-slate font-semibold flex items-start gap-1.5">
            <Icon name={isUnclaimed ? "info" : "schedule"} className="text-[14px] text-deep-olive shrink-0 mt-0.5" />
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
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap ${
              tab === t.key ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "packages" && (
        <div className="flex flex-col gap-3">
          {!hasRealScheduleOrPricing ? (
            <div className="bg-surface-card rounded-2xl p-5 shadow-sm border border-surface-container text-center flex flex-col items-center gap-1.5">
              <Icon name="info" className="text-[24px] text-text-muted" />
              <div className="font-card-title-sm text-dark-slate">لا توجد بيانات متوفرة الآن</div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {isUnclaimed
                  ? "هذه المنشأة غير مسجلة على منصة Captenly بعد — لم تُضف أي باقات أو مواعيد حصص حتى الآن."
                  : "لم تقم إدارة المنشأة بنشر بطاقات المواعيد والأسعار بعد."}
              </p>
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
              <div className="font-card-title-sm text-sm text-dark-slate">
                بطاقات المواعيد والمدارس ({schoolPrograms.length})
              </div>
              {schoolPrograms.map((prog) => (
                <div key={prog.id} className="rounded-xl bg-surface-snow p-3.5 border border-surface-container/70 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold text-deep-olive">
                        {prog.trackLabelAr} {prog.ageRangeAr ? `• ${prog.ageRangeAr}` : ""}
                      </div>
                      <div className="font-bold text-xs text-dark-slate">{prog.titleAr}</div>
                    </div>
                    <div className="text-base font-black text-deep-olive shrink-0">{prog.priceEgp} ج.م</div>
                  </div>
                  <div className="text-[11px] text-dark-slate/85 flex items-center gap-1">
                    <Icon name="schedule" className="text-[13px] text-deep-olive" />
                    <span>{prog.sessionTimeAr || prog.scheduleAr}</span>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    مدة الحصة: {prog.durationMinutes || 60} دقيقة
                    {prog.sessionsPerMonth ? ` • ${prog.sessionsPerMonth} حصة` : ""}
                  </div>
                  {prog.notesAr && (
                    <p className="text-[11px] text-text-muted bg-surface-card p-2 rounded-lg leading-relaxed">
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
        <div className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2 text-xs">
          {facility.poolSpecs && (
            <>
              <div className="flex justify-between py-1.5 border-b border-surface-container">
                <span className="text-text-muted">نوع المسبح</span>
                <span className="font-bold text-dark-slate">{facility.poolSpecs.poolType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container">
                <span className="text-text-muted">التدفئة الشتوية</span>
                <span className="font-bold text-deep-olive">
                  {facility.poolSpecs.isHeatedWinter ? "مدفأ شتاءً ✓" : "غير مدفأ"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-muted">ساعات للسيدات</span>
                <span className="font-bold text-deep-olive">
                  {facility.poolSpecs.hasLadiesOnlySlots ? "متوفرة ✓" : "مختلط"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "coaches" && (
        <div className="bg-surface-card rounded-2xl p-4 shadow-sm">
          {totalCoachesCount > 0 ? (
            <div className="flex flex-col gap-3">
              {rosterCoaches.map((rc) => (
                <div
                  key={rc.id}
                  className="rounded-xl bg-surface-snow p-4 border border-surface-container flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-dark-slate">{rc.fullNameAr}</div>
                      <div className="text-[11px] text-deep-olive font-bold">
                        {rc.roleTitleAr} • {rc.specialtyAr}
                      </div>
                    </div>
                    {rc.linkedCoachSlug && (
                      <Link
                        href={`/c/${rc.linkedCoachSlug}`}
                        className="px-2.5 py-1 rounded-full bg-dark-slate text-electric-volt text-[10px] font-bold"
                      >
                        ملف الكابتن ←
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-surface-container/60">
                    {rc.certificatesAr.map((cert, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-card border border-surface-container text-[10px] font-bold text-deep-olive"
                      >
                        <Icon name="workspace_premium" className="text-[12px]" />
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
              <p className="text-xs text-text-muted">لم تُضف قائمة كباتن لهذه المنشأة بعد.</p>
            </div>
          )}
        </div>
      )}

      {tab === "safety" && (
        <div className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
          <h3 className="font-card-title-sm text-sm text-dark-slate">
            كيف تفعّل دفتر الحصص وكود الاشتراك هنا؟
          </h3>
          <p className="text-xs text-text-muted leading-relaxed">
            عند اشتراكك مع الإدارة أو الكابتن، يصدر لك كود اشتراك خاص بالباقة (مثل SUB-XXXX-XX) يعمل بالـ QR أو بالإدخال اليدوي حتى بدون إنترنت.
          </p>
          <Link
            href="/dashboard/ledger"
            className="w-fit px-4 py-2 rounded-full bg-lime-tint text-deep-olive text-xs font-bold"
          >
            فتح دفتر الحصص ←
          </Link>
        </div>
      )}

      {facilityArticles.length > 0 && (
        <div className="bg-surface-card rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-2">
          <div className="font-card-title-sm text-sm text-dark-slate">
            مقالات ومنشورات المنشأة ({facilityArticles.length})
          </div>
          {facilityArticles.map((art) => (
            <Link
              key={art.id}
              href={`/magazine/${art.slug}`}
              className="rounded-xl bg-surface-snow p-3 border border-surface-container flex flex-col gap-1"
            >
              <span className="text-[10px] font-bold text-deep-olive">{art.categoryAr}</span>
              <span className="font-bold text-xs text-dark-slate line-clamp-1">{art.titleAr}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Location & Google Maps */}
      <div className="bg-surface-card rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-dark-slate flex items-center gap-1.5">
            <Icon name="location_on" className="text-[15px] text-deep-olive" />
            <span>الموقع والوصول عبر خرائط Google</span>
          </span>
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

      {/* Action Buttons */}
      {!isUnclaimed && (
        <div className="flex flex-col gap-2 pt-1">
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
            className="py-3 rounded-full bg-dark-slate text-electric-volt text-xs font-bold text-center shadow"
          >
            تجهيز الحجز ←
          </Link>
        </div>
      )}
      <GuestFloatingAuthBar contextLabelAr={`أنشئ حسابك على Captenly لحفظ ${facility.nameAr} أو مقارنتها والتواصل المباشر`} />
    </div>
  );
}
