"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { resolveFacilityImage } from "@/components/editorial/FacilityCard";

export default function Desktop12() {
  const {
    facilities,
    compareFacilityIds,
    toggleCompareFacility,
    clearComparison,
    createStructuredWhatsappLead,
    currentPersona,
  } = useCaptenly();

  const compared = facilities.filter((f) => compareFacilityIds.includes(f.id));
  const availableToAdd = facilities.filter((f) => !compareFacilityIds.includes(f.id));

  const getPrice = (f: (typeof facilities)[number]) =>
    f.pricePackages[0]?.baseMonthlyEgp || 600;
  const lowestPrice =
    compared.length > 1 ? Math.min(...compared.map((f) => getPrice(f))) : null;

  const openWhatsapp = (f: (typeof facilities)[number]) => {
    const { whatsappUrl } = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: f.id,
      targetNameAr: f.nameAr,
      whatsappNumber: f.whatsappNumber,
      inquirerNameAr: currentPersona.fullNameAr,
      inquirerPhone: currentPersona.phone,
      athleteAge: 10,
      requestedSpecialtyAr: f.specialtiesAr[0] || "اشتراك",
      preferredScheduleAr: "بالتنسيق",
    });
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const criteriaRows = [
    {
      label: "الاشتراك الشهري المبدئي",
      icon: "payments",
      render: (f: (typeof facilities)[number]) => {
        const price = getPrice(f);
        const isLowest = lowestPrice !== null && price === lowestPrice;
        return (
          <div className="flex flex-col">
            <span className={`font-black text-base lg:text-lg ${isLowest ? "text-deep-olive" : "text-dark-slate"}`}>
              {price.toLocaleString("en-US")} ج.م
            </span>
            <span className="text-[11px] text-text-muted">
              {f.pricePackages[0]?.sessionsCount || 8} حصة
              {isLowest ? " • الأقل سعراً" : ""}
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
          <span className="text-xs font-bold text-text-muted">
            لم تُفعّل حسابها المباشر بعد
          </span>
        ) : (
          <span className="text-xs font-extrabold text-deep-olive inline-flex items-center gap-1">
            <Icon name="verified" className="text-[14px]" />
            <span>موثقة رسمياً</span>
          </span>
        ),
    },
    {
      label: "المدينة والمنطقة",
      icon: "location_on",
      render: (f: (typeof facilities)[number]) => (
        <span className="text-xs font-bold text-dark-slate leading-relaxed">
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
            : "غير مدفأ"
          : "يُحدث عند التوثيق";
        return (
          <span className={`text-xs font-bold ${good ? "text-deep-olive" : "text-text-muted"}`}>
            {text}
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
          <span className={`text-xs font-bold ${hasLadies ? "text-deep-olive" : "text-text-muted"}`}>
            {hasLadies ? "متوفرة مستقلة" : "مختلط / بتحديد مسبق"}
          </span>
        );
      },
    },
    {
      label: "التقييم والمراجعات",
      icon: "star",
      render: (f: (typeof facilities)[number]) => (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-status-warning">
          <Icon name="star" className="text-[14px]" />
          <span>
            {f.rating} ({f.reviewsCount})
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-4 lg:pt-6 pb-24 lg:pb-16 overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-4 lg:gap-space-lg">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="font-hero-headline text-[22px] lg:text-[28px] text-dark-slate leading-snug">
              المقارنة الشفافة بين المنشآت ({compared.length}/4)
            </h1>
            <p className="font-body-compact text-xs lg:text-sm text-text-muted mt-1 leading-relaxed">
              قارن الاشتراكات، التدفئة الشتوية، ساعات السيدات، وحالة التوثيق جنباً إلى جنب حتى 4 منشآت
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {compared.length > 0 && (
              <button
                type="button"
                onClick={clearComparison}
                className="px-4 py-2 rounded-full bg-surface-card text-status-danger text-xs font-bold shadow-sm border border-surface-container"
              >
                مسح المقارنة
              </button>
            )}
            <Link
              href="/explore"
              className="px-4 lg:px-5 py-2 lg:py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Icon name="add" className="text-[14px]" />
              <span>إضافة منشأة من الدليل</span>
            </Link>
          </div>
        </div>

        {/* Quick Add Strip */}
        {availableToAdd.length > 0 && compared.length < 4 && (
          <div className="bg-surface-card rounded-2xl p-3.5 lg:p-4 shadow-sm border border-surface-container flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="text-xs font-bold text-deep-olive shrink-0">
              أضف للمقارنة (المتبقي {4 - compared.length}):
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap">
              {availableToAdd.slice(0, 8).map((fac) => (
                <button
                  key={fac.id}
                  type="button"
                  onClick={() => toggleCompareFacility(fac.id)}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-surface-snow hover:bg-lime-tint text-dark-slate text-[11px] font-bold border border-surface-container/60 transition-colors"
                >
                  + {fac.nameAr}
                </button>
              ))}
            </div>
          </div>
        )}

        {compared.length === 0 ? (
          <div className="bg-surface-card rounded-[20px] p-10 lg:p-12 text-center shadow-sm flex flex-col items-center gap-4 border border-surface-container">
            <Icon name="compare_arrows" className="text-[36px] text-deep-olive" />
            <h2 className="font-section-title text-dark-slate">لا توجد منشآت محددة للمقارنة حالياً</h2>
            <p className="text-xs lg:text-sm text-text-muted max-w-md">
              اضغط على أيقونة المقارنة في أي كارت منشأة أو أضف منشآت من الأزرار أعلاه لبدء المقارنة المباشرة.
            </p>
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
                    className="bg-surface-card rounded-2xl p-2.5 shadow-sm border border-surface-container flex flex-col justify-between gap-2 min-w-0"
                  >
                    <div>
                      <div className="relative h-24 w-full rounded-xl overflow-hidden bg-surface-container">
                        <img
                          src={resolveFacilityImage(f.heroImage)}
                          alt={f.nameAr}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => toggleCompareFacility(f.id)}
                          aria-label={`إزالة ${f.nameAr} من المقارنة`}
                          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-dark-slate/85 text-white flex items-center justify-center shadow"
                        >
                          <Icon name="close" className="text-[12px]" />
                        </button>
                      </div>
                      <Link
                        href={`/academy/${f.slug}`}
                        className="block font-card-title-sm text-xs text-dark-slate mt-2 leading-snug line-clamp-2 hover:text-deep-olive"
                      >
                        {f.nameAr}
                      </Link>
                      <span className="text-[10px] text-text-muted block mt-0.5 truncate">
                        {f.city}
                      </span>
                    </div>
                    <div className="text-sm font-black text-deep-olive pt-1 border-t border-surface-container/60">
                      {getPrice(f).toLocaleString("en-US")}{" "}
                      <span className="text-[10px] font-bold">ج.م/شهر</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Criterion-by-Criterion Responsive Cards (No Horizontal Cutoff) */}
              {criteriaRows.map((row) => (
                <section
                  key={row.label}
                  className="bg-surface-card rounded-2xl p-3.5 shadow-sm border border-surface-container flex flex-col gap-2.5"
                >
                  <div className="flex items-center gap-1.5 text-deep-olive font-bold text-xs pb-1.5 border-b border-surface-container/60">
                    <Icon name={row.icon} className="text-[16px]" />
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
                        className="rounded-xl bg-surface-snow p-2.5 flex flex-col gap-1 min-w-0"
                      >
                        <span className="text-[10px] font-bold text-text-muted truncate">
                          {f.nameAr}
                        </span>
                        <div className="min-w-0 break-words">{row.render(f)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {/* Quick Actions per Facility on Mobile */}
              <section className="bg-surface-card rounded-2xl p-3.5 shadow-sm border border-surface-container flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-deep-olive font-bold text-xs pb-1.5 border-b border-surface-container/60">
                  <Icon name="chat" className="text-[16px]" />
                  <span>التواصل وحجز كل منشأة</span>
                </div>
                <div className="flex flex-col gap-2">
                  {compared.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl bg-surface-snow p-2.5 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-dark-slate truncate min-w-0 flex-1">
                        {f.nameAr}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/academy/${f.slug}`}
                          className="px-2.5 py-1.5 rounded-full bg-surface-card text-dark-slate border border-surface-container text-[11px] font-bold"
                        >
                          التفاصيل
                        </Link>
                        <button
                          type="button"
                          onClick={() => openWhatsapp(f)}
                          className="px-3 py-1.5 rounded-full bg-action-whatsapp text-white text-[11px] font-bold"
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
            <div className="hidden lg:block overflow-x-auto bg-surface-card rounded-[20px] shadow-sm border border-surface-container">
              <table className="w-full text-right border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-surface-container bg-surface-snow/60">
                    <th className="p-4 w-48 font-card-title-sm text-text-muted">معيار المقارنة</th>
                    {compared.map((f) => (
                      <th key={f.id} className="p-4 align-top">
                        <div className="flex flex-col gap-2">
                          <img
                            src={resolveFacilityImage(f.heroImage)}
                            alt={f.nameAr}
                            className="w-full h-28 object-cover rounded-xl"
                          />
                          <Link
                            href={`/academy/${f.slug}`}
                            className="font-card-title text-dark-slate hover:text-deep-olive"
                          >
                            {f.nameAr}
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleCompareFacility(f.id)}
                            className="text-[11px] text-status-danger font-bold w-fit hover:underline"
                          >
                            إزالة من الجدول
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {criteriaRows.map((row) => (
                    <tr key={row.label}>
                      <td className="p-4 font-bold text-text-muted">
                        <div className="flex items-center gap-2">
                          <Icon name={row.icon} className="text-[16px] text-deep-olive" />
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
                  <tr>
                    <td className="p-4 font-bold text-text-muted">الإجراء السريع</td>
                    {compared.map((f) => (
                      <td key={f.id} className="p-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openWhatsapp(f)}
                            className="px-4 py-2 rounded-full bg-action-whatsapp text-white text-xs font-bold text-center inline-flex items-center justify-center gap-1.5"
                          >
                            <Icon name="chat" className="text-[14px]" />
                            <span>واتساب مباشر</span>
                          </button>
                          <Link
                            href={`/academy/${f.slug}`}
                            className="px-4 py-2 rounded-full bg-surface-snow text-dark-slate text-xs font-bold text-center"
                          >
                            تفاصيل المنشأة
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
