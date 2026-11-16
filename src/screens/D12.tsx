"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityImageOrFallback } from "@/components/editorial/FacilityCard";
import { getFacilityBookablePackages, getFacilityStartingPriceEgp } from "@/lib/facilityPricing";

export default function Desktop12() {
  const {
    facilities,
    compareFacilityIds,
    toggleCompareFacility,
    clearComparison,
    createStructuredWhatsappLead,
    currentPersona,
    minorAthletes,
  } = useCaptenly();

  const compared = facilities.filter((f) => compareFacilityIds.includes(f.id));
  const availableToAdd = facilities.filter((f) => !compareFacilityIds.includes(f.id));

  const getPrice = (f: (typeof facilities)[number]): number | null => {
    const p = getFacilityStartingPriceEgp(f);
    return p > 0 ? p : null;
  };
  const numericPrices = compared.map((f) => getPrice(f)).filter((p): p is number => p !== null);
  const lowestPrice = numericPrices.length > 1 ? Math.min(...numericPrices) : null;

  const openWhatsapp = (f: (typeof facilities)[number]) => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: f.id,
      targetNameAr: f.nameAr,
      whatsappNumber: f.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: minorAthletes[0]?.age || 25,
      requestedSpecialtyAr: f.specialtiesAr[0] || "اشتراك",
      preferredScheduleAr: "بالتنسيق",
    });
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  const criteriaRows = [
    {
      label: "الاشتراك الشهري المبدئي",
      icon: "payments",
      render: (f: (typeof facilities)[number]) => {
        const price = getPrice(f);
        if (price === null) {
          return (
            <span className="text-xs font-bold text-[#64748B]">غير معلن</span>
          );
        }
        const isLowest = lowestPrice !== null && price === lowestPrice;
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`font-black text-base lg:text-lg ${
                  isLowest ? "text-[#1D6E7D]" : "text-[#0F172A]"
                }`}
              >
                {price.toLocaleString("en-US")} ج.م
              </span>
              {isLowest && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] px-2 py-0.5 text-[10px] font-extrabold">
                  <span>الأقل سعراً</span>
                  <Icon name="check" className="text-[11px]" />
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-[#64748B]">
              شهرياً • {getFacilityBookablePackages(f)[0]?.sessionsCount || 8} حصة تدريبية
            </span>
          </div>
        );
      },
    },
    {
      label: "التوثيق والحالة",
      icon: "verified",
      render: (f: (typeof facilities)[number]) =>
        f.supplyStatus === "seeded_unclaimed" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 text-[11px] font-bold">
            لم تُفعّل حسابها المباشر بعد
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] px-2.5 py-1 text-[11px] font-extrabold">
            <Icon name="verified" className="text-[13px]" />
            <span>موثقة رسمياً بكابتنلي</span>
          </span>
        ),
    },
    {
      label: "المدينة والمنطقة",
      icon: "location_on",
      render: (f: (typeof facilities)[number]) => (
        <span className="text-xs font-bold text-[#0F172A] leading-relaxed">
          {f.city} — {f.district}
        </span>
      ),
    },
    {
      label: "التدفئة الشتوية",
      icon: "thermostat",
      render: (f: (typeof facilities)[number]) => {
        const good = Boolean(f.poolSpecs?.isHeatedWinter);
        const text = f.poolSpecs
          ? f.poolSpecs.isHeatedWinter
            ? "مسبح مدفأ شتاءً"
            : "غير مدفأ شتاءً"
          : "يُحدث عند التوثيق";
        return (
          <span
            className={`text-xs font-bold inline-flex items-center gap-1 ${
              good ? "text-[#1D6E7D]" : "text-[#64748B]"
            }`}
          >
            {good && <Icon name="thermostat" className="text-[14px]" />}
            <span>{text}</span>
          </span>
        );
      },
    },
    {
      label: "مواعيد مخصصة للسيدات",
      icon: "female",
      render: (f: (typeof facilities)[number]) => {
        const hasLadies = Boolean(
          f.poolSpecs?.hasLadiesOnlySlots || f.gymSpecs?.hasLadiesOnlySlots
        );
        return (
          <span
            className={`text-xs font-bold inline-flex items-center gap-1 ${
              hasLadies ? "text-[#1D6E7D]" : "text-[#64748B]"
            }`}
          >
            {hasLadies && <Icon name="check" className="text-[13px]" />}
            <span>{hasLadies ? "متوفرة مستقلة" : "مختلط / بتحديد مسبق"}</span>
          </span>
        );
      },
    },
    {
      label: "التقييم والمراجعات",
      icon: "star",
      render: (f: (typeof facilities)[number]) => (
        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#D97706]">
          <Icon name="star" className="text-[14px]" />
          <span className="text-[#0F172A]">{f.rating}</span>
          <span className="text-[#64748B] font-medium">({f.reviewsCount} تقييم)</span>
        </span>
      ),
    },
  ];

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0F172A] antialiased min-h-screen pt-4 lg:pt-7 pb-24 lg:pb-16 overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-4 lg:gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1D6E7D] mb-1">
              <Icon name="compare_arrows" className="text-[15px]" />
              <span>جدول المقارنة الشفافة</span>
            </div>
            <h1 className="font-hero-headline text-[22px] lg:text-[28px] text-[#0F172A] leading-snug">
              المقارنة الشفافة بين المنشآت ({compared.length}/4)
            </h1>
            <p className="font-body-compact text-xs lg:text-sm text-[#475569] mt-1 leading-relaxed">
              قارن الاشتراكات، التدفئة الشتوية، ساعات السيدات، وحالة التوثيق جنباً إلى جنب حتى 4 منشآت رياضية.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {compared.length > 0 && (
              <button
                type="button"
                onClick={clearComparison}
                className="px-4 py-2.5 rounded-full bg-white hover:bg-red-50 text-[#DC2626] text-xs font-bold shadow-sm border border-[#DC2626]/20 inline-flex items-center gap-1.5 transition-colors"
              >
                <Icon name="delete" className="text-[14px]" />
                <span>مسح المقارنة</span>
              </button>
            )}
            <Link
              href="/explore"
              className="px-4 lg:px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Icon name="add_circle" className="text-[15px]" />
              <span>إضافة منشأة من الدليل</span>
            </Link>
          </div>
        </div>

        {/* Quick Add Strip */}
        {availableToAdd.length > 0 && compared.length < 4 && (
          <div className="bg-white rounded-[20px] p-3.5 lg:p-4 shadow-[0_2px_16px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="text-xs font-extrabold text-[#1D6E7D] shrink-0 inline-flex items-center gap-1.5">
              <Icon name="tune" className="text-[15px]" />
              <span>أضف للمقارنة (المتبقي {4 - compared.length} من أصل 4):</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none sm:flex-wrap">
              {availableToAdd.slice(0, 8).map((fac) => (
                <button
                  key={fac.id}
                  type="button"
                  onClick={() => toggleCompareFacility(fac.id)}
                  className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] hover:text-[#1D6E7D] hover:border-[#1D6E7D]/30 text-[#0F172A] text-[11px] font-bold border border-[#0F172A]/10 transition-colors"
                >
                  + {fac.nameAr}
                </button>
              ))}
            </div>
          </div>
        )}

        {compared.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 lg:p-14 text-center shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col items-center gap-4 border border-[#0F172A]/8">
            <div className="w-16 h-16 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center">
              <Icon name="compare_arrows" className="text-[32px]" />
            </div>
            <h2 className="font-section-title text-[#0F172A]">لا توجد منشآت محددة للمقارنة حالياً</h2>
            <p className="text-xs lg:text-sm text-[#64748B] max-w-md leading-relaxed">
              اضغط على أيقونة المقارنة في أي كارت منشأة أو أضف منشآت من الأزرار أعلاه لبدء المقارنة المباشرة.
            </p>
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Icon name="explore" className="text-[15px]" />
              <span>تصفح الدليل المعتمد</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile Dedicated Comparison View (Fits 390px perfectly with zero horizontal overflow) */}
            <div className="lg:hidden flex flex-col gap-3.5">
              {/* Selected Facilities 2x2 Summary Cards Grid */}
              <div
                className={`grid gap-2.5 ${
                  compared.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {compared.map((f) => (
                  <div
                    key={f.id}
                    className="bg-white rounded-[20px] p-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col justify-between gap-2 min-w-0"
                  >
                    <div>
                      <div className="relative h-24 w-full rounded-xl overflow-hidden bg-[#EAF4F8]">
                        <FacilityImageOrFallback
                          facility={f}
                          compact
                          className="w-full h-full"
                          imgClassName="w-full h-full object-cover"
                        />
                        {f.supplyStatus !== "seeded_unclaimed" && (
                          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#0F172A]/75 backdrop-blur-sm text-white px-2 py-0.5 text-[9px] font-bold inline-flex items-center gap-1">
                            <Icon name="verified" className="text-[10px] text-[#38BDF8]" />
                            <span>معتمد</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleCompareFacility(f.id)}
                          aria-label={`إزالة ${f.nameAr} من المقارنة`}
                          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[#0F172A]/80 text-white flex items-center justify-center shadow"
                        >
                          <Icon name="close" className="text-[12px]" />
                        </button>
                      </div>
                      <Link
                        href={`/academy/${f.slug}`}
                        className="block font-card-title-sm text-xs text-[#0F172A] mt-2 leading-snug line-clamp-2 hover:text-[#1D6E7D]"
                      >
                        {f.nameAr}
                      </Link>
                      <span className="text-[10px] text-[#64748B] inline-flex items-center gap-0.5 mt-0.5 truncate max-w-full">
                        <Icon name="location_on" className="text-[11px] shrink-0 text-[#1D6E7D]" />
                        <span className="truncate">{f.district || f.city}</span>
                      </span>
                    </div>
                    <div className="text-sm font-black text-[#1D6E7D] pt-1.5 border-t border-[#0F172A]/6">
                      {(() => {
                        const price = getPrice(f);
                        return price != null ? (
                          <>
                            {price.toLocaleString("en-US")}{" "}
                            <span className="text-[10px] font-bold text-[#64748B]">ج.م/شهر</span>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-[#64748B]">غير معلن</span>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Criterion-by-Criterion Responsive Cards (No Horizontal Cutoff) */}
              {criteriaRows.map((row) => (
                <section
                  key={row.label}
                  className="bg-white rounded-[20px] p-3.5 shadow-[0_2px_16px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-2.5"
                >
                  <div className="flex items-center gap-1.5 text-[#0F172A] font-extrabold text-xs pb-2 border-b border-[#0F172A]/6">
                    <Icon name={row.icon} className="text-[16px] text-[#1D6E7D]" />
                    <span>{row.label}</span>
                  </div>
                  <div
                    className={`grid gap-2 ${
                      compared.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}
                  >
                    {compared.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-xl bg-[#F7F9FA] border border-[#0F172A]/5 p-2.5 flex flex-col gap-1 min-w-0"
                      >
                        <span className="text-[10px] font-bold text-[#64748B] truncate">
                          {f.nameAr}
                        </span>
                        <div className="min-w-0 break-words">{row.render(f)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {/* Quick Actions per Facility on Mobile */}
              <section className="bg-white rounded-[20px] p-3.5 shadow-[0_2px_16px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-[#0F172A] font-extrabold text-xs pb-2 border-b border-[#0F172A]/6">
                  <Icon name="chat" className="text-[16px] text-[#1D6E7D]" />
                  <span>التواصل وإجراءات الحجز المباشر</span>
                </div>
                <div className="flex flex-col gap-2">
                  {compared.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl bg-[#F7F9FA] border border-[#0F172A]/5 p-2.5 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-[#0F172A] truncate min-w-0 flex-1">
                        {f.nameAr}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/academy/${f.slug}`}
                          className="px-3 py-1.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[11px] font-bold"
                        >
                          التفاصيل
                        </Link>
                        <button
                          type="button"
                          onClick={() => openWhatsapp(f)}
                          className="px-3 py-1.5 rounded-full bg-[#15803D] hover:bg-[#166534] text-white text-[11px] font-bold"
                        >
                          واتساب
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Desktop Side-by-Side Table View */}
            <div className="hidden lg:block overflow-x-auto bg-white rounded-[24px] shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8">
              <table className="w-full text-right border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-[#0F172A]/8 bg-[#F7F9FA]/80">
                    <th className="p-5 w-56 align-bottom">
                      <span className="block text-[11px] font-bold text-[#1D6E7D] mb-1">نظام المفاضلة</span>
                      <span className="block font-card-title text-base text-[#0F172A]">المعايير المعتمدة</span>
                      <span className="block text-[11px] font-medium text-[#64748B] mt-1 leading-relaxed">
                        تم تدقيق المواصفات بالتعاون المباشر مع إدارات المسابح.
                      </span>
                    </th>
                    {compared.map((f) => (
                      <th key={f.id} className="p-4 align-top">
                        <div className="flex flex-col gap-2.5">
                          <div className="relative rounded-2xl overflow-hidden bg-[#EAF4F8]">
                            <FacilityImageOrFallback
                              facility={f}
                              compact
                              className="w-full h-32 rounded-2xl"
                              imgClassName="w-full h-32 object-cover rounded-2xl"
                            />
                            {f.supplyStatus !== "seeded_unclaimed" && (
                              <span className="absolute top-2 right-2 rounded-full bg-[#0F172A]/75 backdrop-blur-sm text-white px-2.5 py-0.5 text-[10px] font-bold inline-flex items-center gap-1">
                                <Icon name="verified" className="text-[12px] text-[#38BDF8]" />
                                <span>منشأة موثقة</span>
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/academy/${f.slug}`}
                            className="font-card-title text-[#0F172A] hover:text-[#1D6E7D] transition-colors"
                          >
                            {f.nameAr}
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleCompareFacility(f.id)}
                            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#F7F9FA] hover:bg-red-50 text-[#475569] hover:text-[#DC2626] border border-[#0F172A]/8 px-3 py-1.5 text-[11px] font-bold transition-colors"
                          >
                            <Icon name="close" className="text-[12px]" />
                            <span>إزالة من المقارنة</span>
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F172A]/6 text-sm">
                  {criteriaRows.map((row) => (
                    <tr key={row.label} className="hover:bg-[#F7F9FA]/50 transition-colors">
                      <td className="p-4 font-bold text-[#334155]">
                        <div className="flex items-center gap-2">
                          <Icon name={row.icon} className="text-[16px] text-[#1D6E7D]" />
                          <span>{row.label}</span>
                        </div>
                      </td>
                      {compared.map((f) => (
                        <td key={f.id} className="p-4 align-middle">
                          {row.render(f)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-[#F7F9FA]/40">
                    <td className="p-4 font-bold text-[#334155]">الإجراءات المباشرة</td>
                    {compared.map((f) => (
                      <td key={f.id} className="p-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openWhatsapp(f)}
                            className="px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold text-center inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                          >
                            <Icon name="chat" className="text-[14px]" />
                            <span>واتساب المنشأة</span>
                          </button>
                          <Link
                            href={`/academy/${f.slug}`}
                            className="px-4 py-2.5 rounded-xl bg-[#EAF4F8] hover:bg-[#DCEEF5] text-[#1D6E7D] text-xs font-bold text-center transition-colors"
                          >
                            عرض تفاصيل المنشأة
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Verification Note */}
            <div className="rounded-[20px] bg-[#EAF4F8]/70 border border-[#1D6E7D]/15 px-4 py-3 text-xs font-bold text-[#475569] flex items-center gap-2">
              <Icon name="verified" className="text-[17px] text-[#1D6E7D] shrink-0" />
              <span>
                بيانات المقارنة يتم تحديثها ومراجعتها ميدانياً من قبل فريق كابتنلي المعتمد بالتعاون مع المنشآت والاتحاد.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
