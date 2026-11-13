"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Facility } from "@/types/captenly";
import { useCaptenly } from "@/context/CaptenlyContext";
import { useState } from "react";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";

export function resolveFacilityImage(heroImage?: string): string {
  if (heroImage && heroImage.startsWith("/")) return heroImage;
  if (heroImage && heroImage.startsWith("http")) return heroImage;
  return "/screens/20b781f698f9.jpg";
}

interface FacilityCardProps {
  facility: Facility;
  onSelectCompareFeedback?: (msg: string) => void;
}

export function FacilityCard({ facility, onSelectCompareFeedback }: FacilityCardProps) {
  const {
    isFavorite,
    toggleFavorite,
    compareFacilityIds,
    toggleCompareFacility,
    createStructuredWhatsappLead,
    currentPersona,
  } = useCaptenly();

  const [shareCopied, setShareCopied] = useState(false);

  const fav = isFavorite(facility.id);
  const inCompare = compareFacilityIds.includes(facility.id);
  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
  const basePackage = facility.pricePackages[0];
  const monthlyPrice = basePackage ? basePackage.baseMonthlyEgp : 650;

  const handleCompareClick = () => {
    const res = toggleCompareFacility(facility.id);
    if (!onSelectCompareFeedback) return;
    if (!res.ok && res.messageAr) {
      onSelectCompareFeedback(res.messageAr);
    } else {
      const nextCount = inCompare ? compareFacilityIds.length - 1 : compareFacilityIds.length + 1;
      onSelectCompareFeedback(
        inCompare
          ? `تمت إزالة «${facility.nameAr}» من المقارنة (${nextCount} من 4)`
          : `تمت إضافة «${facility.nameAr}» للمقارنة (${nextCount} من 4 — الحد الأقصى 4)`
      );
    }
  };

  const handleWhatsappLead = () => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: facility.id,
      targetNameAr: facility.nameAr,
      whatsappNumber: facility.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: 10,
      requestedSpecialtyAr: facility.specialtiesAr[0] || "استفسار عن الباقات",
      preferredScheduleAr: "الفترة المسائية",
    });
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareWhatsapp = () => {
    const shareText = `شوف باقة ${facility.nameAr} (${facility.city}) على كابتنلي — الاشتراك المتداول من ${monthlyPrice} ج.م: ${
      typeof window !== "undefined" ? `${window.location.origin}/academy/${facility.slug}` : ""
    }`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareText).catch(() => undefined);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <article className="bg-surface-card rounded-[16px] overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow border border-surface-container/60">
      <div>
        <div className="relative w-full h-48 overflow-hidden bg-surface-container">
          <Link href={`/academy/${facility.slug}`} className="block w-full h-full">
            <img
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              alt={facility.nameAr}
              src={resolveFacilityImage(facility.heroImage)}
            />
          </Link>

          {/* شارة المنشأة الموثقة فقط (بدون أي شارات مزعجة للمنشآت غير المفعلة) */}
          {!isUnclaimed && (
            <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-deep-olive font-badge-label text-badge-label shadow-sm">
                <Icon name="verified" className="text-[14px]" />
                <span>منشأة موثقة رسمياً</span>
              </span>
            </div>
          )}

          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleFavorite(facility.id)}
              aria-label={fav ? "إزالة من المفضلة" : "حفظ المنشأة في المفضلة"}
              className={`w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-colors shadow-sm ${
                fav
                  ? "bg-electric-volt text-dark-slate"
                  : "bg-surface-card/90 text-dark-slate hover:text-deep-olive"
              }`}
            >
              <Icon name={fav ? "bookmark" : "bookmark_border"} className="text-[17px]" />
            </button>

            <button
              type="button"
              onClick={handleCompareClick}
              aria-label="إضافة للمقارنة"
              title={inCompare ? "مضاف للمقارنة" : "أضف للمقارنة الجانبية"}
              className={`w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-colors shadow-sm ${
                inCompare
                  ? "bg-dark-slate text-electric-volt"
                  : "bg-surface-card/90 text-dark-slate hover:bg-dark-slate hover:text-electric-volt"
              }`}
            >
              <Icon name="compare_arrows" className="text-[16px]" />
            </button>
          </div>

          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {facility.poolSpecs?.isHeatedWinter && (
              <span className="px-2 py-0.5 rounded bg-dark-slate/85 text-surface-card font-micro-caption text-micro-caption">
                مسبح مدفأ شتاءً
              </span>
            )}
            {facility.poolSpecs?.hasLadiesOnlySlots || facility.gymSpecs?.hasLadiesOnlySlots ? (
              <span className="px-2 py-0.5 rounded bg-dark-slate/85 text-electric-volt font-micro-caption text-micro-caption">
                مواعيد للسيدات
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-space-md flex flex-col gap-2">
          <div className="flex items-center justify-between text-text-muted font-micro-caption text-micro-caption">
            <span className="font-bold text-dark-slate">
              {facility.city} • {facility.district}
            </span>
            <span className="flex items-center gap-1 text-status-warning font-bold">
              <Icon name="star" className="text-[14px]" />
              {facility.rating} ({facility.reviewsCount})
            </span>
          </div>

          <Link href={`/academy/${facility.slug}`} className="group-hover:text-deep-olive transition-colors">
            <h3 className="font-card-title text-card-title text-dark-slate leading-snug">
              {facility.nameAr}
            </h3>
          </Link>

          <p className="font-body-compact text-body-compact text-text-muted line-clamp-2">
            {facility.publicDescriptionAr || facility.scheduleSummaryAr || facility.addressAr}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            {facility.specialtiesAr.slice(0, 3).map((spec, idx) => (
              <span
                key={spec}
                className="text-deep-olive font-bold text-[11px] flex items-center gap-1.5"
              >
                {idx > 0 && <span className="text-surface-variant">•</span>}
                <span>{spec}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-space-md pb-space-md flex flex-col gap-2.5">
        <div className="bg-surface-snow p-space-sm rounded-xl flex items-center justify-between gap-2">
          {!isUnclaimed ? (
            <div className="flex flex-col">
              <span className="font-micro-caption text-micro-caption text-text-muted">
                الاشتراك الشهري الموثق
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-price-tag text-price-tag text-deep-olive">
                  {monthlyPrice.toLocaleString("en-US")}
                </span>
                <span className="font-badge-label text-badge-label text-deep-olive">
                  ج.م {basePackage ? `/ ${basePackage.sessionsCount} حصة` : ""}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="font-micro-caption text-micro-caption text-text-muted">
                دليل المواقع والسباحة
              </span>
              <span className="font-badge-label text-xs text-dark-slate">
                {facility.district} • {facility.city}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShareWhatsapp}
              title="مشاركة الصفحة"
              aria-label="مشاركة الصفحة"
              className="w-9 h-9 rounded-full bg-surface-card hover:bg-lime-tint text-dark-slate flex items-center justify-center transition-colors shadow-sm"
            >
              <Icon name={shareCopied ? "check" : "share"} className="text-[16px]" />
            </button>
            <ContactChannelsBar
              supplyStatus={facility.supplyStatus}
              whatsappNumber={facility.whatsappNumber}
              facebookUrl={facility.facebookUrl}
              instagramUrl={facility.instagramUrl}
              onWhatsappClick={handleWhatsappLead}
              compact
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Link
            href={`/academy/${facility.slug}`}
            className="text-deep-olive font-badge-label text-[12px] hover:underline flex items-center gap-1.5"
          >
            <span>{isUnclaimed ? "عرض الموقع والتفاصيل" : "تفاصيل الباقات والمواعيد"}</span>
            <Icon name="arrow_back" className="text-[14px]" />
          </Link>
        </div>
      </div>
    </article>
  );
}
