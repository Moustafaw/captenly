"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { VerifiedCoachCard } from "@/components/editorial/VerifiedCoachCard";
import { FacilityCard } from "@/components/editorial/FacilityCard";

export default function CoachesDirectoryPage() {
  const { coaches, facilities } = useCaptenly();
  const [cityFilter, setCityFilter] = useState("الكل");
  const [sectorFilter, setSectorFilter] = useState<"all" | "swimming" | "fitness">("all");
  const [tab, setTab] = useState<"coaches" | "facilities">("coaches");

  const verifiedCoaches = useMemo(() => {
    return coaches.filter((c) => {
      if (!c.isVerifiedCoach) return false;
      if (cityFilter !== "الكل" && c.city !== cityFilter) return false;
      if (sectorFilter !== "all" && c.sportSector !== "both" && c.sportSector !== sectorFilter) {
        return false;
      }
      return true;
    });
  }, [coaches, cityFilter, sectorFilter]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (cityFilter !== "الكل" && f.city !== cityFilter) return false;
      if (sectorFilter !== "all" && f.sportSector !== "both" && f.sportSector !== sectorFilter) {
        return false;
      }
      return true;
    });
  }, [facilities, cityFilter, sectorFilter]);

  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop py-space-lg flex flex-col gap-space-lg">
        {/* Header Hero */}
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 md:p-10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-badge-label w-fit">
              <Icon name="verified" className="text-[16px]" />
              <span>دليل الكباتن المعتمدين والأندية — صفر حسابات وهمية</span>
            </div>
            <h1 className="font-hero-headline text-[30px] md:text-[34px] text-surface-card leading-tight">
              الكباتن والأكاديميات الموثقة في المحلة الكبرى والغربية
            </h1>
            <p className="font-body-default text-surface-container-high">
              لا تُنشر أي ملفات كباتن إلا بعد تسجيل الكابتن برقم موبايله واعتماد شهاداته للحصول على الشارات الخضراء، بينما يمكن للمنشآت تفعيل صفحاتها وإدارة بياناتها مجاناً.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href="/claim?mode=coach"
              className="px-6 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-center hover:brightness-105 transition-all shadow-md"
            >
              سجّل ككابتن ووثّق شهاداتك مجاناً
            </Link>
            <Link
              href="/claim"
              className="px-6 py-2.5 rounded-full bg-white/10 text-surface-card font-badge-label text-center hover:bg-white/20 transition-colors"
            >
              مطالبة إدارة منشأة بصفحتها
            </Link>
          </div>
        </section>

        {/* Filters + Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTab("coaches")}
              className={`px-4 py-2 rounded-full font-badge-label text-badge-label transition-colors ${
                tab === "coaches"
                  ? "bg-dark-slate text-electric-volt"
                  : "bg-surface-snow text-text-muted hover:text-dark-slate"
              }`}
            >
              الكباتن الموثقون ({verifiedCoaches.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("facilities")}
              className={`px-4 py-2 rounded-full font-badge-label text-badge-label transition-colors ${
                tab === "facilities"
                  ? "bg-dark-slate text-electric-volt"
                  : "bg-surface-snow text-text-muted hover:text-dark-slate"
              }`}
            >
              الأندية والأكاديميات ({filteredFacilities.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {["الكل", "المحلة الكبرى", "طنطا", "زفتى"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCityFilter(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  cityFilter === c
                    ? "bg-lime-tint text-deep-olive"
                    : "bg-surface-snow text-text-muted hover:text-dark-slate"
                }`}
              >
                {c}
              </button>
            ))}

            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value as "all" | "swimming" | "fitness")}
              className="rounded-full bg-surface-snow px-3.5 py-1.5 text-xs font-bold text-dark-slate outline-none"
            >
              <option value="all">كل الرياضات</option>
              <option value="swimming">السباحة فقط</option>
              <option value="fitness">الجيم واللياقة</option>
            </select>
          </div>
        </div>

        {/* Coaches Tab */}
        {tab === "coaches" && (
          <section className="flex flex-col gap-space-md">
            {verifiedCoaches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop">
                {verifiedCoaches.map((coach) => (
                  <VerifiedCoachCard key={coach.id} coach={coach} />
                ))}
              </div>
            ) : (
              <div className="bg-surface-card rounded-[20px] p-10 text-center shadow-sm flex flex-col items-center gap-4 border border-surface-container">
                <div className="w-16 h-16 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center">
                  <Icon name="workspace_premium" className="text-[32px]" />
                </div>
                <div className="max-w-xl flex flex-col gap-2">
                  <h2 className="font-section-title text-section-title text-dark-slate">
                    لا نعرض أي كابتن دون توثيق فعلي لشهاداته أولاً
                  </h2>
                  <p className="font-body-default text-text-muted">
                    حفاظاً على مصداقية المنصة وأمان السباحين، يظهر ملف الكابتن هنا فور تسجيله بنفسه برقم موبايله ورفع شهادة النقابة أو الاتحاد لاستلام الشارات الخضراء.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href="/claim?mode=coach"
                    className="px-6 py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm shadow-sm hover:opacity-95 transition-opacity"
                  >
                    كن أول كابتن موثق في مدينتك الآن
                  </Link>
                  <button
                    type="button"
                    onClick={() => setTab("facilities")}
                    className="px-6 py-3 rounded-full bg-surface-snow text-dark-slate font-card-title-sm hover:bg-surface-container transition-colors"
                  >
                    تصفح الأندية والأكاديميات ({filteredFacilities.length})
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Facilities Tab */}
        {tab === "facilities" && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop">
            {filteredFacilities.map((fac) => (
              <FacilityCard key={fac.id} facility={fac} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
