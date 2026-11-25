"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Facility } from "@/types/captenly";
import { useCaptenly } from "@/context/CaptenlyContext";
import { useState } from "react";
import { ContactChannelsBar } from "@/components/editorial/ContactChannelsBar";
import { getFacilityBookablePackages, getFacilityStartingPriceEgp } from "@/lib/facilityPricing";
import { cleanPublicAddressAr } from "@/lib/maps";

import { FacilityImageOrFallback, resolveFacilityImage } from "./FacilityImageOrFallback";

export { FacilityImageOrFallback, resolveFacilityImage };

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
    minorAthletes,
  } = useCaptenly();

  const [shareCopied, setShareCopied] = useState(false);

  const fav = isFavorite(facility.id);
  const inCompare = compareFacilityIds.includes(facility.id);
  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";
  const bookablePackages = getFacilityBookablePackages(facility);
  const basePackage = bookablePackages[0];
  const startingPrice = getFacilityStartingPriceEgp(facility);
  const monthlyPrice = startingPrice > 0 ? startingPrice : null;

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
      athleteAge: minorAthletes[0]?.age || 25,
      requestedSpecialtyAr: facility.specialtiesAr[0] || "استفسار عن الباقات",
      preferredScheduleAr: "الفترة المسائية",
    });
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleShareWhatsapp = () => {
    const priceSnippet = monthlyPrice ? ` — الاشتراك يبدأ من ${monthlyPrice} ج.م` : "";
    const shareText = `شوف صفحة ${facility.nameAr} (${facility.city}) على كابتنلي${priceSnippet}: ${
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
    <article className="bg-white rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col justify-between group hover:shadow-[0_12px_32px_rgba(29,110,125,0.1)] transition-all border border-[#0F172A]/6">
      <div>
        <div className="relative w-full h-52 overflow-hidden bg-[#EAF4F8]">
          <Link href={`/academy/${facility.slug}`} className="block w-full h-full">
            <FacilityImageOrFallback
              facility={facility}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </Link>

          {/* شارة التوثيق الرسمية عند الاعتماد فقط + تمييز الحساب المسجّل والأكاديميات متعددة المواقع */}
          {facility.supplyStatus === "verified_active" ? (
            <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-[#1D6E7D] font-badge-label text-[11px] font-bold shadow-sm border border-[#1D6E7D]/10">
                <Icon name="verified" className="text-[14px]" />
                <span>منشأة موثقة رسمياً</span>
              </span>
            </div>
          ) : !isUnclaimed ? (
            <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-[#0F172A] font-badge-label text-[11px] font-bold shadow-sm">
                <Icon name="pool" className="text-[13px] text-[#1D6E7D]" />
                <span>
                  {facility.locations && facility.locations.length > 1
                    ? `أكاديمية (${facility.locations.length} مواقع)`
                    : "حساب منشأة مسجّل"}
                </span>
              </span>
            </div>
          ) : null}

          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleFavorite(facility.id)}
              aria-label={fav ? "إزالة من المفضلة" : "حفظ المنشأة في المفضلة"}
              className={`w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-colors shadow-sm ${
                fav
                  ? "bg-[#1D6E7D] text-white"
                  : "bg-white/90 text-[#0F172A] hover:text-[#1D6E7D]"
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
                  ? "bg-[#1D6E7D] text-white"
                  : "bg-white/90 text-[#0F172A] hover:bg-[#1D6E7D] hover:text-white"
              }`}
            >
              <Icon name="compare_arrows" className="text-[16px]" />
            </button>
          </div>

          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {facility.poolSpecs?.isHeatedWinter && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#0F172A]/75 backdrop-blur-md text-white font-micro-caption text-[10px] font-bold">
                مسبح مدفأ شتاءً
              </span>
            )}
            {facility.poolSpecs?.hasLadiesOnlySlots || facility.gymSpecs?.hasLadiesOnlySlots ? (
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF4F8]/95 backdrop-blur-md text-[#1D6E7D] font-micro-caption text-[10px] font-bold">
                مواعيد للسيدات
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[#64748B] font-micro-caption text-micro-caption">
            <span className="font-bold text-[#0F172A]">
              {facility.city}
              {facility.district ? ` • ${facility.district}` : ""}
              {facility.locations && facility.locations.length > 1
                ? ` • +${facility.locations.length - 1} مواقع`
                : ""}
            </span>
            {facility.rating > 0 ? (
              <span className="flex items-center gap-1 text-status-warning font-bold">
                <Icon name="star" className="text-[14px]" />
                {facility.rating} {facility.reviewsCount > 0 ? `(${facility.reviewsCount})` : ""}
              </span>
            ) : null}
          </div>

          <Link href={`/academy/${facility.slug}`} className="group-hover:text-[#1D6E7D] transition-colors">
            <h3 className="font-card-title text-card-title text-[#0F172A] leading-snug">
              {facility.nameAr}
            </h3>
          </Link>

          <p className="font-body-compact text-body-compact text-[#64748B] line-clamp-2">
            {cleanPublicAddressAr(
              facility.publicDescriptionAr || facility.scheduleSummaryAr || facility.addressAr
            )}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            {facility.specialtiesAr.slice(0, 3).map((spec, idx) => (
              <span
                key={spec}
                className="text-[#1D6E7D] font-bold text-[11px] flex items-center gap-1.5"
              >
                {idx > 0 && <span className="text-[#CBD5E1]">•</span>}
                <span>{spec}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-2.5">
        <div className="bg-[#F7F9FA] border border-[#0F172A]/5 p-3 rounded-xl flex items-center justify-between gap-2">
          {!isUnclaimed ? (
            <div className="flex flex-col">
              <span className="font-micro-caption text-[11px] text-[#64748B]">
                الاشتراك الشهري الموثق
              </span>
              <div className="flex items-baseline gap-1">
                {monthlyPrice ? (
                  <>
                    <span className="font-price-tag text-price-tag text-[#1D6E7D]">
                      {monthlyPrice.toLocaleString("en-US")}
                    </span>
                    <span className="font-badge-label text-[11px] text-[#1D6E7D]">
                      ج.م {basePackage ? `/ ${basePackage.sessionsCount} حصة` : ""}
                    </span>
                  </>
                ) : (
                  <span className="font-badge-label text-xs text-[#64748B]">
                    الأسعار والمواعيد داخل الصفحة
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="font-micro-caption text-[11px] text-[#64748B]">
                دليل المواقع والسباحة
              </span>
              <span className="font-badge-label text-xs text-[#0F172A]">
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
              className="w-9 h-9 rounded-full bg-white border border-[#0F172A]/8 hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] flex items-center justify-center transition-colors shadow-xs"
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

        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          <Link
            href={`/academy/${facility.slug}`}
            className="text-[#1D6E7D] font-badge-label text-[12px] font-bold hover:underline flex items-center gap-1.5"
          >
            <span>{isUnclaimed ? "عرض الموقع والتفاصيل" : "تفاصيل الباقات والمواعيد"}</span>
            <Icon name="arrow_back" className="text-[14px]" />
          </Link>
        </div>
      </div>
    </article>
  );
}
