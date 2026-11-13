"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { resolveFacilityImage } from "@/components/editorial/FacilityCard";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { CaptenlyGoogleMap } from "@/components/maps/CaptenlyGoogleMap";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";

export default function Phone13() {
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

  const [tab, setTab] = useState<"packages" | "specs" | "coaches">("packages");

  if (!facility) return null;

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
  const fav = isFavorite(facility.id);
  const inCompare = compareFacilityIds.includes(facility.id);
  const pkg = facility.pricePackages[0];
  const affiliatedCoaches = coaches.filter(
    (c) =>
      c.isVerifiedCoach &&
      (facility.affiliatedCoachIds.includes(c.id) ||
        c.affiliations.some((a) => a.facilityId === facility.id))
  );

  const handleWhatsapp = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: facility.id,
      targetNameAr: facility.nameAr,
      whatsappNumber: facility.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: 10,
      requestedSpecialtyAr: pkg?.nameAr || facility.specialtiesAr[0] || "اشتراك",
      preferredScheduleAr: "بالتنسيق مع الإدارة",
    });
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
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
      <div className="flex gap-2">
        {[
          { key: "packages", label: `الباقات (${facility.pricePackages.length})` },
          { key: "specs", label: "المواصفات" },
          { key: "coaches", label: `الكباتن (${affiliatedCoaches.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2 rounded-full text-xs font-bold ${
              tab === t.key ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "packages" && (
        <div className="flex flex-col gap-3">
          {facility.pricePackages.map((p) => (
            <div key={p.id} className="bg-surface-card rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-card-title-sm text-sm text-dark-slate leading-snug">{p.nameAr}</div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {p.sessionsCount} حصة • {p.durationMinutes} دقيقة
                </div>
              </div>
              <div className="text-lg font-black text-deep-olive shrink-0">{p.baseMonthlyEgp} ج.م</div>
            </div>
          ))}
          {facility.schoolPrograms && facility.schoolPrograms.length > 0 && (
            <div className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
              <div className="font-card-title-sm text-sm text-dark-slate">مسارات مدارس السباحة</div>
              {facility.schoolPrograms.map((prog) => (
                <div key={prog.id} className="rounded-xl bg-surface-snow p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold text-deep-olive">
                      {prog.trackLabelAr} {prog.ageRangeAr ? `• ${prog.ageRangeAr}` : ""}
                    </div>
                    <div className="font-bold text-xs text-dark-slate">{prog.titleAr}</div>
                    <div className="text-[11px] text-text-muted">{prog.scheduleAr}</div>
                  </div>
                  <div className="text-base font-black text-deep-olive shrink-0">{prog.priceEgp} ج.م</div>
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
          {affiliatedCoaches.length > 0 ? (
            <div className="flex flex-col gap-3">
              {affiliatedCoaches.map((c) => (
                <VerifiedCoachCard key={c.id} coach={c} />
              ))}
            </div>
          ) : (
            <div className="text-center py-3 flex flex-col items-center gap-2">
              <p className="text-xs text-text-muted">لا يوجد كباتن مسجلون وموثقون في هذه الصفحة بعد.</p>
              <Link
                href="/claim?mode=coach"
                className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
              >
                وثّق ملفك ككابتن هنا
              </Link>
            </div>
          )}
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
            href={`/booking?facility=${facility.slug}&pkg=${pkg?.id || ""}`}
            className="py-3 rounded-full bg-dark-slate text-electric-volt text-xs font-bold text-center shadow"
          >
            تجهيز الحجز ←
          </Link>
        </div>
      )}
    </div>
  );
}
