"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function Desktop18() {
  const { facilities, smartFilters, updateSmartFilters, resetSmartFilters } = useCaptenly();

  const matchingCount = useMemo(() => {
    return facilities.filter((f) => {
      if (smartFilters.city !== "الكل" && f.city !== smartFilters.city) return false;
      if (smartFilters.sportCategory === "swimming" && f.sportSector === "fitness") return false;
      if (smartFilters.sportCategory === "fitness" && f.sportSector === "swimming") return false;
      if (smartFilters.heatedOnly && !f.poolSpecs?.isHeatedWinter) return false;
      if (
        smartFilters.ladiesOnly &&
        !f.poolSpecs?.hasLadiesOnlySlots &&
        !f.gymSpecs?.hasLadiesOnlySlots
      ) {
        return false;
      }
      if (smartFilters.lifeguardOnly && !f.poolSpecs?.hasEdlfLifeguard) return false;
      const basePrice = f.pricePackages[0]?.baseMonthlyEgp || 600;
      if (basePrice > smartFilters.maxPriceEgp) return false;
      return true;
    }).length;
  }, [facilities, smartFilters]);

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[920px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-hero-headline text-[28px] text-dark-slate">
              الفلاتر الذكية ومعايير الأمان الميداني
            </h1>
            <p className="font-body-compact text-text-muted mt-1">
              خصّص بحثك حسب المدينة، الميزانية، التدفئة الشتوية، ومواعيد السيدات المستقلة
            </p>
          </div>
          <button
            type="button"
            onClick={resetSmartFilters}
            className="px-4 py-2 rounded-full bg-surface-card text-text-muted hover:text-dark-slate text-xs font-bold shadow-sm"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>

        <section className="bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm flex flex-col gap-6">
          {/* Sport Sector */}
          <div className="flex flex-col gap-2">
            <label className="font-card-title-sm text-dark-slate">نوع النشاط الرياضي</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "الكل (سباحة وجيم)" },
                { key: "swimming", label: "مسابح ومدارس سباحة فقط" },
                { key: "fitness", label: "صالات جيم ولياقة فقط" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => updateSmartFilters({ sportCategory: s.key })}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                    smartFilters.sportCategory === s.key
                      ? "bg-dark-slate text-electric-volt"
                      : "bg-surface-snow text-text-muted hover:text-dark-slate"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          <div className="flex flex-col gap-2">
            <label className="font-card-title-sm text-dark-slate">المدينة / النطاق</label>
            <div className="flex flex-wrap gap-2">
              {["الكل", "المحلة الكبرى", "طنطا", "زفتى"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateSmartFilters({ city: c })}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                    smartFilters.city === c
                      ? "bg-lime-tint text-deep-olive"
                      : "bg-surface-snow text-text-muted hover:text-dark-slate"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Max Price */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-card-title-sm text-dark-slate">الحد الأقصى للاشتراك الشهري</label>
              <span className="font-bold text-deep-olive">{smartFilters.maxPriceEgp} ج.م</span>
            </div>
            <input
              type="range"
              min={400}
              max={2500}
              step={50}
              value={smartFilters.maxPriceEgp}
              onChange={(e) => updateSmartFilters({ maxPriceEgp: Number(e.target.value) })}
              className="w-full accent-deep-olive cursor-pointer"
            />
          </div>

          {/* Safety & Privacy Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: "heatedOnly" as const,
                title: "مسبح مدفأ شتاءً ومغطى",
                desc: "حرارة مياه مناسبة لتدريب الأطفال شتاءً",
                val: smartFilters.heatedOnly,
              },
              {
                key: "ladiesOnly" as const,
                title: "مواعيد أو صالات مخصصة للسيدات",
                desc: "خصوصية كاملة ومواعيد منفصلة",
                val: smartFilters.ladiesOnly,
              },
              {
                key: "lifeguardOnly" as const,
                title: "منقذ مائي دائم على الحوض",
                desc: "توفر إشراف إنقاذ خلال الحصص",
                val: smartFilters.lifeguardOnly,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => updateSmartFilters({ [item.key]: !item.val })}
                className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
                  item.val
                    ? "bg-lime-tint/60 border-deep-olive"
                    : "bg-surface-snow border-transparent hover:border-surface-container"
                }`}
              >
                <div>
                  <div className="font-card-title-sm text-dark-slate">{item.title}</div>
                  <div className="text-xs text-text-muted mt-0.5">{item.desc}</div>
                </div>
                <Icon
                  name={item.val ? "check_circle" : "add"}
                  className={item.val ? "text-deep-olive" : "text-text-muted"}
                />
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Link
              href="/explore"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title text-center shadow-md hover:opacity-95"
            >
              عرض {matchingCount} منشأة مطابقة الآن ←
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
