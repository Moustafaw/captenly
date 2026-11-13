"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { FacilityCard } from "@/components/editorial/FacilityCard";

export default function Desktop4() {
  const { facilities, compareFacilityIds } = useCaptenly();
  const [city, setCity] = useState("الكل");
  const [heatedOnly, setHeatedOnly] = useState(false);
  const [ladiesOnly, setLadiesOnly] = useState(false);
  const [kidsOnly, setKidsOnly] = useState(false);

  const poolFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (f.sportSector === "fitness") return false;
      if (city !== "الكل" && f.city !== city) return false;
      if (heatedOnly && !f.poolSpecs?.isHeatedWinter) return false;
      if (ladiesOnly && !f.poolSpecs?.hasLadiesOnlySlots) return false;
      if (kidsOnly && !f.specialtiesAr.some((s) => s.includes("أطفال") || s.includes("تأسيس"))) {
        return false;
      }
      return true;
    });
  }, [facilities, city, heatedOnly, ladiesOnly, kidsOnly]);

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased">
      <main className="w-full pt-6 bg-canvas-alabaster min-h-screen pb-16">
        <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
          {/* Header Banner */}
          <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 flex flex-col gap-3">
              <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-xs w-fit">
                دليل المسابح ومدارس السباحة • المحلة الكبرى والغربية
              </span>
              <h1 className="font-hero-headline text-[28px] md:text-[34px] text-surface-card leading-tight">
                مسابح أوليمبية ونصف أوليمبية ومدفأة شتاءً لتأسيس الأطفال والأبطال
              </h1>
              <p className="font-body-default text-surface-container-high">
                قارن نوع المسبح (50م / 25م / تعليمي)، التدفئة الشتوية، كثافة الحارة، والباقات الشهرية المتاحة قبل التسجيل.
              </p>
            </div>
            <div className="lg:col-span-4 h-44 rounded-2xl overflow-hidden relative">
              <img
                src="/screens/20b781f698f9.jpg"
                alt="مسبح مدفأ"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-dark-slate/90 text-electric-volt text-xs font-bold">
                {poolFacilities.length} حمام سباحة متاح
              </div>
            </div>
          </section>

          {/* Interactive Filters Bar */}
          <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {["الكل", "المحلة الكبرى", "طنطا"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCity(c)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                    city === c
                      ? "bg-dark-slate text-electric-volt"
                      : "bg-surface-snow text-text-muted hover:text-dark-slate"
                  }`}
                >
                  {c}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setHeatedOnly((v) => !v)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                  heatedOnly ? "bg-lime-tint text-deep-olive" : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="thermostat" className="text-[14px]" />
                <span>مدفأ شتاءً</span>
              </button>

              <button
                type="button"
                onClick={() => setLadiesOnly((v) => !v)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                  ladiesOnly ? "bg-lime-tint text-deep-olive" : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="female" className="text-[14px]" />
                <span>ساعات سيدات</span>
              </button>

              <button
                type="button"
                onClick={() => setKidsOnly((v) => !v)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                  kidsOnly ? "bg-lime-tint text-deep-olive" : "bg-surface-snow text-text-muted"
                }`}
              >
                <Icon name="child_care" className="text-[14px]" />
                <span>تأسيس أطفال</span>
              </button>
            </div>

            {compareFacilityIds.length > 0 && (
              <Link
                href="/compare"
                className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold flex items-center gap-1.5"
              >
                <Icon name="compare_arrows" className="text-[15px]" />
                <span>جدول المقارنة ({compareFacilityIds.length} من 4)</span>
              </Link>
            )}
          </section>

          {/* Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
            {poolFacilities.map((fac) => (
              <FacilityCard key={fac.id} facility={fac} />
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
