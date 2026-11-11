"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, X, ArrowLeft } from "lucide-react";
import { useCaptenly } from "@/context/CaptenlyContext";

export function FloatingCompareDrawer() {
  const pathname = usePathname();
  const { compareFacilityIds, facilities, toggleCompareFacility, clearComparison } =
    useCaptenly();

  if (compareFacilityIds.length === 0 || pathname === "/compare") {
    return null;
  }

  const selectedFacilities = compareFacilityIds
    .map((id) => facilities.find((f) => f.id === id))
    .filter(Boolean);

  return (
    <div className="fixed bottom-28 left-4 right-4 z-40 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto bg-captenly-slate text-white border-2 border-captenly-volt rounded-2xl shadow-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-captenly-volt text-captenly-slate font-extrabold text-xs px-3 py-1.5 rounded-xl">
            <Scale className="w-4 h-4" />
            <span>مقارنة المنشآت ({selectedFacilities.length} من 4)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedFacilities.map((fac) => (
              <div
                key={fac!.id}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 px-2.5 py-1 rounded-xl text-xs"
              >
                <span className="truncate max-w-[150px] font-bold">
                  {fac!.nameAr.split("—")[0]}
                </span>
                <button
                  onClick={() => toggleCompareFacility(fac!.id)}
                  className="text-slate-300 hover:text-red-400"
                  title="إزالة من المقارنة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ms-auto">
          <button
            onClick={clearComparison}
            className="text-xs text-slate-300 hover:text-white px-2 py-1"
          >
            مسح الكل
          </button>
          <Link
            href="/compare"
            className="inline-flex items-center gap-1.5 bg-captenly-volt hover:brightness-105 text-captenly-slate font-extrabold text-xs px-4 py-2 rounded-xl shadow-volt transition"
          >
            <span>قارن الأسعار والشارات الآن</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
