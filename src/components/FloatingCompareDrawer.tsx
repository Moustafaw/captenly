"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export function FloatingCompareDrawer() {
  const pathname = usePathname();
  const { compareFacilityIds, facilities, clearComparison } = useCaptenly();

  if (compareFacilityIds.length === 0 || pathname === "/compare") {
    return null;
  }

  const selectedCount = compareFacilityIds.filter((id) =>
    facilities.some((f) => f.id === id)
  ).length;

  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-24 left-4 lg:bottom-8 lg:left-8 z-40 pointer-events-none"
      dir="rtl"
    >
      <div className="relative pointer-events-auto group">
        <Link
          href="/compare"
          aria-label={`قارن الآن (${selectedCount} من 4 منشآت)`}
          className="w-[74px] h-[74px] sm:w-[82px] sm:h-[82px] rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white border-2 border-white shadow-[0_12px_32px_rgba(29,110,125,0.36)] flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 active:scale-95"
        >
          <Icon name="compare_arrows" className="text-[19px]" />
          <span className="text-[11px] font-extrabold leading-none">قارن الآن</span>
          <span className="text-[9px] font-bold text-white/85 leading-none mt-0.5">
            ({selectedCount}/4)
          </span>
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearComparison();
          }}
          title="إلغاء المقارنة"
          aria-label="إلغاء تحديد المقارنة"
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#0F172A] hover:bg-[#DC2626] text-white border border-white flex items-center justify-center shadow-md transition-colors"
        >
          <Icon name="close" className="text-[12px]" />
        </button>
      </div>
    </div>
  );
}
