"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
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
    <div className="fixed bottom-24 lg:bottom-8 left-3 right-3 z-40 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto bg-captenly-slate text-white border-2 border-captenly-volt rounded-2xl shadow-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 bg-captenly-volt text-captenly-slate font-extrabold text-xs px-3 py-1.5 rounded-xl shrink-0">
            <Icon name="compare_arrows" className="text-[15px]" />
            <span>مقارنة ({selectedFacilities.length}/4)</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedFacilities.map((fac) => (
              <div
                key={fac!.id}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 px-2.5 py-1 rounded-xl text-[11px]"
              >
                <span className="truncate max-w-[120px] font-bold">
                  {fac!.nameAr.split("—")[0]}
                </span>
                <button
                  onClick={() => toggleCompareFacility(fac!.id)}
                  className="text-slate-300 hover:text-red-400"
                  title="إزالة من المقارنة"
                >
                  <Icon name="close" className="text-[13px]" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ms-auto shrink-0">
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
            <span>قارن الآن</span>
            <Icon name="arrow_back" className="text-[15px]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
